"use client";

import { Component, useState, type FormEvent, type ReactNode } from "react";

type MapBoundaryProps = { children: ReactNode; fallback: ReactNode };

export class MapBoundary extends Component<MapBoundaryProps, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MapFallback({
  onChooseCoordinates,
  onOpenGpsForm,
}: {
  onChooseCoordinates: (coordinates: [number, number]) => void;
  onOpenGpsForm: () => void;
}) {
  const [error, setError] = useState("");

  function submitCoordinates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const fields = new FormData(event.currentTarget);
    const lat = String(fields.get("latitude") ?? "").trim();
    const lng = String(fields.get("longitude") ?? "").trim();
    const latitude = Number(lat);
    const longitude = Number(lng);
    if (!lat || !lng || !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
      Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      setError("กรุณากรอกพิกัดละติจูดและลองจิจูดให้ถูกต้อง");
      return;
    }
    setError("");
    onChooseCoordinates([longitude, latitude]);
  }

  return (
    <section className="absolute inset-0 flex items-center justify-center px-4 py-28 md:pl-80">
      <div className="max-h-full w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 text-slate-900 shadow-lg">
        <h2 className="text-lg font-bold">แผนที่เปิดไม่ได้</h2>
        <p className="mt-2 text-sm text-slate-600">
          คุณยังแจ้งเหตุได้โดยใช้ GPS หรือกรอกพิกัดสถานที่เกิดเหตุ
        </p>
        <button type="button" onClick={onOpenGpsForm}
          className="mt-4 w-full rounded-lg bg-sky-700 px-3 py-2 font-semibold text-white">
          เปิดฟอร์มเพื่อใช้ GPS
        </button>
        <form onSubmit={submitCoordinates} className="mt-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">ละติจูด
              <input name="latitude" required type="number" inputMode="decimal" step="any"
                min="-90" max="90" className="mt-1 w-full rounded-lg border border-slate-400 px-2 py-2" />
            </label>
            <label className="text-sm font-medium">ลองจิจูด
              <input name="longitude" required type="number" inputMode="decimal" step="any"
                min="-180" max="180" className="mt-1 w-full rounded-lg border border-slate-400 px-2 py-2" />
            </label>
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button className="w-full rounded-lg border border-slate-400 px-3 py-2 font-semibold">
            ใช้พิกัดนี้และเปิดฟอร์ม
          </button>
        </form>
      </div>
    </section>
  );
}
