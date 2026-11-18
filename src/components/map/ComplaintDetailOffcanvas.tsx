"use client";

import React, { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  getDefaultDepartmentForCategory,
  inferProvinceFromCoord,
  inferDistrictFromCoord,
  type ComplaintPriority,
  type ComplaintReport,
  type ComplaintStatus,
} from "@/data/map-data";
import {
  getAllDepartmentsSnapshot,
  getServerDepartmentsSnapshot,
  subscribeDepartments,
} from "@/lib/departments-store";
import { type CitizenMember } from "@/lib/citizen-auth";

interface ComplaintDetailOffcanvasProps {
  complaint: ComplaintReport | null;
  isOpen: boolean;
  onClose: () => void;
  isUpvoted?: boolean;
  onToggleUpvote?: (id: string) => void;
  onShare?: (c: ComplaintReport) => void;
  onAddComment?: (complaintId: string, author: string, text: string) => void;
  citizenMember?: CitizenMember | null;
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; icon: string; bg: string }> = {
  pending: {
    label: "รอดำเนินการ",
    color: "#f59e0b",
    icon: "clock",
    bg: "bg-amber-500",
  },
  inprogress: {
    label: "กำลังดำเนินการ",
    color: "#3b82f6",
    icon: "arrows-spin",
    bg: "bg-blue-500",
  },
  resolved: {
    label: "แก้ไขแล้ว",
    color: "#22c55e",
    icon: "circle-check",
    bg: "bg-green-500",
  },
};

