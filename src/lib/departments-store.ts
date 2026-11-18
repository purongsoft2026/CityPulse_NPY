import { CITY_DEPARTMENTS, type CityDepartment } from "@/data/map-data";

export const CUSTOM_DEPARTMENTS_STORAGE_KEY = "citypulse-custom-departments";
const DEPARTMENTS_SYNC_EVENT = "citypulse-departments-sync";

export const DEPARTMENT_COLOR_PRESETS = [
  "#6366f1", // Indigo
  "#06b6d4", // Cyan
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#8b5cf6", // Violet
] as const;

let cachedCustomRaw: string | null | undefined = undefined;
let cachedCustomParsed: CityDepartment[] = [];
let cachedMergedRaw: string | null | undefined = undefined;
let cachedMergedAll: CityDepartment[] = CITY_DEPARTMENTS;

function loadCustomDepartments(): CityDepartment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_DEPARTMENTS_STORAGE_KEY);
    if (raw === cachedCustomRaw) return cachedCustomParsed;
    cachedCustomRaw = raw;
    if (!raw) {
      cachedCustomParsed = [];
      return cachedCustomParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      cachedCustomParsed = [];
      return cachedCustomParsed;
    }
    const builtInIds = new Set(CITY_DEPARTMENTS.map((d) => d.id));
    cachedCustomParsed = parsed.filter(
      (item): item is CityDepartment =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "name" in item &&
            "code" in item &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.code === "string" &&
            !builtInIds.has(item.id)
        )
    );
    return cachedCustomParsed;
  } catch {
    cachedCustomRaw = null;
    cachedCustomParsed = [];
    return cachedCustomParsed;
  }
}

function saveCustomDepartments(list: CityDepartment[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const serialized = JSON.stringify(list);
    window.localStorage.setItem(CUSTOM_DEPARTMENTS_STORAGE_KEY, serialized);
    cachedCustomRaw = serialized;
    cachedCustomParsed = list;
    cachedMergedRaw = undefined;
    window.dispatchEvent(new Event(DEPARTMENTS_SYNC_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function getServerDepartmentsSnapshot(): CityDepartment[] {
  return CITY_DEPARTMENTS;
}

export function getAllDepartmentsSnapshot(): CityDepartment[] {
  if (typeof window === "undefined") return CITY_DEPARTMENTS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(CUSTOM_DEPARTMENTS_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedMergedRaw) return cachedMergedAll;
  const custom = loadCustomDepartments();
  cachedMergedRaw = raw;
  cachedMergedAll = custom.length === 0 ? CITY_DEPARTMENTS : [...CITY_DEPARTMENTS, ...custom];
  return cachedMergedAll;
}

export function subscribeDepartments(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CUSTOM_DEPARTMENTS_STORAGE_KEY) {
      cachedCustomRaw = undefined;
      cachedMergedRaw = undefined;
      callback();
    }
  };
  const handleSync = () => callback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(DEPARTMENTS_SYNC_EVENT, handleSync);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(DEPARTMENTS_SYNC_EVENT, handleSync);
  };
}

export interface CreateDepartmentInput {
  name: string;
  code: string;
  headOfficer?: string;
  contactPhone?: string;
  email?: string;
  slaHours?: number;
  color?: string;
}

export function createCustomDepartment(
  input: CreateDepartmentInput
): { ok: true; department: CityDepartment } | { ok: false; error: string } {
  const trimmedName = input.name.trim();
  const normalizedCode = input.code.trim().toUpperCase();

  if (!trimmedName) {
    return { ok: false, error: "กรุณาระบุชื่อหน่วยงานสังกัด" };
  }
  if (!normalizedCode) {
    return { ok: false, error: "กรุณาระบุรหัสหน่วยงาน เช่น DEPT-DIGI" };
  }

  const all = getAllDepartmentsSnapshot();
  if (all.some((d) => d.code.toUpperCase() === normalizedCode)) {
    return { ok: false, error: `รหัสหน่วยงาน ${normalizedCode} มีอยู่ในระบบแล้ว` };
  }
  if (all.some((d) => d.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
    return { ok: false, error: "ชื่อหน่วยงานนี้มีอยู่ในระบบแล้ว" };
  }

  const now = Date.now();
  const slug = normalizedCode.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const created: CityDepartment = {
    id: `dept-${slug}-${String(now).slice(-4)}`,
    name: trimmedName,
    code: normalizedCode,
    categoryIds: [],
    responsibleDistricts: ["ทุกจังหวัด (77 จังหวัด)"],
    headOfficer: input.headOfficer?.trim() || "ผู้ดูแลหน่วยงาน (Admin กำหนด)",
    contactPhone: input.contactPhone?.trim() || "1567",
    email:
      input.email?.trim() ||
      `${slug.replace(/^dept-/, "") || "agency"}@citypulse.go.th`,
    activeStaffCount: 1,
    slaHours: Math.max(1, Math.min(720, Math.round(input.slaHours || 48))),
    color: input.color || DEPARTMENT_COLOR_PRESETS[0],
    icon: "building",
  };

  const currentCustom = loadCustomDepartments();
  const ok = saveCustomDepartments([...currentCustom, created]);
  if (!ok) {
    return { ok: false, error: "ไม่สามารถบันทึกหน่วยงานใหม่ลง Local Storage ได้" };
  }
  return { ok: true, department: created };
}

export function deleteCustomDepartment(deptId: string): boolean {
  const current = loadCustomDepartments();
  const next = current.filter((d) => d.id !== deptId);
  if (next.length === current.length) return false;
  return saveCustomDepartments(next);
}

export function isBuiltInDepartment(deptId: string): boolean {
  return CITY_DEPARTMENTS.some((d) => d.id === deptId);
}

