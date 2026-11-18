import { NextRequest, NextResponse } from "next/server";

const GISTDA_PORTAL_URL = "https://disaster.gistda.or.th/services/open-api";

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

interface CacheEntry {
  expiresAt: number;
  payload: LiveFxWeatherTelemetry;
}

const FX_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 5; // 5 minutes

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = Number(searchParams.get("lat") ?? "13.7563");
  const lng = Number(searchParams.get("lng") ?? "100.5018");

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return NextResponse.json({ error: "Invalid coordinates" }, { status: 400 });
  }

  const apiKey =
    process.env.GISTDA_API_KEY?.trim() ||
    req.headers.get("x-gistda-api-key")?.trim() ||
    "";

  const cacheKey = `${lat.toFixed(2)}|${lng.toFixed(2)}|${apiKey ? "1" : "0"}`;
  const cached = FX_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=180" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lng.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&timezone=Asia%2FBangkok`;

    const gistdaPromise = apiKey
      ? fetch(
          `https://api-gateway.gistda.or.th/api/2.0/resources/dragonfly/flood-checks?lat=${lat.toFixed(4)}&lng=${lng.toFixed(4)}&api_key=${encodeURIComponent(apiKey)}`,
          { signal: controller.signal },
        ).then(async (r) => {
          if (!r.ok) return { ok: false, checks: [] as GistdaDragonflyServiceCheck[] };
          const text = await r.text();
          if (!text.trim().startsWith("{")) return { ok: false, checks: [] };
          const j = JSON.parse(text) as {
            status?: number;
            data?: GistdaDragonflyServiceCheck[];
          };
          return {
            ok: j.status === 200 || Array.isArray(j.data),
            checks: Array.isArray(j.data) ? j.data : [],
          };
        })
      : Promise.resolve({ ok: false, checks: [] as GistdaDragonflyServiceCheck[] });

    const meteoPromise = fetch(meteoUrl, { signal: controller.signal }).then(async (r) => {
      if (!r.ok) return null;
      return (await r.json()) as {
        current?: {
          relative_humidity_2m?: number;
          precipitation?: number;
          rain?: number;
          weather_code?: number;
          surface_pressure?: number;
          wind_speed_10m?: number;
          wind_direction_10m?: number;
          wind_gusts_10m?: number;
        };
      };
    });

    const [gistdaRes, meteoRes] = await Promise.allSettled([gistdaPromise, meteoPromise]);
    const gVal =
      gistdaRes.status === "fulfilled"
        ? gistdaRes.value
        : { ok: false, checks: [] as GistdaDragonflyServiceCheck[] };
    const mCur = meteoRes.status === "fulfilled" ? meteoRes.value?.current : undefined;

    const payload: LiveFxWeatherTelemetry = {
      ok: Boolean(mCur || gVal.ok),
      lat,
      lng,
      windSpeedKmh: Number(mCur?.wind_speed_10m ?? 12),
      windDirectionDeg: Number(mCur?.wind_direction_10m ?? 225),
      windGustsKmh: Number(mCur?.wind_gusts_10m ?? 20),
      precipitationMm: Number(mCur?.precipitation ?? 0),
      rainMm: Number(mCur?.rain ?? 0),
      humidityPct: Number(mCur?.relative_humidity_2m ?? 72),
      pressureHpa: Math.round(Number(mCur?.surface_pressure ?? 1009)),
      weatherCode: Number(mCur?.weather_code ?? 2),
      gistdaChecks: gVal.checks,
      gistdaOk: gVal.ok,
      portalUrl: GISTDA_PORTAL_URL,
    };

    FX_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=180" },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      lat,
      lng,
      windSpeedKmh: 12,
      windDirectionDeg: 225,
      windGustsKmh: 20,
      precipitationMm: 0,
      rainMm: 0,
      humidityPct: 72,
      pressureHpa: 1009,
      weatherCode: 2,
      gistdaChecks: [],
      gistdaOk: false,
      portalUrl: GISTDA_PORTAL_URL,
    } satisfies LiveFxWeatherTelemetry);
  } finally {
    clearTimeout(timeout);
  }
}

