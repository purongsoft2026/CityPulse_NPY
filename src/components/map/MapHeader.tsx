"use client";

import React, { useState, useRef, useEffect, useMemo, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  CITIES,
  calculateCitizenStats,
  type CitizenXpExtras,
  type CityViewport,
} from "@/data/map-data";
import { fetchPlaceSearch, type PlaceSearchResult } from "@/lib/external-apis";
import { getOfficerSessionSnapshot, subscribeOfficerSession } from "@/lib/officer-auth";
import { type CitizenMember } from "@/lib/citizen-auth";
import { PwaInstallButton } from "@/components/pwa/PwaInstallProvider";

export type MapMode = "explore" | "navigation" | "logistics" | "clusters" | "pindrop";
export type MapStyleKey = "voyager" | "darkmatter" | "positron" | "openfreemap";

interface MapHeaderProps {
  isReportMode: boolean;
  onToggleReportMode: () => void;
  currentStyle: MapStyleKey;
  onSelectStyle: (style: MapStyleKey) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenNearbyPlaces: () => void;
  onShowReportOverview: () => void;
  onSelectCity: (city: CityViewport) => void;
  onOpenReportForm: () => void;
  pendingCount: number;
  onOpenCitizenHub?: () => void;
  userUpvoteCount?: number;
  userReportCount?: number;
  citizenXpExtras?: CitizenXpExtras;
  onOpenSosModal?: () => void;
  citizenMember?: CitizenMember | null;
  onOpenCitizenAuth?: (tab?: "login" | "register") => void;
}

const REGIONS = [
  { key: "ทั้งหมด", label: "ทั้งหมด" },
  { key: "ภาคกลาง", label: "กลาง" },
  { key: "ภาคเหนือ", label: "เหนือ" },
  { key: "ภาคตะวันออกเฉียงเหนือ", label: "อีสาน" },
  { key: "ภาคตะวันออก", label: "ตะวันออก" },
  { key: "ภาคตะวันตก", label: "ตะวันตก" },
  { key: "ภาคใต้", label: "ใต้" },
];

