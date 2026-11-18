"use client";

import React, { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  inferProvinceFromCoord,
  type ComplaintReport,
  type ComplaintStatus,
} from "@/data/map-data";

interface ComplaintSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  province: string;
  complaints: ComplaintReport[];
  selectedComplaint: ComplaintReport | null;
  onSelectComplaint: (c: ComplaintReport) => void;
  onDeleteComplaint: (id: string) => void;
  onOpenForm: () => void;
  onOpenDetail: (c: ComplaintReport) => void;
  upvotedIds?: Set<string>;
  onToggleUpvote?: (id: string) => void;
  onShareComplaint?: (c: ComplaintReport) => void;
}

const STATUS_CONFIG: Record<ComplaintStatus, { label: string; color: string; icon: string; pill: string }> = {
  pending: {
    label: "รอดำเนินการ",
    color: "#f59e0b",
    icon: "clock",
    pill: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 border border-amber-200 dark:border-amber-700/50",
  },
  inprogress: {
    label: "กำลังดำเนินการ",
    color: "#3b82f6",
    icon: "arrows-spin",
    pill: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-700/50",
  },
  resolved: {
    label: "แก้ไขแล้ว",
    color: "#22c55e",
    icon: "circle-check",
    pill: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border border-green-200 dark:border-green-700/50",
  },
};

