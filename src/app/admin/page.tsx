"use client";

import React, { useState, useMemo, useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  PROVINCE_GROUPS,
  THAILAND_PROVINCES,
  THAILAND_REGIONS,
  INITIAL_COMPLAINTS,
  inferProvinceFromCoord,
  type ComplaintReport,
  type ComplaintStatus,
} from "@/data/map-data";
import {
  getAllDepartmentsSnapshot,
  getServerDepartmentsSnapshot,
  subscribeDepartments,
} from "@/lib/departments-store";
import {
  THAILAND_DISTRICTS_BY_PROVINCE,
  districtsMatch,
  getDistrictsForProvince,
  normalizeDistrictKey,
} from "@/data/thailand-districts";
import {
  getComplaintsSnapshot,
  getIsDarkSnapshot,
  getMapStyleSnapshot,
  writeComplaintsStore,
  resetComplaintsStore,
  subscribeStorageSync,
  subscribeThemeSync,
  subscribePopState,
  toggleThemeStore,
  getUrlSearchParamSnapshot,
} from "@/lib/civic-store";
import { type MapStyleKey } from "@/components/map/MapHeader";
import {
  clearOfficerSession,
  getOfficerSessionSnapshot,
  hasOfficerPermission,
  subscribeOfficerSession,
} from "@/lib/officer-auth";
import { AdminCaseModal } from "@/components/admin/AdminCaseModal";
import { AdminAnalyticsCharts } from "@/components/admin/AdminAnalyticsCharts";

type AdminTabKey = "cases" | "departments" | "provinces";

const centralReportId = (id: string) => /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id);

const getServerComplaintsSnapshot = () => INITIAL_COMPLAINTS;
const getServerNullSnapshot = () => null;
const getUrlCaseSnapshot = () => getUrlSearchParamSnapshot("case");
const emptySubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;
const serverVoyager = (): MapStyleKey => "voyager";

