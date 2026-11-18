export interface OfficerPermissions {
  accessDispatch: boolean;
  manageCases: boolean;
  managePolls: boolean;
  manageSystem: boolean;
  manageUsers: boolean;
}

export type OfficerPermissionKey = keyof OfficerPermissions;

export const OFFICER_PERMISSION_ITEMS: {
  key: OfficerPermissionKey;
  label: string;
  description: string;
  icon: string;
}[] = [
  {
    key: "accessDispatch",
    label: "เข้าศูนย์ปฏิบัติการ (/admin)",
    description: "ดูแดชบอร์ดรายการเรื่องร้องเรียน แผนที่หน่วยงาน และสถิติพื้นที่",
    icon: "desktop",
  },
  {
    key: "manageCases",
    label: "รับเรื่องและอัปเดตสถานะเคส",
    description: "เปลี่ยนสถานะเคส มอบหมายหน่วยงาน บันทึกหมายเหตุ และลบเคส",
    icon: "clipboard-check",
  },
  {
    key: "managePolls",
    label: "จัดการโพลประชาพิจารณ์",
    description: "สร้าง แก้ไข และลบหัวข้อโหวตชุมชนในระบบ",
    icon: "square-poll-vertical",
  },
  {
    key: "manageSystem",
    label: "ตั้งค่าระบบและฐานข้อมูล (/admin/system)",
    description: "แก้ไขค่า SLA กติกา XP ดู LocalDB และสำรอง/กู้คืนฐานข้อมูล",
    icon: "database",
  },
  {
    key: "manageUsers",
    label: "ควบคุมสิทธิ์และบัญชีผู้ใช้งาน (Admin)",
    description: "สร้าง/ลบผู้ใช้งาน ปรับสิทธิ์การเข้าถึง ระงับบัญชี และรีเซ็ตรหัสผ่าน",
    icon: "user-shield",
  },
];

export const OFFICER_PERMISSION_PRESETS: {
  id: string;
  label: string;
  isAdmin: boolean;
  permissions: OfficerPermissions;
}[] = [
  {
    id: "admin",
    label: "ผู้ดูแลระบบ (Admin เต็มสิทธิ์)",
    isAdmin: true,
    permissions: {
      accessDispatch: true,
      manageCases: true,
      managePolls: true,
      manageSystem: true,
      manageUsers: true,
    },
  },
  {
    id: "supervisor",
    label: "หัวหน้าศูนย์ / จัดการเคส & โพล",
    isAdmin: false,
    permissions: {
      accessDispatch: true,
      manageCases: true,
      managePolls: true,
      manageSystem: true,
      manageUsers: false,
    },
  },
  {
    id: "operator",
    label: "เจ้าหน้าที่รับเรื่องภาคสนาม",
    isAdmin: false,
    permissions: {
      accessDispatch: true,
      manageCases: true,
      managePolls: false,
      manageSystem: false,
      manageUsers: false,
    },
  },
  {
    id: "viewer",
    label: "ผู้ติดตามข้อมูล (อ่านอย่างเดียว)",
    isAdmin: false,
    permissions: {
      accessDispatch: true,
      manageCases: false,
      managePolls: false,
      manageSystem: false,
      manageUsers: false,
    },
  },
];

export interface OfficerAccount {
  id: string;
  email: string;
  name: string;
  role: string;
  departmentId: string; // "all" or CityDepartment id
  badgeCode: string;
  avatarPose: string;
  isAdmin?: boolean;
  isCustom?: boolean;
  status?: "active" | "suspended";
  permissions?: OfficerPermissions;
  mustChangePassword?: boolean;
  passwordUpdatedAt?: string;
  createdAt?: string;
  createdBy?: string;
}

interface StoredOfficerCredential extends OfficerAccount {
  password: string;
}

interface OfficerOverrideRecord {
  password?: string;
  isAdmin?: boolean;
  status?: "active" | "suspended";
  permissions?: OfficerPermissions;
  role?: string;
  departmentId?: string;
  mustChangePassword?: boolean;
  passwordUpdatedAt?: string;
}

export interface OfficerSession {
  officer: OfficerAccount;
  loggedInAt: string;
  rememberMe: boolean;
}

