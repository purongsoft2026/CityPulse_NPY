"use client";

import React, { useEffect, useMemo, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  EMERGENCY_POINTS,
  formatDistance,
  haversineDistanceKm,
  type EmergencyPoint,
} from "@/data/map-data";
import {
  fetchNearbyEmergencyPoints,
  type NearbyEmergencyResponse,
} from "@/lib/external-apis";

interface EmergencySosModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCoord?: [number, number]; // [lng, lat]
  onSelectEmergencyPoint?: (point: EmergencyPoint) => void;
}

const EMERGENCY_SERVICES = [
  {
    number: "1669",
    label: "การแพทย์ฉุกเฉิน / กู้ชีพ",
    subLabel: "เจ็บป่วยฉุกเฉิน อุบัติเหตุรุนแรง หมดสติ",
    colorClass: "bg-red-500/15 text-red-500",
    icon: "truck-medical",
  },
  {
    number: "191",
    label: "เหตุด่วนเหตุร้าย / ตำรวจ",
    subLabel: "อาชญากรรม ทะเลาะวิวาท ของหายฉุกเฉิน",
    colorClass: "bg-blue-500/15 text-blue-500",
    icon: "shield-halved",
  },
  {
    number: "199",
    label: "ดับเพลิงและกู้ภัย",
    subLabel: "เพลิงไหม้ สัตว์มีพิษเข้าบ้าน น้ำท่วมวิกฤต",
    colorClass: "bg-amber-500/15 text-amber-500",
    icon: "fire-extinguisher",
  },
  {
    number: "1567",
    label: "ศูนย์ดำรงธรรม (ทั่วไทย)",
    subLabel: "ศูนย์รับเรื่องร้องทุกข์และประสานเหตุทุกจังหวัด 24 ชม.",
    colorClass: "bg-emerald-500/15 text-emerald-500",
    icon: "phone-volume",
  },
];

type EmergencyFilter = "all" | EmergencyPoint["type"];

const POINT_META: Record<
  EmergencyPoint["type"],
  { label: string; icon: string; badgeBg: string; cardBg: string }
> = {
  aed: {
    label: "ตู้ AED",
    icon: "heart-pulse",
    badgeBg: "bg-emerald-500",
    cardBg: "bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200/70 dark:border-emerald-800/30",
  },
  hospital: {
    label: "โรงพยาบาล",
    icon: "hospital",
    badgeBg: "bg-red-500",
    cardBg: "bg-red-50/50 dark:bg-red-950/15 border-red-200/70 dark:border-red-800/30",
  },
  fire_station: {
    label: "ดับเพลิง",
    icon: "fire-extinguisher",
    badgeBg: "bg-amber-500",
    cardBg: "bg-amber-50/50 dark:bg-amber-950/15 border-amber-200/70 dark:border-amber-800/30",
  },
  police: {
    label: "ตำรวจ",
    icon: "shield-halved",
    badgeBg: "bg-blue-600",
    cardBg: "bg-blue-50/50 dark:bg-blue-950/15 border-blue-200/70 dark:border-blue-800/30",
  },
};