export function MapHeader({
  isReportMode,
  onToggleReportMode,
  currentStyle,
  onSelectStyle,
  isDark,
  onToggleTheme,
  isSidebarOpen,
  onToggleSidebar,
  onSelectCity,
  onShowReportOverview,
  onOpenNearbyPlaces,
  onOpenReportForm,
  pendingCount,
  onOpenCitizenHub,
  userUpvoteCount = 0,
  userReportCount = 0,
  citizenXpExtras,
  onOpenSosModal,
  citizenMember,
  onOpenCitizenAuth,
}: MapHeaderProps) {
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isStyleDropdownOpen, setIsStyleDropdownOpen] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [selectedRegion, setSelectedRegion] = useState("ทั้งหมด");
  const [placeLookup, setPlaceLookup] = useState<{
    query: string;
    results: PlaceSearchResult[];
  }>({ query: "", results: [] });

  const trimmedPlaceQuery = provinceSearch.trim();
  const externalPlaces =
    placeLookup.query === trimmedPlaceQuery ? placeLookup.results : [];
  const isSearchingPlaces =
    isCityDropdownOpen &&
    trimmedPlaceQuery.length >= 2 &&
    placeLookup.query !== trimmedPlaceQuery;

  useEffect(() => {
    if (!isCityDropdownOpen || trimmedPlaceQuery.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetchPlaceSearch(trimmedPlaceQuery, controller.signal)
        .then((results) => {
          if (!controller.signal.aborted) {
            setPlaceLookup({ query: trimmedPlaceQuery, results });
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setPlaceLookup({ query: trimmedPlaceQuery, results: [] });
          }
        });
    }, 380);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [isCityDropdownOpen, trimmedPlaceQuery]);

  const cityDropdownRef = useRef<HTMLDivElement>(null);
  const styleDropdownRef = useRef<HTMLDivElement>(null);
  const regionScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkRegionScroll = useCallback(() => {
    const el = regionScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 2);
  }, []);

  useEffect(() => {
    if (isCityDropdownOpen) {
      const timer = setTimeout(checkRegionScroll, 60);
      return () => clearTimeout(timer);
    }
  }, [isCityDropdownOpen, checkRegionScroll]);

  useEffect(() => {
    const el = regionScrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkRegionScroll);
      window.addEventListener("resize", checkRegionScroll);
      checkRegionScroll();
      return () => {
        el.removeEventListener("scroll", checkRegionScroll);
        window.removeEventListener("resize", checkRegionScroll);
      };
    }
  }, [checkRegionScroll]);

  const handleScrollLeft = () => {
    if (regionScrollRef.current) {
      regionScrollRef.current.scrollBy({ left: -90, behavior: "smooth" });
      // Update button states after the scroll animation
      setTimeout(checkRegionScroll, 300);
    }
  };

  const handleScrollRight = () => {
    if (regionScrollRef.current) {
      regionScrollRef.current.scrollBy({ left: 90, behavior: "smooth" });
      // Update button states after the scroll animation
      setTimeout(checkRegionScroll, 300);
    }
  };
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (cityDropdownRef.current && !cityDropdownRef.current.contains(e.target as Node)) {
        setIsCityDropdownOpen(false);
      }
      if (styleDropdownRef.current && !styleDropdownRef.current.contains(e.target as Node)) {
        setIsStyleDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredProvinces = useMemo(() => {
    const q = provinceSearch.trim().toLowerCase();
    return CITIES.filter((city) => {
      const matchRegion = selectedRegion === "ทั้งหมด" || city.region === selectedRegion;
      if (!matchRegion) return false;
      if (!q) return true;
      return (
        city.name.toLowerCase().includes(q) ||
        (city.region && city.region.toLowerCase().includes(q))
      );
    });
  }, [provinceSearch, selectedRegion]);

  const styleLabels: Record<MapStyleKey, { label: string; desc: string }> = {
    voyager: { label: "CARTO Voyager", desc: "สีสันสดใส เหมาะสำหรับการสำรวจ" },
    darkmatter: { label: "CARTO Dark Matter", desc: "สไตล์ดาร์กโหมด ลุ่มลึก สบายตา" },
    positron: { label: "CARTO Positron", desc: "มินิมอล โทนขาวสว่าง เรียบหรู" },
    openfreemap: { label: "OpenFreeMap Liberty", desc: "แผนที่เวกเตอร์เปิด ละเอียดสูง" },
  };

  const getRegionBadgeStyle = (region?: string) => {
    switch (region) {
      case "ภาคเหนือ":
        return "bg-sky-500/12 text-sky-700 dark:bg-sky-400/15 dark:text-sky-300 border-sky-500/20";
      case "ภาคตะวันออกเฉียงเหนือ":
        return "bg-amber-500/12 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300 border-amber-500/20";
      case "ภาคตะวันออก":
        return "bg-cyan-500/12 text-cyan-700 dark:bg-cyan-400/15 dark:text-cyan-300 border-cyan-500/20";
      case "ภาคตะวันตก":
        return "bg-violet-500/12 text-violet-700 dark:bg-violet-400/15 dark:text-violet-300 border-violet-500/20";
      case "ภาคใต้":
        return "bg-blue-500/12 text-blue-700 dark:bg-blue-400/15 dark:text-blue-300 border-blue-500/20";
      default:
        return "bg-teal-500/12 text-teal-700 dark:bg-teal-400/15 dark:text-teal-300 border-teal-500/20";
    }
  };

  return (
    <header className="absolute top-3.5 left-3.5 right-3.5 z-40 flex items-center justify-between gap-3 pointer-events-none">
      {/* Left Cluster: Sidebar, Brand & Pin-Drop Toggle */}
      <div className="flex items-center gap-2.5 pointer-events-auto shrink-0">
        <button
          onClick={onToggleSidebar}
          aria-label="Toggle Sidebar"
          className="liquid-glass-btn relative flex items-center justify-center h-10 w-10 rounded-[18px] text-slate-800 dark:text-white hover:scale-105 transition-all cursor-pointer shadow-lg shrink-0"
        >
          <JKIcon name={isSidebarOpen ? "arrow-left-to-line" : "bars"} className="text-sm" />
          {pendingCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center shadow-md">
              {pendingCount}
            </span>
          )}
        </button>

        <div className="liquid-glass-btn h-10 px-3.5 rounded-[18px] flex items-center gap-2 shadow-lg whitespace-nowrap shrink-0">
          <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-teal-500 to-emerald-600 flex items-center justify-center text-white text-[10px] shrink-0">
            <JKIcon name="location-dot" />
          </div>
          <span className="font-black text-sm tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            CityPulseHERO
          </span>
          <span className="hidden 2xl:inline text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-500/12 dark:bg-cyan-400/20 text-teal-700 dark:text-cyan-300 whitespace-nowrap">
            แผนที่แจ้งเหตุอัจฉริยะ
          </span>
        </div>

        <button
          onClick={onToggleReportMode}
          className={`hidden sm:flex liquid-glass-btn h-10 px-3.5 rounded-[18px] text-xs font-black transition-all items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 ${
            isReportMode
              ? "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-sm scale-[1.02]"
              : "text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/15"
          }`}
        >
          <JKIcon name="crosshairs" className="text-xs shrink-0" />
          <span>{isReportMode ? "กำลังปักหมุด..." : "ปักหมุด"}</span>
        </button>
      </div>

      {/* Right Cluster: Grouped Utility Capsules + CTAs */}
      <div className="flex items-center gap-2.5 sm:gap-3 pointer-events-auto shrink-0">
        {/* Map Tools Capsule: Province | Layer Style | Install PWA | Theme */}
        <div className="liquid-glass-btn h-10 p-1 rounded-[18px] flex items-center gap-0.5 shadow-lg shrink-0">
          <div className="relative" ref={cityDropdownRef}>
            <button
              onClick={() => { setIsCityDropdownOpen(!isCityDropdownOpen); setIsStyleDropdownOpen(false); }}
              className="flex items-center gap-1.5 h-8 px-2.5 sm:px-3 rounded-[14px] text-xs font-black text-slate-800 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/15 transition cursor-pointer whitespace-nowrap"
              title="เลือกจังหวัด 77 จังหวัด หรือค้นหาสถานที่"
            >
              <JKIcon name="globe" className="text-teal-600 dark:text-cyan-300 text-sm shrink-0" />
              <span className="hidden md:inline">จังหวัด</span>
              <JKIcon name="chevron-down" className="text-[10px] text-slate-500 dark:text-white/70 shrink-0" />
            </button>

          {isCityDropdownOpen && (
            <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-2.5 max-w-[calc(100vw-24px)] sm:w-96 rounded-[28px] weather-glass-card p-3.5 z-50 animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-white/20 dark:border-white/10">
              <div className="flex items-center justify-between px-1 pb-2 border-b border-slate-200/50 dark:border-white/10 mb-2.5">
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-800 dark:text-white">
                  <JKIcon name="map-location-dot" className="text-teal-600 dark:text-cyan-400 text-xs" />
                  <span>เลือกจังหวัดในประเทศไทย</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-teal-500/15 text-teal-700 dark:text-cyan-300 dark:bg-cyan-500/20">
                  {filteredProvinces.length} / 77
                </span>
              </div>

              <button type="button" onClick={() => { setIsCityDropdownOpen(false); onOpenNearbyPlaces(); }}
                className="mb-2 w-full rounded-xl bg-teal-700 px-3 py-2 text-left text-xs font-bold text-white">
                ค้นหาใกล้ตัว · ปั๊มน้ำมัน ร้านค้า ร้านอาหาร
              </button>

              <button type="button" onClick={() => { setIsCityDropdownOpen(false); onShowReportOverview(); }}
                className="mb-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-left text-xs font-bold dark:border-slate-600">
                รวมจังหวัดที่เปิดรับแจ้ง
              </button>

              <div className="relative mb-2">
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-400 pointer-events-none">
                  <JKIcon name="magnifying-glass" className="text-xs" />
                </div>
                <input
                  type="text"
                  value={provinceSearch}
                  onChange={(e) => setProvinceSearch(e.target.value)}
                  placeholder="ค้นหาจังหวัด ถนน หรือสถานที่จริง..."
                  className="w-full bg-slate-100/80 dark:bg-white/10 border border-slate-200/80 dark:border-white/10 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/40 dark:focus:ring-cyan-400/40 transition"
                  autoFocus
                />
                {provinceSearch && (
                  <button
                    onClick={() => setProvinceSearch("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white cursor-pointer"
                  >
                    <JKIcon name="xmark" className="text-xs" />
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 mb-1 w-full">
                {/* Left scroll button */}
                <button
                  onClick={handleScrollLeft}
                  disabled={!canScrollLeft}
                  className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <JKIcon name="chevron-left" className="text-[10px]" />
                </button>

                <div
                  ref={regionScrollRef}
                  className="flex-1 overflow-x-scroll no-scrollbar scrollbar-none flex items-center gap-1 flex-nowrap"
                >
                  {REGIONS.map((r) => {
                    const isActive = selectedRegion === r.key;
                    return (
                      <button
                        key={r.key}
                        onClick={() => setSelectedRegion(r.key)}
                        className={`flex-shrink-0 min-w-max px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap transition cursor-pointer ${
                          isActive
                            ? "bg-teal-600 text-white dark:bg-cyan-500 dark:text-slate-950 shadow-xs"
                            : "text-slate-600 dark:text-slate-300 hover:bg-slate-200/50 dark:hover:bg-white/10"
                        }`}
                      >
                        {r.label}
                      </button>
                    );
                  })}
                </div>

                {/* Right scroll button */}
                <button
                  onClick={handleScrollRight}
                  disabled={!canScrollRight}
                  className="shrink-0 flex items-center justify-center h-6 w-6 rounded-full bg-slate-200/60 dark:bg-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-300/80 dark:hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                >
                  <JKIcon name="chevron-right" className="text-[10px]" />
                </button>
              </div>

              <div className="max-h-64 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {filteredProvinces.length === 0 && externalPlaces.length === 0 && !isSearchingPlaces ? (
                  <div className="py-8 text-center text-xs text-slate-400 dark:text-slate-400">
                    ไม่พบจังหวัดหรือสถานที่ที่ตรงกับคำค้นหา
                  </div>
                ) : (
                  <>
                    {filteredProvinces.map((city) => (
                      <button
                        key={city.id}
                        onClick={() => {
                          onSelectCity(city);
                          setIsCityDropdownOpen(false);
                        }}
                        className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white hover:bg-teal-500/10 dark:hover:bg-cyan-500/20 hover:text-teal-800 dark:hover:text-cyan-200 transition group cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 shrink-0 rounded-lg bg-slate-200/60 dark:bg-white/10 flex items-center justify-center text-[10px] text-slate-500 dark:text-slate-300 group-hover:bg-teal-500/20 group-hover:text-teal-600 dark:group-hover:text-cyan-300 transition">
                            <JKIcon name="location-dot" />
                          </div>
                          <div className="truncate">
                            <span className="font-bold">{city.name.split(" (")[0]}</span>
                            <span className="ml-1 text-[10px] text-slate-400 dark:text-slate-400 font-medium">
                              {city.name.includes(" (") ? `(${city.name.split(" (")[1]}` : ""}
                            </span>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 shrink-0 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300 font-semibold group-hover:bg-teal-500/20 group-hover:text-teal-700 dark:group-hover:text-cyan-200 transition ml-2">
                          {city.region}
                        </span>
                      </button>
                    ))}

                    {(isSearchingPlaces || externalPlaces.length > 0) && (
                      <div className="pt-2 mt-2 border-t border-slate-200/60 dark:border-white/10">
                        <div className="px-2 pb-1 flex items-center justify-between text-[10px] font-black text-teal-700 dark:text-cyan-300">
                          <span className="flex items-center gap-1">
                            <JKIcon name="magnifying-glass" className="text-[9px]" />
                            <span>สถานที่จริงบนแผนที่ (OSM)</span>
                          </span>
                          {isSearchingPlaces && (
                            <JKIcon name="arrows-rotate" className="text-[9px] animate-spin" />
                          )}
                        </div>
                        {externalPlaces.map((place) => (
                          <button
                            key={place.id}
                            onClick={() => {
                              onSelectCity({
                                id: place.id,
                                name: place.name,
                                country: "Thailand",
                                region: place.province || "ประเทศไทย",
                                center: place.center,
                                zoom: 15,
                              });
                              setIsCityDropdownOpen(false);
                            }}
                            className="w-full text-left flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs text-slate-900 dark:text-white hover:bg-sky-500/10 dark:hover:bg-sky-500/20 transition group cursor-pointer"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 shrink-0 rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-300 flex items-center justify-center text-[10px]">
                                <JKIcon name="compass" />
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold truncate">{place.name}</p>
                                <p className="text-[10px] text-slate-400 dark:text-slate-400 truncate">
                                  {place.displayName}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
          </div>

          <span className="w-px h-4 bg-slate-900/10 dark:bg-white/15 shrink-0" aria-hidden="true" />

          <div className="relative" ref={styleDropdownRef}>
            <button
              onClick={() => { setIsStyleDropdownOpen(!isStyleDropdownOpen); setIsCityDropdownOpen(false); }}
              className="flex items-center gap-1.5 h-8 px-2.5 rounded-[14px] text-xs font-black text-slate-800 dark:text-white hover:bg-slate-900/[0.06] dark:hover:bg-white/15 transition cursor-pointer whitespace-nowrap"
              title={`สไตล์แผนที่: ${styleLabels[currentStyle].label}`}
            >
              <JKIcon name="layer-group" className="text-amber-600 dark:text-amber-300 text-sm shrink-0" />
              <span className="hidden 2xl:inline">{styleLabels[currentStyle].label}</span>
              <span className="hidden xl:inline 2xl:hidden">สไตล์</span>
              <JKIcon name="chevron-down" className="text-[10px] text-slate-500 dark:text-white/70 shrink-0" />
            </button>

            {isStyleDropdownOpen && (
              <div className="fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-16 sm:top-auto sm:mt-3 max-w-[calc(100vw-24px)] sm:w-72 rounded-[28px] weather-glass-card p-3 z-50 animate-in fade-in zoom-in-95 duration-150 shadow-2xl border border-white/20 dark:border-white/10">
                <div className="px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  สไตล์แผนที่
                </div>
                <div className="space-y-1.5">
                  {(Object.keys(styleLabels) as MapStyleKey[]).map((key) => {
                    const isSelected = currentStyle === key;
                    return (
                      <button
                        key={key}
                        onClick={() => { onSelectStyle(key); setIsStyleDropdownOpen(false); }}
                        className={`w-full text-left p-2.5 rounded-2xl transition-all cursor-pointer ${
                          isSelected
                            ? "bg-emerald-600/10 dark:bg-white/25 border border-emerald-600/30 dark:border-white/50 shadow-xs"
                            : "hover:bg-slate-900/5 dark:hover:bg-white/15"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black text-slate-900 dark:text-white">{styleLabels[key].label}</span>
                          {isSelected && <span className="w-2 h-2 rounded-full bg-emerald-600 dark:bg-cyan-300 shadow-sm" />}
                        </div>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 font-medium">{styleLabels[key].desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <span className="w-px h-4 bg-slate-900/10 dark:bg-white/15 shrink-0" aria-hidden="true" />

          {/* PWA Install Button */}
          <PwaInstallButton className="flex items-center justify-center h-8 w-8 rounded-[14px] hover:bg-slate-900/[0.06] dark:hover:bg-white/15 transition cursor-pointer shrink-0" />

          {/* Theme Toggle */}
          <button
            onClick={onToggleTheme}
            aria-label="Toggle Theme"
            title={isDark ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
            className="flex items-center justify-center h-8 w-8 rounded-[14px] hover:bg-slate-900/[0.06] dark:hover:bg-white/15 transition cursor-pointer shrink-0"
          >
            <JKIcon
              name={isDark ? "sun" : "moon"}
              className="text-sm text-amber-500 dark:text-amber-300 transition-transform duration-300 hover:rotate-12"
            />
          </button>
        </div>

        {/* Citizen Hub / Member & Officer Group */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenCitizenHub && (
            <button
              onClick={onOpenCitizenHub}
              className="hidden lg:flex liquid-glass-btn items-center gap-1.5 h-10 px-3 rounded-[18px] text-xs font-black cursor-pointer hover:scale-105 active:scale-95 transition whitespace-nowrap shrink-0"
              title={
                citizenMember
                  ? `${citizenMember.displayName} (จ.${citizenMember.homeProvince}) - เปิดศูนย์พลเมืองตื่นรู้`
                  : "เปิดศูนย์พลเมืองตื่นรู้ & เหรียญรางวัล"
              }
            >
              <div className="relative w-6 h-6 rounded-full flex-shrink-0 bg-amber-400/20 border border-amber-400/40 flex items-center justify-center p-0.5">
                <img
                  src={citizenMember?.avatarPose || "/images/mascot.png"}
                  alt="Mascot Icon"
                  className="w-full h-full object-contain"
                />
                {citizenMember && (
                  <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
                )}
              </div>
              {citizenMember && (
                <span className="text-slate-800 dark:text-white font-black text-[11px] max-w-[84px] truncate">
                  {citizenMember.displayName}
                </span>
              )}
              <span className="text-amber-600 dark:text-amber-300 font-extrabold text-[11px]">
                Lv.{calculateCitizenStats(userUpvoteCount, userReportCount, citizenXpExtras).level}
              </span>
              <JKIcon name="award" className="text-amber-500 text-xs shrink-0" />
            </button>
          )}

          {/* Unified Member & Officer Portal Menu */}
          <AccountPortalMenuButton
            citizenMember={citizenMember}
            onOpenCitizenAuth={onOpenCitizenAuth}
            onOpenCitizenHub={onOpenCitizenHub}
          />
        </div>

        {/* Action CTAs: SOS & Report */}
        <div className="hidden md:flex items-center gap-2 shrink-0">
          {onOpenSosModal && (
            <button
              onClick={onOpenSosModal}
              className="flex items-center gap-1.5 h-10 px-3.5 rounded-[18px] text-white text-xs font-black cursor-pointer whitespace-nowrap shrink-0
                bg-gradient-to-r from-red-600 via-rose-600 to-red-700
                hover:from-red-500 hover:to-rose-500 active:scale-95
                shadow-lg shadow-red-600/30 transition-all"
              title="ศูนย์ช่วยเหลือฉุกเฉินและกู้ชีพ (โทร 1669 / 191 / AED)"
            >
              <JKIcon name="truck-medical" className="text-xs shrink-0" />
              <span>SOS</span>
            </button>
          )}

          <button
            onClick={onOpenReportForm}
            className="flex items-center gap-1.5 h-10 px-4 rounded-[18px] text-white text-xs font-extrabold cursor-pointer whitespace-nowrap shrink-0
              bg-gradient-to-r from-red-500 via-rose-500 to-orange-500
              hover:from-red-400 hover:to-orange-400 active:scale-95
              shadow-lg shadow-red-500/30 transition-all"
          >
            <JKIcon name="plus" className="text-xs shrink-0" />
            <span>แจ้งปัญหา</span>
          </button>
        </div>
      </div>
    </header>
  );
}

const serverNullSession = () => null;

function AccountPortalMenuButton({
  citizenMember,
  onOpenCitizenAuth,
  onOpenCitizenHub,
}: {
  citizenMember?: CitizenMember | null;
  onOpenCitizenAuth?: (tab?: "login" | "register") => void;
  onOpenCitizenHub?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const session = useSyncExternalStore(
    subscribeOfficerSession,
    getOfficerSessionSnapshot,
    serverNullSession
  );

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const activeLabel = session
    ? "เจ้าหน้าที่"
    : citizenMember
      ? "สมาชิก"
      : "เข้าสู่ระบบ";

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-haspopup="menu"
        className="liquid-glass-btn flex items-center justify-center gap-1.5 h-10 px-3 rounded-[18px] text-xs font-black cursor-pointer hover:scale-105 active:scale-95 transition text-slate-800 dark:text-slate-100 whitespace-nowrap shrink-0"
        title="บัญชีสมาชิกพลเมือง และ ระบบเจ้าหน้าที่"
      >
        <span className="relative flex items-center justify-center shrink-0">
          <JKIcon
            name={session ? "user-shield" : citizenMember ? "user-check" : "user-circle"}
            className={`text-sm ${
              session
                ? "text-cyan-500"
                : citizenMember
                  ? "text-emerald-500"
                  : "text-emerald-600 dark:text-emerald-400"
            }`}
          />
          {(session || citizenMember) && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-slate-900" />
          )}
        </span>
        <span className="hidden sm:inline">{activeLabel}</span>
        <JKIcon
          name="chevron-down"
          className={`text-[10px] opacity-60 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute right-0 mt-2 w-72 liquid-glass rounded-[22px] p-2 shadow-2xl border border-white/60 dark:border-white/15 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Section: Citizen Member */}
          <div className="px-2.5 pt-1 pb-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            สมาชิกพลเมือง (Citizen)
          </div>

          {citizenMember ? (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setIsOpen(false);
                onOpenCitizenHub?.();
              }}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 text-left transition cursor-pointer"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0">
                <JKIcon name="user-check" className="text-sm text-emerald-600 dark:text-emerald-300" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                  {citizenMember.displayName}
                </p>
                <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 truncate">
                  จ.{citizenMember.homeProvince} • เปิดศูนย์พลเมือง
                </p>
              </div>
              <JKIcon name="arrow-right" className="text-[11px] text-emerald-600 dark:text-emerald-300 shrink-0" />
            </button>
          ) : (
            onOpenCitizenAuth && (
              <div className="space-y-1">
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCitizenAuth("login");
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-slate-900/[0.06] dark:hover:bg-white/10 text-left transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <JKIcon name="user-circle" className="text-sm" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900 dark:text-white">เข้าสู่ระบบสมาชิก</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      กรอกข้อมูลแจ้งเรื่องและซิงก์สถิติอัตโนมัติ
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsOpen(false);
                    onOpenCitizenAuth("register");
                  }}
                  className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-slate-900/[0.06] dark:hover:bg-white/10 text-left transition cursor-pointer"
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300 flex items-center justify-center shrink-0">
                    <JKIcon name="user-plus" className="text-xs" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-black text-slate-900 dark:text-white">สมัครสมาชิกใหม่ (ฟรี)</p>
                    <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                      สะสม XP เลื่อนระดับ และปลดล็อกเหรียญ
                    </p>
                  </div>
                </button>
              </div>
            )
          )}

          <div className="my-2 h-px bg-slate-900/10 dark:bg-white/10" />

          {/* Section: Officer & Backend Admin */}
          <div className="px-2.5 pt-0.5 pb-1.5 text-[10px] font-black uppercase tracking-wider text-cyan-700 dark:text-cyan-300">
            เจ้าหน้าที่ & ผู้ดูแลระบบ
          </div>

          {session ? (
            <div className="space-y-1">
              <Link
                href="/admin"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/20 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                  <JKIcon name="user-shield" className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                    ศูนย์ปฏิบัติการเจ้าหน้าที่
                  </p>
                  <p className="text-[10px] font-semibold text-cyan-700 dark:text-cyan-300 truncate">
                    {session.officer.name}
                  </p>
                </div>
                <JKIcon name="arrow-right" className="text-[11px] text-cyan-600 dark:text-cyan-300 shrink-0" />
              </Link>

              <Link
                href="/admin/system"
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-slate-900/[0.06] dark:hover:bg-white/10 transition"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                  <JKIcon name="database" className="text-xs" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-black text-slate-900 dark:text-white">ตั้งค่าระบบ & ฐานข้อมูล</p>
                  <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                    จัดการค่า XP สำรองข้อมูล และตรวจสอบระบบ
                  </p>
                </div>
              </Link>
            </div>
          ) : (
            <Link
              href="/admin/login"
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 p-2.5 rounded-2xl hover:bg-slate-900/[0.06] dark:hover:bg-white/10 transition"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                <JKIcon name="user-shield" className="text-xs" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-slate-900 dark:text-white">เข้าสู่ระบบเจ้าหน้าที่ / แอดมิน</p>
                <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                  จัดการเคสร้องเรียน ตั้งค่าระบบ & ฐานข้อมูล
                </p>
              </div>
              <JKIcon name="arrow-right" className="text-[11px] text-slate-400 shrink-0" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
