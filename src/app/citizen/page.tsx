"use client";

import React, { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { JKIcon } from "@/components/ui/jk-icon";
import { CitizenAuthModal, type CitizenAuthTab } from "@/components/auth/CitizenAuthModal";
import { CitizenAnalyticsCharts } from "@/components/citizen/CitizenAnalyticsCharts";
import { PwaInstallButton } from "@/components/pwa/PwaInstallProvider";
import { type MapStyleKey } from "@/components/map/MapHeader";
import {
  CITIZEN_LEVEL_TIERS,
  CITIZEN_XP_REWARDS,
  COMPLAINT_CATEGORIES,
  INITIAL_COMPLAINTS,
  calculateCitizenStats,
  deriveComplaintXpMetrics,
  inferDistrictFromCoord,
  inferProvinceFromCoord,
  type CitizenXpExtras,
  type ComplaintReport,
} from "@/data/map-data";
import {
  EMPTY_POLL_VOTES,
  EMPTY_STRING_ARRAY,
  getCheckInsSnapshot,
  getComplaintsSnapshot,
  getIsDarkSnapshot,
  getMapStyleSnapshot,
  getMyCommentsSnapshot,
  getMyReportsSnapshot,
  getPollVotesSnapshot,
  getTodayCheckInKey,
  getUpvotesSnapshot,
  subscribeStorageSync,
  subscribeThemeSync,
  toggleThemeStore,
  writeCheckInsStore,
} from "@/lib/civic-store";
import {
  clearCitizenSession,
  getCitizenSessionSnapshot,
  subscribeCitizenSession,
} from "@/lib/citizen-auth";
import { getMapsAuth } from "@/lib/maps-auth-client";

type HistoryTabKey = "reports" | "upvotes" | "resolved";

const STATUS_BADGES: Record<
  ComplaintReport["status"],
  { label: string; pill: string }
> = {
  pending: {
    label: "รอดำเนินการ",
    pill: "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300",
  },
  inprogress: {
    label: "กำลังดำเนินการ",
    pill: "bg-sky-100 text-sky-800 dark:bg-sky-500/20 dark:text-sky-300",
  },
  resolved: {
    label: "แก้ไขแล้ว",
    pill: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300",
  },
};

const COMMUNITY_LEADERBOARD_PEERS = [
  { id: "peer-1", name: "คุณวิทยา พ. (เขตปทุมวัน)", xp: 340 },
  { id: "peer-2", name: "คุณกนกวรรณ (เขตจตุจักร)", xp: 290 },
  { id: "peer-3", name: "คุณธนพล ม. (เชียงใหม่)", xp: 95 },
];

const emptySubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;
const serverNull = () => null;
const serverVoyager = (): MapStyleKey => "voyager";
const serverComplaints = () => INITIAL_COMPLAINTS;
const serverEmptyStrings = () => EMPTY_STRING_ARRAY;
const serverPollVotes = () => EMPTY_POLL_VOTES;

export default function CitizenHubPage() {
  const isHydrated = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);
  const isDark = useSyncExternalStore(subscribeThemeSync, getIsDarkSnapshot, serverFalse);
  const currentStyle = useSyncExternalStore(
    subscribeThemeSync,
    getMapStyleSnapshot,
    serverVoyager
  );

  const localComplaints = useSyncExternalStore(
    subscribeStorageSync,
    getComplaintsSnapshot,
    serverComplaints
  );
  const upvotedArray = useSyncExternalStore(
    subscribeStorageSync,
    getUpvotesSnapshot,
    serverEmptyStrings
  );
  const myReportsArray = useSyncExternalStore(
    subscribeStorageSync,
    getMyReportsSnapshot,
    serverEmptyStrings
  );
  const [centralStatuses, setCentralStatuses] = useState<Record<string, ComplaintReport["status"]>>({});
  useEffect(() => {
    const ids = [...new Set(myReportsArray)].filter((id) =>
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id),
    );
    if (!ids.length) return;
    const controller = new AbortController();
    let refreshing = false;
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const rows: Pick<ComplaintReport, "id" | "status">[] = [];
        for (let offset = 0; offset < ids.length; offset += 50) {
          const params = new URLSearchParams();
          ids.slice(offset, offset + 50).forEach((id) => params.append("id", id));
          const response = await fetch(`/api/reports?${params}`, { signal: controller.signal });
          if (!response.ok) return;
          rows.push(...await response.json());
        }
        if (!controller.signal.aborted) {
          setCentralStatuses(Object.fromEntries(rows.map(({ id, status }) => [id, status])));
        }
      } catch {
        // Keep the last available status on a transient connection failure.
      } finally {
        refreshing = false;
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [myReportsArray]);
  const complaints = useMemo(() => localComplaints.map((report) => {
    const status = centralStatuses[report.id];
    return status ? { ...report, status } : report;
  }), [localComplaints, centralStatuses]);
  const checkInsArray = useSyncExternalStore(
    subscribeStorageSync,
    getCheckInsSnapshot,
    serverEmptyStrings
  );
  const myCommentsArray = useSyncExternalStore(
    subscribeStorageSync,
    getMyCommentsSnapshot,
    serverEmptyStrings
  );
  const userPollVotes = useSyncExternalStore(
    subscribeStorageSync,
    getPollVotesSnapshot,
    serverPollVotes
  );
  const citizenSession = useSyncExternalStore(
    subscribeCitizenSession,
    getCitizenSessionSnapshot,
    serverNull
  );
  const citizenMember = citizenSession?.member ?? null;
  const citizenId = citizenMember?.id;
  const [cloudHistory, setCloudHistory] = useState<{ owner: string; reports: ComplaintReport[] }>();
  const [historyError, setHistoryError] = useState<string>();
  useEffect(() => {
    if (!citizenId) return;
    const owner = citizenId;
    const controller = new AbortController();
    let refreshing = false;
    async function loadHistory() {
      if (refreshing) return;
      refreshing = true;
      try {
        const { data } = await getMapsAuth().getSession();
        if (!data.session || data.session.user.id !== owner) return;
        const headers = { Authorization: `Bearer ${data.session.access_token}` };
        const reports: ComplaintReport[] = [];
        for (let offset = 0; ; offset += 50) {
          const response = await fetch(`/api/reports?mine&offset=${offset}`, {
            headers, signal: controller.signal,
          });
          if (!response.ok) throw new Error("History unavailable");
          const page: ComplaintReport[] = await response.json();
          reports.push(...page);
          if (page.length < 50) break;
        }
        if (!controller.signal.aborted) {
          setCloudHistory({ owner, reports });
          setHistoryError(undefined);
        }
      } catch {
        if (!controller.signal.aborted) setHistoryError(owner);
      } finally {
        refreshing = false;
      }
    }
    void loadHistory();
    const timer = window.setInterval(loadHistory, 30000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [citizenId]);


  const [historyTab, setHistoryTab] = useState<HistoryTabKey>("reports");
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<CitizenAuthTab>("login");
  const [bannerToast, setBannerToast] = useState<{
    title: string;
    message: string;
    isLevelUp?: boolean;
  } | null>(null);

  const upvotedIds = useMemo(() => new Set(upvotedArray), [upvotedArray]);
  const myReportIds = useMemo(() => new Set(myReportsArray), [myReportsArray]);
  const todayCheckInKey = getTodayCheckInKey();
  const hasCheckedInToday = isHydrated && checkInsArray.includes(todayCheckInKey);

  const { photoReportCount, resolvedImpactCount } = useMemo(
    () => deriveComplaintXpMetrics(complaints, myReportIds, upvotedIds),
    [complaints, myReportIds, upvotedIds]
  );

  const pollVoteCount = Object.keys(userPollVotes).length;
  const commentCount = myCommentsArray.length;

  const citizenXpExtras: CitizenXpExtras = useMemo(
    () => ({
      dailyCheckInCount: checkInsArray.length,
      pollVoteCount,
      commentCount,
      photoReportCount,
      resolvedImpactCount,
    }),
    [checkInsArray.length, pollVoteCount, commentCount, photoReportCount, resolvedImpactCount]
  );

  const stats = useMemo(
    () => calculateCitizenStats(upvotedIds.size, myReportIds.size, citizenXpExtras),
    [upvotedIds.size, myReportIds.size, citizenXpExtras]
  );

  const myReportsList = useMemo(
    () => citizenId
      ? (cloudHistory?.owner === citizenId ? cloudHistory.reports : [])
      : complaints.filter((c) => myReportIds.has(c.id)),
    [citizenId, cloudHistory, complaints, myReportIds]
  );
  const myUpvotedList = useMemo(
    () => complaints.filter((c) => upvotedIds.has(c.id)),
    [complaints, upvotedIds]
  );
  const myResolvedList = useMemo(
    () =>
      complaints.filter(
        (c) => c.status === "resolved" && (myReportIds.has(c.id) || upvotedIds.has(c.id))
      ),
    [complaints, myReportIds, upvotedIds]
  );

  const activeHistoryList =
    historyTab === "reports"
      ? myReportsList
      : historyTab === "upvotes"
      ? myUpvotedList
      : myResolvedList;

  const hasStarterBadge = stats.currentXp > 0;
  const hasUpvoteBadge = upvotedIds.size > 0;
  const hasPhotoBadge = photoReportCount > 0;
  const hasGuardianBadge = commentCount > 0 || pollVoteCount > 0 || resolvedImpactCount > 0;

  const youLabel = citizenMember
    ? `${citizenMember.displayName} (จ.${citizenMember.homeProvince})`
    : "คุณ (ผู้ใช้งานปัจจุบัน)";

  const leaderboardEntries = useMemo(
    () =>
      [
        ...COMMUNITY_LEADERBOARD_PEERS.map((p) => ({ ...p, isSelf: false })),
        { id: "self", name: youLabel, xp: stats.currentXp, isSelf: true },
      ].sort((a, b) => (b.xp !== a.xp ? b.xp - a.xp : a.isSelf ? -1 : 1)),
    [youLabel, stats.currentXp]
  );

  const showNotice = (title: string, message: string, isLevelUp = false) => {
    setBannerToast({ title, message, isLevelUp });
    window.setTimeout(() => {
      setBannerToast((prev) => (prev?.title === title ? null : prev));
    }, 5500);
  };

  const handleDailyCheckIn = () => {
    if (hasCheckedInToday) return;
    const prevLevel = stats.level;
    const nextCheckIns = [...checkInsArray, todayCheckInKey];
    writeCheckInsStore(nextCheckIns);

    const nextStats = calculateCitizenStats(upvotedIds.size, myReportIds.size, {
      ...citizenXpExtras,
      dailyCheckInCount: nextCheckIns.length,
    });

    if (nextStats.level > prevLevel) {
      showNotice(
        `เลื่อนระดับสู่ Lv.${nextStats.level} แล้ว!`,
        `ปลดล็อกตำแหน่ง "${nextStats.title}" · สะสมครบ ${nextStats.currentXp} XP`,
        true
      );
    } else {
      showNotice(
        "เช็กอินตรวจตราเมืองสำเร็จ!",
        `รับ +${CITIZEN_XP_REWARDS.DAILY_CHECKIN} XP สำหรับภารกิจประจำวันแล้ว`
      );
    }
  };

  const openAuthModal = (tab: CitizenAuthTab = "login") => {
    setAuthTab(tab);
    setIsAuthModalOpen(true);
  };

  const iosCardClass =
    "bg-white/82 dark:bg-white/[0.06] backdrop-blur-2xl border border-white/90 dark:border-white/[0.12] shadow-[0_12px_36px_-8px_rgba(15,23,42,0.08),inset_0_1px_0_0_rgba(255,255,255,0.9)] dark:shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55),inset_0_1px_0_0_rgba(255,255,255,0.14)]";

  const iosInnerTileClass =
    "bg-white/80 dark:bg-slate-900/55 border border-white/90 dark:border-white/[0.12]";

  return (
    <div className="relative min-h-screen bg-[#f2f2f7] dark:bg-[#050811] text-slate-900 dark:text-slate-100 flex flex-col antialiased selection:bg-orange-500/30">
      {/* Ambient Mesh Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute -top-40 -left-24 w-[480px] h-[480px] rounded-full bg-amber-400/20 dark:bg-orange-500/15 blur-[130px]" />
        <div className="absolute top-1/4 -right-32 w-[460px] h-[460px] rounded-full bg-rose-400/15 dark:bg-rose-600/12 blur-[130px]" />
        <div className="absolute -bottom-40 left-1/3 w-[520px] h-[520px] rounded-full bg-teal-400/15 dark:bg-cyan-500/10 blur-[140px]" />
      </div>

      {/* Top Sticky Frosted Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-900/[0.06] dark:border-white/[0.08] bg-white/78 dark:bg-slate-950/75 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/85 dark:bg-white/10 border border-white/90 dark:border-white/15 text-xs font-black text-slate-800 dark:text-white hover:bg-white dark:hover:bg-white/20 transition shadow-xs shrink-0"
            >
              <JKIcon name="arrow-left" className="text-[11px]" />
              <span className="hidden sm:inline">กลับหน้าแผนที่</span>
              <span className="sm:hidden">แผนที่</span>
            </Link>

            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-rose-500 p-1 flex items-center justify-center shadow-sm shrink-0">
                <img
                  src={citizenMember?.avatarPose || "/images/mascot_success.png"}
                  alt="Citizen Hub Mascot"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black text-slate-900 dark:text-white truncate">
                    ศูนย์พลเมืองตื่นรู้
                  </h1>
                  <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 text-[10px] font-black shrink-0">
                    Lv.{stats.level}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate hidden sm:block">
                  ระบบสะสม XP จริง เลื่อนระดับ &amp; ติดตามผลกระทบชุมชน
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/?report=1"
              className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-gradient-to-r from-red-500 via-rose-500 to-orange-500 hover:from-red-400 hover:to-orange-400 text-white text-xs font-black shadow-md shadow-rose-500/25 transition active:scale-95"
            >
              <JKIcon name="plus" className="text-[11px]" />
              <span>แจ้งเรื่องใหม่ (+{CITIZEN_XP_REWARDS.REPORT} XP)</span>
            </Link>

            <PwaInstallButton
              showLabel
              className="inline-flex items-center justify-center gap-1.5 h-9 px-2.5 xl:px-3 rounded-2xl bg-white/85 dark:bg-white/10 border border-white/90 dark:border-white/15 text-teal-700 dark:text-cyan-300 hover:bg-white dark:hover:bg-white/20 text-xs font-black transition cursor-pointer whitespace-nowrap"
            />

            <button
              type="button"
              onClick={() => toggleThemeStore(!isDark, currentStyle)}
              aria-label="สลับโหมดสว่าง/มืด"
              className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-white/10 border border-white/90 dark:border-white/15 text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-white/20 flex items-center justify-center transition cursor-pointer"
            >
              <JKIcon name={isDark ? "sun" : "moon"} className="text-xs" />
            </button>

            {citizenId && historyError === citizenId && <p role="status">โหลดประวัติไม่ได้</p>}
            {citizenMember ? (
              <button
                type="button"
                onClick={async () => {
                  try { await clearCitizenSession(); } catch {
                    showNotice("ออกจากระบบไม่สำเร็จ", "กรุณาลองใหม่");
                    return;
                  }
                  showNotice(
                    "ออกจากระบบสมาชิกแล้ว",
                    "ยังสามารถสะสม XP และแจ้งเรื่องแบบไม่ระบุตัวตนได้ต่อ"
                  );
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-rose-500/10 hover:bg-rose-500 text-rose-700 dark:text-rose-300 hover:text-white border border-rose-500/25 text-xs font-black transition cursor-pointer"
              >
                <JKIcon name="power-off" className="text-[11px]" />
                <span className="hidden sm:inline">ออกจากระบบ</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openAuthModal("login")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-sm transition cursor-pointer"
              >
                <JKIcon name="user-check" className="text-[11px]" />
                <span>เข้าสู่ระบบสมาชิก</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Live Toast Notification Banner */}
      {bannerToast && (
        <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4 relative z-20">
          <div
            role="status"
            className={`p-3.5 rounded-2xl border flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
              bannerToast.isLevelUp
                ? "bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-rose-500/20 border-amber-400 text-slate-900 dark:text-white"
                : "bg-emerald-500/15 border-emerald-400/50 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-white/90 dark:bg-slate-900/80 p-1 flex items-center justify-center shrink-0">
                <img
                  src="/images/mascot_success.png"
                  alt="Mascot"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black truncate">{bannerToast.title}</p>
                <p className="text-[11px] opacity-90 truncate">{bannerToast.message}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBannerToast(null)}
              className="p-1.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 transition cursor-pointer shrink-0"
              aria-label="ปิดการแจ้งเตือน"
            >
              <JKIcon name="xmark" className="text-xs" />
            </button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* ROW 1: Hero Level & Member Card | My Impact & Daily Quests */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Profile, Level, Member Card */}
          <section className="lg:col-span-5 space-y-5">
          {/* Hero Level Card */}
          <div className="rounded-[32px] overflow-hidden shadow-xl border border-white/25 bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-6">
            <div className="flex items-center gap-4">
              <div className="relative w-20 h-20 sm:w-24 sm:h-24 shrink-0 drop-shadow-[0_10px_18px_rgba(0,0,0,0.3)]">
                <img
                  src={citizenMember?.avatarPose || "/images/mascot_success.png"}
                  alt="Citizen Mascot"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-md text-[10px] font-black uppercase tracking-wide border border-white/30 mb-1.5">
                  <JKIcon name="award" className="text-yellow-200" />
                  <span>{citizenMember ? "สมาชิกพลเมือง" : "Citizen Gamification"}</span>
                </div>
                <h2 className="text-xl sm:text-2xl font-black leading-tight truncate">
                  {citizenMember ? citizenMember.displayName : "พลเมืองตื่นรู้"}
                </h2>
                <p className="text-xs text-white/90 truncate mt-0.5">
                  {citizenMember
                    ? `สมาชิก จ.${citizenMember.homeProvince} · ${citizenMember.email}`
                    : "สะสม XP จากการมีส่วนร่วมจริงบนแผนที่ประเทศไทย"}
                </p>
              </div>
            </div>

            {/* Level Progress Box */}
            <div className="mt-5 p-4 rounded-2xl bg-black/25 backdrop-blur-md border border-white/20">
              <div className="flex items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="px-2.5 py-0.5 rounded-lg bg-yellow-400 text-slate-950 font-black text-xs shrink-0">
                    Lv. {stats.level}
                  </span>
                  <span className="font-extrabold text-sm truncate">{stats.title}</span>
                </div>
                <span className="font-mono font-black text-yellow-200 text-xs shrink-0">
                  {stats.currentXp} / {stats.nextLevelXp} XP
                </span>
              </div>

              <div className="w-full h-3 rounded-full bg-white/20 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-yellow-300 to-amber-300 rounded-full transition-all duration-500"
                  style={{ width: `${stats.levelProgress}%` }}
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-white/90 font-semibold mt-2">
                <span>ความคืบหน้าในระดับนี้ {stats.levelProgress}%</span>
                <span>อีก {stats.xpToNextLevel} XP เลื่อนเป็น Lv.{stats.level + 1}</span>
              </div>
            </div>
          </div>

          {/* Member Account Card */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            {citizenMember ? (
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <JKIcon name="user-check" className="text-base" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-slate-900 dark:text-white truncate">
                        {citizenMember.displayName}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[10px] font-black">
                        Member
                      </span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                      พื้นที่หลัก: จ.{citizenMember.homeProvince}
                    </p>
                  </div>
                </div>
                <Link
                  href="/?report=1"
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black transition shrink-0"
                >
                  แจ้งเรื่องเลย
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                    <JKIcon name="id-card" className="text-base" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      บัญชีสมาชิกพลเมือง (ใช้งานฟรี)
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                      เข้าสู่ระบบเพื่อกรอกชื่อแจ้งเรื่องอัตโนมัติ หรือเลือกแจ้งแบบไม่ระบุตัวตนได้ตลอดเวลา
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => openAuthModal("login")}
                    className={`py-2.5 rounded-2xl text-xs font-black text-slate-800 dark:text-white hover:bg-white dark:hover:bg-white/15 transition cursor-pointer ${iosInnerTileClass}`}
                  >
                    เข้าสู่ระบบ
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuthModal("register")}
                    className="py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black shadow-sm transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <JKIcon name="user-plus" className="text-[11px]" />
                    <span>สมัครสมาชิก</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* RIGHT: My Impact & Daily Quests */}
        <section className="lg:col-span-7 space-y-5">
          {/* My Impact 4 KPIs */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <JKIcon name="chart-pie" className="text-orange-500" />
              <span>ผลกระทบที่คุณช่วยสร้าง (My Impact)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className={`p-3.5 rounded-2xl text-center ${iosInnerTileClass}`}>
                <span className="text-2xl font-black text-orange-500">{upvotedIds.size}</span>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">ร่วมโหวตปัญหา</p>
              </div>
              <div className={`p-3.5 rounded-2xl text-center ${iosInnerTileClass}`}>
                <span className="text-2xl font-black text-blue-500">{myReportIds.size}</span>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">เรื่องที่แจ้งใหม่</p>
              </div>
              <div className={`p-3.5 rounded-2xl text-center ${iosInnerTileClass}`}>
                <span className="text-2xl font-black text-indigo-500">{commentCount + pollVoteCount}</span>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">ความเห็น / โพล</p>
              </div>
              <div className={`p-3.5 rounded-2xl text-center ${iosInnerTileClass}`}>
                <span className="text-2xl font-black text-emerald-500">{resolvedImpactCount}</span>
                <p className="text-[11px] font-bold text-slate-600 dark:text-slate-300 mt-0.5">ดันจนสำเร็จ</p>
              </div>
            </div>
          </div>

          {/* Daily Quests */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            <div className="flex items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <JKIcon name="sparkles" className="text-yellow-500" />
                <span>ภารกิจพลเมืองวันนี้ (Daily Quests)</span>
              </h3>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                ทำภารกิจเพื่ออัปเลเวลทันที
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {/* Quest 1: Daily Check-In */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  hasCheckedInToday
                    ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                    : iosInnerTileClass
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                      hasCheckedInToday
                        ? "bg-emerald-500 text-white"
                        : "bg-teal-500/15 text-teal-600 dark:text-teal-300"
                    }`}
                  >
                    <JKIcon name={hasCheckedInToday ? "check" : "calendar-check"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">เช็กอินตรวจตราเมือง</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                      +{CITIZEN_XP_REWARDS.DAILY_CHECKIN} XP รายวัน
                    </p>
                  </div>
                </div>
                {hasCheckedInToday ? (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    รับแล้ว ✓
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleDailyCheckIn}
                    className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-black transition cursor-pointer shrink-0 active:scale-95"
                  >
                    เช็กอิน +{CITIZEN_XP_REWARDS.DAILY_CHECKIN}
                  </button>
                )}
              </div>

              {/* Quest 2: Upvote */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  upvotedIds.size > 0
                    ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                    : iosInnerTileClass
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                      upvotedIds.size > 0 ? "bg-emerald-500 text-white" : "bg-orange-500/15 text-orange-500"
                    }`}
                  >
                    <JKIcon name={upvotedIds.size > 0 ? "check" : "thumbs-up"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">กด +1 ดันเรื่องด่วน</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                      +{CITIZEN_XP_REWARDS.UPVOTE} XP / เรื่อง
                    </p>
                  </div>
                </div>
                {upvotedIds.size > 0 ? (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    สำเร็จ ({upvotedIds.size}) ✓
                  </span>
                ) : (
                  <Link
                    href="/"
                    className="px-2.5 py-1.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300 text-[10px] font-black transition shrink-0"
                  >
                    ไปโหวต
                  </Link>
                )}
              </div>

              {/* Quest 3: Comment / Poll */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  commentCount > 0 || pollVoteCount > 0
                    ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                    : iosInnerTileClass
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                      commentCount > 0 || pollVoteCount > 0
                        ? "bg-emerald-500 text-white"
                        : "bg-indigo-500/15 text-indigo-500"
                    }`}
                  >
                    <JKIcon name={commentCount > 0 || pollVoteCount > 0 ? "check" : "comments"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">ติดตามความเห็น / โพล</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                      +{CITIZEN_XP_REWARDS.COMMENT}~{CITIZEN_XP_REWARDS.POLL_VOTE} XP
                    </p>
                  </div>
                </div>
                {commentCount > 0 || pollVoteCount > 0 ? (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    สำเร็จ ({commentCount + pollVoteCount}) ✓
                  </span>
                ) : (
                  <Link
                    href="/"
                    className="px-2.5 py-1.5 rounded-xl bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-300 text-[10px] font-black transition shrink-0"
                  >
                    ไปร่วมกิจกรรม
                  </Link>
                )}
              </div>

              {/* Quest 4: New Report */}
              <div
                className={`p-3.5 rounded-2xl border flex items-center justify-between gap-2 ${
                  myReportIds.size > 0
                    ? "bg-emerald-50/90 dark:bg-emerald-500/15 border-emerald-300 dark:border-emerald-500/30"
                    : iosInnerTileClass
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                      myReportIds.size > 0 ? "bg-emerald-500 text-white" : "bg-blue-500/15 text-blue-500"
                    }`}
                  >
                    <JKIcon name={myReportIds.size > 0 ? "check" : "camera"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">แจ้งปัญหา (+รูป +{CITIZEN_XP_REWARDS.PHOTO_BONUS})</p>
                    <p className="text-[10px] text-slate-600 dark:text-slate-300 truncate">
                      +{CITIZEN_XP_REWARDS.REPORT} XP / เรื่อง
                    </p>
                  </div>
                </div>
                {myReportIds.size > 0 ? (
                  <span className="text-[10px] font-black text-emerald-700 dark:text-emerald-300 shrink-0">
                    สำเร็จ ({myReportIds.size}) ✓
                  </span>
                ) : (
                  <Link
                    href="/?report=1"
                    className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-[10px] font-black transition shrink-0"
                  >
                    แจ้งปัญหา
                  </Link>
                )}
              </div>
            </div>
          </div>
        </section>
        </div>

        {/* ROW 2: Interactive Citizen Analytics Charts Deck */}
        <CitizenAnalyticsCharts
          stats={stats}
          complaints={complaints}
          upvotedIds={upvotedIds}
          myReportIds={myReportIds}
          citizenXpExtras={citizenXpExtras}
          iosCardClass={iosCardClass}
          iosInnerTileClass={iosInnerTileClass}
        />

        {/* ROW 3: Roadmap & XP Breakdown | Badges, History & Leaderboard */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Level Tiers Roadmap + Real XP Breakdown */}
          <section className="lg:col-span-5 space-y-5">
            {/* Level Tiers Roadmap */}
            <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <JKIcon name="ranking-star" className="text-amber-500" />
                <span>เส้นทางระดับพลเมือง (Level Roadmap)</span>
              </h3>
              <div className="space-y-2">
                {CITIZEN_LEVEL_TIERS.map((tier) => {
                  const unlocked = stats.level >= tier.level;
                  const isCurrent = stats.level === tier.level;
                  return (
                    <div
                      key={tier.level}
                      className={`flex items-center justify-between gap-3 p-3 rounded-2xl border transition ${
                        isCurrent
                          ? "bg-amber-50/95 dark:bg-amber-500/20 border-amber-400 shadow-xs"
                          : unlocked
                          ? "bg-emerald-50/85 dark:bg-emerald-500/15 border-emerald-400/50"
                          : `${iosInnerTileClass} opacity-75`
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                            isCurrent
                              ? "bg-amber-500 text-white"
                              : unlocked
                              ? "bg-emerald-500 text-white"
                              : "bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          {tier.level}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                            {tier.title}
                          </p>
                          <p className="text-[10px] text-slate-600 dark:text-slate-300">
                            {tier.minXp} – {tier.nextXp - 1} XP
                          </p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-black px-2 py-0.5 rounded-lg shrink-0 ${
                          isCurrent
                            ? "bg-amber-500/20 text-amber-800 dark:text-amber-200"
                            : unlocked
                            ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                            : "text-slate-500 dark:text-slate-400"
                        }`}
                      >
                        {isCurrent ? "ระดับปัจจุบัน" : unlocked ? "ผ่านแล้ว ✓" : `${tier.minXp} XP`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Real XP Breakdown */}
            <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <JKIcon name="coins" className="text-orange-500" />
                  <span>ที่มาคะแนนสะสม (XP Breakdown)</span>
                </h3>
                <span className="text-xs font-mono font-black text-orange-600 dark:text-orange-400">
                  รวม {stats.currentXp} XP
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "เช็กอินรายวัน", rule: `+${CITIZEN_XP_REWARDS.DAILY_CHECKIN}/วัน`, val: stats.breakdown.checkIns, icon: "calendar-check", color: "text-teal-500" },
                  { label: "โหวตดันปัญหา", rule: `+${CITIZEN_XP_REWARDS.UPVOTE}/ครั้ง`, val: stats.breakdown.upvotes, icon: "thumbs-up", color: "text-orange-500" },
                  { label: "แจ้งเรื่องใหม่", rule: `+${CITIZEN_XP_REWARDS.REPORT}/เรื่อง`, val: stats.breakdown.reports, icon: "plus", color: "text-rose-500" },
                  { label: "โบนัสภาพหลักฐาน", rule: `+${CITIZEN_XP_REWARDS.PHOTO_BONUS}/ภาพ`, val: stats.breakdown.photos, icon: "camera", color: "text-blue-500" },
                  { label: "แสดงความคิดเห็น", rule: `+${CITIZEN_XP_REWARDS.COMMENT}/ครั้ง`, val: stats.breakdown.comments, icon: "comments", color: "text-indigo-500" },
                  { label: "โหวตโพลชุมชน", rule: `+${CITIZEN_XP_REWARDS.POLL_VOTE}/โพล`, val: stats.breakdown.polls, icon: "square-poll-vertical", color: "text-purple-500" },
                ].map((item) => (
                  <div key={item.label} className={`p-3 rounded-2xl ${iosInnerTileClass}`}>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 truncate">
                        <JKIcon name={item.icon} className={`text-[10px] ${item.color}`} />
                        <span className="truncate">{item.label}</span>
                      </span>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono shrink-0">
                        {item.rule}
                      </span>
                    </div>
                    <p className="text-sm font-black font-mono text-slate-900 dark:text-white">
                      +{item.val} XP
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-2 p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-1.5">
                  <JKIcon name="circle-check" className="text-emerald-500" />
                  โบนัสเคสที่ร่วมผลักดันแก้ไขสำเร็จ (+{CITIZEN_XP_REWARDS.RESOLVED_BONUS}/เคส)
                </span>
                <span className="text-sm font-black font-mono text-emerald-700 dark:text-emerald-300">
                  +{stats.breakdown.resolved} XP
                </span>
              </div>
            </div>
          </section>

          {/* RIGHT: Badges, History Tabs, Leaderboard */}
          <section className="lg:col-span-7 space-y-5">
            {/* Badges */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <JKIcon name="medal" className="text-amber-500" />
              <span>เหรียญเกียรติยศพลเมือง (Badges)</span>
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${
                hasStarterBadge
                  ? "bg-amber-50/90 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700/50"
                  : `${iosInnerTileClass} opacity-60`
              }`}>
                <span className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center text-amber-500 mb-1.5 text-base">
                  <JKIcon name="star" />
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">ผู้บุกเบิก</span>
                <span className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold mt-0.5">
                  {hasStarterBadge ? "ปลดล็อกแล้ว ✓" : "สะสม XP แรก"}
                </span>
              </div>

              <div className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${
                hasUpvoteBadge
                  ? "bg-orange-50/90 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700/50"
                  : `${iosInnerTileClass} opacity-60`
              }`}>
                <span className="w-9 h-9 rounded-xl bg-orange-500/15 flex items-center justify-center text-orange-500 mb-1.5 text-base">
                  <JKIcon name="fire" />
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">พลังมวลชน</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                  {hasUpvoteBadge ? "ปลดล็อกแล้ว ✓" : "โหวตดัน 1 เรื่อง"}
                </span>
              </div>

              <div className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${
                hasPhotoBadge
                  ? "bg-blue-50/90 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700/50"
                  : `${iosInnerTileClass} opacity-60`
              }`}>
                <span className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-blue-500 mb-1.5 text-base">
                  <JKIcon name="camera" />
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">ตาเหยี่ยว</span>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 font-semibold mt-0.5">
                  {hasPhotoBadge ? "ปลดล็อกแล้ว ✓" : "แนบภาพหลักฐาน"}
                </span>
              </div>

              <div className={`flex flex-col items-center p-3 rounded-2xl border text-center transition ${
                hasGuardianBadge
                  ? "bg-emerald-50/90 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-700/50"
                  : `${iosInnerTileClass} opacity-60`
              }`}>
                <span className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-500 mb-1.5 text-base">
                  <JKIcon name="shield-halved" />
                </span>
                <span className="text-xs font-black text-slate-900 dark:text-white">พิทักษ์เมือง</span>
                <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold mt-0.5">
                  {hasGuardianBadge ? "ปลดล็อกแล้ว ✓" : "เม้นต์/โพล/สำเร็จ"}
                </span>
              </div>
            </div>
          </div>

          {/* My Activity History Tabs */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <JKIcon name="clock-rotate-left" className="text-teal-500" />
                <span>ประวัติการมีส่วนร่วมของฉัน</span>
              </h3>
              <div className="flex items-center gap-1 bg-slate-200/65 dark:bg-white/10 p-1 rounded-xl">
                {[
                  { id: "reports" as const, label: `ที่แจ้ง (${myReportsList.length})` },
                  { id: "upvotes" as const, label: `ที่โหวต (${myUpvotedList.length})` },
                  { id: "resolved" as const, label: `สำเร็จ (${myResolvedList.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryTab(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                      historyTab === tab.id
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeHistoryList.length === 0 ? (
              <div className={`p-6 rounded-2xl text-center ${iosInnerTileClass}`}>
                <p className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {historyTab === "reports"
                    ? "ยังไม่มีเรื่องที่คุณแจ้งในเบราว์เซอร์นี้"
                    : historyTab === "upvotes"
                    ? "ยังไม่มีเรื่องที่คุณกด +1 โหวต"
                    : "ยังไม่มีเรื่องที่คุณมีส่วนร่วมที่ถูกปิดงานสำเร็จ"}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 mb-3">
                  เริ่มต้นแจ้งปัญหาหรือโหวตเรื่องสำคัญบนแผนที่เพื่อสะสม XP และเลื่อนระดับได้เลย
                </p>
                <Link
                  href={historyTab === "reports" ? "/?report=1" : "/"}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-black transition"
                >
                  <JKIcon name={historyTab === "reports" ? "plus" : "map"} className="text-[11px]" />
                  <span>{historyTab === "reports" ? "แจ้งเรื่องแรก (+30 XP)" : "เปิดแผนที่สำรวจเรื่อง"}</span>
                </Link>
              </div>
            ) : (
              <div className="space-y-2">
                {activeHistoryList.map((c) => {
                  const cat = COMPLAINT_CATEGORIES.find((x) => x.id === c.categoryId);
                  const st = STATUS_BADGES[c.status];
                  const prov = c.province || inferProvinceFromCoord(c.coordinates);
                  const dist = c.district || inferDistrictFromCoord(c.coordinates);
                  return (
                    <div
                      key={c.id}
                      className={`p-3 rounded-2xl flex items-center justify-between gap-3 ${iosInnerTileClass}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: cat?.color || "#94a3b8" }}
                          />
                          <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            {cat?.label || "ทั่วไป"}
                          </span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${st.pill}`}>
                            {st.label}
                          </span>
                        </div>
                        <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                          {c.title}
                        </p>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                          {prov} · {dist} · โหวต {c.upvotes ?? 0}
                        </p>
                      </div>
                      <Link
                        href={`/?complaint=${encodeURIComponent(c.id)}`}
                        className="px-3 py-1.5 rounded-xl bg-teal-500/15 hover:bg-teal-500/25 text-teal-700 dark:text-cyan-300 text-[11px] font-black transition shrink-0 flex items-center gap-1"
                      >
                        <JKIcon name="location-dot" className="text-[10px]" />
                        <span>ดูบนแผนที่</span>
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Weekly Leaderboard */}
          <div className={`rounded-[28px] p-5 ${iosCardClass}`}>
            <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-wider mb-3 flex items-center gap-2">
              <JKIcon name="trophy" className="text-yellow-500" />
              <span>ทำเนียบพลเมืองยอดเยี่ยมสัปดาห์นี้</span>
            </h3>
            <div className={`divide-y divide-slate-200/70 dark:divide-white/10 rounded-2xl overflow-hidden ${iosInnerTileClass}`}>
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
                    className={`flex items-center justify-between p-3 text-xs ${
                      entry.isSelf ? "bg-amber-500/15 dark:bg-amber-500/20" : ""
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className={`w-6 h-6 rounded-full font-black text-[11px] flex items-center justify-center shrink-0 ${badgeBg}`}>
                        {rank}
                      </span>
                      <span
                        className={`truncate ${
                          entry.isSelf
                            ? "font-black text-amber-800 dark:text-amber-300"
                            : "font-bold text-slate-800 dark:text-white"
                        }`}
                      >
                        {entry.name}
                      </span>
                    </div>
                    <span className="font-mono font-black text-orange-600 dark:text-orange-400 text-xs shrink-0">
                      {entry.xp} XP
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
        </div>
      </main>

      <CitizenAuthModal
        isOpen={isAuthModalOpen}
        initialTab={authTab}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={(member, mode) => {
          showNotice(
            mode === "register" ? "สมัครสมาชิกสำเร็จ!" : "เข้าสู่ระบบสมาชิกสำเร็จ!",
            `ยินดีต้อนรับคุณ ${member.displayName} (จ.${member.homeProvince})`
          );
        }}
      />
    </div>
  );
}
