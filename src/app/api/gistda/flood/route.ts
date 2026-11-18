import { NextRequest, NextResponse } from "next/server";

const ALLOWED_PERIODS = new Set([
  "1day",
  "3days",
  "7days",
  "30days",
  "flood-freq",
  "water-hyacinth",
]);
const GISTDA_PORTAL_URL = "https://disaster.gistda.or.th/services/open-api";

export interface GistdaFloodCentroid {
  id: string;
  coord: [number, number];
  areaLabel: string;
  provinceName: string;
  districtName: string;
  subdistrictName: string;
  updatedAt: string;
  areaRai?: number;
}

interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}

const FLOOD_RESPONSE_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

function extractRingCentroid(ring: unknown): [number, number] | null {
  if (!Array.isArray(ring) || ring.length === 0) return null;
  let sumLng = 0;
  let sumLat = 0;
  let count = 0;
  for (const pt of ring) {
    if (Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1])) {
      sumLng += Number(pt[0]);
      sumLat += Number(pt[1]);
      count += 1;
    }
  }
  return count > 0 ? [sumLng / count, sumLat / count] : null;
}

function extractGeometryCentroid(geometry: GeoJSON.Geometry | null | undefined): [number, number] | null {
  if (!geometry) return null;
  if (geometry.type === "Point") {
    const [lng, lat] = geometry.coordinates;
    return Number.isFinite(lng) && Number.isFinite(lat) ? [lng, lat] : null;
  }
  if (geometry.type === "MultiPoint" || geometry.type === "LineString") {
    return extractRingCentroid(geometry.coordinates);
  }
  if (geometry.type === "MultiLineString") {
    return extractRingCentroid(geometry.coordinates[0]);
  }
  if (geometry.type === "Polygon") {
    return extractRingCentroid(geometry.coordinates[0]);
  }
  if (geometry.type === "MultiPolygon") {
    return extractRingCentroid(geometry.coordinates[0]?.[0]);
  }
  if (geometry.type === "GeometryCollection") {
    for (const g of geometry.geometries) {
      const c = extractGeometryCentroid(g);
      if (c) return c;
    }
  }
  return null;
}

