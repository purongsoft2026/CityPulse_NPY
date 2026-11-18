"use client";

import React, { useMemo, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  CITIZEN_LEVEL_TIERS,
  COMPLAINT_CATEGORIES,
  type CitizenXpExtras,
  type ComplaintReport,
  calculateCitizenStats,
} from "@/data/map-data";

type CitizenStats = ReturnType<typeof calculateCitizenStats>;

interface CitizenAnalyticsChartsProps {
  stats: CitizenStats;
  complaints: ComplaintReport[];
  upvotedIds: Set<string>;
  myReportIds: Set<string>;
  citizenXpExtras: CitizenXpExtras;
  iosCardClass: string;
  iosInnerTileClass: string;
}

const XP_SOURCE_META = [
  { key: "checkIns", label: "เช็กอิน", color: "#14b8a6", dotClass: "bg-teal-500" },
  { key: "upvotes", label: "โหวตปัญหา", color: "#f97316", dotClass: "bg-orange-500" },
  { key: "reports", label: "แจ้งเรื่อง", color: "#f43f5e", dotClass: "bg-rose-500" },
  { key: "photos", label: "แนบภาพ", color: "#3b82f6", dotClass: "bg-blue-500" },
  { key: "comments", label: "ความเห็น", color: "#6366f1", dotClass: "bg-indigo-500" },
  { key: "polls", label: "โหวตโพล", color: "#a855f7", dotClass: "bg-purple-500" },
  { key: "resolved", label: "ดันสำเร็จ", color: "#10b981", dotClass: "bg-emerald-500" },
] as const;

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

function computeUserMarkerPoint(
  nodes: { x: number; y: number; xp: number }[],
  currentXp: number,
  fallbackX: number,
  fallbackY: number
) {
  if (nodes.length === 0) return { x: fallbackX, y: fallbackY };
  for (let i = 0; i < nodes.length - 1; i++) {
    const a = nodes[i];
    const b = nodes[i + 1];
    if (currentXp >= a.xp && currentXp <= b.xp) {
      const span = Math.max(1, b.xp - a.xp);
      const t = (currentXp - a.xp) / span;
      return {
        x: a.x + t * (b.x - a.x),
        y: a.y + t * (b.y - a.y),
      };
    }
  }
  const last = nodes[nodes.length - 1];
  return { x: last.x, y: last.y };
}

