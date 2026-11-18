import { NextRequest, NextResponse } from "next/server";
import {
  EMERGENCY_POINTS,
  haversineDistanceKm,
  type EmergencyPoint,
} from "@/data/map-data";

import { NARATHIWAT_EMERGENCY_POINTS } from "@/data/narathiwat-emergency";

interface EmergencyCacheEntry {
  expiresAt: number;
  payload: {
    ok: boolean;
    source: "osm-live" | "fallback";
    center: [number, number];
    areaLabel: string;
    points: EmergencyPoint[];
  };
}

const EMERGENCY_CACHE = new Map<string, EmergencyCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 30; // 30 minutes
const USER_AGENT = "CityPulseThailand/1.0 (civic-emergency-locator)";

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

interface OverpassElement {
  id: number;
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function formatPhotonAddress(p: NonNullable<PhotonFeature["properties"]>): string {
  const parts = [p.street, p.district || p.locality, p.county || p.city, p.state]
    .map((s) => s?.trim())
    .filter((s): s is string => Boolean(s));
  const unique = Array.from(new Set(parts));
  return unique.join(" · ") || "ประเทศไทย (OpenStreetMap)";
}

async function queryPhotonCategory(
  query: string,
  lat: number,
  lng: number,
  deltaDeg: number,
  limit: number,
  acceptedValues: Set<string>,
  mappedType: EmergencyPoint["type"],
  signal: AbortSignal,
): Promise<EmergencyPoint[]> {
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

  const points: EmergencyPoint[] = [];
  for (const f of features) {
    const props = f.properties ?? {};
    if (props.countrycode && props.countrycode.toUpperCase() !== "TH") continue;

    const coords = f.geometry?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const [rLng, rLat] = coords;
    if (!Number.isFinite(rLat) || !Number.isFinite(rLng)) continue;

    const osmKey = (props.osm_key ?? "").toLowerCase();
    const osmVal = (props.osm_value ?? "").toLowerCase();
    if (!acceptedValues.has(osmVal) && !(mappedType === "hospital" && osmKey === "healthcare")) {
      continue;
    }
    if (osmVal === "veterinary" || osmVal === "park" || osmVal === "shelter") continue;

    const name = props.name?.trim();
    if (!name) continue;

    points.push({
      id: `osm-${mappedType}-${props.osm_id ?? `${rLat.toFixed(4)}-${rLng.toFixed(4)}`}`,
      name,
      type: mappedType,
      locationName: formatPhotonAddress(props),
      coordinates: [rLng, rLat],
      instruction:
        mappedType === "hospital"
          ? "หน่วยแพทย์ฉุกเฉิน/โรงพยาบาลในพื้นที่ (OpenStreetMap)"
          : mappedType === "police"
            ? "สถานีตำรวจ/จุดบริการประชาชนในพื้นที่"
            : "หน่วยป้องกันและบรรเทาสาธารณภัย",
      is24h: false,
    });
  }

  return points;
}

async function queryOverpassServices(
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<EmergencyPoint[]> {
  const area = `(around:${radiusMeters},${lat},${lng})`;
  const query = `[out:json][timeout:5];(
    nwr["amenity"~"^(hospital|police|fire_station)$"]${area};
    nwr["emergency"~"^(ambulance_station|rescue_station|defibrillator)$"]${area};
    nwr["healthcare"="hospital"]${area};
    nwr["amenity"~"^(ambulance_station|rescue_station)$"]${area};
    nwr["office"="ngo"]["name"~"กู้ภัย|กู้ชีพ"]${area};
  );out center 160;`;
  const mirrors = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
  ];

  for (const endpoint of mirrors) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.trim().startsWith("{")) continue;
      const json = JSON.parse(text) as { elements?: OverpassElement[] };
      const elements = json.elements ?? [];
      return elements
        .map((el): EmergencyPoint | null => {
          const eLat = el.lat ?? el.center?.lat;
          const eLng = el.lon ?? el.center?.lon;
          if (typeof eLat !== "number" || typeof eLng !== "number") return null;
          const tags = el.tags ?? {};
          const types: Record<string, EmergencyPoint["type"]> = {
            hospital: "hospital", police: "police", fire_station: "fire_station",
            ambulance_station: "rescue", rescue_station: "rescue", defibrillator: "aed",
          };
          const type = types[tags.emergency] ?? types[tags.amenity] ??
            (tags.healthcare === "hospital" ? "hospital" :
              tags.office === "ngo" && /กู้ภัย|กู้ชีพ/.test(tags.name ?? "") ? "rescue" : undefined);
          if (!type) return null;
          const name = tags["name:th"] || tags.name || tags["defibrillator:location"] ||
            (type === "aed" ? "จุดติดตั้งเครื่องกระตุกหัวใจ AED" : "");
          if (!name) return null;
          const rawPhone = (tags["contact:phone"] || tags.phone || "").split(";")[0].trim();
          const digits = rawPhone.replace(/[\s().-]/g, "");
          const phone = /^\+?\d{7,15}$/.test(digits) ? rawPhone : undefined;
          const address = [tags["addr:housenumber"], tags["addr:street"],
            tags["addr:subdistrict"], tags["addr:district"], tags["addr:province"]].filter(Boolean).join(" ");
          return {
            id: `osm-${type}-${el.type}-${el.id}`,
            name, type, locationName: address || tags["defibrillator:location"] || "OpenStreetMap",
            coordinates: [eLng, eLat], phone,
            instruction: type === "aed" && tags.indoor === "yes" ? "ติดตั้งภายในอาคาร" : undefined,
            is24h: tags.opening_hours === "24/7",
          };
        })
        .filter((item): item is EmergencyPoint => item !== null);
    } catch {
      // try next mirror
    }
  }
  return [];
}

