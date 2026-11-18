"use client";

import React, { useState, useEffect, useCallback } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  inferProvinceFromCoord,
  type ComplaintReport,
  type ComplaintStatus,
} from "@/data/map-data";

interface ShareCardModalProps {
  complaint: ComplaintReport | null;
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_LABELS: Record<ComplaintStatus, { label: string; color: string; bg: string }> = {
  pending: { label: "รอดำเนินการ", color: "#f59e0b", bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  inprogress: { label: "กำลังแก้ไข", color: "#3b82f6", bg: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  resolved: { label: "แก้ไขแล้ว", color: "#22c55e", bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
};

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number
) {
  const chars = Array.from(text);
  let line = "";
  let lineCount = 0;
  for (let i = 0; i < chars.length; i++) {
    const testLine = line + chars[i];
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lineCount++;
      if (lineCount >= maxLines) {
        ctx.fillText(line.slice(0, -1) + "…", x, y);
        return;
      }
      ctx.fillText(line, x, y);
      line = chars[i];
      y += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

export function ShareCardModal({ complaint, isOpen, onClose }: ShareCardModalProps) {
  const [hasCopied, setHasCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const handleDownloadCardPng = useCallback(async () => {
    if (!complaint) return;
    setIsDownloading(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1080;
      canvas.height = 640;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const grad = ctx.createLinearGradient(0, 0, 1080, 640);
      grad.addColorStop(0, "#0f172a");
      grad.addColorStop(0.55, "#1e293b");
      grad.addColorStop(1, "#020617");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 1080, 640);

      // Decorative accent glow
      ctx.fillStyle = "rgba(6, 182, 212, 0.14)";
      ctx.beginPath();
      ctx.arc(930, 110, 190, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(249, 115, 22, 0.12)";
      ctx.beginPath();
      ctx.arc(130, 560, 160, 0, Math.PI * 2);
      ctx.fill();

      const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
      const statusCfg = STATUS_LABELS[complaint.status];
      await document.fonts.ready;
      const appFont = getComputedStyle(document.body).fontFamily || '"Outfit", "Prompt", sans-serif';

      // Header pills
      ctx.fillStyle = "rgba(6, 182, 212, 0.2)";
      ctx.fillRect(56, 48, 240, 40);
      ctx.fillStyle = "#67e8f9";
      ctx.font = `600 20px ${appFont}`;
      ctx.fillText("MapCN Civic Pulse", 76, 75);

      ctx.fillStyle = statusCfg.color;
      ctx.fillRect(312, 48, 175, 40);
      ctx.fillStyle = "#ffffff";
      ctx.fillText(statusCfg.label, 336, 75);

      ctx.fillStyle = "#94a3b8";
      ctx.font = `400 18px ${appFont}`;
      ctx.fillText(`#${complaint.id.slice(-8)} · ${complaint.createdAt}`, 56, 128);

      // Category tag
      ctx.fillStyle = cat?.color ?? "#64748b";
      ctx.fillRect(56, 152, 240, 36);
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 18px ${appFont}`;
      ctx.fillText(cat?.label ?? "ร้องเรียนทั่วไป", 74, 177);

      // Title & description
      ctx.fillStyle = "#ffffff";
      ctx.font = `600 36px ${appFont}`;
      drawWrappedText(ctx, complaint.title, 56, 242, 650, 48, 2);

      ctx.fillStyle = "#cbd5e1";
      ctx.font = `400 22px ${appFont}`;
      drawWrappedText(ctx, complaint.description, 56, 355, 650, 34, 4);

      // Footer meta
      ctx.fillStyle = "#94a3b8";
      ctx.font = `400 20px ${appFont}`;
      ctx.fillText(
        `พิกัด: ${complaint.coordinates[1].toFixed(4)}°N, ${complaint.coordinates[0].toFixed(4)}°E  |  จ.${complaint.province ?? inferProvinceFromCoord(complaint.coordinates)}${complaint.district ? ` (${complaint.district})` : ""}`,
        56,
        545
      );
      ctx.fillStyle = "#fb923c";
      ctx.font = `600 22px ${appFont}`;
      ctx.fillText(`เสียงสนับสนุน ${complaint.upvotes ?? 0} คน`, 56, 588);

      // Draw local mascot image (same-origin) on right side
      try {
        const img = new Image();
        img.crossOrigin = "anonymous";
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = "/images/mascot_camera.png";
        });
        ctx.drawImage(img, 760, 185, 255, 255);
      } catch {
        // Ignore image draw failure if unavailable
      }

      const dataUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `complaint-${complaint.id.slice(-8)}.png`;
      a.click();
    } finally {
      setIsDownloading(false);
    }
  }, [complaint]);

  if (!isOpen || !complaint) return null;

  const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
  const statusCfg = STATUS_LABELS[complaint.status];
  const shareUrl = typeof window !== "undefined" ? window.location.origin + "/?complaint=" + complaint.id : "https://mapcn.app";
  const shareText = `[เรื่องร้องเรียนเมือง] "${complaint.title}"\nพิกัด: ${complaint.coordinates[1].toFixed(4)}°, ${complaint.coordinates[0].toFixed(4)}°\nสถานะ: ${statusCfg.label} (มีผู้ร่วมโหวต ${complaint.upvotes ?? 0} คน)\nช่วยกันส่งเสียงและติดตามความคืบหน้าที่: ${shareUrl} #เสียงประชาชน #ปัญหาเมือง`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setHasCopied(true);
      setTimeout(() => setHasCopied(false), 2200);
    } catch {
      // ignore
    }
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: complaint.title,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // User cancelled share sheet
      }
    }
  };

  const handleShareLine = () => {
    const url = `https://social-plugins.line.me/lineit/share?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleShareFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-3 border-b border-slate-100 dark:border-white/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-blue-500 flex items-center justify-center text-white shadow-md">
              <JKIcon name="share-nodes" className="text-sm" />
            </div>
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white">แชร์เรื่องร้องเรียน</h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">สร้างการ์ดเพื่อกระจายข่าวสารและดึงดูดพลังชุมชน</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition cursor-pointer"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>
        </div>

        {/* Share Card Preview */}
        <div className="p-5 overflow-y-auto space-y-4">
          <div className="relative rounded-3xl p-5 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white shadow-xl border border-white/15 overflow-hidden">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-36 h-36 bg-orange-500/15 rounded-full blur-3xl pointer-events-none" />

            {/* Top Bar of Card */}
            <div className="relative z-10 flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  <JKIcon name="map-pin" className="text-[9px]" />
                  MapCN Inspector
                </span>
                <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusCfg.bg}`}>
                  {statusCfg.label}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">{complaint.createdAt}</span>
            </div>

            {/* Card Content & Mascot */}
            <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-3 my-4 items-center">
              <div className="sm:col-span-2 space-y-2">
                <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs" style={{ backgroundColor: cat?.color }}>
                  <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[9px]" />
                  {cat?.label}
                </div>
                <h4 className="text-base font-black text-white leading-snug drop-shadow-sm">
                  {complaint.title}
                </h4>
                <p className="text-xs text-slate-300 line-clamp-3 leading-relaxed">
                  {complaint.description}
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-400">
                  <JKIcon name="location-dot" className="text-red-400" />
                  <span>พิกัด: {complaint.coordinates[1].toFixed(4)}°N, {complaint.coordinates[0].toFixed(4)}°E</span>
                </div>
              </div>

              {/* Mascot Highlight */}
              <div className="sm:col-span-1 flex flex-col items-center justify-center relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 relative">
                  <img
                    src="/images/mascot_camera.png"
                    alt="Inspector Reporter Mascot"
                    className="w-full h-full object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)] animate-bounce"
                    style={{ animationDuration: "3s" }}
                  />
                </div>
                <div className="mt-1 px-2.5 py-1 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 text-[10px] font-black flex items-center gap-1">
                  <JKIcon name="fire" className="text-orange-400 animate-pulse" />
                  {complaint.upvotes ?? 0} คนร่วมโหวต
                </div>
              </div>
            </div>

            {/* Bottom Proof Image or Footer */}
            {complaint.imageBase64 && (
              <div className="relative z-10 mt-3 rounded-2xl overflow-hidden h-32 border border-white/10 shadow-inner">
                <img
                  src={complaint.imageBase64}
                  alt={complaint.title}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent flex items-end p-2.5">
                  <span className="text-[10px] text-white/90 font-medium flex items-center gap-1">
                    <JKIcon name="camera" className="text-xs text-cyan-300" />
                    ภาพถ่ายหลักฐานจุดเกิดเหตุ
                  </span>
                </div>
              </div>
            )}

            {/* Card Watermark */}
            <div className="relative z-10 pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
              <span className="flex items-center gap-1 font-semibold text-cyan-300">
                <JKIcon name="bullhorn" />
                ช่วยกันแชร์เพื่อผลักดันให้หน่วยงานแก้ไขโดยเร็ว
              </span>
              <span className="font-mono text-slate-500">#MapCNCommunity</span>
            </div>
          </div>

          {/* Social Share Buttons */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">แชร์ไปยังเครือข่ายสังคม:</p>
            <div className="grid grid-cols-3 gap-2.5">
              {/* LINE Button */}
              <button
                onClick={handleShareLine}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#06C755] hover:bg-[#05b34c] text-white text-xs font-black shadow-md shadow-[#06C755]/25 active:scale-[0.98] transition cursor-pointer"
              >
                <JKIcon name="line" type="brands" className="text-base" />
                <span>LINE</span>
              </button>

              {/* X / Twitter Button */}
              <button
                onClick={handleShareTwitter}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-black dark:bg-slate-800 hover:bg-slate-800 dark:hover:bg-slate-700 text-white text-xs font-black shadow-md active:scale-[0.98] transition cursor-pointer"
              >
                <JKIcon name="x-twitter" type="brands" className="text-base" />
                <span>X (Twitter)</span>
              </button>

              {/* Facebook Button */}
              <button
                onClick={handleShareFacebook}
                className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-2xl bg-[#1877F2] hover:bg-[#166fe5] text-white text-xs font-black shadow-md shadow-[#1877F2]/25 active:scale-[0.98] transition cursor-pointer"
              >
                <JKIcon name="facebook" type="brands" className="text-base" />
                <span>Facebook</span>
              </button>
            </div>

            {/* Download PNG & Copy Link / Native Share */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => void handleDownloadCardPng()}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 disabled:opacity-60"
              >
                <JKIcon name={isDownloading ? "spinner" : "download"} className={`text-sm ${isDownloading ? "animate-spin" : ""}`} />
                <span>{isDownloading ? "กำลังสร้างการ์ด..." : "ดาวน์โหลดการ์ด PNG"}</span>
              </button>

              <button
                onClick={handleCopyLink}
                className={`flex items-center justify-center gap-2 py-3 px-3 rounded-2xl font-bold text-xs transition-all cursor-pointer border ${
                  hasCopied
                    ? "bg-emerald-500 text-white border-emerald-500 shadow-md shadow-emerald-500/25"
                    : "bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/15 text-slate-700 dark:text-white border-slate-200 dark:border-white/10"
                }`}
              >
                <JKIcon name={hasCopied ? "check" : "copy"} className="text-sm" />
                <span>{hasCopied ? "คัดลอกลิงก์แล้ว!" : "คัดลอกลิงก์ & สรุป"}</span>
              </button>
            </div>

            {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
              <button
                onClick={() => void handleNativeShare()}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl font-bold text-xs bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-400 hover:to-cyan-400 text-white shadow-md cursor-pointer transition"
              >
                <JKIcon name="arrow-up-from-bracket" className="text-xs" />
                <span>แชร์ผ่านแอปในเครื่อง</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
