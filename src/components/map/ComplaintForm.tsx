"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  PROVINCE_GROUPS,
  getDefaultDepartmentForCategory,
  inferDistrictFromCoord,
  inferProvinceFromCoord,
  type ComplaintPriority,
  type ComplaintReport,
} from "@/data/map-data";
import {
  getDefaultDistrictForProvince,
  getDistrictsForProvince,
} from "@/data/thailand-districts";
import { compressImageFile } from "@/lib/image-utils";
import { type CitizenMember } from "@/lib/citizen-auth";
import {
  fetchReverseGeocode,
  type ReverseGeocodeResult,
} from "@/lib/external-apis";

interface ComplaintFormProps {
  isOpen: boolean;
  pendingCoord: [number, number] | null;
  onSubmit: (data: Omit<ComplaintReport, "id" | "createdAt" | "status">) => Promise<false | void>;
  onCancel: () => void;
  onRequestNewLocation: () => void;
  onSetPendingCoord?: (coord: [number, number]) => void;
  citizenMember?: CitizenMember | null;
  onOpenCitizenAuth?: (tab?: "login" | "register") => void;
}

const PRIORITY_OPTIONS: {
  id: ComplaintPriority;
  label: string;
  activeClass: string;
}[] = [
  {
    id: "low",
    label: "ต่ำ",
    activeClass:
      "border-slate-400 bg-slate-500/15 text-slate-800 dark:text-slate-100",
  },
  {
    id: "medium",
    label: "ปานกลาง",
    activeClass:
      "border-sky-500 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  },
  {
    id: "high",
    label: "สูง",
    activeClass:
      "border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  },
  {
    id: "urgent",
    label: "เร่งด่วน",
    activeClass:
      "border-red-500 bg-red-500/15 text-red-700 dark:text-red-300",
  },
];

type FormErrors = {
  location?: string;
  title?: string;
  description?: string;
  reporterName?: string;
};

export function ComplaintForm({
  isOpen,
  pendingCoord,
  onSubmit,
  onCancel,
  onRequestNewLocation,
  onSetPendingCoord,
  citizenMember,
  onOpenCitizenAuth,
}: ComplaintFormProps) {
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [manualReporterName, setManualReporterName] = useState<string | null>(null);
  const [manualPhone, setManualPhone] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("road");
  const [priority, setPriority] = useState<ComplaintPriority>("medium");
  const [manualProvince, setManualProvince] = useState<string | null>(null);
  const [manualDistrict, setManualDistrict] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [imageName, setImageName] = useState<string | undefined>();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isCompressingImage, setIsCompressingImage] = useState(false);
  const [imageError, setImageError] = useState("");
  const [isLocatingGps, setIsLocatingGps] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<{
    title?: boolean;
    description?: boolean;
    reporterName?: boolean;
  }>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [geoLookup, setGeoLookup] = useState<{
    key: string;
    data: ReverseGeocodeResult | null;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const locationBtnRef = useRef<HTMLButtonElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const descInputRef = useRef<HTMLTextAreaElement>(null);
  const reporterInputRef = useRef<HTMLInputElement>(null);

  const coordKey = pendingCoord
    ? `${pendingCoord[0].toFixed(5)},${pendingCoord[1].toFixed(5)}`
    : "";
  const resolvedGeo = coordKey && geoLookup?.key === coordKey ? geoLookup.data : null;
  const isResolvingGeo = Boolean(isOpen && coordKey && geoLookup?.key !== coordKey);

  useEffect(() => {
    if (!isOpen || !pendingCoord || !coordKey) return;
    if (geoLookup?.key === coordKey) return;

    const controller = new AbortController();
    fetchReverseGeocode(pendingCoord[1], pendingCoord[0], controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setGeoLookup({ key: coordKey, data });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setGeoLookup({ key: coordKey, data: null });
        }
      });

    return () => controller.abort();
  }, [isOpen, pendingCoord, coordKey, geoLookup?.key]);

  const effectiveReporterName = manualReporterName ?? (citizenMember?.displayName ?? "");
  const effectivePhone = manualPhone ?? (citizenMember?.phone ?? "");

  const effectiveProvince =
    manualProvince ??
    resolvedGeo?.matchedProvince ??
    (pendingCoord
      ? inferProvinceFromCoord(pendingCoord)
      : citizenMember?.homeProvince || "กรุงเทพมหานคร");

  const provinceDistricts = getDistrictsForProvince(effectiveProvince);

  const effectiveDistrict =
    manualDistrict ??
    resolvedGeo?.matchedDistrict ??
    (pendingCoord
      ? inferDistrictFromCoord(pendingCoord)
      : getDefaultDistrictForProvince(effectiveProvince));

  const resetForm = useCallback(() => {
    setIsAnonymous(false);
    setManualReporterName(null);
    setManualPhone(null);
    setTitle("");
    setDescription("");
    setCategoryId("road");
    setPriority("medium");
    setManualProvince(null);
    setManualDistrict(null);
    setImageBase64(undefined);
    setImageName(undefined);
    setIsDragOver(false);
    setIsCompressingImage(false);
    setImageError("");
    setIsLocatingGps(false);
    setGpsError("");
    setErrors({});
    setTouched({});
  }, []);

  const handleCancel = useCallback(() => {
    resetForm();
    onCancel();
  }, [onCancel, resetForm]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleCancel]);

  const processFile = useCallback(async (file: File) => {
    setImageError("");
    if (!file.type.startsWith("image/")) {
      setImageError("กรุณาอัปโหลดเฉพาะไฟล์รูปภาพ (JPG, PNG, WEBP)");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setImageError("ไฟล์รูปภาพต้นฉบับต้องมีขนาดไม่เกิน 12MB");
      return;
    }
    setIsCompressingImage(true);
    try {
      const compressed = await compressImageFile(file, {
        maxWidth: 1200,
        maxHeight: 900,
        quality: 0.8,
      });
      setImageBase64(compressed);
      setImageName(file.name);
    } catch (err) {
      setImageError(
        err instanceof Error ? err.message : "ไม่สามารถประมวลผลรูปภาพได้"
      );
    } finally {
      setIsCompressingImage(false);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const handleUseCurrentGps = () => {
    if (!onSetPendingCoord) return;
    setGpsError("");
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGpsError("เบราว์เซอร์นี้ไม่รองรับ GPS");
      return;
    }
    setIsLocatingGps(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLocatingGps(false);
        const coord: [number, number] = [
          pos.coords.longitude,
          pos.coords.latitude,
        ];
        onSetPendingCoord(coord);
        setManualDistrict(null);
        setErrors((prev) => ({ ...prev, location: undefined }));
      },
      () => {
        setIsLocatingGps(false);
        setGpsError("ไม่สามารถเข้าถึง GPS ได้ กรุณาปักหมุดบนแผนที่");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const nextErrors: FormErrors = {};
    if (!pendingCoord) {
      nextErrors.location = "กรุณาเลือกพิกัดสถานที่เกิดเหตุบนแผนที่หรือใช้ GPS";
    }
    if (!title.trim()) {
      nextErrors.title = "กรุณาระบุหัวข้อเรื่องร้องเรียน";
    }
    if (!description.trim()) {
      nextErrors.description = "กรุณาระบุรายละเอียดปัญหา";
    }
    if (!isAnonymous && !effectiveReporterName.trim()) {
      nextErrors.reporterName = "กรุณาระบุชื่อผู้แจ้ง หรือเลือกแจ้งแบบไม่ระบุตัวตน";
    }

    if (Object.keys(nextErrors).length > 0 || !pendingCoord) {
      setErrors(nextErrors);
      setTouched({ title: true, description: true, reporterName: !isAnonymous });
      if (nextErrors.location) {
        locationBtnRef.current?.focus();
      } else if (nextErrors.title) {
        titleInputRef.current?.focus();
      } else if (nextErrors.description) {
        descInputRef.current?.focus();
      } else if (nextErrors.reporterName) {
        reporterInputRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    await new Promise((r) => setTimeout(r, 250));

    const now = new Date();
    const dateStr = now.toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "2-digit",
    });
    const timeStr = now.toLocaleTimeString("th-TH", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const submitted = await onSubmit({
      title: title.trim(),
      description: description.trim(),
      categoryId,
      priority,
      province: effectiveProvince,
      district: effectiveDistrict.trim() || `อ.เมือง${effectiveProvince}`,
      departmentId: getDefaultDepartmentForCategory(categoryId),
      coordinates: pendingCoord,
      isAnonymous,
      reporterMemberId: isAnonymous ? undefined : citizenMember?.id,
      reporterName: isAnonymous ? "ผู้แจ้งไม่ระบุตัวตน" : effectiveReporterName.trim(),
      phone: isAnonymous ? undefined : effectivePhone.trim() || undefined,
      imageBase64,
      imageName,
      timeline: [
        {
          id: `tl-${Date.now()}`,
          date: dateStr,
          time: `${timeStr} น.`,
          title: "รับเรื่องร้องเรียนเข้าสู่ระบบ",
          description: `แจ้งปัญหาในพื้นที่ จ.${effectiveProvince}${effectiveDistrict ? ` (${effectiveDistrict})` : ""} ส่งต่อหน่วยงานที่เกี่ยวข้องแล้ว`,
          status: "pending",
          icon: "inbox",
        },
      ],
    });

    if (submitted !== false) resetForm();
    setIsSubmitting(false);
  };

  const [viewMode, setViewMode] = useState<"offcanvas" | "modal">("offcanvas");

  const selectedCategory = COMPLAINT_CATEGORIES.find((c) => c.id === categoryId);

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 transition-opacity duration-300 pointer-events-auto ${
          viewMode === "modal"
            ? "bg-black/50 backdrop-blur-sm"
            : "bg-black/30 sm:bg-black/20 backdrop-blur-[2px]"
        }`}
        onClick={handleCancel}
      />

      {/* Main Container */}
      <div
        className={`z-40 pointer-events-auto transition-all duration-300 ${
          viewMode === "modal"
            ? "fixed inset-0 flex items-center justify-center p-3 sm:p-4 pointer-events-none"
            : "fixed bottom-0 sm:bottom-4 inset-x-0 sm:inset-x-auto sm:top-16 sm:right-3.5 sm:w-[480px] max-w-[calc(100vw-28px)] pointer-events-none"
        }`}
      >
        <div
          className={`relative pointer-events-auto flex flex-col ios-glass-sheet shadow-2xl overflow-hidden transition-all duration-300 ${
            viewMode === "modal"
              ? "w-full max-w-[540px] max-h-[88vh] rounded-[32px] animate-in zoom-in-95 duration-200"
              : "w-full h-[90vh] sm:h-full max-h-[92vh] sm:max-h-full rounded-t-[32px] sm:rounded-[32px] animate-in slide-in-from-bottom-8 sm:slide-in-from-right-8 duration-300"
          }`}
        >
          {/* Mobile grab handle in offcanvas mode */}
          {viewMode === "offcanvas" && (
            <div className="sm:hidden pt-2.5 pb-1 flex justify-center">
              <div className="w-10 h-1.5 rounded-full bg-slate-500/30 dark:bg-white/30" />
            </div>
          )}

          {/* Fixed Header */}
          <div className="flex-shrink-0 flex items-center justify-between px-6 py-4 border-b border-slate-900/[0.06] dark:border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-2xl bg-red-500/15 dark:bg-red-500/20 text-red-500 dark:text-red-400 shadow-xs">
                <JKIcon name="triangle-exclamation" className="text-base" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-black text-slate-900 dark:text-white leading-none">
                    รายงานปัญหา
                  </h2>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    {viewMode === "offcanvas" ? "Offcanvas" : "Modal"}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium mt-1">
                  กรอกรายละเอียดเรื่องร้องเรียนเพื่อส่งต่อเจ้าหน้าที่
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {/* View Mode Toggle Button */}
              <button
                type="button"
                onClick={() => setViewMode(viewMode === "offcanvas" ? "modal" : "offcanvas")}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/75 dark:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-white/20 transition cursor-pointer"
                title={
                  viewMode === "offcanvas"
                    ? "ขยายเป็นหน้าต่างกึ่งกลาง (Modal)"
                    : "ย้ายเป็นแถบข้างขวา (Offcanvas)"
                }
              >
                <JKIcon
                  name={viewMode === "offcanvas" ? "expand" : "table-columns"}
                  className="text-xs"
                />
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/75 dark:bg-white/10 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white hover:bg-white dark:hover:bg-white/20 transition cursor-pointer"
                title="ปิด"
              >
                <JKIcon name="xmark" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Form with Scrollable Body & Fixed Sticky Footer */}
          <form onSubmit={handleSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5 custom-scrollbar">
              {/* Location */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                    <JKIcon name="location-dot" className="text-rose-500 text-xs" />
                    <span>สถานที่เกิดเหตุ</span> <span className="text-red-500">*</span>
                  </span>
                  {onSetPendingCoord && (
                    <button
                      type="button"
                      onClick={handleUseCurrentGps}
                      disabled={isLocatingGps}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400 text-[11px] font-bold transition cursor-pointer disabled:opacity-60"
                    >
                      <JKIcon
                        name="location-crosshairs"
                        className={`text-[10px] ${isLocatingGps ? "animate-spin" : ""}`}
                      />
                      <span>{isLocatingGps ? "กำลังหาตำแหน่ง..." : "ใช้ GPS ปัจจุบัน"}</span>
                    </button>
                  )}
                </div>
                {pendingCoord ? (
                  <div className="flex items-center gap-3 p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-emerald-500 text-white flex-shrink-0 shadow-xs">
                      <JKIcon name="location-dot" className="text-xs" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1">
                        <span>เลือกพิกัดแล้ว</span>
                        <JKIcon name="check" className="text-[11px]" />
                      </p>
                      <p className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400">
                        {pendingCoord[1].toFixed(5)}°N, {pendingCoord[0].toFixed(5)}°E
                      </p>
                      {isResolvingGeo ? (
                        <p className="text-[10px] text-emerald-700/80 dark:text-emerald-300/80 font-semibold mt-0.5 flex items-center gap-1">
                          <JKIcon name="arrows-rotate" className="text-[9px] animate-spin" />
                          <span>กำลังระบุชื่อถนน/ตำบล/จังหวัดจริง...</span>
                        </p>
                      ) : resolvedGeo?.shortAddress ? (
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-200 font-semibold mt-0.5 truncate" title={resolvedGeo.displayName}>
                          {resolvedGeo.shortAddress}
                        </p>
                      ) : null}
                    </div>
                    <button
                      ref={locationBtnRef}
                      type="button"
                      onClick={onRequestNewLocation}
                      className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:text-emerald-900 dark:hover:text-emerald-200 font-bold underline-offset-2 hover:underline transition cursor-pointer flex-shrink-0"
                    >
                      เปลี่ยนพิกัด
                    </button>
                  </div>
                ) : (
                  <button
                    ref={locationBtnRef}
                    type="button"
                    onClick={onRequestNewLocation}
                    className={`w-full flex items-center justify-center gap-2 p-3.5 rounded-2xl border-2 border-dashed transition cursor-pointer text-sm font-bold ${
                      errors.location
                        ? "border-red-400 bg-red-50/70 dark:bg-red-950/30 text-red-600 dark:text-red-400"
                        : "bg-white/75 dark:bg-slate-900/55 border-slate-300/80 dark:border-white/20 text-slate-700 dark:text-slate-200 hover:border-emerald-400 dark:hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-white/95 dark:hover:bg-emerald-950/20"
                    }`}
                  >
                    <JKIcon name="crosshairs" className="text-sm" />
                    <span>คลิกเพื่อเลือกตำแหน่งบนแผนที่</span>
                  </button>
                )}
                {errors.location && (
                  <p role="alert" className="text-xs text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                    <JKIcon name="circle-exclamation" className="text-[11px]" />
                    <span>{errors.location}</span>
                  </p>
                )}
                {gpsError && (
                  <p role="alert" className="text-xs text-amber-600 dark:text-amber-400 font-medium mt-1.5">
                    {gpsError}
                  </p>
                )}
              </div>

              {/* Province & District (Nationwide 77 Provinces) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="complaint-province"
                    className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                  >
                    <JKIcon name="map" className="text-emerald-500 text-xs" />
                    <span>จังหวัด (77 จังหวัด)</span>
                  </label>
                  <select
                    id="complaint-province"
                    name="province"
                    value={effectiveProvince}
                    onChange={(e) => {
                      const nextProv = e.target.value;
                      setManualProvince(nextProv);
                      setManualDistrict(getDefaultDistrictForProvince(nextProv));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                      text-slate-900 dark:text-white text-xs font-bold
                      focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition cursor-pointer"
                  >
                    {PROVINCE_GROUPS.map((group) => (
                      <optgroup
                        key={group.region}
                        label={`${group.region} (${group.provinces.length})`}
                      >
                        {group.provinces.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="complaint-district"
                    className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                  >
                    <JKIcon name="map-pin" className="text-red-500 text-xs" />
                    <span>เขต / อำเภอ / พื้นที่</span>
                  </label>
                  <input
                    id="complaint-district"
                    name="district"
                    type="text"
                    list="form-district-suggestions"
                    value={effectiveDistrict}
                    onChange={(e) => setManualDistrict(e.target.value)}
                    placeholder={`เช่น ${getDefaultDistrictForProvince(effectiveProvince)}`}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                      text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-xs font-bold
                      focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition"
                  />
                  <datalist id="form-district-suggestions">
                    {provinceDistricts.map((dist) => (
                      <option key={dist.pcode} value={dist.displayTh} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Priority */}
              <div>
                <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2">
                  <JKIcon name="gauge-high" className="text-orange-500 text-xs" />
                  <span>ระดับความเร่งด่วน</span>
                </span>
                <div className="grid grid-cols-4 gap-1.5">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPriority(opt.id)}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-bold transition cursor-pointer ${
                        priority === opt.id
                          ? `${opt.activeClass} bg-white/95 dark:bg-slate-800/90 shadow-xs`
                          : "bg-white/80 dark:bg-slate-900/55 border-white/85 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/95 dark:hover:bg-slate-900/75 shadow-[0_1px_4px_-1px_rgba(15,23,42,0.05)] dark:shadow-none"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Category */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    <JKIcon name="tag" className="text-amber-500 text-xs" />
                    <span>หมวดหมู่ปัญหา</span>
                  </label>
                  {selectedCategory && (
                    <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300">
                      เลือกแล้ว: <strong className="text-slate-900 dark:text-white">{selectedCategory.label}</strong>
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {COMPLAINT_CATEGORIES.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setCategoryId(cat.id)}
                      className={`flex items-center gap-2.5 px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer border ${
                        categoryId === cat.id
                          ? "bg-white/95 dark:bg-slate-800/85 shadow-sm scale-[1.02]"
                          : "bg-white/82 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14] shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none hover:bg-white/95 dark:hover:bg-slate-900/78 hover:border-white dark:hover:border-white/25 hover:scale-[1.01]"
                      }`}
                      style={
                        categoryId === cat.id
                          ? {
                              borderColor: cat.color,
                              boxShadow: `0 6px 16px -6px ${cat.color}40`,
                            }
                          : {}
                      }
                    >
                      <span
                        className="flex items-center justify-center w-7 h-7 rounded-xl text-white text-xs flex-shrink-0 shadow-xs"
                        style={{ backgroundColor: cat.color }}
                      >
                        <JKIcon name={cat.icon} className="text-[11px]" />
                      </span>
                      <span
                        className={`text-[11px] font-bold leading-tight ${
                          categoryId === cat.id
                            ? "text-slate-900 dark:text-white"
                            : "text-slate-700 dark:text-slate-200"
                        }`}
                      >
                        {cat.label}
                      </span>
                      {categoryId === cat.id && (
                        <JKIcon
                          name="check"
                          className="text-[10px] ml-auto flex-shrink-0"
                          style={{ color: cat.color }}
                        />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Title */}
              <div>
                <label
                  htmlFor="complaint-title"
                  className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                >
                  <JKIcon name="clipboard-list" className="text-blue-500 text-xs" />
                  <span>หัวข้อเรื่อง</span> <span className="text-red-500">*</span>
                </label>
                <input
                  id="complaint-title"
                  name="title"
                  ref={titleInputRef}
                  type="text"
                  value={title}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTitle(val);
                    if (val.trim()) {
                      setErrors((prev) => ({ ...prev, title: undefined }));
                    }
                  }}
                  onBlur={() => {
                    if (!touched.title && !title) return;
                    setTouched((prev) => ({ ...prev, title: true }));
                    if (!title.trim()) {
                      setErrors((prev) => ({ ...prev, title: "กรุณาระบุหัวข้อเรื่องร้องเรียน" }));
                    }
                  }}
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={errors.title ? "complaint-title-error" : undefined}
                  placeholder="สรุปปัญหาโดยย่อ เช่น ท่อระบายน้ำอุดตัน หรือ ไฟทางดับ"
                  maxLength={100}
                  className={`w-full px-4 py-3 rounded-2xl border bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                    text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm font-medium
                    focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 transition ${
                      errors.title
                        ? "border-red-400 focus:ring-red-500/30"
                        : "border-white/90 dark:border-white/15 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500"
                    }`}
                />
                {errors.title && (
                  <p id="complaint-title-error" role="alert" className="text-xs text-red-500 font-semibold mt-1.5">
                    {errors.title}
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <label
                  htmlFor="complaint-description"
                  className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                >
                  <JKIcon name="pen-to-square" className="text-indigo-500 text-xs" />
                  <span>รายละเอียด</span> <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="complaint-description"
                  name="description"
                  ref={descInputRef}
                  value={description}
                  onChange={(e) => {
                    const val = e.target.value;
                    setDescription(val);
                    if (val.trim()) {
                      setErrors((prev) => ({ ...prev, description: undefined }));
                    }
                  }}
                  onBlur={() => {
                    if (!touched.description && !description) return;
                    setTouched((prev) => ({ ...prev, description: true }));
                    if (!description.trim()) {
                      setErrors((prev) => ({ ...prev, description: "กรุณาระบุรายละเอียดปัญหา" }));
                    }
                  }}
                  aria-invalid={Boolean(errors.description)}
                  aria-describedby={errors.description ? "complaint-description-error" : undefined}
                  placeholder="อธิบายปัญหาโดยละเอียด เช่น จุดสังเกต ผลกระทบ หรือช่วงเวลาที่พบปัญหา..."
                  rows={3}
                  maxLength={500}
                  className={`w-full px-4 py-3 rounded-2xl border bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                    text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm font-medium resize-none
                    focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 transition ${
                      errors.description
                        ? "border-red-400 focus:ring-red-500/30"
                        : "border-white/90 dark:border-white/15 focus:ring-emerald-500/40 focus:border-emerald-400 dark:focus:border-emerald-500"
                    }`}
                />
                <div className="flex items-center justify-between mt-1">
                  {errors.description ? (
                    <p id="complaint-description-error" role="alert" className="text-xs text-red-500 font-semibold">
                      {errors.description}
                    </p>
                  ) : (
                    <span />
                  )}
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold">{description.length}/500</p>
                </div>
              </div>

              {/* Image Upload */}
              <div>
                <label
                  htmlFor="complaint-image-input"
                  className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                >
                  <JKIcon name="camera" className="text-teal-500 text-xs" />
                  <span>รูปภาพหลักฐาน</span> <span className="text-slate-600 dark:text-slate-300 font-medium normal-case">(ไม่บังคับ, ย่ออัตโนมัติ)</span>
                </label>

                {imageBase64 ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/90 dark:border-white/15 shadow-sm">
                    <img src={imageBase64} alt="preview" className="w-full h-40 object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 px-4 py-2.5 flex items-center justify-between">
                      <span className="text-xs text-white font-medium truncate max-w-[70%]">
                        {imageName}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setImageBase64(undefined);
                          setImageName(undefined);
                        }}
                        className="text-[11px] text-rose-300 hover:text-white bg-red-500/40 hover:bg-red-500/80 px-2.5 py-1 rounded-xl transition cursor-pointer flex items-center gap-1 font-bold"
                      >
                        <JKIcon name="trash" className="text-[10px]" />
                        ลบรูป
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onClick={() => fileInputRef.current?.click()}
                    className={`cursor-pointer group flex flex-col items-center justify-center gap-1.5 p-4 sm:p-5 rounded-2xl border-2 border-dashed transition-all
                      ${
                        isDragOver
                          ? "border-emerald-400 bg-emerald-50/90 dark:bg-emerald-950/40 scale-[1.01]"
                          : "bg-white/75 dark:bg-slate-900/55 border-slate-300/80 dark:border-white/20 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-white/95 dark:hover:bg-slate-900/75"
                      }`}
                  >
                    <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-105">
                      <img
                        src="/images/mascot_camera.png"
                        alt="Camera Inspector Mascot"
                        className="w-full h-full object-contain drop-shadow-md"
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-100">
                        {isCompressingImage ? (
                          <span className="text-emerald-600 dark:text-emerald-400">กำลังย่อขนาดรูปภาพ...</span>
                        ) : (
                          <>
                            วางรูปที่นี่ หรือ{" "}
                            <span className="text-emerald-600 dark:text-emerald-400 underline underline-offset-2 font-black">
                              เลือกไฟล์
                            </span>
                          </>
                        )}
                      </p>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5">แนบภาพจุดเกิดเหตุเพื่อให้เจ้าหน้าที่ตรวจสอบได้เร็วขึ้น</p>
                    </div>
                  </div>
                )}
                {imageError && <p role="alert" className="text-xs text-red-500 font-semibold mt-1.5">{imageError}</p>}
                <input
                  id="complaint-image-input"
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>

              {/* Reporter Identity Mode & Info */}
              <div className="space-y-3 pb-2">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider">
                    <JKIcon name="id-card" className="text-sky-500 text-xs" />
                    <span>การระบุตัวตนผู้แจ้ง</span>
                  </span>
                  {citizenMember ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 text-[10px] font-black">
                      <JKIcon name="user-check" className="text-[9px]" />
                      <span>สมาชิก: {citizenMember.displayName}</span>
                    </span>
                  ) : (
                    onOpenCitizenAuth && (
                      <button
                        type="button"
                        onClick={() => onOpenCitizenAuth("login")}
                        className="text-[11px] font-black text-teal-600 dark:text-teal-400 hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <JKIcon name="user-plus" className="text-[10px]" />
                        <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
                      </button>
                    )
                  )}
                </div>

                {/* Toggle: Identified vs Anonymous */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAnonymous(false);
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-black transition cursor-pointer ${
                      !isAnonymous
                        ? "bg-white/95 dark:bg-sky-500/20 border-sky-500 text-sky-700 dark:text-sky-300 shadow-xs"
                        : "bg-white/80 dark:bg-slate-900/55 border-white/85 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/95 dark:hover:bg-slate-900/75"
                    }`}
                  >
                    <JKIcon name="user-check" className="text-xs" />
                    <span>ระบุตัวตนผู้แจ้ง</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIsAnonymous(true);
                      setErrors((prev) => ({ ...prev, reporterName: undefined }));
                    }}
                    className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl border text-xs font-black transition cursor-pointer ${
                      isAnonymous
                        ? "bg-slate-800 dark:bg-amber-500/20 border-slate-700 dark:border-amber-400 text-white dark:text-amber-200 shadow-xs"
                        : "bg-white/80 dark:bg-slate-900/55 border-white/85 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/95 dark:hover:bg-slate-900/75"
                    }`}
                  >
                    <JKIcon name="user-secret" className="text-xs" />
                    <span>แจ้งแบบไม่ระบุตัวตน</span>
                  </button>
                </div>

                {isAnonymous ? (
                  <div className="p-3.5 rounded-2xl bg-amber-50/90 dark:bg-amber-500/10 border border-amber-400/50 flex items-start gap-2.5">
                    <JKIcon name="shield-halved" className="text-amber-500 text-sm mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-xs font-black text-amber-800 dark:text-amber-200">
                        โหมดไม่ระบุตัวตน (ปกปิดข้อมูลส่วนตัว)
                      </p>
                      <p className="text-[11px] text-amber-700/90 dark:text-amber-200/80 mt-0.5 leading-relaxed">
                        บนแผนที่สาธารณะ ระบบปิดชื่อและเบอร์ติดต่อ และจะแสดงเป็น &ldquo;ผู้แจ้งไม่ระบุตัวตน&rdquo;
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label
                        htmlFor="complaint-reporter"
                        className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                      >
                        <JKIcon name="user-check" className="text-sky-500 text-xs" />
                        <span>ชื่อผู้แจ้ง</span> <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="complaint-reporter"
                        name="reporterName"
                        ref={reporterInputRef}
                        type="text"
                        autoComplete="name"
                        value={effectiveReporterName}
                        onChange={(e) => {
                          const val = e.target.value;
                          setManualReporterName(val);
                          if (val.trim()) {
                            setErrors((prev) => ({ ...prev, reporterName: undefined }));
                          }
                        }}
                        onBlur={() => {
                          if (!touched.reporterName && !effectiveReporterName) return;
                          setTouched((prev) => ({ ...prev, reporterName: true }));
                          if (!effectiveReporterName.trim()) {
                            setErrors((prev) => ({ ...prev, reporterName: "กรุณาระบุชื่อผู้แจ้ง หรือเลือกแจ้งแบบไม่ระบุตัวตน" }));
                          }
                        }}
                        aria-invalid={Boolean(errors.reporterName)}
                        aria-describedby={errors.reporterName ? "complaint-reporter-error" : undefined}
                        placeholder="ชื่อ-นามสกุล หรือนามแฝง"
                        className={`w-full px-3.5 py-2.5 sm:py-3 rounded-2xl border bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                          text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm font-medium
                          focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 transition ${
                            errors.reporterName
                              ? "border-red-400 focus:ring-red-500/30"
                              : "border-white/90 dark:border-white/15 focus:ring-emerald-500/40 focus:border-emerald-400"
                          }`}
                      />
                      {errors.reporterName && (
                        <p id="complaint-reporter-error" role="alert" className="text-[11px] text-red-500 font-semibold mt-1">
                          {errors.reporterName}
                        </p>
                      )}
                    </div>
                    <div>
                      <label
                        htmlFor="complaint-phone"
                        className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-2"
                      >
                        <JKIcon name="phone" className="text-emerald-500 text-xs" />
                        <span>เบอร์ติดต่อ (ไม่บังคับ)</span>
                      </label>
                      <input
                        id="complaint-phone"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        value={effectivePhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        placeholder="08x-xxx-xxxx"
                        className="w-full px-3.5 py-2.5 sm:py-3 rounded-2xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-slate-900/65 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.06)] dark:shadow-none
                          text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 text-sm font-medium
                          focus:bg-white dark:focus:bg-slate-900/85 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-400 transition"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <p className="px-6 pb-2 text-xs text-slate-600 dark:text-slate-300">
              เมื่อส่งเรื่อง ระบบจะบันทึกเวลา IP และข้อมูลเบราว์เซอร์ที่ได้รับให้ผู้ดูแลตรวจสอบ หากเข้าสู่ระบบ เรื่องจะผูกกับบัญชีเพื่อให้ดูย้อนหลังได้
            </p>
            {/* Fixed Sticky Footer */}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-900/[0.06] dark:border-white/[0.08] bg-white/55 dark:bg-slate-950/35 flex gap-3">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 py-3 px-4 rounded-2xl border border-white/90 dark:border-white/15 bg-white/85 dark:bg-white/10 text-slate-700 dark:text-slate-200
                  hover:bg-white dark:hover:bg-white/20 text-sm font-bold transition cursor-pointer shadow-xs"
              >
                ยกเลิก
              </button>
              <button
                type="submit"
                disabled={isSubmitting || isCompressingImage}
                className="flex-[2] py-3 px-4 rounded-2xl text-white font-extrabold text-sm transition-all cursor-pointer
                  disabled:opacity-60 disabled:cursor-wait
                  bg-gradient-to-r from-red-500 via-rose-500 to-orange-500
                  hover:from-red-400 hover:to-orange-400
                  active:scale-[0.98] shadow-lg shadow-red-500/30
                  flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <>
                    <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    กำลังส่ง...
                  </>
                ) : (
                  <>
                    <JKIcon name="paper-plane" className="text-xs" />
                    ส่งเรื่องร้องเรียน
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
