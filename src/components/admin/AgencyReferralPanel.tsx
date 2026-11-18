"use client";

import { useEffect, useState, type FormEvent } from "react";
import type { ComplaintReport } from "@/data/map-data";

interface Agency { code: string; name: string; district: string; sameDistrict: boolean }
interface Referral { id: string; agency: string; email: string | null; note: string; created_at: string; sent_at: string | null }

export function AgencyReferralPanel({ complaint }: { complaint: ComplaintReport }) {
  const [agencies, setAgencies] = useState<Agency[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [agency, setAgency] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [search, setSearch] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ reportId: complaint.id });
    void fetch(`/api/admin/referrals?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (controller.signal.aborted) return;
        setAgencies(data.agencies);
        setReferrals(data.referrals);
        setLoaded(true);
        setMessage("");
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage("โหลดรายชื่อและประวัติการส่งต่อไม่ได้");
      });
    return () => controller.abort();
  }, [complaint.id, attempt]);

  async function save(method: "POST" | "PATCH", referralId?: string) {
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/admin/referrals", {
        method, headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reportId: complaint.id, referralId, agency, email, note }),
      });
      const referral = await response.json();
      if (!response.ok) throw new Error(referral.error);
      setReferrals((current) => method === "POST"
        ? [referral, ...current] : current.map((item) => item.id === referral.id ? referral : item));
      if (method === "POST") {
        setAgency("");
        setEmail("");
        setNote("");
      }
      setMessage(method === "POST" ? "บันทึกรายการรอส่งต่อแล้ว" : "บันทึกว่าส่งแล้ว");
    } catch (error) {
      setMessage(error instanceof Error && error.message ? error.message : "บันทึกการส่งต่อไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  function handoffText(referral: Referral) {
    const [lng, lat] = complaint.coordinates;
    return [
      `เรียน ${referral.agency}`, `เรื่อง ${complaint.title}`, `เลขอ้างอิง ${complaint.id}`,
      `พื้นที่ ${[complaint.district, complaint.province].filter(Boolean).join(" ")}`,
      `จุดเกิดเหตุ https://www.google.com/maps?q=${lat},${lng}`, referral.note,
    ].filter(Boolean).join("\n");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void save("POST");
  }

  const options = agencies.filter((item) => `${item.name} ${item.district}`.includes(search.trim()));
  const inputClass = "w-full rounded-lg border border-slate-300 bg-transparent p-2 text-sm dark:border-slate-600";

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/15" aria-label="ส่งต่อหน่วยงาน">
      <h3 className="font-bold">ส่งต่อหน่วยงาน</h3>
      <p className="text-sm">พื้นที่เกิดเหตุ {complaint.district} {complaint.province} · รายชื่อ อปท. เรียงหน่วยในอำเภอก่อน</p>
      {!loaded && !message && <p role="status">กำลังโหลดรายชื่อ…</p>}
      {!loaded && message && <button type="button" onClick={() => { setMessage(""); setAttempt((value) => value + 1); }}>ลองโหลดใหม่</button>}
      {loaded && (
        <form className="space-y-2" onSubmit={handleSubmit}>
          <label className="block text-sm">ค้นหาชื่อ อปท. หรืออำเภอ
            <input className={inputClass} value={search} onChange={(event) => setSearch(event.target.value)} />
          </label>
          <label className="block text-sm">เลือก อปท. ในจังหวัด
            <select className={inputClass} value="" onChange={(event) => {
              const selected = agencies.find((item) => item.code === event.target.value);
              if (selected) {
                setAgency(selected.name);
                setEmail("");
              }
            }}>
              <option value="">เลือกจาก {options.length} หน่วยงาน</option>
              {options.map((item) => <option key={item.code} value={item.code}>{item.name}{item.district && ` · ${item.district}`}</option>)}
            </select>
          </label>
          <label className="block text-sm">ชื่อหน่วยงานรับผิดชอบ
            <input className={inputClass} value={agency} onChange={(event) => setAgency(event.target.value)}
              placeholder="เลือก อปท. หรือระบุหน่วยงานอื่น" maxLength={180} required />
          </label>
          <label className="block text-sm">อีเมลรับเรื่องของหน่วยงาน (ถ้ามี)
            <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} maxLength={254} />
          </label>
          <label className="block text-sm">รายละเอียดสำหรับหน่วยงาน (ถ้ามี)
            <textarea className={inputClass} value={note} onChange={(event) => setNote(event.target.value)} maxLength={1500} />
          </label>
          <button className="rounded-lg bg-sky-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-60"
            type="submit" disabled={busy || !agency.trim()}>บันทึกรอส่งต่อ</button>
        </form>
      )}
      {message && <p role="status" className="text-sm">{message}</p>}
      {referrals.map((referral) => (
        <div key={referral.id} className="space-y-1 rounded-lg bg-slate-100 p-3 text-sm dark:bg-white/10">
          <p className="font-bold">{referral.agency} · {referral.sent_at ? "ส่งแล้วตามที่เจ้าหน้าที่ยืนยัน" : "รอส่ง"}</p>
          <p>{new Date(referral.sent_at ?? referral.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" })}</p>
          {referral.email && <p>{referral.email}</p>}
          {referral.note && <p className="whitespace-pre-wrap">{referral.note}</p>}
          <div className="flex flex-wrap gap-3">
            {referral.email && (
              <a className="underline" href={`mailto:${referral.email}?subject=${encodeURIComponent("ส่งต่อเรื่องแจ้งเหตุ Maps Systems")}&body=${encodeURIComponent(handoffText(referral))}`}>
                เปิดร่างอีเมล
              </a>
            )}
            <button type="button" className="underline" onClick={async () => {
              try { await navigator.clipboard.writeText(handoffText(referral)); setMessage("คัดลอกข้อความแล้ว"); }
              catch { setMessage("คัดลอกข้อความไม่ได้"); }
            }}>คัดลอกข้อความส่งต่อ</button>
            {!referral.sent_at && <button type="button" disabled={busy} className="underline"
              onClick={() => void save("PATCH", referral.id)}>ยืนยันว่าติดต่อหน่วยงานแล้ว</button>}
          </div>
        </div>
      ))}
    </section>
  );
}
