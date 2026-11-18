"use client";

import React, { useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  POI_PLACES,
  type POIItem,
  ROUTE_STEPS,
  FLIGHT_ARCS,
  type FlightArcDatum,
  type UserCustomPin,
} from "@/data/map-data";
import type { MapMode } from "./MapHeader";

interface MapSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: MapMode;
  selectedPOI: POIItem | null;
  onSelectPOI: (poi: POIItem) => void;
  isSimulating: boolean;
  onToggleSimulation: () => void;
  onResetSimulation: () => void;
  simulationProgress: number;
  selectedFlight: FlightArcDatum | null;
  onSelectFlight: (flight: FlightArcDatum) => void;
  customPins: UserCustomPin[];
  onDeleteCustomPin: (id: string) => void;
  onFlyToCustomPin: (pin: UserCustomPin) => void;
  pendingPinCoord: [number, number] | null;
  onSaveNewPin: (title: string, category: string, notes: string) => void;
  onCancelPendingPin: () => void;
}

export function MapSidebar({
  isOpen,
  onClose,
  currentMode,
  selectedPOI,
  onSelectPOI,
  isSimulating,
  onToggleSimulation,
  onResetSimulation,
  simulationProgress,
  selectedFlight,
  onSelectFlight,
  customPins,
  onDeleteCustomPin,
  onFlyToCustomPin,
  pendingPinCoord,
  onSaveNewPin,
  onCancelPendingPin,
}: MapSidebarProps) {
  const [poiCategory, setPoiCategory] = useState<string>("all");
  const [poiSearch, setPoiSearch] = useState<string>("");

  const [newPinTitle, setNewPinTitle] = useState("");
  const [newPinCategory, setNewPinCategory] = useState("จุดนัดพบ");
  const [newPinNotes, setNewPinNotes] = useState("");

  if (!isOpen) return null;

  const filteredPOIs = POI_PLACES.filter((item) => {
    const matchCategory = poiCategory === "all" || item.category === poiCategory;
    const matchSearch =
      poiSearch === "" ||
      item.name.toLowerCase().includes(poiSearch.toLowerCase()) ||
      item.nameEn.toLowerCase().includes(poiSearch.toLowerCase()) ||
      item.tags.some((t) => t.toLowerCase().includes(poiSearch.toLowerCase()));
    return matchCategory && matchSearch;
  });

  const handleCreatePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPinTitle.trim()) return;
    onSaveNewPin(newPinTitle.trim(), newPinCategory, newPinNotes.trim());
    setNewPinTitle("");
    setNewPinNotes("");
  };

  return (
    <aside className="fixed top-16 bottom-4 left-3.5 w-96 max-w-[calc(100vw-28px)] z-20 flex flex-col rounded-[32px] weather-glass-card overflow-hidden transition-all duration-300 shadow-2xl border border-white/35">
      {/* Sidebar Header */}
      <div className="flex-shrink-0 p-4 border-b border-slate-200/80 dark:border-white/20 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[14px] flex items-center justify-center bg-slate-900/5 dark:bg-white/20 border border-slate-900/10 dark:border-white/30 text-slate-800 dark:text-white shadow-xs">
            {currentMode === "explore" && <JKIcon name="compass" className="text-sm" />}
            {currentMode === "navigation" && <JKIcon name="route" className="text-sm text-cyan-600 dark:text-cyan-300" />}
            {currentMode === "logistics" && <JKIcon name="plane" className="text-sm text-teal-600 dark:text-sky-300" />}
            {currentMode === "clusters" && <JKIcon name="cubes" className="text-sm text-amber-600 dark:text-amber-300" />}
            {currentMode === "pindrop" && <JKIcon name="map-pin" className="text-sm text-rose-600 dark:text-rose-300" />}
          </div>
          
          <h2 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
            {currentMode === "explore" && "สำรวจสถานที่น่าสนใจ"}
            {currentMode === "navigation" && "ระบบนำทาง & วางแผน"}
            {currentMode === "logistics" && "การบินและโลจิสติกส์"}
            {currentMode === "clusters" && "วิเคราะห์กลุ่มจุดหนาแน่น"}
            {currentMode === "pindrop" && "หมุดส่วนตัวของคุณ"}
          </h2>
        </div>

        <button
          onClick={onClose}
          className="text-xs font-bold px-2.5 py-1 rounded-xl text-slate-600 dark:text-white/80 hover:text-slate-900 dark:hover:text-white hover:bg-slate-900/5 dark:hover:bg-white/15 transition cursor-pointer"
        >
          ซ่อนแผง
        </button>
      </div>

      {/* Sidebar Body with internal scroll */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 overscroll-contain">
        {/* ================= MODE: EXPLORE ================= */}
        {currentMode === "explore" && (
          <div className="space-y-3">
            {/* Search Input with Liquid Glass */}
            <div className="relative">
              <JKIcon name="magnifying-glass" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-400 text-xs" />
              <input
                type="text"
                value={poiSearch}
                onChange={(e) => setPoiSearch(e.target.value)}
                placeholder="ค้นหาชื่อสถานที่ หรือแท็ก..."
                className="w-full pl-9 pr-3.5 py-2.5 text-xs font-semibold rounded-2xl liquid-glass-card border border-slate-300/80 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-emerald-600/50 text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 shadow-inner"
              />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-[11px] scrollbar-none">
              {[
                { id: "all", label: "ทั้งหมด" },
                { id: "landmark", label: "แลนด์มาร์ก" },
                { id: "lifestyle", label: "ไลฟ์สไตล์" },
                { id: "park", label: "สวนสาธารณะ" },
                { id: "transit", label: "ขนส่ง" },
                { id: "food", label: "อาหาร" },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setPoiCategory(cat.id)}
                  className={`px-3.5 py-1.5 rounded-xl font-black whitespace-nowrap transition-all duration-200 cursor-pointer ${
                    poiCategory === cat.id
                      ? "liquid-active-pill text-white scale-[1.02]"
                      : "liquid-glass-btn text-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white border-slate-300/80 dark:border-white/10"
                  }`}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            {/* Places List */}
            <div className="space-y-2.5">
              {filteredPOIs.map((poi) => {
                const isSelected = selectedPOI?.id === poi.id;
                return (
                  <div
                    key={poi.id}
                    onClick={() => onSelectPOI(poi)}
                    className={`group p-3 rounded-2xl liquid-glass-card transition-all duration-200 cursor-pointer shadow-sm ${
                      isSelected
                        ? "bg-emerald-600/10 border-emerald-600/60 dark:border-emerald-400/50 shadow-md scale-[1.01]"
                        : "hover:bg-white dark:hover:bg-white/15 hover:border-emerald-500/40"
                    }`}
                  >
                    <div className="flex gap-3">
                      <img
                        src={poi.imageUrl}
                        alt={poi.name}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1508009603885-50cf7c579365?auto=format&fit=crop&w=600&q=80";
                        }}
                        className="w-16 h-16 rounded-xl object-cover flex-shrink-0 shadow-sm bg-slate-200 dark:bg-slate-800"
                      />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition">
                          {poi.name}
                        </h4>
                        <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5 font-medium">
                          {poi.description}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-[10px]">
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-black">
                            <JKIcon name="star" className="text-[10px] text-amber-500" />
                            {poi.rating}
                          </span>
                          <span className="text-slate-500 dark:text-slate-400 font-bold">({poi.reviewsCount.toLocaleString()})</span>
                          <span className="ml-auto text-emerald-700 dark:text-emerald-300 font-bold group-hover:translate-x-0.5 transition flex items-center gap-1">
                            ดูบนแผนที่ <JKIcon name="chevron-right" className="text-[8px]" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= MODE: NAVIGATION ================= */}
        {currentMode === "navigation" && (
          <div className="space-y-4">
            {/* Origin & Destination Card */}
            <div className="p-3.5 rounded-2xl liquid-glass-card border-emerald-600/30 space-y-3 bg-gradient-to-br from-emerald-600/15 via-teal-600/10 to-transparent shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center mt-1">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-700 ring-4 ring-emerald-500/30 shadow-sm" />
                  <div className="w-0.5 h-8 bg-emerald-800/30 dark:bg-emerald-200/20 my-0.5" />
                  <div className="w-3.5 h-3.5 rounded-full bg-[#b2744c] ring-4 ring-[#b2744c]/30 shadow-sm" />
                </div>
                <div className="flex-1 space-y-2.5 text-xs">
                  <div>
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-300 uppercase font-black tracking-wider block mb-0.5">
                      จุดเริ่มต้น
                    </span>
                    <p className="font-black text-slate-900 dark:text-white text-sm">
                      ไอคอนสยาม (ICONSIAM)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] text-[#b2744c] dark:text-[#d4a373] uppercase font-black tracking-wider block mb-0.5">
                      จุดหมายปลายทาง
                    </span>
                    <p className="font-black text-slate-900 dark:text-white text-sm">
                      สวนป่าเบญจกิติ (Benchakitti Park)
                    </p>
                  </div>
                </div>
              </div>

              {/* Route Metric Summary */}
              <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-200/80 dark:border-white/10 text-center">
                <div className="p-2.5 rounded-xl liquid-glass-btn">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block mb-0.5">ระยะทาง</span>
                  <p className="text-sm font-black text-slate-900 dark:text-white">11.8 กม.</p>
                </div>
                <div className="p-2.5 rounded-xl liquid-glass-btn">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block mb-0.5">เวลาเดินทาง</span>
                  <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">~26 นาที</p>
                </div>
                <div className="p-2.5 rounded-xl liquid-glass-btn">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block mb-0.5">สภาพจราจร</span>
                  <p className="text-sm font-black text-emerald-800 dark:text-emerald-300">คล่องตัว</p>
                </div>
              </div>
            </div>

            {/* Vehicle Simulation Player */}
            <div className="p-3.5 rounded-2xl liquid-glass-card space-y-3 shadow-sm">
              <div className="flex items-center justify-between text-xs">
                <span className="font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <JKIcon name="car" className="text-emerald-700 text-sm" />
                  จำลองการเคลื่อนที่ของยานพาหนะ
                </span>
                <span className="text-xs font-mono font-black text-emerald-800 dark:text-emerald-300">
                  {Math.round(simulationProgress * 100)}%
                </span>
              </div>

              {/* Progress Bar with Liquid Glow */}
              <div className="w-full h-3 rounded-full bg-emerald-950/10 dark:bg-slate-700 p-0.5 overflow-hidden shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-800 rounded-full transition-all duration-200 shadow-sm"
                  style={{ width: `${Math.round(simulationProgress * 100)}%` }}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={onToggleSimulation}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black text-white transition-all shadow-md cursor-pointer ${
                    isSimulating
                      ? "bg-amber-700 hover:bg-amber-800 shadow-amber-700/30"
                      : "liquid-active-pill shadow-emerald-700/30"
                  }`}
                >
                  {isSimulating ? (
                    <>
                      <JKIcon name="pause" className="text-xs" /> หยุดชั่วคราว
                    </>
                  ) : (
                    <>
                      <JKIcon name="play" className="text-xs" /> เริ่มจำลองการเดินทาง
                    </>
                  )}
                </button>
                <button
                  onClick={onResetSimulation}
                  aria-label="Reset simulation"
                  className="p-2 h-10 w-10 rounded-xl liquid-glass-btn flex items-center justify-center text-slate-800 dark:text-slate-200 hover:text-slate-950 cursor-pointer"
                >
                  <JKIcon name="rotate-left" className="text-xs" />
                </button>
              </div>
            </div>

            {/* Turn-by-Turn Guidance */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                คำแนะนำเส้นทาง (Turn-by-Turn)
              </span>
              <div className="space-y-2">
                {ROUTE_STEPS.map((step, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl liquid-glass-card flex items-start gap-3 hover:border-emerald-500/40 transition shadow-sm"
                  >
                    <div className="w-6 h-6 rounded-full bg-emerald-700 text-white flex items-center justify-center text-[11px] font-black flex-shrink-0 mt-0.5 shadow-sm">
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-900 dark:text-slate-100 font-bold leading-relaxed">
                        {step.instruction}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                        <span>{step.distance}</span>
                        <span>•</span>
                        <span>{step.time}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ================= MODE: LOGISTICS & FLIGHTS ================= */}
        {currentMode === "logistics" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl liquid-glass-card border-teal-700/30 text-xs bg-teal-800/10 shadow-sm">
              <div className="flex items-center gap-2 font-black text-slate-900 dark:text-teal-200 text-sm">
                <JKIcon name="plane" className="text-sm text-teal-700 dark:text-teal-400" /> เครือข่ายการบินระดับโลก (MapArc)
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 leading-relaxed font-medium">
                แสดงผลเส้นทางการบิน Geodesic Arcs ที่เชื่อมโยงศูนย์กลางกรุงเทพฯ (BKK) ไปยังมหานครสำคัญ
              </p>
            </div>

            {/* Flight Arcs List */}
            <div className="space-y-2.5">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                เที่ยวบินขนส่งและโลจิสติกส์ (6 เส้นทาง)
              </span>

              {FLIGHT_ARCS.map((flight) => {
                const isSelected = selectedFlight?.id === flight.id;
                return (
                  <div
                    key={flight.id}
                    onClick={() => onSelectFlight(flight)}
                    className={`p-3.5 rounded-2xl liquid-glass-card transition-all duration-200 cursor-pointer shadow-sm ${
                      isSelected
                        ? "bg-teal-700/15 border-teal-700/50 dark:border-teal-400/50 shadow-md scale-[1.01]"
                        : "hover:bg-white dark:hover:bg-white/15 hover:border-teal-600/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-slate-900 dark:text-white">
                        {flight.flightCode}
                      </span>
                      <span
                        className={`text-[11px] px-2.5 py-0.5 rounded-full font-black shadow-xs ${
                          flight.status === "In Transit"
                            ? "bg-emerald-600/20 text-emerald-900 dark:text-emerald-300 border border-emerald-600/40"
                            : flight.status === "Approaching"
                            ? "bg-teal-600/20 text-teal-900 dark:text-teal-300 border border-teal-600/40"
                            : "bg-slate-500/20 text-slate-800 dark:text-slate-300 border border-slate-500/40"
                        }`}
                      >
                        {flight.status}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600 dark:text-slate-300 font-bold mt-0.5">
                      {flight.airline}
                    </p>

                    <div className="flex items-center justify-between text-xs mt-2.5 pt-2 border-t border-slate-200/80 dark:border-white/10">
                      <span className="font-black text-slate-900 dark:text-white">
                        {flight.originName}
                      </span>
                      <JKIcon name="plane" className="text-teal-700 dark:text-teal-400 text-xs rotate-90" />
                      <span className="font-black text-slate-900 dark:text-white">
                        {flight.destName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-bold mt-1">
                      <span>เครื่อง: {flight.aircraft}</span>
                      <span>เวลา: {flight.duration}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ================= MODE: CLUSTERS ================= */}
        {currentMode === "clusters" && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-2xl liquid-glass-card border-amber-700/30 text-xs bg-amber-700/10 shadow-sm">
              <div className="flex items-center gap-2 font-black text-slate-900 dark:text-amber-200 text-sm">
                <JKIcon name="cubes" className="text-sm text-amber-700 dark:text-amber-400" /> MapLibre High-Performance Clustering
              </div>
              <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 leading-relaxed font-medium">
                ทดสอบเรนเดอร์ 150 จุดบริการ (EV Chargers, Pickup Lockers, คลังสินค้า) ระบบจะรวบรวมกลุ่มจุดอัตโนมัติแบบเรียลไทม์
              </p>
            </div>

            {/* Cluster Stats */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="p-3.5 rounded-2xl liquid-glass-card text-center shadow-sm">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block mb-0.5">จำนวนพิกัดทั้งหมด</span>
                <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">150 จุด</p>
              </div>
              <div className="p-3.5 rounded-2xl liquid-glass-card text-center shadow-sm">
                <span className="text-[11px] text-slate-600 dark:text-slate-300 font-bold block mb-0.5">ประสิทธิภาพ</span>
                <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">60+ FPS</p>
              </div>
            </div>

            {/* Cluster Legend */}
            <div className="p-3.5 rounded-2xl liquid-glass-card space-y-2.5 text-xs shadow-sm">
              <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                เกณฑ์สีของคลัสเตอร์ (Earthy Palette)
              </span>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#52796f] shadow-sm" />
                    <span className="text-slate-900 dark:text-slate-100 font-bold">น้อยกว่า 20 จุด</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">ขนาดเล็ก (Sage)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#d4a373] shadow-sm" />
                    <span className="text-slate-900 dark:text-slate-100 font-bold">20 - 50 จุด</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">ขนาดกลาง (Ochre)</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3.5 h-3.5 rounded-full bg-[#b2744c] shadow-sm" />
                    <span className="text-slate-900 dark:text-slate-100 font-bold">มากกว่า 50 จุด</span>
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">ความหนาแน่นสูง (Terracotta)</span>
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-300 liquid-glass-card p-3 rounded-2xl font-medium leading-relaxed shadow-sm flex items-start gap-2">
              <JKIcon name="lightbulb" className="text-amber-500 text-sm mt-0.5 flex-shrink-0" />
              <span>
                <strong className="text-slate-900 dark:text-white">วิธีใช้งาน:</strong> คลิกที่วงกลมคลัสเตอร์ แผนที่จะซูมขยายไปยังพิกัดนั้นทันที หรือซูมเข้า/ออกเพื่อดูการแตกตัวของจุด
              </span>
            </div>
          </div>
        )}

        {/* ================= MODE: PIN DROPPER ================= */}
        {currentMode === "pindrop" && (
          <div className="space-y-4">
            {pendingPinCoord ? (
              <form
                onSubmit={handleCreatePinSubmit}
                className="p-4 rounded-3xl liquid-glass-card border-[#b2744c]/40 space-y-3.5 animate-in fade-in zoom-in-95 bg-[#b2744c]/10 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#8a4e28] dark:text-[#d4a373] flex items-center gap-1.5">
                    <JKIcon name="map-pin" className="text-sm text-[#b2744c]" /> ปักหมุดที่ตำแหน่งใหม่
                  </span>
                  <span className="text-[11px] font-mono text-slate-600 dark:text-slate-300 font-bold">
                    {pendingPinCoord[1].toFixed(4)}, {pendingPinCoord[0].toFixed(4)}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                    ชื่อสถานที่ / หมุด *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPinTitle}
                    onChange={(e) => setNewPinTitle(e.target.value)}
                    placeholder="เช่น ร้านโปรด, คอนโด, จุดส่งของ..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl liquid-glass-card text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#b2744c]/50 focus:outline-none placeholder-slate-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                    หมวดหมู่
                  </label>
                  <select
                    value={newPinCategory}
                    onChange={(e) => setNewPinCategory(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs rounded-xl liquid-glass-card text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#b2744c]/50 focus:outline-none"
                  >
                    <option value="จุดนัดพบ">จุดนัดพบ</option>
                    <option value="ร้านอาหาร/คาเฟ่">ร้านอาหาร/คาเฟ่</option>
                    <option value="สถานที่ทำงาน">สถานที่ทำงาน</option>
                    <option value="จุดส่งพัสดุ">จุดส่งพัสดุ</option>
                    <option value="อื่นๆ">อื่นๆ</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-900 dark:text-slate-100 mb-1">
                    บันทึกเพิ่มเติม (Notes)
                  </label>
                  <textarea
                    rows={2}
                    value={newPinNotes}
                    onChange={(e) => setNewPinNotes(e.target.value)}
                    placeholder="รายละเอียดเพิ่มเติม..."
                    className="w-full px-3.5 py-2 text-xs rounded-xl liquid-glass-card text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-[#b2744c]/50 focus:outline-none placeholder-slate-500"
                  />
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-xl bg-[#b2744c] hover:bg-[#9d633e] text-white text-xs font-black transition shadow-md shadow-[#b2744c]/30 cursor-pointer"
                  >
                    บันทึกหมุดนี้
                  </button>
                  <button
                    type="button"
                    onClick={onCancelPendingPin}
                    className="px-3.5 py-2.5 rounded-xl liquid-glass-btn text-slate-800 dark:text-slate-200 font-bold text-xs cursor-pointer"
                  >
                    ยกเลิก
                  </button>
                </div>
              </form>
            ) : (
              <div className="p-3.5 rounded-2xl liquid-glass-card border-[#b2744c]/40 text-xs bg-[#b2744c]/10 shadow-sm">
                <div className="flex items-center gap-2 font-black text-[#8a4e28] dark:text-[#d4a373] text-sm">
                  <JKIcon name="sparkles" className="text-sm text-[#b2744c]" /> แตะหรือคลิกที่แผนที่
                </div>
                <p className="text-slate-600 dark:text-slate-300 text-xs mt-1 leading-relaxed font-medium">
                  คลิกที่ตำแหน่งใดก็ได้บนแผนที่เพื่อสร้างหมุดของคุณเอง พร้อมกรอกชื่อและโน้ตย่อ
                </p>
              </div>
            )}

            {/* Saved Pins List */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 block">
                  หมุดที่คุณบันทึกไว้ ({customPins.length})
                </span>
              </div>

              {customPins.length === 0 ? (
                <div className="p-6 text-center text-slate-600 dark:text-slate-300 text-xs font-medium liquid-glass-card rounded-2xl shadow-sm">
                  ยังไม่มีหมุดที่บันทึกไว้ ลองคลิกที่แผนที่เพื่อเริ่มปักหมุด
                </div>
              ) : (
                customPins.map((pin) => (
                  <div
                    key={pin.id}
                    className="p-3.5 rounded-2xl liquid-glass-card flex items-start justify-between gap-2.5 group hover:border-[#b2744c]/50 transition shadow-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <JKIcon name="map-pin" className="text-[#b2744c] text-xs flex-shrink-0" />
                        <h4 className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {pin.title}
                        </h4>
                      </div>
                      <p className="text-[11px] text-[#8a4e28] dark:text-[#d4a373] font-bold mt-0.5">
                        {pin.category}
                      </p>
                      {pin.notes && (
                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 font-medium leading-relaxed">
                          {pin.notes}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2.5">
                        <button
                          onClick={() => onFlyToCustomPin(pin)}
                          className="text-[11px] px-2.5 py-1 rounded-lg liquid-glass-btn text-[#8a4e28] dark:text-[#d4a373] font-black hover:bg-[#b2744c]/15 transition cursor-pointer"
                        >
                          บินไปที่นี่
                        </button>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{pin.createdAt}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => onDeleteCustomPin(pin.id)}
                      aria-label="Delete pin"
                      className="p-1.5 rounded-xl text-slate-400 hover:text-[#b2744c] hover:bg-[#b2744c]/15 transition cursor-pointer"
                    >
                      <JKIcon name="trash-can" className="text-xs" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
