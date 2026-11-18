# คู่มือย้ายฐานข้อมูล CityPulse + เก็บภาพด้วย Google Drive API

เอกสารและสคริปต์ในโฟลเดอร์ `database/` ออกแบบให้รองรับโครงสร้างข้อมูลทั้ง **11 ตาราง (LocalDB Collections)** ของ CityPulse (`src/lib/civic-store.ts`, `src/lib/system-settings.ts`, `src/lib/citizen-auth.ts`) พร้อมแยกเก็บไฟล์รูปภาพ (ภาพแจ้งเหตุ `imageBase64` และภาพหลังแก้ไข `resolvedImageBase64`) ไปไว้บน **Google Drive API**

---

## 1. เปรียบเทียบตัวเลือกฐานข้อมูลทั้ง 3 แบบ

| เกณฑ์พิจารณา | Google Sheets (Apps Script) | Supabase (PostgreSQL) | Firebase (Cloud Firestore) |
| :--- | :--- | :--- | :--- |
| **ความเหมาะสม** | โปรเจกต์นำร่อง / ทีมงานอยากดูและแก้ข้อมูลในตาราง Excel/Sheet ทันที | **แนะนำสำหรับ Production** — มี SQL, JOIN, Trigger นับโหวตอัตโนมัติ, RLS และ Realtime | **แนะนำถ้าเน้น Realtime Mobile/Web** — NoSQL Sync ไว, ทำงานคู่ Firebase Auth ดีมาก |
| **ขีดจำกัดข้อมูล** | ~50,000–100,000 แถว (ช้าลงเมื่อข้อมูลโต, Rate limit ~30 req/min) | 500 MB ฟรี (PostgreSQL เต็มรูปแบบ รองรับ PostGIS แผนที่) | 1 GB ฟรี, อ่านฟรี 50,000/วัน, เขียนฟรี 20,000/วัน |
| **การป้องกันโกงโหวต / Counter** | ใช้ `LockService` ใน `Code.gs` | ใช้ Unique Primary Key + Database Trigger (`sync_complaint_upvote_count`, `sync_poll_vote_counts`) | ใช้ Subcollection `upvotes/{uid}` / `votes/{uid}` + Cloud Function Trigger |
| **การเก็บรูปภาพ** | ใช้ `DriveApp` ใน `Code.gs` ได้เลย ไม่ต้องตั้งค่า Service Account แยก | เรียก Next.js `/api/drive/upload` (Google Drive API) แล้วเก็บ `image_url` + `image_drive_file_id` | เรียก Next.js `/api/drive/upload` (Google Drive API) แล้วเก็บ `imageUrl` + `imageDriveFileId` |
| **ไฟล์สคริปต์ในชุดนี้** | `database/google-sheets/Code.gs` | `database/supabase/01_schema.sql`<br>`database/supabase/02_rls_policies.sql`<br>`database/supabase/03_seed_defaults.sql` | `database/firebase/firestore.rules`<br>`database/firebase/firestore.indexes.json` |

---

## 2. การแมป 11 ตารางจาก LocalDB สู่ฐานข้อมูลจริง

1. `complaint-map-data` -> ตาราง/Collection `complaints` (+ `complaint_timeline`, `complaint_comments`)
2. `civic-community-polls` -> `civic_polls`
3. `citypulse-citizen-accounts` -> `citizens` (ใช้ Supabase Auth / Firebase Auth จัดการรหัสผ่านแทนการเก็บ Plaintext; ส่วน Google Sheets ใช้ `passwordHash` + `salt`)
4. `complaint-user-upvotes` -> `complaint_upvotes` (Supabase/Sheets) หรือ subcollection `complaints/{id}/upvotes/{uid}` (Firebase)
5. `complaint-user-reports` -> Query จาก `complaints` โดย filter `reporter_member_id = user.id`
6. `civic-user-checkins` -> `citizen_checkins` (Supabase/Sheets) หรือ `citizens/{uid}/checkins/{YYYY-MM-DD}` (Firebase)
7. `civic-user-comments` -> Query จาก `complaint_comments` โดย filter `author_id = user.id`
8. `civic-user-poll-votes` -> `poll_votes` (Supabase/Sheets) หรือ `civic_polls/{pollId}/votes/{uid}` (Firebase)
9. `citypulse-system-settings` -> `system_settings` (row/doc ID: `global`)
10. `complaint-map-theme` -> เก็บใน `localStorage` เพื่อกันหน้าจอกะพริบ + sync ลง `user_preferences` (optional)
11. `complaint-map-style` -> เก็บใน `localStorage` + sync ลง `user_preferences` (optional)

---

## 3. โค้ดอัปโหลดและแสดงภาพผ่าน Google Drive API (ใช้ได้ทั้ง Supabase และ Firebase)