export const CUSTOM_OFFICERS_STORAGE_KEY = "citypulse-custom-officers";
export const OFFICER_OVERRIDES_STORAGE_KEY = "citypulse-officer-overrides";
const OFFICER_SESSION_LOCAL_KEY = "citypulse-officer-session";
const OFFICER_SESSION_TEMP_KEY = "citypulse-officer-session-temp";
const OFFICER_AUTH_SYNC_EVENT = "citypulse-officer-auth-sync";
const OFFICER_ACCOUNTS_SYNC_EVENT = "citypulse-officer-accounts-sync";

export const OFFICER_AVATAR_POSES = [
  { id: "default", label: "ศูนย์บัญชาการ", src: "/images/mascot.png" },
  { id: "camera", label: "หน่วยภาคสนาม", src: "/images/mascot_camera.png" },
  { id: "search", label: "ทีมวิเคราะห์", src: "/images/mascot_searching.png" },
  { id: "hero", label: "หน่วยพิเศษ", src: "/images/mascot_success.png" },
] as const;

export const DEMO_OFFICER_CREDENTIALS: StoredOfficerCredential[] = [
  {
    id: "sys-admin-01",
    email: "admin@citypulse.go.th",
    password: "",
    name: "แอดมินดูแลระบบ & ฐานข้อมูล (DBA)",
    role: "ผู้ดูแลระบบหลังบ้าน & ฐานข้อมูล (Super Admin)",
    departmentId: "all",
    badgeCode: "SYS-DBA-01",
    avatarPose: "/images/mascot.png",
    isAdmin: true,
  },
];

let cachedSessionRaw: string | null = null;
let cachedSessionParsed: OfficerSession | null = null;

export function getOfficerSessionSnapshot(): OfficerSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw =
      window.sessionStorage.getItem(OFFICER_SESSION_TEMP_KEY) ??
      window.localStorage.getItem(OFFICER_SESSION_LOCAL_KEY);
    if (raw === cachedSessionRaw) return cachedSessionParsed;
    cachedSessionRaw = raw;
    if (!raw) {
      cachedSessionParsed = null;
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<OfficerSession>;
    if (parsed?.officer?.id && parsed?.officer?.email) {
      cachedSessionParsed = parsed as OfficerSession;
      return cachedSessionParsed;
    }
  } catch {
    // ignore malformed storage
  }
  cachedSessionParsed = null;
  return null;
}

export function subscribeOfficerSession(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(OFFICER_AUTH_SYNC_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(OFFICER_AUTH_SYNC_EVENT, callback);
  };
}

function toPublicOfficer(cred: StoredOfficerCredential): OfficerAccount {
  const { password: _unused, ...officer } = cred;
  void _unused;
  return officer;
}

const SERVER_PUBLIC_OFFICERS: OfficerAccount[] = DEMO_OFFICER_CREDENTIALS.map(toPublicOfficer);
let cachedCustomRaw: string | null | undefined = undefined;
let cachedCustomParsed: StoredOfficerCredential[] = [];
let cachedOverridesRaw: string | null | undefined = undefined;
let cachedOverridesParsed: Record<string, OfficerOverrideRecord> = {};
let cachedMergedKey: string | undefined = undefined;
let cachedMergedPublic: OfficerAccount[] = SERVER_PUBLIC_OFFICERS;

export function getDefaultOfficerPermissions(
  officer: Pick<OfficerAccount, "id" | "isAdmin" | "departmentId">
): OfficerPermissions {
  const fullAdmin = officer.id === "sys-admin-01" || officer.isAdmin === true;
  if (fullAdmin) {
    return {
      accessDispatch: true,
      manageCases: true,
      managePolls: true,
      manageSystem: true,
      manageUsers: true,
    };
  }
  return {
    accessDispatch: true,
    manageCases: true,
    managePolls: false,
    manageSystem: officer.departmentId === "all",
    manageUsers: false,
  };
}

