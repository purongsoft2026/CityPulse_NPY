"use client";

import React, { useState, useMemo, useCallback, useRef, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { MapHeader, type MapStyleKey } from "@/components/map/MapHeader";
import { MapBoundary, MapFallback } from "@/components/map/MapFallback";
import { MapContainer } from "@/components/map/MapContainer";
import type {
  HoveredDistrictInfo,
  HoveredProvinceInfo,
  HoveredTambonInfo,
} from "@/components/map/ProvinceBoundaryLayer";
import { ComplaintSidebar } from "@/components/map/ComplaintSidebar";
import { ComplaintForm } from "@/components/map/ComplaintForm";
import { ComplaintDetailOffcanvas } from "@/components/map/ComplaintDetailOffcanvas";
import { ShareCardModal } from "@/components/map/ShareCardModal";
import { CitizenAuthModal, type CitizenAuthTab } from "@/components/auth/CitizenAuthModal";
import { FloatingMascotWidget } from "@/components/mascot/FloatingMascotWidget";
import { EmergencySosModal } from "@/components/emergency/EmergencySosModal";
import { MobileBottomBar } from "@/components/map/MobileBottomBar";
import { WeatherCard } from "@/components/ui/WeatherCard";
import {
  type ComplaintReport,
  type ComplaintComment,
  type CityViewport,
  type CityLayerKey,
  type EmergencyPoint,
  type CitizenXpExtras,
  CITIZEN_XP_REWARDS,
  CITIES,
  calculateCitizenStats,
  deriveComplaintXpMetrics,
  getProvinceName,
  INITIAL_CIVIC_POLLS,
  INITIAL_COMPLAINTS,
} from "@/data/map-data";
import {
  EMPTY_POLL_VOTES,
  EMPTY_STRING_ARRAY,
  getCheckInsSnapshot,
  getCivicPollsSnapshot,
  getComplaintsSnapshot,
  getIsDarkSnapshot,
  getMapStyleSnapshot,
  getMyCommentsSnapshot,
  getMyReportsSnapshot,
  getPollVotesSnapshot,
  getUpvotesSnapshot,
  getUrlSearchParamSnapshot,
  subscribePopState,
  subscribeStorageSync,
  subscribeThemeSync,
  toggleThemeStore,
  writeCivicPollsStore,
  writeComplaintsStore,
  writeMapStyleStore,
  writeMyCommentsStore,
  writeMyReportsStore,
  writePollVotesStore,
  writeUpvotesStore,
} from "@/lib/civic-store";
import {
  getCitizenSessionSnapshot,
  subscribeCitizenSession,
} from "@/lib/citizen-auth";

function subscribeDesktopBreakpoint(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}

function getDesktopSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth >= 1024;
}

const getUrlComplaintSnapshot = () => getUrlSearchParamSnapshot("complaint");
const getUrlReportSnapshot = () => getUrlSearchParamSnapshot("report");
const serverFalse = () => false;
const serverNull = () => null;
const serverVoyager = (): MapStyleKey => "voyager";
const serverComplaints = () => INITIAL_COMPLAINTS;
const serverUpvotes = () => EMPTY_STRING_ARRAY;
const serverMyReports = () => EMPTY_STRING_ARRAY;
const serverCheckIns = () => EMPTY_STRING_ARRAY;
const serverMyComments = () => EMPTY_STRING_ARRAY;
const serverPolls = () => INITIAL_CIVIC_POLLS;
const serverPollVotes = () => EMPTY_POLL_VOTES;