const PRIORITY_BADGE: Record<ComplaintPriority, { label: string; icon: string; className: string }> = {
  urgent: {
    label: "เร่งด่วนมาก",
    icon: "triangle-exclamation",
    className: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30",
  },
  high: {
    label: "ความสำคัญสูง",
    icon: "circle-up",
    className: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
  },
  medium: {
    label: "ปานกลาง",
    icon: "circle-dot",
    className: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  low: {
    label: "ปกติ",
    icon: "circle-down",
    className: "bg-slate-500/15 text-slate-600 dark:text-slate-400 border-slate-500/30",
  },
};

function getProgressPercent(status: ComplaintStatus): number {
  switch (status) {
    case "pending":
      return 25;
    case "inprogress":
      return 65;
    case "resolved":
      return 100;
  }
}

function getStepIndex(status: ComplaintStatus, timelineLength: number): number {
  if (status === "resolved") return 3;
  if (status === "inprogress") return 2;
  return timelineLength > 1 ? 1 : 0;
}

export function ComplaintDetailOffcanvas({
  complaint,
  isOpen,
  onClose,
  isUpvoted = false,
  onToggleUpvote,
  onShare,
  onAddComment,
  citizenMember,
}: ComplaintDetailOffcanvasProps) {
  const departments = useSyncExternalStore(
    subscribeDepartments,
    getAllDepartmentsSnapshot,
    getServerDepartmentsSnapshot
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const lightboxRef = useRef<HTMLDialogElement>(null);

  const [copiedType, setCopiedType] = useState<"id" | "coord" | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption: string } | null>(null);
  const [commentAuthor, setCommentAuthor] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentError, setCommentError] = useState("");

  // Reset scroll when complaint changes
  useEffect(() => {
    if (isOpen && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [complaint?.id, isOpen]);

  // Close on Escape (only when lightbox is not open)
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !lightboxImage) {
        onClose();
      }
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose, lightboxImage]);

  // Open native modal <dialog> for image lightbox with fallback light-dismiss
  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!dialog) return;

    if (lightboxImage) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [lightboxImage]);

  useEffect(() => {
    const dialog = lightboxRef.current;
    if (!dialog) return;

    const handleClose = () => setLightboxImage(null);
    dialog.addEventListener("close", handleClose);

    // Fallback for browsers without native `closedby="any"` support (e.g. Safari)
    let cleanupPointer = () => {};
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom;
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e)) dialog.close();
      };
      dialog.addEventListener("pointerdown", onDown);
      dialog.addEventListener("pointerup", onUp);
      cleanupPointer = () => {
        dialog.removeEventListener("pointerdown", onDown);
        dialog.removeEventListener("pointerup", onUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupPointer();
    };
  }, []);

  if (!complaint) return null;

  const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
  const statusCfg = STATUS_CONFIG[complaint.status];
  const progress = getProgressPercent(complaint.status);
  const timeline = complaint.timeline ?? [];
  const comments = complaint.comments ?? [];
  const priorityCfg = PRIORITY_BADGE[complaint.priority ?? "medium"];
  const resolvedDeptId = complaint.departmentId || getDefaultDepartmentForCategory(complaint.categoryId);
  const dept = departments.find((d) => d.id === resolvedDeptId);
  const activeStep = getStepIndex(complaint.status, timeline.length);

  const latStr = complaint.coordinates[1].toFixed(5);
  const lngStr = complaint.coordinates[0].toFixed(5);
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${complaint.coordinates[1]},${complaint.coordinates[0]}`;

  const handleCopy = async (text: string, type: "id" | "coord") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedType(type);
      setTimeout(() => setCopiedType(null), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleSubmitComment = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanText = commentText.trim();
    if (!cleanText) {
      setCommentError("กรุณากรอกข้อความติดตามหรือความคิดเห็นก่อนส่ง");
      return;
    }
    setCommentError("");
    onAddComment?.(
      complaint.id,
      commentAuthor.trim() || citizenMember?.displayName || "พลเมืองในพื้นที่",
      cleanText
    );
    setCommentText("");
  };

  const STEPS = [
    { label: "รับเรื่อง", icon: "inbox" },
    { label: "ส่งต่อ", icon: "paper-plane" },
    { label: "กำลังแก้ไข", icon: "wrench" },
    { label: "เสร็จสิ้น", icon: "circle-check" },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px] transition-opacity duration-300 ${
          isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Offcanvas Panel: Mobile Bottom Sheet (< md) vs Desktop Right Drawer (md+) */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-detail-title"
        className={`fixed z-50 flex flex-col
          ios-glass-sheet
          inset-x-0 bottom-0 top-auto h-[96dvh] max-h-[96dvh] w-full rounded-t-[32px] rounded-b-none border-t border-x-0 border-b-0
          shadow-[0_-8px_40px_rgba(0,0,0,0.22)]
          ${isOpen ? "translate-y-0" : "translate-y-full pointer-events-none"}
          md:inset-x-auto md:inset-y-0 md:right-0 md:h-dvh md:max-h-none md:w-[440px] md:max-w-[calc(100vw-16px)] md:rounded-l-[32px] md:rounded-r-none md:border-l md:border-t-0 md:border-r-0 md:border-b-0
          md:shadow-[-8px_0_40px_rgba(0,0,0,0.18)] md:dark:shadow-[-8px_0_40px_rgba(0,0,0,0.55)]
          ${isOpen ? "md:translate-x-0 md:translate-y-0" : "md:translate-x-full md:translate-y-0 md:pointer-events-none"}
          overflow-hidden
          transition-transform duration-300 ease-out`}
      >
        {/* Mobile Pull Grab Handle */}
        <button
          type="button"
          onClick={onClose}
          aria-label="ปิดหน้าต่างรายละเอียด"
          className="md:hidden w-full pt-2.5 pb-1.5 flex justify-center bg-transparent cursor-pointer shrink-0"
        >
          <span className="w-12 h-1.5 rounded-full bg-slate-500/30 dark:bg-white/30" />
        </button>

        {/* ═══════ TOP STICKY BAR ═══════ */}
        <div className="flex-shrink-0 flex items-center justify-between px-5 pt-2 md:pt-4 pb-3 border-b border-slate-900/[0.06] dark:border-white/[0.08]">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => handleCopy(complaint.id, "id")}
              className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold px-2.5 py-1 rounded-xl bg-white/80 dark:bg-white/10 border border-white/85 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/20 transition cursor-pointer"
              title="คลิกเพื่อคัดลอกรหัสเคส"
            >
              <span>#{complaint.id}</span>
              <JKIcon
                name={copiedType === "id" ? "check" : "copy"}
                className={`text-[10px] ${copiedType === "id" ? "text-emerald-500" : "opacity-60"}`}
              />
            </button>
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-lg border ${priorityCfg.className}`}
            >
              <JKIcon name={priorityCfg.icon} className="text-[9px]" />
              {priorityCfg.label}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/75 dark:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-white/20 transition cursor-pointer"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>
        </div>

        {/* ═══════ SCROLLABLE CONTENT ═══════ */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
          {/* Evidence Photo Showcase (bright, clickable to zoom) */}
          {complaint.imageBase64 && (
            <div className="px-5 pt-4">
              <button
                type="button"
                onClick={() =>
                  setLightboxImage({
                    src: complaint.imageBase64!,
                    caption: `${complaint.title} (ภาพถ่ายหลักฐาน)`,
                  })
                }
                className="group relative w-full h-44 sm:h-48 rounded-2xl overflow-hidden border border-slate-200/80 dark:border-white/15 shadow-md block cursor-zoom-in text-left"
              >
                <img
                  src={complaint.imageBase64}
                  alt={complaint.title}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />
                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
                  <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-black/55 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-xl">
                    <JKIcon name="camera" className="text-[9px] text-sky-300" />
                    ภาพจุดเกิดเหตุ
                  </span>
                </div>
                <div className="absolute top-2.5 right-2.5 w-8 h-8 rounded-xl bg-black/55 backdrop-blur-md border border-white/20 text-white flex items-center justify-center opacity-85 group-hover:opacity-100 group-hover:scale-105 transition">
                  <JKIcon name="expand" className="text-xs" />
                </div>
                <div className="absolute bottom-2.5 left-3 right-3 flex items-center justify-between text-[10px] text-white/90 font-medium">
                  <span className="truncate font-mono">{complaint.imageName || "evidence-photo.jpg"}</span>
                  <span className="shrink-0 font-bold text-sky-300">แตะเพื่อขยายภาพ</span>
                </div>
              </button>
            </div>
          )}

          {/* Header Summary Block */}
          <div className="px-5 pt-4 pb-3">
            {/* Category + Status pills */}
            <div className="flex items-center gap-2 mb-2.5 flex-wrap">
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black text-white shadow-xs"
                style={{ backgroundColor: cat?.color ?? "#64748b" }}
              >
                <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[10px]" />
                {cat?.label}
              </span>
              <span
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black"
                style={{ backgroundColor: `${statusCfg.color}20`, color: statusCfg.color }}
              >
                <JKIcon name={statusCfg.icon} className="text-[10px]" />
                {statusCfg.label}
              </span>
              <span className="ml-auto text-[11px] text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1">
                <JKIcon name="calendar" className="text-[10px]" />
                {complaint.createdAt}
              </span>
            </div>

            {/* Title */}
            <h2
              id="complaint-detail-title"
              className="text-lg font-black leading-snug text-slate-900 dark:text-white mb-2"
            >
              {complaint.title}
            </h2>

            {/* Step-by-step Progress Stepper + Bar */}
            <div className="p-3.5 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none mt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                  สถานะความคืบหน้า
                </span>
                <span className="text-[11px] font-black font-mono" style={{ color: statusCfg.color }}>
                  {progress}%
                </span>
              </div>

              <div className="h-2 rounded-full overflow-hidden bg-slate-200/80 dark:bg-white/10 mb-3">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${progress}%`,
                    background: `linear-gradient(90deg, ${statusCfg.color}, ${statusCfg.color}cc)`,
                  }}
                />
              </div>

              <div className="grid grid-cols-4 gap-1">
                {STEPS.map((st, idx) => {
                  const done = idx <= activeStep;
                  const current = idx === activeStep;
                  return (
                    <div key={st.label} className="flex flex-col items-center text-center">
                      <div
                        className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] transition-all mb-1 ${
                          done
                            ? "text-white shadow-xs"
                            : "bg-slate-200/90 dark:bg-white/10 text-slate-500 dark:text-slate-400"
                        } ${current ? "ring-2 ring-offset-2 ring-offset-white dark:ring-offset-slate-900" : ""}`}
                        style={
                          done
                            ? {
                                backgroundColor: statusCfg.color,
                                ...(current ? { ["--tw-ring-color" as string]: statusCfg.color } : {}),
                              }
                            : {}
                        }
                      >
                        <JKIcon name={st.icon} />
                      </div>
                      <span
                        className={`text-[9px] font-bold leading-tight ${
                          done ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {st.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="px-5 pb-3">
            <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5 flex items-center gap-1.5">
              <JKIcon name="align-left" className="text-[10px] text-slate-500 dark:text-slate-400" />
              รายละเอียดปัญหา
            </h3>
            <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed bg-white/82 dark:bg-slate-900/60 p-3 rounded-2xl border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              {complaint.description}
            </p>
          </div>

          {/* Reporter & Contact Cards */}
          <div className="px-5 pb-2.5 grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-lg bg-slate-200/80 dark:bg-white/10 flex items-center justify-center">
                  <JKIcon
                    name={complaint.isAnonymous ? "user-secret" : "user-check"}
                    className={`text-[9px] ${
                      complaint.isAnonymous
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-slate-600 dark:text-slate-300"
                    }`}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">ผู้แจ้งเรื่อง</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                  {complaint.isAnonymous ? "ผู้แจ้งไม่ระบุตัวตน" : complaint.reporterName}
                </p>
                {complaint.isAnonymous ? (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[9px] font-black shrink-0">
                    ปกปิดตัวตน
                  </span>
                ) : (
                  complaint.reporterMemberId && (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black shrink-0">
                      สมาชิก
                    </span>
                  )
                )}
              </div>
            </div>

            <div className="p-3 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-lg bg-slate-200/80 dark:bg-white/10 flex items-center justify-center">
                  <JKIcon name="phone" className="text-[9px] text-slate-600 dark:text-slate-300" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">โทรศัพท์ผู้แจ้ง</span>
              </div>
              {complaint.phone ? (
                <a
                  href={`tel:${complaint.phone}`}
                  className="text-[11px] font-bold text-teal-600 dark:text-cyan-400 hover:underline truncate block"
                >
                  {complaint.phone}
                </a>
              ) : (
                <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">ไม่ระบุ</p>
              )}
            </div>
          </div>

          {/* District & Department Info Cards */}
          <div className="px-5 pb-2.5 grid grid-cols-2 gap-2">
            <div className="p-3 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-lg bg-sky-500/10 dark:bg-sky-500/20 flex items-center justify-center">
                  <JKIcon name="map-pin" className="text-[9px] text-sky-600 dark:text-sky-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">จังหวัด / พื้นที่</span>
              </div>
              <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate">
                {complaint.province || inferProvinceFromCoord(complaint.coordinates)}
                {complaint.district ? ` · ${complaint.district}` : ` · ${inferDistrictFromCoord(complaint.coordinates)}`}
              </p>
              {dept && (
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5">
                  SLA เป้าหมาย: {dept.slaHours} ชม.
                </p>
              )}
            </div>

            <div className="p-3 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="w-5 h-5 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                  <JKIcon name="building-columns" className="text-[9px] text-indigo-600 dark:text-indigo-400" />
                </div>
                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">หน่วยงานรับผิดชอบ</span>
              </div>
              <p className="text-[11px] font-bold text-slate-900 dark:text-white truncate" title={dept?.name}>
                {dept ? dept.name.replace("สำนัก", "สน.") : "อยู่ระหว่างประสานงาน"}
              </p>
              {complaint.assignedOfficer ? (
                <p className="text-[9px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                  {complaint.assignedOfficer}
                </p>
              ) : dept?.contactPhone ? (
                <a
                  href={`tel:${dept.contactPhone}`}
                  className="text-[9px] text-indigo-600 dark:text-indigo-400 hover:underline mt-0.5 block"
                >
                  สายตรง: {dept.contactPhone}
                </a>
              ) : null}
            </div>
          </div>

          {/* Actionable Coordinates Bar */}
          <div className="px-5 pb-4">
            <div className="flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)] dark:shadow-none">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-7 h-7 rounded-xl bg-teal-500/10 dark:bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <JKIcon name="location-dot" className="text-teal-600 dark:text-cyan-400 text-xs" />
                </div>
                <span className="text-[11px] font-mono font-bold text-slate-800 dark:text-slate-100 truncate">
                  {latStr}°N, {lngStr}°E
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopy(`${latStr}, ${lngStr}`, "coord")}
                  className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200/80 dark:border-white/15 text-[10px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer flex items-center gap-1"
                  title="คัดลอกพิกัด"
                >
                  <JKIcon
                    name={copiedType === "coord" ? "check" : "copy"}
                    className={`text-[9px] ${copiedType === "coord" ? "text-emerald-500" : ""}`}
                  />
                  <span>{copiedType === "coord" ? "คัดลอกแล้ว" : "คัดลอก"}</span>
                </button>
                <a
                  href={mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-bold transition flex items-center gap-1 shadow-xs"
                  title="เปิดใน Google Maps"
                >
                  <JKIcon name="diamond-turn-right" className="text-[9px]" />
                  <span>นำทาง</span>
                </a>
              </div>
            </div>
          </div>

          {/* Citizen Crowd Support Card */}
          <div className="mx-5 mb-4 p-4 rounded-3xl bg-white/82 dark:bg-slate-900/60 border border-orange-400/40 relative overflow-hidden shadow-[0_2px_10px_-3px_rgba(249,115,22,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-orange-500 text-white flex items-center gap-1">
                    <JKIcon name="fire" className="text-[8px]" />
                    พลังเสียงชุมชน
                  </span>
                  <span className="text-[11px] font-mono font-black text-orange-600 dark:text-orange-400">
                    {complaint.upvotes ?? 0} คนร่วมโหวต
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 dark:text-slate-200 font-medium leading-tight">
                  {isUpvoted
                    ? "ขอบคุณที่ร่วมเป็นกระบอกเสียง! คุณได้ร่วมผลักดันปัญหานี้แล้ว"
                    : "กด +1 เพื่อช่วยให้เจ้าหน้าที่จัดลำดับความสำคัญของปัญหานี้ได้เร็วขึ้น"}
                </p>
              </div>

              <button
                type="button"
                onClick={() => onToggleUpvote?.(complaint.id)}
                className={`flex-shrink-0 flex flex-col items-center justify-center px-4 py-2.5 rounded-2xl font-black text-xs transition-all cursor-pointer shadow-md ${
                  isUpvoted
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/30 scale-105"
                    : "bg-white dark:bg-slate-800 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-slate-700 border border-orange-300/70 dark:border-orange-500/30"
                }`}
              >
                <JKIcon name="thumbs-up" className={`text-base mb-0.5 ${isUpvoted ? "animate-bounce" : ""}`} />
                <span>{isUpvoted ? "โหวตแล้ว" : "+1 โหวต"}</span>
              </button>
            </div>
          </div>

          {/* Resolved Celebration Banner + Resolution Photo */}
          {complaint.status === "resolved" && (
            <div className="mx-5 mb-4 p-4 rounded-2xl bg-gradient-to-r from-emerald-500/15 via-green-500/10 to-teal-500/10 border border-emerald-500/30 space-y-3 relative overflow-hidden shadow-xs">
              <div className="flex items-center gap-3.5">
                <div className="relative w-14 h-14 flex-shrink-0">
                  <img
                    src="/images/mascot_success.png"
                    alt="Inspector Approved"
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                      แก้ไขปัญหาเสร็จสิ้นแล้ว!
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-500/30">
                      Approved
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-snug">
                    เจ้าหน้าที่ตรวจสอบและดำเนินการแก้ไขเรียบร้อย พร้อมปิดงาน
                  </p>
                </div>
              </div>

              {complaint.resolvedImageBase64 && (
                <button
                  type="button"
                  onClick={() =>
                    setLightboxImage({
                      src: complaint.resolvedImageBase64!,
                      caption: `${complaint.title} (ภาพหลังแก้ไขเสร็จสิ้น)`,
                    })
                  }
                  className="group relative w-full h-32 rounded-xl overflow-hidden border border-emerald-500/30 block cursor-zoom-in"
                >
                  <img
                    src={complaint.resolvedImageBase64}
                    alt="ภาพหลังแก้ไข"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end justify-between p-2.5">
                    <span className="text-[10px] font-bold text-emerald-300 flex items-center gap-1">
                      <JKIcon name="circle-check" className="text-xs" />
                      ภาพถ่ายหลังดำเนินการแก้ไข
                    </span>
                    <span className="text-[10px] font-bold text-white/90">ขยายดู</span>
                  </div>
                </button>
              )}
            </div>
          )}

          {/* ═══════ TIMELINE / TRACKING ═══════ */}
          <div className="px-5 pb-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <JKIcon name="timeline" className="text-[10px] text-slate-500 dark:text-slate-400" />
                ไทม์ไลน์การดำเนินการ
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10 border border-white/85 dark:border-white/15 text-slate-600 dark:text-slate-300">
                {timeline.length} ขั้นตอน
              </span>
            </div>

            {timeline.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-5 text-center rounded-2xl bg-white/82 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14]">
                <div className="relative w-14 h-14 mb-2">
                  <img
                    src="/images/mascot_searching.png"
                    alt="Checking Timeline"
                    className="w-full h-full object-contain drop-shadow-md"
                  />
                </div>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">กำลังรออัปเดตไทม์ไลน์</p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">เจ้าหน้าที่จะอัปเดตขั้นตอนการดำเนินงานในเร็วๆ นี้</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[15px] top-3 bottom-3 w-[2px] bg-slate-300/70 dark:bg-white/15 rounded-full" />

                <div className="space-y-0">
                  {[...timeline].reverse().map((event, index) => {
                    const isFirst = index === 0;
                    const isLast = index === timeline.length - 1;
                    const eventStatusCfg = STATUS_CONFIG[event.status];

                    return (
                      <div key={event.id} className="relative flex gap-3 group">
                        <div className="relative z-10 flex-shrink-0 flex flex-col items-center">
                          <div
                            className={`w-[30px] h-[30px] rounded-xl flex items-center justify-center shadow-sm border-2 transition-all ${
                              isFirst
                                ? "border-white dark:border-slate-800 scale-110"
                                : "border-white dark:border-slate-900"
                            }`}
                            style={{
                              backgroundColor: isFirst ? eventStatusCfg.color : `${eventStatusCfg.color}25`,
                              color: isFirst ? "#fff" : eventStatusCfg.color,
                            }}
                          >
                            <JKIcon name={event.icon} className="text-[10px]" />
                          </div>
                        </div>

                        <div className={`flex-1 pb-4 ${isLast ? "pb-0" : ""}`}>
                          <div
                            className={`p-3 rounded-2xl border transition-all ${
                              isFirst
                                ? "border-white/90 dark:border-white/15 bg-white/90 dark:bg-slate-900/70 shadow-sm"
                                : "border-white/75 dark:border-white/10 bg-white/75 dark:bg-slate-900/45"
                            } group-hover:bg-white/95 dark:group-hover:bg-slate-900/75 group-hover:border-white dark:group-hover:border-white/20 group-hover:shadow-sm`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                                {event.date}
                              </span>
                              <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                                {event.time} น.
                              </span>
                              {isFirst && (
                                <span
                                  className="text-[9px] font-black px-1.5 py-0.5 rounded-md text-white"
                                  style={{ backgroundColor: eventStatusCfg.color }}
                                >
                                  ล่าสุด
                                </span>
                              )}
                            </div>

                            <h4 className="text-xs font-black text-slate-900 dark:text-white mb-0.5">{event.title}</h4>

                            <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
                              {event.description}
                            </p>

                            {event.officer && (
                              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-200/70 dark:border-white/10">
                                <JKIcon name="user-tie" className="text-[9px] text-slate-500 dark:text-slate-400" />
                                <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                                  {event.officer}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ═══════ CITIZEN COMMENTS / FOLLOW-UP NOTES ═══════ */}
          <div className="px-5 pb-6 pt-4 border-t border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                <JKIcon name="comments" className="text-[10px] text-teal-500" />
                ติดตามและแสดงความคิดเห็น
              </h3>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10 border border-white/85 dark:border-white/15 text-slate-600 dark:text-slate-300">
                {comments.length} ข้อความ
              </span>
            </div>

            {comments.length > 0 && (
              <div className="space-y-2 mb-3">
                {comments.map((cm) => (
                  <div
                    key={cm.id}
                    className={`p-3 rounded-2xl border text-xs ${
                      cm.role === "officer"
                        ? "bg-cyan-50/90 dark:bg-cyan-500/15 border-cyan-400/50"
                        : "bg-white/82 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14]"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="font-black text-slate-900 dark:text-white truncate">{cm.author}</span>
                        {cm.role === "officer" && (
                          <span className="px-1.5 py-0.5 rounded-md bg-cyan-600 text-white text-[9px] font-black">
                            เจ้าหน้าที่
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 shrink-0">{cm.createdAt}</span>
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">{cm.text}</p>
                  </div>
                ))}
              </div>
            )}

            {onAddComment && (
              <form onSubmit={handleSubmitComment} className="space-y-2" noValidate>
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="text"
                    name="commentAuthor"
                    value={commentAuthor}
                    onChange={(e) => setCommentAuthor(e.target.value)}
                    placeholder={
                      citizenMember
                        ? `ชื่อผู้แสดงความเห็น (ค่าเริ่มต้น: ${citizenMember.displayName})`
                        : "ชื่อของคุณ (ไม่ระบุ = พลเมืองในพื้นที่)"
                    }
                    maxLength={60}
                    className="w-full px-3 py-2 rounded-xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-slate-900/65 text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                  />
                  <div className="flex gap-2">
                    <input
                      type="text"
                      name="commentText"
                      value={commentText}
                      onChange={(e) => {
                        setCommentText(e.target.value);
                        if (commentError) setCommentError("");
                      }}
                      placeholder="อัปเดตสถานการณ์หน้างาน หรือส่งกำลังใจ..."
                      maxLength={300}
                      aria-invalid={commentError ? "true" : undefined}
                      aria-describedby={commentError ? "comment-error-msg" : undefined}
                      className="flex-1 px-3 py-2 rounded-xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-slate-900/65 text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 focus:ring-teal-500/40"
                    />
                    <button
                      type="submit"
                      className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black transition cursor-pointer shrink-0 flex items-center gap-1 active:scale-95"
                    >
                      <JKIcon name="paper-plane" className="text-[10px]" />
                      <span>ส่ง</span>
                    </button>
                  </div>
                </div>
                {commentError && (
                  <p id="comment-error-msg" role="alert" className="text-[11px] font-bold text-red-500">
                    {commentError}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>

        {/* ═══════ BOTTOM ACTION BAR ═══════ */}
        <div className="flex-shrink-0 px-5 py-3.5 border-t border-slate-900/[0.06] dark:border-white/[0.08] bg-white/55 dark:bg-slate-950/35">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-3 rounded-2xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-white/10
                text-xs font-bold text-slate-700 dark:text-slate-200
                hover:bg-white dark:hover:bg-white/20 active:scale-[0.98] transition-all cursor-pointer flex items-center gap-1.5"
            >
              <JKIcon name="arrow-left" className="text-[11px]" />
              <span>กลับ</span>
            </button>
            <Link
              href={`/admin?case=${encodeURIComponent(complaint.id)}`}
              className="px-3.5 py-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20
                text-xs font-bold text-cyan-700 dark:text-cyan-300 active:scale-[0.98] transition-all flex items-center gap-1.5"
              title="เปิดจัดการเคสนี้ในหน้าเจ้าหน้าที่"
            >
              <JKIcon name="user-shield" className="text-[11px]" />
              <span>เจ้าหน้าที่</span>
            </Link>
            <button
              type="button"
              onClick={() => onShare?.(complaint)}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl
                text-xs font-black text-white cursor-pointer
                bg-gradient-to-r from-teal-500 to-cyan-500
                hover:from-teal-400 hover:to-cyan-400 active:scale-[0.98]
                shadow-lg shadow-teal-500/25 transition-all"
            >
              <JKIcon name="share-nodes" className="text-xs" />
              <span>แชร์การ์ดปัญหา</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Native Modal <dialog> Lightbox for Evidence Photos */}
      <dialog
        ref={lightboxRef}
        closedby="any"
        aria-label={lightboxImage?.caption || "ภาพถ่ายหลักฐาน"}
        className="m-auto max-w-[92vw] max-h-[88vh] rounded-3xl bg-slate-950/95 text-white p-0 border border-white/15 shadow-2xl backdrop:bg-black/80 backdrop:backdrop-blur-md overflow-hidden"
      >
        {lightboxImage && (
          <div className="relative flex flex-col">
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10">
              <span className="text-xs font-bold text-white truncate">{lightboxImage.caption}</span>
              <button
                type="button"
                autoFocus
                onClick={() => lightboxRef.current?.close()}
                aria-label="ปิดภาพขยาย"
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer shrink-0"
              >
                <JKIcon name="xmark" className="text-sm" />
              </button>
            </div>
            <div className="p-2 flex items-center justify-center bg-black">
              <img
                src={lightboxImage.src}
                alt={lightboxImage.caption}
                className="max-w-[88vw] max-h-[75vh] object-contain rounded-xl"
              />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