export function getEffectiveOfficerPermissions(
  officer: OfficerAccount | null | undefined
): OfficerPermissions {
  if (!officer) {
    return {
      accessDispatch: false,
      manageCases: false,
      managePolls: false,
      manageSystem: false,
      manageUsers: false,
    };
  }
  const base = getDefaultOfficerPermissions(officer);
  const merged = officer.permissions ? { ...base, ...officer.permissions } : base;
  if (officer.id === "sys-admin-01") {
    return {
      accessDispatch: true,
      manageCases: true,
      managePolls: true,
      manageSystem: true,
      manageUsers: true,
    };
  }
  return merged;
}

export function hasOfficerPermission(
  officer: OfficerAccount | null | undefined,
  key: OfficerPermissionKey
): boolean {
  return getEffectiveOfficerPermissions(officer)[key];
}

function loadOfficerOverrides(): Record<string, OfficerOverrideRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OFFICER_OVERRIDES_STORAGE_KEY);
    if (raw === cachedOverridesRaw) return cachedOverridesParsed;
    cachedOverridesRaw = raw;
    if (!raw) {
      cachedOverridesParsed = {};
      return cachedOverridesParsed;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      cachedOverridesParsed = {};
      return cachedOverridesParsed;
    }
    cachedOverridesParsed = parsed as Record<string, OfficerOverrideRecord>;
    return cachedOverridesParsed;
  } catch {
    cachedOverridesRaw = null;
    cachedOverridesParsed = {};
    return cachedOverridesParsed;
  }
}

function saveOfficerOverrides(overrides: Record<string, OfficerOverrideRecord>): boolean {
  if (typeof window === "undefined") return false;
  try {
    const serialized = JSON.stringify(overrides);
    window.localStorage.setItem(OFFICER_OVERRIDES_STORAGE_KEY, serialized);
    cachedOverridesRaw = serialized;
    cachedOverridesParsed = overrides;
    cachedMergedKey = undefined;
    window.dispatchEvent(new Event(OFFICER_ACCOUNTS_SYNC_EVENT));
    return true;
  } catch {
    return false;
  }
}

function applyOverrideToDemoAccount(
  acc: StoredOfficerCredential,
  override?: OfficerOverrideRecord
): StoredOfficerCredential {
  if (!override) return acc;
  const isProtectedRoot = acc.id === "sys-admin-01";
  return {
    ...acc,
    ...(override.password !== undefined ? { password: override.password } : {}),
    ...(override.role !== undefined ? { role: override.role } : {}),
    ...(override.departmentId !== undefined ? { departmentId: override.departmentId } : {}),
    ...(override.permissions !== undefined ? { permissions: override.permissions } : {}),
    ...(override.mustChangePassword !== undefined
      ? { mustChangePassword: override.mustChangePassword }
      : {}),
    ...(override.passwordUpdatedAt !== undefined
      ? { passwordUpdatedAt: override.passwordUpdatedAt }
      : {}),
    ...(override.isAdmin !== undefined && !isProtectedRoot ? { isAdmin: override.isAdmin } : {}),
    ...(override.status !== undefined && !isProtectedRoot ? { status: override.status } : {}),
  };
}

function loadCustomOfficerCredentials(): StoredOfficerCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_OFFICERS_STORAGE_KEY);
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
    const builtInEmails = new Set(
      DEMO_OFFICER_CREDENTIALS.map((acc) => acc.email.toLowerCase())
    );
    cachedCustomParsed = parsed.filter(
      (item): item is StoredOfficerCredential =>
        Boolean(
          item &&
            typeof item === "object" &&
            "id" in item &&
            "email" in item &&
            "password" in item &&
            "name" in item &&
            typeof item.email === "string" &&
            typeof item.password === "string" &&
            !builtInEmails.has(item.email.toLowerCase())
        )
    );
    return cachedCustomParsed;
  } catch {
    cachedCustomRaw = null;
    cachedCustomParsed = [];
    return cachedCustomParsed;
  }
}

function saveCustomOfficerCredentials(accounts: StoredOfficerCredential[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    const serialized = JSON.stringify(accounts);
    window.localStorage.setItem(CUSTOM_OFFICERS_STORAGE_KEY, serialized);
    cachedCustomRaw = serialized;
    cachedCustomParsed = accounts;
    cachedMergedKey = undefined;
    window.dispatchEvent(new Event(OFFICER_ACCOUNTS_SYNC_EVENT));
    return true;
  } catch {
    return false;
  }
}

