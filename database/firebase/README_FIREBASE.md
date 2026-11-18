# คู่มือตั้งค่า Firebase (Cloud Firestore) + Google Drive API สำหรับ CityPulse

## 1. ไฟล์ในชุดนี้
- `database/firebase/firestore.rules` — Security Rules สำหรับทุก Collection และ Subcollection
- `database/firebase/firestore.indexes.json` — Composite Indexes สำหรับ Query บนแผนที่และหน้า Admin

---

## 2. Cloud Functions & Batch Sync (สำหรับ Sync ตัวนับ `upvotes` และผลโหวต `civic_polls`)
ใน `firestore.rules` ออกแบบความปลอดภัยของตัวนับไว้ 2 แบบร่วมกัน:
- **`complaints/{complaintId}` (`upvotes`)**: อัปเดตแบบ Atomic Batch (`writeBatch`) จากฝั่ง Client โดยต้องสร้าง/ลบ `complaints/{complaintId}/upvotes/{uid}` พร้อมกันใน Batch เดียว (Rules จะตรวจ `getAfter` ไม่ให้ปั๊มคะแนนเกิน `+1`/`-1`) — จึง **ไม่ต้อง** เขียน Cloud Function ซ้ำสำหรับ `upvotes`
- **`civic_polls/{pollId}` (`agreeCount` / `disagreeCount` / `totalVotes`)**: ฝั่ง Client เขียนเฉพาะ `civic_polls/{pollId}/votes/{uid}` แล้วให้ Cloud Functions (Admin SDK) เป็นคนบวก/ลบตัวนับให้:

```ts
// functions/src/index.ts
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

// Sync civic_polls agreeCount / disagreeCount / totalVotes
export const syncPollVotes = onDocumentWritten(
  "civic_polls/{pollId}/votes/{userId}",
  async (event) => {
    const beforeVote = event.data?.before.data()?.vote as "agree" | "disagree" | undefined;
    const afterVote = event.data?.after.data()?.vote as "agree" | "disagree" | undefined;
    if (beforeVote === afterVote) return;

    const updates: Record<string, unknown> = {};
    if (!beforeVote && afterVote) {
      updates.totalVotes = FieldValue.increment(1);
      updates[afterVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(1);
    } else if (beforeVote && !afterVote) {
      updates.totalVotes = FieldValue.increment(-1);
      updates[beforeVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(-1);
    } else if (beforeVote && afterVote) {
      updates[beforeVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(-1);
      updates[afterVote === "agree" ? "agreeCount" : "disagreeCount"] = FieldValue.increment(1);
    }

    if (Object.keys(updates).length > 0) {
      await db.doc(`civic_polls/${event.params.pollId}`).update(updates);
    }
  }
);
```

---

## 3. สคริปต์ Seed ข้อมูลเริ่มต้น (รันครั้งเดียวด้วย `node`)
สามารถใช้ไฟล์ `civic_polls` และ `system_settings/global` ด้านล่างผ่าน Firebase Console หรือ Admin SDK:

### Document: `system_settings/global`
```json
{
  "platformName": "CityPulse",
  "defaultMapStyle": "voyager",
  "maintenanceMode": false,
  "maintenanceMessage": "ระบบกำลังบำรุงรักษาฐานข้อมูลชั่วคราว ขออภัยในความไม่สะดวก",
  "allowAnonymousReports": true,
  "autoAssignDepartment": true,
  "enableAir4ThaiLayer": true,
  "slaDefaultHours": 48,
  "maxUploadSizeMb": 5,
  "xpRewards": {
    "DAILY_CHECKIN": 15,
    "UPVOTE": 5,
    "COMMENT": 10,
    "POLL_VOTE": 20,
    "REPORT": 50,
    "PHOTO_BONUS": 25,
    "RESOLVED_BONUS": 100
  }
}
```

### คำสั่ง Deploy Rules & Indexes
```bash
firebase deploy --only firestore:rules,firestore:indexes
```

