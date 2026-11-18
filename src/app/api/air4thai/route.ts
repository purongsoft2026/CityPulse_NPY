import { NextResponse } from "next/server";

interface RawAir4ThaiStation {
  stationID?: string;
  nameTH?: string;
  nameEN?: string;
  areaTH?: string;
  lat?: string;
  long?: string;
  AQILast?: {
    date?: string;
    time?: string;
    PM25?: { value?: string; color_id?: string };
    PM10?: { value?: string };
    AQI?: { aqi?: string; color_id?: string };
  };
}

export interface NormalizedAir4ThaiStation {
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

let cachedStations: {
  expiresAt: number;
  stations: NormalizedAir4ThaiStation[];
} | null = null;

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

export async function GET() {
  if (cachedStations && cachedStations.expiresAt > Date.now()) {
    return NextResponse.json(
      { stations: cachedStations.stations, cached: true },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch("https://air4thai.pcd.go.th/services/getNewAQI_JSON.php", {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityPulseThailand/1.0",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ stations: cachedStations?.stations ?? [] });
    }

    const json = (await res.json()) as { stations?: RawAir4ThaiStation[] };
    const stations: NormalizedAir4ThaiStation[] = (json.stations ?? [])
      .map((s): NormalizedAir4ThaiStation | null => {
        const lat = Number(s.lat);
        const lng = Number(s.long);
        if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0 || lng === 0) {
          return null;
        }
        const rawPm25 = Number(s.AQILast?.PM25?.value);
        const rawPm10 = Number(s.AQILast?.PM10?.value);
        const rawAqi = Number(s.AQILast?.AQI?.aqi);

        const pm25 = Number.isFinite(rawPm25) && rawPm25 >= 0 ? rawPm25 : null;
        const pm10 = Number.isFinite(rawPm10) && rawPm10 >= 0 ? rawPm10 : null;
        const aqi = Number.isFinite(rawAqi) && rawAqi >= 0 ? rawAqi : null;

        if (pm25 === null && aqi === null) return null;

        const date = s.AQILast?.date ?? "";
        const time = s.AQILast?.time ?? "";

        return {
          id: String(s.stationID || `${lat}-${lng}`),
          nameTH: (s.nameTH || s.nameEN || "สถานีตรวจวัดคุณภาพอากาศ").trim(),
          nameEN: (s.nameEN || "").trim(),
          areaTH: (s.areaTH || "").trim(),
          coordinates: [lng, lat],
          pm25,
          pm10,
          aqi,
          colorId: String(s.AQILast?.AQI?.color_id ?? s.AQILast?.PM25?.color_id ?? "1"),
          updatedAt: [date, time].filter(Boolean).join(" "),
        };
      })
      .filter((item): item is NormalizedAir4ThaiStation => item !== null);

    cachedStations = {
      expiresAt: Date.now() + CACHE_TTL_MS,
      stations,
    };

    return NextResponse.json(
      { stations: stations, cached: false },
      { headers: { "Cache-Control": "public, max-age=300" } },
    );
  } catch {
    return NextResponse.json({ stations: cachedStations?.stations ?? [] });
  } finally {
    clearTimeout(timeout);
  }
}

