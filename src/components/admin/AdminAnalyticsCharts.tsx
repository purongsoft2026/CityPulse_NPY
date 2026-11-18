"use client";

import React, { useMemo, useState, useSyncExternalStore } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  type ComplaintReport,
} from "@/data/map-data";
import {
  getAllDepartmentsSnapshot,
  getServerDepartmentsSnapshot,
  subscribeDepartments,
} from "@/lib/departments-store";

interface AdminAnalyticsChartsProps {
  complaints: ComplaintReport[];
  iosCardClass: string;
  activeStatusFilter: string;
  onSelectStatusFilter: (status: string) => void;
  activeCategoryFilter: string;
  onSelectCategoryFilter: (categoryId: string) => void;
}

const THAI_MONTH_MAP: Record<string, number> = {
  "ม.ค.": 0,
  "ก.พ.": 1,
  "มี.ค.": 2,
  "เม.ย.": 3,
  "พ.ค.": 4,
  "มิ.ย.": 5,
  "ก.ค.": 6,
  "ส.ค.": 7,
  "ก.ย.": 8,
  "ต.ค.": 9,
  "พ.ย.": 10,
  "ธ.ค.": 11,
};

function parseThaiShortDate(label: string): number {
  const parts = label.trim().split(/\s+/);
  if (parts.length >= 3) {
    const day = Number(parts[0]);
    const month = THAI_MONTH_MAP[parts[1]];
    let year = Number(parts[2]);
    if (Number.isFinite(day) && month !== undefined && Number.isFinite(year)) {
      if (year > 2400) year -= 543;
      return new Date(year, month, day).getTime();
    }
  }
  const fallback = Date.parse(label);
  return Number.isFinite(fallback) ? fallback : 0;
}

function buildSmoothAreaPaths(points: { x: number; y: number }[], baseY: number) {
  if (points.length === 0) return { linePath: "", areaPath: "" };
  if (points.length === 1) {
    const p = points[0];
    return {
      linePath: `M ${p.x} ${p.y}`,
      areaPath: `M ${p.x} ${baseY} L ${p.x} ${p.y} L ${p.x} ${baseY} Z`,
    };
  }

  let linePath = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpx = (p0.x + p1.x) / 2;
    linePath += ` C ${cpx} ${p0.y}, ${cpx} ${p1.y}, ${p1.x} ${p1.y}`;
  }

  const last = points[points.length - 1];
  const first = points[0];
  const areaPath = `${linePath} L ${last.x} ${baseY} L ${first.x} ${baseY} Z`;
  return { linePath, areaPath };
}

