"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  CITIES,
  INITIAL_CIVIC_POLLS,
  INITIAL_COMPLAINTS,
  getProvinceName,
  type CivicPoll,
} from "@/data/map-data";
import { getDistrictsForProvince } from "@/data/thailand-districts";
import {
  ensureSubdistrictsLoaded,
  getServerSubdistrictsSnapshot,
  getSubdistrictsLoadingSnapshot,
  getSubdistrictsSnapshot,
  subscribeSubdistricts,
} from "@/lib/thailand-subdistricts";
import {
  DEPARTMENT_COLOR_PRESETS,
  createCustomDepartment,
  deleteCustomDepartment,
  getAllDepartmentsSnapshot,
  getServerDepartmentsSnapshot,
  isBuiltInDepartment,
  subscribeDepartments,
} from "@/lib/departments-store";
import {
  CHECKINS_STORAGE_KEY,
  MY_COMMENTS_STORAGE_KEY,
  MY_REPORTS_STORAGE_KEY,
  POLLS_STORAGE_KEY,
  POLL_VOTES_STORAGE_KEY,
  STORAGE_KEY,
  UPVOTES_STORAGE_KEY,
  getCivicPollsSnapshot,
  getComplaintsSnapshot,
  getIsDarkSnapshot,
  getMapStyleSnapshot,
  resetComplaintsStore,
  subscribeStorageSync,
  subscribeThemeSync,
  toggleThemeStore,
  writeCivicPollsStore,
} from "@/lib/civic-store";
import {
  OFFICER_AVATAR_POSES,
  OFFICER_PERMISSION_ITEMS,
  OFFICER_PERMISSION_PRESETS,
  type OfficerPermissions,
  canManageAccounts,
  clearOfficerSession,
  createCustomOfficerAccount,
  deleteCustomOfficerAccount,
  getAllOfficersSnapshot,
  getEffectiveOfficerPermissions,
  getOfficerSessionSnapshot,
  getServerOfficersSnapshot,
  hasOfficerPermission,
  subscribeOfficerAccounts,
  subscribeOfficerSession,
  updateOfficerAccount,
} from "@/lib/officer-auth";
import {
  CITIZEN_AVATAR_POSES,
  createCitizenAccountByAdmin,
  deleteCitizenAccountByAdmin,
  getRegisteredCitizensSnapshot,
  getServerCitizensSnapshot,
  subscribeCitizenAccounts,
  updateCitizenAccountByAdmin,
} from "@/lib/citizen-auth";
import {
  CITIZEN_ACCOUNTS_STORAGE_KEY,
  DEFAULT_SYSTEM_SETTINGS,
  GISTDA_FLOOD_PERIOD_OPTIONS,
  SYSTEM_SETTINGS_STORAGE_KEY,
  buildFullDatabaseBackup,
  getSystemSettingsSnapshot,
  inspectDatabaseCollections,
  resetSystemSettings,
  restoreFullDatabaseBackup,
  subscribeSystemSettings,
  writeSystemSettings,
  type GistdaFloodPeriod,
  type SystemSettings,
} from "@/lib/system-settings";
import { type MapStyleKey } from "@/components/map/MapHeader";
import CloudDatabaseGuidePanel, {
  type CloudProviderId,
} from "@/components/admin/CloudDatabaseGuidePanel";

type SystemTabKey = "settings" | "database" | "cloud" | "polls" | "diagnostics";

const VALID_SYSTEM_TABS = new Set<SystemTabKey>([
  "settings",
  "database",
  "cloud",
  "polls",
  "diagnostics",
]);
const VALID_CLOUD_PROVIDERS = new Set<CloudProviderId>([
  "supabase",
  "sheets",
  "firebase",
  "drive",
]);
const SYSTEM_HASH_EVENT = "citypulse-system-hash";

function subscribeHash(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("hashchange", callback);
  window.addEventListener("popstate", callback);
  window.addEventListener(SYSTEM_HASH_EVENT, callback);
  return () => {
    window.removeEventListener("hashchange", callback);
    window.removeEventListener("popstate", callback);
    window.removeEventListener(SYSTEM_HASH_EVENT, callback);
  };
}

function getHashSnapshot() {
  return typeof window === "undefined" ? "" : window.location.hash;
}

const serverEmptyHash = () => "";