export default function Home() {
  const router = useRouter();
  const complaints = useSyncExternalStore(
    subscribeStorageSync,
    getComplaintsSnapshot,
    serverComplaints
  );
  const upvotedArray = useSyncExternalStore(
    subscribeStorageSync,
    getUpvotesSnapshot,
    serverUpvotes
  );
  const myReportsArray = useSyncExternalStore(
    subscribeStorageSync,
    getMyReportsSnapshot,
    serverMyReports
  );
  const checkInsArray = useSyncExternalStore(
    subscribeStorageSync,
    getCheckInsSnapshot,
    serverCheckIns
  );
  const myCommentsArray = useSyncExternalStore(
    subscribeStorageSync,
    getMyCommentsSnapshot,
    serverMyComments
  );
  const civicPolls = useSyncExternalStore(
    subscribeStorageSync,
    getCivicPollsSnapshot,
    serverPolls
  );
  const userPollVotes = useSyncExternalStore(
    subscribeStorageSync,
    getPollVotesSnapshot,
    serverPollVotes
  );

  const isDark = useSyncExternalStore(subscribeThemeSync, getIsDarkSnapshot, serverFalse);
  const currentStyle = useSyncExternalStore(
    subscribeThemeSync,
    getMapStyleSnapshot,
    serverVoyager
  );
  const isDesktop = useSyncExternalStore(subscribeDesktopBreakpoint, getDesktopSnapshot, serverFalse);
  const urlComplaintId = useSyncExternalStore(subscribePopState, getUrlComplaintSnapshot, serverNull);
  const urlReportParam = useSyncExternalStore(subscribePopState, getUrlReportSnapshot, serverNull);

  const upvotedIds = useMemo(() => new Set(upvotedArray), [upvotedArray]);
  const myReportIds = useMemo(() => new Set(myReportsArray), [myReportsArray]);

  const { photoReportCount, resolvedImpactCount: userResolvedImpactCount } = useMemo(
    () => deriveComplaintXpMetrics(complaints, myReportIds, upvotedIds),
    [complaints, myReportIds, upvotedIds]
  );
  const citizenXpExtras: CitizenXpExtras = useMemo(
    () => ({
      dailyCheckInCount: checkInsArray.length,
      pollVoteCount: Object.keys(userPollVotes).length,
      commentCount: myCommentsArray.length,
      photoReportCount,
      resolvedImpactCount: userResolvedImpactCount,
    }),
    [
      checkInsArray.length,
      userPollVotes,
      myCommentsArray.length,
      photoReportCount,
      userResolvedImpactCount,
    ]
  );
  const citizenStats = useMemo(
    () => calculateCitizenStats(upvotedIds.size, myReportIds.size, citizenXpExtras),
    [upvotedIds.size, myReportIds.size, citizenXpExtras]
  );

  const [sidebarOverride, setSidebarOverride] = useState<boolean | null>(null);
  const isSidebarOpen = sidebarOverride ?? isDesktop;
  const setIsSidebarOpen = (open: boolean) => setSidebarOverride(open);

  // Active Map Layer Switcher
  const [activeLayer, setActiveLayer] = useState<CityLayerKey>("complaints");

  // Emergency SOS Hub Modal
  const [isSosModalOpen, setIsSosModalOpen] = useState<boolean>(false);
  const [sosSearchCoord, setSosSearchCoord] = useState<[number, number] | undefined>();

  // Report mode: user is selecting location on map (also supports /?report=1 deep-link)
  const [isReportMode, setIsReportMode] = useState<boolean>(false);
  const [dismissedUrlReport, setDismissedUrlReport] = useState<boolean>(false);
  const effectiveReportMode = isReportMode || (urlReportParam === "1" && !dismissedUrlReport);

  // Selection & Detail state (ID-based so derived item is always fresh)
  const [selectedComplaintId, setSelectedComplaintId] = useState<string | null>(null);
  const [detailComplaintId, setDetailComplaintId] = useState<string | null>(null);
  const [dismissedUrlComplaint, setDismissedUrlComplaint] = useState<boolean>(false);
  const [pendingCoord, setPendingCoord] = useState<[number, number] | null>(null);

  // Form state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);

  // City fly-to & clicked province/district/tambon weather/info target
  const [targetCity, setTargetCity] = useState<CityViewport | null>(null);
  const [clickedProvinceCity, setClickedProvinceCity] = useState<CityViewport | null>(null);
  const [clickedDistrictCity, setClickedDistrictCity] = useState<CityViewport | null>(null);
  const [clickedTambonCity, setClickedTambonCity] = useState<CityViewport | null>(null);

  const handleSelectTargetCity = useCallback((city: CityViewport | null) => {
    setClickedProvinceCity(null);
    setClickedDistrictCity(null);
    setClickedTambonCity(null);
    setTargetCity(city);
  }, []);

  const handleSelectMapDistrict = useCallback((district: HoveredDistrictInfo | null) => {
    if (!district) {
      setClickedDistrictCity(null);
      return;
    }
    const shortDistrict = district.displayTh.replace(/^อำเภอ/, "อ.");
    setClickedDistrictCity({
      id: `dist-${district.id}`,
      name: `${shortDistrict} • ${district.provinceTh}`,
      country: district.region || "Thailand",
      region: district.region,
      center: district.center ?? [100.5018, 13.7563],
      zoom: 11,
    });
  }, []);

  const handleSelectMapTambon = useCallback((tambon: HoveredTambonInfo | null) => {
    if (!tambon) {
      setClickedTambonCity(null);
      return;
    }
    const shortTambon = tambon.displayTh.replace(/^ตำบล/, "ต.");
    setClickedTambonCity({
      id: `tam-${tambon.id}`,
      name: `${shortTambon} • ${tambon.provinceTh}`,
      country: tambon.region || "Thailand",
      region: tambon.region,
      center: tambon.center ?? [100.5018, 13.7563],
      zoom: 12,
    });
  }, []);

  const handleSelectMapProvince = useCallback((province: HoveredProvinceInfo | null) => {
    if (!province) {
      setClickedProvinceCity(null);
      return;
    }
    const matched = CITIES.find((c) => getProvinceName(c) === province.nameTh);
    if (matched) {
      setClickedProvinceCity(matched);
      return;
    }
    setClickedProvinceCity({
      id: `prov-${province.id || province.nameTh}`,
      name: province.nameTh,
      country: province.region || "Thailand",
      region: province.region,
      center: province.center ?? [100.5018, 13.7563],
      zoom: 10,
    });
  }, []);

  // Citizen Hub & Member Auth Modal
  const citizenSession = useSyncExternalStore(
    subscribeCitizenSession,
    getCitizenSessionSnapshot,
    serverNull
  );
  const citizenMember = citizenSession?.member ?? null;

  const [citizenAuthOpen, setCitizenAuthOpen] = useState<boolean>(false);
  const [citizenAuthTab, setCitizenAuthTab] = useState<CitizenAuthTab>("login");

  const openCitizenAuth = useCallback((tab: CitizenAuthTab = "login") => {
    setCitizenAuthTab(tab);
    setCitizenAuthOpen(true);
  }, []);

  // Share Card Modal
  const [shareComplaint, setShareComplaint] = useState<ComplaintReport | null>(null);

  // Mascot celebratory toast notification
  const [toastNotification, setToastNotification] = useState<{
    text: string;
    subText?: string;
    pose: string;
  } | null>(null);

  const showMascotToast = useCallback(
    (text: string, subText?: string, pose = "/images/mascot_success.png") => {
      setToastNotification({ text, subText, pose });
      setTimeout(() => setToastNotification(null), 3800);
    },
    []
  );

  const persistComplaints = useCallback(
    (nextComplaints: ComplaintReport[]) => {
      const ok = writeComplaintsStore(nextComplaints);
      if (!ok) {
        showMascotToast(
          "พื้นที่จัดเก็บบนเบราว์เซอร์เต็ม",
          "ระบบยังคงแสดงผลปัจจุบัน แต่แนะนำให้ลบรายการเก่าออกบางส่วน",
          "/images/mascot_searching.png"
        );
      }
    },
    [showMascotToast]
  );

  const persistUpvotes = writeUpvotesStore;
  const persistMyReports = writeMyReportsStore;
  const persistMyComments = writeMyCommentsStore;
  const persistPolls = writeCivicPollsStore;
  const persistPollVotes = writePollVotesStore;

  const clearReportQueryParam = useCallback(() => {
    setDismissedUrlReport(true);
    if (typeof window !== "undefined" && window.location.search.includes("report=")) {
      window.history.replaceState({}, "", "/");
    }
  }, []);

  const notifyXpGain = useCallback(
    (
      nextUpvoteCount: number,
      nextReportCount: number,
      nextExtras: CitizenXpExtras,
      actionTitle: string,
      actionMessage: string,
      actionIcon: string
    ) => {
      const nextStats = calculateCitizenStats(nextUpvoteCount, nextReportCount, nextExtras);
      if (nextStats.level > citizenStats.level) {
        showMascotToast(
          `เลื่อนระดับสู่ Lv.${nextStats.level}!`,
          `${nextStats.title} · คะแนนสะสม ${nextStats.currentXp} XP`,
          "/images/mascot_success.png"
        );
      } else {
        showMascotToast(actionTitle, actionMessage, actionIcon);
      }
    },
    [citizenStats.level, showMascotToast]
  );

  // Derive active detail / selected complaint from ID & URL deep-link
  const activeUrlComplaintId = dismissedUrlComplaint ? null : urlComplaintId;
  const effectiveDetailId = detailComplaintId ?? activeUrlComplaintId;
  const detailComplaint = useMemo(
    () => (effectiveDetailId ? complaints.find((c) => c.id === effectiveDetailId) ?? null : null),
    [complaints, effectiveDetailId]
  );
  const selectedComplaint = useMemo(() => {
    const id = selectedComplaintId ?? activeUrlComplaintId;
    return id ? complaints.find((c) => c.id === id) ?? null : null;
  }, [complaints, selectedComplaintId, activeUrlComplaintId]);

  const effectiveTargetCity = useMemo<CityViewport | null>(() => {
    if (targetCity) return targetCity;
    if (activeUrlComplaintId && detailComplaint) {
      return {
        id: detailComplaint.id,
        name: detailComplaint.title,
        country: "",
        center: detailComplaint.coordinates,
        zoom: 15,
      };
    }
    return null;
  }, [targetCity, activeUrlComplaintId, detailComplaint]);

  // Handler for Civic Poll Voting
  const handleVotePoll = (pollId: string, choice: "agree" | "disagree") => {
    const prevChoice = userPollVotes[pollId];

    if (prevChoice === choice) {
      const nextVotes = { ...userPollVotes };
      delete nextVotes[pollId];
      persistPollVotes(nextVotes);

      persistPolls(
        civicPolls.map((p) => {
          if (p.id !== pollId) return p;
          const agreeCount = choice === "agree" ? Math.max(0, p.agreeCount - 1) : p.agreeCount;
          const disagreeCount = choice === "disagree" ? Math.max(0, p.disagreeCount - 1) : p.disagreeCount;
          return { ...p, agreeCount, disagreeCount, totalVotes: Math.max(0, p.totalVotes - 1) };
        })
      );
      return;
    }

    const nextVotes = { ...userPollVotes, [pollId]: choice };
    persistPollVotes(nextVotes);

    persistPolls(
      civicPolls.map((p) => {
        if (p.id !== pollId) return p;
        let agreeCount = p.agreeCount;
        let disagreeCount = p.disagreeCount;
        let totalVotes = p.totalVotes;

        if (prevChoice === "agree") agreeCount = Math.max(0, agreeCount - 1);
        if (prevChoice === "disagree") disagreeCount = Math.max(0, disagreeCount - 1);

        if (choice === "agree") agreeCount += 1;
        if (choice === "disagree") disagreeCount += 1;
        if (!prevChoice) totalVotes += 1;

        return { ...p, agreeCount, disagreeCount, totalVotes };
      })
    );

    notifyXpGain(
      upvotedIds.size,
      myReportIds.size,
      { ...citizenXpExtras, pollVoteCount: Object.keys(nextVotes).length },
      "บันทึกเสียงโหวตของคุณเรียบร้อย!",
      `ขอบคุณที่ร่วมเป็นพลังขับเคลื่อนข้อเสนอพัฒนาเมือง (+${CITIZEN_XP_REWARDS.POLL_VOTE} XP)`,
      "/images/mascot_success.png"
    );
  };

  // Handler for selecting an emergency point from SOS modal
  const handleSelectEmergencyPoint = (point: EmergencyPoint) => {
    setActiveLayer("emergency");
    setTargetCity({
      id: point.id,
      name: point.name,
      country: "",
      center: point.coordinates,
      zoom: 15,
    });
  };

  const handleToggleTheme = () => {
    toggleThemeStore(!isDark, currentStyle);
  };

  const handleSelectStyle = (style: MapStyleKey) => {
    writeMapStyleStore(style);
  };

  // Upvote toggle handler
  const handleToggleUpvote = (id: string) => {
    const isCurrentlyUpvoted = upvotedIds.has(id);
    const nextUpvoted = new Set(upvotedIds);
    const target = complaints.find((c) => c.id === id);
    const isNewResolvedImpact =
      target?.status === "resolved" && !myReportIds.has(id);

    if (isCurrentlyUpvoted) {
      nextUpvoted.delete(id);
      persistComplaints(
        complaints.map((c) => (c.id === id ? { ...c, upvotes: Math.max(0, (c.upvotes ?? 0) - 1) } : c))
      );
      persistUpvotes(nextUpvoted);
      return;
    }

    nextUpvoted.add(id);
    persistComplaints(
      complaints.map((c) => (c.id === id ? { ...c, upvotes: (c.upvotes ?? 0) + 1 } : c))
    );
    persistUpvotes(nextUpvoted);

    const nextResolvedImpact =
      (citizenXpExtras.resolvedImpactCount ?? 0) + (isNewResolvedImpact ? 1 : 0);
    notifyXpGain(
      nextUpvoted.size,
      myReportIds.size,
      { ...citizenXpExtras, resolvedImpactCount: nextResolvedImpact },
      "ร่วมโหวตสำเร็จ!",
      `เสียงของคุณจะช่วยผลักดันให้หน่วยงานเร่งแก้ไขโดยเร็ว (+${CITIZEN_XP_REWARDS.UPVOTE} XP)`,
      "/images/mascot_success.png"
    );
  };

  // Add Citizen Comment handler
  const handleAddComment = (complaintId: string, author: string, text: string) => {
    const now = new Date();
    const newComment: ComplaintComment = {
      id: `cmt-${Date.now()}`,
      author,
      text,
      role: "citizen",
      createdAt: `${now.toLocaleDateString("th-TH", { day: "numeric", month: "short" })} ${now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`,
    };
    persistComplaints(
      complaints.map((c) =>
        c.id === complaintId ? { ...c, comments: [...(c.comments ?? []), newComment] } : c
      )
    );
    const nextComments = [...myCommentsArray, newComment.id];
    persistMyComments(nextComments);

    notifyXpGain(
      upvotedIds.size,
      myReportIds.size,
      { ...citizenXpExtras, commentCount: nextComments.length },
      "ส่งความคิดเห็นแล้ว",
      `ขอบคุณที่ร่วมติดตามและให้ข้อมูลเพิ่มเติมกับชุมชน (+${CITIZEN_XP_REWARDS.COMMENT} XP)`,
      "/images/mascot.png"
    );
  };

  // Open report form: if no pending coord, switch to report mode first
  const handleOpenReportForm = () => {
    if (!pendingCoord) {
      setIsReportMode(true);
      setIsFormOpen(false);
    } else {
      setIsFormOpen(true);
    }
  };

  // When user clicks on map in report mode, we get a coord
  const handleSetPendingCoord = (coord: [number, number] | null) => {
    setPendingCoord(coord);
    if (coord) {
      setIsReportMode(false);
      clearReportQueryParam();
      setIsFormOpen(true);
    }
  };

  // User wants to pick a new location from within the form
  const handleRequestNewLocation = () => {
    setIsFormOpen(false);
    setIsReportMode(true);
    setPendingCoord(null);
  };

  const handleToggleReportMode = () => {
    if (effectiveReportMode) {
      setIsReportMode(false);
      clearReportQueryParam();
    } else {
      setIsFormOpen(false);
      setPendingCoord(null);
      setIsReportMode(true);
    }
  };

  const lastReportAttempt = useRef<{ payload: string; id: string } | null>(null);
  const handleSubmitComplaint = async (
    data: Omit<ComplaintReport, "id" | "createdAt" | "status">
  ) => {
    const payload = JSON.stringify({ ...data, timeline: undefined });
    const newId = lastReportAttempt.current?.payload === payload
      ? lastReportAttempt.current.id : crypto.randomUUID();
    lastReportAttempt.current = { payload, id: newId };
    const newComplaint: ComplaintReport = {
      ...data,
      id: newId,
      status: "pending",
      upvotes: 1,
      comments: [],
      createdAt: new Date().toLocaleDateString("th-TH", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    };
    const response = await fetch("/api/reports", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newComplaint),
    }).catch(() => null);
    if (!response?.ok) {
      const error = await response?.json().catch(() => null);
      showMascotToast(error?.error || "ส่งข้อมูลไม่สำเร็จ กรุณาลองใหม่");
      return false;
    }
    lastReportAttempt.current = null;
    persistComplaints([newComplaint, ...getComplaintsSnapshot()]);

    const nextUpvoted = new Set(upvotedIds);
    nextUpvoted.add(newId);
    persistUpvotes(nextUpvoted);

    const nextReports = [...myReportsArray, newId];
    persistMyReports(nextReports);

    setPendingCoord(null);
    setIsFormOpen(false);
    setIsReportMode(false);
    clearReportQueryParam();

    const earnedXp =
      CITIZEN_XP_REWARDS.REPORT +
      CITIZEN_XP_REWARDS.UPVOTE +
      (data.imageBase64 ? CITIZEN_XP_REWARDS.PHOTO_BONUS : 0);
    const nextPhotoCount = photoReportCount + (data.imageBase64 ? 1 : 0);

    notifyXpGain(
      nextUpvoted.size,
      nextReports.length,
      { ...citizenXpExtras, photoReportCount: nextPhotoCount },
      data.isAnonymous ? "ส่งเรื่องแบบไม่ระบุตัวตนสำเร็จ!" : "ส่งเรื่องร้องเรียนสำเร็จ!",
      data.isAnonymous
        ? `ระบบบันทึกพิกัดโดยไม่เปิดเผยชื่อและเบอร์ติดต่อเรียบร้อย (+${earnedXp} XP)`
        : `น้องอินสเปกเตอร์บันทึกพิกัดและส่งต่อข้อมูลเรียบร้อย (+${earnedXp} XP)`,
      "/images/mascot_camera.png"
    );

    handleSelectTargetCity({
      id: newComplaint.id,
      name: newComplaint.title,
      country: "",
      center: newComplaint.coordinates,
      zoom: 15,
    });
    setTimeout(() => setSelectedComplaintId(newComplaint.id), 500);
  };

  const handleDeleteComplaint = (id: string) => {
    persistComplaints(complaints.filter((c) => c.id !== id));
    if (selectedComplaintId === id) setSelectedComplaintId(null);
    if (detailComplaintId === id) setDetailComplaintId(null);
  };

  const handleSelectComplaint = (complaint: ComplaintReport | null) => {
    if (!complaint) {
      setSelectedComplaintId(null);
      return;
    }
    setSelectedComplaintId(complaint.id);
    handleSelectTargetCity({
      id: complaint.id,
      name: complaint.title,
      country: "",
      center: complaint.coordinates,
      zoom: 15,
    });
  };

  const handleOpenDetail = (complaint: ComplaintReport) => {
    setDismissedUrlComplaint(false);
    setDetailComplaintId(complaint.id);
  };

  const handleCloseDetail = () => {
    setDetailComplaintId(null);
    setDismissedUrlComplaint(true);
    if (typeof window !== "undefined" && window.location.search.includes("complaint=")) {
      window.history.replaceState({}, "", "/");
    }
  };

  const handleShareComplaint = (complaint: ComplaintReport) => {
    setShareComplaint(complaint);
  };

  const pendingCount = complaints.filter((c) => c.status === "pending").length;

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-slate-950">
      {/* Map Canvas (base layer) */}
      <div className="absolute inset-0 w-full h-full z-0">
        <MapBoundary fallback={
          <MapFallback
            onChooseCoordinates={handleSetPendingCoord}
            onOpenGpsForm={() => {
              setPendingCoord(null);
              setIsReportMode(false);
              clearReportQueryParam();
              setIsFormOpen(true);
            }}
          />
        }>
          <MapContainer
            currentStyle={currentStyle}
            isDark={isDark}
            complaints={complaints}
            selectedComplaint={selectedComplaint}
            onSelectComplaint={handleSelectComplaint}
            isReportMode={effectiveReportMode}
            pendingCoord={pendingCoord}
            onSetPendingCoord={handleSetPendingCoord}
            targetCity={effectiveTargetCity}
            onOpenDetail={handleOpenDetail}
            upvotedIds={upvotedIds}
            onToggleUpvote={handleToggleUpvote}
            onShareComplaint={handleShareComplaint}
            activeLayer={activeLayer}
            onChangeLayer={setActiveLayer}
            civicPolls={civicPolls}
            onVotePoll={handleVotePoll}
            userPollVotes={userPollVotes}
            onOpenSosModal={(coordinates) => {
              setSosSearchCoord(coordinates);
              setIsSosModalOpen(true);
            }}
            onSelectProvince={handleSelectMapProvince}
            onSelectDistrict={handleSelectMapDistrict}
            onSelectTambon={handleSelectMapTambon}
          />
        </MapBoundary>
      </div>

      {/* Header */}
      <MapHeader
        isReportMode={effectiveReportMode}
        onToggleReportMode={handleToggleReportMode}
        currentStyle={currentStyle}
        onSelectStyle={handleSelectStyle}
        isDark={isDark}
        onToggleTheme={handleToggleTheme}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onSelectCity={handleSelectTargetCity}
        onOpenReportForm={handleOpenReportForm}
        pendingCount={pendingCount}
        onOpenCitizenHub={() => router.push("/citizen")}
        userUpvoteCount={upvotedIds.size}
        userReportCount={myReportIds.size}
        citizenXpExtras={citizenXpExtras}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        citizenMember={citizenMember}
        onOpenCitizenAuth={openCitizenAuth}
      />

      {/* Complaint Sidebar */}
      <ComplaintSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        complaints={complaints}
        selectedComplaint={selectedComplaint}
        onSelectComplaint={handleSelectComplaint}
        onDeleteComplaint={handleDeleteComplaint}
        onOpenForm={handleOpenReportForm}
        onOpenDetail={handleOpenDetail}
        upvotedIds={upvotedIds}
        onToggleUpvote={handleToggleUpvote}
        onShareComplaint={handleShareComplaint}
      />

      {/* Complaint Detail Offcanvas */}
      <ComplaintDetailOffcanvas
        complaint={detailComplaint}
        isOpen={Boolean(detailComplaint)}
        onClose={handleCloseDetail}
        isUpvoted={detailComplaint ? upvotedIds.has(detailComplaint.id) : false}
        onToggleUpvote={handleToggleUpvote}
        onShare={handleShareComplaint}
        onAddComment={handleAddComment}
        citizenMember={citizenMember}
      />

      {/* Complaint Form Modal */}
      <ComplaintForm
        isOpen={isFormOpen}
        pendingCoord={pendingCoord}
        onSubmit={handleSubmitComplaint}
        onCancel={() => {
          setIsFormOpen(false);
          setPendingCoord(null);
          setIsReportMode(false);
          clearReportQueryParam();
        }}
        onRequestNewLocation={handleRequestNewLocation}
        onSetPendingCoord={(coord) => setPendingCoord(coord)}
        citizenMember={citizenMember}
        onOpenCitizenAuth={openCitizenAuth}
      />

      {/* Live Weather Widget (Compact Pill -> Expandable Open-Meteo Card) */}
      <div className="fixed bottom-20 sm:bottom-[74px] right-3 sm:right-4 z-20 pointer-events-auto max-w-[calc(100vw-24px)]">
        <WeatherCard
          currentCity={
            clickedTambonCity ?? clickedDistrictCity ?? clickedProvinceCity ?? effectiveTargetCity
          }
          defaultMinimized={true}
        />
      </div>

      {/* Interactive Floating Mascot Widget */}
      <FloatingMascotWidget
        onOpenCitizenHub={() => router.push("/citizen")}
        onOpenReportForm={handleOpenReportForm}
        userUpvoteCount={upvotedIds.size}
        userReportCount={myReportIds.size}
        citizenXpExtras={citizenXpExtras}
        isSidebarOpen={isSidebarOpen}
      />

      {/* Mobile App Bottom Navigation Dock */}
      <MobileBottomBar
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenReportForm={handleOpenReportForm}
        onOpenSosModal={() => setIsSosModalOpen(true)}
        onOpenCitizenHub={() => router.push("/citizen")}
        pendingCount={pendingCount}
        userUpvoteCount={upvotedIds.size}
        userReportCount={myReportIds.size}
        citizenXpExtras={citizenXpExtras}
        isReportMode={effectiveReportMode}
        onToggleReportMode={handleToggleReportMode}
        activeLayer={activeLayer}
        citizenMember={citizenMember}
      />

      {/* Citizen Member Login / Registration Modal */}
      <CitizenAuthModal
        isOpen={citizenAuthOpen}
        initialTab={citizenAuthTab}
        onClose={() => setCitizenAuthOpen(false)}
        onAuthSuccess={(member, mode) =>
          showMascotToast(
            mode === "register"
              ? `สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${member.displayName}`
              : `เข้าสู่ระบบสมาชิกแล้ว สวัสดีคุณ ${member.displayName}`,
            `พื้นที่ประจำ: จ.${member.homeProvince} · ระบบพร้อมกรอกชื่อผู้แจ้งอัตโนมัติ`,
            member.avatarPose
          )
        }
      />

      {/* Social & LINE Share Card Modal */}
      <ShareCardModal
        complaint={shareComplaint}
        isOpen={!!shareComplaint}
        onClose={() => setShareComplaint(null)}
      />

      {/* Emergency SOS Hub Modal */}
      <EmergencySosModal
        isOpen={isSosModalOpen}
        onClose={() => { setIsSosModalOpen(false); setSosSearchCoord(undefined); }}
        currentCoord={
          sosSearchCoord ?? pendingCoord ?? (effectiveTargetCity ? effectiveTargetCity.center : [100.5018, 13.7563])
        }
        onSelectEmergencyPoint={handleSelectEmergencyPoint}
      />

      {/* Mascot Toast Notification Feedback */}
      {toastNotification && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="flex items-center gap-3 px-4 sm:px-5 py-3 rounded-2xl bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border border-white/30 dark:border-white/10 shadow-2xl">
            <div className="relative w-11 h-11 flex-shrink-0 -my-1">
              <img
                src={toastNotification.pose}
                alt="Mascot Celebration"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white leading-tight">
                {toastNotification.text}
              </p>
              {toastNotification.subText && (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                  {toastNotification.subText}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
