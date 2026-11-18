"use client";

import React, { useState, useEffect } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import { calculateCitizenStats, type CitizenXpExtras } from "@/data/map-data";

interface FloatingMascotWidgetProps {
  onOpenCitizenHub: () => void;
  onOpenReportForm: () => void;
  userUpvoteCount: number;
  userReportCount?: number;
  citizenXpExtras?: CitizenXpExtras;
  isSidebarOpen?: boolean;
}

const MASCOT_TIPS = [
  {
    title: "พลังเสียงชุมชน",
    message: "กด +1 ให้ปัญหาที่สำคัญ ช่วยดันให้หน่วยงานรับเรื่องได้ไวขึ้น!",
    icon: "thumbs-up",
    pose: "/images/mascot.png",
  },
  {
    title: "ภาพถ่ายหลักฐาน",
    message: "แนบรูปที่เห็นจุดเกิดเหตุชัดเจน จะช่วยให้ทีมช่างนำอุปกรณ์มาถูกจุด",
    icon: "camera",
    pose: "/images/mascot_camera.png",
  },
  {
    title: "ตรวจตราเชิงรุก",
    message: "กำลังค้นหาจุดเสี่ยงในละแวกนี้? ซูมและคลิกดูรายงานใกล้เคียงได้เลย",
    icon: "magnifying-glass",
    pose: "/images/mascot_searching.png",
  },
  {
    title: "สะสมแต้มพลเมือง",
    message: "แตะตัวน้องเพื่อดูแต้มสะสม เหรียญเกียรติยศ และภารกิจประจำวัน",
    icon: "award",
    pose: "/images/mascot_success.png",
  },
];

export function FloatingMascotWidget({
  onOpenCitizenHub,
  onOpenReportForm,
  userUpvoteCount,
  userReportCount = 0,
  citizenXpExtras,
  isSidebarOpen = false,
}: FloatingMascotWidgetProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const [isBubbleVisible, setIsBubbleVisible] = useState(true);
  const [isHovered, setIsHovered] = useState(false);

  // Auto-cycle speech tips every 9 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setTipIndex((prev) => (prev + 1) % MASCOT_TIPS.length);
    }, 9000);
    return () => clearInterval(timer);
  }, []);

  const currentTip = MASCOT_TIPS[tipIndex];
  const { level } = calculateCitizenStats(userUpvoteCount, userReportCount, citizenXpExtras);

  return (
    <div
      className={`fixed bottom-20 sm:bottom-3.5 left-3 z-20 pointer-events-auto flex items-end gap-2.5 transition-all duration-300 ${
        isSidebarOpen ? "sm:left-[396px]" : "sm:left-4"
      }`}
    >
      {/* Interactive Speech Bubble */}
      {isBubbleVisible && (
        <div className="hidden sm:block relative mb-2 max-w-[240px] sm:max-w-[280px] p-3 rounded-2xl weather-glass-card border border-white/40 shadow-2xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
          <button
            onClick={() => setIsBubbleVisible(false)}
            aria-label="ปิดกล่องข้อความ"
            className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white transition cursor-pointer"
          >
            <JKIcon name="xmark" className="text-[10px]" />
          </button>

          <div className="flex items-center gap-1.5 text-xs font-black text-slate-900 dark:text-white mb-1">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-ping" />
            <JKIcon name={currentTip.icon} className="text-orange-500 text-[11px]" />
            <span>{currentTip.title}</span>
          </div>

          <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {currentTip.message}
          </p>

          <div className="mt-2.5 pt-2 border-t border-slate-200/50 dark:border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <button
                onClick={onOpenCitizenHub}
                className="text-[10px] font-black text-teal-600 dark:text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>เปิดศูนย์พลเมือง</span>
                <JKIcon name="chevron-right" className="text-[8px]" />
              </button>
              <button
                onClick={onOpenReportForm}
                className="text-[10px] font-black text-rose-500 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <JKIcon name="plus" className="text-[8px]" />
                <span>แจ้งเหตุ</span>
              </button>
            </div>
            <span className="text-[9px] font-mono text-slate-400">
              {tipIndex + 1}/{MASCOT_TIPS.length}
            </span>
          </div>

          {/* Speech bubble arrow pointing right towards mascot */}
          <div className="absolute -right-2 bottom-3 w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[8px] border-l-white/60 dark:border-l-slate-800/80" />
        </div>
      )}

      {/* Mascot Interactive Avatar */}
      <div
        className="relative group cursor-pointer"
        onClick={onOpenCitizenHub}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        title="คลิกเพื่อดูแต้มพลเมืองและภารกิจ"
      >
        {/* Glow behind mascot */}
        <div className="absolute inset-0 bg-gradient-to-tr from-amber-400/40 to-orange-500/40 rounded-full blur-xl scale-75 group-hover:scale-110 transition-transform duration-300" />

        {/* Mascot Image with bounce and hover effect */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1">
          <img
            src={isHovered ? "/images/mascot_success.png" : currentTip.pose}
            alt="MapCN City Inspector Mascot"
            className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.35)]"
          />

          {/* Mini Badge / Status Pill */}
          <span className="absolute -top-1 -right-1 px-1.5 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-500 text-white font-black text-[9px] shadow-md border border-white flex items-center gap-0.5">
            <JKIcon name="star" className="text-[7px]" />
            Lv.{level}
          </span>
        </div>

        {/* Quick Bubble Toggle if closed */}
        {!isBubbleVisible && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsBubbleVisible(true);
            }}
            className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 shadow-lg flex items-center justify-center text-[10px] hover:scale-110 transition cursor-pointer"
            title="เปิดข้อความแนะนำ"
          >
            <JKIcon name="comment-dots" />
          </button>
        )}
      </div>
    </div>
  );
}
