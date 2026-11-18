import { inferProvinceFromCoord, CITIES, getProvinceName } from "@/data/map-data";

export interface CitizenMember {
  id: string;
  displayName: string;
  email: string;
  phone?: string;
  homeProvince: string;
  joinedAt: string;
  avatarPose: string;
  status?: "active" | "suspended";
}

interface StoredCitizenCredential extends CitizenMember {
  password: string;
}

export interface CitizenSession {
  member: CitizenMember;
  loggedInAt: string;
}

const CITIZEN_ACCOUNTS_KEY = "citypulse-citizen-accounts";
const CITIZEN_SESSION_KEY = "citypulse-citizen-session";
const CITIZEN_AUTH_SYNC_EVENT = "citypulse-citizen-auth-sync";

export const CITIZEN_AVATAR_POSES = [
  { id: "default", label: "อินสเปกเตอร์", src: "/images/mascot.png" },
  { id: "camera", label: "นักข่าวพลเมือง", src: "/images/mascot_camera.png" },
  { id: "search", label: "นักสืบพื้นที่", src: "/images/mascot_searching.png" },
  { id: "hero", label: "ฮีโร่เมือง", src: "/images/mascot_success.png" },
] as const;

let cachedSessionRaw: string | null = null;
let cachedSessionParsed: CitizenSession | null = null;
const EMPTY_CITIZENS: CitizenMember[] = [];
let cachedCitizensRaw: string | null | undefined = undefined;
let cachedCitizensParsed: CitizenMember[] = EMPTY_CITIZENS;

function notifyCitizenAuthSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CITIZEN_AUTH_SYNC_EVENT));
  }
}

function getAllCitizenAccounts(): StoredCitizenCredential[] {
  return loadRegisteredAccounts();
}

function loadRegisteredAccounts(): StoredCitizenCredential[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CITIZEN_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is StoredCitizenCredential =>
        Boolean(x && typeof x === "object" && "email" in x && "password" in x && "displayName" in x)
    );
  } catch {
    return [];
  }
}

function saveRegisteredAccounts(accounts: StoredCitizenCredential[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CITIZEN_ACCOUNTS_KEY, JSON.stringify(accounts));
    cachedCitizensRaw = undefined;
    notifyCitizenAuthSync();
    return true;
  } catch {
    return false;
  }
}

export function getServerCitizensSnapshot(): CitizenMember[] {
  return EMPTY_CITIZENS;
}

export function getRegisteredCitizensSnapshot(): CitizenMember[] {
  if (typeof window === "undefined") return EMPTY_CITIZENS;
  try {
    const raw = window.localStorage.getItem(CITIZEN_ACCOUNTS_KEY);
    if (raw === cachedCitizensRaw) return cachedCitizensParsed;
    cachedCitizensRaw = raw;
    if (!raw) {
      cachedCitizensParsed = EMPTY_CITIZENS;
      return cachedCitizensParsed;
    }
    cachedCitizensParsed = loadRegisteredAccounts().map(toPublicMember);
    return cachedCitizensParsed;
  } catch {
    cachedCitizensRaw = null;
    cachedCitizensParsed = EMPTY_CITIZENS;
    return cachedCitizensParsed;
  }
}

export function subscribeCitizenAccounts(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CITIZEN_ACCOUNTS_KEY) {
      cachedCitizensRaw = undefined;
      onStoreChange();
    }
  };
  const handleCustom = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CITIZEN_AUTH_SYNC_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CITIZEN_AUTH_SYNC_EVENT, handleCustom);
  };
}

function toPublicMember(cred: StoredCitizenCredential): CitizenMember {
  return {
    id: cred.id,
    displayName: cred.displayName,
    email: cred.email,
    phone: cred.phone,
    homeProvince: cred.homeProvince,
    joinedAt: cred.joinedAt,
    avatarPose: cred.avatarPose,
    status: cred.status,
  };
}

export function getCitizenSessionSnapshot(): CitizenSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CITIZEN_SESSION_KEY);
    if (raw === cachedSessionRaw) {
      return cachedSessionParsed;
    }
    cachedSessionRaw = raw;
    if (!raw) {
      cachedSessionParsed = null;
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      "member" in parsed &&
      parsed.member &&
      typeof parsed.member === "object" &&
      "id" in parsed.member
    ) {
      cachedSessionParsed = parsed as CitizenSession;
      return cachedSessionParsed;
    }
    cachedSessionParsed = null;
    return null;
  } catch {
    return null;
  }
}

export function subscribeCitizenSession(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handleStorage = (e: StorageEvent) => {
    if (e.key === null || e.key === CITIZEN_SESSION_KEY || e.key === CITIZEN_ACCOUNTS_KEY) {
      onStoreChange();
    }
  };
  const handleCustom = () => onStoreChange();
  window.addEventListener("storage", handleStorage);
  window.addEventListener(CITIZEN_AUTH_SYNC_EVENT, handleCustom);
  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(CITIZEN_AUTH_SYNC_EVENT, handleCustom);
  };
}