export function CitizenAnalyticsCharts({
  stats,
  complaints,
  upvotedIds,
  myReportIds,
  citizenXpExtras,
  iosCardClass,
  iosInnerTileClass,
}: CitizenAnalyticsChartsProps) {
  const [hoveredSource, setHoveredSource] = useState<string | null>(null);
  const [hoveredTierIdx, setHoveredTierIdx] = useState<number | null>(null);
  const [rightMode, setRightMode] = useState<"category" | "radar">("category");
  const [hoveredRadarIdx, setHoveredRadarIdx] = useState<number | null>(null);

  // 1. Donut Chart Data (Real XP Breakdown)
  const totalXp = stats.currentXp;
  const xpSources = useMemo(() => {
    return XP_SOURCE_META.map((item) => ({
      ...item,
      xp: stats.breakdown[item.key],
    }));
  }, [stats.breakdown]);

  const radius = 46;
  const circumference = 2 * Math.PI * radius;

  const donutSegments = useMemo(() => {
    if (totalXp === 0) return [];
    const active = xpSources.filter((s) => s.xp > 0);
    let accRatio = 0;
    return active.map((item) => {
      const ratio = item.xp / totalXp;
      const dashLength =
        active.length === 1 ? circumference : Math.max(3, ratio * circumference - 4);
      const offset = -accRatio * circumference;
      accRatio += ratio;
      return {
        ...item,
        dashLength,
        offset,
        pct: Math.round(ratio * 100),
      };
    });
  }, [xpSources, totalXp, circumference]);

  const activeDonutItem = useMemo(() => {
    if (!hoveredSource) return null;
    return donutSegments.find((s) => s.key === hoveredSource) ?? null;
  }, [hoveredSource, donutSegments]);

  // 2. Smooth Area Curve (Level Milestones vs User's Live XP)
  const curveW = 320;
  const curvePadX = 24;
  const curveTop = 18;
  const curveBaseY = 104;

  const milestoneNodes = useMemo(() => {
    const milestones = [
      ...CITIZEN_LEVEL_TIERS.map((t) => ({
        level: t.level,
        title: t.title.split(" (")[0],
        xp: t.minXp,
      })),
      { level: 6, title: "ผู้นำการเปลี่ยนแปลง", xp: 800 },
    ];
    const maxCurveXp = Math.max(800, stats.nextLevelXp, stats.currentXp);
    const usableW = curveW - curvePadX * 2;
    const usableH = curveBaseY - curveTop;

    return milestones.map((m, idx) => {
      const x = curvePadX + (idx / (milestones.length - 1)) * usableW;
      const y = curveBaseY - (m.xp / maxCurveXp) * usableH;
      return {
        ...m,
        x,
        y,
        reached: stats.currentXp >= m.xp,
      };
    });
  }, [stats.currentXp, stats.nextLevelXp]);

  const { linePath: levelLinePath, areaPath: levelAreaPath } = useMemo(
    () => buildSmoothAreaPaths(milestoneNodes, curveBaseY),
    [milestoneNodes]
  );

  // Interpolate user's live marker position along the milestone curve
  const userMarkerPoint = useMemo(
    () => computeUserMarkerPoint(milestoneNodes, stats.currentXp, curvePadX, curveBaseY),
    [milestoneNodes, stats.currentXp]
  );

  const activeMilestone =
    hoveredTierIdx !== null && milestoneNodes[hoveredTierIdx]
      ? milestoneNodes[hoveredTierIdx]
      : milestoneNodes.find((m) => m.level === stats.level) ?? milestoneNodes[0];

  // 3A. Category Participation Bars (User Activity vs Community Total)
  const categoryBars = useMemo(() => {
    const communityMap = new Map<string, number>();
    const userMap = new Map<string, number>();

    for (const c of complaints) {
      communityMap.set(c.categoryId, (communityMap.get(c.categoryId) ?? 0) + 1);
      if (myReportIds.has(c.id) || upvotedIds.has(c.id)) {
        userMap.set(c.categoryId, (userMap.get(c.categoryId) ?? 0) + 1);
      }
    }

    return COMPLAINT_CATEGORIES.map((cat) => ({
      id: cat.id,
      label: cat.label,
      color: cat.color,
      userCount: userMap.get(cat.id) ?? 0,
      communityCount: communityMap.get(cat.id) ?? 0,
    }))
      .sort((a, b) =>
        b.userCount !== a.userCount
          ? b.userCount - a.userCount
          : b.communityCount - a.communityCount
      )
      .slice(0, 5);
  }, [complaints, myReportIds, upvotedIds]);

  const maxCategoryBarCount = Math.max(
    1,
    ...categoryBars.map((c) => Math.max(c.communityCount, c.userCount))
  );

  // 3B. 5-Axis Citizen Radar Chart
  const radarAxes = useMemo(() => {
    const raw = [
      { label: "เช็กอิน", value: citizenXpExtras.dailyCheckInCount ?? 0, target: 5 },
      { label: "โหวตดัน", value: upvotedIds.size, target: 5 },
      { label: "แจ้งเรื่อง", value: myReportIds.size, target: 3 },
      { label: "ภาพหลักฐาน", value: citizenXpExtras.photoReportCount ?? 0, target: 3 },
      {
        label: "เม้นต์/โพล",
        value: (citizenXpExtras.commentCount ?? 0) + (citizenXpExtras.pollVoteCount ?? 0),
        target: 4,
      },
    ];

    const cx = 110;
    const cy = 78;
    const maxR = 52;
    const count = raw.length;

    return raw.map((axis, idx) => {
      const angle = -Math.PI / 2 + (idx * 2 * Math.PI) / count;
      const ratio = Math.min(1, Math.max(0.08, axis.value / axis.target));
      const r = axis.value === 0 ? maxR * 0.1 : maxR * ratio;
      return {
        ...axis,
        angle,
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        outerX: cx + Math.cos(angle) * maxR,
        outerY: cy + Math.sin(angle) * maxR,
        labelX: cx + Math.cos(angle) * (maxR + 17),
        labelY: cy + Math.sin(angle) * (maxR + 14),
        pct: Math.min(100, Math.round((axis.value / axis.target) * 100)),
      };
    });
  }, [citizenXpExtras, upvotedIds.size, myReportIds.size]);

  const radarPolygonPoints = useMemo(
    () => radarAxes.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" "),
    [radarAxes]
  );

  const activeRadarAxis =
    hoveredRadarIdx !== null && radarAxes[hoveredRadarIdx]
      ? radarAxes[hoveredRadarIdx]
      : null;

  return (
    <section
      aria-label="กราฟวิเคราะห์คะแนนและกิจกรรมพลเมือง"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5"
    >
      {/* CHART 1: Interactive XP Breakdown Donut */}
      <div className={`rounded-[28px] p-5 flex flex-col justify-between gap-4 ${iosCardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-orange-500/15 text-orange-500 flex items-center justify-center">
                <JKIcon name="chart-pie" className="text-xs" />
              </span>
              <span>สัดส่วนคะแนน XP</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              ชี้ที่กราฟเพื่อดูแหล่งที่มาของคะแนนจริง
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-orange-500/15 text-orange-700 dark:text-orange-300 text-[10px] font-black font-mono shrink-0">
            {totalXp} XP
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* SVG Donut Ring */}
          <div className="relative w-32 h-32 shrink-0 flex items-center justify-center">
            <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 overflow-visible">
              <circle
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                strokeWidth="12"
                strokeDasharray={totalXp === 0 ? "5 5" : undefined}
                className="stroke-slate-200/90 dark:stroke-white/[0.08]"
              />
              {donutSegments.map((seg) => {
                const isEmphasized = hoveredSource === seg.key;
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
                    onMouseEnter={() => setHoveredSource(seg.key)}
                    onMouseLeave={() => setHoveredSource(null)}
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              {activeDonutItem ? (
                <>
                  <span className="text-lg font-black font-mono leading-none text-slate-900 dark:text-white">
                    +{activeDonutItem.xp}
                  </span>
                  <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-1 truncate max-w-[78px]">
                    {activeDonutItem.label} ({activeDonutItem.pct}%)
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl font-black font-mono leading-none text-slate-900 dark:text-white">
                    {totalXp}
                  </span>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1">
                    XP สะสมรวม
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Interactive Legend */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {xpSources.slice(0, 5).map((item) => {
              const pct = totalXp > 0 ? Math.round((item.xp / totalXp) * 100) : 0;
              const isHighlighted = hoveredSource === item.key;
              return (
                <div
                  key={item.key}
                  onMouseEnter={() => item.xp > 0 && setHoveredSource(item.key)}
                  onMouseLeave={() => setHoveredSource(null)}
                  className={`flex items-center justify-between gap-2 px-2.5 py-1 rounded-xl text-[11px] transition ${
                    isHighlighted
                      ? "bg-orange-500/15 dark:bg-orange-500/20"
                      : item.xp > 0
                      ? "hover:bg-slate-900/[0.04] dark:hover:bg-white/[0.06] cursor-pointer"
                      : "opacity-55"
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${item.dotClass}`} />
                    <span className="font-bold text-slate-700 dark:text-slate-200 truncate">
                      {item.label}
                    </span>
                  </div>
                  <span className="font-mono font-black text-slate-900 dark:text-white shrink-0">
                    {item.xp} <span className="text-[9px] text-slate-500">({pct}%)</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CHART 2: Smooth Area Level Trajectory Curve */}
      <div className={`rounded-[28px] p-5 flex flex-col justify-between gap-3 ${iosCardClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center">
                <JKIcon name="chart-line" className="text-xs" />
              </span>
              <span>เส้นโค้งการเลื่อนเลเวล</span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              {activeMilestone
                ? `Lv.${activeMilestone.level} ${activeMilestone.title} (${activeMilestone.xp} XP)`
                : "ตำแหน่งของคุณบนเส้นทางพลเมือง"}
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 text-[10px] font-black shrink-0">
            Lv.{stats.level}
          </span>
        </div>

        <div className={`rounded-2xl p-2.5 ${iosInnerTileClass}`}>
          <svg viewBox="0 0 320 124" className="w-full h-32 overflow-visible">
            <defs>
              <linearGradient id="xpCurveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#f97316" stopOpacity="0.02" />
              </linearGradient>
              <linearGradient id="xpCurveLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="55%" stopColor="#f97316" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>

            {/* Horizontal dashed reference guides */}
            {[24, 52, 80, curveBaseY].map((y) => (
              <line
                key={y}
                x1={curvePadX}
                y1={y}
                x2={curveW - curvePadX}
                y2={y}
                strokeDasharray="3 4"
                className="stroke-slate-300/80 dark:stroke-white/10"
                strokeWidth="1"
              />
            ))}

            {/* Smooth Gradient Area & Line */}
            {levelAreaPath && <path d={levelAreaPath} fill="url(#xpCurveAreaGrad)" />}
            {levelLinePath && (
              <path
                d={levelLinePath}
                fill="none"
                stroke="url(#xpCurveLineGrad)"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}

            {/* Milestone Nodes */}
            {milestoneNodes.map((node, idx) => {
              const isHovered = hoveredTierIdx === idx;
              return (
                <g
                  key={node.level}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredTierIdx(idx)}
                  onMouseLeave={() => setHoveredTierIdx(null)}
                >
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={isHovered ? 6 : 4}
                    className={
                      node.reached
                        ? "fill-amber-500 stroke-white dark:stroke-slate-900"
                        : "fill-white dark:fill-slate-800 stroke-slate-400 dark:stroke-slate-500"
                    }
                    strokeWidth="2"
                  />
                  <text
                    x={node.x}
                    y={119}
                    textAnchor="middle"
                    className={`text-[9px] font-bold ${
                      node.reached
                        ? "fill-amber-700 dark:fill-amber-300"
                        : "fill-slate-400 dark:fill-slate-500"
                    }`}
                  >
                    Lv.{node.level}
                  </text>
                </g>
              );
            })}

            {/* Current User Live XP Position */}
            <g className="pointer-events-none">
              <circle
                cx={userMarkerPoint.x}
                cy={userMarkerPoint.y}
                r="9"
                className="fill-rose-500/25 animate-pulse"
              />
              <circle
                cx={userMarkerPoint.x}
                cy={userMarkerPoint.y}
                r="5"
                className="fill-rose-500 stroke-white dark:stroke-slate-950"
                strokeWidth="2"
              />
              <rect
                x={Math.min(Math.max(userMarkerPoint.x - 24, 6), curveW - 54)}
                y={Math.max(userMarkerPoint.y - 24, 2)}
                width="48"
                height="16"
                rx="8"
                className="fill-slate-900 dark:fill-white"
              />
              <text
                x={Math.min(Math.max(userMarkerPoint.x, 30), curveW - 30)}
                y={Math.max(userMarkerPoint.y - 13, 13)}
                textAnchor="middle"
                className="text-[9px] font-black font-mono fill-white dark:fill-slate-950"
              >
                {stats.currentXp} XP
              </text>
            </g>
          </svg>
        </div>
      </div>

      {/* CHART 3: Category Participation Bars <-> 5-Axis Citizen Radar */}
      <div
        className={`rounded-[28px] p-5 flex flex-col justify-between gap-3 md:col-span-2 lg:col-span-1 ${iosCardClass}`}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
              <span className="w-7 h-7 rounded-xl bg-teal-500/15 text-teal-600 dark:text-cyan-300 flex items-center justify-center shrink-0">
                <JKIcon
                  name={rightMode === "category" ? "chart-bar" : "radar"}
                  className="text-xs"
                />
              </span>
              <span className="truncate">
                {rightMode === "category" ? "การมีส่วนร่วมตามหมวด" : "เรดาร์พลังพลเมือง"}
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 truncate">
              {rightMode === "category"
                ? "เรื่องที่คุณร่วมโหวต/แจ้ง เทียบกับทั้งชุมชน"
                : activeRadarAxis
                ? `${activeRadarAxis.label}: ${activeRadarAxis.value}/${activeRadarAxis.target} (${activeRadarAxis.pct}%)`
                : "ความสมดุลภารกิจพลเมือง 5 มิติ"}
            </p>
          </div>

          <div className="inline-flex p-1 rounded-xl bg-slate-200/75 dark:bg-white/[0.08] shrink-0">
            <button
              type="button"
              onClick={() => setRightMode("category")}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                rightMode === "category"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              หมวดหมู่
            </button>
            <button
              type="button"
              onClick={() => setRightMode("radar")}
              className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                rightMode === "radar"
                  ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-300"
              }`}
            >
              เรดาร์
            </button>
          </div>
        </div>

        {rightMode === "category" ? (
          <div className="space-y-2.5">
            {categoryBars.map((bar) => {
              const communityPct = Math.round((bar.communityCount / maxCategoryBarCount) * 100);
              const userPct = Math.round((bar.userCount / maxCategoryBarCount) * 100);
              return (
                <div key={bar.id} className="space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-bold text-slate-800 dark:text-slate-200 truncate flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: bar.color }}
                      />
                      <span className="truncate">{bar.label}</span>
                    </span>
                    <span className="font-mono text-[10px] font-black text-slate-600 dark:text-slate-300 shrink-0">
                      คุณ {bar.userCount} / รวม {bar.communityCount}
                    </span>
                  </div>
                  <div className="relative h-2.5 rounded-full bg-slate-200/80 dark:bg-white/[0.08] overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full opacity-25 transition-all duration-500"
                      style={{
                        width: `${communityPct}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                    <div
                      className="relative h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${userPct}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={`rounded-2xl p-2 flex items-center justify-center ${iosInnerTileClass}`}>
            <svg viewBox="0 0 220 156" className="w-full max-w-[240px] h-[142px] overflow-visible">
              <defs>
                <linearGradient id="civicRadarGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#f97316" stopOpacity="0.45" />
                </linearGradient>
              </defs>

              {/* Concentric Web Rings */}
              {[0.33, 0.66, 1].map((scale) => {
                const ringPts = radarAxes
                  .map((a) => {
                    const rx = 110 + (a.outerX - 110) * scale;
                    const ry = 78 + (a.outerY - 78) * scale;
                    return `${rx.toFixed(1)},${ry.toFixed(1)}`;
                  })
                  .join(" ");
                return (
                  <polygon
                    key={scale}
                    points={ringPts}
                    fill="none"
                    className="stroke-slate-300/80 dark:stroke-white/15"
                    strokeWidth="1"
                  />
                );
              })}

              {/* Axis Spokes */}
              {radarAxes.map((axis) => (
                <line
                  key={axis.label}
                  x1="110"
                  y1="78"
                  x2={axis.outerX}
                  y2={axis.outerY}
                  className="stroke-slate-300/70 dark:stroke-white/10"
                  strokeWidth="1"
                />
              ))}

              {/* Active Radar Area */}
              <polygon
                points={radarPolygonPoints}
                fill="url(#civicRadarGrad)"
                stroke="#14b8a6"
                strokeWidth="2"
                strokeLinejoin="round"
              />

              {/* Interactive Vertices & Labels */}
              {radarAxes.map((axis, idx) => {
                const isHovered = hoveredRadarIdx === idx;
                return (
                  <g
                    key={axis.label}
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredRadarIdx(idx)}
                    onMouseLeave={() => setHoveredRadarIdx(null)}
                  >
                    <circle
                      cx={axis.x}
                      cy={axis.y}
                      r={isHovered ? 5 : 3.5}
                      className="fill-teal-500 stroke-white dark:stroke-slate-900"
                      strokeWidth="1.5"
                    />
                    <text
                      x={axis.labelX}
                      y={axis.labelY}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      className={`text-[9px] font-bold ${
                        isHovered
                          ? "fill-teal-600 dark:fill-cyan-300"
                          : "fill-slate-600 dark:fill-slate-300"
                      }`}
                    >
                      {axis.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </section>
  );
}