export function AdminAnalyticsCharts({
  complaints,
  iosCardClass,
  activeStatusFilter,
  onSelectStatusFilter,
  activeCategoryFilter,
  onSelectCategoryFilter,
}: AdminAnalyticsChartsProps) {
  const departments = useSyncExternalStore(
    subscribeDepartments,
    getAllDepartmentsSnapshot,
    getServerDepartmentsSnapshot
  );
  const [hoveredStatus, setHoveredStatus] = useState<string | null>(null);
  const [hoveredTrendIdx, setHoveredTrendIdx] = useState<number | null>(null);
  const [rightChartMode, setRightChartMode] = useState<"trend" | "dept">("trend");

  const total = complaints.length;

  const statusData = useMemo(() => {
    const pending = complaints.filter((c) => c.status === "pending").length;
    const inprogress = complaints.filter((c) => c.status === "inprogress").length;
    const resolved = complaints.filter((c) => c.status === "resolved").length;
    return [
      { key: "pending", label: "รอดำเนินการ", count: pending, color: "#f59e0b" },
      { key: "inprogress", label: "กำลังแก้ไข", count: inprogress, color: "#0ea5e9" },
      { key: "resolved", label: "แก้ไขเสร็จสิ้น", count: resolved, color: "#10b981" },
    ];
  }, [complaints]);

  const priorityData = useMemo(() => {
    const urgent = complaints.filter((c) => c.priority === "urgent").length;
    const high = complaints.filter((c) => c.priority === "high").length;
    const medium = complaints.filter((c) => c.priority === "medium").length;
    const low = complaints.filter((c) => c.priority === "low").length;
    return [
      { key: "urgent", label: "เร่งด่วนมาก", count: urgent, color: "bg-rose-500" },
      { key: "high", label: "สูง", count: high, color: "bg-orange-500" },
      { key: "medium", label: "ปานกลาง", count: medium, color: "bg-amber-400" },
      { key: "low", label: "ปกติ", count: low, color: "bg-slate-400" },
    ];
  }, [complaints]);

  const categoryData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of complaints) {
      counts.set(c.categoryId, (counts.get(c.categoryId) ?? 0) + 1);
    }
    return COMPLAINT_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      count: counts.get(cat.id) ?? 0,
    }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [complaints]);

  const maxCatCount = Math.max(1, ...categoryData.map((c) => c.count));

  const trendSeries = useMemo(() => {
    const byDate = new Map<string, { label: string; ts: number; count: number; resolved: number }>();
    for (const c of complaints) {
      const label = c.createdAt || "ไม่ระบุ";
      const existing = byDate.get(label);
      if (existing) {
        existing.count += 1;
        if (c.status === "resolved") existing.resolved += 1;
      } else {
        byDate.set(label, {
          label,
          ts: parseThaiShortDate(label),
          count: 1,
          resolved: c.status === "resolved" ? 1 : 0,
        });
      }
    }
    return Array.from(byDate.values()).sort((a, b) => a.ts - b.ts);
  }, [complaints]);

  const deptSeries = useMemo(() => {
    return departments.map((d) => {
      const items = complaints.filter((c) => c.departmentId === d.id);
      return {
        id: d.id,
        name: d.name.replace("สำนัก", "สน.").slice(0, 22),
        color: d.color,
        total: items.length,
        resolved: items.filter((c) => c.status === "resolved").length,
        pending: items.filter((c) => c.status === "pending").length,
      };
    });
  }, [complaints, departments]);

  const maxDeptCount = Math.max(1, ...deptSeries.map((d) => d.total));

  // Donut ring math (radius = 48, circumference = 2 * pi * 48)
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const resolvedCount = statusData.find((s) => s.key === "resolved")?.count ?? 0;
  const resolutionRate = total > 0 ? Math.round((resolvedCount / total) * 100) : 0;

  const segments = useMemo(() => {
    if (total === 0) return [];
    const nonEmpty = statusData.filter((item) => item.count > 0);
    let accumulatedRatio = 0;
    return nonEmpty.map((item) => {
      const ratio = item.count / total;
      const dashLength =
        nonEmpty.length === 1 ? circumference : Math.max(2, ratio * circumference - 4);
      const offset = -accumulatedRatio * circumference;
      accumulatedRatio += ratio;
      return { ...item, dashLength, offset, pct: Math.round(ratio * 100) };
    });
  }, [statusData, total, circumference]);

  // SVG Trend Area Chart coordinates (viewBox 320 x 138)
  const chartW = 320;
  const chartH = 128;
  const padX = 22;
  const padTop = 18;
  const baseY = 104;
  const maxTrendVal = Math.max(1, ...trendSeries.map((p) => p.count));
  const plottedPoints = useMemo(() => {
    if (trendSeries.length === 0) return [];
    if (trendSeries.length === 1) {
      const y = baseY - (trendSeries[0].count / maxTrendVal) * (baseY - padTop);
      return [{ ...trendSeries[0], x: chartW / 2, y }];
    }
    const usableW = chartW - padX * 2;
    return trendSeries.map((item, idx) => {
      const x = padX + (idx / (trendSeries.length - 1)) * usableW;
      const y = baseY - (item.count / maxTrendVal) * (baseY - padTop);
      return { ...item, x, y };
    });
  }, [trendSeries, maxTrendVal]);

  const { linePath, areaPath } = useMemo(
    () => buildSmoothAreaPaths(plottedPoints, baseY),
    [plottedPoints],
  );

  const activeTrendPoint =
    hoveredTrendIdx !== null && plottedPoints[hoveredTrendIdx]
      ? plottedPoints[hoveredTrendIdx]
      : plottedPoints[plottedPoints.length - 1] ?? null;

  return (
    <section
      aria-label="แดชบอร์ดกราฟวิเคราะห์ข้อมูลเรื่องร้องเรียน"
      className="grid grid-cols-1 lg:grid-cols-3 gap-4 animate-in fade-in duration-200"
    >
      {/* Chart 1: Status Donut + Priority Breakdown */}
      <div className={`p-5 rounded-[26px] flex flex-col justify-between gap-4 ${iosCardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-[10px] bg-sky-500/15 text-sky-600 dark:text-cyan-300 flex items-center justify-center text-xs">
                <JKIcon name="chart-pie" />
              </span>
              <span>สถานะ & ความเร่งด่วน</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              คลิกที่กลุ่มสถานะเพื่อกรองรายการทันที
            </p>
          </div>
          {activeStatusFilter !== "all" && (
            <button
              type="button"
              onClick={() => onSelectStatusFilter("all")}
              className="px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 cursor-pointer transition"
            >
              รีเซ็ต
            </button>
          )}
        </div>

        <div className="flex items-center gap-5">
          {/* SVG Ring */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 overflow-visible">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="12"
                className="stroke-slate-200/80 dark:stroke-white/[0.08]"
              />
              {segments.map((seg) => {
                const isEmphasized =
                  hoveredStatus === seg.key || activeStatusFilter === seg.key;
                return (
                  <circle
                    key={seg.key}
                    cx="60"
                    cy="60"
                    r={radius}
                    fill="none"
                    stroke={seg.color}
                    strokeWidth={isEmphasized ? 15 : 12}
                    strokeLinecap="round"
                    strokeDasharray={`${seg.dashLength} ${circumference}`}
                    strokeDashoffset={seg.offset}
                    className="transition-all duration-300 cursor-pointer"
                    onMouseEnter={() => setHoveredStatus(seg.key)}
                    onMouseLeave={() => setHoveredStatus(null)}
                    onClick={() =>
                      onSelectStatusFilter(
                        activeStatusFilter === seg.key ? "all" : seg.key,
                      )
                    }
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
              <span className="text-xl font-black font-mono leading-none text-slate-900 dark:text-white">
                {resolutionRate}%
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                ปิดงานแล้ว
              </span>
            </div>
          </div>

          {/* Interactive Legend */}
          <div className="flex-1 space-y-2 min-w-0">
            {statusData.map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              const isSelected = activeStatusFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onMouseEnter={() => setHoveredStatus(item.key)}
                  onMouseLeave={() => setHoveredStatus(null)}
                  onClick={() =>
                    onSelectStatusFilter(isSelected ? "all" : item.key)
                  }
                  className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl text-left text-xs transition cursor-pointer ${
                    isSelected
                      ? "bg-sky-500/15 ring-1 ring-sky-500/40"
                      : "hover:bg-slate-200/60 dark:hover:bg-white/[0.06]"
                  }`}
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="truncate font-bold text-slate-700 dark:text-slate-200">
                      {item.label}
                    </span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                    {item.count}{" "}
                    <span className="text-[10px] text-slate-400">({pct}%)</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Priority Stacked Distribution Bar */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200/70 dark:border-white/10">
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
            <span>สัดส่วนระดับความเร่งด่วน</span>
            <span className="font-mono">{total} เรื่อง</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-200/80 dark:bg-white/10 overflow-hidden flex gap-0.5 p-0.5">
            {total > 0 &&
              priorityData.map((p) => {
                if (p.count === 0) return null;
                return (
                  <div
                    key={p.key}
                    className={`h-full rounded-full ${p.color} transition-all duration-500`}
                    style={{ width: `${(p.count / total) * 100}%` }}
                    title={`${p.label}: ${p.count} เรื่อง`}
                  />
                );
              })}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-500 dark:text-slate-400">
            {priorityData.map((p) => (
              <span key={p.key} className="inline-flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${p.color}`} />
                <span>
                  {p.label} {p.count}
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Chart 2: Category Pill Horizontal Bar Chart */}
      <div className={`p-5 rounded-[26px] flex flex-col justify-between gap-3 ${iosCardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-[10px] bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center text-xs">
                <JKIcon name="chart-bar" />
              </span>
              <span>ปริมาณเรื่องตามหมวดหมู่</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              คลิกที่แท่งกราฟเพื่อกรองตามหมวดหมู่
            </p>
          </div>
          {activeCategoryFilter !== "all" && (
            <button
              type="button"
              onClick={() => onSelectCategoryFilter("all")}
              className="px-2.5 py-1 rounded-full bg-slate-200/80 dark:bg-white/10 text-[10px] font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-white/20 cursor-pointer transition"
            >
              ล้างหมวดหมู่
            </button>
          )}
        </div>

        <div className="space-y-2.5 my-auto">
          {categoryData.map((cat) => {
            const widthPct = total > 0 ? Math.max(cat.count > 0 ? 12 : 0, (cat.count / maxCatCount) * 100) : 0;
            const sharePct = total > 0 ? Math.round((cat.count / total) * 100) : 0;
            const isSelected = activeCategoryFilter === cat.id;

            return (
              <button
                key={cat.id}
                type="button"
                onClick={() =>
                  onSelectCategoryFilter(isSelected ? "all" : cat.id)
                }
                className={`w-full text-left p-1.5 -mx-1.5 rounded-xl transition cursor-pointer ${
                  isSelected
                    ? "bg-sky-500/12 ring-1 ring-sky-500/40"
                    : "hover:bg-slate-200/55 dark:hover:bg-white/[0.05]"
                }`}
              >
                <div className="flex items-center justify-between gap-2 text-[11px] mb-1">
                  <span className="flex items-center gap-1.5 min-w-0 font-bold text-slate-700 dark:text-slate-200">
                    <span
                      className="w-4 h-4 rounded-md text-white flex items-center justify-center text-[9px] shrink-0"
                      style={{ backgroundColor: cat.color }}
                    >
                      <JKIcon name={cat.icon} />
                    </span>
                    <span className="truncate">{cat.label}</span>
                  </span>
                  <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-white shrink-0">
                    {cat.count} <span className="text-[10px] text-slate-400">({sharePct}%)</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: cat.color,
                    }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart 3: Daily Trend Area Chart / Department Workload Switcher */}
      <div className={`p-5 rounded-[26px] flex flex-col justify-between gap-3 ${iosCardClass}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div>
            <h3 className="text-sm font-black tracking-tight flex items-center gap-2">
              <span className="w-7 h-7 rounded-[10px] bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 flex items-center justify-center text-xs">
                <JKIcon name={rightChartMode === "trend" ? "chart-line" : "building"} />
              </span>
              <span>
                {rightChartMode === "trend" ? "แนวโน้มการรับแจ้งเรื่อง" : "ภาระงานรายหน่วยงาน"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {rightChartMode === "trend"
                ? "สถิติจำนวนเรื่องเข้าใหม่ตามวันที่"
                : "เปรียบเทียบปริมาณเคสและงานปิดแล้ว"}
            </p>
          </div>

          <div className="flex items-center p-0.5 rounded-full bg-slate-200/80 dark:bg-black/35 border border-slate-300/50 dark:border-white/10">
            <button
              type="button"
              onClick={() => setRightChartMode("trend")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                rightChartMode === "trend"
                  ? "bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              รายวัน
            </button>
            <button
              type="button"
              onClick={() => setRightChartMode("dept")}
              className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                rightChartMode === "dept"
                  ? "bg-white dark:bg-white/20 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              หน่วยงาน
            </button>
          </div>
        </div>

        {rightChartMode === "trend" ? (
          <div className="space-y-2 my-auto">
            {plottedPoints.length === 0 ? (
              <div className="h-36 flex items-center justify-center text-xs text-slate-400">
                ไม่มีข้อมูลในเงื่อนไขที่เลือก
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-sky-500/10 dark:bg-cyan-500/10 border border-sky-500/20 text-[11px]">
                  <span className="font-bold text-sky-800 dark:text-cyan-200">
                    วันที่ {activeTrendPoint?.label}
                  </span>
                  <span className="font-mono font-bold text-sky-700 dark:text-cyan-300">
                    {activeTrendPoint?.count ?? 0} เรื่อง (เสร็จ {activeTrendPoint?.resolved ?? 0})
                  </span>
                </div>

                <svg viewBox={`0 0 ${chartW} ${chartH}`} className="w-full h-32 overflow-visible">
                  <defs>
                    <linearGradient id="adminTrendFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.34" />
                      <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
                    </linearGradient>
                  </defs>

                  {[0.25, 0.5, 0.75, 1].map((frac) => {
                    const y = baseY - frac * (baseY - padTop);
                    return (
                      <line
                        key={frac}
                        x1={padX}
                        y1={y}
                        x2={chartW - padX}
                        y2={y}
                        strokeDasharray="3 3"
                        className="stroke-slate-300/70 dark:stroke-white/10"
                      />
                    );
                  })}

                  <path d={areaPath} fill="url(#adminTrendFill)" />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="#0ea5e9"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />

                  {plottedPoints.map((pt, idx) => {
                    const isFocused =
                      hoveredTrendIdx === idx ||
                      (hoveredTrendIdx === null && idx === plottedPoints.length - 1);
                    return (
                      <g
                        key={pt.label}
                        className="cursor-pointer"
                        onMouseEnter={() => setHoveredTrendIdx(idx)}
                        onMouseLeave={() => setHoveredTrendIdx(null)}
                      >
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={14}
                          fill="transparent"
                        />
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isFocused ? 5.5 : 3.8}
                          className="fill-white dark:fill-slate-900 transition-all duration-150"
                          stroke="#0ea5e9"
                          strokeWidth={isFocused ? 3 : 2.2}
                        />
                        <text
                          x={pt.x}
                          y={chartH - 4}
                          textAnchor="middle"
                          className="fill-slate-500 dark:fill-slate-400 text-[9px] font-mono"
                        >
                          {pt.label.split(" ").slice(0, 2).join(" ")}
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2.5 my-auto">
            {deptSeries.map((d) => {
              const barPct = total > 0 ? Math.max(d.total > 0 ? 12 : 0, (d.total / maxDeptCount) * 100) : 0;
              return (
                <div key={d.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate pr-2">
                      {d.name}
                    </span>
                    <span className="font-mono text-[10px] font-bold text-slate-700 dark:text-slate-300 shrink-0">
                      {d.total} เรื่อง • เสร็จ {d.resolved}
                    </span>
                  </div>
                  <div className="h-2.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${barPct}%`,
                        backgroundColor: d.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

