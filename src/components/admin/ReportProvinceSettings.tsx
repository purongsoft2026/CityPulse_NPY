"use client";

import { useEffect, useState } from "react";
import { PROVINCE_GROUPS, THAILAND_PROVINCES } from "@/data/map-data";

const provinceGroups = PROVINCE_GROUPS.map(({ region, provinces }) => ({
  region,
  provinces: [...provinces].sort((a, b) => a.localeCompare(b, "th")),
}));

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

  function updateSelection(provinces: string[], checked: boolean) {
    setSelected((previous) => {
      if (!previous) return previous;
      return checked
        ? Array.from(new Set([...previous, ...provinces]))
        : previous.filter((province) => !provinces.includes(province));
    });
    setMessage("");
  }

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
            <button type="button" onClick={() => updateSelection(THAILAND_PROVINCES, true)}>เลือกทั้งหมด</button>
            <button type="button" onClick={() => updateSelection(THAILAND_PROVINCES, false)}>ล้างการเลือก</button>
            <span>เลือก {selected.length} จังหวัด</span>
          </div>
          <div className="max-h-96 space-y-3 overflow-auto pr-2">
            {provinceGroups.map(({ region, provinces }) => {
              const selectedCount = provinces.filter((province) => selected.includes(province)).length;
              return (
                <fieldset key={region} className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                  <legend className="px-1 text-sm font-semibold">
                    {region} <span className="font-normal">({selectedCount}/{provinces.length})</span>
                  </legend>
                  <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={selectedCount === provinces.length}
                      ref={(input) => {
                        if (input) input.indeterminate = selectedCount > 0 && selectedCount < provinces.length;
                      }}
                      onChange={(event) => updateSelection(provinces, event.currentTarget.checked)}
                    />
                    เลือกทั้ง{region}
                  </label>
                  <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-4">
                    {provinces.map((province) => (
                      <label key={province} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={selected.includes(province)}
                          onChange={(event) => updateSelection([province], event.currentTarget.checked)}
                        />
                        {province}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
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
