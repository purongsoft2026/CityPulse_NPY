"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NEARBY_PLACE_CATEGORIES, type NearbyCategory, type NearbyPlace } from "@/lib/nearby-places";

export function NearbyPlacesDialog({ center, onClose }: {
  center: [number, number];
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [category, setCategory] = useState<NearbyCategory>("fuel");
  const [radius, setRadius] = useState(5);
  const [gps, setGps] = useState<[number, number]>();
  const [gpsMessage, setGpsMessage] = useState("");
  const [results, setResults] = useState<{ key: string; places: NearbyPlace[]; error?: string }>();
  const [retry, setRetry] = useState(0);
  const [lng, lat] = gps ?? center;
  const key = `${lat}|${lng}|${category}|${radius}|${retry}`;

  const locate = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsMessage("อุปกรณ์นี้ไม่รองรับ GPS");
      return;
    }
    setGpsMessage("กำลังหาตำแหน่ง…");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setGps([coords.longitude, coords.latitude]);
        setGpsMessage("");
      },
      () => setGpsMessage("รับตำแหน่งไม่ได้ กรุณาตรวจสอบสิทธิ์ GPS"),
      { timeout: 8000, maximumAge: 15000, enableHighAccuracy: true },
    );
  }, []);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    let active = true;
    void navigator.permissions?.query({ name: "geolocation" }).then(({ state }) => {
      if (active && state === "granted") locate();
    }).catch(() => {});
    return () => {
      active = false;
      element?.close();
    };
  }, [locate]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ lat: lat.toFixed(5), lng: lng.toFixed(5), category, radius: String(radius) });
    async function load() {
      try {
        const response = await fetch(`/api/places/nearby?${params}`, { signal: controller.signal });
        const data = await response.json();
        if (!controller.signal.aborted) {
          setResults(response.ok ? { key, places: data.places } : { key, places: [], error: data.error });
        }
      } catch {
        if (!controller.signal.aborted) setResults({ key, places: [], error: "โหลดข้อมูลไม่ได้ กรุณาลองใหม่" });
      }
    }
    void load();
    return () => controller.abort();
  }, [key, lat, lng, category, radius]);

  const visible = results?.key === key ? results : undefined;

  return (
    <dialog ref={dialog} onCancel={onClose} aria-labelledby="nearby-title"
      className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-1.5rem)] max-w-lg rounded-2xl bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-black/60 dark:bg-slate-900 dark:text-white">
      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="nearby-title" className="text-lg font-bold">ค้นหาใกล้ตัว</h2>
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">ปิด</button>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={locate} className="rounded-lg bg-teal-700 px-3 py-2 font-semibold text-white">ใช้ตำแหน่งของฉัน</button>
          <span>{gps ? "ค้นหารอบพิกัด GPS" : "ค้นหารอบจุดบนแผนที่"}</span>
          {gpsMessage && <p role="status" className="basis-full">{gpsMessage}</p>}
        </div>
        <div className="flex flex-wrap gap-2" aria-label="หมวดสถานที่">
          {(Object.entries(NEARBY_PLACE_CATEGORIES) as [NearbyCategory, string][]).map(([id, label]) => (
            <button key={id} type="button" aria-pressed={category === id} onClick={() => setCategory(id)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm aria-pressed:bg-slate-900 aria-pressed:text-white dark:aria-pressed:bg-teal-700">{label}</button>
          ))}
          <label className="flex items-center gap-2 text-sm">รัศมี
            <select value={radius} onChange={(event) => setRadius(Number(event.target.value))}
              className="rounded-lg border border-slate-300 bg-transparent p-2">
              {[2, 5, 10].map((km) => <option key={km} value={km}>{km} กม.</option>)}
            </select>
          </label>
        </div>
        {!visible && <p role="status" className="text-sm">กำลังค้นหาสถานที่…</p>}
        {visible?.error && <p role="alert" className="text-sm">{visible.error} <button type="button" onClick={() => setRetry(retry + 1)} className="underline">ลองใหม่</button></p>}
        {visible?.error && (
          <a target="_blank" rel="noreferrer" className="inline-block text-sm font-semibold text-teal-700 underline dark:text-teal-300"
            href={`https://www.google.com/maps/search/${encodeURIComponent(NEARBY_PLACE_CATEGORIES[category])}/@${lat},${lng},14z`}>
            ค้นหาหมวดนี้ใน Google Maps
          </a>
        )}
        {visible && !visible.error && visible.places.length === 0 && <p className="text-sm">ไม่พบสถานที่ในรัศมีที่เลือก</p>}
        <ul className="divide-y divide-slate-200 dark:divide-slate-700">
          {visible?.places.map((place) => (
            <li key={place.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="break-words font-semibold">{place.name}</p>
                <p className="text-sm">ห่าง {place.distanceKm.toFixed(1)} กม.{place.address ? ` · ${place.address}` : ""}</p>
              </div>
              <a className="shrink-0 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white"
                href={`https://www.google.com/maps/dir/?api=1&destination=${place.coordinates[1]},${place.coordinates[0]}`}
                target="_blank" rel="noreferrer">นำทาง</a>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-300">ข้อมูลจาก © OpenStreetMap contributors · ระยะทางเส้นตรง</p>
      </div>
    </dialog>
  );
}
