"use client";

import { useEffect, useState } from "react";
import { THAILAND_PROVINCES } from "@/data/map-data";

export function ReportProvinceSettings() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[] | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch("/api/admin/report-provinces", { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load settings");
        const data = await response.json();
        setSelected(data.provinces);
      }).catch(() => {
        if (!controller.signal.aborted) setMessage("โหลดการตั้งค่าไม่สำเร็จ");
      });
    return () => controller.abort();
  }, [open]);

  async function save() {
    if (!selected || saving) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/report-provinces", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provinces: selected }),
      });
      setMessage(response.ok ? "บันทึกจังหวัดที่เปิดรับแจ้งแล้ว" : "บันทึกไม่สำเร็จ กรุณาลองใหม่");
    } catch { setMessage("บันทึกไม่สำเร็จ กรุณาลองใหม่"); }
    finally { setSaving(false); }
  }

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)}
      className="rounded-2xl border border-slate-300 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <summary className="cursor-pointer font-semibold">จังหวัดที่เปิดรับแจ้งเหตุ</summary>
      <p className="my-2 text-sm">จังหวัดที่ไม่ติ๊กยังดูแผนที่ได้ หากไม่เลือกเลย ระบบจะปิดรับแจ้งทุกจังหวัด</p>
      {selected ? (
        <fieldset disabled={saving} className="space-y-3">
          <div className="flex flex-wrap gap-3 text-sm">
            <button type="button" onClick={() => setSelected([...THAILAND_PROVINCES])}>เลือกทั้งหมด</button>
            <button type="button" onClick={() => setSelected([])}>ล้างการเลือก</button>
            <span>เลือก {selected.length} จังหวัด</span>
          </div>
          <div className="grid max-h-64 grid-cols-2 gap-2 overflow-auto sm:grid-cols-4">
            {[...THAILAND_PROVINCES].sort((a, b) => a.localeCompare(b, "th")).map((province) => (
              <label key={province} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={selected.includes(province)} onChange={(event) => {
                  const checked = event.currentTarget.checked;
                  setSelected((previous) => !previous ? previous : checked
                    ? [...previous, province] : previous.filter((item) => item !== province));
                  setMessage("");
                }} />
                {province}
              </label>
            ))}
          </div>
          <button type="button" onClick={save}
            className="rounded-lg bg-sky-700 px-4 py-2 font-semibold text-white disabled:opacity-60">
            {saving ? "กำลังบันทึก" : "บันทึกจังหวัด"}
          </button>
        </fieldset>
      ) : !message && <p className="text-sm">กำลังโหลดการตั้งค่า</p>}
      {message && <p role="status" className="mt-2 text-sm">{message}</p>}
    </details>
  );
}