function pickString(props: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = props[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function pickNumber(props: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    const v = Number(props[k]);
    if (Number.isFinite(v) && v > 0) return Math.round(v * 10) / 10;
  }
  return undefined;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawPeriod = searchParams.get("period") ?? "7days";
  const period = ALLOWED_PERIODS.has(rawPeriod) ? rawPeriod : "7days";

  const rawLimit = Number(searchParams.get("limit") ?? "120");
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(250, Math.round(rawLimit))) : 120;

  const rawBbox = searchParams.get("bbox")?.trim() ?? "";
  let validBbox = "";
  if (rawBbox) {
    const parts = rawBbox.split(",").map((s) => Number(s.trim()));
    if (parts.length === 4 && parts.every((n) => Number.isFinite(n))) {
      validBbox = parts.map((n) => n.toFixed(3)).join(",");
    }
  }

  const upstreamPath =
    period === "flood-freq"
      ? "https://api-gateway.gistda.or.th/api/2.0/resources/features/flood-freq"
      : period === "water-hyacinth"
        ? "https://api-gateway.gistda.or.th/api/2.0/resources/features/water_hyacinth"
        : `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${period}`;

  const apiKey =
    process.env.GISTDA_API_KEY?.trim() ||
    req.headers.get("x-gistda-api-key")?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      requiresApiKey: true,
      source: "gistda",
      period,
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: upstreamPath,
      featureCollection: null,
      centroids: [] as GistdaFloodCentroid[],
      message:
        "กรุณาระบุ GISTDA API Key เพื่อดึงข้อมูลพื้นที่น้ำท่วมจริงจาก GISTDA Disaster Open API",
    });
  }

  const supportsServerBbox = period !== "flood-freq";
  const effectiveLimit = supportsServerBbox ? limit : Math.min(limit, 80);
  const effectiveBbox = supportsServerBbox ? validBbox : "";

  const keySuffix = apiKey.slice(-4);
  const cacheKey = `${period}|${effectiveBbox}|${effectiveLimit}|${apiKey.length}:${keySuffix}`;
  const cached = FLOOD_RESPONSE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=180" },
    });
  }

  const targetUrl = new URL(upstreamPath);
  targetUrl.searchParams.set("api_key", apiKey);
  targetUrl.searchParams.set("limit", String(effectiveLimit));
  // Note: GISTDA /features/flood-freq times out (HTTP 504) when bbox is passed
  if (effectiveBbox) {
    targetUrl.searchParams.set("bbox", effectiveBbox);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityPulseThailand/1.0",
        Accept: "application/geo+json, application/json",
      },
      cache: "no-store",
    });

    if (res.status === 401 || res.status === 403 || res.status === 407) {
      return NextResponse.json({
        ok: false,
        authError: true,
        status: res.status,
        source: "gistda",
        period,
        portalUrl: GISTDA_PORTAL_URL,
        endpoint: upstreamPath,
        featureCollection: null,
        centroids: [] as GistdaFloodCentroid[],
        message: "GISTDA API Key ไม่ถูกต้องหรือยังไม่ได้รับสิทธิ์ กรุณาตรวจสอบคีย์ที่ api-gateway.gistda.or.th",
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        source: "gistda",
        period,
        portalUrl: GISTDA_PORTAL_URL,
        endpoint: upstreamPath,
        featureCollection: null,
        centroids: [] as GistdaFloodCentroid[],
        message: `GISTDA Open API ตอบกลับสถานะ HTTP ${res.status}`,
      });
    }

    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const rawText = await res.text();
    let rawJson: {
      type?: string;
      timeStamp?: string;
      numberMatched?: number;
      features?: GeoJSON.Feature[];
    };
    try {
      rawJson = JSON.parse(rawText) as typeof rawJson;
    } catch {
      return NextResponse.json({
        ok: false,
        status: res.status,
        source: "gistda",
        period,
        portalUrl: GISTDA_PORTAL_URL,
        endpoint: upstreamPath,
        featureCollection: null,
        centroids: [] as GistdaFloodCentroid[],
        message: contentType.includes("html")
          ? "GISTDA Open API ส่งหน้า HTML กลับมาแทน GeoJSON"
          : "ไม่สามารถอ่านข้อมูล GeoJSON จาก GISTDA Open API ได้",
      });
    }

    const features = Array.isArray(rawJson.features) ? rawJson.features : [];
    const centroids: GistdaFloodCentroid[] = [];

    features.forEach((f, idx) => {
      const coord = extractGeometryCentroid(f.geometry);
      if (!coord) return;
      const props = (f.properties ?? {}) as Record<string, unknown>;
      const subdistrictName = pickString(props, [
        "subdistrict_name",
        "tb_tn",
        "tam_nam_t",
        "tambon_t",
        "t_name_t",
      ]);
      const districtName = pickString(props, [
        "district_name",
        "ap_tn",
        "amp_nam_t",
        "amphoe_t",
        "a_name_t",
      ]);
      const provinceName = pickString(props, [
        "province_name",
        "pv_tn",
        "prov_nam_t",
        "changwat_t",
        "p_name_t",
      ]);
      const updatedAtRaw = pickString(props, [
        "_updatedAt",
        "update",
        "updated",
        "date_flood",
        "flood_date",
        "acq_date",
        "timestamp",
      ]);
      const updatedAt = updatedAtRaw ? updatedAtRaw.slice(0, 10) : "";
      const areaRaiDirect = pickNumber(props, ["area_rai", "rai"]);
      const areaSqm = pickNumber(props, ["f_area", "_area", "shape_area"]);
      const areaRai =
        areaRaiDirect ??
        (areaSqm !== undefined ? Math.round((areaSqm / 1600) * 10) / 10 : undefined);
      const floodFreq = pickNumber(props, ["freq"]);
      const satelliteFile = pickString(props, ["file_name", "source_name"]);
      const waterName = pickString(props, ["namt", "sb_name_t", "mbasin_t"]);

      const areaParts = [
        waterName ? `ผักตบชวา ${waterName}` : "",
        subdistrictName,
        districtName,
        provinceName,
      ].filter(Boolean);
      const areaLabel =
        areaParts.join(" · ") ||
        (period === "water-hyacinth"
          ? "จุดตรวจพบผักตบชวา/กีดขวางทางน้ำ (GISTDA)"
          : "พื้นที่ตรวจพบน้ำท่วม (GISTDA)");

      // Normalize display properties on each feature for MapLibre inspection
      f.properties = {
        ...props,
        __areaLabel: areaLabel,
        __updatedAt: updatedAt,
        __areaRai: areaRai ?? null,
        __freq: floodFreq ?? null,
        __fileName: satelliteFile || null,
      };

      centroids.push({
        id: String(f.id ?? `gistda-flood-${idx}`),
        coord,
        areaLabel,
        provinceName,
        districtName,
        subdistrictName,
        updatedAt,
        areaRai,
      });
    });

    const featureCollection: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features,
    };

    const payload = {
      ok: true,
      source: "gistda",
      period,
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: upstreamPath,
      timeStamp: rawJson.timeStamp ?? new Date().toISOString(),
      numberMatched: rawJson.numberMatched ?? features.length,
      featureCollection,
      centroids,
    };

    FLOOD_RESPONSE_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=180" },
    });
  } catch (err) {
    const isAbort = err instanceof Error && err.name === "AbortError";
    return NextResponse.json({
      ok: false,
      source: "gistda",
      period,
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: upstreamPath,
      featureCollection: null,
      centroids: [] as GistdaFloodCentroid[],
      message: isAbort
        ? "เชื่อมต่อ GISTDA Open API เกินเวลาที่กำหนด"
        : "ไม่สามารถเชื่อมต่อ GISTDA Open API ได้ในขณะนี้",
    });
  } finally {
    clearTimeout(timeout);
  }
}