function parseSystemHash(rawHash: string): {
  tab: SystemTabKey;
  cloudProvider: CloudProviderId;
} {
  const cleaned = rawHash.replace(/^#/, "").trim();
  const [tabPart = "", subPart = ""] = cleaned.split("/");
  const tab = VALID_SYSTEM_TABS.has(tabPart as SystemTabKey)
    ? (tabPart as SystemTabKey)
    : "settings";
  const cloudProvider = VALID_CLOUD_PROVIDERS.has(subPart as CloudProviderId)
    ? (subPart as CloudProviderId)
    : "supabase";
  return { tab, cloudProvider };
}

interface DiagnosticResult {
  id: string;
  label: string;
  endpoint: string;
  status: "ok" | "warn" | "error";
  httpCode?: number;
  latencyMs?: number;
  detail: string;
}

const emptySubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;
const serverNull = () => null;
const serverVoyager = (): MapStyleKey => "voyager";
const serverComplaints = () => INITIAL_COMPLAINTS;
const serverPolls = () => INITIAL_CIVIC_POLLS;
const serverSettings = () => DEFAULT_SYSTEM_SETTINGS;

const POLL_CATEGORY_OPTIONS: { id: CivicPoll["category"]; label: string }[] = [
  { id: "safety", label: "ความปลอดภัย" },
  { id: "traffic", label: "จราจร/ขนส่ง" },
  { id: "environment", label: "สิ่งแวดล้อม" },
  { id: "pedestrian", label: "ทางเท้า/แสงสว่าง" },
];

export default function AdminSystemPage() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);
  const isDark = useSyncExternalStore(subscribeThemeSync, getIsDarkSnapshot, serverFalse);
  const currentStyle = useSyncExternalStore(
    subscribeThemeSync,
    getMapStyleSnapshot,
    serverVoyager
  );
  const session = useSyncExternalStore(
    subscribeOfficerSession,
    getOfficerSessionSnapshot,
    serverNull
  );
  const savedSettings = useSyncExternalStore(
    subscribeSystemSettings,
    getSystemSettingsSnapshot,
    serverSettings
  );
  const complaints = useSyncExternalStore(
    subscribeStorageSync,
    getComplaintsSnapshot,
    serverComplaints
  );
  const civicPolls = useSyncExternalStore(
    subscribeStorageSync,
    getCivicPollsSnapshot,
    serverPolls
  );
  const allOfficers = useSyncExternalStore(
    subscribeOfficerAccounts,
    getAllOfficersSnapshot,
    getServerOfficersSnapshot
  );
  const registeredCitizens = useSyncExternalStore(
    subscribeCitizenAccounts,
    getRegisteredCitizensSnapshot,
    getServerCitizensSnapshot
  );
  const departments = useSyncExternalStore(
    subscribeDepartments,
    getAllDepartmentsSnapshot,
    getServerDepartmentsSnapshot
  );
  const subdistrictsByDistrict = useSyncExternalStore(
    subscribeSubdistricts,
    getSubdistrictsSnapshot,
    getServerSubdistrictsSnapshot
  );
  const isLoadingSubdistricts = useSyncExternalStore(
    subscribeSubdistricts,
    getSubdistrictsLoadingSnapshot,
    serverFalse
  );

  useEffect(() => {
    if (!isHydrated || session) return;
    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search + window.location.hash
        : "/admin/system";
    router.replace(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }, [isHydrated, session, router]);

  const rawHash = useSyncExternalStore(subscribeHash, getHashSnapshot, serverEmptyHash);
  const { tab: activeTab, cloudProvider } = useMemo(
    () => parseSystemHash(rawHash),
    [rawHash]
  );

  useEffect(() => {
    if (activeTab === "polls") {
      ensureSubdistrictsLoaded();
    }
  }, [activeTab]);

  const navigateSystemHash = useCallback((nextHash: string) => {
    if (typeof window === "undefined") return;
    const normalized = nextHash.startsWith("#") ? nextHash : `#${nextHash}`;
    if (window.location.hash !== normalized) {
      window.history.pushState(null, "", normalized);
      window.dispatchEvent(new Event(SYSTEM_HASH_EVENT));
    }
  }, []);

  const handleSelectTab = useCallback(
    (tabId: SystemTabKey) => {
      if (tabId === "cloud") {
        navigateSystemHash(`#cloud/${cloudProvider}`);
      } else {
        navigateSystemHash(`#${tabId}`);
      }
    },
    [cloudProvider, navigateSystemHash]
  );
  const [draftSettings, setDraftSettings] = useState<SystemSettings | null>(null);
  const [selectedCollectionKey, setSelectedCollectionKey] = useState<string>(STORAGE_KEY);
  const [collectionSearch, setCollectionSearch] = useState<string>("");
  const [refreshTick, setRefreshTick] = useState<number>(0);

  const [toast, setToast] = useState<{ title: string; detail?: string; tone?: "ok" | "warn" } | null>(
    null
  );
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Polls CRUD form state
  const [newPollTitle, setNewPollTitle] = useState("");
  const [newPollDesc, setNewPollDesc] = useState("");
  const [newPollProvinceId, setNewPollProvinceId] = useState(CITIES[0]?.id ?? "bangkok");
  const [newPollDistrictPcode, setNewPollDistrictPcode] = useState("all");
  const [newPollSubdistrictPcode, setNewPollSubdistrictPcode] = useState("all");
  const [newPollCategory, setNewPollCategory] = useState<CivicPoll["category"]>("safety");

  const selectedPollCity = useMemo(
    () => CITIES.find((c) => c.id === newPollProvinceId) ?? CITIES[0],
    [newPollProvinceId]
  );
  const selectedPollProvinceName = selectedPollCity
    ? getProvinceName(selectedPollCity)
    : "กรุงเทพมหานคร";

  const pollDistrictOptions = useMemo(
    () => getDistrictsForProvince(selectedPollProvinceName),
    [selectedPollProvinceName]
  );

  const selectedPollDistrict = useMemo(
    () =>
      newPollDistrictPcode === "all"
        ? null
        : pollDistrictOptions.find((d) => d.pcode === newPollDistrictPcode) ?? null,
    [newPollDistrictPcode, pollDistrictOptions]
  );

  const pollSubdistrictOptions = useMemo(() => {
    if (!selectedPollDistrict) return [];
    return subdistrictsByDistrict[selectedPollDistrict.pcode] ?? [];
  }, [selectedPollDistrict, subdistrictsByDistrict]);

  const selectedPollSubdistrict = useMemo(
    () =>
      newPollSubdistrictPcode === "all"
        ? null
        : pollSubdistrictOptions.find((sd) => sd.pcode === newPollSubdistrictPcode) ?? null,
    [newPollSubdistrictPcode, pollSubdistrictOptions]
  );

  const resolvedPollLocationName = useMemo(() => {
    const provText =
      selectedPollProvinceName === "กรุงเทพมหานคร"
        ? "กรุงเทพมหานคร"
        : `จ.${selectedPollProvinceName}`;
    if (selectedPollSubdistrict && selectedPollDistrict) {
      return `${selectedPollSubdistrict.displayTh} ${selectedPollDistrict.displayTh} ${provText}`;
    }
    if (selectedPollDistrict) {
      return `${selectedPollDistrict.displayTh} ${provText}`;
    }
    return selectedPollProvinceName;
  }, [selectedPollProvinceName, selectedPollDistrict, selectedPollSubdistrict]);

  const resolvedPollCoordinates: [number, number] = useMemo(
    () =>
      selectedPollSubdistrict?.center ??
      selectedPollDistrict?.center ??
      selectedPollCity?.center ?? [100.5018, 13.7563],
    [selectedPollSubdistrict, selectedPollDistrict, selectedPollCity]
  );

  // Diagnostics state
  const [diagResults, setDiagResults] = useState<DiagnosticResult[]>([]);
  const [isProbing, setIsProbing] = useState(false);

  // Admin User Provisioning state
  const [accountType, setAccountType] = useState<"officer" | "citizen">("officer");
  const [userEmail, setUserEmail] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [showUserPassword, setShowUserPassword] = useState(false);
  const [userName, setUserName] = useState("");
  const [officerRole, setOfficerRole] = useState("เจ้าหน้าที่ปฏิบัติการพื้นที่");
  const [officerDepartmentId, setOfficerDepartmentId] = useState<string>("all");
  const [officerBadgeCode, setOfficerBadgeCode] = useState("");
  const [officerIsAdmin, setOfficerIsAdmin] = useState(false);
  const [citizenPhone, setCitizenPhone] = useState("");
  const [citizenProvince, setCitizenProvince] = useState<string>(() =>
    CITIES[0] ? getProvinceName(CITIES[0]) : "กรุงเทพมหานคร"
  );
  const [userAvatarPose, setUserAvatarPose] = useState<string>("/images/mascot.png");
  const [userFormError, setUserFormError] = useState<string | null>(null);
  const [lastCreatedUser, setLastCreatedUser] = useState<{
    type: "officer" | "citizen";
    name: string;
    email: string;
    password: string;
    isAdmin?: boolean;
  } | null>(null);

  // Users Management Table & Reset Modal state
  const [userTableSearch, setUserTableSearch] = useState("");
  const [userTableFilter, setUserTableFilter] = useState<
    "all" | "officer" | "citizen" | "admin" | "suspended"
  >("all");
  const [resetTarget, setResetTarget] = useState<{
    kind: "officer" | "citizen";
    id: string;
    name: string;
    email: string;
  } | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(true);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetMustChangePassword, setResetMustChangePassword] = useState(false);

  // Access Permissions Control Modal state
  const [permTarget, setPermTarget] = useState<{
    id: string;
    name: string;
    email: string;
    isProtectedRoot: boolean;
  } | null>(null);
  const [draftPerms, setDraftPerms] = useState<OfficerPermissions | null>(null);
  const [draftPermRole, setDraftPermRole] = useState("");
  const [draftPermDept, setDraftPermDept] = useState("all");

  // Custom Department Modal state
  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptTargetSelect, setDeptTargetSelect] = useState<"provisioning" | "permissions">(
    "provisioning"
  );
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptHeadOfficer, setDeptHeadOfficer] = useState("");
  const [deptPhone, setDeptPhone] = useState("");
  const [deptEmail, setDeptEmail] = useState("");
  const [deptSlaHours, setDeptSlaHours] = useState("24");
  const [deptColor, setDeptColor] = useState<string>(DEPARTMENT_COLOR_PRESETS[0]);
  const [deptFormError, setDeptFormError] = useState<string | null>(null);

  const restoreInputRef = useRef<HTMLInputElement | null>(null);

  const formSettings = draftSettings ?? savedSettings;

  const showToast = useCallback(
    (title: string, detail?: string, tone: "ok" | "warn" = "ok") => {
      setToast({ title, detail, tone });
      window.setTimeout(() => {
        setToast((prev) => (prev?.title === title ? null : prev));
      }, 4500);
    },
    []
  );

  // Database collection snapshot derived cleanly on client
  const collections = useMemo(() => {
    void refreshTick;
    void complaints.length;
    void civicPolls.length;
    void savedSettings;
    void allOfficers.length;
    void registeredCitizens.length;
    void departments.length;
    if (!isHydrated) return [];
    return inspectDatabaseCollections();
  }, [
    isHydrated,
    refreshTick,
    complaints.length,
    civicPolls.length,
    savedSettings,
    allOfficers.length,
    registeredCitizens.length,
    departments.length,
  ]);

  const totalStorageBytes = useMemo(
    () => collections.reduce((acc, col) => acc + col.byteSize, 0),
    [collections]
  );
  const storageLimitBytes = 5 * 1024 * 1024;
  const storagePct = Math.min(
    100,
    Math.max(1, Math.round((totalStorageBytes / storageLimitBytes) * 1000) / 10)
  );

  const activeCollection = useMemo(
    () => collections.find((c) => c.key === selectedCollectionKey) ?? collections[0] ?? null,
    [collections, selectedCollectionKey]
  );

  const parsedActiveItems = useMemo(() => {
    if (!activeCollection?.rawValue) return null;
    try {
      const parsed: unknown = JSON.parse(activeCollection.rawValue);
      return parsed;
    } catch {
      return activeCollection.rawValue;
    }
  }, [activeCollection]);

  const formattedCollectionJson = useMemo(() => {
    if (!activeCollection?.rawValue) return "(ยังไม่มีข้อมูลที่ถูกเขียนลง Storage คีย์นี้ — ใช้ค่าเริ่มต้นของระบบ)";
    try {
      const parsed = JSON.parse(activeCollection.rawValue);
      const pretty = JSON.stringify(parsed, null, 2);
      const q = collectionSearch.trim().toLowerCase();
      if (!q) return pretty;
      return pretty
        .split("\n")
        .filter((line) => line.toLowerCase().includes(q))
        .join("\n");
    } catch {
      return activeCollection.rawValue;
    }
  }, [activeCollection, collectionSearch]);

  const citizenAccountCount = useMemo(() => {
    const col = collections.find((c) => c.key === CITIZEN_ACCOUNTS_STORAGE_KEY);
    return col?.recordCount ?? 0;
  }, [collections]);

  const handleUpdateDraft = (updater: (prev: SystemSettings) => SystemSettings) => {
    setDraftSettings((prev) => updater(prev ?? savedSettings));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = writeSystemSettings(formSettings);
    if (ok) {
      setDraftSettings(null);
      setRefreshTick((t) => t + 1);
      showToast("บันทึกการตั้งค่าระบบแล้ว", "พารามิเตอร์ทั้งหมดถูกจัดเก็บลงฐานข้อมูลสำเร็จ");
    } else {
      showToast("บันทึกไม่สำเร็จ", "พื้นที่จัดเก็บข้อมูลบนเบราว์เซอร์อาจเต็ม", "warn");
    }
  };

  const handleResetSettings = () => {
    setConfirmAction({
      title: "คืนค่าการตั้งค่าระบบเริ่มต้น?",
      message: "ค่าพารามิเตอร์ SLA แผนที่ตั้งต้น และกติกา XP จะถูกคืนเป็นค่ามาตรฐานของระบบ",
      onConfirm: () => {
        resetSystemSettings();
        setDraftSettings(null);
        setRefreshTick((t) => t + 1);
        setConfirmAction(null);
        showToast("คืนค่าการตั้งค่าเริ่มต้นแล้ว");
      },
    });
  };

  const handleExportFullBackup = () => {
    const payload = buildFullDatabaseBackup();
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `citypulse-db-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast(
      "สำรองฐานข้อมูล (JSON) สำเร็จ",
      `ส่งออกทั้งหมด ${Object.keys(payload.collections).length} ตารางข้อมูล`
    );
  };

  const handleImportBackupFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === "string" ? reader.result : "";
      const res = restoreFullDatabaseBackup(content);
      if (!res.ok) {
        showToast("กู้คืนข้อมูลล้มเหลว", res.error, "warn");
        return;
      }
      setDraftSettings(null);
      setRefreshTick((t) => t + 1);
      showToast(
        "กู้คืนฐานข้อมูลสำเร็จ!",
        `อัปเดต ${res.restoredKeys.length} ตารางข้อมูลเรียบร้อย`
      );
    };
    reader.readAsText(file);
  };

  const handleCopyCollectionJson = async () => {
    try {
      await navigator.clipboard.writeText(formattedCollectionJson);
      showToast("คัดลอกข้อมูล JSON แล้ว", activeCollection?.key);
    } catch {
      showToast("ไม่สามารถคัดลอกอัตโนมัติได้", "เบราว์เซอร์บล็อกสิทธิ์ Clipboard", "warn");
    }
  };

  const handleDeleteCollectionKey = (key: string, label: string) => {
    setConfirmAction({
      title: `ล้างข้อมูล "${label}"?`,
      message: `คีย์ "${key}" จะถูกลบออกจาก localStorage ของเบราว์เซอร์นี้`,
      onConfirm: () => {
        if (key === STORAGE_KEY) {
          resetComplaintsStore();
        } else if (key === SYSTEM_SETTINGS_STORAGE_KEY) {
          resetSystemSettings();
          setDraftSettings(null);
        } else {
          window.localStorage.removeItem(key);
          window.dispatchEvent(new Event("citypulse-storage-sync"));
          window.dispatchEvent(new Event("citypulse-theme-sync"));
        }
        setRefreshTick((t) => t + 1);
        setConfirmAction(null);
        showToast(`ล้างคีย์ ${key} เรียบร้อยแล้ว`);
      },
    });
  };

  const handleCreatePoll = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasOfficerPermission(session?.officer, "managePolls")) {
      showToast("ไม่มีสิทธิ์จัดการโพลประชาพิจารณ์", "กรุณาขอสิทธิ์จากผู้ดูแลระบบ (Admin)", "warn");
      return;
    }
    if (!newPollTitle.trim() || !newPollDesc.trim()) {
      showToast("กรุณากรอกหัวข้อและคำอธิบายโพลให้ครบ", undefined, "warn");
      return;
    }
    const nextPoll: CivicPoll = {
      id: `poll-${Date.now()}`,
      title: newPollTitle.trim(),
      description: newPollDesc.trim(),
      locationName: resolvedPollLocationName,
      province: selectedPollProvinceName,
      district: selectedPollDistrict?.displayTh,
      subdistrict: selectedPollSubdistrict?.displayTh,
      coordinates: resolvedPollCoordinates,
      category: newPollCategory,
      agreeCount: 0,
      disagreeCount: 0,
      totalVotes: 0,
      proposalBy: session?.officer.name || "ผู้ดูแลระบบ CityPulse",
      endDate: "30 วัน",
    };
    writeCivicPollsStore([nextPoll, ...civicPolls]);
    setNewPollTitle("");
    setNewPollDesc("");
    setNewPollDistrictPcode("all");
    setNewPollSubdistrictPcode("all");
    setRefreshTick((t) => t + 1);
    showToast("เพิ่มโพลประชาพิจารณ์ใหม่แล้ว", `เผยแพร่บนแผนที่พื้นที่ ${nextPoll.locationName}`);
  };

  const handleDeletePoll = (id: string) => {
    if (!hasOfficerPermission(session?.officer, "managePolls")) {
      showToast("ไม่มีสิทธิ์ลบโพลประชาพิจารณ์", "กรุณาขอสิทธิ์จากผู้ดูแลระบบ (Admin)", "warn");
      return;
    }
    writeCivicPollsStore(civicPolls.filter((p) => p.id !== id));
    setRefreshTick((t) => t + 1);
    showToast("ลบโพลออกจากระบบแล้ว");
  };

  const handleRunDiagnostics = async () => {
    setIsProbing(true);
    const probes: { id: string; label: string; url: string }[] = [
      { id: "air4thai", label: "Air4Thai Telemetry API", url: "/api/air4thai" },
      { id: "gistda-flood", label: "GISTDA Disaster Flood API", url: "/api/gistda/flood?period=1day&limit=5" },
      { id: "geocode", label: "Geocoding Search API", url: "/api/geocode/search?q=bangkok" },
      { id: "manifest", label: "PWA Web App Manifest", url: "/manifest.webmanifest" },
    ];

    const results: DiagnosticResult[] = [];
    for (const p of probes) {
      const start = performance.now();
      try {
        const res = await fetch(p.url, { cache: "no-store" });
        const latencyMs = Math.round(performance.now() - start);
        results.push({
          id: p.id,
          label: p.label,
          endpoint: p.url,
          status: res.ok ? "ok" : "warn",
          httpCode: res.status,
          latencyMs,
          detail: res.ok ? `ตอบกลับปกติ (${latencyMs} ms)` : `HTTP ${res.status}`,
        });
      } catch (err) {
        results.push({
          id: p.id,
          label: p.label,
          endpoint: p.url,
          status: "error",
          detail: err instanceof Error ? err.message : "เชื่อมต่อไม่สำเร็จ",
        });
      }
    }

    // Check Service Worker registration status
    let swDetail = "เบราว์เซอร์ไม่รองรับ Service Worker";
    let swStatus: DiagnosticResult["status"] = "warn";
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      try {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg?.active) {
          swStatus = "ok";
          swDetail = `ทำงานปกติ (Scope: ${reg.scope})`;
        } else if (reg) {
          swStatus = "warn";
          swDetail = "กำลังติดตั้ง / รอเปิดใช้งาน";
        } else {
          swStatus = "warn";
          swDetail = "ยังไม่พบ Service Worker ที่ลงทะเบียน";
        }
      } catch {
        swDetail = "ตรวจสอบสถานะไม่สำเร็จ";
      }
    }

    results.push({
      id: "sw",
      label: "PWA Service Worker",
      endpoint: "/sw.js",
      status: swStatus,
      detail: swDetail,
    });

    setDiagResults(results);
    setIsProbing(false);
    showToast("ตรวจสอบสถานะระบบเสร็จสิ้น", `ทดสอบทั้งหมด ${results.length} รายการ`);
  };

  const isCurrentUserAdmin = canManageAccounts(session?.officer);

  const handleGenerateUserPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let generated = "";
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setUserPassword(generated);
    setShowUserPassword(true);
    setUserFormError(null);
  };

  const handleCreateUserAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !canManageAccounts(session.officer)) {
      setUserFormError("เฉพาะบัญชีผู้ดูแลระบบ (Admin) เท่านั้นที่สามารถสร้างผู้ใช้งานใหม่ได้");
      return;
    }

    setUserFormError(null);

    if (accountType === "officer") {
      const res = createCustomOfficerAccount({
        email: userEmail,
        password: userPassword,
        name: userName,
        role: officerRole,
        departmentId: officerDepartmentId,
        badgeCode: officerBadgeCode,
        avatarPose: userAvatarPose,
        isAdmin: officerIsAdmin,
        createdBy: session.officer.email,
      });

      if (!res.ok) {
        setUserFormError(res.error);
        return;
      }

      setLastCreatedUser({
        type: "officer",
        name: res.officer.name,
        email: res.officer.email,
        password: userPassword,
        isAdmin: res.officer.isAdmin,
      });
      setUserEmail("");
      setUserPassword("");
      setUserName("");
      setOfficerBadgeCode("");
      setOfficerIsAdmin(false);
      setRefreshTick((t) => t + 1);
      showToast(
        "สร้างรหัสเจ้าหน้าที่ใหม่สำเร็จ",
        `${res.officer.name} (${res.officer.email})`
      );
      return;
    }

    const citRes = createCitizenAccountByAdmin({
      displayName: userName,
      email: userEmail,
      password: userPassword,
      phone: citizenPhone,
      homeProvince: citizenProvince,
      avatarPose: userAvatarPose,
    });

    if (!citRes.ok) {
      setUserFormError(citRes.error);
      return;
    }

    setLastCreatedUser({
      type: "citizen",
      name: citRes.member.displayName,
      email: citRes.member.email,
      password: userPassword,
    });
    setUserEmail("");
    setUserPassword("");
    setUserName("");
    setCitizenPhone("");
    setRefreshTick((t) => t + 1);
    showToast(
      "สร้างรหัสสมาชิกพลเมืองใหม่สำเร็จ",
      `${citRes.member.displayName} (${citRes.member.email})`
    );
  };

  const handleCopyCreatedCredentials = async () => {
    if (!lastCreatedUser) return;
    const text = [
      `บัญชี: ${lastCreatedUser.name}`,
      `ประเภท: ${lastCreatedUser.type === "officer" ? (lastCreatedUser.isAdmin ? "เจ้าหน้าที่ (Admin)" : "เจ้าหน้าที่ปฏิบัติการ") : "สมาชิกพลเมือง"}`,
      `อีเมล: ${lastCreatedUser.email}`,
      `รหัสผ่าน: ${lastCreatedUser.password}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(text);
      showToast("คัดลอกอีเมลและรหัสผ่านแล้ว", lastCreatedUser.email);
    } catch {
      showToast("ไม่สามารถคัดลอกอัตโนมัติได้", "กรุณาคัดลอกข้อความด้วยตนเอง", "warn");
    }
  };

  const handleDeleteCustomOfficer = (accountId: string, accountName: string) => {
    setConfirmAction({
      title: `ลบบัญชีเจ้าหน้าที่ "${accountName}"?`,
      message: "รหัสผ่านและสิทธิ์การเข้าสู่ระบบของบัญชีนี้จะถูกลบออกจากระบบทันที",
      onConfirm: () => {
        const deleted = deleteCustomOfficerAccount(accountId);
        setConfirmAction(null);
        setRefreshTick((t) => t + 1);
        if (deleted) {
          showToast("ลบบัญชีเจ้าหน้าที่แล้ว", accountName);
        } else {
          showToast("ไม่พบบัญชีที่ต้องการลบ", undefined, "warn");
        }
      },
    });
  };

  const handleDeleteCitizenAccount = (citizenId: string, displayName: string) => {
    setConfirmAction({
      title: `ลบบัญชีพลเมือง "${displayName}"?`,
      message: "บัญชีผู้ใช้นี้จะไม่สามารถใช้เข้าสู่ระบบศูนย์พลเมืองได้อีก",
      onConfirm: () => {
        const deleted = deleteCitizenAccountByAdmin(citizenId);
        setConfirmAction(null);
        setRefreshTick((t) => t + 1);
        if (deleted) {
          showToast("ลบบัญชีพลเมืองแล้ว", displayName);
        }
      },
    });
  };

  const openAddDepartmentModal = (target: "provisioning" | "permissions") => {
    setDeptTargetSelect(target);
    setDeptFormError(null);
    setIsDeptModalOpen(true);
  };

  const handleCreateDepartment = (e: React.FormEvent) => {
    e.preventDefault();
    setDeptFormError(null);
    const result = createCustomDepartment({
      name: deptName,
      code: deptCode,
      headOfficer: deptHeadOfficer,
      contactPhone: deptPhone,
      email: deptEmail,
      slaHours: Number(deptSlaHours) || 24,
      color: deptColor,
    });

    if (!result.ok) {
      setDeptFormError(result.error);
      return;
    }

    if (deptTargetSelect === "permissions" && permTarget && !permTarget.isProtectedRoot) {
      setDraftPermDept(result.department.id);
    } else {
      setOfficerDepartmentId(result.department.id);
    }

    setDeptName("");
    setDeptCode("");
    setDeptHeadOfficer("");
    setDeptPhone("");
    setDeptEmail("");
    setDeptSlaHours("24");
    setDeptColor(DEPARTMENT_COLOR_PRESETS[0]);
    setIsDeptModalOpen(false);
    setRefreshTick((t) => t + 1);
    showToast("เพิ่มหน่วยงานสังกัดใหม่แล้ว", `${result.department.code} · ${result.department.name}`);
  };

  const handleDeleteDepartment = (deptId: string, label: string) => {
    const deleted = deleteCustomDepartment(deptId);
    if (!deleted) return;
    if (officerDepartmentId === deptId) {
      setOfficerDepartmentId("all");
    }
    if (draftPermDept === deptId) {
      setDraftPermDept("all");
    }
    setRefreshTick((t) => t + 1);
    showToast("ลบหน่วยงานเพิ่มเติมแล้ว", label);
  };

  const currentOfficerId = session?.officer.id ?? null;

  const unifiedUserRows = useMemo(() => {
    const officerRows = allOfficers.map((acc) => {
      const deptLabel =
        acc.departmentId === "all"
          ? "ศูนย์ปฏิบัติการกลาง (ทุกหน่วยงาน)"
          : departments.find((d) => d.id === acc.departmentId)?.name ?? acc.departmentId;
      return {
        kind: "officer" as const,
        id: acc.id,
        name: acc.name,
        email: acc.email,
        avatarPose: acc.avatarPose,
        badgeOrTag: acc.badgeCode,
        roleOrProvince: acc.role,
        departmentId: acc.departmentId,
        scopeLabel: deptLabel,
        isAdmin: Boolean(acc.isAdmin || acc.id === "sys-admin-01"),
        isCustom: Boolean(acc.isCustom),
        status: acc.status ?? ("active" as const),
        permissions: getEffectiveOfficerPermissions(acc),
        mustChangePassword: Boolean(acc.mustChangePassword),
        passwordUpdatedAt: acc.passwordUpdatedAt,
        createdLabel: acc.createdAt ?? "บัญชีหลักระบบ",
        isCurrentUser: acc.id === currentOfficerId,
      };
    });

    const citizenRows = registeredCitizens.map((cit) => ({
      kind: "citizen" as const,
      id: cit.id,
      name: cit.displayName,
      email: cit.email,
      avatarPose: cit.avatarPose,
      badgeOrTag: cit.phone || "CITIZEN",
      roleOrProvince: `สมาชิกพลเมือง · จ.${cit.homeProvince}`,
      departmentId: "citizen",
      scopeLabel: `จ.${cit.homeProvince}`,
      isAdmin: false,
      isCustom: true,
      status: cit.status ?? ("active" as const),
      permissions: null,
      mustChangePassword: false,
      passwordUpdatedAt: undefined,
      createdLabel: `สมัคร ${cit.joinedAt}`,
      isCurrentUser: false,
    }));

    return [...officerRows, ...citizenRows];
  }, [allOfficers, registeredCitizens, currentOfficerId, departments]);

  const userTableCounts = useMemo(() => {
    let admin = 0;
    let suspended = 0;
    for (const row of unifiedUserRows) {
      if (row.isAdmin) admin += 1;
      if (row.status === "suspended") suspended += 1;
    }
    return {
      all: unifiedUserRows.length,
      officer: allOfficers.length,
      citizen: registeredCitizens.length,
      admin,
      suspended,
    };
  }, [unifiedUserRows, allOfficers.length, registeredCitizens.length]);

  const filteredUserRows = useMemo(() => {
    const q = userTableSearch.trim().toLowerCase();
    return unifiedUserRows.filter((row) => {
      if (userTableFilter === "officer" && row.kind !== "officer") return false;
      if (userTableFilter === "citizen" && row.kind !== "citizen") return false;
      if (userTableFilter === "admin" && !row.isAdmin) return false;
      if (userTableFilter === "suspended" && row.status !== "suspended") return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.email.toLowerCase().includes(q) ||
        row.badgeOrTag.toLowerCase().includes(q) ||
        row.roleOrProvince.toLowerCase().includes(q) ||
        row.scopeLabel.toLowerCase().includes(q)
      );
    });
  }, [unifiedUserRows, userTableFilter, userTableSearch]);

  const handleOpenPermissionsModal = (row: (typeof unifiedUserRows)[number]) => {
    if (row.kind !== "officer" || !row.permissions) return;
    setPermTarget({
      id: row.id,
      name: row.name,
      email: row.email,
      isProtectedRoot: row.id === "sys-admin-01",
    });
    setDraftPerms({ ...row.permissions });
    setDraftPermRole(row.roleOrProvince);
    setDraftPermDept(row.departmentId);
  };

  const handleSavePermissions = (e: React.FormEvent) => {
    e.preventDefault();
    if (!permTarget || !draftPerms) return;
    const res = updateOfficerAccount(permTarget.id, {
      permissions: draftPerms,
      isAdmin: draftPerms.manageUsers,
      role: draftPermRole,
      departmentId: draftPermDept,
    });
    if (!res.ok) {
      showToast("บันทึกสิทธิ์ไม่สำเร็จ", res.error, "warn");
      return;
    }
    const savedName = permTarget.name;
    setPermTarget(null);
    setDraftPerms(null);
    setRefreshTick((t) => t + 1);
    showToast("อัปเดตสิทธิ์การใช้งานสำเร็จ", savedName);
  };

  const handleToggleUserStatus = (
    kind: "officer" | "citizen",
    id: string,
    name: string,
    currentStatus: "active" | "suspended"
  ) => {
    const nextStatus = currentStatus === "suspended" ? "active" : "suspended";
    const res =
      kind === "officer"
        ? updateOfficerAccount(id, { status: nextStatus })
        : updateCitizenAccountByAdmin(id, { status: nextStatus });

    if (!res.ok) {
      showToast("เปลี่ยนสถานะไม่สำเร็จ", res.error, "warn");
      return;
    }
    setRefreshTick((t) => t + 1);
    showToast(
      nextStatus === "suspended" ? "ระงับการใช้งานชั่วคราวแล้ว" : "เปิดใช้งานบัญชีอีกครั้งแล้ว",
      name,
      nextStatus === "suspended" ? "warn" : "ok"
    );
  };

  const handleOpenResetPassword = (
    kind: "officer" | "citizen",
    id: string,
    name: string,
    email: string
  ) => {
    setResetTarget({ kind, id, name, email });
    setResetPasswordValue("");
    setResetPasswordError(null);
    setShowResetPassword(true);
    setResetMustChangePassword(false);
  };

  const handleGenerateResetPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let generated = "";
    for (let i = 0; i < 8; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setResetPasswordValue(generated);
    setResetPasswordError(null);
  };

  const handleSubmitResetPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    const res =
      resetTarget.kind === "officer"
        ? updateOfficerAccount(resetTarget.id, {
            password: resetPasswordValue,
            mustChangePassword: resetMustChangePassword,
          })
        : updateCitizenAccountByAdmin(resetTarget.id, { password: resetPasswordValue });

    if (!res.ok) {
      setResetPasswordError(res.error);
      return;
    }

    setLastCreatedUser({
      type: resetTarget.kind,
      name: resetTarget.name,
      email: resetTarget.email,
      password: resetPasswordValue,
    });
    const completedName = resetTarget.name;
    setResetTarget(null);
    setResetPasswordValue("");
    setRefreshTick((t) => t + 1);
    showToast("รีเซ็ตรหัสผ่านสำเร็จ", `${completedName} — สามารถคัดลอกรหัสใหม่ได้ที่แถบด้านบน`);
  };

  const iosCardClass =
    "bg-white/80 dark:bg-white/[0.06] backdrop-blur-2xl border border-white/85 dark:border-white/[0.12] shadow-[0_12px_36px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]";
  const iosInnerTileClass =
    "bg-white/85 dark:bg-slate-900/55 border border-slate-200/80 dark:border-white/[0.12]";

  if (!isHydrated || !session) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#050912] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 gap-4">
        <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center p-2.5 ${iosCardClass}`}>
          <JKIcon name="database" className="text-2xl text-indigo-500" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-base font-black">กำลังตรวจสอบสิทธิ์ผู้ดูแลระบบ...</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            กำลังนำทางไปยังหน้าเข้าสู่ระบบเจ้าหน้าที่
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f2f2f7] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-indigo-500/30">
      {/* Ambient Mesh Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/15 blur-[130px]" />
        <div className="absolute top-1/4 -right-32 w-[460px] h-[460px] rounded-full bg-cyan-400/15 dark:bg-sky-600/15 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-[520px] h-[520px] rounded-full bg-emerald-400/15 dark:bg-teal-500/10 blur-[140px]" />
      </div>

      {/* Top Sticky Frosted Header */}
      <header className="sticky top-0 z-30 bg-white/78 dark:bg-[#0b1120]/78 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/[0.1] px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/admin"
            className="flex items-center gap-1.5 px-3 py-2 rounded-full bg-slate-200/75 dark:bg-white/[0.1] hover:bg-slate-300/80 dark:hover:bg-white/[0.18] text-slate-800 dark:text-white text-xs font-black transition border border-white/80 dark:border-white/15 shrink-0"
            title="กลับศูนย์ปฏิบัติการเรื่องร้องเรียน"
          >
            <JKIcon name="arrow-left" className="text-[11px]" />
            <span className="hidden sm:inline">ศูนย์ปฏิบัติการ</span>
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 text-white flex items-center justify-center text-xs shadow-sm shrink-0">
                <JKIcon name="gears" />
              </span>
              <h1 className="text-sm sm:text-base font-black truncate">
                ตั้งค่าระบบ &amp; จัดการฐานข้อมูล
              </h1>
              <span className="hidden md:inline px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/25 text-[10px] font-black shrink-0">
                Backend Console
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
              กำหนดค่าแพลตฟอร์ม กติกา XP โพลชุมชน และจัดการสำรอง/กู้คืนฐานข้อมูล
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/citizen"
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 text-xs font-black transition"
          >
            <JKIcon name="award" className="text-[11px]" />
            <span>ศูนย์พลเมือง</span>
          </Link>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-xs font-black hover:opacity-90 transition"
          >
            <JKIcon name="map" className="text-[11px]" />
            <span>แผนที่</span>
          </Link>

          <button
            type="button"
            onClick={() => toggleThemeStore(!isDark, currentStyle)}
            aria-label="สลับโหมดสว่าง/มืด"
            className="w-9 h-9 rounded-full bg-slate-200/75 dark:bg-white/[0.1] border border-white/80 dark:border-white/15 flex items-center justify-center cursor-pointer transition"
          >
            <JKIcon
              name={isDark ? "sun" : "moon"}
              className="text-xs text-amber-500 dark:text-cyan-300"
            />
          </button>

          <div className="hidden xl:flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-200/70 dark:bg-white/[0.08] border border-white/70 dark:border-white/10 text-xs font-bold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="truncate max-w-[140px]">{session.officer.name}</span>
          </div>

          <button
            type="button"
            onClick={() => {
              clearOfficerSession();
              router.replace("/admin/login");
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white text-xs font-black transition cursor-pointer"
          >
            <JKIcon name="power-off" className="text-[11px]" />
            <span className="hidden sm:inline">ออก</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Live Toast Banner */}
        {toast && (
          <div
            role="status"
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200 ${
              toast.tone === "warn"
                ? "bg-amber-500/15 border-amber-400/50 text-amber-900 dark:text-amber-200"
                : "bg-emerald-500/15 border-emerald-400/50 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <JKIcon
                name={toast.tone === "warn" ? "exclamation-triangle" : "circle-check"}
                className="text-base shrink-0"
              />
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{toast.title}</p>
                {toast.detail && <p className="text-[11px] opacity-85 truncate">{toast.detail}</p>}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 cursor-pointer"
              aria-label="ปิดการแจ้งเตือน"
            >
              <JKIcon name="xmark" className="text-xs" />
            </button>
          </div>
        )}

        {/* Quick Overview KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className={`p-4 sm:p-5 rounded-[24px] ${iosCardClass}`}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
              <span>ฐานข้อมูลเรื่องร้องเรียน</span>
              <JKIcon name="database" className="text-sky-500" />
            </div>
            <p className="text-2xl font-black font-mono mt-1.5 text-slate-900 dark:text-white">
              {complaints.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              รายการเคสทั้งหมดใน Store
            </p>
          </div>

          <div className={`p-4 sm:p-5 rounded-[24px] ${iosCardClass}`}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
              <span>โพลประชาพิจารณ์</span>
              <JKIcon name="square-poll-vertical" className="text-purple-500" />
            </div>
            <p className="text-2xl font-black font-mono mt-1.5 text-slate-900 dark:text-white">
              {civicPolls.length}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              เปิดโหวตอยู่บนแผนที่
            </p>
          </div>

          <div className={`p-4 sm:p-5 rounded-[24px] ${iosCardClass}`}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
              <span>สมาชิกพลเมือง (Local DB)</span>
              <JKIcon name="users" className="text-emerald-500" />
            </div>
            <p className="text-2xl font-black font-mono mt-1.5 text-slate-900 dark:text-white">
              {citizenAccountCount}
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              บัญชีลงทะเบียนจริงในระบบ
            </p>
          </div>

          <div className={`p-4 sm:p-5 rounded-[24px] ${iosCardClass}`}>
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-bold">
              <span>พื้นที่ Storage ที่ใช้งาน</span>
              <JKIcon name="server" className="text-indigo-500" />
            </div>
            <p className="text-2xl font-black font-mono mt-1.5 text-slate-900 dark:text-white">
              {(totalStorageBytes / 1024).toFixed(1)} KB
            </p>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-white/10 mt-2 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-cyan-400 rounded-full transition-all"
                style={{ width: `${storagePct}%` }}
              />
            </div>
          </div>
        </section>

        {/* Segmented Tab Switcher */}
        <div className="inline-flex items-center gap-1 p-1.5 rounded-[20px] bg-slate-200/80 dark:bg-black/45 border border-white/80 dark:border-white/[0.1] overflow-x-auto max-w-full">
          {[
            { id: "settings", label: "ตั้งค่าระบบ & XP", icon: "sliders-h" },
            { id: "database", label: "ฐานข้อมูล & สำรองข้อมูล", icon: "database" },
            { id: "cloud", label: "เชื่อมต่อ Cloud DB & Drive", icon: "cloud" },
            { id: "polls", label: `จัดการโพลชุมชน (${civicPolls.length})`, icon: "square-poll-vertical" },
            { id: "diagnostics", label: `ผู้ใช้งาน (${allOfficers.length + registeredCitizens.length}) & API`, icon: "shield-halved" },
          ].map((tab) => {
            const active = activeTab === tab.id;
            const tabHref = tab.id === "cloud" ? `#cloud/${cloudProvider}` : `#${tab.id}`;
            return (
              <a
                key={tab.id}
                href={tabHref}
                onClick={(e) => {
                  e.preventDefault();
                  handleSelectTab(tab.id as SystemTabKey);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-[14px] text-xs font-black transition cursor-pointer whitespace-nowrap shrink-0 ${
                  active
                    ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <JKIcon
                  name={tab.icon}
                  className={active ? "text-indigo-500 dark:text-cyan-300" : ""}
                />
                <span>{tab.label}</span>
              </a>
            );
          })}
        </div>

        {/* TAB 1: SYSTEM SETTINGS */}
        {activeTab === "settings" && (
          <form onSubmit={handleSaveSettings} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className={`lg:col-span-7 rounded-[28px] p-5 sm:p-6 space-y-5 ${iosCardClass}`}>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-black flex items-center gap-2">
                    <JKIcon name="gear" className="text-indigo-500" />
                    <span>พารามิเตอร์ระบบและแผนที่</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ปรับแต่งชื่อระบบ สไตล์แผนที่เริ่มต้น เกณฑ์ SLA และสวิตช์การทำงานหลัก
                  </p>
                </div>
                {draftSettings && (
                  <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black">
                    มีการแก้ไขที่ยังไม่บันทึก
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    ชื่อแพลตฟอร์ม
                  </label>
                  <input
                    type="text"
                    value={formSettings.platformName}
                    onChange={(e) =>
                      handleUpdateDraft((s) => ({ ...s, platformName: e.target.value }))
                    }
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${iosInnerTileClass}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    สไตล์แผนที่เริ่มต้น (Default Basemap)
                  </label>
                  <select
                    value={formSettings.defaultMapStyle}
                    onChange={(e) =>
                      handleUpdateDraft((s) => ({
                        ...s,
                        defaultMapStyle: e.target.value as MapStyleKey,
                      }))
                    }
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${iosInnerTileClass}`}
                  >
                    <option value="voyager">CARTO Voyager</option>
                    <option value="darkmatter">CARTO Dark Matter</option>
                    <option value="positron">CARTO Positron</option>
                    <option value="openfreemap">OpenFreeMap Liberty</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    SLA มาตรฐาน (ชั่วโมง)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={formSettings.slaDefaultHours}
                    onChange={(e) =>
                      handleUpdateDraft((s) => ({
                        ...s,
                        slaDefaultHours: Math.max(1, Number(e.target.value) || 48),
                      }))
                    }
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-mono font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${iosInnerTileClass}`}
                  />
                </div>

                <div>
                  <label className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5">
                    ขนาดรูปถ่ายหลักฐานสูงสุด (MB)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={25}
                    value={formSettings.maxUploadSizeMb}
                    onChange={(e) =>
                      handleUpdateDraft((s) => ({
                        ...s,
                        maxUploadSizeMb: Math.max(1, Number(e.target.value) || 5),
                      }))
                    }
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-mono font-black focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${iosInnerTileClass}`}
                  />
                </div>
              </div>

              {/* Feature Switches */}
              <div className="space-y-2.5 pt-2 border-t border-slate-200/70 dark:border-white/10">
                {[
                  {
                    key: "allowAnonymousReports" as const,
                    title: "อนุญาตแจ้งเรื่องแบบไม่ระบุตัวตน (Anonymous)",
                    desc: "ซ่อนชื่อผู้แจ้งและเบอร์โทรบนสาธารณะเมื่อผู้ใช้เลือกส่งแบบไม่เปิดเผยตัวตน",
                  },
                  {
                    key: "autoAssignDepartment" as const,
                    title: "ส่งต่อหน่วยงานอัตโนมัติตามหมวดปัญหา",
                    desc: "จับคู่หมวดหมู่เรื่องร้องเรียนเข้าสู่สำนักที่รับผิดชอบโดยอัตโนมัติ",
                  },
                  {
                    key: "enableAir4ThaiLayer" as const,
                    title: "เปิดชั้นข้อมูลคุณภาพอากาศสด (Air4Thai & USGS)",
                    desc: "อนุญาตการแสดงสถานี PM2.5 และหมุดแผ่นดินไหวแบบเรียลไทม์",
                  },
                  {
                    key: "maintenanceMode" as const,
                    title: "โหมดบำรุงรักษาระบบ (Maintenance Flag)",
                    desc: "บันทึกสถานะแจ้งเตือนการปิดปรับปรุงระบบลงในพารามิเตอร์ระบบ",
                  },
                ].map((item) => {
                  const checked = formSettings[item.key];
                  return (
                    <label
                      key={item.key}
                      className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 cursor-pointer ${iosInnerTileClass}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white">
                          {item.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {item.desc}
                        </p>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) =>
                          handleUpdateDraft((s) => ({ ...s, [item.key]: e.target.checked }))
                        }
                        className="w-5 h-5 accent-indigo-600 rounded cursor-pointer shrink-0"
                      />
                    </label>
                  );
                })}
              </div>

              {/* GISTDA Disaster Open API Settings */}
              <div className="space-y-3 pt-3 border-t border-slate-200/70 dark:border-white/10">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                      <JKIcon name="water" className="text-sky-500 text-xs" />
                      <span>GISTDA Disaster Open API (ข้อมูลน้ำท่วม/น้ำไหล)</span>
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      เชื่อมข้อมูลพื้นที่น้ำท่วมรายวันจาก{" "}
                      <a
                        href="https://disaster.gistda.or.th/services/open-api"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-600 dark:text-cyan-400 font-semibold hover:underline"
                      >
                        disaster.gistda.or.th/services/open-api
                      </a>
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1">
                      GISTDA API Key (หรือกำหนดผ่าน env: GISTDA_API_KEY)
                    </label>
                    <input
                      type="password"
                      value={formSettings.gistdaApiKey}
                      onChange={(e) =>
                        handleUpdateDraft((s) => ({ ...s, gistdaApiKey: e.target.value }))
                      }
                      placeholder="ใส่ API Key จาก api-gateway.gistda.or.th..."
                      className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-mono focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${iosInnerTileClass}`}
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-black text-slate-700 dark:text-slate-200 mb-1">
                      ช่วงข้อมูลน้ำท่วมเริ่มต้น
                    </label>
                    <select
                      value={formSettings.gistdaFloodPeriod}
                      onChange={(e) =>
                        handleUpdateDraft((s) => ({
                          ...s,
                          gistdaFloodPeriod: e.target.value as GistdaFloodPeriod,
                        }))
                      }
                      className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500/40 ${iosInnerTileClass}`}
                    >
                      {GISTDA_FLOOD_PERIOD_OPTIONS.map((opt) => (
                        <option key={opt.id} value={opt.id}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {formSettings.maintenanceMode && (
                <div>
                  <label className="block text-xs font-black text-amber-700 dark:text-amber-300 mb-1.5">
                    ข้อความประกาศโหมดบำรุงรักษา
                  </label>
                  <input
                    type="text"
                    value={formSettings.maintenanceMessage}
                    onChange={(e) =>
                      handleUpdateDraft((s) => ({ ...s, maintenanceMessage: e.target.value }))
                    }
                    className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-amber-500/40 ${iosInnerTileClass}`}
                  />
                </div>
              )}
            </div>

            {/* Right Column: XP Rules & Save Actions */}
            <div className="lg:col-span-5 space-y-5">
              <div className={`rounded-[28px] p-5 sm:p-6 space-y-4 ${iosCardClass}`}>
                <div>
                  <h2 className="text-sm font-black flex items-center gap-2">
                    <JKIcon name="bolt" className="text-amber-500" />
                    <span>เกณฑ์คะแนนพลเมือง (Gamification XP)</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    กำหนดน้ำหนักคะแนน XP สำหรับแต่ละกิจกรรมพลเมือง
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      { key: "DAILY_CHECKIN", label: "เช็กอินรายวัน" },
                      { key: "UPVOTE", label: "กด +1 โหวตปัญหา" },
                      { key: "COMMENT", label: "แสดงความคิดเห็น" },
                      { key: "POLL_VOTE", label: "โหวตโพลชุมชน" },
                      { key: "REPORT", label: "แจ้งเรื่องใหม่" },
                      { key: "PHOTO_BONUS", label: "โบนัสแนบรูปถ่าย" },
                      { key: "RESOLVED_BONUS", label: "โบนัสดันสำเร็จ" },
                    ] as const
                  ).map((rule) => (
                    <div key={rule.key} className={`p-3 rounded-2xl ${iosInnerTileClass}`}>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        {rule.label}
                      </label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0}
                          max={500}
                          value={formSettings.xpRewards[rule.key]}
                          onChange={(e) => {
                            const nextVal = Math.max(0, Number(e.target.value) || 0);
                            handleUpdateDraft((s) => ({
                              ...s,
                              xpRewards: { ...s.xpRewards, [rule.key]: nextVal },
                            }));
                          }}
                          className="w-full bg-transparent text-sm font-black font-mono focus:outline-none"
                        />
                        <span className="text-[10px] font-black text-orange-500 shrink-0">XP</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="pt-3 flex items-center gap-2.5">
                  <button
                    type="submit"
                    className="flex-1 py-3 px-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-black shadow-lg shadow-indigo-600/25 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <JKIcon name="circle-check" className="text-xs" />
                    <span>บันทึกการตั้งค่าระบบ</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSettings}
                    className={`py-3 px-4 rounded-2xl text-xs font-black hover:bg-rose-500/15 hover:text-rose-600 dark:hover:text-rose-300 transition cursor-pointer ${iosInnerTileClass}`}
                  >
                    คืนค่าเริ่มต้น
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}

        {/* TAB 2: DATABASE & STORAGE MANAGER */}
        {activeTab === "database" && (
          <div className="space-y-6">
            {/* Backup & Restore Toolbar */}
            <div className={`rounded-[28px] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${iosCardClass}`}>
              <div>
                <h2 className="text-sm font-black flex items-center gap-2">
                  <JKIcon name="database" className="text-indigo-500" />
                  <span>สำรองข้อมูล กู้คืน และสำรวจคอลเลกชัน (LocalDB Explorer)</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  จัดการข้อมูลทั้งหมด {collections.length} ตาราง • ใช้งานจริง{" "}
                  {(totalStorageBytes / 1024).toFixed(2)} KB จาก 5,120 KB ({storagePct}%)
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <a
                  href={`#cloud/${cloudProvider}`}
                  onClick={(e) => {
                    e.preventDefault();
                    handleSelectTab("cloud");
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-sky-600/15 hover:bg-sky-600 text-sky-700 dark:text-cyan-300 hover:text-white text-xs font-black transition cursor-pointer"
                >
                  <JKIcon name="cloud" className="text-[11px]" />
                  <span>คู่มือย้าย Cloud DB + Drive</span>
                </a>

                <button
                  type="button"
                  onClick={() => setRefreshTick((t) => t + 1)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-black cursor-pointer transition ${iosInnerTileClass}`}
                >
                  <JKIcon name="rotate-right" className="text-[11px]" />
                  <span>รีเฟรช</span>
                </button>

                <button
                  type="button"
                  onClick={handleExportFullBackup}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer shadow-sm"
                >
                  <JKIcon name="file-export" className="text-[11px]" />
                  <span>ส่งออก Backup (JSON)</span>
                </button>

                <button
                  type="button"
                  onClick={() => restoreInputRef.current?.click()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black transition cursor-pointer shadow-sm"
                >
                  <JKIcon name="file-import" className="text-[11px]" />
                  <span>นำเข้า Restore (JSON)</span>
                </button>
                <input
                  ref={restoreInputRef}
                  type="file"
                  accept="application/json,.json"
                  onChange={handleImportBackupFile}
                  className="hidden"
                />
              </div>
            </div>

            {/* Collection Picker + Inspector Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Collections List */}
              <div className={`lg:col-span-5 rounded-[28px] p-4 space-y-2 ${iosCardClass}`}>
                <div className="px-2 py-1 flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  <span>ตารางข้อมูลในระบบ ({collections.length})</span>
                  <span>ขนาด / จำนวน</span>
                </div>

                <div className="space-y-1.5 max-h-[540px] overflow-y-auto pr-1">
                  {collections.map((col) => {
                    const selected = col.key === selectedCollectionKey;
                    return (
                      <button
                        key={col.key}
                        type="button"
                        onClick={() => setSelectedCollectionKey(col.key)}
                        className={`w-full text-left p-3 rounded-2xl border transition cursor-pointer ${
                          selected
                            ? "bg-indigo-500/12 dark:bg-indigo-500/20 border-indigo-500/50"
                            : `${iosInnerTileClass} hover:bg-white dark:hover:bg-slate-800/70`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {col.label}
                          </span>
                          <span className="text-[10px] font-mono font-black px-2 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/10 shrink-0">
                            {col.recordCount} rec · {(col.byteSize / 1024).toFixed(1)} KB
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-1">
                          <code className="text-[10px] text-indigo-600 dark:text-cyan-300 font-mono truncate">
                            {col.key}
                          </code>
                          <span
                            className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded ${
                              col.hasCustomData
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                : "bg-slate-200 dark:bg-white/10 text-slate-500"
                            }`}
                          >
                            {col.hasCustomData ? "Saved" : "Default"}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Right: Live Collection Inspector & Danger Actions */}
              <div className={`lg:col-span-7 rounded-[28px] p-5 space-y-4 ${iosCardClass}`}>
                {activeCollection && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-sm font-black truncate">{activeCollection.label}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          {activeCollection.description} • Key:{" "}
                          <code className="font-mono text-indigo-600 dark:text-cyan-300">
                            {activeCollection.key}
                          </code>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={handleCopyCollectionJson}
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black flex items-center gap-1 cursor-pointer ${iosInnerTileClass}`}
                        >
                          <JKIcon name="code" className="text-[10px]" />
                          <span>คัดลอก JSON</span>
                        </button>
                        {activeCollection.hasCustomData && (
                          <button
                            type="button"
                            onClick={() =>
                              handleDeleteCollectionKey(
                                activeCollection.key,
                                activeCollection.label
                              )
                            }
                            className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white text-[11px] font-black flex items-center gap-1 transition cursor-pointer"
                          >
                            <JKIcon name="trash" className="text-[10px]" />
                            <span>ล้างตารางนี้</span>
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="relative">
                      <JKIcon
                        name="magnifying-glass"
                        className="text-xs text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                      />
                      <input
                        type="text"
                        value={collectionSearch}
                        onChange={(e) => setCollectionSearch(e.target.value)}
                        placeholder="กรองบรรทัดใน JSON (เช่น ชื่อจังหวัด, id, status...)"
                        className={`w-full pl-9 pr-3.5 py-2 rounded-2xl text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/40 ${iosInnerTileClass}`}
                      />
                    </div>

                    {/* Preview table summary if array */}
                    {Array.isArray(parsedActiveItems) && (
                      <div className="text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between px-1">
                        <span>จำนวนข้อมูลใน Array: {parsedActiveItems.length} รายการ</span>
                        <span>ขนาดดิบ: {activeCollection.byteSize.toLocaleString()} bytes</span>
                      </div>
                    )}

                    <pre className="p-4 rounded-2xl bg-slate-950 text-emerald-300 text-[11px] font-mono overflow-x-auto max-h-[360px] overflow-y-auto border border-white/10 leading-relaxed">
                      {formattedCollectionJson}
                    </pre>

                    {/* Quick Danger Zone Presets */}
                    <div className="pt-3 border-t border-slate-200/70 dark:border-white/10">
                      <p className="text-[11px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                        <JKIcon name="exclamation-triangle" className="text-xs" />
                        <span>ล้างข้อมูลเฉพาะส่วน (Danger Zone)</span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCollectionKey(STORAGE_KEY, "เรื่องร้องเรียนทั้งหมด")
                          }
                          className="px-3 py-1.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-black cursor-pointer transition"
                        >
                          รีเซ็ตเรื่องร้องเรียนเป็นค่าเริ่มต้น
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteCollectionKey(POLLS_STORAGE_KEY, "โพลประชาพิจารณ์")
                          }
                          className="px-3 py-1.5 rounded-xl bg-rose-500/12 hover:bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-black cursor-pointer transition"
                        >
                          รีเซ็ตโพลชุมชนเป็นค่าเริ่มต้น
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setConfirmAction({
                              title: "ล้างประวัติกิจกรรมพลเมืองในเบราว์เซอร์นี้?",
                              message:
                                "ประวัติโหวต (+1), เช็กอิน, คอมเมนต์ และโพลที่เคยกดไว้ในเครื่องนี้จะถูกรีเซ็ตเป็น 0 XP",
                              onConfirm: () => {
                                [
                                  UPVOTES_STORAGE_KEY,
                                  MY_REPORTS_STORAGE_KEY,
                                  CHECKINS_STORAGE_KEY,
                                  MY_COMMENTS_STORAGE_KEY,
                                  POLL_VOTES_STORAGE_KEY,
                                ].forEach((k) => window.localStorage.removeItem(k));
                                window.dispatchEvent(new Event("citypulse-storage-sync"));
                                setRefreshTick((t) => t + 1);
                                setConfirmAction(null);
                                showToast("ล้างประวัติกิจกรรมพลเมืองเรียบร้อยแล้ว");
                              },
                            });
                          }}
                          className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-800 dark:text-amber-300 text-[11px] font-black cursor-pointer transition flex items-center gap-1"
                        >
                          <JKIcon name="broom" className="text-[10px]" />
                          <span>ล้างกิจกรรม XP ของเครื่องนี้</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2.5: CLOUD DATABASE & GOOGLE DRIVE GUIDE */}
        {activeTab === "cloud" && (
          <CloudDatabaseGuidePanel
            iosCardClass={iosCardClass}
            iosInnerTileClass={iosInnerTileClass}
            onToast={showToast}
            provider={cloudProvider}
            onProviderChange={(nextProvider) => navigateSystemHash(`#cloud/${nextProvider}`)}
          />
        )}

        {/* TAB 3: COMMUNITY POLLS CRUD */}
        {activeTab === "polls" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Create New Poll Form */}
            <form
              onSubmit={handleCreatePoll}
              className={`lg:col-span-5 rounded-[28px] p-5 sm:p-6 space-y-4 ${iosCardClass}`}
            >
              <div>
                <h2 className="text-sm font-black flex items-center gap-2">
                  <JKIcon name="plus" className="text-purple-500" />
                  <span>สร้างโพลประชาพิจารณ์ใหม่</span>
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  โพลที่สร้างจะไปปรากฏบนแผนที่ชั้นข้อมูลโพลชุมชนทันที
                </p>
              </div>

              <div>
                <label className="block text-xs font-black mb-1">หัวข้อโพล *</label>
                <input
                  type="text"
                  value={newPollTitle}
                  onChange={(e) => setNewPollTitle(e.target.value)}
                  placeholder="เช่น เห็นด้วยหรือไม่กับการปรับปรุงทางม้าลายเรืองแสง..."
                  className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${iosInnerTileClass}`}
                />
              </div>

              <div>
                <label className="block text-xs font-black mb-1">รายละเอียดข้อเสนอ *</label>
                <textarea
                  rows={3}
                  value={newPollDesc}
                  onChange={(e) => setNewPollDesc(e.target.value)}
                  placeholder="ระบุเหตุผล งบประมาณ หรือรายละเอียดโครงการ..."
                  className={`w-full px-3.5 py-2.5 rounded-2xl text-xs font-medium focus:outline-none focus:ring-2 focus:ring-purple-500/40 ${iosInnerTileClass}`}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-black mb-1">พื้นที่จังหวัด</label>
                  <select
                    value={newPollProvinceId}
                    onChange={(e) => {
                      setNewPollProvinceId(e.target.value);
                      setNewPollDistrictPcode("all");
                      setNewPollSubdistrictPcode("all");
                    }}
                    className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold focus:outline-none ${iosInnerTileClass}`}
                  >
                    {CITIES.map((city) => (
                      <option key={city.id} value={city.id}>
                        {city.name.split(" (")[0]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black mb-1">หมวดหมู่โพล</label>
                  <select
                    value={newPollCategory}
                    onChange={(e) => setNewPollCategory(e.target.value as CivicPoll["category"])}
                    className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold focus:outline-none ${iosInnerTileClass}`}
                  >
                    {POLL_CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black mb-1">
                    {selectedPollProvinceName === "กรุงเทพมหานคร" ? "เขต" : "เขต / อำเภอ"}
                  </label>
                  <select
                    value={newPollDistrictPcode}
                    onChange={(e) => {
                      setNewPollDistrictPcode(e.target.value);
                      setNewPollSubdistrictPcode("all");
                      ensureSubdistrictsLoaded();
                    }}
                    className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold focus:outline-none ${iosInnerTileClass}`}
                  >
                    <option value="all">
                      ทุก{selectedPollProvinceName === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ"} (
                      {pollDistrictOptions.length})
                    </option>
                    {pollDistrictOptions.map((dist) => (
                      <option key={dist.pcode} value={dist.pcode}>
                        {dist.displayTh}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-black mb-1">
                    {selectedPollProvinceName === "กรุงเทพมหานคร" ? "แขวง" : "ตำบล / แขวง"}
                  </label>
                  <select
                    value={newPollSubdistrictPcode}
                    onChange={(e) => setNewPollSubdistrictPcode(e.target.value)}
                    disabled={newPollDistrictPcode === "all"}
                    className={`w-full px-3 py-2.5 rounded-2xl text-xs font-bold focus:outline-none disabled:opacity-55 disabled:cursor-not-allowed ${iosInnerTileClass}`}
                  >
                    {newPollDistrictPcode === "all" ? (
                      <option value="all">เลือกเขต/อำเภอก่อน</option>
                    ) : isLoadingSubdistricts && pollSubdistrictOptions.length === 0 ? (
                      <option value="all">กำลังโหลดรายชื่อตำบล/แขวง...</option>
                    ) : (
                      <>
                        <option value="all">
                          ทุก{selectedPollProvinceName === "กรุงเทพมหานคร" ? "แขวง" : "ตำบล"} (
                          {pollSubdistrictOptions.length})
                        </option>
                        {pollSubdistrictOptions.map((sub) => (
                          <option key={sub.pcode} value={sub.pcode}>
                            {sub.displayTh}
                          </option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
              </div>

              <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 px-3 py-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="inline-flex items-center gap-1.5 font-bold text-purple-700 dark:text-purple-300 truncate">
                  <JKIcon name="map-marker-alt" className="text-[10px] shrink-0" />
                  <span className="truncate">ปักหมุด: {resolvedPollLocationName}</span>
                </span>
                <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400 shrink-0">
                  {resolvedPollCoordinates[1].toFixed(4)}, {resolvedPollCoordinates[0].toFixed(4)}
                </span>
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black shadow-lg shadow-purple-600/25 transition cursor-pointer flex items-center justify-center gap-1.5"
              >
                <JKIcon name="plus" className="text-xs" />
                <span>เผยแพร่โพลบนแผนที่</span>
              </button>
            </form>

            {/* Polls Table List */}
            <div className={`lg:col-span-7 rounded-[28px] p-5 sm:p-6 space-y-3 ${iosCardClass}`}>
              <h3 className="text-sm font-black flex items-center justify-between">
                <span>รายการโพลในระบบทั้งหมด ({civicPolls.length})</span>
              </h3>
              <div className="space-y-3">
                {civicPolls.map((poll) => {
                  const agreePct =
                    poll.totalVotes > 0 ? Math.round((poll.agreeCount / poll.totalVotes) * 100) : 0;
                  return (
                    <div key={poll.id} className={`p-4 rounded-2xl space-y-2 ${iosInnerTileClass}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-700 dark:text-purple-300 text-[10px] font-black">
                              {poll.locationName}
                            </span>
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              โดย {poll.proposalBy} · สิ้นสุดใน {poll.endDate}
                            </span>
                          </div>
                          <p className="text-xs sm:text-sm font-black mt-1">{poll.title}</p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">
                            {poll.description}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeletePoll(poll.id)}
                          className="p-2 rounded-xl bg-rose-500/12 hover:bg-rose-500 text-rose-600 dark:text-rose-300 hover:text-white transition cursor-pointer shrink-0"
                          title="ลบโพลนี้"
                        >
                          <JKIcon name="trash" className="text-xs" />
                        </button>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px] font-bold">
                          <span className="text-emerald-600 dark:text-emerald-400">
                            เห็นด้วย {poll.agreeCount} ({agreePct}%)
                          </span>
                          <span className="text-rose-600 dark:text-rose-400">
                            ไม่เห็นด้วย {poll.disagreeCount} · รวม {poll.totalVotes} เสียง
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-rose-500/25 overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full transition-all"
                            style={{ width: `${agreePct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: DIAGNOSTICS & OFFICER ROLES */}
        {activeTab === "diagnostics" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Admin User Provisioning Card */}
            <div className={`lg:col-span-12 relative overflow-hidden rounded-[30px] p-5 sm:p-7 space-y-6 ${iosCardClass}`}>
              {/* Subtle Ambient Mesh Glow */}
              <div className="pointer-events-none absolute -top-24 -left-16 w-72 h-72 rounded-full bg-indigo-500/15 dark:bg-indigo-500/12 blur-3xl" />
              <div className="pointer-events-none absolute -bottom-24 -right-12 w-80 h-80 rounded-full bg-cyan-400/15 dark:bg-cyan-500/10 blur-3xl" />

              {/* Header Row */}
              <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-200/70 dark:border-white/[0.08]">
                <div className="flex items-start sm:items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-sky-500 to-cyan-400 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
                    <JKIcon name="user-plus" className="text-base" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                        สร้างรหัสผู้ใช้งานใหม่
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/12 dark:bg-cyan-500/15 border border-indigo-500/20 dark:border-cyan-400/25 text-indigo-700 dark:text-cyan-300 text-[10px] font-black tracking-wide uppercase">
                        Admin User Provisioning
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ออกบัญชีเจ้าหน้าที่สำหรับศูนย์ปฏิบัติการ (/admin/login) และบัญชีพลเมืองเพิ่มเติมได้ทันที
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {isCurrentUserAdmin && (
                    <div className="inline-flex items-center p-1 rounded-full bg-slate-200/80 dark:bg-black/50 border border-white/80 dark:border-white/[0.1] shadow-inner">
                      <button
                        type="button"
                        onClick={() => {
                          setAccountType("officer");
                          setUserFormError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                          accountType === "officer"
                            ? "bg-gradient-to-r from-indigo-600 to-sky-500 text-white shadow-md shadow-sky-500/25"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <JKIcon name="user-shield" className="text-[11px]" />
                        <span>เจ้าหน้าที่ / Admin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setAccountType("citizen");
                          setUserFormError(null);
                        }}
                        className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-black transition-all cursor-pointer ${
                          accountType === "citizen"
                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-500/25"
                            : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                        }`}
                      >
                        <JKIcon name="users" className="text-[11px]" />
                        <span>สมาชิกพลเมือง</span>
                      </button>
                    </div>
                  )}

                  <span
                    className={`inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-black border ${
                      isCurrentUserAdmin
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                        : "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300"
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isCurrentUserAdmin ? "bg-emerald-400 animate-pulse" : "bg-amber-400"
                      }`}
                    />
                    <span>
                      {isCurrentUserAdmin ? "สิทธิ์ Admin พร้อมใช้งาน" : "เฉพาะ Admin เท่านั้น"}
                    </span>
                  </span>
                </div>
              </div>

              {!isCurrentUserAdmin ? (
                <div className={`relative z-10 p-4 rounded-2xl flex items-start gap-3 ${iosInnerTileClass}`}>
                  <JKIcon name="shield-halved" className="text-amber-500 text-base mt-0.5 shrink-0" />
                  <div className="space-y-1 text-xs">
                    <p className="font-black text-slate-900 dark:text-white">
                      บัญชีปัจจุบัน ({session.officer.email}) ไม่มีสิทธิ์สร้างผู้ใช้งานใหม่
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      กรุณาเข้าสู่ระบบด้วยบัญชี Super Admin:{" "}
                      <span className="font-mono font-bold text-indigo-600 dark:text-cyan-300">
                        admin@citypulse.go.th
                      </span>{" "}
                      (รหัสผ่านเริ่มต้น:{" "}
                      <span className="font-mono font-bold text-indigo-600 dark:text-cyan-300">
                        admin1234
                      </span>
                      ) หรือบัญชีที่มีสิทธิ์ Admin
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateUserAccount} className="relative z-10 space-y-5">
                  {userFormError && (
                    <div
                      role="alert"
                      className="p-3.5 rounded-2xl bg-rose-500/12 border border-rose-500/35 text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2.5"
                    >
                      <JKIcon name="exclamation-triangle" className="text-sm shrink-0" />
                      <span>{userFormError}</span>
                    </div>
                  )}

                  {lastCreatedUser && (
                    <div className="p-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs space-y-0.5 min-w-0">
                        <p className="font-black text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                          <JKIcon name="check" className="text-xs" />
                          <span>ออกรหัสผู้ใช้งานล่าสุดสำเร็จ: {lastCreatedUser.name}</span>
                        </p>
                        <p className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300 truncate">
                          อีเมล: {lastCreatedUser.email} · รหัสผ่าน: {lastCreatedUser.password}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleCopyCreatedCredentials}
                        className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black transition cursor-pointer inline-flex items-center gap-1.5 shrink-0 shadow-sm"
                      >
                        <JKIcon name="copy" className="text-[11px]" />
                        <span>คัดลอกข้อมูลเข้าสู่ระบบ</span>
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
                    {/* Left 8 Columns: Structured Fields */}
                    <div className="xl:col-span-8 space-y-4">
                      {/* Credentials Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                            {accountType === "officer"
                              ? "ชื่อ-นามสกุลเจ้าหน้าที่ *"
                              : "ชื่อที่แสดง (Display Name) *"}
                          </label>
                          <div className="relative">
                            <JKIcon
                              name="user"
                              className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                            <input
                              type="text"
                              value={userName}
                              onChange={(e) => setUserName(e.target.value)}
                              placeholder={
                                accountType === "officer"
                                  ? "เช่น นายภาคิน ฝ่ายวิเคราะห์"
                                  : "เช่น คุณนภา พลเมืองดี"
                              }
                              required
                              className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                            อีเมลสำหรับเข้าสู่ระบบ *
                          </label>
                          <div className="relative">
                            <JKIcon
                              name="envelope"
                              className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                            <input
                              type="email"
                              value={userEmail}
                              onChange={(e) => setUserEmail(e.target.value)}
                              placeholder={
                                accountType === "officer"
                                  ? "staff01@citypulse.go.th"
                                  : "citizen@example.com"
                              }
                              required
                              className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">
                              รหัสผ่าน ({accountType === "officer" ? ">= 4 ตัว" : ">= 6 ตัว"}) *
                            </label>
                            <button
                              type="button"
                              onClick={handleGenerateUserPassword}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/12 hover:bg-sky-500/20 text-[10px] font-black text-sky-600 dark:text-cyan-300 cursor-pointer transition"
                            >
                              <JKIcon name="wand-magic-sparkles" className="text-[9px]" />
                              <span>สุ่มรหัสปลอดภัย</span>
                            </button>
                          </div>
                          <div className="relative">
                            <JKIcon
                              name="lock"
                              className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                            <input
                              type={showUserPassword ? "text" : "password"}
                              value={userPassword}
                              onChange={(e) => setUserPassword(e.target.value)}
                              placeholder="กำหนดรหัสผ่านเริ่มต้น"
                              required
                              className="w-full h-11 pl-10 pr-10 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                            />
                            <button
                              type="button"
                              onClick={() => setShowUserPassword((prev) => !prev)}
                              aria-label={showUserPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 cursor-pointer transition"
                            >
                              <JKIcon name={showUserPassword ? "eye-slash" : "eye"} className="text-xs" />
                            </button>
                          </div>
                        </div>

                        {accountType === "officer" ? (
                          <div>
                            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                              รหัสประจำตัว / Badge Code
                            </label>
                            <div className="relative">
                              <JKIcon
                                name="id-badge"
                                className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                              <input
                                type="text"
                                value={officerBadgeCode}
                                onChange={(e) => setOfficerBadgeCode(e.target.value)}
                                placeholder="ปล่อยว่างเพื่อสร้างอัตโนมัติ"
                                className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-mono uppercase text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                              />
                            </div>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                              เบอร์โทรศัพท์ (ไม่บังคับ)
                            </label>
                            <div className="relative">
                              <JKIcon
                                name="phone"
                                className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                              <input
                                type="tel"
                                value={citizenPhone}
                                onChange={(e) => setCitizenPhone(e.target.value)}
                                placeholder="08x-xxx-xxxx"
                                className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition"
                              />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Role, Department / Province & Admin Switch */}
                      {accountType === "officer" ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          <div>
                            <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                              ตำแหน่ง / หน้าที่ *
                            </label>
                            <div className="relative">
                              <JKIcon
                                name="user-check"
                                className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                              <input
                                type="text"
                                value={officerRole}
                                onChange={(e) => setOfficerRole(e.target.value)}
                                placeholder="เช่น เจ้าหน้าที่รับเรื่อง / ผู้ช่วยแอดมิน"
                                required
                                className="w-full h-11 pl-10 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                              />
                            </div>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">
                                หน่วยงานสังกัด ({departments.length})
                              </label>
                              <button
                                type="button"
                                onClick={() => openAddDepartmentModal("provisioning")}
                                className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer"
                              >
                                <JKIcon name="plus" className="text-[9px]" />
                                <span>เพิ่มหน่วยงานใหม่</span>
                              </button>
                            </div>
                            <div className="relative">
                              <JKIcon
                                name="building"
                                className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                              <select
                                value={officerDepartmentId}
                                onChange={(e) => setOfficerDepartmentId(e.target.value)}
                                className="w-full h-11 appearance-none pl-10 pr-9 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition cursor-pointer"
                              >
                                <option value="all">ทุกหน่วยงาน (ศูนย์ปฏิบัติการกลาง 77 จังหวัด)</option>
                                {departments.map((dept) => (
                                  <option key={dept.id} value={dept.id}>
                                    {dept.code} · {dept.name}
                                  </option>
                                ))}
                              </select>
                              <JKIcon
                                name="chevron-down"
                                className="text-slate-400 text-[11px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                              />
                            </div>
                          </div>

                          {/* iOS Animated Toggle Switch Card */}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={officerIsAdmin}
                            onClick={() => setOfficerIsAdmin((prev) => !prev)}
                            className={`sm:col-span-2 p-3.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer ${
                              officerIsAdmin
                                ? "bg-indigo-500/12 dark:bg-indigo-500/18 border-indigo-500/45 shadow-sm shadow-indigo-500/10"
                                : "bg-white/75 dark:bg-slate-950/50 border-slate-200/80 dark:border-white/[0.1] hover:border-slate-300 dark:hover:border-white/20"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div
                                className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                                  officerIsAdmin
                                    ? "bg-indigo-600 text-white"
                                    : "bg-slate-200/80 dark:bg-white/10 text-slate-500 dark:text-slate-300"
                                }`}
                              >
                                <JKIcon name="shield-halved" className="text-xs" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                                  มอบสิทธิ์ผู้ดูแลระบบ (Admin)
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  สามารถสร้าง/ลบบัญชีผู้ใช้งานอื่น และจัดการหลังบ้านทั้งหมดได้
                                </p>
                              </div>
                            </div>

                            <span
                              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                                officerIsAdmin
                                  ? "bg-gradient-to-r from-indigo-500 to-cyan-500"
                                  : "bg-slate-300 dark:bg-white/20"
                              }`}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                                  officerIsAdmin ? "translate-x-6" : "translate-x-1"
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                            จังหวัดประจำตัว
                          </label>
                          <div className="relative">
                            <JKIcon
                              name="location-dot"
                              className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                            <select
                              value={citizenProvince}
                              onChange={(e) => setCitizenProvince(e.target.value)}
                              className="w-full h-11 appearance-none pl-10 pr-9 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:border-emerald-400/70 focus:ring-2 focus:ring-emerald-500/20 transition cursor-pointer"
                            >
                              {CITIES.map((city) => {
                                const province = getProvinceName(city);
                                return (
                                  <option key={city.id} value={province}>
                                    {province}
                                  </option>
                                );
                              })}
                            </select>
                            <JKIcon
                              name="chevron-down"
                              className="text-slate-400 text-[11px] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                            />
                          </div>
                        </div>
                      )}

                      {/* Avatar Preset Tiles */}
                      <div>
                        <span className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-2">
                          เลือกอวตารประจำตัว
                        </span>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                          {(accountType === "officer"
                            ? OFFICER_AVATAR_POSES
                            : CITIZEN_AVATAR_POSES
                          ).map((pose) => {
                            const selected = userAvatarPose === pose.src;
                            return (
                              <button
                                key={pose.id}
                                type="button"
                                onClick={() => setUserAvatarPose(pose.src)}
                                className={`relative flex items-center gap-2.5 p-2.5 rounded-2xl border text-left transition-all cursor-pointer ${
                                  selected
                                    ? accountType === "officer"
                                      ? "bg-indigo-500/15 border-indigo-500/60 text-indigo-700 dark:text-cyan-200 shadow-sm shadow-indigo-500/15"
                                      : "bg-emerald-500/15 border-emerald-500/60 text-emerald-700 dark:text-emerald-200 shadow-sm shadow-emerald-500/15"
                                    : "bg-white/75 dark:bg-slate-950/50 border-slate-200/80 dark:border-white/[0.08] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/20"
                                }`}
                              >
                                <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-white/[0.06] p-1 flex items-center justify-center shrink-0">
                                  <img
                                    src={pose.src}
                                    alt={pose.label}
                                    className="w-full h-full object-contain"
                                  />
                                </div>
                                <span className="text-[11px] font-bold truncate">{pose.label}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Right 4 Columns: Live Smart ID Card Preview + Submit */}
                    <div className="xl:col-span-4 flex flex-col justify-between gap-4 rounded-[26px] p-5 border border-slate-200/80 dark:border-white/[0.12] bg-gradient-to-br from-slate-100/90 via-white/80 to-indigo-50/70 dark:from-slate-900/90 dark:via-slate-950/85 dark:to-indigo-950/60 shadow-inner">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            ตัวอย่างบัตรประจำตัวดิจิทัล
                          </span>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${
                              accountType === "citizen"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : officerIsAdmin
                                ? "bg-indigo-500/20 text-indigo-700 dark:text-indigo-200 border border-indigo-400/40"
                                : "bg-sky-500/15 text-sky-700 dark:text-cyan-300 border border-sky-400/30"
                            }`}
                          >
                            {accountType === "citizen"
                              ? "CITIZEN"
                              : officerIsAdmin
                              ? "ADMIN"
                              : "OFFICER"}
                          </span>
                        </div>

                        <div className="p-4 rounded-2xl bg-white/85 dark:bg-black/40 border border-white dark:border-white/[0.08] space-y-3.5">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-14 h-14 rounded-2xl p-1.5 flex items-center justify-center shrink-0 border ${
                                accountType === "citizen"
                                  ? "bg-emerald-500/12 border-emerald-400/35"
                                  : "bg-sky-500/12 border-sky-400/35"
                              }`}
                            >
                              <img
                                src={userAvatarPose}
                                alt="ตัวอย่างอวตาร"
                                className="w-full h-full object-contain"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-900 dark:text-white truncate">
                                {userName.trim() || "ชื่อผู้ใช้งานใหม่"}
                              </p>
                              <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-300 truncate">
                                {accountType === "officer"
                                  ? officerRole.trim() || "ตำแหน่งปฏิบัติการ"
                                  : `จังหวัด ${citizenProvince}`}
                              </p>
                              <span className="inline-block mt-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-white/[0.08] text-[10px] font-mono font-bold text-slate-600 dark:text-cyan-300">
                                {accountType === "officer"
                                  ? officerBadgeCode.trim().toUpperCase() || "USR-AUTO"
                                  : "CITIZEN-PASS"}
                              </span>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-slate-200/70 dark:border-white/[0.08] space-y-1.5 text-[11px]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400">อีเมลเข้าสู่ระบบ</span>
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                                {userEmail.trim() || "user@citypulse.go.th"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-slate-400">
                                {accountType === "officer" ? "สังกัดหน่วยงาน" : "สิทธิ์การใช้งาน"}
                              </span>
                              <span className="font-bold text-slate-700 dark:text-slate-200 truncate max-w-[180px]">
                                {accountType === "officer"
                                  ? officerDepartmentId === "all"
                                    ? "ศูนย์ปฏิบัติการกลาง"
                                    : departments.find((d) => d.id === officerDepartmentId)
                                        ?.code ?? officerDepartmentId
                                  : "แจ้งเหตุ · โหวต · สะสม XP"}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className={`w-full h-11 px-5 rounded-2xl text-white text-xs font-black shadow-lg transition-all cursor-pointer inline-flex items-center justify-center gap-2 active:scale-[0.99] ${
                          accountType === "officer"
                            ? "bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 hover:brightness-110 shadow-sky-500/25"
                            : "bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 shadow-emerald-500/25"
                        }`}
                      >
                        <JKIcon name="plus" className="text-xs" />
                        <span>
                          {accountType === "officer"
                            ? "สร้างรหัสเจ้าหน้าที่ / Admin"
                            : "สร้างรหัสสมาชิกพลเมือง"}
                        </span>
                      </button>
                    </div>
                  </div>
                </form>
              )}
            </div>

            {/* Unified User Management & Control Table */}
            <div className={`lg:col-span-12 rounded-[30px] p-5 sm:p-6 space-y-5 ${iosCardClass}`}>
              {/* Table Header + Filter Bar */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20 shrink-0">
                    <JKIcon name="users" className="text-sm" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-black text-slate-900 dark:text-white">
                        ตารางควบคุมดูแลผู้ใช้งานทั้งหมด ({userTableCounts.all})
                      </h2>
                      <span className="px-2.5 py-0.5 rounded-full bg-amber-500/12 border border-amber-500/25 text-[10px] font-mono font-bold text-amber-700 dark:text-amber-300">
                        Super Admin: admin@citypulse.go.th
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      ค้นหา กรองสิทธิ์ ปรับระดับ Admin รีเซ็ตรหัสผ่าน ระงับใช้งาน หรือลบบัญชีที่สร้างโดย Admin
                    </p>
                  </div>
                </div>

                {/* Search Input */}
                <div className="relative w-full lg:w-72">
                  <JKIcon
                    name="search"
                    className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    type="search"
                    value={userTableSearch}
                    onChange={(e) => setUserTableSearch(e.target.value)}
                    placeholder="ค้นหาชื่อ, อีเมล, รหัส, ตำแหน่ง..."
                    className="w-full h-10 pl-9 pr-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.1] bg-white/90 dark:bg-slate-950/60 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>
              </div>

              {/* Filter Chips */}
              <div className="flex flex-wrap items-center gap-2">
                {(
                  [
                    { id: "all", label: `ทั้งหมด (${userTableCounts.all})` },
                    { id: "officer", label: `เจ้าหน้าที่ (${userTableCounts.officer})` },
                    { id: "citizen", label: `สมาชิกพลเมือง (${userTableCounts.citizen})` },
                    { id: "admin", label: `สิทธิ์ Admin (${userTableCounts.admin})` },
                    { id: "suspended", label: `ถูกระงับ (${userTableCounts.suspended})` },
                  ] as const
                ).map((chip) => {
                  const active = userTableFilter === chip.id;
                  return (
                    <button
                      key={chip.id}
                      type="button"
                      onClick={() => setUserTableFilter(chip.id)}
                      className={`px-3.5 py-1.5 rounded-full text-[11px] font-black transition cursor-pointer border ${
                        active
                          ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-sm"
                          : "bg-white/75 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.1] text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-white/25"
                      }`}
                    >
                      {chip.label}
                    </button>
                  );
                })}
              </div>

              {/* Responsive Control Table */}
              <div className="rounded-2xl border border-slate-200/80 dark:border-white/[0.1] bg-white/75 dark:bg-slate-950/50 shadow-inner overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200/80 dark:border-white/[0.08] bg-slate-100/90 dark:bg-white/[0.04] text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        <th className="py-3.5 px-4 whitespace-nowrap">ผู้ใช้งาน / รหัส</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">บทบาท &amp; สิทธิ์โมดูล</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">อีเมล &amp; สังกัด</th>
                        <th className="py-3.5 px-3 whitespace-nowrap">สถานะ</th>
                        <th className="py-3.5 px-4 text-right whitespace-nowrap">ควบคุมดูแล</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                      {filteredUserRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={5}
                            className="py-10 px-4 text-center text-xs font-bold text-slate-500 dark:text-slate-400"
                          >
                            ไม่พบบัญชีผู้ใช้งานที่ตรงกับเงื่อนไขการค้นหา
                          </td>
                        </tr>
                      ) : (
                        filteredUserRows.map((row) => {
                          const isSuspended = row.status === "suspended";
                          const isProtectedRoot = row.kind === "officer" && row.id === "sys-admin-01";
                          const canManagePermissions = isCurrentUserAdmin && row.kind === "officer";
                          const canResetPassword = isCurrentUserAdmin;
                          const canToggleSuspend =
                            isCurrentUserAdmin && !isProtectedRoot && !row.isCurrentUser;
                          const canDeleteRow =
                            isCurrentUserAdmin && row.isCustom && !row.isCurrentUser;

                          return (
                            <tr
                              key={`${row.kind}-${row.id}`}
                              className={`align-middle transition-colors ${
                                row.isCurrentUser
                                  ? "bg-emerald-500/[0.06] dark:bg-emerald-500/[0.08]"
                                  : isSuspended
                                  ? "bg-rose-500/[0.04] opacity-85"
                                  : "hover:bg-slate-50/90 dark:hover:bg-white/[0.03]"
                              }`}
                            >
                              {/* User + Avatar + Badge */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="relative shrink-0">
                                    <div
                                      className={`w-10 h-10 rounded-2xl p-1 flex items-center justify-center border shadow-xs ${
                                        row.kind === "citizen"
                                          ? "bg-emerald-500/12 border-emerald-400/30"
                                          : row.isAdmin
                                          ? "bg-indigo-500/12 border-indigo-400/30"
                                          : "bg-sky-500/12 border-sky-400/30"
                                      }`}
                                    >
                                      <img
                                        src={row.avatarPose}
                                        alt={row.name}
                                        className="w-full h-full object-contain"
                                      />
                                    </div>
                                    <span
                                      className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-white dark:ring-slate-900 ${
                                        isSuspended ? "bg-rose-500" : "bg-emerald-500"
                                      }`}
                                    />
                                  </div>

                                  <div className="min-w-0 space-y-0.5">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="text-[13px] font-black text-slate-900 dark:text-white truncate max-w-[220px]">
                                        {row.name}
                                      </span>
                                      {row.isCurrentUser && (
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[9px] font-black whitespace-nowrap">
                                          กำลังใช้งาน
                                        </span>
                                      )}
                                      {row.mustChangePassword && (
                                        <span className="px-2 py-0.5 rounded-full bg-amber-500/18 text-amber-700 dark:text-amber-300 text-[9px] font-black whitespace-nowrap">
                                          ต้องเปลี่ยนรหัส
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="px-1.5 py-0.5 rounded-md bg-sky-500/12 text-sky-700 dark:text-cyan-300 text-[10px] font-mono font-bold whitespace-nowrap">
                                        {row.badgeOrTag}
                                      </span>
                                      <span
                                        className={`text-[10px] font-semibold whitespace-nowrap ${
                                          row.isCustom
                                            ? "text-amber-600 dark:text-amber-300"
                                            : "text-slate-400 dark:text-slate-500"
                                        }`}
                                      >
                                        {row.createdLabel}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Type, Role & Single-Row Compact Permission Strip */}
                              <td className="py-3.5 px-3">
                                <div className="space-y-1.5">
                                  <div className="flex items-center gap-1.5">
                                    {row.kind === "citizen" ? (
                                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black whitespace-nowrap shrink-0">
                                        CITIZEN
                                      </span>
                                    ) : row.isAdmin ? (
                                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/18 text-indigo-700 dark:text-indigo-200 text-[9px] font-black whitespace-nowrap shrink-0">
                                        {row.id === "sys-admin-01" ? "SUPER ADMIN" : "ADMIN"}
                                      </span>
                                    ) : (
                                      <span className="px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-cyan-300 text-[9px] font-black whitespace-nowrap shrink-0">
                                        OFFICER
                                      </span>
                                    )}
                                    {row.isCustom && row.kind === "officer" && (
                                      <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black whitespace-nowrap shrink-0">
                                        Admin สร้าง
                                      </span>
                                    )}
                                    <span className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[200px]">
                                      {row.roleOrProvince}
                                    </span>
                                  </div>

                                  {row.permissions && (
                                    <div className="inline-flex items-center gap-1 whitespace-nowrap">
                                      {[
                                        { ok: row.permissions.accessDispatch, label: "ศูนย์ฯ" },
                                        { ok: row.permissions.manageCases, label: "เคส" },
                                        { ok: row.permissions.managePolls, label: "โพล" },
                                        { ok: row.permissions.manageSystem, label: "ระบบ" },
                                        { ok: row.permissions.manageUsers, label: "ผู้ใช้" },
                                      ].map((permChip) => (
                                        <span
                                          key={permChip.label}
                                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-bold border whitespace-nowrap ${
                                            permChip.ok
                                              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                                              : "bg-slate-100/80 dark:bg-white/[0.03] border-slate-200/70 dark:border-white/[0.06] text-slate-400 dark:text-slate-500 opacity-65"
                                          }`}
                                        >
                                          <span
                                            className={`w-1 h-1 rounded-full ${
                                              permChip.ok ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600"
                                            }`}
                                          />
                                          <span>{permChip.label}</span>
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>

                              {/* Email & Department */}
                              <td className="py-3.5 px-3">
                                <p className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-200 truncate max-w-[220px]">
                                  {row.email}
                                </p>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[220px]">
                                  {row.scopeLabel}
                                </p>
                                {row.passwordUpdatedAt && (
                                  <p className="text-[10px] font-medium text-sky-600 dark:text-cyan-400 truncate">
                                    รีเซ็ตรหัสล่าสุด: {row.passwordUpdatedAt}
                                  </p>
                                )}
                              </td>

                              {/* Status */}
                              <td className="py-3.5 px-3 whitespace-nowrap">
                                <span
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black whitespace-nowrap border ${
                                    isSuspended
                                      ? "bg-rose-500/12 border-rose-500/25 text-rose-700 dark:text-rose-300"
                                      : "bg-emerald-500/12 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                                  }`}
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                      isSuspended ? "bg-rose-500" : "bg-emerald-500"
                                    }`}
                                  />
                                  <span>{isSuspended ? "ระงับชั่วคราว" : "ใช้งานปกติ"}</span>
                                </span>
                              </td>

                              {/* Single-Line Actions */}
                              <td className="py-3.5 px-4 whitespace-nowrap">
                                <div className="inline-flex items-center justify-end gap-1.5 flex-nowrap whitespace-nowrap w-full">
                                  {!isCurrentUserAdmin ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/[0.06] text-[10px] font-bold text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                      <JKIcon name="lock" className="text-[9px]" />
                                      <span>เฉพาะ Admin</span>
                                    </span>
                                  ) : (
                                    <>
                                      {canManagePermissions && (
                                        <button
                                          type="button"
                                          onClick={() => handleOpenPermissionsModal(row)}
                                          title="ควบคุมสิทธิ์การใช้งาน"
                                          className="h-8 px-2.5 rounded-xl border border-indigo-500/25 bg-indigo-500/10 hover:bg-indigo-600 text-indigo-700 dark:text-indigo-200 hover:text-white hover:border-transparent text-[10px] font-black transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                                        >
                                          <JKIcon name="user-gear" className="text-[10px]" />
                                          <span>สิทธิ์ใช้งาน</span>
                                        </button>
                                      )}

                                      {canResetPassword && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleOpenResetPassword(
                                              row.kind,
                                              row.id,
                                              row.name,
                                              row.email
                                            )
                                          }
                                          title="รีเซ็ตรหัสผ่าน"
                                          className="h-8 px-2.5 rounded-xl border border-sky-500/25 bg-sky-500/10 hover:bg-sky-500 text-sky-700 dark:text-cyan-300 hover:text-white hover:border-transparent text-[10px] font-black transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                                        >
                                          <JKIcon name="key" className="text-[10px]" />
                                          <span>รีเซ็ตรหัส</span>
                                        </button>
                                      )}

                                      {canToggleSuspend && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleUserStatus(
                                              row.kind,
                                              row.id,
                                              row.name,
                                              row.status
                                            )
                                          }
                                          title={
                                            isSuspended ? "เปิดใช้งานบัญชีอีกครั้ง" : "ระงับใช้งานชั่วคราว"
                                          }
                                          className={`h-8 px-2.5 rounded-xl border text-[10px] font-black transition cursor-pointer inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                                            isSuspended
                                              ? "border-emerald-500/25 bg-emerald-500/12 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white hover:border-transparent"
                                              : "border-amber-500/25 bg-amber-500/12 hover:bg-amber-500 text-amber-700 dark:text-amber-300 hover:text-white hover:border-transparent"
                                          }`}
                                        >
                                          <JKIcon
                                            name={isSuspended ? "unlock" : "ban"}
                                            className="text-[10px]"
                                          />
                                          <span>{isSuspended ? "ปลดระงับ" : "ระงับ"}</span>
                                        </button>
                                      )}

                                      {canDeleteRow && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            row.kind === "officer"
                                              ? handleDeleteCustomOfficer(row.id, row.name)
                                              : handleDeleteCitizenAccount(row.id, row.name)
                                          }
                                          title="ลบบัญชีนี้"
                                          className="w-8 h-8 rounded-xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500 text-rose-600 dark:text-rose-300 hover:text-white hover:border-transparent transition cursor-pointer inline-flex items-center justify-center shrink-0"
                                        >
                                          <JKIcon name="trash" className="text-xs" />
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* API Health Probe */}
            <div className={`lg:col-span-12 rounded-[28px] p-5 sm:p-6 space-y-4 ${iosCardClass}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-black flex items-center gap-2">
                    <JKIcon name="server" className="text-sky-500" />
                    <span>ตรวจสอบสถานะ API &amp; Service Worker</span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    ทดสอบการตอบสนองของ Endpoint จริงในระบบ
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isProbing}
                  onClick={handleRunDiagnostics}
                  className="px-4 py-2 rounded-2xl bg-sky-600 hover:bg-sky-500 disabled:opacity-60 text-white text-xs font-black transition cursor-pointer flex items-center gap-1.5 shrink-0"
                >
                  <JKIcon
                    name="rotate-right"
                    className={`text-xs ${isProbing ? "animate-spin" : ""}`}
                  />
                  <span>{isProbing ? "กำลังทดสอบ..." : "ทดสอบระบบ"}</span>
                </button>
              </div>

              {diagResults.length === 0 ? (
                <div className={`p-6 rounded-2xl text-center ${iosInnerTileClass}`}>
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    กดปุ่ม &quot;ทดสอบระบบ&quot; เพื่อตรวจเช็กความพร้อมของ API และ PWA Service Worker
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {diagResults.map((res) => (
                    <div
                      key={res.id}
                      className={`p-3.5 rounded-2xl flex items-center justify-between gap-3 ${iosInnerTileClass}`}
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-black truncate">{res.label}</p>
                        <p className="text-[11px] font-mono text-slate-500 dark:text-slate-400 truncate">
                          {res.endpoint} · {res.detail}
                        </p>
                      </div>
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase shrink-0 ${
                          res.status === "ok"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                            : res.status === "warn"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                            : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {res.httpCode ? `HTTP ${res.httpCode}` : res.status.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Reset User Password Modal */}
      {resetTarget && (
        <div
          onClick={() => setResetTarget(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
        >
          <form
            onSubmit={handleSubmitResetPassword}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[28px] p-6 space-y-4 ${iosCardClass} bg-white dark:bg-slate-900`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
                <JKIcon name="key" className="text-base" />
              </div>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  ตั้งรหัสผ่านใหม่สำหรับผู้ใช้งาน
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                  {resetTarget.name} ({resetTarget.email})
                </p>
              </div>
            </div>

            {resetPasswordError && (
              <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-500/35 text-xs font-bold text-rose-600 dark:text-rose-300">
                {resetPasswordError}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-[11px] font-black text-slate-600 dark:text-slate-300">
                  รหัสผ่านใหม่ ({resetTarget.kind === "officer" ? ">= 4 ตัว" : ">= 6 ตัว"})
                </label>
                <button
                  type="button"
                  onClick={handleGenerateResetPassword}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-sky-500/12 hover:bg-sky-500/20 text-[10px] font-black text-sky-600 dark:text-cyan-300 cursor-pointer"
                >
                  <JKIcon name="wand-magic-sparkles" className="text-[9px]" />
                  <span>สุ่มรหัสใหม่</span>
                </button>
              </div>
              <div className="relative">
                <JKIcon
                  name="lock"
                  className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type={showResetPassword ? "text" : "password"}
                  value={resetPasswordValue}
                  onChange={(e) => {
                    setResetPasswordValue(e.target.value);
                    setResetPasswordError(null);
                  }}
                  placeholder="กรอกรหัสผ่านใหม่"
                  required
                  autoFocus
                  className="w-full h-11 pl-10 pr-10 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-500/25"
                />
                <button
                  type="button"
                  onClick={() => setShowResetPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                >
                  <JKIcon name={showResetPassword ? "eye-slash" : "eye"} className="text-xs" />
                </button>
              </div>
            </div>

            {resetTarget.kind === "officer" && (
              <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 cursor-pointer">
                <input
                  type="checkbox"
                  checked={resetMustChangePassword}
                  onChange={(e) => setResetMustChangePassword(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500 cursor-pointer shrink-0"
                />
                <span className="text-[11px] font-bold text-amber-800 dark:text-amber-200">
                  บังคับให้ผู้ใช้ตั้งรหัสผ่านใหม่ด้วยตนเองในการเข้าสู่ระบบครั้งถัดไป
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetTarget(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${iosInnerTileClass}`}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black cursor-pointer transition"
              >
                บันทึกรหัสผ่านใหม่
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Granular Permissions Control Modal */}
      {permTarget && draftPerms && (
        <div
          onClick={() => {
            setPermTarget(null);
            setDraftPerms(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
        >
          <form
            onSubmit={handleSavePermissions}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-xl rounded-[28px] p-6 space-y-5 ${iosCardClass} bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-indigo-500/15 text-indigo-500 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <JKIcon name="user-gear" className="text-base" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    ควบคุมสิทธิ์การใช้งาน (Access Permissions Control)
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 truncate">
                    {permTarget.name} · <span className="font-mono">{permTarget.email}</span>
                  </p>
                </div>
              </div>
              {permTarget.isProtectedRoot && (
                <span className="px-2.5 py-1 rounded-full bg-indigo-500/15 text-indigo-700 dark:text-indigo-200 text-[10px] font-black shrink-0">
                  Root Protected
                </span>
              )}
            </div>

            {/* Role & Department */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                  ตำแหน่ง / บทบาท
                </label>
                <input
                  type="text"
                  value={draftPermRole}
                  onChange={(e) => setDraftPermRole(e.target.value)}
                  className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-semibold text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300">
                    ขอบเขตหน่วยงาน
                  </label>
                  {!permTarget.isProtectedRoot && (
                    <button
                      type="button"
                      onClick={() => openAddDepartmentModal("permissions")}
                      className="inline-flex items-center gap-1 text-[10px] font-black text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer"
                    >
                      <JKIcon name="plus" className="text-[9px]" />
                      <span>เพิ่มหน่วยงานใหม่</span>
                    </button>
                  )}
                </div>
                <select
                  value={draftPermDept}
                  onChange={(e) => setDraftPermDept(e.target.value)}
                  disabled={permTarget.isProtectedRoot}
                  className="w-full h-10 px-3 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-bold text-slate-900 dark:text-white disabled:opacity-60"
                >
                  <option value="all">ทุกหน่วยงาน (ศูนย์ปฏิบัติการกลาง 77 จังหวัด)</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.code} · {dept.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Presets */}
            {!permTarget.isProtectedRoot && (
              <div className="space-y-1.5">
                <span className="block text-[11px] font-black text-slate-500 dark:text-slate-400">
                  ชุดสิทธิ์สำเร็จรูป (Quick Role Presets)
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {OFFICER_PERMISSION_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraftPerms({ ...preset.permissions })}
                      className="p-2.5 rounded-2xl border border-slate-200/80 dark:border-white/[0.1] bg-slate-100/70 dark:bg-white/[0.04] hover:border-indigo-400/60 hover:bg-indigo-500/10 text-left text-[11px] font-bold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Granular Permission Switches */}
            <div className="space-y-2">
              <span className="block text-[11px] font-black text-slate-500 dark:text-slate-400">
                สิทธิ์เข้าถึงแต่ละโมดูล (Granular Permissions)
              </span>
              {OFFICER_PERMISSION_ITEMS.map((item) => {
                const enabled = draftPerms[item.key];
                const disabled = permTarget.isProtectedRoot;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    disabled={disabled}
                    onClick={() =>
                      setDraftPerms((prev) =>
                        prev ? { ...prev, [item.key]: !prev[item.key] } : prev
                      )
                    }
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition ${
                      disabled ? "opacity-75 cursor-not-allowed" : "cursor-pointer"
                    } ${
                      enabled
                        ? "bg-indigo-500/10 border-indigo-500/40"
                        : "bg-slate-100/70 dark:bg-slate-950/45 border-slate-200/80 dark:border-white/[0.08]"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          enabled
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-200 dark:bg-white/10 text-slate-500"
                        }`}
                      >
                        <JKIcon name={item.icon} className="text-xs" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {item.label}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
                        enabled ? "bg-indigo-600" : "bg-slate-300 dark:bg-white/20"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                          enabled ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setPermTarget(null);
                  setDraftPerms(null);
                }}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${iosInnerTileClass}`}
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer transition"
              >
                บันทึกสิทธิ์การใช้งาน
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add / Manage Custom Departments Modal */}
      {isDeptModalOpen && (
        <div
          onClick={() => setIsDeptModalOpen(false)}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-lg rounded-[28px] p-6 space-y-5 ${iosCardClass} bg-white dark:bg-slate-900 max-h-[90vh] overflow-y-auto`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-500/15 text-sky-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
                  <JKIcon name="building" className="text-base" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 dark:text-white">
                    เพิ่ม / จัดการหน่วยงานสังกัด
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    หน่วยงานที่สร้างจะใช้ได้ทันทีทั้งในหน้าผู้ใช้งาน ศูนย์สั่งการ และแผนภูมิสถิติ
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsDeptModalOpen(false)}
                aria-label="ปิดหน้าต่าง"
                className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition cursor-pointer"
              >
                <JKIcon name="xmark" className="text-sm" />
              </button>
            </div>

            <form onSubmit={handleCreateDepartment} className="space-y-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    ชื่อหน่วยงาน *
                  </label>
                  <input
                    type="text"
                    value={deptName}
                    onChange={(e) => setDeptName(e.target.value)}
                    placeholder="เช่น สำนักดิจิทัลและนวัตกรรมเมือง"
                    required
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    รหัสหน่วยงาน *
                  </label>
                  <input
                    type="text"
                    value={deptCode}
                    onChange={(e) => setDeptCode(e.target.value.toUpperCase())}
                    placeholder="DEPT-DIGI"
                    required
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-mono font-bold uppercase text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    หัวหน้าหน่วยงาน
                  </label>
                  <input
                    type="text"
                    value={deptHeadOfficer}
                    onChange={(e) => setDeptHeadOfficer(e.target.value)}
                    placeholder="เช่น ผอ.วรัญญา นวัตกรรม"
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    SLA มาตรฐาน (ชม.)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={deptSlaHours}
                    onChange={(e) => setDeptSlaHours(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-mono font-bold text-slate-900 dark:text-white focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    เบอร์ติดต่อหน่วยงาน
                  </label>
                  <input
                    type="text"
                    value={deptPhone}
                    onChange={(e) => setDeptPhone(e.target.value)}
                    placeholder="02-000-0000"
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1">
                    อีเมลติดต่อ
                  </label>
                  <input
                    type="email"
                    value={deptEmail}
                    onChange={(e) => setDeptEmail(e.target.value)}
                    placeholder="dept@citypulse.go.th"
                    className="w-full h-10 px-3.5 rounded-2xl border border-slate-200/90 dark:border-white/[0.12] bg-slate-100/80 dark:bg-slate-950/70 text-xs font-semibold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-sky-400/70 focus:ring-2 focus:ring-sky-500/20"
                  />
                </div>
              </div>

              <div>
                <span className="block text-[11px] font-black text-slate-600 dark:text-slate-300 mb-1.5">
                  สีประจำหน่วยงาน
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  {DEPARTMENT_COLOR_PRESETS.map((hex) => {
                    const selected = deptColor === hex;
                    return (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => setDeptColor(hex)}
                        aria-label={`เลือกสี ${hex}`}
                        className={`w-7 h-7 rounded-full transition cursor-pointer flex items-center justify-center ${
                          selected ? "ring-2 ring-offset-2 ring-sky-500 dark:ring-offset-slate-900 scale-110" : "opacity-80 hover:opacity-100"
                        }`}
                        style={{ backgroundColor: hex }}
                      >
                        {selected && <JKIcon name="check" className="text-[10px] text-white" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {deptFormError && (
                <div className="rounded-2xl border border-rose-500/35 bg-rose-500/10 px-3.5 py-2.5 text-xs font-bold text-rose-600 dark:text-rose-300">
                  {deptFormError}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsDeptModalOpen(false)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${iosInnerTileClass}`}
                >
                  ปิดหน้าต่าง
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-sky-500 to-cyan-500 hover:brightness-110 text-white text-xs font-black cursor-pointer transition inline-flex items-center gap-1.5"
                >
                  <JKIcon name="plus" className="text-[11px]" />
                  <span>บันทึกหน่วยงานใหม่</span>
                </button>
              </div>
            </form>

            {/* Custom Departments List */}
            <div className="pt-3 border-t border-slate-200/80 dark:border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-black text-slate-500 dark:text-slate-400">
                <span>หน่วยงานที่ผู้ดูแลสร้างเพิ่มเติม</span>
                <span className="font-mono">
                  {departments.filter((d) => !isBuiltInDepartment(d.id)).length} แห่ง
                </span>
              </div>
              {departments.filter((d) => !isBuiltInDepartment(d.id)).length === 0 ? (
                <p className="text-[11px] text-slate-400 dark:text-slate-500 py-2">
                  ยังไม่มีหน่วยงานเพิ่มเติม (ใช้หน่วยงานหลักของระบบ {departments.length} แห่ง)
                </p>
              ) : (
                <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                  {departments
                    .filter((d) => !isBuiltInDepartment(d.id))
                    .map((d) => (
                      <div
                        key={d.id}
                        className={`flex items-center justify-between gap-2 px-3 py-2 rounded-2xl ${iosInnerTileClass}`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: d.color }}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                              <span className="font-mono text-sky-600 dark:text-cyan-400 mr-1.5">
                                {d.code}
                              </span>
                              {d.name}
                            </p>
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                              SLA {d.slaHours} ชม. · {d.headOfficer}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDeleteDepartment(d.id, `${d.code} · ${d.name}`)}
                          aria-label={`ลบ ${d.name}`}
                          className="px-2.5 py-1 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-[11px] font-bold inline-flex items-center gap-1 shrink-0 cursor-pointer transition"
                        >
                          <JKIcon name="trash" className="text-[10px]" />
                          <span>ลบ</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Confirm Danger Action Modal */}
      {confirmAction && (
        <div
          onClick={() => setConfirmAction(null)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-[28px] p-6 space-y-4 ${iosCardClass} bg-white dark:bg-slate-900`}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-500 flex items-center justify-center shrink-0">
                <JKIcon name="exclamation-triangle" className="text-lg" />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">
                  {confirmAction.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                  {confirmAction.message}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className={`px-4 py-2 rounded-xl text-xs font-bold cursor-pointer ${iosInnerTileClass}`}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={confirmAction.onConfirm}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-black cursor-pointer transition"
              >
                ยืนยันดำเนินการ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