export function ComplaintSidebar({
  isOpen,
  onClose,
  province,
  complaints,
  selectedComplaint,
  onSelectComplaint,
  onDeleteComplaint,
  onOpenForm,
  onOpenDetail,
  upvotedIds = new Set(),
  onToggleUpvote,
  onShareComplaint,
}: ComplaintSidebarProps) {
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<ComplaintStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<"latest" | "popular">("latest");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const categoryScrollRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // Auto scroll active complaint card to vertical center of sidebar
  useEffect(() => {
    if (!selectedComplaint || !isOpen) return;

    const scrollToCenter = () => {
      const container = listContainerRef.current;
      const targetEl = itemRefs.current.get(selectedComplaint.id);

      if (container && targetEl) {
        const containerRect = container.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const currentScrollTop = container.scrollTop;

        const diff =
          targetRect.top -
          containerRect.top +
          targetRect.height / 2 -
          containerRect.height / 2;

        container.scrollTo({
          top: currentScrollTop + diff,
          behavior: "smooth",
        });
      }
    };

    const timer = setTimeout(scrollToCenter, 120);
    return () => clearTimeout(timer);
  }, [selectedComplaint, isOpen]);

  const checkScroll = useCallback(() => {
    if (categoryScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = categoryScrollRef.current;
      setCanScrollLeft(scrollLeft > 2);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 2);
    }
  }, []);

  useEffect(() => {
    checkScroll();
    const el = categoryScrollRef.current;
    if (el) {
      el.addEventListener("scroll", checkScroll, { passive: true });
      window.addEventListener("resize", checkScroll);
      return () => {
        el.removeEventListener("scroll", checkScroll);
        window.removeEventListener("resize", checkScroll);
      };
    }
  }, [checkScroll]);

  const handleScrollLeft = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: -140, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (categoryScrollRef.current) {
      categoryScrollRef.current.scrollBy({ left: 140, behavior: "smooth" });
    }
  };

  // Stats
  const stats = useMemo(() => ({
    total: complaints.length,
    pending: complaints.filter((c) => c.status === "pending").length,
    inprogress: complaints.filter((c) => c.status === "inprogress").length,
    resolved: complaints.filter((c) => c.status === "resolved").length,
  }), [complaints]);

  // Filtered & Sorted list
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = complaints.filter((c) => {
      if (filterCategory !== "all" && c.categoryId !== filterCategory) return false;
      if (filterStatus !== "all" && c.status !== filterStatus) return false;
      if (q) {
        const prov = c.province || inferProvinceFromCoord(c.coordinates);
        const match =
          c.title.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.reporterName.toLowerCase().includes(q) ||
          prov.toLowerCase().includes(q) ||
          (c.district || "").toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });

    if (sortBy === "popular") {
      return [...list].sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
    }
    return list;
  }, [complaints, filterCategory, filterStatus, searchQuery, sortBy]);

  return (
    <>
      {/* Overlay for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/45 backdrop-blur-[2px] z-35 md:hidden pointer-events-auto transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel: Mobile Bottom Sheet (< md) vs Desktop Floating Sidebar (md+) */}
      <aside
        className={`fixed z-40 md:z-30 flex flex-col transition-all duration-300 ease-out pointer-events-auto
          inset-x-0 bottom-0 top-auto h-[84vh] max-h-[88vh] rounded-t-[32px] rounded-b-none border-t border-x-0 border-b-0
          ${isOpen ? "translate-y-0 opacity-100" : "translate-y-full opacity-0 pointer-events-none"}
          md:inset-x-auto md:top-16 md:bottom-4 md:left-3.5 md:h-auto md:w-[370px] md:max-w-[calc(100vw-28px)] md:rounded-[32px] md:border
          ${isOpen ? "md:translate-x-0 md:translate-y-0 md:opacity-100" : "md:-translate-x-[calc(100%+24px)] md:translate-y-0 md:opacity-0 md:pointer-events-none"}
          ios-glass-sheet shadow-2xl`}
      >
        {/* Mobile Pull Grab Handle */}
        <div className="md:hidden pt-2.5 pb-1 flex justify-center rounded-t-[32px] cursor-pointer" onClick={onClose}>
          <div className="w-12 h-1.5 rounded-full bg-slate-500/30 dark:bg-white/30" />
        </div>

        <div className="flex flex-col flex-1 min-h-0">

          {/* Header with Mascot Decoration (overflows top edge so header stays compact) */}
          <div className="relative px-5 py-2.5 sm:py-3 flex flex-col justify-center border-b border-slate-900/[0.06] dark:border-white/[0.08] flex-shrink-0 overflow-visible md:rounded-t-[32px]">
            {/* Mascot Decoration (pops above top edge) */}
            <div className="absolute right-12 -top-5 sm:-top-6 pointer-events-none select-none z-20">
              <div className="relative w-[76px] h-[76px] sm:w-[84px] sm:h-[84px] transition-transform duration-300">
                <img
                  src="/images/mascot.png"
                  alt="City Inspector Mascot"
                  className="w-full h-full object-contain drop-shadow-[0_8px_16px_rgba(0,0,0,0.25)]"
                />
              </div>
            </div>

            {/* Header Content */}
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                    เรื่องร้องเรียน
                  </h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-ping" />
                    Inspector
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                  {province} · {stats.total} รายการ
                </p>
              </div>
              <button
                onClick={onClose}
                className="relative z-30 w-8 h-8 rounded-xl flex items-center justify-center bg-white/65 dark:bg-white/10 text-slate-600 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white hover:bg-white/90 dark:hover:bg-white/20 transition cursor-pointer"
              >
                <JKIcon name="xmark" className="text-sm" />
              </button>
            </div>
          </div>

          {/* Search Input */}
          <search className="px-4 pt-2.5 flex-shrink-0">
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 dark:text-slate-300 pointer-events-none">
                <JKIcon name="magnifying-glass" className="text-[11px]" />
              </div>
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="ค้นหาปัญหา, เขต, หรือผู้แจ้ง..."
                aria-label="ค้นหารายการร้องเรียน"
                className="w-full pl-8 pr-8 py-2 rounded-2xl bg-white/80 dark:bg-slate-900/60 border border-white/85 dark:border-white/[0.16] shadow-[inset_0_1px_1px_rgba(255,255,255,0.85)] dark:shadow-none text-xs text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-slate-400 focus:bg-white/95 dark:focus:bg-slate-900/80 focus:outline-none focus:ring-2 focus:ring-teal-500/40 transition"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="ล้างคำค้นหา"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800 dark:text-slate-300 dark:hover:text-white cursor-pointer"
                >
                  <JKIcon name="xmark" className="text-xs" />
                </button>
              )}
            </div>
          </search>

          {/* Stats Cards */}
          <div className="px-4 py-2.5 grid grid-cols-3 gap-2 flex-shrink-0">
            {([
              { status: "pending", ...STATUS_CONFIG.pending, count: stats.pending },
              { status: "inprogress", ...STATUS_CONFIG.inprogress, count: stats.inprogress },
              { status: "resolved", ...STATUS_CONFIG.resolved, count: stats.resolved },
            ] as const).map((s) => (
              <button
                key={s.status}
                onClick={() => setFilterStatus(filterStatus === s.status ? "all" : s.status)}
                className={`flex flex-col items-center p-2.5 rounded-2xl border transition-all cursor-pointer ${filterStatus === s.status
                  ? "bg-white/92 dark:bg-slate-900/80 scale-[1.02] shadow-sm"
                  : "bg-white/80 dark:bg-slate-900/55 border-white/85 dark:border-white/[0.14] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none hover:bg-white/92 dark:hover:bg-slate-900/72 hover:scale-[1.01]"
                  }`}
                style={filterStatus === s.status ? { borderColor: s.color, boxShadow: `0 4px 14px -4px ${s.color}35` } : {}}
              >
                <span className="text-xl font-black" style={{ color: s.color }}>{s.count}</span>
                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 text-center leading-tight mt-0.5">{s.label}</span>
              </button>
            ))}
          </div>

          {/* Category Filter */}
          <div className="px-0 pb-3 flex-shrink-0 flex items-center gap-1">
            {/* Scroll Left Button */}
            <button
              type="button"
              onClick={handleScrollLeft}
              disabled={!canScrollLeft}
              aria-label="เลื่อนซ้าย"
              className="flex-shrink-0 w-7 h-7 ml-2 rounded-xl flex items-center justify-center bg-white/80 dark:bg-white/15 border border-white/80 dark:border-white/15 hover:bg-white dark:hover:bg-white/25 text-slate-700 dark:text-slate-200 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-xs"
            >
              <JKIcon name="chevron-left" className="text-[10px]" />
            </button>

            {/* Scrollable Pills with padding 0, scrollbar hidden */}
            <div
              ref={categoryScrollRef}
              className="flex-1 flex gap-1.5 overflow-x-auto scrollbar-none no-scrollbar scroll-smooth px-0 py-0.5"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <button
                onClick={() => setFilterCategory("all")}
                className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${filterCategory === "all"
                  ? "bg-slate-800 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                  : "bg-white/80 dark:bg-white/12 border border-white/80 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/95 dark:hover:bg-white/20"
                  }`}
              >
                ทั้งหมด
              </button>
              {COMPLAINT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setFilterCategory(filterCategory === cat.id ? "all" : cat.id)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${filterCategory === cat.id
                    ? "text-white shadow-sm"
                    : "bg-white/80 dark:bg-white/12 border border-white/80 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white/95 dark:hover:bg-white/20"
                    }`}
                  style={filterCategory === cat.id ? { backgroundColor: cat.color } : {}}
                >
                  <JKIcon name={cat.icon} className="text-[10px]" />
                  <span>{cat.label.split("/")[0]}</span>
                </button>
              ))}
            </div>

            {/* Scroll Right Button */}
            <button
              type="button"
              onClick={handleScrollRight}
              disabled={!canScrollRight}
              aria-label="เลื่อนขวา"
              className="flex-shrink-0 w-7 h-7 mr-2 rounded-xl flex items-center justify-center bg-white/80 dark:bg-white/15 border border-white/80 dark:border-white/15 hover:bg-white dark:hover:bg-white/25 text-slate-700 dark:text-slate-200 disabled:opacity-20 disabled:pointer-events-none transition cursor-pointer shadow-xs"
            >
              <JKIcon name="chevron-right" className="text-[10px]" />
            </button>
          </div>

          {/* Sort Switcher Bar */}
          <div className="px-4 pb-2.5 flex-shrink-0 flex items-center justify-between text-[11px]">
            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">เรียงตาม:</span>
            <div className="flex items-center gap-1 bg-white/75 dark:bg-slate-900/55 p-0.5 rounded-xl border border-white/80 dark:border-white/15">
              <button
                type="button"
                onClick={() => setSortBy("latest")}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 ${
                  sortBy === "latest"
                    ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <JKIcon name="clock" className="text-[9px]" />
                ล่าสุด
              </button>
              <button
                type="button"
                onClick={() => setSortBy("popular")}
                className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 ${
                  sortBy === "popular"
                    ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-xs font-black"
                    : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                }`}
              >
                <JKIcon name="fire" className="text-[9px] text-orange-400" />
                โหวตสูงสุด
              </button>
            </div>
          </div>

          {/* Complaint List */}
          <div
            ref={listContainerRef}
            className="flex-1 overflow-y-auto px-4 pt-1 pb-4 space-y-2.5 min-h-0 custom-scrollbar scroll-smooth"
          >
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <div className="relative w-28 h-28 mb-2 transition-transform duration-300 hover:scale-105">
                  <img
                    src="/images/mascot_searching.png"
                    alt="City Inspector Searching"
                    className="w-full h-full object-contain drop-shadow-xl animate-pulse"
                  />
                </div>
                {/* Speech Bubble from Mascot */}
                <div className="relative px-3.5 py-2 rounded-2xl bg-white/85 dark:bg-slate-800/85 border border-white/90 dark:border-white/15 shadow-sm max-w-[240px]">
                  <p className="text-xs font-black text-slate-900 dark:text-white">ไม่พบเรื่องร้องเรียนในหมวดนี้</p>
                  <p className="text-[10px] text-slate-600 dark:text-slate-300 mt-0.5">น้องอินสเปกเตอร์พร้อมช่วยส่องหาหมวดอื่นนะ!</p>
                </div>
              </div>
            ) : (
              filtered.map((complaint) => {
                const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
                const statusCfg = STATUS_CONFIG[complaint.status];
                const isSelected = selectedComplaint?.id === complaint.id;
                const isUpvoted = upvotedIds.has(complaint.id);
                const isHot = (complaint.upvotes ?? 0) >= 25;

                return (
                  <div
                    key={complaint.id}
                    ref={(el) => {
                      if (el) {
                        itemRefs.current.set(complaint.id, el);
                      } else {
                        itemRefs.current.delete(complaint.id);
                      }
                    }}
                    onClick={() => onSelectComplaint(complaint)}
                    className={`group relative p-3.5 rounded-2xl border cursor-pointer transition-all duration-200 ${isSelected
                      ? "bg-white/95 dark:bg-slate-800/85 shadow-md scale-[1.01]"
                      : "bg-white/86 dark:bg-slate-900/62 border-white/90 dark:border-white/[0.14] shadow-[0_2px_10px_-4px_rgba(15,23,42,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:shadow-none hover:bg-white/95 dark:hover:bg-slate-900/78 hover:border-white dark:hover:border-white/25 hover:shadow-sm hover:scale-[1.005]"
                      }`}
                    style={
                      isSelected
                        ? {
                            borderColor: cat?.color || "#ef4444",
                            boxShadow: `0 6px 20px -6px ${(cat?.color || "#ef4444")}40`,
                          }
                        : {}
                    }
                  >
                    {/* Top Row: Category + Status */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: cat?.color || "#94a3b8" }}
                        />
                        <span className="text-[11px] font-bold text-slate-600 dark:text-slate-300 truncate">
                          {cat?.label || "ทั่วไป"}
                        </span>
                        {complaint.imageBase64 && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/15 border border-sky-200/60 dark:border-sky-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            <JKIcon name="camera" className="text-[8px]" />
                            มีรูปภาพ
                          </span>
                        )}
                        {isHot && (
                          <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-500/15 border border-orange-200/60 dark:border-orange-500/20 px-1.5 py-0.5 rounded-md flex-shrink-0">
                            <JKIcon name="fire" className="text-[8px] text-orange-500" />
                            ด่วน
                          </span>
                        )}
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 flex items-center gap-1 ${statusCfg.pill}`}>
                        <JKIcon name={statusCfg.icon} className="text-[9px]" />
                        {statusCfg.label}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-xs font-black text-slate-900 dark:text-white line-clamp-1 mb-1 group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors">
                      {complaint.title}
                    </h3>

                    {/* Description preview */}
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed mb-2.5 font-medium">
                      {complaint.description}
                    </p>

                    {/* Meta Row: Location + Reporter + Date */}
                    <div className="flex items-center justify-between gap-2 text-[10px] text-slate-500 dark:text-slate-400 pt-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300 truncate max-w-[190px] inline-flex items-center gap-1">
                        {complaint.isAnonymous && (
                          <JKIcon name="user-secret" className="text-[9px] text-amber-500 flex-shrink-0" />
                        )}
                        {!complaint.isAnonymous && complaint.reporterMemberId && (
                          <JKIcon name="user-check" className="text-[9px] text-emerald-500 flex-shrink-0" />
                        )}
                        <span className="truncate">
                          {complaint.province || inferProvinceFromCoord(complaint.coordinates)} · {complaint.isAnonymous ? "ไม่ระบุตัวตน" : complaint.reporterName}
                        </span>
                      </span>
                      <span className="flex-shrink-0">{complaint.createdAt}</span>
                    </div>

                    {/* Upvote & Share Action Row */}
                    <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200/70 dark:border-white/10">
                      {/* Upvote Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleUpvote?.(complaint.id);
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[10px] font-black transition-all cursor-pointer border ${
                          isUpvoted
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-sm shadow-orange-500/30 scale-105"
                            : "bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border-slate-200/60 dark:border-white/10 hover:bg-orange-50 hover:text-orange-600 dark:hover:bg-orange-950/30"
                        }`}
                        title="กด +1 โหวตเพื่อดันปัญหานี้"
                      >
                        <JKIcon
                          name="thumbs-up"
                          className={`text-[9px] ${isUpvoted ? "animate-bounce" : ""}`}
                        />
                        <span>+1</span>
                        <span className="font-mono text-[9px] opacity-90">({complaint.upvotes ?? 0})</span>
                      </button>

                      {/* Right Action Icons */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectComplaint(complaint);
                            onOpenDetail(complaint);
                          }}
                          className="px-2 py-1 rounded-xl text-[10px] font-bold bg-teal-500/10 dark:bg-cyan-500/20 text-teal-700 dark:text-cyan-300 hover:bg-teal-500/20 transition cursor-pointer flex items-center gap-1"
                          title="ดูรายละเอียดและไทม์ไลน์"
                        >
                          <JKIcon name="circle-info" className="text-[10px]" />
                          <span>รายละเอียด</span>
                        </button>

                        {onShareComplaint && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShareComplaint(complaint);
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                            title="แชร์การ์ดปัญหา"
                          >
                            <JKIcon name="share-nodes" className="text-[11px]" />
                          </button>
                        )}
                        {confirmDeleteId === complaint.id ? (
                          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteComplaint(complaint.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 rounded-lg bg-red-600 hover:bg-red-500 text-white text-[10px] font-black transition cursor-pointer"
                            >
                              ยืนยันลบ
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-1.5 py-1 rounded-lg bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-bold transition cursor-pointer"
                            >
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(complaint.id);
                            }}
                            className="opacity-70 md:opacity-0 md:group-hover:opacity-100 text-slate-400 hover:text-red-500 dark:hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
                            title="ลบรายการนี้"
                          >
                            <JKIcon name="trash" className="text-[10px]" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Image Preview Strip */}
                    {complaint.imageBase64 && isSelected && (
                      <div className="mt-3 relative rounded-xl overflow-hidden border border-slate-200/80 dark:border-white/10 group/img shadow-sm">
                        <img
                          src={complaint.imageBase64}
                          alt={complaint.title}
                          className="w-full h-28 object-cover group-hover/img:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute bottom-1.5 right-1.5 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md text-[9px] font-bold text-white flex items-center gap-1">
                          <JKIcon name="image" className="text-[8px]" />
                          รูปภาพประกอบ
                        </div>
                      </div>
                    )}

                    {/* View Detail Button */}
                    {isSelected && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDetail(complaint);
                        }}
                        className="mt-2.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold
                          bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300
                          hover:bg-slate-200 dark:hover:bg-white/20 active:scale-[0.98]
                          transition-all cursor-pointer border border-slate-200/60 dark:border-white/10"
                      >
                        <JKIcon name="eye" className="text-[10px]" />
                        ดูรายละเอียดและไทม์ไลน์
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom CTA */}
          <div className="px-4 py-4 border-t border-slate-900/[0.06] dark:border-white/[0.08] bg-white/55 dark:bg-slate-950/35 flex-shrink-0 rounded-b-[32px]">
            <button
              onClick={onOpenForm}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-extrabold text-sm text-white
                bg-gradient-to-r from-red-500 via-rose-500 to-orange-500
                hover:from-red-400 hover:to-orange-400
                active:scale-[0.98] shadow-lg shadow-red-500/25 transition-all cursor-pointer"
            >
              <JKIcon name="plus" className="text-sm" />
              รายงานปัญหาใหม่
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
