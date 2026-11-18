"use client";

import { useState } from "react";

type ReportEvent = {
  id: number;
  report_id: string;
  citizen_user_id: string | null;
  event_type: "submitted" | "status_changed";
  status: string;
  occurred_at: string;
  context: { ip?: string; country?: string; city?: string; browser?: string } | null;
};

const statuses: Record<string, string> = {
  pending: "รอตรวจสอบ",
  inprogress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
};

const thaiTime = new Intl.DateTimeFormat("th-TH", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok",
});

export function ReportEventHistory() {
  const [events, setEvents] = useState<ReportEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [more, setMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(before?: number) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/report-events${before ? `?before=${before}` : ""}`);
      if (!response.ok) throw new Error("History unavailable");
      const rows: ReportEvent[] = await response.json();
      setEvents(rows);
      setMore(rows.length === 50);
      setLoaded(true);
    } catch {
      setError("โหลดประวัติไม่ได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <details className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) void load();
      }}>
      <summary className="cursor-pointer font-semibold">ประวัติการแจ้งเหตุและเปลี่ยนสถานะ</summary>
      <div className="my-3 flex gap-4 text-sm">
        <button type="button" disabled={loading} onClick={() => void load()}>ดูรายการล่าสุด</button>
        {more && <button type="button" disabled={loading} onClick={() => void load(events.at(-1)?.id)}>
          ดูรายการก่อนหน้า
        </button>}
        {loading && <span role="status">กำลังโหลด</span>}
      </div>
      {error && <p role="alert">{error}</p>}
      {loaded && !events.length && <p className="text-sm">ยังไม่มีรายการในหน้านี้</p>}
      {!!events.length && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>{["เวลาไทย", "เหตุการณ์", "เลขเรื่อง", "บัญชีพลเมือง", "IP", "พื้นที่โดยประมาณ", "เบราว์เซอร์ / ระบบ"].map(
                (heading) => <th key={heading} scope="col" className="p-2">{heading}</th>,
              )}</tr>
            </thead>
            <tbody>{events.map((event) => (
              <tr key={event.id} className="border-t border-slate-200 align-top dark:border-slate-700">
                <td className="p-2 whitespace-nowrap">{thaiTime.format(new Date(event.occurred_at))}</td>
                <td className="p-2">{event.event_type === "submitted" ? "แจ้งเหตุ" : "เปลี่ยนสถานะ"} · {statuses[event.status] ?? event.status}</td>
                <td className="p-2">{event.report_id}</td>
                <td className="p-2">{event.citizen_user_id ?? "ผู้แจ้งทั่วไป"}</td>
                <td className="p-2">{event.context?.ip || "—"}</td>
                <td className="p-2">{[event.context?.city, event.context?.country].filter(Boolean).join(", ") || "—"}</td>
                <td className="min-w-48 p-2 break-words">{event.context?.browser || "—"}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </details>
  );
}