export default function AdminPage() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);
  const isDark = useSyncExternalStore(subscribeThemeSync, getIsDarkSnapshot, serverFalse);
  const currentStyle = useSyncExternalStore(
    subscribeThemeSync,
    getMapStyleSnapshot,
    serverVoyager,
  );
  const session = useSyncExternalStore(
    subscribeOfficerSession,
    getOfficerSessionSnapshot,
    getServerNullSnapshot,
  );

  useEffect(() => {
    if (!isHydrated || session) return;
    const currentPath =
      typeof window !== "undefined"
        ? window.location.pathname + window.location.search
        : "/admin";
    router.replace(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }, [isHydrated, session, router]);

  const localComplaints = useSyncExternalStore(
    subscribeStorageSync,
    getComplaintsSnapshot,
    getServerComplaintsSnapshot,
  );
  const [centralReports, setCentralReports] = useState<ComplaintReport[]>([]);
  const [centralError, setCentralError] = useState(false);
  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const response = await fetch("/api/admin/reports", { signal: controller.signal });
        if (!response.ok) throw new Error("Failed to load reports");
        const reports = await response.json();
        if (!controller.signal.aborted) {
          setCentralReports(reports);
          setCentralError(false);
        }
      } catch {
        if (!controller.signal.aborted) setCentralError(true);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [session]);
  const complaints = useMemo(
    () => [...centralReports, ...localComplaints.filter((report) => !centralReportId(report.id))],
    [centralReports, localComplaints],
  );
  const urlCaseId = useSyncExternalStore(
    subscribePopState,
    getUrlCaseSnapshot,
    getServerNullSnapshot,
  );
  const departments = useSyncExternalStore(
    subscribeDepartments,
    getAllDepartmentsSnapshot,
    getServerDepartmentsSnapshot,
  );

  const [activeTab, setActiveTab] = useState<AdminTabKey>("cases");

  // Filters
  const [deptOverride, setDeptOverride] = useState<string | null>(null);
  const selectedDeptId = deptOverride ?? session?.officer.departmentId ?? "all";
  const setSelectedDeptId = (nextDept: string) => setDeptOverride(nextDept);

  const [selectedProvince, setSelectedProvince] = useState<string>("all");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [isProvincePickerOpen, setIsProvincePickerOpen] = useState(false);
  const [pickerRegion, setPickerRegion] = useState<string>("all");
  const [pickerSearch, setPickerSearch] = useState<string>("");

  const [provinceRegionFilter, setProvinceRegionFilter] = useState<string>("all");
  const [provinceSearch, setProvinceSearch] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showCharts, setShowCharts] = useState<boolean>(true);

  const handleSelectProvince = (prov: string) => {
    setSelectedProvince(prov);
    setSelectedDistrict("all");
    setIsProvincePickerOpen(false);
  };

  const handleLogout = () => {
    clearOfficerSession();
    router.replace("/admin/login");
  };

  // Modal State
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [dismissedUrlCase, setDismissedUrlCase] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const effectiveCaseId = selectedCaseId ?? (dismissedUrlCase ? null : urlCaseId);
  const selectedCase = useMemo(
    () => (effectiveCaseId ? complaints.find((c) => c.id === effectiveCaseId) ?? null : null),
    [complaints, effectiveCaseId],
  );

  // Toast
  const [toastMsg, setToastMsg] = useState<{ text: string; sub?: string } | null>(null);

  const showToast = (text: string, sub?: string) => {
    setToastMsg({ text, sub });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const persistComplaints = (data: ComplaintReport[]) => {
    const ok = writeComplaintsStore(data.filter((report) => !centralReportId(report.id)));
    if (!ok) {
      showToast("พื้นที่จัดเก็บบนเบราว์เซอร์เต็ม", "แนะนำให้ลบรูปหรือรีเซ็ตข้อมูลตัวอย่าง");
    }
  };

  const updateCentralCase = async (updated: ComplaintReport) => {
    const response = await fetch("/api/admin/reports", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    }).catch(() => null);
    if (!response?.ok) {
      showToast("บันทึกฐานข้อมูลกลางไม่สำเร็จ กรุณาลองใหม่");
      return false;
    }
    const saved: ComplaintReport = await response.json();
    setCentralReports((reports) => reports.map((report) => report.id === saved.id ? saved : report));
    return true;
  };

  const handleSaveCase = async (updated: ComplaintReport) => {
    if (!hasOfficerPermission(session?.officer, "manageCases")) {
      showToast("ไม่มีสิทธิ์แก้ไขเคส", "บัญชีนี้อยู่ในโหมดอ่านอย่างเดียว กรุณาติดต่อ Admin");
      return;
    }
    const nextList = complaints.map((c) => (c.id === updated.id ? updated : c));
    if (centralReportId(updated.id)) {
      if (!(await updateCentralCase(updated))) return;
    } else {
      persistComplaints(nextList);
    }
    showToast(
      "บันทึกข้อมูลเรียบร้อยแล้ว",
      `ปรับปรุงข้อมูลเคส ${updated.id} และอัปเดตระบบแผนที่แล้ว`,
    );
  };

  const handleDeleteCase = async (caseId: string) => {
    if (!hasOfficerPermission(session?.officer, "manageCases")) {
      showToast("ไม่มีสิทธิ์ลบเคส", "บัญชีนี้อยู่ในโหมดอ่านอย่างเดียว กรุณาติดต่อ Admin");
      return;
    }
    const nextList = complaints.filter((c) => c.id !== caseId);
    if (centralReportId(caseId)) {
      const response = await fetch(`/api/admin/reports?id=${encodeURIComponent(caseId)}`, {
        method: "DELETE",
      }).catch(() => null);
      if (!response?.ok) {
        showToast("ลบจากฐานข้อมูลกลางไม่สำเร็จ กรุณาลองใหม่");
        return;
      }
      setCentralReports((reports) => reports.filter((report) => report.id !== caseId));
    } else {
      persistComplaints(nextList);
    }
    setSelectedCaseId(null);
    showToast("ลบเคสเรียบร้อยแล้ว", `นำรายการ ${caseId} ออกจากระบบแล้ว`);
  };

  // Case counts by province for the iOS Province Picker
  const provinceCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of complaints) {
      if (selectedDeptId !== "all" && c.departmentId !== selectedDeptId) continue;
      const prov = c.province || inferProvinceFromCoord(c.coordinates);
      map[prov] = (map[prov] ?? 0) + 1;
    }
    return map;
  }, [complaints, selectedDeptId]);

  // Complaint count per province + normalized district key (respects active department filter)
  const districtComplaintCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of complaints) {
      if (selectedDeptId !== "all" && c.departmentId !== selectedDeptId) continue;
      const prov = c.province || inferProvinceFromCoord(c.coordinates);
      const distKey = normalizeDistrictKey(c.district || "");
      if (!distKey) continue;
      const key = `${prov}::${distKey}`;
      map[key] = (map[key] ?? 0) + 1;
    }
    return map;
  }, [complaints, selectedDeptId]);

  // Available districts for selected province (official GIS dataset + any extra complaint areas)
  const availableDistrictGroups = useMemo(() => {
    const provincesToShow =
      selectedProvince === "all" ? THAILAND_PROVINCES : [selectedProvince];

    return provincesToShow.map((prov) => {
      const gisDistricts = getDistrictsForProvince(prov);
      const seenKeys = new Set(gisDistricts.map((d) => normalizeDistrictKey(d.displayTh)));
      const options = gisDistricts.map((d) => ({
        value: selectedProvince === "all" ? `${prov}::${d.displayTh}` : d.displayTh,
        label: d.displayTh,
        count: districtComplaintCountMap[`${prov}::${normalizeDistrictKey(d.displayTh)}`] ?? 0,
      }));

      for (const c of complaints) {
        const compProv = c.province || inferProvinceFromCoord(c.coordinates);
        if (compProv !== prov || !c.district) continue;
        const normKey = normalizeDistrictKey(c.district);
        if (!normKey || seenKeys.has(normKey)) continue;
        seenKeys.add(normKey);
        options.push({
          value: selectedProvince === "all" ? `${prov}::${c.district}` : c.district,
          label: c.district,
          count: districtComplaintCountMap[`${prov}::${normKey}`] ?? 0,
        });
      }

      return { province: prov, options };
    });
  }, [complaints, districtComplaintCountMap, selectedProvince]);

  const totalDistrictOptionCount = useMemo(
    () => availableDistrictGroups.reduce((sum, group) => sum + group.options.length, 0),
    [availableDistrictGroups],
  );

  // Scope-level complaints (province, district, department) for charts
  const scopedComplaints = useMemo(() => {
    return complaints.filter((c) => {
      const compProvince = c.province || inferProvinceFromCoord(c.coordinates);
      if (selectedDeptId !== "all" && c.departmentId !== selectedDeptId) return false;
      if (selectedProvince !== "all" && compProvince !== selectedProvince) return false;
      if (selectedDistrict !== "all") {
        if (selectedDistrict.includes("::")) {
          const [targetProv, targetDist] = selectedDistrict.split("::");
          if (compProvince !== targetProv || !districtsMatch(c.district, targetDist)) {
            return false;
          }
        } else if (!districtsMatch(c.district, selectedDistrict)) {
          return false;
        }
      }
      return true;
    });
  }, [complaints, selectedDeptId, selectedProvince, selectedDistrict]);

  // Filtered complaints for table
  const filteredComplaints = useMemo(() => {
    return scopedComplaints.filter((c) => {
      const compProvince = c.province || inferProvinceFromCoord(c.coordinates);
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.categoryId !== categoryFilter) return false;
      if (priorityFilter !== "all" && c.priority !== priorityFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = c.title.toLowerCase().includes(q);
        const matchDesc = c.description.toLowerCase().includes(q);
        const matchId = c.id.toLowerCase().includes(q);
        const matchReporter = c.reporterName.toLowerCase().includes(q);
        const matchOfficer = (c.assignedOfficer || "").toLowerCase().includes(q);
        const matchProv = compProvince.toLowerCase().includes(q);
        const matchDist = (c.district || "").toLowerCase().includes(q);
        if (
          !matchTitle &&
          !matchDesc &&
          !matchId &&
          !matchReporter &&
          !matchOfficer &&
          !matchProv &&
          !matchDist
        ) {
          return false;
        }
      }
      return true;
    });
  }, [
    scopedComplaints,
    statusFilter,
    categoryFilter,
    priorityFilter,
    searchQuery,
  ]);

  // KPI calculations
  const kpis = useMemo(() => {
    const total = filteredComplaints.length;
    const pending = filteredComplaints.filter((c) => c.status === "pending").length;
    const inprogress = filteredComplaints.filter((c) => c.status === "inprogress").length;
    const resolved = filteredComplaints.filter((c) => c.status === "resolved").length;
    const urgent = filteredComplaints.filter(
      (c) => c.priority === "urgent" || (c.upvotes ?? 0) >= 25,
    ).length;
    const resolutionRate = total > 0 ? Math.round((resolved / total) * 100) : 0;

    return { total, pending, inprogress, resolved, urgent, resolutionRate };
  }, [filteredComplaints]);

  const activeDepartmentMeta = useMemo(() => {
    if (selectedDeptId === "all") return null;
    return departments.find((d) => d.id === selectedDeptId) || null;
  }, [departments, selectedDeptId]);

  const pickerProvinces = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase();
    return PROVINCE_GROUPS.filter(
      (g) => pickerRegion === "all" || g.region === pickerRegion,
    )
      .flatMap((g) => g.provinces.map((name) => ({ name, region: g.region })))
      .filter((item) => (q ? item.name.toLowerCase().includes(q) : true));
  }, [pickerRegion, pickerSearch]);

  const handleExportCsv = () => {
    const headers = [
      "ID",
      "หัวข้อเรื่อง",
      "หมวดหมู่",
      "ความเร่งด่วน",
      "สถานะ",
      "จังหวัด",
      "เขต/อำเภอ",
      "หน่วยงาน",
      "เจ้าหน้าที่",
      "ผู้แจ้ง",
      "โหวต",
      "วันที่แจ้ง",
    ];
    const escapeCell = (val: string | number | undefined) => {
      const str = String(val ?? "");
      return `"${str.replace(/"/g, '""')}"`;
    };
    const rows = filteredComplaints.map((c) => {
      const cat = COMPLAINT_CATEGORIES.find((x) => x.id === c.categoryId)?.label ?? c.categoryId;
      const dept = departments.find((d) => d.id === c.departmentId)?.name ?? c.departmentId ?? "";
      const prov = c.province || inferProvinceFromCoord(c.coordinates);
      return [
        c.id,
        c.title,
        cat,
        c.priority ?? "medium",
        c.status,
        prov,
        c.district ?? "",
        dept,
        c.assignedOfficer ?? "",
        c.reporterName,
        c.upvotes ?? 0,
        c.createdAt,
      ]
        .map(escapeCell)
        .join(",");
    });
    const csvContent = "\uFEFF" + [headers.map(escapeCell).join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `citypulse-cases-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("ส่งออกไฟล์ CSV สำเร็จ", `ส่งออกทั้งหมด ${filteredComplaints.length} รายการ`);
  };

  const handleConfirmReset = () => {
    resetComplaintsStore();
    setIsResetModalOpen(false);
    setSelectedCaseId(null);
    showToast(
      "รีเซ็ตข้อมูลตัวอย่างแล้ว",
      `โหลดข้อมูลเริ่มต้น ${INITIAL_COMPLAINTS.length} รายการสำเร็จ`,
    );
  };

  const handleQuickStatusChange = async (
    caseId: string,
    nextStatus: ComplaintStatus,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();
    const target = complaints.find((c) => c.id === caseId);
    if (!target) return;

    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const timeStr = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const statusLabels: Record<ComplaintStatus, string> = {
      pending: "รอดำเนินการ",
      inprogress: "กำลังดำเนินการ",
      resolved: "แก้ไขแล้ว",
    };

    const statusIcons: Record<ComplaintStatus, string> = {
      pending: "clock",
      inprogress: "arrows-spin",
      resolved: "circle-check",
    };

    const updated: ComplaintReport = {
      ...target,
      status: nextStatus,
      timeline: [
        ...(target.timeline || []),
        {
          id: `quick-status-${now.getTime()}`,
          date: dateStr,
          time: timeStr,
          title: `ปรับสถานะเป็น "${statusLabels[nextStatus]}"`,
          description: "เจ้าหน้าที่ผู้รับผิดชอบปรับสถานะด่วนผ่านแผงควบคุมแอดมิน",
          status: nextStatus,
          officer: target.assignedOfficer || session?.officer.name || "เจ้าหน้าที่ดูแลระบบ",
          icon: statusIcons[nextStatus],
        },
      ],
    };

    const nextList = complaints.map((c) => (c.id === caseId ? updated : c));
    if (centralReportId(updated.id)) {
      if (!(await updateCentralCase(updated))) return;
    } else {
      persistComplaints(nextList);
    }
    showToast("เปลี่ยนสถานะสำเร็จ", `เคส ${caseId} เป็น "${statusLabels[nextStatus]}" แล้ว`);
  };

  // iOS Frosted Glass Surface Helpers
  const iosCardClass =
    "bg-white/82 dark:bg-white/[0.06] backdrop-blur-2xl border border-white/90 dark:border-white/[0.12] shadow-[0_12px_36px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]";

  const iosPillControlClass =
    "bg-slate-200/70 dark:bg-white/[0.09] border border-slate-300/60 dark:border-white/[0.14] text-slate-900 dark:text-white";

  if (!isHydrated || !session) {
    return (
      <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#050912] text-slate-900 dark:text-slate-100 flex flex-col items-center justify-center p-6 gap-4">
        <div className={`w-16 h-16 rounded-[22px] flex items-center justify-center p-2.5 ${iosCardClass}`}>
          <img src="/images/mascot.png" alt="Officer Auth" className="w-full h-full object-contain" />
        </div>
        <div className="text-center space-y-1">
          <h1 className="text-base font-black flex items-center justify-center gap-2">
            <JKIcon name="shield-halved" className="text-sky-500" />
            <span>กำลังตรวจสอบสิทธิ์เจ้าหน้าที่...</span>
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            กำลังนำทางไปยังหน้าเข้าสู่ระบบเจ้าหน้าที่
          </p>
        </div>
        <Link
          href="/admin/login"
          className="px-5 py-2.5 rounded-full bg-sky-500 hover:bg-sky-600 text-white text-xs font-black shadow-lg shadow-sky-500/25 transition active:scale-95"
        >
          ไปหน้าเข้าสู่ระบบเจ้าหน้าที่
        </Link>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#f2f2f7] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-sky-500/30">
      {/* Apple Ambient Mesh Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-32 w-[480px] h-[480px] rounded-full bg-sky-400/20 dark:bg-cyan-500/15 blur-[120px]" />
        <div className="absolute top-1/4 -right-32 w-[460px] h-[460px] rounded-full bg-indigo-400/15 dark:bg-blue-600/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[520px] h-[520px] rounded-full bg-emerald-400/15 dark:bg-teal-500/10 blur-[130px]" />
      </div>

      {/* iOS Translucent Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/75 dark:bg-[#0b1120]/75 backdrop-blur-2xl border-b border-slate-200/80 dark:border-white/[0.1] px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-3 shadow-[0_4px_24px_rgba(15,23,42,0.04)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.4)]">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-slate-200/75 dark:bg-white/[0.1] hover:bg-slate-300/80 dark:hover:bg-white/[0.18] text-slate-800 dark:text-white transition cursor-pointer active:scale-90 border border-white/80 dark:border-white/15 shadow-sm"
            title="กลับไปยังหน้าแผนที่ประชาชน"
          >
            <JKIcon name="arrow-left" className="text-sm" />
          </Link>

          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.7)]" />
              <h1 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                <span>CityPulse Admin</span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-cyan-300 border border-sky-500/25">
                  ศูนย์บริหารจัดการ 77 จังหวัด
                </span>
              </h1>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
              ระบบกำกับดูแลเรื่องร้องเรียนและส่งต่อหน่วยงานระดับประเทศ
            </p>
          </div>
        </div>

        {/* Right iOS Capsule Action Bar */}
        <div className="flex flex-wrap items-center gap-2">
          {(hasOfficerPermission(session.officer, "manageSystem") ||
            hasOfficerPermission(session.officer, "manageUsers") ||
            hasOfficerPermission(session.officer, "managePolls")) && (
            <Link
              href="/admin/system"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 text-xs font-black text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 transition cursor-pointer active:scale-95"
              title="ตั้งค่าระบบ จัดการฐานข้อมูล และตรวจสอบสถานะหลังบ้าน"
            >
              <JKIcon name="database" className="text-xs" />
              <span className="hidden sm:inline">ตั้งค่าระบบ & ฐานข้อมูล</span>
            </Link>
          )}

          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-black text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 transition cursor-pointer active:scale-95"
            title="ส่งออกข้อมูลที่กรองอยู่เป็นไฟล์ CSV"
          >
            <JKIcon name="file-csv" className="text-xs" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>

          {hasOfficerPermission(session.officer, "manageSystem") && (
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-rose-500/15 hover:bg-rose-500/25 text-xs font-black text-rose-700 dark:text-rose-300 border border-rose-500/30 transition cursor-pointer active:scale-95"
              title="ล้างข้อมูลที่แก้ไขกลับสู่ข้อมูลตัวอย่างเริ่มต้น"
            >
              <JKIcon name="rotate-left" className="text-xs" />
              <span className="hidden sm:inline">รีเซ็ต</span>
            </button>
          )}

          {/* iOS Segmented Light / Dark Mode Switch */}
          <div className="inline-flex items-center p-1 rounded-full bg-slate-200/80 dark:bg-white/[0.1] border border-white/80 dark:border-white/15 shadow-xs">
            <button
              type="button"
              onClick={() => toggleThemeStore(false, currentStyle)}
              aria-label="โหมดสว่าง (Light Mode)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition cursor-pointer ${
                !isDark
                  ? "bg-white text-amber-600 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <JKIcon name="sun" className="text-[10px]" />
              <span className="hidden sm:inline">สว่าง</span>
            </button>
            <button
              type="button"
              onClick={() => toggleThemeStore(true, currentStyle)}
              aria-label="โหมดมืด (Dark Mode)"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition cursor-pointer ${
                isDark
                  ? "bg-slate-800 text-cyan-300 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <JKIcon name="moon" className="text-[10px]" />
              <span className="hidden sm:inline">มืด</span>
            </button>
          </div>

          <Link
            href="/"
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 text-xs font-black transition cursor-pointer active:scale-95 shadow-md"
          >
            <JKIcon name="map" className="text-xs" />
            <span className="hidden md:inline">หน้าแผนที่</span>
          </Link>

          {/* Signed-in Officer Apple Pill */}
          <div className="flex items-center gap-2 pl-2 pr-1.5 py-1 rounded-full bg-slate-200/70 dark:bg-white/[0.08] border border-white/80 dark:border-white/15">
            <div className="w-7 h-7 rounded-full bg-amber-400/25 border border-amber-400/50 flex items-center justify-center p-0.5 flex-shrink-0">
              <img
                src={session.officer.avatarPose}
                alt={session.officer.name}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="hidden sm:block text-left pr-1">
              <p className="text-[11px] font-black leading-tight">{session.officer.name}</p>
              <p className="text-[9px] font-mono text-sky-600 dark:text-cyan-300 leading-tight">
                {session.officer.badgeCode}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="w-7 h-7 rounded-full bg-rose-500/15 hover:bg-rose-500 text-rose-600 dark:text-rose-300 hover:text-white flex items-center justify-center transition cursor-pointer active:scale-90"
              title="ออกจากระบบเจ้าหน้าที่"
              aria-label="ออกจากระบบเจ้าหน้าที่"
            >
              <JKIcon name="power-off" className="text-[11px]" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content (Full-Width Dashboard Canvas) */}
      <main className="relative z-10 flex-1 w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 space-y-4 sm:space-y-5">
        {/* iOS Control Center Filter & Navigation Deck */}
        <div className={`p-4 sm:p-5 rounded-[28px] flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-4 ${iosCardClass}`}>
          <div className="flex flex-wrap items-center gap-2.5">
            {/* iOS 77-Province Picker Button */}
            <button
              type="button"
              onClick={() => setIsProvincePickerOpen(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-sky-500/12 dark:bg-cyan-500/15 hover:bg-sky-500/20 dark:hover:bg-cyan-500/25 border border-sky-500/30 dark:border-cyan-400/30 text-xs font-black text-sky-700 dark:text-cyan-200 transition cursor-pointer active:scale-95 shadow-xs"
            >
              <span className="w-5 h-5 rounded-full bg-sky-500 dark:bg-cyan-500 text-white dark:text-slate-950 flex items-center justify-center text-[10px]">
                <JKIcon name="map-pin" />
              </span>
              <span>
                {selectedProvince === "all"
                  ? "จังหวัด: ทุกจังหวัด (77 จว.)"
                  : `จ.${selectedProvince}`}
              </span>
              <JKIcon name="chevron-down" className="text-[10px] opacity-70" />
            </button>

            {selectedProvince !== "all" && (
              <button
                type="button"
                onClick={() => handleSelectProvince("all")}
                className="px-2.5 py-1.5 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-rose-500/15 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-300 transition cursor-pointer flex items-center gap-1"
                title="ล้างตัวกรองจังหวัด"
              >
                <JKIcon name="xmark" className="text-[10px]" />
                <span>77 จว.</span>
              </button>
            )}

            {/* District / Area Pill Filter */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${iosPillControlClass}`}>
              <JKIcon name="globe" className="text-teal-600 dark:text-teal-300 text-[11px]" />
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                aria-label="เลือกเขตหรืออำเภอ"
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer pr-1 max-w-[230px]"
              >
                <option value="all" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">
                  {selectedProvince === "all"
                    ? `ทุกเขต / อำเภอ (${totalDistrictOptionCount})`
                    : `ทุก${selectedProvince === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ"}ใน จ.${selectedProvince} (${totalDistrictOptionCount})`}
                </option>
                {selectedProvince === "all"
                  ? availableDistrictGroups.map((group) => (
                      <optgroup
                        key={group.province}
                        label={`จ.${group.province} (${group.options.length})`}
                        className="text-slate-900 bg-white dark:text-white dark:bg-slate-900 font-bold"
                      >
                        {group.options.map((opt) => (
                          <option
                            key={opt.value}
                            value={opt.value}
                            className="text-slate-900 bg-white dark:text-white dark:bg-slate-900 font-normal"
                          >
                            {opt.count > 0 ? `${opt.label} (${opt.count})` : opt.label}
                          </option>
                        ))}
                      </optgroup>
                    ))
                  : availableDistrictGroups[0]?.options.map((opt) => (
                      <option
                        key={opt.value}
                        value={opt.value}
                        className="text-slate-900 bg-white dark:text-white dark:bg-slate-900"
                      >
                        {opt.count > 0 ? `${opt.label} (${opt.count})` : opt.label}
                      </option>
                    ))}
              </select>
            </div>

            {/* Department Pill Selector */}
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs ${iosPillControlClass}`}>
              <JKIcon name="building" className="text-indigo-500 dark:text-indigo-300 text-[11px]" />
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                aria-label="เลือกหน่วยงาน"
                className="bg-transparent text-xs font-bold focus:outline-none cursor-pointer pr-1 max-w-[220px]"
              >
                <option value="all" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">
                  ทุกหน่วยงาน (ทั่วประเทศ)
                </option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id} className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Apple iOS Segmented Control Tabs */}
          <div className="flex items-center gap-1 bg-slate-200/75 dark:bg-black/40 p-1 rounded-[18px] border border-slate-300/50 dark:border-white/[0.08] overflow-x-auto max-w-full no-scrollbar">
            <button
              onClick={() => setActiveTab("cases")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[14px] text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "cases"
                  ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <JKIcon name="clipboard-list" className={activeTab === "cases" ? "text-sky-500" : ""} />
              <span>รายการเรื่อง ({filteredComplaints.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("departments")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[14px] text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "departments"
                  ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <JKIcon name="sitemap" className={activeTab === "departments" ? "text-indigo-500" : ""} />
              <span>โครงสร้างหน่วยงาน ({departments.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("provinces")}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-[14px] text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                activeTab === "provinces"
                  ? "bg-white dark:bg-white/15 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              <JKIcon name="chart-simple" className={activeTab === "provinces" ? "text-emerald-500" : ""} />
              <span>สถิติจังหวัด (77)</span>
            </button>
          </div>
        </div>

        {/* Department Info Header Banner if filtered */}
        {activeDepartmentMeta && (
          <div
            className={`p-4 sm:p-5 rounded-[26px] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-200 ${iosCardClass}`}
          >
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-[18px] flex items-center justify-center text-white text-lg shadow-lg"
                style={{ backgroundColor: activeDepartmentMeta.color }}
              >
                <JKIcon name={activeDepartmentMeta.icon} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-black">
                    {activeDepartmentMeta.name}
                  </h2>
                  <span className="font-mono text-[11px] px-2.5 py-0.5 rounded-full bg-slate-900/10 dark:bg-white/10 font-bold">
                    {activeDepartmentMeta.code}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600 dark:text-slate-300 font-medium mt-1">
                  <span>
                    ผู้รับผิดชอบ: <strong>{activeDepartmentMeta.headOfficer}</strong>
                  </span>
                  <span>
                    สายตรง:{" "}
                    <a
                      href={`tel:${activeDepartmentMeta.contactPhone}`}
                      className="text-sky-600 dark:text-cyan-400 font-bold hover:underline"
                    >
                      {activeDepartmentMeta.contactPhone}
                    </a>
                  </span>
                  <span>
                    กำลังพล: <strong>{activeDepartmentMeta.activeStaffCount} นาย</strong>
                  </span>
                  <span>
                    SLA: <strong>{activeDepartmentMeta.slaHours} ชม.</strong>
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setSelectedDeptId("all")}
              className="text-xs font-bold px-4 py-2 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300/80 dark:hover:bg-white/20 transition cursor-pointer active:scale-95"
            >
              แสดงทุกหน่วยงาน
            </button>
          </div>
        )}

        {/* iOS Widget KPI Tiles */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {[
            {
              label: "เรื่องทั้งหมด",
              val: kpis.total,
              sub: selectedProvince === "all" ? "ทั่วประเทศ" : `จ.${selectedProvince}`,
              icon: "folder-open",
              accent: "text-slate-700 dark:text-white",
              badgeBg: "bg-slate-500/15 text-slate-600 dark:text-slate-300",
              barColor: "bg-slate-500",
              pct: kpis.total > 0 ? 100 : 0,
            },
            {
              label: "รอดำเนินการ",
              val: kpis.pending,
              sub: "รอรับเรื่อง",
              icon: "clock",
              accent: "text-amber-600 dark:text-amber-400",
              badgeBg: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              barColor: "bg-amber-500",
              pct: kpis.total > 0 ? Math.round((kpis.pending / kpis.total) * 100) : 0,
            },
            {
              label: "กำลังแก้ไข",
              val: kpis.inprogress,
              sub: "ทีมช่างลงพื้นที่",
              icon: "arrows-spin",
              accent: "text-sky-600 dark:text-sky-400",
              badgeBg: "bg-sky-500/15 text-sky-600 dark:text-sky-400",
              barColor: "bg-sky-500",
              pct: kpis.total > 0 ? Math.round((kpis.inprogress / kpis.total) * 100) : 0,
              spin: true,
            },
            {
              label: "แก้ไขเสร็จสิ้น",
              val: kpis.resolved,
              sub: "ปิดเรื่องสมบูรณ์",
              icon: "circle-check",
              accent: "text-emerald-600 dark:text-emerald-400",
              badgeBg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              barColor: "bg-emerald-500",
              pct: kpis.total > 0 ? Math.round((kpis.resolved / kpis.total) * 100) : 0,
            },
            {
              label: "เร่งด่วน / โหวตสูง",
              val: kpis.urgent,
              sub: "สำคัญระดับสูง",
              icon: "fire",
              accent: "text-rose-600 dark:text-rose-400",
              badgeBg: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
              barColor: "bg-rose-500",
              pct: kpis.total > 0 ? Math.round((kpis.urgent / kpis.total) * 100) : 0,
            },
            {
              label: "อัตราแก้ไขสำเร็จ",
              val: `${kpis.resolutionRate}%`,
              sub: "ประสิทธิภาพงาน",
              icon: "chart-simple",
              accent: "text-teal-600 dark:text-cyan-300",
              badgeBg: "bg-teal-500/15 text-teal-600 dark:text-cyan-300",
              barColor: "bg-teal-500",
              pct: kpis.resolutionRate,
            },
          ].map((tile) => (
            <div
              key={tile.label}
              className={`p-4 rounded-[24px] transition-transform hover:-translate-y-0.5 flex flex-col justify-between ${iosCardClass}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                  {tile.label}
                </span>
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs ${tile.badgeBg}`}>
                  <JKIcon name={tile.icon} className={tile.spin ? "animate-spin" : ""} />
                </div>
              </div>
              <div className={`text-2xl sm:text-3xl font-black font-mono mt-2 tracking-tight ${tile.accent}`}>
                {tile.val}
              </div>
              <div className="mt-2 space-y-1.5">
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  <span className="truncate">{tile.sub}</span>
                  <span className="font-mono">{tile.pct}%</span>
                </div>
                <div className="h-1 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${tile.barColor} transition-all duration-500`}
                    style={{ width: `${tile.pct}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Analytics Charts Header Bar & Interactive Charts Deck */}
        {activeTab === "cases" && (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 px-1">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-600 dark:text-slate-300">
                <JKIcon name="chart-line" className="text-sky-500" />
                <span>กราฟวิเคราะห์ข้อมูลแบบเรียลไทม์</span>
                {categoryFilter !== "all" && (
                  <button
                    type="button"
                    onClick={() => setCategoryFilter("all")}
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-700 dark:text-cyan-300 text-[11px] border border-sky-500/25 cursor-pointer hover:bg-sky-500/25 transition"
                  >
                    <span>
                      หมวด: {COMPLAINT_CATEGORIES.find((c) => c.id === categoryFilter)?.label}
                    </span>
                    <JKIcon name="xmark" className="text-[9px]" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setShowCharts((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${iosPillControlClass}`}
              >
                <JKIcon name={showCharts ? "chevron-up" : "chevron-down"} className="text-[10px]" />
                <span>{showCharts ? "ซ่อนกราฟ" : "แสดงกราฟวิเคราะห์"}</span>
              </button>
            </div>

            {showCharts && (
              <AdminAnalyticsCharts
                complaints={scopedComplaints}
                iosCardClass={iosCardClass}
                activeStatusFilter={statusFilter}
                onSelectStatusFilter={setStatusFilter}
                activeCategoryFilter={categoryFilter}
                onSelectCategoryFilter={setCategoryFilter}
              />
            )}
          </div>
        )}

        {/* ===================== TAB 1: CASES TABLE ===================== */}
        {activeTab === "cases" && (
          <div className="space-y-4">
            {/* iOS Spotlight Search & Segmented Status Bar */}
            <div className={`p-3.5 sm:p-4 rounded-[24px] flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 ${iosCardClass}`}>
              <div className="relative flex-1">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                  <JKIcon name="magnifying-glass" className="text-xs" />
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาชื่อเรื่อง, จังหวัด, อำเภอ, ผู้แจ้ง หรือเจ้าหน้าที่..."
                  className="w-full bg-slate-200/65 dark:bg-black/35 border border-slate-300/50 dark:border-white/10 rounded-full pl-9 pr-9 py-2 text-xs font-medium text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <JKIcon name="xmark" className="text-xs" />
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1 bg-slate-200/75 dark:bg-black/40 p-1 rounded-full border border-slate-300/40 dark:border-white/[0.08]">
                  {[
                    { key: "all", label: "ทุกสถานะ" },
                    { key: "pending", label: "รอดำเนินการ" },
                    { key: "inprogress", label: "กำลังทำ" },
                    { key: "resolved", label: "แก้ไขแล้ว" },
                  ].map((st) => (
                    <button
                      key={st.key}
                      onClick={() => setStatusFilter(st.key)}
                      className={`px-3 py-1 rounded-full text-[11px] font-black transition cursor-pointer ${
                        statusFilter === st.key
                          ? "bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>

                <select
                  value={priorityFilter}
                  onChange={(e) => setPriorityFilter(e.target.value)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer ${iosPillControlClass}`}
                >
                  <option value="all" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">ทุกระดับความเร่งด่วน</option>
                  <option value="urgent" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">เร่งด่วนมาก</option>
                  <option value="high" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">สูง</option>
                  <option value="medium" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">ปานกลาง</option>
                  <option value="low" className="text-slate-900 bg-white dark:text-white dark:bg-slate-900">ปกติ</option>
                </select>
              </div>
            </div>

            {/* iOS Grouped Inset Table / Cards */}
            <div className={`rounded-[26px] overflow-hidden ${iosCardClass}`}>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-white/10 bg-slate-100/70 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 font-black uppercase text-[10px] tracking-wider">
                      <th className="py-3.5 px-4">รหัส / วันที่</th>
                      <th className="py-3.5 px-4">เรื่องร้องเรียน & หมวดหมู่</th>
                      <th className="py-3.5 px-4">จังหวัด / พื้นที่</th>
                      <th className="py-3.5 px-4">หน่วยงาน & ผู้รับผิดชอบ</th>
                      <th className="py-3.5 px-4">ความเร่งด่วน</th>
                      <th className="py-3.5 px-4">สถานะ</th>
                      <th className="py-3.5 px-4 text-center">โหวต</th>
                      <th className="py-3.5 px-4 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200/70 dark:divide-white/[0.06]">
                    {filteredComplaints.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-500 font-bold">
                          ไม่พบรายการเรื่องร้องเรียนที่ตรงกับเงื่อนไข
                        </td>
                      </tr>
                    ) : (
                      filteredComplaints.map((c) => {
                        const cat = COMPLAINT_CATEGORIES.find((catItem) => catItem.id === c.categoryId);
                        const cDept = departments.find((d) => d.id === c.departmentId);

                        return (
                          <tr
                            key={c.id}
                            onClick={() => setSelectedCaseId(c.id)}
                            className="hover:bg-sky-500/[0.05] dark:hover:bg-white/[0.05] transition cursor-pointer group"
                          >
                            <td className="py-3.5 px-4 font-mono">
                              <span className="font-black text-sky-600 dark:text-cyan-400 block">{c.id}</span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block mt-0.5">{c.createdAt}</span>
                            </td>

                            <td className="py-3.5 px-4 max-w-md xl:max-w-lg">
                              <span className="font-bold block group-hover:text-sky-600 dark:group-hover:text-cyan-300 transition line-clamp-1">
                                {c.title}
                              </span>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                                  style={{ backgroundColor: cat?.color ?? "#64748b" }}
                                >
                                  <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[9px]" />
                                  {cat?.label}
                                </span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 inline-flex items-center gap-1">
                                  {c.isAnonymous ? (
                                    <>
                                      <JKIcon name="user-secret" className="text-[9px] text-amber-500" />
                                      <span className="text-amber-600 dark:text-amber-300">ไม่ระบุตัวตน</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>โดย {c.reporterName}</span>
                                      {c.reporterMemberId && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-bold">
                                          สมาชิก
                                        </span>
                                      )}
                                    </>
                                  )}
                                </span>
                              </div>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              <span className="font-bold flex items-center gap-1">
                                <JKIcon name="map-pin" className="text-rose-500 text-[10px]" />
                                {c.province || inferProvinceFromCoord(c.coordinates)}
                              </span>
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                                {c.district || `${c.coordinates[1].toFixed(3)}°, ${c.coordinates[0].toFixed(3)}°`}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {cDept ? (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white"
                                  style={{ backgroundColor: cDept.color }}
                                >
                                  <JKIcon name={cDept.icon} className="text-[9px]" />
                                  {cDept.name}
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-bold">
                                  ยังไม่ระบุหน่วยงาน
                                </span>
                              )}
                              <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-1">
                                {c.assignedOfficer || "ยังไม่มีผู้รับผิดชอบ"}
                              </span>
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {c.priority === "urgent" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="triangle-exclamation" className="text-[9px]" /> เร่งด่วนมาก
                                </span>
                              )}
                              {c.priority === "high" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="circle-up" className="text-[9px]" /> สูง
                                </span>
                              )}
                              {(!c.priority || c.priority === "medium") && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="circle" className="text-[8px]" /> ปานกลาง
                                </span>
                              )}
                              {c.priority === "low" && (
                                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="circle-down" className="text-[9px]" /> ปกติ
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 whitespace-nowrap">
                              {c.status === "pending" && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="clock" className="text-[9px]" /> รอดำเนินการ
                                </span>
                              )}
                              {c.status === "inprogress" && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-700 dark:text-sky-300 border border-sky-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="arrows-spin" className="text-[9px]" /> กำลังดำเนินการ
                                </span>
                              )}
                              {c.status === "resolved" && (
                                <span className="px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25 inline-flex items-center gap-1">
                                  <JKIcon name="circle-check" className="text-[9px]" /> แก้ไขแล้ว
                                </span>
                              )}
                            </td>

                            <td className="py-3.5 px-4 text-center font-mono font-bold">
                              {c.upvotes ?? 0}
                            </td>

                            <td className="py-3.5 px-4 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                {c.status === "pending" && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleQuickStatusChange(c.id, "inprogress", e)}
                                    className="px-3 py-1 rounded-full bg-sky-500/15 hover:bg-sky-500 text-sky-700 dark:text-sky-300 hover:text-white text-[10px] font-bold border border-sky-500/30 transition cursor-pointer"
                                  >
                                    รับเรื่อง
                                  </button>
                                )}

                                {c.status === "inprogress" && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleQuickStatusChange(c.id, "resolved", e)}
                                    className="px-3 py-1 rounded-full bg-emerald-500/15 hover:bg-emerald-500 text-emerald-700 dark:text-emerald-300 hover:text-white text-[10px] font-bold border border-emerald-500/30 transition cursor-pointer"
                                  >
                                    ปิดงาน
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setSelectedCaseId(c.id)}
                                  className="px-3 py-1 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-[10px] font-bold transition cursor-pointer inline-flex items-center gap-1"
                                >
                                  <JKIcon name="pen-to-square" className="text-[9px]" />
                                  <span>จัดการเคส</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Mobile iOS Grouped Cards */}
              <div className="block md:hidden divide-y divide-slate-200/70 dark:divide-white/10">
                {filteredComplaints.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 font-bold text-xs">
                    ไม่พบรายการเรื่องร้องเรียนที่ตรงกับเงื่อนไข
                  </div>
                ) : (
                  filteredComplaints.map((c) => {
                    const cat = COMPLAINT_CATEGORIES.find((catItem) => catItem.id === c.categoryId);
                    const cDept = departments.find((d) => d.id === c.departmentId);

                    return (
                      <div
                        key={c.id}
                        onClick={() => setSelectedCaseId(c.id)}
                        className="p-4 hover:bg-sky-500/5 dark:hover:bg-white/5 transition cursor-pointer"
                      >
                        <div className="flex items-center justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-sky-600 dark:text-cyan-400 text-xs">{c.id}</span>
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">{c.createdAt}</span>
                          </div>
                          {c.status === "pending" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              รอดำเนินการ
                            </span>
                          )}
                          {c.status === "inprogress" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-sky-500/15 text-sky-700 dark:text-sky-300">
                              กำลังทำ
                            </span>
                          )}
                          {c.status === "resolved" && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                              แก้ไขแล้ว
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-black leading-snug mb-2">{c.title}</h3>

                        <div className="flex flex-wrap items-center gap-1.5 mb-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black text-white"
                            style={{ backgroundColor: cat?.color ?? "#64748b" }}
                          >
                            <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[9px]" />
                            {cat?.label}
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200/75 dark:bg-white/10">
                            <JKIcon name="map-pin" className="text-rose-500 text-[9px]" />
                            {c.province || inferProvinceFromCoord(c.coordinates)}
                            {c.district ? ` · ${c.district}` : ""}
                          </span>

                          {c.isAnonymous ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-300">
                              <JKIcon name="user-secret" className="text-[9px]" />
                              ไม่ระบุตัวตน
                            </span>
                          ) : (
                            c.reporterMemberId && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                                <JKIcon name="user-check" className="text-[9px]" />
                                สมาชิก
                              </span>
                            )
                          )}

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 ml-auto">
                            <JKIcon name="thumbs-up" className="text-[9px]" />
                            {c.upvotes ?? 0}
                          </span>
                        </div>

                        <div className="p-2.5 rounded-2xl bg-slate-200/50 dark:bg-white/[0.05] flex items-center justify-between gap-2 mb-3">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400 block">หน่วยงานรับผิดชอบ:</span>
                            <span className="text-xs font-bold truncate block">
                              {cDept ? cDept.name : "ยังไม่ระบุหน่วยงาน"}
                            </span>
                          </div>
                          {c.assignedOfficer && (
                            <div className="text-right">
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">ผู้ดูแล:</span>
                              <span className="text-xs font-bold text-sky-600 dark:text-cyan-300">{c.assignedOfficer}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => setSelectedCaseId(c.id)}
                            className="flex-1 py-2 rounded-full bg-sky-500/15 hover:bg-sky-500 text-sky-700 dark:text-cyan-300 hover:text-white text-xs font-black transition text-center cursor-pointer"
                          >
                            จัดการเคส
                          </button>
                          {c.status === "pending" && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickStatusChange(c.id, "inprogress", e)}
                              className="px-4 py-2 rounded-full bg-sky-500 text-white text-xs font-bold transition cursor-pointer"
                            >
                              รับเรื่อง
                            </button>
                          )}
                          {c.status === "inprogress" && (
                            <button
                              type="button"
                              onClick={(e) => handleQuickStatusChange(c.id, "resolved", e)}
                              className="px-4 py-2 rounded-full bg-emerald-500 text-white text-xs font-bold transition cursor-pointer"
                            >
                              ปิดงาน
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===================== TAB 2: DEPARTMENTS DIRECTORY ===================== */}
        {activeTab === "departments" && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 sm:gap-5">
            {departments.map((d) => {
              const assignedCases = complaints.filter((c) => c.departmentId === d.id);
              const pendingCount = assignedCases.filter((c) => c.status === "pending").length;
              const resolvedCount = assignedCases.filter((c) => c.status === "resolved").length;

              return (
                <div
                  key={d.id}
                  className={`rounded-[26px] overflow-hidden flex flex-col justify-between transition hover:-translate-y-0.5 ${iosCardClass}`}
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-11 h-11 rounded-[16px] flex items-center justify-center text-white text-base shadow-md"
                          style={{ backgroundColor: d.color }}
                        >
                          <JKIcon name={d.icon} />
                        </div>
                        <div>
                          <h3 className="text-sm font-black">{d.name}</h3>
                          <span className="text-[10px] font-mono text-sky-600 dark:text-cyan-400 block">{d.code}</span>
                        </div>
                      </div>

                      <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-bold">
                        SLA {d.slaHours} ชม.
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 p-3 rounded-2xl bg-slate-200/55 dark:bg-black/30 text-center">
                      <div>
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 block">งานทั้งหมด</span>
                        <span className="text-sm font-black font-mono">{assignedCases.length}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 block">ค้างรับ</span>
                        <span className="text-sm font-black text-amber-600 dark:text-amber-400 font-mono">{pendingCount}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block">เสร็จสิ้น</span>
                        <span className="text-sm font-black text-emerald-600 dark:text-emerald-400 font-mono">{resolvedCount}</span>
                      </div>
                    </div>

                    <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                      <div className="flex items-center gap-2">
                        <JKIcon name="user-tie" className="text-slate-400 text-xs shrink-0" />
                        <span>ผู้บริหาร: <strong>{d.headOfficer}</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <JKIcon name="phone" className="text-slate-400 text-xs shrink-0" />
                        <span>
                          โทรสายตรง:{" "}
                          <a href={`tel:${d.contactPhone}`} className="text-sky-600 dark:text-cyan-400 hover:underline">
                            {d.contactPhone}
                          </a>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <JKIcon name="envelope" className="text-slate-400 text-xs shrink-0" />
                        <span className="font-mono text-[11px]">{d.email}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <JKIcon name="users" className="text-slate-400 text-xs shrink-0" />
                        <span>กำลังพล: <strong>{d.activeStaffCount} นาย</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border-t border-slate-200/70 dark:border-white/10">
                    <button
                      onClick={() => {
                        setSelectedDeptId(d.id);
                        setActiveTab("cases");
                      }}
                      className="w-full py-2 rounded-full bg-slate-900 dark:bg-white/15 hover:opacity-90 text-white text-xs font-black transition cursor-pointer text-center active:scale-95"
                    >
                      ดูเรื่องร้องเรียนของหน่วยงานนี้ ({assignedCases.length})
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ===================== TAB 3: NATIONWIDE PROVINCE BREAKDOWN (77 PROVINCES) ===================== */}
        {activeTab === "provinces" && (
          <div className="space-y-4">
            {/* Regional Bar Chart Summary */}
            <div className={`p-5 rounded-[26px] ${iosCardClass}`}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="text-sm font-black flex items-center gap-2">
                  <span className="w-7 h-7 rounded-[10px] bg-sky-500/15 text-sky-600 dark:text-cyan-300 flex items-center justify-center text-xs">
                    <JKIcon name="chart-bar" />
                  </span>
                  <span>กราฟเปรียบเทียบปริมาณเรื่องร้องเรียนรายภูมิภาค</span>
                </h3>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                  {complaints.length} เรื่องทั่วประเทศ
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
                {PROVINCE_GROUPS.map((grp) => {
                  const regCases = complaints.filter((c) => {
                    const prov = c.province || inferProvinceFromCoord(c.coordinates);
                    return grp.provinces.includes(prov);
                  });
                  const regPct =
                    complaints.length > 0
                      ? Math.round((regCases.length / complaints.length) * 100)
                      : 0;
                  const regResolved = regCases.filter((c) => c.status === "resolved").length;
                  const isActive = provinceRegionFilter === grp.region;
                  return (
                    <button
                      key={grp.region}
                      type="button"
                      onClick={() =>
                        setProvinceRegionFilter(isActive ? "all" : grp.region)
                      }
                      className={`p-3 rounded-[18px] text-left transition cursor-pointer border ${
                        isActive
                          ? "bg-sky-500/12 border-sky-500/60"
                          : "bg-slate-100/80 dark:bg-white/[0.04] border-slate-200/70 dark:border-white/[0.08] hover:border-sky-400/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] font-bold">
                        <span className="truncate">{grp.region}</span>
                        <span className="font-mono text-sky-600 dark:text-cyan-300">
                          {regCases.length}
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden my-2">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sky-500 to-teal-500 transition-all duration-500"
                          style={{ width: `${Math.max(regCases.length > 0 ? 12 : 0, regPct)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>{grp.provinces.length} จว.</span>
                        <span>ปิดแล้ว {regResolved}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className={`p-4 rounded-[24px] flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 ${iosCardClass}`}>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setProvinceRegionFilter("all")}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-black transition cursor-pointer ${
                    provinceRegionFilter === "all"
                      ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                      : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                  }`}
                >
                  ทุกภูมิภาค ({THAILAND_PROVINCES.length})
                </button>
                {THAILAND_REGIONS.map((region) => {
                  const count =
                    PROVINCE_GROUPS.find((g) => g.region === region)?.provinces.length ?? 0;
                  return (
                    <button
                      key={region}
                      type="button"
                      onClick={() => setProvinceRegionFilter(region)}
                      className={`px-3 py-1.5 rounded-full text-[11px] font-black transition cursor-pointer ${
                        provinceRegionFilter === region
                          ? "bg-sky-500 text-white shadow-sm shadow-sky-500/30"
                          : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {region} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="relative w-full lg:w-64">
                <JKIcon
                  name="magnifying-glass"
                  className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  type="search"
                  value={provinceSearch}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  placeholder="ค้นหาจังหวัด..."
                  aria-label="ค้นหาจังหวัด"
                  className="w-full pl-9 pr-3 py-1.5 rounded-full bg-slate-200/70 dark:bg-black/35 border border-slate-300/50 dark:border-white/15 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-3.5">
              {PROVINCE_GROUPS.filter(
                (g) => provinceRegionFilter === "all" || g.region === provinceRegionFilter,
              )
                .flatMap((g) => g.provinces.map((prov) => ({ prov, region: g.region })))
                .filter(({ prov }) =>
                  provinceSearch.trim()
                    ? prov.toLowerCase().includes(provinceSearch.trim().toLowerCase())
                    : true,
                )
                .map(({ prov, region }) => {
                  const provCases = complaints.filter(
                    (c) => (c.province || inferProvinceFromCoord(c.coordinates)) === prov,
                  );
                  return { prov, region, provCases };
                })
                .sort((a, b) => b.provCases.length - a.provCases.length)
                .map(({ prov, region, provCases }) => {
                  const pending = provCases.filter((c) => c.status === "pending").length;
                  const inprogress = provCases.filter((c) => c.status === "inprogress").length;
                  const resolved = provCases.filter((c) => c.status === "resolved").length;

                  return (
                    <div
                      key={prov}
                      onClick={() => {
                        handleSelectProvince(prov);
                        setActiveTab("cases");
                      }}
                      className={`p-4 rounded-[22px] hover:-translate-y-0.5 transition cursor-pointer group ${iosCardClass}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="min-w-0">
                          <h4 className="text-xs font-black group-hover:text-sky-600 dark:group-hover:text-cyan-400 transition flex items-center gap-1 truncate">
                            <JKIcon name="map-pin" className="text-rose-500 text-[10px] shrink-0" />
                            <span className="truncate">{prov}</span>
                          </h4>
                          <span className="text-[10px] text-slate-500 dark:text-slate-400 block truncate">
                            {region} • {THAILAND_DISTRICTS_BY_PROVINCE[prov]?.length ?? 0}{" "}
                            {prov === "กรุงเทพมหานคร" ? "เขต" : "อำเภอ"}
                          </span>
                        </div>
                        <span className="text-xs font-black font-mono text-sky-600 dark:text-cyan-400 shrink-0">
                          {provCases.length} เรื่อง
                        </span>
                      </div>

                      <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden flex my-2">
                        <div
                          className="bg-emerald-500"
                          style={{
                            width: `${provCases.length > 0 ? (resolved / provCases.length) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-sky-500"
                          style={{
                            width: `${provCases.length > 0 ? (inprogress / provCases.length) * 100 : 0}%`,
                          }}
                        />
                        <div
                          className="bg-amber-500"
                          style={{
                            width: `${provCases.length > 0 ? (pending / provCases.length) * 100 : 0}%`,
                          }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] font-bold pt-1">
                        <span className="text-emerald-600 dark:text-emerald-400">{resolved} เสร็จ</span>
                        <span className="text-sky-600 dark:text-sky-400">{inprogress} กำลังทำ</span>
                        <span className="text-amber-600 dark:text-amber-400">{pending} ค้าง</span>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </main>

      {/* iOS Sheet Modal: Select Province (77 Provinces) */}
      {isProvincePickerOpen && (
        <div
          onClick={() => setIsProvincePickerOpen(false)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-slate-900/35 dark:bg-black/65 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-2xl rounded-t-[32px] sm:rounded-[32px] p-5 sm:p-6 max-h-[86vh] overflow-hidden flex flex-col gap-3.5 animate-in slide-in-from-bottom-4 duration-200 bg-white/95 dark:bg-[#0f172a]/92 backdrop-blur-3xl border border-white/95 dark:border-white/[0.14] shadow-[0_28px_70px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[0_32px_70px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
          >
            {/* iOS Sheet Grabber */}
            <div className="w-10 h-1 rounded-full bg-slate-300 dark:bg-white/25 mx-auto sm:hidden shrink-0" />

            {/* Modal Header */}
            <div className="flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[14px] bg-gradient-to-br from-sky-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-sky-500/25 shrink-0">
                  <JKIcon name="map-pin" className="text-sm" />
                </div>
                <div>
                  <h2 className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                    เลือกจังหวัดที่ต้องการกำกับดูแล
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                    ครอบคลุมทั้ง {THAILAND_PROVINCES.length} จังหวัดทั่วประเทศไทย
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsProvincePickerOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer active:scale-90 shrink-0"
                aria-label="ปิดหน้าต่างเลือกจังหวัด"
              >
                <JKIcon name="xmark" className="text-xs" />
              </button>
            </div>

            {/* Search Input */}
            <div className="relative shrink-0">
              <JKIcon
                name="magnifying-glass"
                className="text-slate-400 text-xs absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
              />
              <input
                type="text"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                placeholder="พิมพ์ชื่อจังหวัด เช่น เชียงใหม่, ขอนแก่น, ภูเก็ต..."
                className="w-full pl-10 pr-9 py-2.5 rounded-2xl bg-slate-100/90 dark:bg-white/[0.06] border border-slate-200/90 dark:border-white/[0.12] text-xs font-semibold text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:bg-white dark:focus:bg-white/[0.1] focus:border-sky-500/80 focus:ring-4 focus:ring-sky-500/15 transition"
                autoFocus
              />
              {pickerSearch && (
                <button
                  type="button"
                  onClick={() => setPickerSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full bg-slate-300/70 dark:bg-white/15 hover:bg-slate-400/70 text-slate-700 dark:text-white flex items-center justify-center cursor-pointer transition"
                  aria-label="ล้างคำค้นหาจังหวัด"
                >
                  <JKIcon name="xmark" className="text-[10px]" />
                </button>
              )}
            </div>

            {/* Region Segmented Pills (Wrapped cleanly without vertical clipping) */}
            <div className="shrink-0 p-1.5 rounded-[20px] bg-slate-100/90 dark:bg-white/[0.05] border border-slate-200/80 dark:border-white/[0.08] flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPickerRegion("all")}
                className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                  pickerRegion === "all"
                    ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25"
                    : "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-300"
                }`}
              >
                ทุกภูมิภาค (77)
              </button>
              {THAILAND_REGIONS.map((region) => (
                <button
                  key={region}
                  type="button"
                  onClick={() => setPickerRegion(region)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                    pickerRegion === region
                      ? "bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/25"
                      : "bg-white/80 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/[0.12] text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {region}
                </button>
              ))}
            </div>

            {/* Province Grid */}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1 space-y-2.5">
              <button
                type="button"
                onClick={() => handleSelectProvince("all")}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-[20px] text-xs font-bold transition cursor-pointer border ${
                  selectedProvince === "all"
                    ? "bg-sky-500/12 dark:bg-sky-500/20 border-sky-500/70 text-sky-700 dark:text-cyan-200 shadow-sm shadow-sky-500/10"
                    : "bg-slate-50/90 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] hover:border-sky-400/60 hover:bg-sky-50/60 dark:hover:bg-white/[0.08]"
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-full bg-sky-500/15 text-sky-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                    <JKIcon name="globe" className="text-xs" />
                  </span>
                  <span>ทุกจังหวัด (ภาพรวมทั่วประเทศ 77 จังหวัด)</span>
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-mono text-[10px] font-bold">
                    {complaints.length} เรื่อง
                  </span>
                  {selectedProvince === "all" && (
                    <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                      <JKIcon name="check" className="text-[10px]" />
                    </span>
                  )}
                </span>
              </button>

              {pickerProvinces.length === 0 ? (
                <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 font-semibold">
                  ไม่พบจังหวัดที่ตรงกับคำค้นหา &ldquo;{pickerSearch}&rdquo;
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {pickerProvinces.map((item) => {
                    const count = provinceCounts[item.name] ?? 0;
                    const isActive = selectedProvince === item.name;
                    return (
                      <button
                        key={item.name}
                        type="button"
                        onClick={() => handleSelectProvince(item.name)}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-[18px] text-left text-xs transition cursor-pointer border ${
                          isActive
                            ? "bg-sky-500/12 dark:bg-sky-500/20 border-sky-500/70 text-sky-700 dark:text-cyan-200 font-black shadow-sm shadow-sky-500/10"
                            : "bg-slate-50/90 dark:bg-white/[0.04] border-slate-200/80 dark:border-white/[0.08] hover:border-sky-400/60 hover:bg-white dark:hover:bg-white/[0.08] font-bold text-slate-800 dark:text-slate-100"
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="truncate">{item.name}</p>
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                            {item.region}
                          </p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`px-2 py-0.5 rounded-full font-mono text-[10px] ${
                              count > 0
                                ? "bg-sky-500/15 text-sky-700 dark:text-cyan-300 font-black"
                                : "bg-slate-200/70 dark:bg-white/[0.08] text-slate-400 dark:text-slate-500"
                            }`}
                          >
                            {count}
                          </span>
                          {isActive && (
                            <span className="w-5 h-5 rounded-full bg-sky-500 text-white flex items-center justify-center">
                              <JKIcon name="check" className="text-[10px]" />
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Case Action Modal */}
      {centralError && <p role="status" className="fixed bottom-2 left-2 rounded bg-amber-100 p-2 text-amber-950">โหลดข้อมูลแจ้งเหตุจากฐานข้อมูลกลางไม่ได้</p>}
      <AdminCaseModal
        complaint={selectedCase}
        isOpen={Boolean(selectedCase)}
        onClose={() => {
          setSelectedCaseId(null);
          setDismissedUrlCase(true);
          if (typeof window !== "undefined" && window.location.search.includes("case=")) {
            window.history.replaceState({}, "", "/admin");
          }
        }}
        onSave={handleSaveCase}
        onDelete={handleDeleteCase}
        defaultOfficerName={session.officer.name}
      />

      {/* iOS Alert Style Reset Confirmation */}
      {isResetModalOpen && (
        <div
          onClick={() => setIsResetModalOpen(false)}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/35 dark:bg-black/65 backdrop-blur-md animate-in fade-in duration-150"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-[28px] p-6 space-y-4 text-center bg-white/95 dark:bg-[#0f172a]/92 backdrop-blur-3xl border border-white/95 dark:border-white/[0.14] shadow-[0_28px_70px_-12px_rgba(15,23,42,0.22),inset_0_1px_0_0_rgba(255,255,255,0.95)] dark:shadow-[0_32px_70px_-12px_rgba(0,0,0,0.75),inset_0_1px_0_0_rgba(255,255,255,0.12)]"
          >
            <div className="w-12 h-12 rounded-full bg-rose-500/15 text-rose-500 flex items-center justify-center text-lg mx-auto">
              <JKIcon name="triangle-exclamation" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-black">ยืนยันการรีเซ็ตข้อมูลตัวอย่าง</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                การแก้ไข สถานะ และเรื่องร้องเรียนที่เพิ่มใหม่จะถูกล้างกลับเป็นค่าเริ่มต้น
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="py-2.5 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-xs font-bold cursor-pointer transition"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-xs font-black text-white shadow-lg shadow-rose-500/30 cursor-pointer transition"
              >
                ยืนยันรีเซ็ต
              </button>
            </div>
          </div>
        </div>
      )}

      {/* iOS Dynamic Island Style Toast */}
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 sm:left-auto sm:translate-x-0 sm:right-6 z-50 pointer-events-none animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="flex items-center gap-3 px-5 py-3.5 rounded-full bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 shadow-2xl backdrop-blur-2xl border border-white/15">
            <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs shrink-0">
              <JKIcon name="circle-check" />
            </div>
            <div>
              <p className="text-xs font-black">{toastMsg.text}</p>
              {toastMsg.sub && (
                <p className="text-[11px] opacity-75">{toastMsg.sub}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
