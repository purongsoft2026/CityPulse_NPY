"use client";

import React, { useEffect } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  CITIZEN_LEVEL_TIERS,
  CITIZEN_XP_REWARDS,
  calculateCitizenStats,
  type CitizenXpExtras,
} from "@/data/map-data";
import { type CitizenMember } from "@/lib/citizen-auth";

interface CitizenHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  userUpvoteCount: number;
  userReportCount: number;
  resolvedCount?: number;
  citizenXpExtras?: CitizenXpExtras;
  hasCheckedInToday?: boolean;
  onDailyCheckIn?: () => void;
  onOpenReportForm: () => void;
  citizenMember?: CitizenMember | null;
  onOpenCitizenAuth?: (tab?: "login" | "register") => void;
  onLogoutCitizen?: () => void;
}

const COMMUNITY_LEADERBOARD_PEERS = [
  { id: "peer-1", name: "คุณวิทยา พ. (เขตปทุมวัน)", xp: 340 },
  { id: "peer-2", name: "คุณกนกวรรณ (เขตจตุจักร)", xp: 290 },
  { id: "peer-3", name: "คุณธนพล ม. (เชียงใหม่)", xp: 95 },
];

export function CitizenHubModal({
  isOpen,
  onClose,
  userUpvoteCount,
  userReportCount,
  resolvedCount,
  citizenXpExtras,
  hasCheckedInToday = false,
  onDailyCheckIn,
  onOpenReportForm,
  citizenMember,
  onOpenCitizenAuth,
  onLogoutCitizen,
}: CitizenHubModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const {
    currentXp,
    level,
    nextLevelXp,
    xpToNextLevel,
    levelProgress,
    title,
    breakdown,
  } = calculateCitizenStats(userUpvoteCount, userReportCount, citizenXpExtras);

  const pollVoteCount = citizenXpExtras?.pollVoteCount ?? 0;
  const commentCount = citizenXpExtras?.commentCount ?? 0;
  const photoReportCount = citizenXpExtras?.photoReportCount ?? 0;
  const resolvedImpactCount =
    typeof resolvedCount === "number"
      ? resolvedCount
      : citizenXpExtras?.resolvedImpactCount ?? 0;

  const hasStarterBadge = currentXp > 0;
  const hasUpvoteBadge = userUpvoteCount > 0;
  const hasPhotoBadge = photoReportCount > 0;
  const hasGuardianBadge = commentCount > 0 || pollVoteCount > 0 || resolvedImpactCount > 0;

  const youLabel = citizenMember
    ? `${citizenMember.displayName} (จ.${citizenMember.homeProvince})`
    : "คุณ (ผู้ใช้งานปัจจุบัน)";

  const leaderboardEntries = [
    ...COMMUNITY_LEADERBOARD_PEERS.map((p) => ({ ...p, isSelf: false })),
    { id: "self", name: youLabel, xp: currentXp, isSelf: true },
  ].sort((a, b) => (b.xp !== a.xp ? b.xp - a.xp : a.isSelf ? -1 : 1));

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg ios-glass-sheet rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative flex-shrink-0 overflow-hidden bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-6 pt-7 pb-6 text-white">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/40 flex items-center justify-center text-white transition cursor-pointer z-20"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            {/* Mascot in celebratory pose */}
            <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex-shrink-0 drop-shadow-[0_8px_16px_rgba(0,0,0,0.3)]">
              <img
                src={citizenMember?.avatarPose || "/images/mascot_success.png"}
                alt="Citizen Hero Mascot"
                className="w-full h-full object-contain animate-bounce"
                style={{ animationDuration: "2.5s" }}
              />
            </div>

            <div className="flex-1 pr-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[11px] font-black tracking-wide uppercase border border-white/30 mb-1">
                <JKIcon name="award" className="text-yellow-200" />
                {citizenMember ? "Verified Citizen Member" : "Citizen Gamification"}
              </div>
              <h2 className="text-xl sm:text-2xl font-black text-white drop-shadow-sm leading-tight">
                {citizenMember ? citizenMember.displayName : "ศูนย์พลเมืองตื่นรู้"}
              </h2>
              <p className="text-xs text-white/90 font-medium">
                {citizenMember
                  ? `สมาชิก จ.${citizenMember.homeProvince} · ${citizenMember.email}`
                  : "สะสม XP จากการใช้งานจริง เพื่อเลื่อนระดับ & ปลดล็อกเหรียญรางวัล"}
              </p>
            </div>
          </div>

          {/* User Level Card */}
          <div className="mt-4 p-3.5 rounded-2xl bg-black/25 backdrop-blur-md border border-white/20">
            <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-lg bg-yellow-400 text-slate-950 font-black text-[10px]">
                  Lv. {level}
                </span>
                <span className="font-extrabold text-white">
                  {title}
                </span>
              </div>
              <span className="text-yellow-200 font-mono text-[11px]">
                {currentXp} / {nextLevelXp} XP
              </span>
            </div>
            {/* Progress bar */}
            <div className="w-full h-2.5 rounded-full bg-white/20 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-yellow-300 to-amber-300 rounded-full transition-all duration-500 shadow-sm"
                style={{ width: `${levelProgress}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-white/85 font-semibold mt-1.5">
              <span>ความคืบหน้าระดับปัจจุบัน {levelProgress}%</span>
              <span>อีก {xpToNextLevel} XP เพื่อเลื่อนเป็น Lv. {level + 1}</span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-5 custom-scrollbar">
          {/* Level Roadmap */}
          <div className="grid grid-cols-5 gap-1.5">
            {CITIZEN_LEVEL_TIERS.map((tier) => {
              const unlocked = level >= tier.level;
              const isCurrent = level === tier.level;
              return (
                <div
                  key={tier.level}
                  className={`flex flex-col items-center p-2 rounded-2xl border text-center transition ${
                    isCurrent
                      ? "bg-amber-50/95 dark:bg-amber-500/20 border-amber-400 shadow-xs"
                      : unlocked
                      ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-400/50"
                      : "bg-white/75 dark:bg-slate-900/50 border-white/85 dark:border-white/10 opacity-75"
                  }`}
                >
                  <span
                    className={`text-[10px] font-black ${
                      isCurrent
                        ? "text-amber-700 dark:text-amber-300"
                        : unlocked
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    Lv.{tier.level}
                  </span>
                  <span className="text-[9px] font-mono font-bold text-slate-500 dark:text-slate-400 mt-0.5">
                    {tier.minXp} XP
                  </span>
                </div>
              );
            })}
          </div>

          {/* Citizen Member Status / Login-Register Card */}
          {onOpenCitizenAuth && (
            citizenMember ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50/90 dark:bg-emerald-950/35 border border-emerald-200/90 dark:border-emerald-700/40 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center flex-shrink-0">
                    <JKIcon name="user-check" className="text-sm" />
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-emerald-900 dark:text-emerald-200 truncate">
                        เข้าสู่ระบบสมาชิกแล้ว
                      </span>
                      <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[9px] font-black">
                        Member
                      </span>
                    </div>
                    <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80 truncate">
                      กรอกชื่อผู้แจ้งอัตโนมัติ หรือเลือกแจ้งแบบไม่ระบุตัวตนได้ตลอดเวลา
                    </p>
                  </div>
                </div>
                {onLogoutCitizen && (
                  <button
                    type="button"
                    onClick={onLogoutCitizen}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-500/25 text-[11px] font-black transition cursor-pointer flex items-center gap-1.5"
                  >
                    <JKIcon name="power-off" className="text-[10px]" />
                    <span>ออกจากระบบ</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-teal-400/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)]">
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center flex-shrink-0">
                    <JKIcon name="id-card" className="text-sm" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-black text-slate-900 dark:text-white">
                      บัญชีสมาชิกพลเมือง (ใช้งานฟรี)
                    </p>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300">
                      สมัครเพื่อกรอกข้อมูลแจ้งเรื่องอัตโนมัติ หรือแจ้งแบบไม่ระบุตัวตนได้ทุกเมื่อ
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCitizenAuth("login");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/15 hover:border-teal-400 text-slate-800 dark:text-slate-200 text-[11px] font-black transition cursor-pointer"
                  >
                    เข้าสู่ระบบ
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenCitizenAuth("register");
                    }}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-black shadow-sm transition cursor-pointer flex items-center gap-1"
                  >
                    <JKIcon name="user-plus" className="text-[10px]" />
                    <span>สมัครสมาชิก</span>
                  </button>
                </div>
              </div>
            )
          )}

          {/* Quick Impact Numbers + Real XP Breakdown */}
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <JKIcon name="chart-pie" className="text-orange-500" />
              ผลกระทบที่คุณช่วยสร้าง (My Impact)
            </h4>
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-3 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] text-center shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)]">
                <span className="text-xl font-black text-orange-500">{userUpvoteCount}</span>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">ร่วมโหวตปัญหา</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] text-center shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)]">
                <span className="text-xl font-black text-blue-500">{userReportCount}</span>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">เรื่องที่แจ้งใหม่</p>
              </div>
              <div className="p-3 rounded-2xl bg-white/85 dark:bg-slate-900/60 border border-white/90 dark:border-white/[0.14] text-center shadow-[0_2px_8px_-3px_rgba(15,23,42,0.05)]">
                <span className="text-xl font-black text-emerald-500">{resolvedImpactCount}</span>
                <p className="text-[10px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">ดันจนสำเร็จ</p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10">เช็กอิน +{breakdown.checkIns}</span>
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10">โหวต +{breakdown.upvotes}</span>
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10">แจ้งเรื่อง +{breakdown.reports + breakdown.photos}</span>
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10">ความเห็น +{breakdown.comments}</span>
              <span className="px-2 py-0.5 rounded-lg bg-white/80 dark:bg-white/10">โพล +{breakdown.polls}</span>
              {breakdown.resolved > 0 && (
                <span className="px-2 py-0.5 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">
                  สำเร็จ +{breakdown.resolved}
                </span>
              )}
            </div>
          </div>

          {/* Badges Collection */}
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <JKIcon name="medal" className="text-amber-500" />
              เหรียญเกียรติยศพลเมือง (Badges)
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition ${
                hasStarterBadge
                  ? "bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/50"
                  : "bg-white/65 dark:bg-slate-900/45 border-white/80 dark:border-white/10 opacity-60"
              }`}>
                <span className="w-8 h-8 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 mb-1 text-base">
                  <JKIcon name="star" />
                </span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">ผู้บุกเบิก</span>
                <span className="text-[9px] text-amber-700 dark:text-amber-400 font-semibold">
                  {hasStarterBadge ? "ปลดล็อกแล้ว ✓" : "สะสม XP แรก"}
                </span>
              </div>
              <div className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition ${
                hasUpvoteBadge
                  ? "bg-orange-50/90 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700/50"
                  : "bg-white/65 dark:bg-slate-900/45 border-white/80 dark:border-white/10 opacity-60"
              }`}>
                <span className="w-8 h-8 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 mb-1 text-base">
                  <JKIcon name="fire" />
                </span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">พลังมวลชน</span>
                <span className="text-[9px] text-slate-600 dark:text-slate-300 font-semibold">
                  {hasUpvoteBadge ? "ปลดล็อกแล้ว ✓" : "โหวตดัน 1 เรื่อง"}
                </span>
              </div>
              <div className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition ${
                hasPhotoBadge
                  ? "bg-blue-50/90 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/50"
                  : "bg-white/65 dark:bg-slate-900/45 border-white/80 dark:border-white/10 opacity-60"
              }`}>
                <span className="w-8 h-8 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500 mb-1 text-base">
                  <JKIcon name="camera" />
                </span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">ตาเหยี่ยว</span>
                <span className="text-[9px] text-slate-600 dark:text-slate-300 font-semibold">
                  {hasPhotoBadge ? "ปลดล็อกแล้ว ✓" : "แนบภาพหลักฐาน"}
                </span>
              </div>
              <div className={`flex flex-col items-center p-2.5 rounded-2xl border text-center transition ${
                hasGuardianBadge
                  ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50"
                  : "bg-white/65 dark:bg-slate-900/45 border-white/80 dark:border-white/10 opacity-60"
              }`}>
                <span className="w-8 h-8 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500 mb-1 text-base">
                  <JKIcon name="shield-halved" />
                </span>
                <span className="text-[11px] font-black text-slate-900 dark:text-white">พิทักษ์เมือง</span>
                <span className="text-[9px] text-emerald-700 dark:text-emerald-400 font-semibold">
                  {hasGuardianBadge ? "ปลดล็อกแล้ว ✓" : "เม้นต์/โพล/สำเร็จ"}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Quests */}
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <JKIcon name="sparkles" className="text-yellow-500" />
              ภารกิจพลเมืองวันนี้ (Daily Quests)
            </h4>
            <div className="space-y-2">
              <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition ${
                hasCheckedInToday
                  ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                  : "bg-white/85 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14]"
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    hasCheckedInToday ? "bg-emerald-500 text-white" : "bg-teal-500/15 text-teal-600 dark:text-teal-300"
                  }`}>
                    <JKIcon name={hasCheckedInToday ? "check" : "calendar-check"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">เข้าตรวจตราแผนที่เมือง</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">เช็กอินประจำวันเพื่อสะสม XP ต่อเนื่อง</p>
                  </div>
                </div>
                {hasCheckedInToday ? (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 font-mono shrink-0">
                    รับแล้ว +{CITIZEN_XP_REWARDS.DAILY_CHECKIN} XP ✓
                  </span>
                ) : onDailyCheckIn ? (
                  <button
                    type="button"
                    onClick={onDailyCheckIn}
                    className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-black transition cursor-pointer shrink-0 shadow-xs active:scale-95"
                  >
                    เช็กอิน +{CITIZEN_XP_REWARDS.DAILY_CHECKIN} XP
                  </button>
                ) : (
                  <span className="text-[10px] font-black text-teal-600 dark:text-teal-400 font-mono shrink-0">
                    +{CITIZEN_XP_REWARDS.DAILY_CHECKIN} XP
                  </span>
                )}
              </div>

              <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition ${
                userUpvoteCount > 0
                  ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                  : "bg-white/85 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14]"
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    userUpvoteCount > 0 ? "bg-emerald-500 text-white" : "bg-orange-500/20 text-orange-500"
                  }`}>
                    <JKIcon name={userUpvoteCount > 0 ? "check" : "thumbs-up"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">กด +1 โหวตเรื่องด่วน 1 เรื่อง</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">ช่วยดึงความสำคัญให้หน่วยงานเห็น</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black font-mono shrink-0 ${
                  userUpvoteCount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-orange-500"
                }`}>
                  {userUpvoteCount > 0
                    ? `สำเร็จ (${userUpvoteCount}) ✓`
                    : `+${CITIZEN_XP_REWARDS.UPVOTE} XP`}
                </span>
              </div>

              <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition ${
                commentCount > 0 || pollVoteCount > 0
                  ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                  : "bg-white/85 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14]"
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    commentCount > 0 || pollVoteCount > 0 ? "bg-emerald-500 text-white" : "bg-indigo-500/20 text-indigo-500"
                  }`}>
                    <JKIcon name={commentCount > 0 || pollVoteCount > 0 ? "check" : "comments"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">แสดงความเห็น หรือโหวตโพล</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">อัปเดตสถานการณ์หน้างานในเคสหรือโพลชุมชน</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black font-mono shrink-0 ${
                  commentCount > 0 || pollVoteCount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-indigo-500"
                }`}>
                  {commentCount > 0 || pollVoteCount > 0
                    ? `สำเร็จ (${commentCount + pollVoteCount}) ✓`
                    : `+${CITIZEN_XP_REWARDS.COMMENT}~${CITIZEN_XP_REWARDS.POLL_VOTE} XP`}
                </span>
              </div>

              <div className={`flex items-center justify-between gap-2 p-3 rounded-2xl border transition ${
                userReportCount > 0
                  ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                  : "bg-white/85 dark:bg-slate-900/60 border-white/90 dark:border-white/[0.14]"
              }`}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${
                    userReportCount > 0 ? "bg-emerald-500 text-white" : "bg-blue-500/20 text-blue-500"
                  }`}>
                    <JKIcon name={userReportCount > 0 ? "check" : "camera"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">แจ้งปัญหาใหม่ (แนบรูป +{CITIZEN_XP_REWARDS.PHOTO_BONUS})</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">ปักหมุดแจ้งปัญหาเมืองให้ทีมช่างลงพื้นที่</p>
                  </div>
                </div>
                <span className={`text-[10px] font-black font-mono shrink-0 ${
                  userReportCount > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-blue-500"
                }`}>
                  {userReportCount > 0
                    ? `สำเร็จ (${userReportCount}) ✓`
                    : `+${CITIZEN_XP_REWARDS.REPORT} XP`}
                </span>
              </div>
            </div>
          </div>

          {/* Community Top Contributors (Dynamic Live Ranking) */}
          <div>
            <h4 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
              <JKIcon name="trophy" className="text-yellow-500" />
              ทำเนียบพลเมืองยอดเยี่ยมสัปดาห์นี้
            </h4>
            <div className="divide-y divide-slate-200/70 dark:divide-white/10 border border-white/90 dark:border-white/[0.14] bg-white/80 dark:bg-slate-900/55 rounded-2xl overflow-hidden">
              {leaderboardEntries.map((entry, idx) => {
                const rank = idx + 1;
                const badgeBg =
                  rank === 1
                    ? "bg-yellow-400 text-slate-950"
                    : rank === 2
                    ? "bg-slate-300 dark:bg-slate-700 text-slate-900 dark:text-white"
                    : rank === 3
                    ? "bg-amber-600 text-white"
                    : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300";

                return (
                  <div
                    key={entry.id}
                    className={`flex items-center justify-between p-2.5 text-xs ${
                      entry.isSelf ? "bg-amber-500/15 dark:bg-amber-500/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`w-5 h-5 rounded-full font-black text-[10px] flex items-center justify-center shrink-0 ${badgeBg}`}>
                        {rank}
                      </span>
                      <span
                        className={`truncate ${
                          entry.isSelf
                            ? "font-black text-amber-700 dark:text-amber-300"
                            : "font-bold text-slate-800 dark:text-white"
                        }`}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-[11px] shrink-0">
                      {entry.xp} XP
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-4 flex-shrink-0 border-t border-slate-900/[0.06] dark:border-white/[0.08] bg-white/55 dark:bg-slate-950/35 flex items-center gap-2">
          <button
            onClick={() => {
              onClose();
              onOpenReportForm();
            }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-black text-xs shadow-lg shadow-orange-500/25 active:scale-[0.98] transition cursor-pointer"
          >
            <JKIcon name="plus" />
            แจ้งเรื่องร้องเรียนใหม่ (+{CITIZEN_XP_REWARDS.REPORT} XP)
          </button>
        </div>
      </div>
    </div>
  );
}
