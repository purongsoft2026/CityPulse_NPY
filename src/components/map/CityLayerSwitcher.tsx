"use client";

import React, { useEffect, useRef, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import type { CityLayerKey } from "@/data/map-data";

interface CityLayerSwitcherProps {
  activeLayer: CityLayerKey;
  onChangeLayer: (layer: CityLayerKey) => void;
  className?: string;
  counts?: {
    complaints: number;
    emergency: number;
    polls: number;
    cctv: number;
    environment?: number;
  };
}

const LAYERS: {
  key: CityLayerKey;
  label: string;
  subtitle: string;
  icon: string;
  activeColor: string;
  iconBg: string;
}[] = [
  {
    key: "complaints",
    label: "เรื่องร้องเรียน",
    subtitle: "จุดปัญหาและแจ้งเหตุจากประชาชน",
    icon: "clipboard-list",
    activeColor: "bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-red-500/25",
    iconBg: "from-red-500 to-rose-500",
  },
  {
    key: "emergency",
    label: "ฉุกเฉิน & AED",
    subtitle: "หน่วยกู้ชีพ โรงพยาบาล และจุดกระตุกหัวใจ",
    icon: "heart-pulse",
    activeColor: "bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-emerald-500/25",
    iconBg: "from-emerald-600 to-teal-500",
  },
  {
    key: "polls",
    label: "โพลล์พัฒนาเมือง",
    subtitle: "ร่วมโหวตและเสนอแนวทางพัฒนาพื้นที่",
    icon: "check-to-slot",
    activeColor: "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25",
    iconBg: "from-blue-600 to-indigo-600",
  },
  {
    key: "cctv",
    label: "กล้อง CCTV & สภาพน้ำ",
    subtitle: "เฝ้าระวังจราจรและสถานีตรวจระดับน้ำ",
    icon: "video",
    activeColor: "bg-gradient-to-r from-cyan-600 to-teal-600 text-white shadow-cyan-500/25",
    iconBg: "from-cyan-600 to-teal-600",
  },
  {
    key: "environment",
    label: "ฝุ่น & แผ่นดินไหว",
    subtitle: "คุณภาพอากาศ PM2.5 และแผ่นดินไหวล่าสุด",
    icon: "lungs",
    activeColor: "bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-violet-500/25",
    iconBg: "from-violet-600 to-fuchsia-600",
  },
];

export function CityLayerSwitcher({
  activeLayer,
  onChangeLayer,
  className,
  counts,
}: CityLayerSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const currentLayer = LAYERS.find((l) => l.key === activeLayer) ?? LAYERS[0];
  const currentCount = counts ? counts[currentLayer.key] : null;

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const handleMouseEnter = () => {
    clearCloseTimer();
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 150);
  };

  useEffect(() => {
    const handleOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      clearCloseTimer();
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={
        className ??
        "absolute top-15 sm:top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto"
      }
    >
      {/* Collapsed Compact Trigger Pill */}
      <div className="flex justify-center">
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="menu"
          className="relative group flex items-center gap-2 sm:gap-2.5 pl-1.5 pr-3 sm:pr-3.5 py-1.5 rounded-full weather-glass-card border border-white/60 dark:border-white/15 shadow-2xl backdrop-blur-2xl hover:scale-[1.02] active:scale-95 transition-all cursor-pointer whitespace-nowrap"
        >
          <span
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-black shadow-md ${currentLayer.activeColor}`}
          >
            <JKIcon name={currentLayer.icon} className="text-[11px]" />
            <span>{currentLayer.label}</span>
            {currentCount !== null && currentCount !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono font-bold bg-white/25 text-white">
                {currentCount}
              </span>
            )}
          </span>

          <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            <JKIcon name="layer-group" className="text-[11px] opacity-80" />
            <span className="hidden sm:inline">{LAYERS.length} ชั้นข้อมูล</span>
            <JKIcon
              name="chevron-down"
              className={`text-[10px] opacity-75 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </span>
        </button>
      </div>

      {/* Hover / Click Expanded Layer Drawer */}
      <div
        role="menu"
        aria-label="เลือกชั้นข้อมูลแผนที่"
        className={`absolute top-full left-1/2 -translate-x-1/2 pt-2 w-[290px] sm:w-[330px] transition-all duration-200 origin-top ${
          isOpen
            ? "opacity-100 scale-100 translate-y-0 pointer-events-auto"
            : "opacity-0 scale-95 -translate-y-1.5 pointer-events-none"
        }`}
      >
        <div className="relative p-2 rounded-[24px] weather-glass-card border border-white/60 dark:border-white/15 shadow-[0_24px_56px_-12px_rgba(15,23,42,0.28)] dark:shadow-[0_24px_56px_-12px_rgba(0,0,0,0.75)] backdrop-blur-2xl space-y-1">
          <div className="flex items-center justify-between px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <JKIcon name="layer-group" className="text-[10px] text-sky-500" />
              <span>เลือกชั้นข้อมูลบนแผนที่</span>
            </span>
            <span className="font-mono">{LAYERS.length} Layers</span>
          </div>

          {LAYERS.map((layer) => {
            const isActive = activeLayer === layer.key;
            const count = counts ? counts[layer.key] : null;

            return (
              <button
                key={layer.key}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  onChangeLayer(layer.key);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-[16px] text-left transition-all cursor-pointer active:scale-[0.98] ${
                  isActive
                    ? `${layer.activeColor} shadow-lg`
                    : "text-slate-800 dark:text-slate-100 hover:bg-slate-900/[0.06] dark:hover:bg-white/[0.08]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-8 h-8 rounded-[12px] flex items-center justify-center text-xs shrink-0 ${
                      isActive
                        ? "bg-white/20 text-white"
                        : `bg-gradient-to-br ${layer.iconBg} text-white shadow-sm`
                    }`}
                  >
                    <JKIcon name={layer.icon} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black truncate">{layer.label}</p>
                    <p
                      className={`text-[10px] truncate ${
                        isActive ? "text-white/85" : "text-slate-500 dark:text-slate-400"
                      }`}
                    >
                      {layer.subtitle}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {count !== null && count !== undefined && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                        isActive
                          ? "bg-white/25 text-white"
                          : "bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                  {isActive && (
                    <span className="w-5 h-5 rounded-full bg-white/25 text-white flex items-center justify-center">
                      <JKIcon name="check" className="text-[10px]" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