function deduplicatePoints(
  points: EmergencyPoint[],
  center: [number, number],
  maxRadiusKm: number,
): EmergencyPoint[] {
  const kept: EmergencyPoint[] = [];
  for (const pt of points) {
    if (haversineDistanceKm(center, pt.coordinates) > maxRadiusKm) continue;
    const normName = pt.name.replace(/\s+/g, "").toLowerCase();
    const isDup = kept.some((existing) => {
      if (existing.type !== pt.type) return false;
      const distKm = haversineDistanceKm(existing.coordinates, pt.coordinates);
      const exName = existing.name.replace(/\s+/g, "").toLowerCase();
      return (!existing.locationApproximate && !pt.locationApproximate && distKm < 0.08) || (distKm < 0.45 && (exName.includes(normName) || normName.includes(exName)));
    });
    if (!isDup) kept.push(pt);
  }
  return kept.sort(
    (a, b) => haversineDistanceKm(center, a.coordinates) - haversineDistanceKm(center, b.coordinates),
  );
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = Number(searchParams.get("lat") ?? "13.7563");
  const lng = Number(searchParams.get("lng") ?? "100.5018");
  const radiusKm = Math.min(40, Math.max(5, Number(searchParams.get("radiusKm") ?? "20") || 20));

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json(
      { ok: false, source: "fallback", center: [100.5018, 13.7563], areaLabel: "ประเทศไทย", points: [] },
      { status: 400 },
    );
  }

  const cacheKey = `${lat.toFixed(5)}|${lng.toFixed(5)}|${radiusKm}`;
  const cached = EMERGENCY_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7500);
  const deltaDeg = Math.min(0.5, Math.max(0.16, radiusKm / 95));
  const center: [number, number] = [lng, lat];

  try {
    const [hospRes, policeRes, fireRes, rescueRes, overpassRes] = await Promise.allSettled([
      queryPhotonCategory(
        "โรงพยาบาล",
        lat,
        lng,
        deltaDeg,
        15,
        new Set(["hospital", "clinic"]),
        "hospital",
        controller.signal,
      ),
      queryPhotonCategory(
        "สถานีตำรวจ",
        lat,
        lng,
        deltaDeg,
        10,
        new Set(["police"]),
        "police",
        controller.signal,
      ),
      queryPhotonCategory(
        "สถานีดับเพลิง",
        lat,
        lng,
        deltaDeg * 1.4,
        8,
        new Set(["fire_station"]),
        "fire_station",
        controller.signal,
      ),
      queryPhotonCategory(
        "กู้ภัย",
        lat,
        lng,
        deltaDeg,
        15,
        new Set(["ambulance_station", "rescue_station"]),
        "rescue",
        controller.signal,
      ),
      queryOverpassServices(lat, lng, Math.round(radiusKm * 1000)),
    ]);

    const livePoints: EmergencyPoint[] = [
      ...(overpassRes.status === "fulfilled" ? overpassRes.value : []),
      ...(rescueRes.status === "fulfilled" ? rescueRes.value : []),
      ...(hospRes.status === "fulfilled" ? hospRes.value : []),
      ...(policeRes.status === "fulfilled" ? policeRes.value : []),
      ...(fireRes.status === "fulfilled" ? fireRes.value : []),
    ];

    const nearbyCurated = [...NARATHIWAT_EMERGENCY_POINTS, ...EMERGENCY_POINTS].filter(
      (pt) => haversineDistanceKm(center, pt.coordinates) <= 35,
    );

    const combined = deduplicatePoints([...nearbyCurated.filter((pt) => pt.id.startsWith("nara-")), ...livePoints, ...nearbyCurated.filter((pt) => !pt.id.startsWith("nara-"))], center, radiusKm);
    const hasLive = livePoints.length > 0;
    const areaTokens = (livePoints[0]?.locationName ?? "").split(" · ").filter(Boolean);
    const areaLabel = areaTokens.slice(-2).join(" · ") || "พื้นที่ใกล้พิกัดที่เลือก";

    const payload = {
      ok: true,
      source: (hasLive ? "osm-live" : "fallback") as "osm-live" | "fallback",
      center,
      areaLabel,
      points: combined,
    };

    if (EMERGENCY_CACHE.size >= 250) EMERGENCY_CACHE.delete(EMERGENCY_CACHE.keys().next().value!);
    EMERGENCY_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch {
    return NextResponse.json({
      ok: true,
      source: "fallback" as const,
      center,
      areaLabel: "พื้นที่ใกล้พิกัดที่เลือก",
      points: [...NARATHIWAT_EMERGENCY_POINTS, ...EMERGENCY_POINTS].filter((point) => haversineDistanceKm(center, point.coordinates) <= radiusKm),
    });
  } finally {
    clearTimeout(timeout);
  }
}
