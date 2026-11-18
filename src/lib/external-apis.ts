import {
  PROVINCE_GROUPS,
  type CctvPoint,
  type EmergencyPoint,
} from "@/data/map-data";
import {
  getDistrictsForProvince,
  normalizeDistrictKey,
} from "@/data/thailand-districts";
import type { GistdaFloodPeriod } from "@/lib/system-settings";

export interface AirQualityMetrics {
  pm25: number;
  pm10: number;
  usAqi: number;
  uvIndex: number;
  levelLabel: string;
  levelColor: string;
}

export interface FloodDischargeInfo {
  dischargeM3s: number;
  statusLabel: string;
  statusColor: string;
  date: string;
}

export interface Air4ThaiStation {
  id: string;
  nameTH: string;
  nameEN: string;
  areaTH: string;
  coordinates: [number, number];
  pm25: number | null;
  pm10: number | null;
  aqi: number | null;
  colorId: string;
  updatedAt: string;
}

export interface UsgsEarthquakeFeature {
  id: string;
  magnitude: number;
  place: string;
  timeMs: number;
  coordinates: [number, number]; // [lng, lat]
  depthKm: number;
  url: string;
}

export interface OsrmRouteResult {
  coordinates: [number, number][];
  distanceKm: number;
  durationMin: number;
  origin: [number, number];
  destination: [number, number];
  destinationName: string;
  originLabel: string;
}

export interface ReverseGeocodeResult {
  displayName: string;
  shortAddress: string;
  road: string;
  subdistrict: string;
  district: string;
  province: string;
  matchedProvince?: string;
  matchedDistrict?: string;
}

export interface PlaceSearchResult {
  id: string;
  name: string;
  displayName: string;
  province: string;
  center: [number, number];
  type: string;
}

const KNOWN_PROVINCE_NAMES = PROVINCE_GROUPS.flatMap((g) => g.provinces);

export function getAirQualityRating(pm25: number): { label: string; color: string } {
  if (pm25 <= 15) return { label: "ดีมาก", color: "#0ea5e9" };
  if (pm25 <= 25) return { label: "คุณภาพดี", color: "#10b981" };
  if (pm25 <= 37.5) return { label: "ปานกลาง", color: "#f59e0b" };
  if (pm25 <= 75) return { label: "เริ่มมีผลกระทบ", color: "#f97316" };
  return { label: "มีผลกระทบต่อสุขภาพ", color: "#ef4444" };
}

export async function fetchOpenMeteoAirQuality(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<AirQualityMetrics | null> {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lng}&current=pm2_5,pm10,us_aqi,uv_index&timezone=Asia%2FBangkok`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      current?: {
        pm2_5?: number;
        pm10?: number;
        us_aqi?: number;
        uv_index?: number;
      };
    };
    const c = json.current;
    if (!c || typeof c.pm2_5 !== "number") return null;

    const pm25 = Number(c.pm2_5.toFixed(1));
    const rating = getAirQualityRating(pm25);

    return {
      pm25,
      pm10: Math.round(Number(c.pm10 ?? 0)),
      usAqi: Math.round(Number(c.us_aqi ?? 0)),
      uvIndex: Number(Number(c.uv_index ?? 0).toFixed(1)),
      levelLabel: rating.label,
      levelColor: rating.color,
    };
  } catch {
    return null;
  }
}

const FLOOD_CACHE = new Map<string, FloodDischargeInfo>();

export async function fetchOpenMeteoFlood(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<FloodDischargeInfo | null> {
  const key = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  const cached = FLOOD_CACHE.get(key);
  if (cached) return cached;

  try {
    const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${lat}&longitude=${lng}&daily=river_discharge&forecast_days=1`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      daily?: {
        time?: string[];
        river_discharge?: (number | null)[];
      };
    };
    const rawVal = json.daily?.river_discharge?.[0];
    if (typeof rawVal !== "number" || !Number.isFinite(rawVal)) return null;

    const dischargeM3s = Number(rawVal.toFixed(2));
    let statusLabel = "การไหลของน้ำปกติ";
    let statusColor = "#10b981";
    if (dischargeM3s >= 800) {
      statusLabel = "มวลน้ำสูง เฝ้าระวัง";
      statusColor = "#ef4444";
    } else if (dischargeM3s >= 250) {
      statusLabel = "น้ำหลากปานกลาง";
      statusColor = "#f59e0b";
    }

    const result: FloodDischargeInfo = {
      dischargeM3s,
      statusLabel,
      statusColor,
      date: json.daily?.time?.[0] ?? "",
    };
    FLOOD_CACHE.set(key, result);
    return result;
  } catch {
    return null;
  }
}