function getAllOfficerCredentials(): StoredOfficerCredential[] {
  const overrides = loadOfficerOverrides();
  const demos = DEMO_OFFICER_CREDENTIALS.map((acc) =>
    applyOverrideToDemoAccount(acc, overrides[acc.id])
  );
  const custom = loadCustomOfficerCredentials();
  return [...demos, ...custom];
}

export function getServerOfficersSnapshot(): OfficerAccount[] {
  return SERVER_PUBLIC_OFFICERS;
}

export function getAllOfficersSnapshot(): OfficerAccount[] {
  if (typeof window === "undefined") return SERVER_PUBLIC_OFFICERS;
  let customRaw: string | null = null;
  let overrideRaw: string | null = null;
  try {
    customRaw = window.localStorage.getItem(CUSTOM_OFFICERS_STORAGE_KEY);
    overrideRaw = window.localStorage.getItem(OFFICER_OVERRIDES_STORAGE_KEY);
  } catch {
    customRaw = null;
    overrideRaw = null;
  }
  const compositeKey = `${customRaw ?? ""}::${overrideRaw ?? ""}`;
  if (compositeKey === cachedMergedKey) return cachedMergedPublic;
  const merged = getAllOfficerCredentials().map(toPublicOfficer);
  cachedMergedKey = compositeKey;
  cachedMergedPublic = merged;
  return cachedMergedPublic;
}

export function subscribeOfficerAccounts(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (
      e.key === null ||
      e.key === CUSTOM_OFFICERS_STORAGE_KEY ||
      e.key === OFFICER_OVERRIDES_STORAGE_KEY
    ) {
      cachedCustomRaw = undefined;
      cachedOverridesRaw = undefined;
      cachedMergedKey = undefined;
      callback();
    }
  };
  const handleSync = () => callback();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(OFFICER_ACCOUNTS_SYNC_EVENT, handleSync);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(OFFICER_ACCOUNTS_SYNC_EVENT, handleSync);
  };
}

export function canManageAccounts(officer: OfficerAccount | null | undefined): boolean {
  if (!officer) return false;
  return hasOfficerPermission(officer, "manageUsers");
}

export interface CreateOfficerAccountInput {
  email: string;
  password: string;
  name: string;
  role: string;
  departmentId: string;
  badgeCode?: string;
  avatarPose?: string;
  isAdmin?: boolean;
  permissions?: OfficerPermissions;
  mustChangePassword?: boolean;
  createdBy?: string;
}

export function createCustomOfficerAccount(
  input: CreateOfficerAccountInput
): { ok: true; officer: OfficerAccount } | { ok: false; error: string } {
  const normalizedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.name.trim();
  const trimmedRole = input.role.trim();

  if (!trimmedName) {
    return { ok: false, error: "กรุณาระบุชื่อ-นามสกุลผู้ใช้งาน" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  }
  if (input.password.length < 4) {
    return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร" };
  }
  if (!trimmedRole) {
    return { ok: false, error: "กรุณาระบุตำแหน่งหรือหน้าที่" };
  }

  const existing = getAllOfficerCredentials();
  if (existing.some((acc) => acc.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: "อีเมลนี้มีบัญชีเจ้าหน้าที่อยู่ในระบบแล้ว" };
  }

  const now = Date.now();
  const normalizedBadge =
    input.badgeCode?.trim().toUpperCase() || `USR-${String(now).slice(-4)}`;
  const deptId = input.departmentId || "all";
  const resolvedPermissions =
    input.permissions ??
    getDefaultOfficerPermissions({
      id: `custom-off-${now}`,
      isAdmin: Boolean(input.isAdmin),
      departmentId: deptId,
    });

  const createdCred: StoredOfficerCredential = {
    id: `custom-off-${now}`,
    email: normalizedEmail,
    password: input.password,
    name: trimmedName,
    role: trimmedRole,
    departmentId: deptId,
    badgeCode: normalizedBadge,
    avatarPose: input.avatarPose || "/images/mascot.png",
    isAdmin: Boolean(input.isAdmin || resolvedPermissions.manageUsers),
    isCustom: true,
    status: "active",
    permissions: resolvedPermissions,
    mustChangePassword: Boolean(input.mustChangePassword),
    passwordUpdatedAt: new Date(now).toLocaleString("th-TH", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }),
    createdAt: new Date(now).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }),
    createdBy: input.createdBy,
  };

  const currentCustom = loadCustomOfficerCredentials();
  const ok = saveCustomOfficerCredentials([createdCred, ...currentCustom]);
  if (!ok) {
    return { ok: false, error: "ไม่สามารถบันทึกบัญชีลง Local Storage ได้" };
  }

  return { ok: true, officer: toPublicOfficer(createdCred) };
}

