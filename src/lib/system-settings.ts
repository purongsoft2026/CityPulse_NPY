import { CITIZEN_XP_REWARDS } from "@/data/map-data";
import {
  CHECKINS_STORAGE_KEY,
  MAP_STYLE_STORAGE_KEY,
  MY_COMMENTS_STORAGE_KEY,
  MY_REPORTS_STORAGE_KEY,
  POLLS_STORAGE_KEY,
  POLL_VOTES_STORAGE_KEY,
  STORAGE_KEY,
  THEME_STORAGE_KEY,
  UPVOTES_STORAGE_KEY,
} from "@/lib/civic-store";
import {
  CUSTOM_OFFICERS_STORAGE_KEY,
  OFFICER_OVERRIDES_STORAGE_KEY,
} from "@/lib/officer-auth";
import { CUSTOM_DEPARTMENTS_STORAGE_KEY } from "@/lib/departments-store";
import type { MapStyleKey } from "@/components/map/MapHeader";

export const SYSTEM_SETTINGS_STORAGE_KEY = "citypulse-system-settings";
export const CITIZEN_ACCOUNTS_STORAGE_KEY = "citypulse-citizen-accounts";
const SYSTEM_SETTINGS_SYNC_EVENT = "citypulse-system-settings-sync";

export type GistdaFloodPeriod =
  | "1day"
  | "3days"
  | "7days"
  | "30days"
  | "flood-freq"
  | "water-hyacinth";

export const GISTDA_FLOOD_PERIOD_OPTIONS: { id: GistdaFloodPeriod; label: string; shortLabel: string }[] = [
  { id: "1day", label: "น้ำท่วม 1 วันล่าสุด (GISTDA)", shortLabel: "1 วัน" },
  { id: "3days", label: "น้ำท่วม 3 วันล่าสุด (GISTDA)", shortLabel: "3 วัน" },
  { id: "7days", label: "น้ำท่วม 7 วันล่าสุด (GISTDA)", shortLabel: "7 วัน" },
  { id: "30days", label: "น้ำท่วม 30 วันล่าสุด (GISTDA)", shortLabel: "30 วัน" },
  { id: "flood-freq", label: "พื้นที่น้ำท่วมซ้ำซาก (GISTDA)", shortLabel: "ซ้ำซาก" },
  { id: "water-hyacinth", label: "ผักตบชวา/สิ่งกีดขวางทางน้ำ (GISTDA)", shortLabel: "ผักตบชวา" },
];

export interface SystemSettings {
  platformName: string;
  defaultMapStyle: MapStyleKey;
  maintenanceMode: boolean;
  maintenanceMessage: string;
  allowAnonymousReports: boolean;
  autoAssignDepartment: boolean;
  enableAir4ThaiLayer: boolean;
  gistdaApiKey: string;
  gistdaFloodPeriod: GistdaFloodPeriod;
  slaDefaultHours: number;
  maxUploadSizeMb: number;
  xpRewards: {
    DAILY_CHECKIN: number;
    UPVOTE: number;
    COMMENT: number;
    POLL_VOTE: number;
    REPORT: number;
    PHOTO_BONUS: number;
    RESOLVED_BONUS: number;
  };
}

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  platformName: "CityPulse",
  defaultMapStyle: "voyager",
  maintenanceMode: false,
  maintenanceMessage:
    "ระบบกำลังบำรุงรักษาฐานข้อมูลชั่วคราว ขออภัยในความไม่สะดวก",
  allowAnonymousReports: true,
  autoAssignDepartment: true,
  enableAir4ThaiLayer: true,
  gistdaApiKey: "",
  gistdaFloodPeriod: "7days",
  slaDefaultHours: 48,
  maxUploadSizeMb: 5,
  xpRewards: {
    DAILY_CHECKIN: CITIZEN_XP_REWARDS.DAILY_CHECKIN,
    UPVOTE: CITIZEN_XP_REWARDS.UPVOTE,
    COMMENT: CITIZEN_XP_REWARDS.COMMENT,
    POLL_VOTE: CITIZEN_XP_REWARDS.POLL_VOTE,
    REPORT: CITIZEN_XP_REWARDS.REPORT,
    PHOTO_BONUS: CITIZEN_XP_REWARDS.PHOTO_BONUS,
    RESOLVED_BONUS: CITIZEN_XP_REWARDS.RESOLVED_BONUS,
  },
};

let cachedSettingsRaw: string | null = null;
let cachedSettingsParsed: SystemSettings = DEFAULT_SYSTEM_SETTINGS;

