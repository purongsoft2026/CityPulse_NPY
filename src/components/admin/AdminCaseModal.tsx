"use client";

import { AgencyReferralPanel } from "./AgencyReferralPanel";
import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  PROVINCE_GROUPS,
  inferProvinceFromCoord,
  inferDistrictFromCoord,
  type ComplaintReport,
  type ComplaintStatus,
  type ComplaintPriority,
  type ComplaintTimelineEvent,
  type ComplaintComment,
} from "@/data/map-data";
import {
  getAllDepartmentsSnapshot,
  getServerDepartmentsSnapshot,
  subscribeDepartments,
} from "@/lib/departments-store";
import {
  getDefaultDistrictForProvince,
  getDistrictsForProvince,
} from "@/data/thailand-districts";
import { compressImageFile } from "@/lib/image-utils";

interface AdminCaseModalProps {
  complaint: ComplaintReport | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: ComplaintReport) => void;
  onDelete?: (id: string) => void;
  defaultOfficerName?: string;
}

const STATUS_CONFIG: Record<
  ComplaintStatus,
  { label: string; icon: string; activeClass: string; bgClass: string; textClass: string }
> = {
  pending: {
    label: "รอดำเนินการ",
    icon: "clock",
    activeClass: "bg-amber-500 text-white shadow-lg shadow-amber-500/30 ring-2 ring-amber-400",
    bgClass: "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  inprogress: {
    label: "กำลังดำเนินการ",
    icon: "arrows-spin",
    activeClass: "bg-blue-600 text-white shadow-lg shadow-blue-600/30 ring-2 ring-blue-400",
    bgClass: "bg-blue-500/15 border-blue-500/30 text-blue-600 dark:text-blue-400",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  resolved: {
    label: "แก้ไขแล้ว",
    icon: "circle-check",
    activeClass: "bg-emerald-600 text-white shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400",
    bgClass: "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
    textClass: "text-emerald-600 dark:text-emerald-400",
  },
};

const PRIORITY_CONFIG: Record<
  ComplaintPriority,
  { label: string; icon: string; activeClass: string; badgeClass: string }
> = {
  urgent: {
    label: "เร่งด่วนมาก",
    icon: "triangle-exclamation",
    activeClass: "bg-red-600 text-white ring-2 ring-red-400",
    badgeClass: "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30",
  },
  high: {
    label: "สูง",
    icon: "circle-up",
    activeClass: "bg-orange-600 text-white ring-2 ring-orange-400",
    badgeClass: "bg-orange-500/20 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  medium: {
    label: "ปานกลาง",
    icon: "circle-dot",
    activeClass: "bg-yellow-600 text-white ring-2 ring-yellow-400",
    badgeClass: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-400 border-yellow-500/30",
  },
  low: {
    label: "ปกติ",
    icon: "circle-down",
    activeClass: "bg-slate-600 text-white ring-2 ring-slate-400",
    badgeClass: "bg-slate-500/20 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};

export function AdminCaseModal({
  complaint,
  isOpen,
  onClose,
  onSave,
  onDelete,
  defaultOfficerName,
}: AdminCaseModalProps) {
  if (!isOpen || !complaint) return null;

  return (
    <AdminCaseModalInner
      key={complaint.id}
      complaint={complaint}
      onClose={onClose}
      onSave={onSave}
      onDelete={onDelete}
      defaultOfficerName={defaultOfficerName}
    />
  );
}

function AdminCaseModalInner({
  complaint,
  onClose,
  onSave,
  onDelete,
  defaultOfficerName,
}: {
  complaint: ComplaintReport;
  onClose: () => void;
  onSave: (updated: ComplaintReport) => void;
  onDelete?: (id: string) => void;
  defaultOfficerName?: string;
}) {
  const departments = useSyncExternalStore(
    subscribeDepartments,
    getAllDepartmentsSnapshot,
    getServerDepartmentsSnapshot
  );
  const [status, setStatus] = useState<ComplaintStatus>(complaint.status);
  const [priority, setPriority] = useState<ComplaintPriority>(complaint.priority || "medium");
  const [departmentId, setDepartmentId] = useState<string>(complaint.departmentId || "");
  const [province, setProvince] = useState<string>(
    complaint.province || inferProvinceFromCoord(complaint.coordinates)
  );
  const [district, setDistrict] = useState<string>(
    complaint.district || inferDistrictFromCoord(complaint.coordinates)
  );
  const [assignedOfficer, setAssignedOfficer] = useState<string>(
    complaint.assignedOfficer || defaultOfficerName || ""
  );
  const [resolvedImageBase64, setResolvedImageBase64] = useState<string | undefined>(
    complaint.resolvedImageBase64
  );

  // Timeline entry addition
  const [newLogTitle, setNewLogTitle] = useState("");
  const [newLogDesc, setNewLogDesc] = useState("");
  const [newLogOfficer, setNewLogOfficer] = useState(
    complaint.assignedOfficer || defaultOfficerName || ""
  );
  const [isAddingLog, setIsAddingLog] = useState(false);

  // Officer comment & confirm delete
  const [officerReply, setOfficerReply] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const resolvedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
  const dept = departments.find((d) => d.id === departmentId);

  const handleUploadResolvedPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.8,
      });
      setResolvedImageBase64(compressed);
    } finally {
      setIsCompressingPhoto(false);
    }
  };

  const handleAppendReply = () => {
    const trimmed = officerReply.trim();
    if (!trimmed) return;
    const now = new Date();
    const newComment: ComplaintComment = {
      id: `cmt-${Date.now()}`,
      author: defaultOfficerName || assignedOfficer.trim() || "เจ้าหน้าที่ปฏิบัติการ",
      text: trimmed,
      role: "officer",
      createdAt: `${now.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`,
    };
    onSave({
      ...complaint,
      status,
      priority,
      departmentId: departmentId || undefined,
      province: province || undefined,
      district: district.trim() || undefined,
      assignedOfficer: assignedOfficer || undefined,
      resolvedImageBase64,
      comments: [...(complaint.comments ?? []), newComment],
    });
    setOfficerReply("");
  };

  const handleAppendLog = () => {
    if (!newLogTitle.trim()) return;

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

    const newEvent: ComplaintTimelineEvent = {
      id: `log-${Date.now()}`,
      date: dateStr,
      time: timeStr,
      title: newLogTitle.trim(),
      description: newLogDesc.trim() || "บันทึกการปฏิบัติงานโดยเจ้าหน้าที่ผู้รับผิดชอบ",
      status: status,
      officer: newLogOfficer.trim() || assignedOfficer || "เจ้าหน้าที่ปฏิบัติการ",
      icon: status === "resolved" ? "circle-check" : status === "inprogress" ? "wrench" : "clipboard-list",
    };

    const updatedTimeline = [...(complaint.timeline || []), newEvent];

    const updated: ComplaintReport = {
      ...complaint,
      status,
      priority,
      departmentId: departmentId || undefined,
      province: province || undefined,
      district: district.trim() || undefined,
      assignedOfficer: assignedOfficer || undefined,
      resolvedImageBase64,
      timeline: updatedTimeline,
    };

    onSave(updated);
    setNewLogTitle("");
    setNewLogDesc("");
    setIsAddingLog(false);
  };

  const handleSaveAll = () => {
    let timeline = complaint.timeline || [];
    if (status !== complaint.status) {
      const now = new Date();
      timeline = [
        ...timeline,
        {
          id: `status-change-${Date.now()}`,
          date: now.toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric" }),
          time: now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          title: `ปรับสถานะเป็น "${STATUS_CONFIG[status].label}"`,
          description: `เจ้าหน้าที่ผู้รับผิดชอบอัปเดตสถานะการดำเนินงานในระบบ`,
          status: status,
          officer: assignedOfficer || "เจ้าหน้าที่แอดมิน",
          icon: STATUS_CONFIG[status].icon,
        },
      ];
    }

    const updated: ComplaintReport = {
      ...complaint,
      status,
      priority,
      departmentId: departmentId || undefined,
      province: province || undefined,
      district: district.trim() || undefined,
      assignedOfficer: assignedOfficer || undefined,
      resolvedImageBase64,
      timeline,
    };

    onSave(updated);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header (iOS Light & Dark Glass Adaptive) */}
        <div className="relative p-5 sm:p-6 bg-gradient-to-br from-slate-50 via-sky-50/60 to-white dark:from-slate-900 dark:via-slate-800 dark:to-slate-900 text-slate-900 dark:text-white border-b border-slate-200/80 dark:border-white/10">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-8 h-8 rounded-full bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white flex items-center justify-center transition cursor-pointer"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>

          <div className="flex flex-wrap items-center gap-2 mb-2 pr-10">
            <span className="font-mono text-xs font-black text-sky-700 dark:text-cyan-400 bg-sky-500/15 dark:bg-cyan-950/60 border border-sky-500/30 dark:border-cyan-500/40 px-2.5 py-0.5 rounded-full">
              {complaint.id}
            </span>
            <span
              className="flex items-center gap-1 text-xs font-black px-2.5 py-0.5 rounded-full text-white"
              style={{ backgroundColor: cat?.color ?? "#64748b" }}
            >
              <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-xs" />
              {cat?.label}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">แจ้งเมื่อ {complaint.createdAt}</span>
            {complaint.isAnonymous ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 dark:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30">
                <JKIcon name="user-secret" className="text-[9px]" />
                ไม่ระบุตัวตน
              </span>
            ) : (
              complaint.reporterMemberId && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                  <JKIcon name="user-check" className="text-[9px]" />
                  สมาชิกยืนยันตัวตน
                </span>
              )
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight pr-8">
            {complaint.title}
          </h2>
        </div>

        {/* Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6 custom-scrollbar">
          {/* Status Switcher Bar */}
          <div>
            <label className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider block mb-2.5">
              สถานะการดำเนินงาน
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS_CONFIG) as ComplaintStatus[]).map((sKey) => {
                const conf = STATUS_CONFIG[sKey];
                const isSelected = status === sKey;
                return (
                  <button
                    key={sKey}
                    type="button"
                    onClick={() => setStatus(sKey)}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl text-xs font-black transition cursor-pointer border ${
                      isSelected
                        ? conf.activeClass
                        : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10"
                    }`}
                  >
                    <JKIcon name={conf.icon} />
                    <span>{conf.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Department, District & Officer Assignment */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <JKIcon name="building-columns" className="text-cyan-600 dark:text-cyan-400 text-xs" />
                หน่วยงานที่รับผิดชอบ
              </label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer"
              >
                <option value="">-- ยังไม่ได้ระบุหน่วยงาน --</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
              {dept && (
                <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-2">
                  <span>SLA เป้าหมาย: {dept.slaHours} ชม.</span>
                  <span>โทร: {dept.contactPhone}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 block flex items-center gap-1.5">
                <JKIcon name="map-pin" className="text-red-500 text-xs" />
                จังหวัดและพื้นที่รับผิดชอบ (77 จังหวัด)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  aria-label="จังหวัด"
                  value={province}
                  onChange={(e) => {
                    const nextProv = e.target.value;
                    setProvince(nextProv);
                    setDistrict(getDefaultDistrictForProvince(nextProv));
                  }}
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition cursor-pointer"
                >
                  {PROVINCE_GROUPS.map((group) => (
                    <optgroup key={group.region} label={`${group.region} (${group.provinces.length})`}>
                      {group.provinces.map((prov) => (
                        <option key={prov} value={prov}>
                          {prov}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>

                <input
                  type="text"
                  list="admin-district-suggestions"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="ระบุเขต / อำเภอ / ย่าน"
                  className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
                />
                <datalist id="admin-district-suggestions">
                  {getDistrictsForProvince(province).map((dist) => (
                    <option key={dist.pcode} value={dist.displayTh} />
                  ))}
                </datalist>
              </div>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 block">
                พิกัด: {complaint.coordinates[1].toFixed(5)}°N, {complaint.coordinates[0].toFixed(5)}°E
              </span>
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <JKIcon name="user-tie" className="text-amber-600 dark:text-amber-400 text-xs" />
                เจ้าหน้าที่ / ทีมปฏิบัติการที่รับผิดชอบ
              </label>
              <input
                type="text"
                value={assignedOfficer}
                onChange={(e) => setAssignedOfficer(e.target.value)}
                placeholder="ระบุชื่อเจ้าหน้าที่ หรือทีมช่าง..."
                className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
            </div>

            <div>
              <label className="text-xs font-black text-slate-700 dark:text-slate-200 block mb-1.5 flex items-center gap-1.5">
                <JKIcon name="gauge-high" className="text-orange-500 text-xs" />
                ระดับความเร่งด่วน
              </label>
              <div className="grid grid-cols-4 gap-1.5">
                {(Object.keys(PRIORITY_CONFIG) as ComplaintPriority[]).map((pKey) => {
                  const pConf = PRIORITY_CONFIG[pKey];
                  const isSelected = priority === pKey;
                  return (
                    <button
                      key={pKey}
                      type="button"
                      onClick={() => setPriority(pKey)}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-center transition cursor-pointer ${
                        isSelected
                          ? pConf.activeClass
                          : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      {pConf.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/^[a-f0-9-]{36}$/i.test(complaint.id) && (
            <AgencyReferralPanel key={complaint.id} complaint={complaint} />
          )}

          {/* Description & Reporter */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-3">
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider block">
                รายละเอียดเรื่องร้องเรียน
              </span>
              <p className="text-xs sm:text-sm text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {complaint.description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200 dark:border-white/10 text-xs">
              <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                <JKIcon name="user" className="text-slate-400" />
                <span>ผู้แจ้ง: <strong className="text-slate-900 dark:text-white">{complaint.reporterName}</strong></span>
                {complaint.phone && (
                  <a
                    href={`tel:${complaint.phone}`}
                    className="ml-2 text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <JKIcon name="phone" className="text-[10px]" />
                    {complaint.phone}
                  </a>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">เสียงโหวตชุมชน:</span>
                <span className="px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-600 dark:text-orange-400 font-bold font-mono text-[11px]">
                  {complaint.upvotes ?? 0} โหวต
                </span>
              </div>
            </div>

            {complaint.imageBase64 && (
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 block mb-1.5">ภาพถ่ายหลักฐานจากผู้แจ้ง:</span>
                <div className="relative rounded-xl overflow-hidden max-h-48 bg-slate-950/20">
                  <img src={complaint.imageBase64} alt={complaint.title} className="w-full h-44 object-cover" />
                </div>
              </div>
            )}

            {/* Resolution After Photo Upload */}
            <div className="pt-2 border-t border-slate-200 dark:border-white/10">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                  <JKIcon name="camera-retro" className="text-xs" />
                  ภาพยืนยันหลังการแก้ไข (After Photo)
                </span>
                <div className="flex items-center gap-2">
                  {resolvedImageBase64 && (
                    <button
                      type="button"
                      onClick={() => setResolvedImageBase64(undefined)}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer"
                    >
                      ลบรูป
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => resolvedInputRef.current?.click()}
                    disabled={isCompressingPhoto}
                    className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold cursor-pointer transition"
                  >
                    {isCompressingPhoto ? "กำลังย่อรูป..." : resolvedImageBase64 ? "เปลี่ยนรูป" : "+ แนบรูปผลดำเนินการ"}
                  </button>
                </div>
                <input
                  ref={resolvedInputRef}
                  type="file"
                  accept="image/*"
                  onChange={(e) => void handleUploadResolvedPhoto(e)}
                  className="hidden"
                />
              </div>
              {resolvedImageBase64 && (
                <div className="relative rounded-xl overflow-hidden max-h-44 border border-emerald-500/30">
                  <img src={resolvedImageBase64} alt="ผลดำเนินการ" className="w-full h-40 object-cover" />
                </div>
              )}
            </div>
          </div>

          {/* Timeline & Progress Log Form */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <JKIcon name="timeline" className="text-cyan-500" />
                ไทม์ไลน์การปฏิบัติงานและการลงพื้นที่
              </h4>
              <button
                type="button"
                onClick={() => setIsAddingLog(!isAddingLog)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition cursor-pointer"
              >
                <JKIcon name={isAddingLog ? "chevron-up" : "plus"} className="text-xs" />
                <span>{isAddingLog ? "ซ่อนแบบฟอร์ม" : "เพิ่มบันทึกความคืบหน้า"}</span>
              </button>
            </div>

            {/* Add log form */}
            {isAddingLog && (
              <div className="p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 space-y-3 mb-4 animate-in fade-in duration-150">
                <h5 className="text-xs font-black text-cyan-900 dark:text-cyan-200">
                  บันทึกการลงพื้นที่ / ความคืบหน้าใหม่
                </h5>
                <div>
                  <input
                    type="text"
                    value={newLogTitle}
                    onChange={(e) => setNewLogTitle(e.target.value)}
                    placeholder="หัวข้อ เช่น ทีมช่างลงพื้นที่ตรวจสอบ, ซ่อมแซมเรียบร้อย..."
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  />
                </div>
                <div>
                  <textarea
                    value={newLogDesc}
                    onChange={(e) => setNewLogDesc(e.target.value)}
                    placeholder="รายละเอียดผลการตรวจสอบหรือการดำเนินงาน..."
                    rows={2}
                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 resize-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={newLogOfficer}
                    onChange={(e) => setNewLogOfficer(e.target.value)}
                    placeholder="ชื่อผู้บันทึก / เจ้าหน้าที่..."
                    className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={handleAppendLog}
                    disabled={!newLogTitle.trim()}
                    className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-black cursor-pointer transition shadow-sm"
                  >
                    บันทึกทันที
                  </button>
                </div>
              </div>
            )}

            {/* Existing Timeline list */}
            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {(complaint.timeline || []).map((ev) => (
                <div
                  key={ev.id}
                  className="p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200/70 dark:border-white/10 flex items-start gap-3"
                >
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${
                      STATUS_CONFIG[ev.status]?.bgClass || "bg-slate-200"
                    }`}
                  >
                    <JKIcon name={ev.icon || "circle-dot"} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-black text-slate-900 dark:text-white">
                        {ev.title}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {ev.date} {ev.time}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      {ev.description}
                    </p>
                    {ev.officer && (
                      <span className="text-[10px] text-slate-400 font-medium block mt-1">
                        ผู้ปฏิบัติการ: {ev.officer}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Citizen Comments & Officer Reply */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 space-y-2.5">
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <JKIcon name="comments" className="text-indigo-500" />
              ความคิดเห็นประชาชน & ตอบกลับ ({(complaint.comments ?? []).length})
            </h4>

            {(complaint.comments ?? []).length > 0 ? (
              <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                {(complaint.comments ?? []).map((cmt) => (
                  <div
                    key={cmt.id}
                    className={`p-2.5 rounded-xl border text-xs ${
                      cmt.role === "officer"
                        ? "bg-cyan-500/10 border-cyan-500/25"
                        : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-900 dark:text-white">
                        {cmt.author}
                        {cmt.role === "officer" && (
                          <span className="ml-1.5 px-1.5 py-0.5 rounded bg-cyan-600 text-white text-[9px] font-black">
                            เจ้าหน้าที่
                          </span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-400">{cmt.createdAt}</span>
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">{cmt.text}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-slate-400">ยังไม่มีข้อความจากประชาชน</p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={officerReply}
                onChange={(e) => setOfficerReply(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAppendReply();
                  }
                }}
                placeholder="ตอบกลับประชาชนในฐานะเจ้าหน้าที่..."
                className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-white/15 rounded-xl px-3 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
              <button
                type="button"
                onClick={handleAppendReply}
                disabled={!officerReply.trim()}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-bold cursor-pointer transition"
              >
                ส่งตอบกลับ
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-200 dark:border-white/10 bg-slate-50/80 dark:bg-slate-900/80 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Link
              href={`/?complaint=${encodeURIComponent(complaint.id)}`}
              className="px-3 py-2 rounded-xl border border-slate-200 dark:border-white/15 bg-white dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <JKIcon name="map-location-dot" className="text-cyan-500 text-xs" />
              <span>ดูบนแผนที่</span>
            </Link>

            {onDelete && (
              confirmDelete ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      onDelete(complaint.id);
                      onClose();
                    }}
                    className="px-3 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black transition cursor-pointer"
                  >
                    ยืนยันลบ
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-2.5 py-2 rounded-xl bg-slate-200 dark:bg-white/10 text-slate-700 dark:text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    ไม่ลบ
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="px-3 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-bold transition cursor-pointer flex items-center gap-1"
                >
                  <JKIcon name="trash" className="text-[11px]" />
                  <span>ลบเคส</span>
                </button>
              )
            )}
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-bold transition cursor-pointer"
            >
              ยกเลิก
            </button>

            <button
              type="button"
              onClick={handleSaveAll}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-black shadow-lg shadow-cyan-600/30 transition cursor-pointer active:scale-95 flex items-center gap-2"
            >
              <JKIcon name="floppy-disk" />
              <span>บันทึกข้อมูล</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