export interface UpdateOfficerAccountPatch {
  isAdmin?: boolean;
  status?: "active" | "suspended";
  password?: string;
  role?: string;
  departmentId?: string;
  permissions?: OfficerPermissions;
  mustChangePassword?: boolean;
}

export function updateCustomOfficerAccount(
  accountId: string,
  patch: UpdateOfficerAccountPatch
): { ok: true; officer: OfficerAccount } | { ok: false; error: string } {
  return updateOfficerAccount(accountId, patch);
}

export function updateOfficerAccount(
  accountId: string,
  patch: UpdateOfficerAccountPatch
): { ok: true; officer: OfficerAccount } | { ok: false; error: string } {
  if (patch.password !== undefined && patch.password.length < 4) {
    return { ok: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" };
  }

  const nowStamp = new Date().toLocaleString("th-TH", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

  // 1. Built-in demo officer? Persist clean overrides
  const demoTarget = DEMO_OFFICER_CREDENTIALS.find((acc) => acc.id === accountId);
  if (demoTarget) {
    const isProtectedRoot = demoTarget.id === "sys-admin-01";
    const overrides = loadOfficerOverrides();
    const prevOverride = overrides[accountId] ?? {};
    const mergedDemo = applyOverrideToDemoAccount(demoTarget, prevOverride);

    const nextPermissions = isProtectedRoot
      ? getDefaultOfficerPermissions(demoTarget)
      : patch.permissions ?? mergedDemo.permissions;

    const nextIsAdmin = isProtectedRoot
      ? true
      : patch.isAdmin !== undefined
      ? patch.isAdmin
      : patch.permissions !== undefined
      ? patch.permissions.manageUsers
      : mergedDemo.isAdmin;

    const nextOverride: OfficerOverrideRecord = {
      ...prevOverride,
      ...(patch.password !== undefined
        ? { password: patch.password, passwordUpdatedAt: nowStamp }
        : {}),
      ...(patch.mustChangePassword !== undefined
        ? { mustChangePassword: patch.mustChangePassword }
        : {}),
      ...(patch.role !== undefined ? { role: patch.role.trim() || mergedDemo.role } : {}),
      ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
      ...(!isProtectedRoot && nextIsAdmin !== undefined ? { isAdmin: nextIsAdmin } : {}),
      ...(!isProtectedRoot && patch.status !== undefined ? { status: patch.status } : {}),
      ...(!isProtectedRoot && nextPermissions !== undefined
        ? { permissions: nextPermissions }
        : {}),
    };

    const ok = saveOfficerOverrides({
      ...overrides,
      [accountId]: nextOverride,
    });
    if (!ok) {
      return { ok: false, error: "ไม่สามารถบันทึกการแก้ไขสิทธิ์ลงฐานข้อมูลได้" };
    }
    return {
      ok: true,
      officer: toPublicOfficer(applyOverrideToDemoAccount(demoTarget, nextOverride)),
    };
  }

  // 2. Custom officer created by Admin
  const current = loadCustomOfficerCredentials();
  const idx = current.findIndex((acc) => acc.id === accountId);
  if (idx === -1) {
    return { ok: false, error: "ไม่พบบัญชีเจ้าหน้าที่ที่ต้องการแก้ไข" };
  }
  const target = current[idx];
  const nextPermissions = patch.permissions ?? target.permissions;
  const nextIsAdmin =
    patch.isAdmin !== undefined
      ? patch.isAdmin
      : patch.permissions !== undefined
      ? patch.permissions.manageUsers
      : target.isAdmin;

  const updated: StoredOfficerCredential = {
    ...target,
    ...(nextIsAdmin !== undefined ? { isAdmin: nextIsAdmin } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.password !== undefined
      ? { password: patch.password, passwordUpdatedAt: nowStamp }
      : {}),
    ...(patch.mustChangePassword !== undefined
      ? { mustChangePassword: patch.mustChangePassword }
      : {}),
    ...(patch.role !== undefined ? { role: patch.role.trim() || target.role } : {}),
    ...(patch.departmentId !== undefined ? { departmentId: patch.departmentId } : {}),
    ...(nextPermissions !== undefined ? { permissions: nextPermissions } : {}),
  };
  const nextList = [...current];
  nextList[idx] = updated;
  if (!saveCustomOfficerCredentials(nextList)) {
    return { ok: false, error: "ไม่สามารถอัปเดตข้อมูลบัญชีลงฐานข้อมูลได้" };
  }
  return { ok: true, officer: toPublicOfficer(updated) };
}

export function selfResetOfficerPassword(
  emailInput: string,
  badgeCodeInput: string,
  newPassword: string
): { ok: true; officer: OfficerAccount } | { ok: false; error: string } {
  const normalizedEmail = emailInput.trim().toLowerCase();
  const normalizedBadge = badgeCodeInput.trim().toUpperCase();

  if (!normalizedEmail || !normalizedBadge) {
    return { ok: false, error: "กรุณากรอกอีเมลราชการและรหัสประจำตัว (Badge Code)" };
  }
  if (newPassword.length < 4) {
    return { ok: false, error: "รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร" };
  }

  const matched = getAllOfficerCredentials().find(
    (acc) => acc.email.toLowerCase() === normalizedEmail
  );
  if (!matched) {
    return { ok: false, error: "ไม่พบอีเมลเจ้าหน้าที่นี้ในระบบ" };
  }
  if (matched.status === "suspended") {
    return { ok: false, error: "บัญชีนี้ถูกระงับการใช้งานชั่วคราว กรุณาติดต่อ Admin" };
  }
  if (matched.badgeCode.trim().toUpperCase() !== normalizedBadge) {
    return {
      ok: false,
      error: "รหัสประจำตัว (Badge Code) ไม่ตรงกับบัญชีนี้ กรุณาตรวจสอบอีกครั้ง",
    };
  }

  return updateOfficerAccount(matched.id, {
    password: newPassword,
    mustChangePassword: false,
  });
}

export function deleteCustomOfficerAccount(accountId: string): boolean {
  const current = loadCustomOfficerCredentials();
  const next = current.filter((acc) => acc.id !== accountId);
  if (next.length === current.length) return false;
  return saveCustomOfficerCredentials(next);
}

export function createOfficerSession(officer: OfficerAccount, rememberMe: boolean): OfficerSession {
  const session: OfficerSession = {
    officer,
    loggedInAt: new Date().toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    rememberMe,
  };
  try {
    const serialized = JSON.stringify(session);
    cachedSessionRaw = serialized;
    cachedSessionParsed = session;
    if (rememberMe) {
      window.localStorage.setItem(OFFICER_SESSION_LOCAL_KEY, serialized);
      window.sessionStorage.removeItem(OFFICER_SESSION_TEMP_KEY);
    } else {
      window.sessionStorage.setItem(OFFICER_SESSION_TEMP_KEY, serialized);
      window.localStorage.removeItem(OFFICER_SESSION_LOCAL_KEY);
    }
    window.dispatchEvent(new Event(OFFICER_AUTH_SYNC_EVENT));
  } catch {
    // ignore storage errors
  }
  return session;
}

export function clearOfficerSession() {
  void fetch("/api/admin/session", { method: "DELETE", keepalive: true }).catch(() => {});
  try {
    window.localStorage.removeItem(OFFICER_SESSION_LOCAL_KEY);
    window.sessionStorage.removeItem(OFFICER_SESSION_TEMP_KEY);
    cachedSessionRaw = null;
    cachedSessionParsed = null;
    window.dispatchEvent(new Event(OFFICER_AUTH_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getSafeAdminRedirectPath(rawNext: string | null): string {
  if (!rawNext) return "/admin";
  if (rawNext.startsWith("/admin") && !rawNext.startsWith("//")) {
    return rawNext;
  }
  return "/admin";
}