export function EmergencySosModal({
  isOpen,
  onClose,
  currentCoord = [100.5231, 13.7367],
  onSelectEmergencyPoint,
}: EmergencySosModalProps) {
  const [hasCopiedCoord, setHasCopiedCoord] = useState(false);
  const [gpsCoord, setGpsCoord] = useState<[number, number] | null>(null);
  const [gpsStatus, setGpsStatus] = useState<"idle" | "locating" | "locked" | "error">("idle");
  const [gpsError, setGpsError] = useState("");
  const [pointFilter, setPointFilter] = useState<EmergencyFilter>("all");
  const [searchRadiusKm, setSearchRadiusKm] = useState<20 | 40>(20);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [nearbyState, setNearbyState] = useState<{
    key: string;
    data: NearbyEmergencyResponse;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  const activeCoord = gpsCoord ?? currentCoord;
  const activeQueryKey = `${activeCoord[1].toFixed(3)}|${activeCoord[0].toFixed(3)}|${searchRadiusKm}|${refreshNonce}`;

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    const controller = new AbortController();

    fetchNearbyEmergencyPoints(
      activeCoord[1],
      activeCoord[0],
      searchRadiusKm,
      controller.signal,
    ).then((res) => {
      if (cancelled || !res) return;
      setNearbyState({ key: activeQueryKey, data: res });
    });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [isOpen, activeCoord, searchRadiusKm, activeQueryKey]);

  const isLoadingPoints = isOpen && nearbyState?.key !== activeQueryKey;
  const activePoints = useMemo(
    () => (nearbyState?.data?.points?.length ? nearbyState.data.points : EMERGENCY_POINTS),
    [nearbyState],
  );
  const liveSource = nearbyState?.data?.source ?? "fallback";
  const liveAreaLabel = nearbyState?.data?.areaLabel ?? "";

  const categoryCounts = useMemo(() => {
    const counts: Record<EmergencyFilter, number> = {
      all: activePoints.length,
      aed: 0,
      hospital: 0,
      fire_station: 0,
      police: 0,
    };
    for (const pt of activePoints) {
      counts[pt.type] += 1;
    }
    return counts;
  }, [activePoints]);

  const sortedPoints = useMemo(() => {
    const withDistance = activePoints
      .map((pt) => ({
        point: pt,
        distanceKm: haversineDistanceKm(activeCoord, pt.coordinates),
      }))
      .sort((a, b) => a.distanceKm - b.distanceKm);

    if (pointFilter === "all") return withDistance;
    return withDistance.filter((item) => item.point.type === pointFilter);
  }, [activePoints, activeCoord, pointFilter]);

  if (!isOpen) return null;

  const latStr = activeCoord[1].toFixed(5);
  const lngStr = activeCoord[0].toFixed(5);
  const mapsLink = `https://www.google.com/maps?q=${latStr},${lngStr}`;
  const sosMessage = `ขอความช่วยเหลือฉุกเฉิน ขณะนี้อยู่ที่พิกัด ${latStr}, ${lngStr} (${mapsLink}) กรุณาส่งทีมช่วยเหลือด่วน`;

  const handleLocateGps = () => {
    if (!navigator.geolocation) {
      setGpsStatus("error");
      setGpsError("เบราว์เซอร์ไม่รองรับการระบุตำแหน่ง GPS");
      return;
    }
    setGpsStatus("locating");
    setGpsError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoord([pos.coords.longitude, pos.coords.latitude]);
        setGpsStatus("locked");
      },
      () => {
        setGpsStatus("error");
        setGpsError("ไม่สามารถเข้าถึง GPS ได้ กรุณาตรวจสอบสิทธิ์ตำแหน่ง");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleCopyCoord = async () => {
    try {
      await navigator.clipboard.writeText(sosMessage);
      setHasCopiedCoord(true);
      setTimeout(() => setHasCopiedCoord(false), 2400);
    } catch {
      // ignore
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: "พิกัดขอความช่วยเหลือฉุกเฉิน SOS",
          text: sosMessage,
          url: mapsLink,
        });
        return;
      } catch {
        // user cancelled or unavailable
      }
    }
    handleCopyCoord();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sos-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-red-500/30 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-r from-red-600 via-rose-600 to-red-700 px-6 pt-5 pb-5 text-white shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition cursor-pointer z-20"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>

          <div className="flex items-center gap-3 relative z-10 pr-8">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white text-xl shadow-lg border border-white/30">
              <JKIcon name="truck-medical" />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-black/20 backdrop-blur-md text-[10px] font-black uppercase tracking-wider border border-white/20 mb-1">
                <span className="w-2 h-2 rounded-full bg-yellow-300 animate-ping" />
                Emergency Hub
              </div>
              <h2 id="sos-modal-title" className="text-xl sm:text-2xl font-black leading-tight">
                ศูนย์ช่วยเหลือฉุกเฉินและกู้ชีพ
              </h2>
            </div>
          </div>

          {/* Current GPS Coordinates Box */}
          <div className="mt-4 p-3 rounded-2xl bg-black/30 backdrop-blur-md border border-white/20 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <span className="text-[10px] font-bold text-red-100 uppercase tracking-wider flex items-center gap-1.5">
                  <JKIcon name={gpsStatus === "locked" ? "satellite-dish" : "location-dot"} className="text-[10px]" />
                  {gpsStatus === "locked" ? "พิกัด GPS จริงของคุณ" : "พิกัดอ้างอิงบนแผนที่"}
                </span>
                <span className="text-xs sm:text-sm font-mono font-black text-white truncate block mt-0.5">
                  {latStr}°N, {lngStr}°E
                </span>
              </div>

              <button
                type="button"
                onClick={handleLocateGps}
                disabled={gpsStatus === "locating"}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white text-red-700 hover:bg-red-50 text-[11px] font-black transition cursor-pointer shadow-sm active:scale-95 disabled:opacity-60"
              >
                <JKIcon
                  name={gpsStatus === "locating" ? "spinner" : "location-crosshairs"}
                  className={`text-xs ${gpsStatus === "locating" ? "animate-spin" : ""}`}
                />
                <span>{gpsStatus === "locating" ? "กำลังจับพิกัด..." : "จับพิกัด GPS ปัจจุบัน"}</span>
              </button>
            </div>

            {gpsError && (
              <p className="text-[11px] text-amber-200 font-semibold">{gpsError}</p>
            )}

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/15">
              <button
                type="button"
                onClick={handleCopyCoord}
                className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer ${
                  hasCopiedCoord
                    ? "bg-emerald-500 text-white shadow-sm"
                    : "bg-white/20 hover:bg-white/30 text-white"
                }`}
              >
                <JKIcon name={hasCopiedCoord ? "check" : "copy"} className="text-[11px]" />
                <span>{hasCopiedCoord ? "คัดลอกแล้ว" : "คัดลอกข้อความ"}</span>
              </button>

              <button
                type="button"
                onClick={handleNativeShare}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-white/20 hover:bg-white/30 text-white transition cursor-pointer"
              >
                <JKIcon name="share-nodes" className="text-[11px]" />
                <span>ส่งพิกัดด่วน</span>
              </button>

              <a
                href={`sms:?body=${encodeURIComponent(sosMessage)}`}
                className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[11px] font-black bg-white/20 hover:bg-white/30 text-white transition"
              >
                <JKIcon name="comment-sms" className="text-[11px]" />
                <span>ส่ง SMS</span>
              </a>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Emergency Hotlines */}
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <JKIcon name="phone" className="text-red-500" />
              สายด่วนฉุกเฉิน (แตะเพื่อโทรออกทันที)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EMERGENCY_SERVICES.map((srv) => (
                <a
                  key={srv.number}
                  href={`tel:${srv.number}`}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:border-red-400 dark:hover:border-red-500/50 hover:bg-red-50/50 dark:hover:bg-red-950/20 transition group cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl ${srv.colorClass} flex items-center justify-center text-sm flex-shrink-0 group-hover:scale-105 transition`}>
                      <JKIcon name={srv.icon} />
                    </div>
                    <div className="min-w-0">
                      <span className="text-base font-black text-slate-900 dark:text-white block font-mono leading-none">
                        {srv.number}
                      </span>
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 block mt-0.5 truncate">
                        {srv.label}
                      </span>
                      <span className="text-[10px] text-slate-400 dark:text-slate-400 block truncate">
                        {srv.subLabel}
                      </span>
                    </div>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-slate-200/80 dark:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 group-hover:bg-red-500 group-hover:text-white transition shrink-0 ml-2">
                    <JKIcon name="phone" className="text-xs" />
                  </div>
                </a>
              ))}
            </div>
          </div>

          {/* Nearby Emergency & AED Points (Sorted by real distance) */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <div className="min-w-0">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <JKIcon name="hospital" className="text-emerald-500" />
                  จุดช่วยเหลือและ AED ใกล้พิกัดคุณ
                </h3>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold ${
                      liveSource === "osm-live"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <JKIcon name="globe" className="text-[9px]" />
                    <span>
                      {isLoadingPoints
                        ? "กำลังค้นหาหน่วยกู้ชีพทั่วประเทศ..."
                        : liveSource === "osm-live"
                          ? `ข้อมูลจริง OpenStreetMap (${liveAreaLabel || "77 จังหวัด"})`
                          : "ข้อมูลอ้างอิงส่วนกลาง"}
                    </span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setSearchRadiusKm((r) => (r === 20 ? 40 : 20))}
                  className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-[10px] font-bold text-slate-600 dark:text-slate-300 transition cursor-pointer"
                  title="สลับรัศมีค้นหา"
                >
                  รัศมี {searchRadiusKm} กม.
                </button>
                <button
                  type="button"
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  disabled={isLoadingPoints}
                  className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 flex items-center justify-center text-slate-600 dark:text-slate-300 transition cursor-pointer disabled:opacity-50"
                  title="อัปเดตจุดช่วยเหลือใกล้พิกัดนี้"
                >
                  <JKIcon
                    name="arrows-spin"
                    className={`text-[11px] ${isLoadingPoints ? "animate-spin text-emerald-500" : ""}`}
                  />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-2 no-scrollbar">
              {([
                { key: "all", label: "ทั้งหมด" },
                { key: "hospital", label: "โรงพยาบาล" },
                { key: "police", label: "ตำรวจ" },
                { key: "fire_station", label: "ดับเพลิง" },
                { key: "aed", label: "ตู้ AED" },
              ] as const).map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setPointFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                    pointFilter === tab.key
                      ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                      : "bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/15"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                      pointFilter === tab.key
                        ? "bg-white/20 text-white dark:bg-slate-900/15 dark:text-slate-900"
                        : "bg-slate-200/80 dark:bg-white/10 text-slate-500 dark:text-slate-300"
                    }`}
                  >
                    {categoryCounts[tab.key]}
                  </span>
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {sortedPoints.length === 0 && !isLoadingPoints && (
                <div className="p-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/15 text-center space-y-2 bg-slate-50/70 dark:bg-white/5">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300">
                    ไม่พบจุดประเภทนี้ในรัศมี {searchRadiusKm} กม. รอบพิกัดปัจจุบัน
                  </p>
                  <div className="flex items-center justify-center gap-2 flex-wrap">
                    {searchRadiusKm < 40 && (
                      <button
                        type="button"
                        onClick={() => setSearchRadiusKm(40)}
                        className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-black transition cursor-pointer"
                      >
                        ขยายรัศมีเป็น 40 กม.
                      </button>
                    )}
                    {pointFilter !== "all" && (
                      <button
                        type="button"
                        onClick={() => setPointFilter("all")}
                        className="px-3 py-1.5 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white text-[11px] font-bold transition cursor-pointer"
                      >
                        แสดงทุกประเภท ({categoryCounts.all})
                      </button>
                    )}
                  </div>
                </div>
              )}

              {sortedPoints.map(({ point, distanceKm }) => {
                const meta = POINT_META[point.type];
                return (
                  <div
                    key={point.id}
                    className={`p-3.5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${meta.cardBg}`}
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`w-9 h-9 rounded-xl ${meta.badgeBg} text-white flex items-center justify-center text-xs flex-shrink-0 mt-0.5 shadow-sm`}>
                        <JKIcon name={meta.icon} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-slate-900/10 dark:bg-white/10 text-slate-700 dark:text-slate-200">
                            {meta.label}
                          </span>
                          <span className="text-[10px] font-mono font-black text-teal-700 dark:text-cyan-300">
                            ห่าง {formatDistance(distanceKm)}
                          </span>
                          {point.is24h && (
                            <span className="text-[9px] font-black px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300">
                              24 ชม.
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs font-black text-slate-900 dark:text-white mt-1">
                          {point.name}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">
                          {point.locationName}
                        </p>
                        {point.instruction && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 font-medium flex items-center gap-1">
                            <JKIcon name="circle-info" className="text-[9px] shrink-0" />
                            <span>{point.instruction}</span>
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                      {point.phone && (
                        <a
                          href={`tel:${point.phone}`}
                          className="px-2.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-[10px] font-black shadow-xs transition flex items-center gap-1"
                        >
                          <JKIcon name="phone" className="text-[9px]" />
                          <span>โทร</span>
                        </a>
                      )}
                      <a
                        href={`https://www.google.com/maps/dir/?api=1&destination=${point.coordinates[1]},${point.coordinates[0]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700 text-[10px] font-bold transition flex items-center gap-1"
                      >
                        <JKIcon name="diamond-turn-right" className="text-[9px] text-cyan-500" />
                        <span>นำทาง</span>
                      </a>
                      {onSelectEmergencyPoint && (
                        <button
                          type="button"
                          onClick={() => {
                            onSelectEmergencyPoint(point);
                            onClose();
                          }}
                          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-xs active:scale-95 transition cursor-pointer"
                        >
                          แผนที่
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-between shrink-0">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1.5">
            <JKIcon name="shield-heart" className="text-red-500" />
            ในกรณีวิกฤตให้โทร 1669 ทันที
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 text-slate-700 dark:text-white text-xs font-bold transition cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
