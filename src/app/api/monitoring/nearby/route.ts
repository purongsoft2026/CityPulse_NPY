import { NextRequest, NextResponse } from "next/server";
import { CCTV_POINTS, haversineDistanceKm, type CctvPoint } from "@/data/map-data";

interface MonitoringCacheEntry {
  expiresAt: number;
  payload: {
    ok: boolean;
    source: "osm-meteo-live" | "fallback";
    center: [number, number];
    riverDischargeM3s: number | null;
    points: CctvPoint[];
  };
}

const MONITORING_CACHE = new Map<string, MonitoringCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes
const USER_AGENT = "CityPulseThailand/1.0 (civic-monitoring-locator)";

interface PhotonFeature {
  geometry?: {
    type?: string;
    coordinates?: [number, number];
  };
  properties?: {
    osm_id?: number;
    osm_key?: string;
    osm_value?: string;
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    countrycode?: string;
  };
}

const MONITORING_THUMBNAILS = {
  water: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
  bridge: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=600&q=80",
  traffic: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80",
};

function formatLocation(p: NonNullable<PhotonFeature["properties"]>): string {
  const parts = [p.street, p.district || p.locality, p.county || p.city, p.state]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  return Array.from(new Set(parts)).join(" · ") || "ประเทศไทย";
}

function classifyWaterStatus(dischargeM3s: number | null): {
  status: CctvPoint["status"];
  waterLevelText: string;
} {
  if (dischargeM3s === null) {
    return {
      status: "normal",
      waterLevelText: "ปกติ (ติดตามผ่าน Open-Meteo)",
    };
  }
  if (dischargeM3s >= 800) {
    return {
      status: "alert",
      waterLevelText: `${dischargeM3s.toFixed(1)} ม.³/วิ (มวลน้ำสูง เฝ้าระวัง)`,
    };
  }
  if (dischargeM3s >= 250) {
    return {
      status: "warning",
      waterLevelText: `${dischargeM3s.toFixed(1)} ม.³/วิ (น้ำหลากปานกลาง)`,
    };
  }
  return {
    status: "normal",
    waterLevelText: `${dischargeM3s.toFixed(1)} ม.³/วิ (ระดับน้ำปกติ)`,
  };
}

async function queryPhotonSpots(
  query: string,
  lat: number,
  lng: number,
  deltaDeg: number,
  limit: number,
  kind: "water" | "bridge" | "traffic",
  dischargeM3s: number | null,
  signal: AbortSignal,
): Promise<CctvPoint[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", query);
  url.searchParams.set("lat", lat.toFixed(5));
  url.searchParams.set("lon", lng.toFixed(5));
  url.searchParams.set(
    "bbox",
    `${(lng - deltaDeg).toFixed(4)},${(lat - deltaDeg).toFixed(4)},${(lng + deltaDeg).toFixed(4)},${(lat + deltaDeg).toFixed(4)}`,
  );
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    signal,
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) return [];
  const text = await res.text();
  if (!text.trim().startsWith("{")) return [];
  const json = JSON.parse(text) as { features?: PhotonFeature[] };
  const features = json.features ?? [];

  const waterInfo = classifyWaterStatus(dischargeM3s);
  const out: CctvPoint[] = [];

  for (const f of features) {
    const props = f.properties ?? {};
    if (props.countrycode && props.countrycode.toUpperCase() !== "TH") continue;
    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [rLng, rLat] = coords;
    if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;

    const rawName = props.name?.trim();
    if (!rawName) continue;

    const osmKey = (props.osm_key ?? "").toLowerCase();
    if (osmKey === "shop" || osmKey === "amenity" || osmKey === "leisure") continue;

    const prefix =
      kind === "water"
        ? "จุดตรวจวัดน้ำ · "
        : kind === "bridge"
          ? "จุดเฝ้าระวังริมน้ำ · "
          : "จุดตรวจจราจร · ";

    out.push({
      id: `live-mon-${kind}-${props.osm_id ?? `${rLat.toFixed(4)}-${rLng.toFixed(4)}`}`,
      name: rawName.startsWith("จุด") ? rawName : `${prefix}${rawName}`,
      locationName: formatLocation(props),
      coordinates: [rLng, rLat],
      status: kind === "traffic" ? "normal" : waterInfo.status,
      waterLevel: kind === "traffic" ? undefined : waterInfo.waterLevelText,
      trafficCondition: kind === "traffic" ? "moderate" : "smooth",
      snapshotUrl: MONITORING_THUMBNAILS[kind],
      lastUpdated: "ข้อมูลล่าสุด (OSM & Open-Meteo)",
    });
  }
  return out;
}

async function fetchRiverDischarge(
  lat: number,
  lng: number,
  signal: AbortSignal,
): Promise<number | null> {
  try {
    const res = await fetch(
      `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=1`,
      { signal },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: { river_discharge?: (number | null)[] };
    };
    const val = json.daily?.river_discharge?.[0];
    return typeof val === "number" && Number.isFinite(val) ? Number(val.toFixed(2)) : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat") ?? "13.7563");
  const lng = Number(searchParams.get("lng") ?? "100.5018");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({
      ok: false,
      source: "fallback" as const,
      center: [100.5018, 13.7563] as [number, number],
      riverDischargeM3s: null,
      points: CCTV_POINTS,
    });
  }

  const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}`;
  const cached = MONITORING_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  const center: [number, number] = [lng, lat];

  try {
    const [dischargeM3s, damRes, bridgeRes, gateRes] = await Promise.all([
      fetchRiverDischarge(lat, lng, controller.signal),
      queryPhotonSpots("เขื่อน", lat, lng, 0.45, 5, "water", null, controller.signal),
      queryPhotonSpots("สะพาน", lat, lng, 0.22, 6, "bridge", null, controller.signal),
      queryPhotonSpots("ประตูระบายน้ำ", lat, lng, 0.35, 5, "water", null, controller.signal),
    ]);

    const waterInfo = classifyWaterStatus(dischargeM3s);
    const livePoints = [...damRes, ...gateRes, ...bridgeRes].map((pt) => ({
      ...pt,
      status: waterInfo.status,
      waterLevel: waterInfo.waterLevelText,
    }));

    const nearbyCurated = CCTV_POINTS.filter(
      (pt) => haversineDistanceKm(center, pt.coordinates) <= 30,
    );

    const merged: CctvPoint[] = [];
    for (const pt of [...nearbyCurated, ...livePoints]) {
      const dup = merged.some(
        (m) => haversineDistanceKm(m.coordinates, pt.coordinates) < 0.15,
      );
      if (!dup) merged.push(pt);
    }

    const finalPoints =
      merged.length > 0
        ? merged
            .sort(
              (a, b) =>
                haversineDistanceKm(center, a.coordinates) -
                haversineDistanceKm(center, b.coordinates),
            )
            .slice(0, 16)
        : CCTV_POINTS;

    const payload = {
      ok: true,
      source: (livePoints.length > 0 || dischargeM3s !== null ? "osm-meteo-live" : "fallback") as
        | "osm-meteo-live"
        | "fallback",
      center,
      riverDischargeM3s: dischargeM3s,
      points: finalPoints,
    };

    MONITORING_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      source: "fallback" as const,
      center,
      riverDischargeM3s: null,
      points: CCTV_POINTS,
    });
  } finally {
    clearTimeout(timeout);
  }
}