export async function fetchAir4ThaiStations(
  signal?: AbortSignal,
): Promise<Air4ThaiStation[]> {
  try {
    const res = await fetch("/api/air4thai", { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as { stations?: Air4ThaiStation[] };
    return json.stations ?? [];
  } catch {
    return [];
  }
}

export async function fetchUsgsEarthquakes(
  signal?: AbortSignal,
): Promise<UsgsEarthquakeFeature[]> {
  try {
    const endTime = new Date().toISOString();
    const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const url = `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${encodeURIComponent(startTime)}&endtime=${encodeURIComponent(endTime)}&minlatitude=4&maxlatitude=23&minlongitude=94&maxlongitude=109&minmagnitude=3.0&limit=15`;
    const res = await fetch(url, { signal });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      features?: Array<{
        id: string;
        properties?: {
          mag?: number;
          place?: string;
          time?: number;
          url?: string;
        };
        geometry?: {
          coordinates?: [number, number, number?];
        };
      }>;
    };

    return (json.features ?? [])
      .map((f): UsgsEarthquakeFeature | null => {
        const coords = f.geometry?.coordinates;
        if (!coords || coords.length < 2) return null;
        return {
          id: f.id,
          magnitude: Number((f.properties?.mag ?? 0).toFixed(1)),
          place: f.properties?.place || "บริเวณภูมิภาคอาเซียน",
          timeMs: f.properties?.time ?? Date.now(),
          coordinates: [coords[0], coords[1]],
          depthKm: Math.round(coords[2] ?? 10),
          url: f.properties?.url || "https://earthquake.usgs.gov",
        };
      })
      .filter((item): item is UsgsEarthquakeFeature => item !== null);
  } catch {
    return [];
  }
}

export async function fetchOsrmDrivingRoute(
  origin: [number, number],
  destination: [number, number],
  destinationName: string,
  originLabel: string,
  signal?: AbortSignal,
): Promise<OsrmRouteResult | null> {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: Array<{
        distance?: number;
        duration?: number;
        geometry?: {
          coordinates?: [number, number][];
        };
      }>;
    };
    const route = json.routes?.[0];
    if (!route || !route.geometry?.coordinates?.length) return null;

    return {
      coordinates: route.geometry.coordinates,
      distanceKm: Number(((route.distance ?? 0) / 1000).toFixed(1)),
      durationMin: Math.max(1, Math.round((route.duration ?? 0) / 60)),
      origin,
      destination,
      destinationName,
      originLabel,
    };
  } catch {
    return null;
  }
}

