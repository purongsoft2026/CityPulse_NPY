"use client";

import React from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import { calculateCitizenStats, type CitizenXpExtras } from "@/data/map-data";
import { type CitizenMember } from "@/lib/citizen-auth";

interface MobileBottomBarProps {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
  onOpenReportForm: () => void;
  onOpenSosModal: () => void;
  onOpenCitizenHub: () => void;
  pendingCount: number;
  userUpvoteCount: number;
  userReportCount?: number;
  citizenXpExtras?: CitizenXpExtras;
  isReportMode: boolean;
  onToggleReportMode: () => void;
  activeLayer: string;
  citizenMember?: CitizenMember | null;
}

export function MobileBottomBar({
  isSidebarOpen,
  onToggleSidebar,
  onOpenReportForm,
  onOpenSosModal,
  onOpenCitizenHub,
  pendingCount,
  userUpvoteCount,
  userReportCount = 0,
  citizenXpExtras,
  isReportMode,
  onToggleReportMode,
  citizenMember,
}: MobileBottomBarProps) {
  const { level: userLevel } = calculateCitizenStats(
    userUpvoteCount,
    userReportCount,
    citizenXpExtras
  );

  return (
    <nav
      aria-label="Mobile Navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-35 pointer-events-auto select-none pb-[env(safe-area-inset-bottom)]"
    >
      {/* Glassmorphic Container */}
      <div className="mx-2 mb-2 rounded-[28px] bg-white/92 dark:bg-slate-900/92 backdrop-blur-2xl border border-slate-200/70 dark:border-white/10 shadow-2xl shadow-black/25 px-2 py-1.5 flex items-center justify-around relative">
        {/* Tab 1: Explore Map */}
        <button
          type="button"
          onClick={() => {
            if (isSidebarOpen) onToggleSidebar();
            if (isReportMode) onToggleReportMode();
          }}
          aria-current={!isSidebarOpen && !isReportMode ? "page" : undefined}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-2xl transition cursor-pointer active:scale-95 ${
            !isSidebarOpen && !isReportMode
              ? "text-teal-600 dark:text-cyan-400 font-black"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
          }`}
        >
          <JKIcon name="map" className="text-base mb-0.5" />
          <span className="text-[10px] tracking-tight">แผนที่</span>
        </button>

        {/* Tab 2: Complaint List Sheet */}
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-expanded={isSidebarOpen}
          className={`flex flex-col items-center justify-center flex-1 py-1.5 rounded-2xl relative transition cursor-pointer active:scale-95 ${
            isSidebarOpen
              ? "text-teal-600 dark:text-cyan-400 font-black"
              : "text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-semibold"
          }`}
        >
          <div className="relative">
            <JKIcon name="list-check" className="text-base mb-0.5" />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-2 min-w-[15px] h-[15px] px-1 rounded-full bg-red-500 text-white text-[8px] font-black flex items-center justify-center shadow-sm">
                {pendingCount}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight">รายการเคส</span>
        </button>

        {/* Tab 3: Center Primary Action (Elevated Floating Action Button) */}
        <div className="flex-1 flex items-center justify-center -mt-6">
          <button
            type="button"
            onClick={() => {
              if (isSidebarOpen) onToggleSidebar();
              if (isReportMode) {
                onToggleReportMode();
              } else {
                onOpenReportForm();
              }
            }}
            className={`w-14 h-14 rounded-full flex flex-col items-center justify-center text-white cursor-pointer
              border-2 border-white dark:border-slate-900
              active:scale-90 hover:scale-105 transition-all shadow-lg ${
                isReportMode
                  ? "bg-gradient-to-tr from-slate-700 to-slate-900 shadow-slate-900/40 ring-2 ring-red-500 animate-pulse"
                  : "bg-gradient-to-tr from-red-500 via-rose-500 to-orange-500 shadow-red-500/40"
              }`}
            title={isReportMode ? "ยกเลิกการเลือกพิกัด" : "แจ้งเรื่องร้องเรียนใหม่"}
          >
            <JKIcon name={isReportMode ? "xmark" : "plus"} className="text-lg" />
            <span className="text-[8px] font-black tracking-tighter leading-none mt-0.5">
              {isReportMode ? "ยกเลิก" : "แจ้งเหตุ"}
            </span>
          </button>
        </div>

        {/* Tab 4: Emergency SOS Hub */}
        <button
          type="button"
          onClick={() => {
            if (isSidebarOpen) onToggleSidebar();
            onOpenSosModal();
          }}
          className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-2xl text-rose-500 dark:text-rose-400 font-bold hover:text-rose-600 transition cursor-pointer active:scale-95"
        >
          <div className="relative">
            <JKIcon name="truck-medical" className="text-base mb-0.5" />
          </div>
          <span className="text-[10px] tracking-tight">SOS ฉุกเฉิน</span>
        </button>

        {/* Tab 5: Citizen Hub / Mascot */}
        <button
          type="button"
          onClick={() => {
            if (isSidebarOpen) onToggleSidebar();
            onOpenCitizenHub();
          }}
          className="flex flex-col items-center justify-center flex-1 py-1.5 rounded-2xl text-amber-600 dark:text-amber-400 font-bold hover:text-amber-700 transition cursor-pointer active:scale-95"
        >
          <div className="relative w-6 h-6 rounded-full flex-shrink-0 bg-amber-400/20 border border-amber-400/40 flex items-center justify-center p-0.5 mb-0.5">
            <img
              src={citizenMember?.avatarPose || "/images/mascot.png"}
              alt="Mascot Icon"
              className="w-full h-full object-contain"
            />
            {citizenMember && (
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-slate-900" />
            )}
          </div>
          <span className="text-[10px] tracking-tight truncate max-w-[68px]">
            {citizenMember ? citizenMember.displayName : `Lv.${userLevel} สมาชิก`}
          </span>
        </button>
      </div>
    </nav>
  );
}