### 3.1 เตรียม Google Cloud & Google Drive Folder
1. ไปที่ [Google Cloud Console](https://console.cloud.google.com/) -> เปิดใช้งาน **Google Drive API**
2. สร้าง **Service Account** -> สร้าง Key แบบ JSON แล้วนำค่ามาใส่ใน `.env.local`:
   ```env
   GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
   GOOGLE_SERVICE_ACCOUNT_EMAIL=citypulse-drive@your-project.iam.gserviceaccount.com
   GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
3. เปิดโฟลเดอร์ใน Google Drive -> กด **Share** ให้ `GOOGLE_SERVICE_ACCOUNT_EMAIL` เป็นสิทธิ์ **Editor**
4. ติดตั้งแพ็กเกจ:
   ```bash
   npm install googleapis
   ```

### 3.2 Next.js Route Handler: อัปโหลดภาพ (`src/app/api/drive/upload/route.ts`)

```ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "node:stream";

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive.file"],
  });
  return google.drive({ version: "v3", auth });
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }

    // ตรวจสอบขนาด (ตาม system_settings.maxUploadSizeMb เช่น 5 MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const drive = getDriveClient();

    const created = await drive.files.create({
      requestBody: {
        name: `citypulse-${Date.now()}-${file.name}`,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: file.type || "image/jpeg",
        body: Readable.from(buffer),
      },
      fields: "id, name",
    });

    const fileId = created.data.id!;

    // (ทางเลือก) เปิดสิทธิ์ดูผ่านลิงก์ หรือใช้ Proxy Route /api/drive/image/[fileId] ด้านล่างแทน
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    return NextResponse.json({
      fileId,
      fileName: created.data.name,
      // ใช้ Proxy Route ของ Next.js เองเพื่อเลี่ยงปัญหา Google Drive 403/Cookie ในเบราว์เซอร์
      imageUrl: `/api/drive/image/${fileId}`,
      directUrl: `https://lh3.googleusercontent.com/d/${fileId}`,
    });
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
```

### 3.3 Next.js Image Proxy Route (`src/app/api/drive/image/[fileId]/route.ts`)
> แนะนำให้ใช้ Proxy Route นี้เวลาแสดงภาพใน `<img src="/api/drive/image/..." />` เพราะเสถียรที่สุดและไม่โดน CORS/Third-party cookie block ของ Google Drive

```ts
import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET(
  _req: Request,
  context: { params: Promise<{ fileId: string }> }
) {
  const { fileId } = await context.params;
  if (!/^[a-zA-Z0-9_-]{10,64}$/.test(fileId)) {
    return NextResponse.json({ error: "Invalid fileId" }, { status: 400 });
  }

  try {
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive.readonly"],
    });
    const drive = google.drive({ version: "v3", auth });

    const meta = await drive.files.get({ fileId, fields: "mimeType" });
    const media = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" }
    );

    return new NextResponse(media.data as ArrayBuffer, {
      headers: {
        "Content-Type": meta.data.mimeType || "image/jpeg",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found" }, { status: 404 });
  }
}
```

---

## 4. โครงสร้าง Firestore เพิ่มเติม (สำหรับตัวเลือก Firebase)

ไฟล์ `database/firebase/firestore.rules` และ `database/firebase/firestore.indexes.json` ถูกสร้างไว้พร้อม deploy ผ่าน Firebase CLI (`firebase deploy --only firestore`) แล้ว โดยแนะนำโครงสร้าง Document ดังนี้:

- `complaints/{complaintId}`
  ```json
  {
    "id": "complaint-1",
    "title": "ถนนพระรามที่ 4 มีหลุมขนาดใหญ่",
    "description": "...",
    "categoryId": "road",
    "status": "inprogress",
    "priority": "urgent",
    "coordinates": { "lng": 100.5401, "lat": 13.7290 },
    "reporterName": "สมชาย ใจดี",
    "phone": "081-234-5678",
    "isAnonymous": false,
    "reporterMemberId": "uid_xxx",
    "imageUrl": "/api/drive/image/1AbCdEf...",
    "imageDriveFileId": "1AbCdEf...",
    "imageName": "pothole-rama4.jpg",
    "resolvedImageUrl": null,
    "resolvedImageDriveFileId": null,
    "province": "กรุงเทพมหานคร",
    "district": "เขตปทุมวัน",
    "departmentId": "dept-public-works",
    "assignedOfficer": "นายวิทยา สมบูรณ์",
    "upvotes": 42,
    "createdAt": "Timestamp",
    "updatedAt": "Timestamp"
  }
  ```
  - Subcollections:
    - `complaints/{complaintId}/timeline/{eventId}`
    - `complaints/{complaintId}/comments/{commentId}`
    - `complaints/{complaintId}/upvotes/{userId}`
- `civic_polls/{pollId}` + Subcollection `votes/{userId}`
- `citizens/{userId}` + Subcollection `checkins/{YYYY-MM-DD}`
- `officers/{userId}` (กำหนดสิทธิ์เจ้าหน้าที่ผ่าน Firebase Custom Claims `officer: true` หรือเอกสารใน `officers`)
- `system_settings/global`
- `user_preferences/{userId}`

