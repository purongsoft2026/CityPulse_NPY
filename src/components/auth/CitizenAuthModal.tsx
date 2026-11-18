"use client";

import React, { useEffect, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import { PROVINCE_GROUPS } from "@/data/map-data";
import {
  CITIZEN_AVATAR_POSES,
  type CitizenMember,
} from "@/lib/citizen-auth";

import { getMapsAuth, toCitizenMember } from "@/lib/maps-auth-client";

export type CitizenAuthTab = "login" | "register";

interface CitizenAuthModalProps {
  isOpen: boolean;
  initialTab?: CitizenAuthTab;
  onClose: () => void;
  onAuthSuccess?: (member: CitizenMember, mode: CitizenAuthTab) => void;
}

export function CitizenAuthModal({
  isOpen,
  initialTab = "login",
  onClose,
  onAuthSuccess,
}: CitizenAuthModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <CitizenAuthModalInner
      key={initialTab}
      initialTab={initialTab}
      onClose={onClose}
      onAuthSuccess={onAuthSuccess}
    />
  );
}

function CitizenAuthModalInner({
  initialTab,
  onClose,
  onAuthSuccess,
}: {
  initialTab: CitizenAuthTab;
  onClose: () => void;
  onAuthSuccess?: (member: CitizenMember, mode: CitizenAuthTab) => void;
}) {
  const [activeTab, setActiveTab] = useState<CitizenAuthTab>(initialTab);

  // Login state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [loginError, setLoginError] = useState("");

  // Register state
  const [displayName, setDisplayName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPhone, setRegPhone] = useState("");
  const [homeProvince, setHomeProvince] = useState("กรุงเทพมหานคร");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [avatarPose, setAvatarPose] = useState<string>(CITIZEN_AVATAR_POSES[0].src);
  const [regError, setRegError] = useState("");

  const [loginNotice, setLoginNotice] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    if (!loginEmail.trim() || !loginPassword) {
      setLoginError("กรุณากรอกอีเมลและรหัสผ่านให้ครบถ้วน");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await getMapsAuth().signInWithPassword({
        email: loginEmail.trim(),
        password: loginPassword,
      });
      if (error || !data.user) {
        setLoginError(error?.code === "email_not_confirmed"
          ? "กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ"
          : "เข้าสู่ระบบไม่สำเร็จ กรุณาตรวจสอบอีเมลและรหัสผ่าน");
        return;
      }
      onAuthSuccess?.(toCitizenMember(data.user), "login");
      onClose();
    } catch {
      setLoginError("ติดต่อระบบไม่ได้ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegError("");

    if (!displayName.trim()) {
      setRegError("กรุณาระบุชื่อที่ต้องการแสดงในระบบ");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail.trim())) {
      setRegError("กรุณากรอกอีเมลให้ถูกต้อง เช่น somying@citizen.th");
      return;
    }
    if (regPassword.length < 6) {
      setRegError("รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร");
      return;
    }
    if (regPassword !== confirmPassword) {
      setRegError("ยืนยันรหัสผ่านไม่ตรงกัน กรุณาตรวจสอบอีกครั้ง");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await getMapsAuth().signUp({
        email: regEmail.trim(),
        password: regPassword,
        options: {
          emailRedirectTo: new URL("/citizen", window.location.origin).href,
          data: { displayName: displayName.trim(), phone: regPhone.trim(), homeProvince, avatarPose },
        },
      });
      if (error || !data.user) {
        setRegError(error?.code === "weak_password"
          ? "รหัสผ่านไม่ผ่านข้อกำหนด กรุณาใช้รหัสผ่านที่คาดเดายากขึ้น"
          : "สมัครไม่สำเร็จ กรุณาตรวจสอบอีเมลหรือลองใหม่ภายหลัง");
        return;
      }
      if (!data.session) {
        setActiveTab("login");
        setLoginEmail(regEmail.trim());
        setLoginNotice("หากอีเมลนี้สมัครได้ ระบบจะส่งลิงก์ยืนยันให้ กรุณาตรวจกล่องจดหมายแล้วกลับมาเข้าสู่ระบบ");
        return;
      }
      onAuthSuccess?.(toCitizenMember(data.user), "register");
      onClose();
    } catch {
      setRegError("ติดต่อระบบไม่ได้ กรุณาลองใหม่");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[32px] shadow-2xl border border-slate-200/80 dark:border-white/15 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="relative bg-gradient-to-r from-teal-600 via-emerald-600 to-cyan-600 px-6 pt-6 pb-5 text-white flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่างสมาชิก"
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 hover:bg-black/35 flex items-center justify-center text-white transition cursor-pointer"
          >
            <JKIcon name="xmark" className="text-sm" />
          </button>

          <div className="flex items-center gap-3.5 pr-8">
            <div className="w-14 h-14 rounded-2xl bg-white/15 border border-white/30 flex items-center justify-center p-1.5 flex-shrink-0">
              <img
                src={activeTab === "register" ? avatarPose : "/images/mascot_success.png"}
                alt="Citizen Member Mascot"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider border border-white/25 mb-1">
                <JKIcon name="id-card" className="text-xs" />
                <span>Citizen Member Account</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black leading-tight">
                {activeTab === "login" ? "เข้าสู่ระบบสมาชิกพลเมือง" : "สมัครสมาชิกพลเมืองใหม่"}
              </h2>
              <p className="text-[11px] text-white/85 font-medium mt-0.5">
                เก็บประวัติเรื่องที่แจ้ง สะสม XP และใช้กรอกข้อมูลอัตโนมัติทั่วประเทศ
              </p>
            </div>
          </div>

          {/* Segmented Mode Switch */}
          <div className="mt-4 grid grid-cols-2 gap-1.5 p-1 rounded-2xl bg-black/20 border border-white/15">
            <button
              type="button"
              onClick={() => {
                setActiveTab("login");
                setLoginError("");
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "login"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-white/85 hover:text-white"
              }`}
            >
              <JKIcon name="user-check" className="text-xs" />
              <span>เข้าสู่ระบบ</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab("register");
                setRegError("");
              }}
              className={`py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "register"
                  ? "bg-white text-emerald-700 shadow-sm"
                  : "text-white/85 hover:text-white"
              }`}
            >
              <JKIcon name="user-plus" className="text-xs" />
              <span>สมัครสมาชิก</span>
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1">
          {activeTab === "login" ? (
            <form onSubmit={handleLoginSubmit} className="space-y-4" noValidate>
              {loginNotice && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{loginNotice}</p>}
                {loginError && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-start gap-2"
                >
                  <JKIcon name="triangle-exclamation" className="text-rose-500 text-sm mt-0.5 shrink-0" />
                  <span>{loginError}</span>
                </div>
              )}

              <div>
                <label
                  htmlFor="citizen-login-email"
                  className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  อีเมลสมาชิก
                </label>
                <div className="relative">
                  <JKIcon
                    name="envelope"
                    className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    id="citizen-login-email"
                    type="email"
                    autoComplete="email"
                    value={loginEmail}
                    onChange={(e) => {
                      setLoginEmail(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    placeholder="name@example.com"
                    className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="citizen-login-password"
                  className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5"
                >
                  รหัสผ่าน
                </label>
                <div className="relative">
                  <JKIcon
                    name="lock"
                    className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                  />
                  <input
                    id="citizen-login-password"
                    type={showLoginPassword ? "text" : "password"}
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      if (loginError) setLoginError("");
                    }}
                    placeholder="กรอกรหัสผ่าน"
                    className="w-full pl-9 pr-11 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((prev) => !prev)}
                    aria-label={showLoginPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                  >
                    <JKIcon name={showLoginPassword ? "eye-slash" : "eye"} className="text-xs" />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2"
              >
                <JKIcon name="user-check" className="text-xs" />
                <span>{isSubmitting ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบสมาชิก"}</span>
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5" noValidate>
              {regError && (
                <div
                  role="alert"
                  className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-200 text-xs font-bold flex items-start gap-2"
                >
                  <JKIcon name="triangle-exclamation" className="text-rose-500 text-sm mt-0.5 shrink-0" />
                  <span>{regError}</span>
                </div>
              )}

              {/* Avatar Pose Picker */}
              <div>
                <span className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-2">
                  เลือกมาสคอตประจำโปรไฟล์
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {CITIZEN_AVATAR_POSES.map((pose) => {
                    const selected = avatarPose === pose.src;
                    return (
                      <button
                        key={pose.id}
                        type="button"
                        onClick={() => setAvatarPose(pose.src)}
                        className={`p-2 rounded-2xl border flex flex-col items-center gap-1 transition cursor-pointer ${
                          selected
                            ? "bg-emerald-500/15 border-emerald-500 shadow-xs"
                            : "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 hover:border-slate-300"
                        }`}
                      >
                        <div className="w-9 h-9 flex items-center justify-center">
                          <img src={pose.src} alt={pose.label} className="w-full h-full object-contain" />
                        </div>
                        <span className="text-[10px] font-bold text-slate-700 dark:text-slate-300 truncate max-w-full">
                          {pose.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="citizen-reg-name"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    ชื่อที่แสดงในระบบ <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="citizen-reg-name"
                    type="text"
                    value={displayName}
                    onChange={(e) => {
                      setDisplayName(e.target.value);
                      if (regError) setRegError("");
                    }}
                    placeholder="เช่น สมหญิง รักเมือง"
                    maxLength={60}
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="citizen-reg-province"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    จังหวัดพื้นที่ประจำ (77 จังหวัด)
                  </label>
                  <select
                    id="citizen-reg-province"
                    value={homeProvince}
                    onChange={(e) => setHomeProvince(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40 cursor-pointer"
                  >
                    {PROVINCE_GROUPS.map((group) => (
                      <optgroup key={group.region} label={`${group.region} (${group.provinces.length})`}>
                        {group.provinces.map((prov) => (
                          <option key={prov} value={prov}>
                            {prov}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="citizen-reg-email"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    อีเมล <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="citizen-reg-email"
                    type="email"
                    autoComplete="email"
                    value={regEmail}
                    onChange={(e) => {
                      setRegEmail(e.target.value);
                      if (regError) setRegError("");
                    }}
                    placeholder="name@example.com"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>

                <div>
                  <label
                    htmlFor="citizen-reg-phone"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    เบอร์โทรศัพท์ (ไม่บังคับ)
                  </label>
                  <input
                    id="citizen-reg-phone"
                    type="tel"
                    autoComplete="tel"
                    value={regPhone}
                    onChange={(e) => setRegPhone(e.target.value)}
                    placeholder="08x-xxx-xxxx"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="citizen-reg-password"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    รหัสผ่าน (อย่างน้อย 6 ตัว) <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="citizen-reg-password"
                      type={showRegPassword ? "text" : "password"}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => {
                        setRegPassword(e.target.value);
                        if (regError) setRegError("");
                      }}
                      placeholder="••••••"
                      className="w-full pl-3.5 pr-9 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword((prev) => !prev)}
                      aria-label={showRegPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
                    >
                      <JKIcon name={showRegPassword ? "eye-slash" : "eye"} className="text-[11px]" />
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="citizen-reg-confirm"
                    className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1"
                  >
                    ยืนยันรหัสผ่าน <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="citizen-reg-confirm"
                    type={showRegPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (regError) setRegError("");
                    }}
                    placeholder="••••••"
                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-800/70 text-xs font-bold text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white text-sm font-black shadow-lg shadow-emerald-600/25 transition cursor-pointer disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
              >
                <JKIcon name="user-plus" className="text-xs" />
                <span>{isSubmitting ? "กำลังสร้างบัญชี..." : "สมัครสมาชิกและเข้าใช้งาน"}</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