export function getSystemSettingsSnapshot(): SystemSettings {
  if (typeof window === "undefined") return DEFAULT_SYSTEM_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SYSTEM_SETTINGS_STORAGE_KEY);
    if (raw === cachedSettingsRaw) return cachedSettingsParsed;
    cachedSettingsRaw = raw;
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<SystemSettings>;
      cachedSettingsParsed = {
        ...DEFAULT_SYSTEM_SETTINGS,
        ...parsed,
        xpRewards: {
          ...DEFAULT_SYSTEM_SETTINGS.xpRewards,
          ...(parsed.xpRewards ?? {}),
        },
      };
      return cachedSettingsParsed;
    }
  } catch {
    // ignore malformed storage
  }
  cachedSettingsParsed = DEFAULT_SYSTEM_SETTINGS;
  return cachedSettingsParsed;
}

export function writeSystemSettings(next: SystemSettings): boolean {
  if (typeof window === "undefined") return false;
  try {
    const serialized = JSON.stringify(next);
    cachedSettingsRaw = serialized;
    cachedSettingsParsed = next;
    window.localStorage.setItem(SYSTEM_SETTINGS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(SYSTEM_SETTINGS_SYNC_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function resetSystemSettings(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(SYSTEM_SETTINGS_STORAGE_KEY);
    cachedSettingsRaw = null;
    cachedSettingsParsed = DEFAULT_SYSTEM_SETTINGS;
    window.dispatchEvent(new Event(SYSTEM_SETTINGS_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function subscribeSystemSettings(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(SYSTEM_SETTINGS_SYNC_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(SYSTEM_SETTINGS_SYNC_EVENT, callback);
  };
}

export interface DatabaseCollectionDescriptor {
  key: string;
  label: string;
  description: string;
  category: "core" | "citizen" | "config";
}

export const DATABASE_COLLECTIONS: DatabaseCollectionDescriptor[] = [
  {
    key: STORAGE_KEY,
    label: "เรื่องร้องเรียนทั้งหมด (Complaints)",
    description: "ข้อมูลพิกัด ภาพถ่าย สถานะ และคอมเมนต์เคส",
    category: "core",
  },
  {
    key: POLLS_STORAGE_KEY,
    label: "โพลประชาพิจารณ์ (Civic Polls)",
    description: "หัวข้อโพลและผลโหวตของประชาชนในพื้นที่",
    category: "core",
  },
  {
    key: CITIZEN_ACCOUNTS_STORAGE_KEY,
    label: "บัญชีสมาชิกพลเมือง (Citizens)",
    description: "บัญชีที่ผู้ใช้ลงทะเบียนใช้งานจริง",
    category: "citizen",
  },
  {
    key: CUSTOM_OFFICERS_STORAGE_KEY,
    label: "บัญชีเจ้าหน้าที่เพิ่มเติม (Admin Created)",
    description: "รหัสเจ้าหน้าที่และผู้ใช้งานที่สร้างโดยผู้ดูแลระบบ (Admin)",
    category: "config",
  },
  {
    key: OFFICER_OVERRIDES_STORAGE_KEY,
    label: "ตารางควบคุมสิทธิ์ & รีเซ็ตรหัส (Access Overrides)",
    description: "ค่าสิทธิ์การใช้งาน การระงับบัญชี และรหัสผ่านใหม่ของบัญชีหลัก",
    category: "config",
  },
  {
    key: CUSTOM_DEPARTMENTS_STORAGE_KEY,
    label: "หน่วยงานสังกัดเพิ่มเติม (Departments)",
    description: "หน่วยงานที่ผู้ดูแลระบบ (Admin) สร้างเพิ่มเติม",
    category: "config",
  },
  {
    key: UPVOTES_STORAGE_KEY,
    label: "ประวัติการโหวต (+1 Upvotes)",
    description: "รายการ ID เคสที่ผู้ใช้งานกดสนับสนุน",
    category: "citizen",
  },
  {
    key: MY_REPORTS_STORAGE_KEY,
    label: "ประวัติการแจ้งเรื่อง (My Reports)",
    description: "รายการ ID เคสที่ผู้ใช้งานเป็นคนแจ้ง",
    category: "citizen",
  },
  {
    key: CHECKINS_STORAGE_KEY,
    label: "บันทึกเช็กอินรายวัน (Check-ins)",
    description: "วันที่เช็กอินภารกิจตรวจตราเมือง",
    category: "citizen",
  },
  {
    key: MY_COMMENTS_STORAGE_KEY,
    label: "ประวัติความคิดเห็น (Comments)",
    description: "รายการ ID คอมเมนต์ของผู้ใช้",
    category: "citizen",
  },
  {
    key: POLL_VOTES_STORAGE_KEY,
    label: "ประวัติโหวตโพล (Poll Votes)",
    description: "รายการโพลที่ผู้ใช้ลงคะแนนแล้ว",
    category: "citizen",
  },
  {
    key: SYSTEM_SETTINGS_STORAGE_KEY,
    label: "การตั้งค่าระบบ (System Settings)",
    description: "พารามิเตอร์ SLA แผนที่ และกติกา XP",
    category: "config",
  },
  {
    key: THEME_STORAGE_KEY,
    label: "ธีมหน้าจอ (Light / Dark)",
    description: "ค่าธีมที่ผู้ใช้เลือกไว้",
    category: "config",
  },
  {
    key: MAP_STYLE_STORAGE_KEY,
    label: "สไตล์แผนที่ (Map Basemap)",
    description: "รูปแบบแผนที่ตั้งต้นบนเบราว์เซอร์",
    category: "config",
  },
];

export interface CollectionInspectionRow extends DatabaseCollectionDescriptor {
  rawValue: string | null;
  byteSize: number;
  recordCount: number;
  hasCustomData: boolean;
}

function countJsonRecords(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed.length;
    if (parsed && typeof parsed === "object") return Object.keys(parsed).length;
    return 1;
  } catch {
    return 1;
  }
}

export function inspectDatabaseCollections(): CollectionInspectionRow[] {
  if (typeof window === "undefined") {
    return DATABASE_COLLECTIONS.map((col) => ({
      ...col,
      rawValue: null,
      byteSize: 0,
      recordCount: 0,
      hasCustomData: false,
    }));
  }

  return DATABASE_COLLECTIONS.map((col) => {
    let rawValue: string | null = null;
    try {
      rawValue = window.localStorage.getItem(col.key);
    } catch {
      rawValue = null;
    }
    const byteSize = rawValue ? rawValue.length * 2 : 0;
    const recordCount = countJsonRecords(rawValue);
    return {
      ...col,
      rawValue,
      byteSize,
      recordCount,
      hasCustomData: rawValue !== null,
    };
  });
}

export interface DatabaseBackupPayload {
  schemaVersion: number;
  exportedAt: string;
  platform: string;
  collections: Record<string, unknown>;
}

export function buildFullDatabaseBackup(): DatabaseBackupPayload {
  const collections: Record<string, unknown> = {};
  if (typeof window !== "undefined") {
    for (const col of DATABASE_COLLECTIONS) {
      try {
        const raw = window.localStorage.getItem(col.key);
        if (raw !== null) {
          try {
            collections[col.key] = JSON.parse(raw);
          } catch {
            collections[col.key] = raw;
          }
        }
      } catch {
        // skip unreadable entry
      }
    }
  }
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    platform: "CityPulse",
    collections,
  };
}

export function restoreFullDatabaseBackup(
  jsonText: string
): { ok: true; restoredKeys: string[] } | { ok: false; error: string } {
  if (typeof window === "undefined") {
    return { ok: false, error: "ไม่สามารถกู้คืนข้อมูลบนฝั่งเซิร์ฟเวอร์ได้" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: "รูปแบบไฟล์ JSON ไม่ถูกต้อง" };
  }

  if (
    !parsed ||
    typeof parsed !== "object" ||
    !("collections" in parsed) ||
    typeof (parsed as { collections: unknown }).collections !== "object" ||
    (parsed as { collections: unknown }).collections === null
  ) {
    return { ok: false, error: "โครงสร้างไฟล์สำรองข้อมูลไม่ถูกต้อง (ไม่พบ collections)" };
  }

  const allowedKeys = new Set(DATABASE_COLLECTIONS.map((c) => c.key));
  const collections = (parsed as DatabaseBackupPayload).collections;
  const restoredKeys: string[] = [];

  for (const [key, val] of Object.entries(collections)) {
    if (!allowedKeys.has(key)) continue;
    try {
      const serialized = typeof val === "string" ? val : JSON.stringify(val);
      window.localStorage.setItem(key, serialized);
      restoredKeys.push(key);
    } catch {
      return {
        ok: false,
        error: "พื้นที่จัดเก็บข้อมูลบนเบราว์เซอร์ไม่เพียงพอสำหรับการกู้คืนทั้งหมด",
      };
    }
  }

  window.dispatchEvent(new Event("citypulse-storage-sync"));
  window.dispatchEvent(new Event("citypulse-theme-sync"));
  window.dispatchEvent(new Event(SYSTEM_SETTINGS_SYNC_EVENT));
  return { ok: true, restoredKeys };
}