export function createCitizenSession(member: CitizenMember): CitizenSession {
  const session: CitizenSession = {
    member,
    loggedInAt: new Date().toISOString(),
  };
  if (typeof window !== "undefined") {
    try {
      const serialized = JSON.stringify(session);
      window.localStorage.setItem(CITIZEN_SESSION_KEY, serialized);
      cachedSessionRaw = serialized;
      cachedSessionParsed = session;
      notifyCitizenAuthSync();
    } catch {
      // ignore storage errors
    }
  }
  return session;
}

export function clearCitizenSession(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CITIZEN_SESSION_KEY);
    cachedSessionRaw = null;
    cachedSessionParsed = null;
    notifyCitizenAuthSync();
  } catch {
    // ignore storage errors
  }
}

export function authenticateCitizenMember(
  email: string,
  password: string
): CitizenMember | null {
  const normalized = email.trim().toLowerCase();
  const match = getAllCitizenAccounts().find(
    (acc) => acc.email.toLowerCase() === normalized && acc.password === password
  );
  if (!match || match.status === "suspended") return null;
  return toPublicMember(match);
}

export interface RegisterCitizenInput {
  displayName: string;
  email: string;
  password: string;
  phone?: string;
  homeProvince?: string;
  avatarPose?: string;
}

export type RegisterCitizenResult =
  | { ok: true; session: CitizenSession }
  | { ok: false; error: string };

function persistNewCitizenAccount(
  input: RegisterCitizenInput
): { ok: true; member: CitizenMember } | { ok: false; error: string } {
  const normalizedEmail = input.email.trim().toLowerCase();
  const trimmedName = input.displayName.trim();

  if (!trimmedName) {
    return { ok: false, error: "กรุณาระบุชื่อที่ต้องการแสดงในระบบ" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { ok: false, error: "รูปแบบอีเมลไม่ถูกต้อง" };
  }
  if (input.password.length < 6) {
    return { ok: false, error: "รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร" };
  }

  const all = getAllCitizenAccounts();
  if (all.some((acc) => acc.email.toLowerCase() === normalizedEmail)) {
    return { ok: false, error: "อีเมลนี้ถูกลงทะเบียนใช้งานแล้ว กรุณาเข้าสู่ระบบ" };
  }

  const validProvinces = new Set(CITIES.map(getProvinceName));
  const resolvedProvince =
    input.homeProvince && validProvinces.has(input.homeProvince)
      ? input.homeProvince
      : inferProvinceFromCoord([100.5018, 13.7563]);

  const now = new Date();
  const joinedAt = now.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const newCred: StoredCitizenCredential = {
    id: `cit-${Date.now()}`,
    email: normalizedEmail,
    password: input.password,
    displayName: trimmedName,
    phone: input.phone?.trim() || undefined,
    homeProvince: resolvedProvince,
    joinedAt,
    avatarPose: input.avatarPose || "/images/mascot.png",
    status: "active",
  };

  const registered = loadRegisteredAccounts();
  const ok = saveRegisteredAccounts([newCred, ...registered]);
  if (!ok) {
    return { ok: false, error: "ไม่สามารถบันทึกบัญชีพลเมืองลงฐานข้อมูลได้" };
  }

  return { ok: true, member: toPublicMember(newCred) };
}

export function createCitizenAccountByAdmin(
  input: RegisterCitizenInput
): { ok: true; member: CitizenMember } | { ok: false; error: string } {
  return persistNewCitizenAccount(input);
}

export function updateCitizenAccountByAdmin(
  citizenId: string,
  patch: { status?: "active" | "suspended"; password?: string }
): { ok: true; member: CitizenMember } | { ok: false; error: string } {
  const registered = loadRegisteredAccounts();
  const idx = registered.findIndex((acc) => acc.id === citizenId);
  if (idx === -1) {
    return { ok: false, error: "ไม่พบบัญชีสมาชิกพลเมืองที่ต้องการอัปเดต" };
  }
  if (patch.password !== undefined && patch.password.length < 6) {
    return { ok: false, error: "รหัสผ่านพลเมืองใหม่ต้องมีอย่างน้อย 6 ตัวอักษร" };
  }
  const current = registered[idx];
  const updated: StoredCitizenCredential = {
    ...current,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.password !== undefined ? { password: patch.password } : {}),
  };
  const nextList = [...registered];
  nextList[idx] = updated;
  if (!saveRegisteredAccounts(nextList)) {
    return { ok: false, error: "ไม่สามารถอัปเดตบัญชีพลเมืองลงฐานข้อมูลได้" };
  }
  return { ok: true, member: toPublicMember(updated) };
}

export function deleteCitizenAccountByAdmin(citizenId: string): boolean {
  const registered = loadRegisteredAccounts();
  const next = registered.filter((acc) => acc.id !== citizenId);
  if (next.length === registered.length) return false;
  return saveRegisteredAccounts(next);
}

export function registerCitizenMember(input: RegisterCitizenInput): RegisterCitizenResult {
  const res = persistNewCitizenAccount(input);
  if (!res.ok) return res;
  const session = createCitizenSession(res.member);
  return { ok: true, session };
}