export async function fetchReverseGeocode(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodeResult | null> {
  try {
    const res = await fetch(
      `/api/geocode/reverse?lat=${lat}&lon=${lng}`,
      { signal },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as ReverseGeocodeResult;

    // Match normalized Thai province against our 77 supported provinces
    let matchedProvince: string | undefined;
    if (data.province) {
      const normalized = data.province.replace(/^จังหวัด\s*/, "").trim();
      matchedProvince = KNOWN_PROVINCE_NAMES.find(
        (p) => p === normalized || normalized.includes(p) || p.includes(normalized),
      );
    }

    let matchedDistrict = data.district?.trim() || "";
    if (matchedProvince && matchedDistrict) {
      const cleanDist = normalizeDistrictKey(matchedDistrict);
      const provDistricts = getDistrictsForProvince(matchedProvince);
      const hit = provDistricts.find(
        (d) =>
          d.nameTh === cleanDist ||
          cleanDist.includes(d.nameTh) ||
          d.nameTh.includes(cleanDist),
      );
      if (hit) matchedDistrict = hit.displayTh;
    }

    return {
      ...data,
      matchedProvince,
      matchedDistrict: matchedDistrict || undefined,
    };
  } catch {
    return null;
  }
}

export async function fetchPlaceSearch(
  query: string,
  signal?: AbortSignal,
): Promise<PlaceSearchResult[]> {
  if (query.trim().length < 2) return [];
  try {
    const res = await fetch(
      `/api/geocode/search?q=${encodeURIComponent(query.trim())}`,
      { signal },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: PlaceSearchResult[] };
    return json.results ?? [];
  } catch {
    return [];
  }
}

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

export interface GistdaFloodResponse {
  ok: boolean;
  requiresApiKey?: boolean;
  authError?: boolean;
  status?: number;
  source: "gistda";
  period: GistdaFloodPeriod;
  portalUrl: string;
  endpoint: string;
  timeStamp?: string;
  numberMatched?: number;
  featureCollection: GeoJSON.FeatureCollection | null;
  centroids: GistdaFloodCentroid[];
  message?: string;
}

export async function fetchGistdaFloodFeatures(options: {
  period?: GistdaFloodPeriod;
  bbox?: [number, number, number, number] | null;
  limit?: number;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<GistdaFloodResponse> {
  const { period = "7days", bbox, limit = 120, apiKey, signal } = options;
  const params = new URLSearchParams({
    period,
    limit: String(limit),
  });
  if (bbox) {
    params.set("bbox", bbox.map((n) => n.toFixed(4)).join(","));
  }

  const headers: Record<string, string> = {};
  if (apiKey?.trim()) {
    headers["x-gistda-api-key"] = apiKey.trim();
  }

  try {
    const res = await fetch(`/api/gistda/flood?${params.toString()}`, {
      signal,
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        source: "gistda",
        period,
        portalUrl: "https://disaster.gistda.or.th/services/open-api",
        endpoint: `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${period}`,
        featureCollection: null,
        centroids: [],
        message: `HTTP ${res.status}`,
      };
    }
    return (await res.json()) as GistdaFloodResponse;
  } catch {
    return {
      ok: false,
      source: "gistda",
      period,
      portalUrl: "https://disaster.gistda.or.th/services/open-api",
      endpoint: `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${period}`,
      featureCollection: null,
      centroids: [],
      message: "ไม่สามารถเชื่อมต่อ /api/gistda/flood",
    };
  }
}

export interface NearbyEmergencyResponse {
  ok: boolean;
  source: "osm-live" | "fallback";
  center: [number, number];
  areaLabel: string;
  points: EmergencyPoint[];
}

export async function fetchNearbyEmergencyPoints(
  lat: number,
  lng: number,
  radiusKm = 20,
  signal?: AbortSignal,
): Promise<NearbyEmergencyResponse | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
      radiusKm: String(radiusKm),
    });
    const res = await fetch(`/api/emergency/nearby?${params.toString()}`, {
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as NearbyEmergencyResponse;
  } catch {
    return null;
  }
}

export interface NearbyMonitoringResponse {
  ok: boolean;
  source: "osm-meteo-live" | "fallback";
  center: [number, number];
  riverDischargeM3s: number | null;
  points: CctvPoint[];
}

export async function fetchNearbyMonitoringPoints(
  lat: number,
  lng: number,
  signal?: AbortSignal,
): Promise<NearbyMonitoringResponse | null> {
  try {
    const params = new URLSearchParams({
      lat: lat.toFixed(5),
      lng: lng.toFixed(5),
    });
    const res = await fetch(`/api/monitoring/nearby?${params.toString()}`, {
      signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as NearbyMonitoringResponse;
  } catch {
    return null;
  }
}

export interface GistdaBurnScarItem {
  id: string;
  coord: [number, number];
  province: string;
  amphoe: string;
  tambon: string;
  areaRai: number;
  dateRange: string;
  cropType: string;
  landUse: string;
}

export interface GistdaBurnScarResponse {
  ok: boolean;
  requiresApiKey?: boolean;
  authError?: boolean;
  source: "gistda";
  portalUrl: string;
  endpoint: string;
  numberMatched: number;
  items: GistdaBurnScarItem[];
  message?: string;
}

export async function fetchGistdaBurnScars(options?: {
  limit?: number;
  province?: string;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<GistdaBurnScarResponse> {
  const { limit = 120, province = "", apiKey, signal } = options ?? {};
  const params = new URLSearchParams({ limit: String(limit) });
  if (province.trim()) params.set("province", province.trim());

  const headers: Record<string, string> = {};
  if (apiKey?.trim()) headers["x-gistda-api-key"] = apiKey.trim();

  try {
    const res = await fetch(`/api/gistda/burn-scar?${params.toString()}`, {
      signal,
      headers,
      cache: "no-store",
    });
    if (!res.ok) {
      return {
        ok: false,
        source: "gistda",
        portalUrl: "https://disaster.gistda.or.th/services/open-api",
        endpoint: "https://api-gateway.gistda.or.th/api/2.0/resources/analytics/burn-scar/10days",
        numberMatched: 0,
        items: [],
        message: `HTTP ${res.status}`,
      };
    }
    return (await res.json()) as GistdaBurnScarResponse;
  } catch {
    return {
      ok: false,
      source: "gistda",
      portalUrl: "https://disaster.gistda.or.th/services/open-api",
      endpoint: "https://api-gateway.gistda.or.th/api/2.0/resources/analytics/burn-scar/10days",
      numberMatched: 0,
      items: [],
      message: "ไม่สามารถเชื่อมต่อ /api/gistda/burn-scar",
    };
  }
}

export interface GistdaDragonflyServiceCheck {
  servicename: string;
  source: string;
  datetime: string;
}

export interface LiveFxWeatherTelemetry {
  ok: boolean;
  lat: number;
  lng: number;
  windSpeedKmh: number;
  windDirectionDeg: number;
  windGustsKmh: number;
  precipitationMm: number;
  rainMm: number;
  humidityPct: number;
  pressureHpa: number;
  weatherCode: number;
  gistdaChecks: GistdaDragonflyServiceCheck[];
  gistdaOk: boolean;
  portalUrl: string;
}

export async function fetchGistdaDragonflyStatus(options: {
  lat: number;
  lng: number;
  apiKey?: string;
  signal?: AbortSignal;
}): Promise<LiveFxWeatherTelemetry | null> {
  const { lat, lng, apiKey, signal } = options;
  const params = new URLSearchParams({
    lat: lat.toFixed(4),
    lng: lng.toFixed(4),
  });
  const headers: Record<string, string> = {};
  if (apiKey?.trim()) headers["x-gistda-api-key"] = apiKey.trim();

  try {
    const res = await fetch(`/api/gistda/dragonfly-status?${params.toString()}`, {
      signal,
      headers,
      cache: "no-store",
    });
    if (!res.ok) return null;
    return (await res.json()) as LiveFxWeatherTelemetry;
  } catch {
    return null;
  }
}


