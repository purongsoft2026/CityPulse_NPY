import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface DbTemplateFile {
  id: string;
  provider: "supabase" | "sheets" | "firebase";
  title: string;
  filename: string;
  language: string;
  description: string;
  content: string;
}

const TEMPLATE_ALLOWLIST: Array<{
  id: string;
  provider: DbTemplateFile["provider"];
  title: string;
  filename: string;
  language: string;
  description: string;
  relativePath: string;
}> = [
  {
    id: "supabase-schema",
    provider: "supabase",
    title: "1. Schema & Triggers",
    filename: "01_schema.sql",
    language: "sql",
    description: "วางใน Supabase SQL Editor เพื่อสร้าง 11 ตาราง, Enum, Index และ Trigger นับโหวตอัตโนมัติ",
    relativePath: "database/supabase/01_schema.sql",
  },
  {
    id: "supabase-rls",
    provider: "supabase",
    title: "2. RLS Security Policies",
    filename: "02_rls_policies.sql",
    language: "sql",
    description: "วางรันต่อจากข้อ 1 เพื่อเปิด Row Level Security แยกสิทธิ์ประชาชน / เจ้าหน้าที่ / Admin",
    relativePath: "database/supabase/02_rls_policies.sql",
  },
  {
    id: "supabase-seed",
    provider: "supabase",
    title: "3. Seed ข้อมูลเริ่มต้น",
    filename: "03_seed_defaults.sql",
    language: "sql",
    description: "วางรันข้อ 3 เพื่อใส่ค่าตั้งต้น System Settings, โพลชุมชน 4 รายการ และเคสตัวอย่าง",
    relativePath: "database/supabase/03_seed_defaults.sql",
  },
  {
    id: "sheets-apps-script",
    provider: "sheets",
    title: "Google Apps Script (Code.gs)",
    filename: "Code.gs",
    language: "javascript",
    description: "วางใน Extensions > Apps Script ของ Google Sheet แล้วรัน setupDatabase() + Deploy Web App",
    relativePath: "database/google-sheets/Code.gs",
  },
  {
    id: "firebase-rules",
    provider: "firebase",
    title: "1. Firestore Security Rules",
    filename: "firestore.rules",
    language: "javascript",
    description: "วางใน Firebase Console > Firestore Database > Rules หรือ deploy ด้วย Firebase CLI",
    relativePath: "database/firebase/firestore.rules",
  },
  {
    id: "firebase-indexes",
    provider: "firebase",
    title: "2. Composite Indexes",
    filename: "firestore.indexes.json",
    language: "json",
    description: "ไฟล์สำหรับสร้าง Index ให้ Query แผนที่และหน้า Admin ทำงานได้เร็ว",
    relativePath: "database/firebase/firestore.indexes.json",
  },
];

export async function GET() {
  const rootDir = process.cwd();

  const files: DbTemplateFile[] = await Promise.all(
    TEMPLATE_ALLOWLIST.map(async (item) => {
      const fullPath = path.join(rootDir, item.relativePath);
      let content = "";
      try {
        content = await readFile(fullPath, "utf8");
      } catch {
        content = `-- ไม่พบไฟล์ ${item.relativePath}`;
      }
      return {
        id: item.id,
        provider: item.provider,
        title: item.title,
        filename: item.filename,
        language: item.language,
        description: item.description,
        content,
      };
    })
  );

  return NextResponse.json({ files });
}

