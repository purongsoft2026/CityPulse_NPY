"use client";

import React, { useState, useRef, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  type OfficerAccount,
  clearOfficerSession,
  createOfficerSession,
  getOfficerSessionSnapshot,
  getSafeAdminRedirectPath,
  hasOfficerPermission,
  selfResetOfficerPassword,
  subscribeOfficerSession,
  updateOfficerAccount,
} from "@/lib/officer-auth";
import {
  getIsDarkSnapshot,
  getMapStyleSnapshot,
  getUrlSearchParamSnapshot,
  subscribePopState,
  subscribeThemeSync,
  toggleThemeStore,
} from "@/lib/civic-store";
import { type MapStyleKey } from "@/components/map/MapHeader";

const getNextParamSnapshot = () => getUrlSearchParamSnapshot("next");
const getNullSnapshot = () => null;
const emptySubscribe = () => () => {};
const clientTrue = () => true;
const serverFalse = () => false;
const serverVoyager = (): MapStyleKey => "voyager";

interface LoginFormErrors {
  email?: string;
  password?: string;
  credentials?: string;
}

export default function AdminLoginPage() {
  const router = useRouter();
  const isHydrated = useSyncExternalStore(emptySubscribe, clientTrue, serverFalse);
  const isDark = useSyncExternalStore(subscribeThemeSync, getIsDarkSnapshot, serverFalse);
  const currentStyle = useSyncExternalStore(
    subscribeThemeSync,
    getMapStyleSnapshot,
    serverVoyager,
  );
  const existingSession = useSyncExternalStore(
    subscribeOfficerSession,
    getOfficerSessionSnapshot,
    getNullSnapshot
  );
  const rawNext = useSyncExternalStore(
    subscribePopState,
    getNextParamSnapshot,
    getNullSnapshot
  );
  const safeRedirectPath = getSafeAdminRedirectPath(rawNext);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotHelp, setShowForgotHelp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<LoginFormErrors>({});
  const [touched, setTouched] = useState<{ email?: boolean; password?: boolean }>({});

  // Self-service password reset state (inside Forgot Help panel)
  const [resetEmail, setResetEmail] = useState("");
  const [resetBadge, setResetBadge] = useState("");
  const [resetNewPass, setResetNewPass] = useState("");
  const [resetMsg, setResetMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Forced password change when flagged by Admin
  const [pendingPasswordChangeOfficer, setPendingPasswordChangeOfficer] =
    useState<OfficerAccount | null>(null);
  const [forcedNewPass, setForcedNewPass] = useState("");
  const [forcedConfirmPass, setForcedConfirmPass] = useState("");
  const [forcedError, setForcedError] = useState<string | null>(null);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const validateEmailValue = (val: string): string | undefined => {
    const trimmed = val.trim();
    if (!trimmed) return "กรุณากรอกอีเมลเจ้าหน้าที่";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      return "รูปแบบอีเมลไม่ถูกต้อง เช่น officer@citypulse.go.th";
    }
    return undefined;
  };

  const validatePasswordValue = (val: string): string | undefined => {
    if (!val) return "กรุณากรอกรหัสผ่าน";
    if (val.length < 4) return "รหัสผ่านต้องมีอย่างน้อย 4 ตัวอักษร";
    return undefined;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const emailErr = validateEmailValue(email);
    const passwordErr = validatePasswordValue(password);
    if (emailErr || passwordErr) {
      setErrors({ email: emailErr, password: passwordErr });
      setTouched({ email: true, password: true });
      if (emailErr) {
        emailRef.current?.focus();
      } else if (passwordErr) {
        passwordRef.current?.focus();
      }
      return;
    }

    setIsSubmitting(true);
    setErrors({});
    const result = await fetch("/api/admin/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, rememberMe }),
    })
      .then((response) => response.json())
      .catch(() => ({ ok: false, error: "เชื่อมต่อระบบเข้าสู่ระบบไม่ได้ กรุณาลองใหม่" }));
    if (!result.ok) {
      setIsSubmitting(false);
      setErrors({ credentials: result.error });
      passwordRef.current?.focus();
      return;
    }

    if (result.mustChangePassword) {
      setIsSubmitting(false);
      setPendingPasswordChangeOfficer(result.officer);
      setForcedNewPass("");
      setForcedConfirmPass("");
      setForcedError(null);
      return;
    }

    createOfficerSession(result.officer, rememberMe);
    const destination =
      !rawNext && hasOfficerPermission(result.officer, "manageUsers")
        ? "/admin/system#diagnostics"
        : !rawNext && !hasOfficerPermission(result.officer, "accessDispatch") && hasOfficerPermission(result.officer, "manageSystem")
        ? "/admin/system"
        : safeRedirectPath;
    router.replace(destination);
  };

  const handleSelfResetPassword = () => {
    const res = selfResetOfficerPassword(resetEmail || email, resetBadge, resetNewPass);
    if (!res.ok) {
      setResetMsg({ type: "err", text: res.error });
      return;
    }
    setEmail(res.officer.email);
    setPassword(resetNewPass);
    setResetBadge("");
    setResetNewPass("");
    setErrors({});
    setResetMsg({
      type: "ok",
      text: `ตั้งรหัสผ่านใหม่สำหรับ ${res.officer.name} เรียบร้อยแล้ว สามารถกดเข้าสู่ระบบได้ทันที`,
    });
  };

  const handleForcedPasswordSubmit = () => {
    if (!pendingPasswordChangeOfficer) return;
    if (forcedNewPass.length < 4) {
      setForcedError("รหัสผ่านใหม่ต้องมีอย่างน้อย 4 ตัวอักษร");
      return;
    }
    if (forcedNewPass !== forcedConfirmPass) {
      setForcedError("รหัสผ่านใหม่และการยืนยันไม่ตรงกัน");
      return;
    }
    const updated = updateOfficerAccount(pendingPasswordChangeOfficer.id, {
      password: forcedNewPass,
      mustChangePassword: false,
    });
    if (!updated.ok) {
      setForcedError(updated.error);
      return;
    }
    createOfficerSession(updated.officer, rememberMe);
    const destination =
      !rawNext && hasOfficerPermission(updated.officer, "manageUsers")
        ? "/admin/system#diagnostics"
        : safeRedirectPath;
    router.replace(destination);
  };

  return (
    <div className="min-h-screen bg-[#f2f2f7] dark:bg-[#050811] text-slate-900 dark:text-slate-100 relative overflow-x-hidden flex flex-col justify-between antialiased transition-colors">
      {/* Apple Ambient Mesh Glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[440px] h-[440px] rounded-full bg-sky-400/25 dark:bg-cyan-500/15 blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] rounded-full bg-indigo-400/20 dark:bg-indigo-500/15 blur-[120px]" />
      </div>

      {/* Top Navigation */}
      <header className="relative z-10 max-w-5xl w-full mx-auto px-4 sm:px-6 pt-5 flex flex-wrap items-center justify-between gap-2.5">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-white/10 hover:bg-white dark:hover:bg-white/15 border border-white dark:border-white/15 text-xs font-bold text-slate-800 dark:text-white shadow-sm backdrop-blur-xl transition"
        >
          <JKIcon name="arrow-left" className="text-xs text-sky-600 dark:text-cyan-400" />
          <span>กลับหน้าแผนที่ประชาชน</span>
        </Link>

        <div className="flex items-center gap-2">
          {/* iOS Segmented Theme Switch */}
          <div className="inline-flex items-center p-1 rounded-full bg-white/80 dark:bg-white/[0.09] border border-white dark:border-white/15 shadow-sm backdrop-blur-xl">
            <button
              type="button"
              onClick={() => toggleThemeStore(false, currentStyle)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition cursor-pointer ${
                !isDark
                  ? "bg-amber-400/25 text-amber-700 shadow-xs"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <JKIcon name="sun" className="text-[10px]" />
              <span>สว่าง</span>
            </button>
            <button
              type="button"
              onClick={() => toggleThemeStore(true, currentStyle)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-black transition cursor-pointer ${
                isDark
                  ? "bg-sky-500/25 text-cyan-300 shadow-xs"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <JKIcon name="moon" className="text-[10px]" />
              <span>มืด</span>
            </button>
          </div>

          <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-sky-500/12 dark:bg-cyan-500/15 border border-sky-500/25 dark:border-cyan-500/30 text-sky-700 dark:text-cyan-300 text-[11px] font-black">
            <JKIcon name="shield-halved" className="text-xs" />
            <span>Thailand Command Portal</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8 flex flex-col items-center justify-center gap-6">
        {/* Active Session Banner if already signed in */}
        {isHydrated && existingSession && (
          <div className="w-full max-w-md rounded-[26px] bg-emerald-50/90 dark:bg-emerald-950/50 border border-emerald-500/35 p-4 flex flex-wrap items-center justify-between gap-3 shadow-xl backdrop-blur-2xl">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center p-1 flex-shrink-0">
                <img
                  src={existingSession.officer.avatarPose}
                  alt={existingSession.officer.name}
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-emerald-800 dark:text-emerald-300 truncate">
                  เข้าสู่ระบบอยู่แล้ว: {existingSession.officer.name}
                </p>
                <p className="text-[11px] text-emerald-700/80 dark:text-emerald-200/70 truncate">
                  {existingSession.officer.badgeCode} · {existingSession.officer.role}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => router.replace(safeRedirectPath)}
                className="px-3.5 py-1.5 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black cursor-pointer transition"
              >
                เข้าศูนย์ปฏิบัติการ
              </button>
              <Link
                href="/admin/system"
                className="px-3.5 py-1.5 rounded-full bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-700 dark:text-indigo-200 border border-indigo-500/30 text-xs font-black transition"
              >
                ฐานข้อมูล & ตั้งค่า
              </Link>
              <button
                type="button"
                onClick={() => clearOfficerSession()}
                className="px-3 py-1.5 rounded-full bg-slate-900/10 dark:bg-white/10 hover:bg-slate-900/15 dark:hover:bg-white/15 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer transition"
              >
                สลับบัญชี
              </button>
            </div>
          </div>
        )}

        {/* Login Card */}
        <div className="w-full max-w-md rounded-[32px] bg-white/85 dark:bg-white/[0.06] border border-white dark:border-white/15 backdrop-blur-2xl shadow-[0_20px_50px_-12px_rgba(15,23,42,0.12)] dark:shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-5 border-b border-slate-200/70 dark:border-white/10 bg-gradient-to-br from-white via-sky-50/60 to-cyan-50/70 dark:from-slate-900/80 dark:via-slate-900/80 dark:to-cyan-950/60 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-sky-500/20 to-blue-500/20 border border-sky-400/35 flex items-center justify-center p-1.5 flex-shrink-0">
              <img
                src="/images/mascot.png"
                alt="CityPulse Officer Mascot"
                className="w-full h-full object-contain drop-shadow"
              />
            </div>
            <div>
              <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-sky-600 dark:text-cyan-400 mb-0.5">
                <JKIcon name="user-shield" />
                <span>Officer Access</span>
              </span>
              <h1 id="login-heading" className="text-xl font-black text-slate-900 dark:text-white leading-tight">
                เข้าสู่ระบบเจ้าหน้าที่
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                CityPulse Admin & Dispatch Center
              </p>
            </div>
          </div>

          <form
            method="POST"
            action="/admin"
            onSubmit={handleSubmit}
            noValidate
            aria-labelledby="login-heading"
            className="p-6 space-y-4"
          >
            {/* Credentials Alert Banner */}
            {errors.credentials && (
              <div
                role="alert"
                aria-live="assertive"
                className="p-3.5 rounded-2xl bg-rose-500/12 border border-rose-500/35 text-rose-700 dark:text-rose-200 text-xs font-semibold flex items-start gap-2.5"
              >
                <JKIcon name="triangle-exclamation" className="text-rose-500 text-sm mt-0.5 flex-shrink-0" />
                <span>{errors.credentials}</span>
              </div>
            )}

            {/* Email Field */}
            <div>
              <label
                htmlFor="officer-email"
                className="block text-xs font-black text-slate-700 dark:text-slate-200 mb-1.5"
              >
                อีเมลเจ้าหน้าที่ <span aria-hidden="true" className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <JKIcon
                  name="envelope"
                  className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  id="officer-email"
                  name="email"
                  ref={emailRef}
                  type="email"
                  autoComplete="username"
                  spellCheck={false}
                  autoCapitalize="none"
                  autoCorrect="off"
                  enterKeyHint="next"
                  required
                  value={email}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setEmail(nextVal);
                    if (errors.email && !validateEmailValue(nextVal)) {
                      setErrors((prev) => ({ ...prev, email: undefined, credentials: undefined }));
                    } else if (errors.credentials) {
                      setErrors((prev) => ({ ...prev, credentials: undefined }));
                    }
                  }}
                  onBlur={() => {
                    if (!touched.email && !email) return;
                    setTouched((prev) => ({ ...prev, email: true }));
                    setErrors((prev) => ({ ...prev, email: validateEmailValue(email) }));
                  }}
                  aria-invalid={Boolean(errors.email)}
                  aria-describedby={errors.email ? "officer-email-error" : "officer-email-help"}
                  placeholder="officer@citypulse.go.th"
                  className={`w-full min-h-[48px] pl-10 pr-4 py-2.5 rounded-2xl border bg-slate-100/80 dark:bg-black/40 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                    errors.email
                      ? "border-rose-500 focus:ring-rose-500/40"
                      : "border-slate-300/70 dark:border-white/15 focus:border-sky-500 focus:ring-sky-500/35"
                  }`}
                />
              </div>
              {errors.email ? (
                <p id="officer-email-error" role="alert" className="text-xs text-rose-500 font-semibold mt-1.5">
                  {errors.email}
                </p>
              ) : (
                <p id="officer-email-help" className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  ใช้อีเมลหน่วยงาน (@citypulse.go.th) หรือบัญชีที่สร้างโดย Admin
                </p>
              )}
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="officer-password"
                  className="block text-xs font-black text-slate-700 dark:text-slate-200"
                >
                  รหัสผ่าน <span aria-hidden="true" className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  aria-expanded={showForgotHelp}
                  aria-controls="forgot-password-panel"
                  onClick={() => setShowForgotHelp((prev) => !prev)}
                  className="text-[11px] font-bold text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer"
                >
                  ลืมรหัสผ่าน?
                </button>
              </div>

              <div className="relative">
                <JKIcon
                  name="lock"
                  className="text-slate-400 text-xs absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
                />
                <input
                  id="officer-password"
                  name="password"
                  ref={passwordRef}
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  enterKeyHint="done"
                  required
                  value={password}
                  onChange={(e) => {
                    const nextVal = e.target.value;
                    setPassword(nextVal);
                    if (errors.password && !validatePasswordValue(nextVal)) {
                      setErrors((prev) => ({
                        ...prev,
                        password: undefined,
                        credentials: undefined,
                      }));
                    } else if (errors.credentials) {
                      setErrors((prev) => ({ ...prev, credentials: undefined }));
                    }
                  }}
                  onBlur={() => {
                    if (!touched.password && !password) return;
                    setTouched((prev) => ({ ...prev, password: true }));
                    setErrors((prev) => ({ ...prev, password: validatePasswordValue(password) }));
                  }}
                  aria-invalid={Boolean(errors.password)}
                  aria-describedby={errors.password ? "officer-password-error" : undefined}
                  placeholder="กรอกรหัสผ่านเจ้าหน้าที่"
                  className={`w-full min-h-[48px] pl-10 pr-12 py-2.5 rounded-2xl border bg-slate-100/80 dark:bg-black/40 text-base text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition ${
                    errors.password
                      ? "border-rose-500 focus:ring-rose-500/40"
                      : "border-slate-300/70 dark:border-white/15 focus:border-sky-500 focus:ring-sky-500/35"
                  }`}
                />
                <button
                  type="button"
                  aria-pressed={showPassword}
                  aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/70 dark:hover:bg-white/10 transition cursor-pointer"
                >
                  <JKIcon name={showPassword ? "eye-slash" : "eye"} className="text-sm" />
                </button>
              </div>
              {errors.password && (
                <p id="officer-password-error" role="alert" className="text-xs text-rose-500 font-semibold mt-1.5">
                  {errors.password}
                </p>
              )}

              {showForgotHelp && (
                <div
                  id="forgot-password-panel"
                  className="mt-2.5 p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 text-[11px] text-sky-900 dark:text-cyan-100 leading-relaxed space-y-3"
                >
                  <div className="space-y-1.5">
                    <p className="font-black text-xs text-sky-700 dark:text-cyan-300 flex items-center gap-1.5">
                      <JKIcon name="key" className="text-[11px]" />
                      <span>รีเซ็ตรหัสผ่านเจ้าหน้าที่ด้วยตนเอง (Email + Badge Code)</span>
                    </p>
                    <p className="text-[11px] opacity-85">
                      ระบุอีเมลเจ้าหน้าที่และรหัสประจำตัว (เช่น <span className="font-mono font-bold">PWD-042</span>) เพื่อตั้งรหัสผ่านใหม่ทันที หรือติดต่อ Admin ส่วนกลาง (โทร. 1567)
                    </p>
                  </div>

                  {resetMsg && (
                    <div
                      className={`p-2.5 rounded-xl text-[11px] font-bold border ${
                        resetMsg.type === "ok"
                          ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-700 dark:text-emerald-200"
                          : "bg-rose-500/15 border-rose-500/40 text-rose-700 dark:text-rose-200"
                      }`}
                    >
                      {resetMsg.text}
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2">
                    <input
                      type="email"
                      value={resetEmail || email}
                      onChange={(e) => {
                        setResetEmail(e.target.value);
                        setResetMsg(null);
                      }}
                      placeholder="อีเมลเจ้าหน้าที่ (เช่น wichai@citypulse.go.th)"
                      className="w-full h-9 px-3 rounded-xl border border-sky-500/25 bg-white/80 dark:bg-black/40 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={resetBadge}
                        onChange={(e) => {
                          setResetBadge(e.target.value);
                          setResetMsg(null);
                        }}
                        placeholder="Badge (เช่น PWD-042)"
                        className="w-full h-9 px-3 rounded-xl border border-sky-500/25 bg-white/80 dark:bg-black/40 text-xs font-mono uppercase text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                      />
                      <input
                        type="text"
                        value={resetNewPass}
                        onChange={(e) => {
                          setResetNewPass(e.target.value);
                          setResetMsg(null);
                        }}
                        placeholder="รหัสใหม่ (>= 4 ตัว)"
                        className="w-full h-9 px-3 rounded-xl border border-sky-500/25 bg-white/80 dark:bg-black/40 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500/35"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleSelfResetPassword}
                      className="w-full h-9 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-black transition cursor-pointer"
                    >
                      ยืนยันตั้งรหัสผ่านใหม่
                    </button>
                  </div>

                  <div className="pt-2 border-t border-sky-500/20 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-mono text-[10px]">
                      Super Admin: <strong>admin@citypulse.go.th</strong> · รหัส: <strong>admin1234</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEmail("admin@citypulse.go.th");
                        setPassword("admin1234");
                        setErrors({});
                      }}
                      className="px-2.5 py-1 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-700 dark:text-cyan-200 font-black text-[10px] cursor-pointer transition"
                    >
                      กรอกรหัส Admin
                    </button>
                  </div>
                </div>
              )}

              {pendingPasswordChangeOfficer && (
                <div className="mt-3 p-4 rounded-2xl bg-amber-500/12 border border-amber-500/40 space-y-2.5">
                  <p className="text-xs font-black text-amber-800 dark:text-amber-200 flex items-center gap-1.5">
                    <JKIcon name="shield-halved" className="text-xs" />
                    <span>ผู้ดูแลระบบกำหนดให้ตั้งรหัสผ่านใหม่ ({pendingPasswordChangeOfficer.name})</span>
                  </p>
                  {forcedError && (
                    <p className="text-[11px] font-bold text-rose-600 dark:text-rose-300">
                      {forcedError}
                    </p>
                  )}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="password"
                      value={forcedNewPass}
                      onChange={(e) => {
                        setForcedNewPass(e.target.value);
                        setForcedError(null);
                      }}
                      placeholder="รหัสผ่านใหม่ (>= 4 ตัว)"
                      className="w-full h-9 px-3 rounded-xl border border-amber-500/30 bg-white/85 dark:bg-black/45 text-xs font-mono text-slate-900 dark:text-white"
                    />
                    <input
                      type="password"
                      value={forcedConfirmPass}
                      onChange={(e) => {
                        setForcedConfirmPass(e.target.value);
                        setForcedError(null);
                      }}
                      placeholder="ยืนยันรหัสผ่านใหม่"
                      className="w-full h-9 px-3 rounded-xl border border-amber-500/30 bg-white/85 dark:bg-black/45 text-xs font-mono text-slate-900 dark:text-white"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleForcedPasswordSubmit}
                    className="w-full h-9 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black cursor-pointer transition"
                  >
                    บันทึกรหัสผ่านใหม่และเข้าสู่ระบบ
                  </button>
                </div>
              )}
            </div>

            {/* Remember me checkbox */}
            <div className="flex items-center gap-2.5 pt-0.5">
              <input
                id="remember-officer"
                name="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded accent-sky-500 cursor-pointer"
              />
              <label
                htmlFor="remember-officer"
                className="text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer select-none"
              >
                จดจำสถานะการเข้าสู่ระบบในอุปกรณ์นี้
              </label>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-[48px] py-3 px-4 rounded-full bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 disabled:opacity-60 disabled:cursor-wait text-white font-black text-sm shadow-lg shadow-sky-500/25 active:scale-[0.99] transition cursor-pointer flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <span className="w-4 h-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>กำลังตรวจสอบสิทธิ์...</span>
                </>
              ) : (
                <>
                  <JKIcon name="key" className="text-xs" />
                  <span>เข้าสู่ระบบเจ้าหน้าที่</span>
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      <footer className="relative z-10 text-center py-4 text-[11px] text-slate-500 dark:text-slate-500 border-t border-slate-200/70 dark:border-white/5">
        MapCN Civic Pulse · ศูนย์บริหารจัดการเรื่องร้องเรียนทุกจังหวัดทั่วประเทศ (77 จังหวัด)
      </footer>
    </div>
  );
}

