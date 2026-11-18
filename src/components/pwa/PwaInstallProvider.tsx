"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import { JKIcon } from "@/components/ui/jk-icon";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const PWA_DISMISS_KEY = "citypulse-pwa-install-dismissed-at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
export const OPEN_PWA_INSTALL_EVENT = "citypulse:open-pwa-install";

const emptySubscribe = () => () => {};
const serverFalse = () => false;

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mq = window.matchMedia("(display-mode: standalone)");
  mq.addEventListener("change", callback);
  window.addEventListener("appinstalled", callback);
  return () => {
    mq.removeEventListener("change", callback);
    window.removeEventListener("appinstalled", callback);
  };
}

function getStandaloneSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function getIsIOSSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !("MSStream" in window);
}

function getWasRecentlyDismissedSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(PWA_DISMISS_KEY);
    if (!raw) return false;
    const ts = Number(raw);
    return Number.isFinite(ts) && Date.now() - ts < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export function triggerPwaInstallGuide() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(OPEN_PWA_INSTALL_EVENT));
  }
}

export function PwaInstallButton({
  className = "",
  showLabel = false,
}: {
  className?: string;
  showLabel?: boolean;
}) {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    serverFalse
  );

  if (isStandalone) return null;

  return (
    <button
      type="button"
      onClick={triggerPwaInstallGuide}
      title="ติดตั้งแอป CityPulse ลงหน้าจอหลัก (PWA)"
      aria-label="ติดตั้งแอป CityPulse"
      className={className}
    >
      <JKIcon name="download" className="text-xs text-teal-600 dark:text-cyan-300" />
      {showLabel && <span className="hidden lg:inline whitespace-nowrap">ติดตั้งแอป</span>}
    </button>
  );
}

export function PwaInstallProvider() {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    serverFalse
  );
  const isIOS = useSyncExternalStore(emptySubscribe, getIsIOSSnapshot, serverFalse);
  const wasRecentlyDismissed = useSyncExternalStore(
    emptySubscribe,
    getWasRecentlyDismissedSnapshot,
    () => true
  );

  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [dismissedInSession, setDismissedInSession] = useState(false);
  const [installedNotice, setInstalledNotice] = useState(false);

  // Register Service Worker & listen to beforeinstallprompt / manual trigger
  useEffect(() => {
    if (typeof window === "undefined") return;

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // ignore SW registration failure in restricted contexts
      });
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setManualOpen(false);
      setInstalledNotice(true);
      window.setTimeout(() => setInstalledNotice(false), 4500);
    };

    const handleManualOpen = () => {
      setDismissedInSession(false);
      setManualOpen(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener(OPEN_PWA_INSTALL_EVENT, handleManualOpen);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener(OPEN_PWA_INSTALL_EVENT, handleManualOpen);
    };
  }, []);

  const handleDismiss = () => {
    setDismissedInSession(true);
    setManualOpen(false);
    try {
      window.localStorage.setItem(PWA_DISMISS_KEY, String(Date.now()));
    } catch {
      // ignore storage errors
    }
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setDeferredPrompt(null);
        setManualOpen(false);
      }
      return;
    }
    setManualOpen(true);
  };

  if (isStandalone) return null;

  const autoEligible = Boolean(deferredPrompt || isIOS) && !wasRecentlyDismissed && !dismissedInSession;
  const shouldShow = manualOpen || autoEligible;

  return (
    <>
      {installedNotice && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-[60] px-4 py-2.5 rounded-2xl bg-emerald-600 text-white shadow-xl flex items-center gap-2 text-xs font-black animate-in fade-in slide-in-from-top-3 duration-300"
        >
          <JKIcon name="circle-check" className="text-sm" />
          <span>ติดตั้งแอป CityPulse ลงเครื่องสำเร็จแล้ว!</span>
        </div>
      )}

      {shouldShow && (
        <aside
          aria-label="ติดตั้งแอป CityPulse"
          className="fixed bottom-[86px] sm:bottom-5 left-3 right-3 sm:left-auto sm:right-5 sm:w-[360px] z-40 animate-in fade-in slide-in-from-bottom-4 duration-300"
        >
          <div className="ios-glass-sheet rounded-[26px] p-4 shadow-2xl">
            <div className="flex items-start gap-3">
              <div className="w-12 h-12 rounded-2xl overflow-hidden shadow-md shrink-0 border border-white/60 dark:border-white/15">
                <img
                  src="/icons/icon-192.png"
                  alt="CityPulse App Icon"
                  className="w-full h-full object-cover"
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-700 dark:text-teal-300 text-[10px] font-black uppercase tracking-wider">
                      <JKIcon name="mobile-screen" className="text-[10px]" />
                      <span>PWA App</span>
                    </span>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white mt-1 leading-tight">
                      ติดตั้ง CityPulse ลงหน้าจอหลัก
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={handleDismiss}
                    aria-label="ปิดคำแนะนำติดตั้งแอป"
                    className="w-7 h-7 rounded-full bg-slate-900/[0.06] dark:bg-white/10 hover:bg-slate-900/12 dark:hover:bg-white/20 text-slate-600 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
                  >
                    <JKIcon name="xmark" className="text-xs" />
                  </button>
                </div>

                {deferredPrompt ? (
                  <>
                    <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                      เปิดแผนที่และแจ้งปัญหาได้รวดเร็วแบบเต็มหน้าจอเสมือนแอปบนมือถือและเดสก์ท็อป
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleInstallClick}
                        className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white text-xs font-black shadow-md shadow-teal-600/25 transition cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <JKIcon name="download" className="text-[11px]" />
                        <span>ติดตั้งแอปทันที</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDismiss}
                        className="py-2 px-3 rounded-xl bg-white/80 dark:bg-white/10 border border-slate-200 dark:border-white/15 text-slate-700 dark:text-slate-200 text-xs font-bold transition cursor-pointer"
                      >
                        ภายหลัง
                      </button>
                    </div>
                  </>
                ) : isIOS ? (
                  <div className="mt-1.5 space-y-2 text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                    <p>ติดตั้งบน iPhone / iPad ได้ใน 2 ขั้นตอน:</p>
                    <ol className="space-y-1 text-[11px] bg-white/75 dark:bg-slate-900/60 border border-white/80 dark:border-white/10 rounded-xl p-2.5">
                      <li className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          1
                        </span>
                        <span>
                          แตะปุ่ม <strong>แชร์ (Share)</strong> ที่แถบล่าง Safari
                        </span>
                      </li>
                      <li className="flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-teal-600 text-white text-[9px] font-black flex items-center justify-center shrink-0">
                          2
                        </span>
                        <span>
                          เลือก <strong>&quot;เพิ่มไปยังหน้าจอโฮม&quot;</strong> (Add to Home Screen)
                        </span>
                      </li>
                    </ol>
                  </div>
                ) : (
                  <div className="mt-1.5 space-y-2 text-[11px] text-slate-700 dark:text-slate-200 leading-relaxed">
                    <p>
                      สามารถติดตั้งเป็นแอปเดสก์ท็อป/มือถือผ่านไอคอนติดตั้ง
                      <span className="font-bold"> บนแถบที่อยู่เบราว์เซอร์ (Install App) </span>
                      หรือเมนู <strong>เพิ่มไปยังหน้าจอหลัก</strong> ได้ทันที
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}
    </>
  );
}
