"use client";

import React, { useEffect, useMemo, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import type { DbTemplateFile } from "@/app/api/admin/db-templates/route";

export type CloudProviderId = "supabase" | "sheets" | "firebase" | "drive";

interface CloudDatabaseGuidePanelProps {
  iosCardClass: string;
  iosInnerTileClass: string;
  onToast: (title: string, detail?: string, tone?: "ok" | "warn") => void;
  provider?: CloudProviderId;
  onProviderChange?: (provider: CloudProviderId) => void;
}

interface ProviderMeta {
  id: CloudProviderId;
  name: string;
  badge: string;
  badgeClass: string;
  icon: string;
  summary: string;
  pros: string[];
  steps: { title: string; detail: string }[];
  envTitle: string;
  envSnippet: string;
  connectTitle: string;
  connectFilename: string;
  connectSnippet: string;
}

const DRIVE_UPLOAD_ROUTE_SNIPPET = `// src/app/api/drive/upload/route.ts
import { NextResponse } from "next/server";
import { google } from "googleapis";
import { Readable } from "node:stream";

function getDriveClient() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\\\n/g, "\\n"),
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
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File exceeds 5MB limit" }, { status: 413 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const drive = getDriveClient();

    const created = await drive.files.create({
      requestBody: {
        name: \`citypulse-\${Date.now()}-\${file.name}\`,
        parents: [process.env.GOOGLE_DRIVE_FOLDER_ID!],
      },
      media: {
        mimeType: file.type || "image/jpeg",
        body: Readable.from(buffer),
      },
      fields: "id, name",
    });

    const fileId = created.data.id!;
    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    return NextResponse.json({
      fileId,
      fileName: created.data.name,
      imageUrl: \`/api/drive/image/\${fileId}\`,
      directUrl: \`https://lh3.googleusercontent.com/d/\${fileId}\`,
    });
  } catch (error) {
    console.error("Google Drive upload error:", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}`;

const DRIVE_IMAGE_PROXY_SNIPPET = `// src/app/api/drive/image/[fileId]/route.ts
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
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\\\n/g, "\\n"),
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
}`;

const PROVIDERS: ProviderMeta[] = [
  {
    id: "supabase",
    name: "Supabase (PostgreSQL)",
    badge: "แนะนำสำหรับ Production",
    badgeClass: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    icon: "database",
    summary:
      "ฐานข้อมูล PostgreSQL เต็มรูปแบบ รองรับ SQL, JOIN, Trigger นับโหวตอัตโนมัติ และ Row Level Security (RLS) แยกสิทธิ์ประชาชนกับเจ้าหน้าที่",
    pros: [
      "มี SQL Trigger นับยอด upvotes และผลโหวต Civic Polls ให้อัตโนมัติ ป้องกันการปั๊มคะแนน",
      "รองรับการ Query กรองจังหวัด เขต หน่วยงาน และพิกัดบนแผนที่ได้เร็วแม้เคสหลักแสนรายการ",
      "เก็บรูปภาพผ่าน Google Drive API แล้วบันทึกแค่ image_url + image_drive_file_id ลงตาราง complaints",
    ],
    steps: [
      {
        title: "สร้างโปรเจกต์บน Supabase",
        detail: "เข้าไปที่ supabase.com > New Project แล้วคัดลอก Project URL และ anon public key",
      },
      {
        title: "รัน SQL Editor ตามลำดับ 1 → 2 → 3",
        detail:
          "เปิดเมนู SQL Editor > New Query แล้วคัดลอกสคริปต์ 01_schema.sql, 02_rls_policies.sql และ 03_seed_defaults.sql ไปรันทีละไฟล์",
      },
      {
        title: "ตั้งค่าบัญชีเจ้าหน้าที่ (Officers)",
        detail:
          "เมื่อผู้ใช้ลงทะเบียนใน Supabase Auth แล้ว ให้นำ UUID จาก auth.users ไปเพิ่มในตาราง public.officers เพื่อให้ RLS อนุญาตอัปเดตสถานะเคสได้",
      },
      {
        title: "ติดตั้ง SDK และเชื่อมรูปภาพ Drive",
        detail:
          "รัน npm install @supabase/supabase-js googleapis แล้วนำค่า .env.local + โค้ดเชื่อมต่อด้านล่างไปใช้ใน src/lib/",
      },
    ],
    envTitle: ".env.local (Supabase + Google Drive API)",
    envSnippet: `NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY

# สำหรับอัปโหลดภาพขึ้น Google Drive (ดูรายละเอียดที่แท็บ Google Drive API)
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SERVICE_ACCOUNT_EMAIL=citypulse-drive@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`,
    connectTitle: "ตัวอย่าง Client Adapter เชื่อม Supabase + Google Drive",
    connectFilename: "src/lib/supabase-client.ts",
    connectSnippet: `// npm install @supabase/supabase-js
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// ตัวอย่าง: อัปโหลดรูปขึ้น Google Drive ก่อน แล้วบันทึกเรื่องร้องเรียนลง Supabase
export async function submitComplaintToSupabase(payload: {
  title: string;
  description: string;
  categoryId: string;
  coordinates: [number, number];
  reporterName: string;
  province: string;
  district: string;
  departmentId: string;
  imageFile?: File;
}) {
  let imageUrl: string | null = null;
  let imageDriveFileId: string | null = null;
  let imageName: string | null = null;

  if (payload.imageFile) {
    const fd = new FormData();
    fd.append("file", payload.imageFile);
    const uploadRes = await fetch("/api/drive/upload", { method: "POST", body: fd });
    const uploaded = await uploadRes.json();
    imageUrl = uploaded.imageUrl;
    imageDriveFileId = uploaded.fileId;
    imageName = uploaded.fileName;
  }

  const { data, error } = await supabase
    .from("complaints")
    .insert({
      title: payload.title,
      description: payload.description,
      category_id: payload.categoryId,
      lng: payload.coordinates[0],
      lat: payload.coordinates[1],
      reporter_name: payload.reporterName,
      province: payload.province,
      district: payload.district,
      department_id: payload.departmentId,
      image_url: imageUrl,
      image_drive_file_id: imageDriveFileId,
      image_name: imageName,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}`,
  },
  {
    id: "sheets",
    name: "Google Sheets (Apps Script)",
    badge: "ฟรี / แก้ไขข้อมูลในตารางได้ทันที",
    badgeClass: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    icon: "table",
    summary:
      "ใช้ Google Sheet เป็นฐานข้อมูลผ่าน Apps Script Web App พร้อมใช้ DriveApp อัปโหลดรูปลง Google Drive ได้ในสคริปต์เดียว เหมาะกับทีมที่อยากเปิดดู/แก้ไขข้อมูลใน Sheet ตรงๆ",
    pros: [
      "ไม่เสียค่าใช้จ่ายรายเดือน และใช้ DriveApp อัปโหลดรูปเข้า Google Drive ได้ทันทีไม่ต้องตั้ง Service Account",
      "ฟังก์ชัน setupDatabase() สร้างแท็บชีตครบทุกตาราง (complaints, timeline, comments, polls, citizens ฯลฯ) ให้ในคลิกเดียว",
      "รองรับ LockService กันข้อมูลชนกันเมื่อมีคนแจ้งเรื่องพร้อมกัน (ข้อจำกัด: เหมาะกับข้อมูลไม่เกิน ~50,000 แถว)",
    ],
    steps: [
      {
        title: "สร้าง Google Sheet และโฟลเดอร์ Google Drive",
        detail:
          "สร้าง Google Sheet ใหม่ + สร้างโฟลเดอร์ใน Google Drive สำหรับเก็บรูปภาพ แล้วคัดลอก Folder ID จาก URL (ส่วนหลัง /folders/)",
      },
      {
        title: "วางสคริปต์ Code.gs ใน Apps Script",
        detail:
          "ใน Google Sheet ไปที่เมนู Extensions > Apps Script ลบโค้ดเดิมออกแล้ววางโค้ด Code.gs ด้านล่าง จากนั้นกด Save",
      },
      {
        title: "ตั้งค่า Script Properties และรัน setupDatabase()",
        detail:
          "ไปที่ Project Settings (รูปเฟือง) > Script Properties เพิ่ม DRIVE_FOLDER_ID และ API_SECRET แล้วกลับไปเลือกฟังก์ชัน setupDatabase > กด Run เพื่อสร้างตารางทั้งหมด",
      },
      {
        title: "Deploy เป็น Web App และเชื่อม Next.js Proxy",
        detail:
          "กด Deploy > New deployment > เลือก Web app (Execute as: Me, Who has access: Anyone) แล้วนำ Web App URL มาใส่ใน .env.local",
      },
    ],
    envTitle: ".env.local (สำหรับเรียกผ่าน Next.js Server Proxy)",
    envSnippet: `APPS_SCRIPT_WEB_APP_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
APPS_SCRIPT_API_SECRET=your-strong-random-secret`,
    connectTitle: "Next.js API Proxy เชื่อม Google Sheets Web App (ซ่อน Secret)",
    connectFilename: "src/app/api/sheets/route.ts",
    connectSnippet: `// src/app/api/sheets/route.ts
import { NextResponse } from "next/server";

const SCRIPT_URL = process.env.APPS_SCRIPT_WEB_APP_URL!;
const API_SECRET = process.env.APPS_SCRIPT_API_SECRET!;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get("action") || "bootstrap";
  const table = searchParams.get("table") || "";

  const target = new URL(SCRIPT_URL);
  target.searchParams.set("action", action);
  target.searchParams.set("secret", API_SECRET);
  if (table) target.searchParams.set("table", table);

  const res = await fetch(target.toString(), { cache: "no-store" });
  const data = await res.json();
  return NextResponse.json(data);
}

export async function POST(request: Request) {
  const body = await request.json();
  const res = await fetch(SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: API_SECRET,
      action: body.action,
      payload: body.payload ?? {},
    }),
  });
  const data = await res.json();
  return NextResponse.json(data);
}`,
  },
  {
    id: "firebase",
    name: "Firebase (Cloud Firestore)",
    badge: "Realtime Sync / NoSQL",
    badgeClass: "bg-indigo-500/15 text-indigo-700 dark:text-cyan-300",
    icon: "cloud",
    summary:
      "ฐานข้อมูล NoSQL แบบ Realtime จาก Google ทำงานร่วมกับ Firebase Auth และ Firestore Security Rules แยกสิทธิ์ประชาชน/เจ้าหน้าที่อย่างเข้มงวด พร้อมเก็บรูปภาพบน Google Drive API",
    pros: [
      "อัปเดตสถานะบนแผนที่แบบ Real-time ทันทีด้วย onSnapshot() โดยไม่ต้องรีเฟรชหน้า",
      "Security Rules ตรวจสอบ Schema, ความยาวข้อความ, พิกัด และป้องกันการโกงยอดโหวตแบบ Atomic Batch",
      "ประหยัดค่า Firebase Storage ด้วยการอัปโหลดรูปภาพเข้า Google Drive API แทน แล้วเก็บเฉพาะ imageUrl + imageDriveFileId",
    ],
    steps: [
      {
        title: "เปิดใช้งาน Cloud Firestore & Authentication",
        detail:
          "สร้างโปรเจกต์ใน Firebase Console > เปิด Cloud Firestore และ Authentication (Email/Password + Anonymous)",
      },
      {
        title: "ติดตั้ง Security Rules และ Composite Indexes",
        detail:
          "คัดลอกเนื้อหา firestore.rules ไปวางที่ Firestore > Rules (หรือใช้คำสั่ง firebase deploy --only firestore:rules,firestore:indexes)",
      },
      {
        title: "กำหนดสิทธิ์เจ้าหน้าที่ (Custom Claims)",
        detail:
          "ตั้ง Custom Claim { officer: true, role: 'super_admin' } ให้บัญชีเจ้าหน้าที่ผ่าน Firebase Admin SDK และสร้างเอกสารใน officers/{uid}",
      },
      {
        title: "ติดตั้ง Firebase SDK + Cloud Function นับโพล",
        detail:
          "รัน npm install firebase googleapis แล้วเชื่อมกับ /api/drive/upload สำหรับอัปโหลดภาพประกอบเรื่องร้องเรียน",
      },
    ],
    envTitle: ".env.local (Firebase Client + Google Drive API)",
    envSnippet: `NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456:web:abcdef

# Google Drive API สำหรับเก็บรูปภาพ
GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SERVICE_ACCOUNT_EMAIL=citypulse-drive@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\n...\\n-----END PRIVATE KEY-----\\n"`,
    connectTitle: "Cloud Function ซิงค์คะแนนโพล + ตัวอย่างกดโหวต +1 แบบ Atomic Batch",
    connectFilename: "firebase-client-and-function.ts",
    connectSnippet: `// 1) ฝั่ง Client (Next.js): กด +1 เรื่องร้องเรียนแบบ Atomic Batch (ตรงกับ firestore.rules)
import { doc, writeBatch, increment, serverTimestamp } from "firebase/firestore";

export async function upvoteComplaintBatch(db: any, complaintId: string, uid: string) {
  const batch = writeBatch(db);
  batch.set(doc(db, "complaints", complaintId, "upvotes", uid), {
    userId: uid,
    createdAt: serverTimestamp(),
  });
  batch.update(doc(db, "complaints", complaintId), {
    upvotes: increment(1),
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
}

// 2) ฝั่ง Cloud Functions v2 (functions/src/index.ts): ซิงค์ผลโหวต civic_polls อัตโนมัติ
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const adminDb = getFirestore();

export const syncPollVotes = onDocumentWritten(
  "civic_polls/{pollId}/votes/{userId}",
  async (event) => {
    const beforeVote = event.data?.before.data()?.vote;
    const afterVote = event.data?.after.data()?.vote;
    if (beforeVote === afterVote) return;

    const updates: Record<string, unknown> = {};
    if (!beforeVote && afterVote) {
      updates.totalVotes = FieldValue.increment(1);
      updates[afterVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(1);
    } else if (beforeVote && afterVote) {
      updates[beforeVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(-1);
      updates[afterVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(1);
    }
    if (Object.keys(updates).length > 0) {
      await adminDb.doc(\`civic_polls/\${event.params.pollId}\`).update(updates);
    }
  }
);`,
  },
  {
    id: "drive",
    name: "Google Drive API (เก็บรูปภาพ)",
    badge: "ใช้ร่วมกับ Supabase / Firebase",
    badgeClass: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
    icon: "image",
    summary:
      "แยกไฟล์รูปภาพ (ภาพแจ้งเหตุ imageBase64 และภาพหลังแก้ไข resolvedImageBase64) ออกจากการเก็บเป็น Base64 ในฐานข้อมูล มาอัปโหลดขึ้น Google Drive API แล้วเก็บเพียง fileId + URL ไว้ใน DB",
    pros: [
      "ลดขนาดฐานข้อมูลลง 90%+ ไม่ชนขีดจำกัด 5MB ของ LocalStorage และประหยัดพื้นที่ Storage ของ DB",
      "มี Proxy Route (/api/drive/image/[fileId]) ช่วยสตรีมภาพพร้อม Cache-Control ลดปัญหา CORS/Cookie บล็กรูปจาก Google Drive",
      "เก็บ image_drive_file_id แยกไว้ เพื่อให้เจ้าหน้าที่ลบหรือเปลี่ยนภาพจาก Drive ได้เมื่อปิดเคส/ลบเคส",
    ],
    steps: [
      {
        title: "เปิดใช้งาน Google Drive API บน Google Cloud",
        detail:
          "ไปที่ console.cloud.google.com > APIs & Services > Library > ค้นหา Google Drive API แล้วกด Enable",
      },
      {
        title: "สร้าง Service Account และโหลด Key (JSON)",
        detail:
          "ไปที่ Credentials > Create Credentials > Service Account > Keys > Add Key (JSON) แล้วนำ client_email และ private_key ใส่ใน .env.local",
      },
      {
        title: "แชร์โฟลเดอร์ Google Drive ให้ Service Account",
        detail:
          "สร้างโฟลเดอร์บน Google Drive ของคุณ แล้วกด Share ใส่อีเมลของ Service Account โดยให้สิทธิ์เป็น Editor จากนั้นคัดลอก Folder ID",
      },
      {
        title: "ติดตั้ง googleapis และสร้าง 2 API Routes",
        detail:
          "รัน npm install googleapis แล้วสร้างไฟล์ src/app/api/drive/upload/route.ts และ src/app/api/drive/image/[fileId]/route.ts ตามโค้ดด้านล่าง",
      },
    ],
    envTitle: ".env.local (Google Drive Service Account)",
    envSnippet: `GOOGLE_DRIVE_FOLDER_ID=1AbCdEfGhIjKlMnOpQrStUvWxYz
GOOGLE_SERVICE_ACCOUNT_EMAIL=citypulse-drive@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\\nMIIEvQIBADANBgkqh...\\n-----END PRIVATE KEY-----\\n"`,
    connectTitle: "Next.js Route Handler: อัปโหลดและดึงภาพ Google Drive",
    connectFilename: "src/app/api/drive/upload/route.ts",
    connectSnippet: DRIVE_UPLOAD_ROUTE_SNIPPET,
  },
];

const TABLE_MAPPING_ROWS = [
  { localKey: "complaint-map-data", cloudTarget: "complaints + timeline + comments", note: "ภาพเก็บเป็น Drive fileId + URL" },
  { localKey: "civic-community-polls", cloudTarget: "civic_polls", note: "โพลประชาพิจารณ์บนแผนที่" },
  { localKey: "citypulse-citizen-accounts", cloudTarget: "citizens (Auth UID)", note: "ใช้ Auth Provider แทน plaintext password" },
  { localKey: "complaint-user-upvotes", cloudTarget: "complaint_upvotes / upvotes/{uid}", note: "ป้องกันการโหวตซ้ำด้วย PK/UID" },
  { localKey: "complaint-user-reports", cloudTarget: "Query: reporter_member_id = uid", note: "ดึงจากตาราง complaints โดยตรง" },
  { localKey: "civic-user-checkins", cloudTarget: "citizen_checkins / checkins/{date}", note: "เช็กอินรายวัน (1 ครั้ง/วัน)" },
  { localKey: "civic-user-comments", cloudTarget: "Query: author_id = uid", note: "ดึงจาก complaint_comments" },
  { localKey: "civic-user-poll-votes", cloudTarget: "poll_votes / votes/{uid}", note: "ซิงค์คะแนนรวมผ่าน Trigger/Function" },
  { localKey: "citypulse-system-settings", cloudTarget: "system_settings (id: 'global')", note: "พารามิเตอร์ SLA, Map, กติกา XP" },
  { localKey: "complaint-map-theme / style", cloudTarget: "localStorage + user_preferences", note: "คงไว้ในเครื่องเพื่อกันจอกะพริบ" },
];

export default function CloudDatabaseGuidePanel({
  iosCardClass,
  iosInnerTileClass,
  onToast,
  provider: controlledProvider,
  onProviderChange,
}: CloudDatabaseGuidePanelProps) {
  const [internalProvider, setInternalProvider] = useState<CloudProviderId>("supabase");
  const selectedProvider = controlledProvider ?? internalProvider;
  const setSelectedProvider = (next: CloudProviderId) => {
    setInternalProvider(next);
    onProviderChange?.(next);
  };
  const [templates, setTemplates] = useState<DbTemplateFile[]>([]);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  const [reloadTick, setReloadTick] = useState(0);
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [driveSnippetTab, setDriveSnippetTab] = useState<"upload" | "proxy">("upload");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const handleRefreshTemplates = () => {
    setIsLoadingTemplates(true);
    setReloadTick((t) => t + 1);
  };

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/db-templates", { cache: "no-store" })
      .then((res) => res.json() as Promise<{ files?: DbTemplateFile[] }>)
      .then((data) => {
        if (!cancelled) {
          setTemplates(data.files ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          onToast("โหลดไฟล์สคริปต์ไม่สำเร็จ", "กรุณาลองรีเฟรชอีกครั้ง", "warn");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingTemplates(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [reloadTick, onToast]);

  const providerMeta = useMemo(
    () => PROVIDERS.find((p) => p.id === selectedProvider) ?? PROVIDERS[0],
    [selectedProvider]
  );

  const providerFiles = useMemo(
    () => templates.filter((f) => f.provider === selectedProvider),
    [templates, selectedProvider]
  );

  const activeFile = useMemo(() => {
    if (providerFiles.length === 0) return null;
    return providerFiles.find((f) => f.id === selectedFileId) ?? providerFiles[0];
  }, [providerFiles, selectedFileId]);

  const handleCopy = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      onToast(`คัดลอก ${label} แล้ว`, "สามารถนำไปวางใช้งานได้ทันที");
      window.setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 2000);
    } catch {
      onToast("คัดลอกไม่สำเร็จ", "กรุณาเลือกข้อความแล้วคัดลอกด้วยตนเอง", "warn");
    }
  };

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    onToast(`ดาวน์โหลด ${filename} แล้ว`);
  };

  const displayedConnectCode =
    selectedProvider === "drive" && driveSnippetTab === "proxy"
      ? DRIVE_IMAGE_PROXY_SNIPPET
      : providerMeta.connectSnippet;

  const displayedConnectFilename =
    selectedProvider === "drive" && driveSnippetTab === "proxy"
      ? "src/app/api/drive/image/[fileId]/route.ts"
      : providerMeta.connectFilename;

  return (
    <div className="space-y-6">
      {/* Header Banner + Provider Selector */}
      <div className={`rounded-[28px] p-5 sm:p-6 space-y-4 ${iosCardClass}`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm sm:text-base font-black flex items-center gap-2">
              <JKIcon name="cloud" className="text-indigo-500" />
              <span>คู่มือย้ายฐานข้อมูลขึ้น Cloud + เก็บภาพด้วย Google Drive API</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              เลือกฐานข้อมูลที่ต้องการ แล้วคัดลอก SQL / Apps Script / Security Rules และโค้ดเชื่อมต่อ Google Drive API ไปใช้งานได้ทันที
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefreshTemplates}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black cursor-pointer shrink-0 transition ${iosInnerTileClass}`}
          >
            <JKIcon name="rotate-right" className={`text-[11px] ${isLoadingTemplates ? "animate-spin" : ""}`} />
            <span>รีเฟรชสคริปต์</span>
          </button>
        </div>

        {/* 4 Provider Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PROVIDERS.map((provider) => {
            const active = provider.id === selectedProvider;
            return (
              <button
                key={provider.id}
                type="button"
                onClick={() => {
                  setSelectedProvider(provider.id);
                  setSelectedFileId("");
                }}
                className={`text-left p-4 rounded-2xl border transition cursor-pointer flex flex-col justify-between gap-2 ${
                  active
                    ? "bg-indigo-500/12 dark:bg-indigo-500/20 border-indigo-500/60 shadow-sm"
                    : `${iosInnerTileClass} hover:bg-white dark:hover:bg-slate-800/70`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/12 text-indigo-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <JKIcon name={provider.icon} className="text-sm" />
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${provider.badgeClass}`}>
                    {provider.badge}
                  </span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white">
                    {provider.name}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5 leading-relaxed">
                    {provider.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Split: Setup Steps & Env (Left) + SQL / Script Editor (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: How-to Steps + Env + Mapping */}
        <div className="lg:col-span-5 space-y-6">
          <div className={`rounded-[28px] p-5 space-y-4 ${iosCardClass}`}>
            <div>
              <h3 className="text-sm font-black flex items-center gap-2">
                <JKIcon name="book" className="text-indigo-500" />
                <span>ขั้นตอนติดตั้ง {providerMeta.name}</span>
              </h3>
              <ul className="mt-2 space-y-1.5">
                {providerMeta.pros.map((pro, idx) => (
                  <li key={idx} className="text-[11px] text-slate-600 dark:text-slate-300 flex items-start gap-1.5">
                    <JKIcon name="circle-check" className="text-emerald-500 text-xs mt-0.5 shrink-0" />
                    <span>{pro}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10">
              {providerMeta.steps.map((step, index) => (
                <div key={step.title} className={`p-3 rounded-2xl flex items-start gap-3 ${iosInnerTileClass}`}>
                  <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-[11px] font-black flex items-center justify-center shrink-0 mt-0.5">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white">{step.title}</p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Environment Variables Snippet */}
          <div className={`rounded-[28px] p-5 space-y-3 ${iosCardClass}`}>
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-black flex items-center gap-1.5">
                <JKIcon name="key" className="text-amber-500" />
                <span>{providerMeta.envTitle}</span>
              </h3>
              <button
                type="button"
                onClick={() => handleCopy("env", providerMeta.envSnippet, ".env.local")}
                className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer transition ${iosInnerTileClass}`}
              >
                <JKIcon name={copiedKey === "env" ? "check" : "copy"} className="text-[10px]" />
                <span>{copiedKey === "env" ? "คัดลอกแล้ว" : "คัดลอก"}</span>
              </button>
            </div>
            <pre className="p-3.5 rounded-2xl bg-slate-950 text-sky-300 text-[11px] font-mono overflow-x-auto border border-white/10 leading-relaxed">
              {providerMeta.envSnippet}
            </pre>
          </div>

          {/* 11 LocalDB Mapping Summary */}
          <div className={`rounded-[28px] p-5 space-y-3 ${iosCardClass}`}>
            <h3 className="text-xs font-black flex items-center gap-1.5">
              <JKIcon name="sliders-h" className="text-purple-500" />
              <span>ตารางเปรียบเทียบ LocalDB (11 ตาราง) → Cloud DB</span>
            </h3>
            <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
              {TABLE_MAPPING_ROWS.map((row) => (
                <div
                  key={row.localKey}
                  className={`px-3 py-2 rounded-xl flex flex-col gap-0.5 ${iosInnerTileClass}`}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <code className="font-mono text-indigo-600 dark:text-cyan-300 font-bold truncate">
                      {row.localKey}
                    </code>
                    <span className="font-black text-slate-800 dark:text-slate-100 shrink-0">
                      → {row.cloudTarget}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400">{row.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: SQL / Script Editor Viewer + Connection Snippet */}
        <div className="lg:col-span-7 space-y-6">
          {/* Database Schema / Rules / Apps Script Viewer */}
          {selectedProvider !== "drive" && (
            <div className={`rounded-[28px] p-5 space-y-4 ${iosCardClass}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-black flex items-center gap-2">
                    <JKIcon name="terminal" className="text-emerald-500" />
                    <span>
                      {selectedProvider === "supabase"
                        ? "SQL Editor Scripts (วางรันใน Supabase SQL Editor)"
                        : selectedProvider === "sheets"
                        ? "Google Apps Script (วางใน Extensions > Apps Script)"
                        : "Firestore Rules & Composite Indexes"}
                    </span>
                  </h3>
                  {activeFile && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {activeFile.description}
                    </p>
                  )}
                </div>

                {activeFile && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        handleCopy(activeFile.id, activeFile.content, activeFile.filename)
                      }
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                    >
                      <JKIcon
                        name={copiedKey === activeFile.id ? "check" : "copy"}
                        className="text-[10px]"
                      />
                      <span>
                        {copiedKey === activeFile.id ? "คัดลอกแล้ว!" : `คัดลอก ${activeFile.filename}`}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadFile(activeFile.filename, activeFile.content)}
                      className={`px-3 py-2 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer ${iosInnerTileClass}`}
                    >
                      <JKIcon name="file-export" className="text-[10px]" />
                      <span>ดาวน์โหลด</span>
                    </button>
                  </div>
                )}
              </div>

              {/* File Tabs */}
              {providerFiles.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {providerFiles.map((file) => {
                    const isFileActive = activeFile?.id === file.id;
                    return (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => setSelectedFileId(file.id)}
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer flex items-center gap-1.5 ${
                          isFileActive
                            ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                            : `${iosInnerTileClass} hover:bg-white dark:hover:bg-slate-800`
                        }`}
                      >
                        <JKIcon name="file" className="text-[10px]" />
                        <span>{file.title}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Code Preview */}
              {isLoadingTemplates ? (
                <div className={`p-8 rounded-2xl text-center text-xs font-bold ${iosInnerTileClass}`}>
                  กำลังโหลดสคริปต์จากไฟล์ระบบ...
                </div>
              ) : activeFile ? (
                <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-[460px] overflow-y-auto border border-white/10 leading-relaxed">
                  {activeFile.content}
                </pre>
              ) : null}
            </div>
          )}

          {/* Next.js Connection / Google Drive API Code */}
          <div className={`rounded-[28px] p-5 space-y-4 ${iosCardClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-black flex items-center gap-2">
                  <JKIcon name="code" className="text-sky-500" />
                  <span>{providerMeta.connectTitle}</span>
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  ไฟล์เป้าหมาย:{" "}
                  <code className="font-mono text-indigo-600 dark:text-cyan-300">
                    {displayedConnectFilename}
                  </code>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    handleCopy("connect", displayedConnectCode, displayedConnectFilename)
                  }
                  className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black flex items-center gap-1.5 transition cursor-pointer shadow-sm"
                >
                  <JKIcon
                    name={copiedKey === "connect" ? "check" : "copy"}
                    className="text-[10px]"
                  />
                  <span>{copiedKey === "connect" ? "คัดลอกแล้ว!" : "คัดลอกโค้ดเชื่อมต่อ"}</span>
                </button>
              </div>
            </div>

            {selectedProvider === "drive" && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDriveSnippetTab("upload")}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                    driveSnippetTab === "upload"
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : iosInnerTileClass
                  }`}
                >
                  1. อัปโหลดภาพ (/api/drive/upload)
                </button>
                <button
                  type="button"
                  onClick={() => setDriveSnippetTab("proxy")}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                    driveSnippetTab === "proxy"
                      ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900"
                      : iosInnerTileClass
                  }`}
                >
                  2. ดึงภาพแสดงผล (/api/drive/image/[fileId])
                </button>
              </div>
            )}

            <pre className="p-4 rounded-2xl bg-slate-950 text-cyan-200 text-[11px] font-mono overflow-x-auto max-h-[460px] overflow-y-auto border border-white/10 leading-relaxed">
              {displayedConnectCode}
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
}
