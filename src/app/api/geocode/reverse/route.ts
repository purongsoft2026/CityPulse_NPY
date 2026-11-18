import { NextRequest, NextResponse } from "next/server";

interface NominatimAddress {
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  city_district?: string;
  district?: string;
  county?: string;
  town?: string;
  city?: string;
  state?: string;
  province?: string;
  postcode?: string;
}

interface ReverseCacheEntry {
  expiresAt: number;
  payload: Record<string, unknown>;
}

const REVERSE_CACHE = new Map<string, ReverseCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 15; // 15 minutes

function normalizeThaiProvince(raw?: string): string {
  if (!raw) return "";
  const cleaned = raw.trim();
  if (cleaned.includes("กรุงเทพ")) return "กรุงเทพมหานคร";
  return cleaned.replace(/^จังหวัด\s*/, "").trim();
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const latNum = Number(searchParams.get("lat"));
  const lonNum = Number(searchParams.get("lon"));

  if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) {
    return NextResponse.json(
      { error: "Invalid latitude or longitude" },
      { status: 400 },
    );
  }

  const cacheKey = `${latNum.toFixed(4)},${lonNum.toFixed(4)}`;
  const cached = REVERSE_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const upstreamUrl = new URL("https://nominatim.openstreetmap.org/reverse");
    upstreamUrl.searchParams.set("format", "jsonv2");
    upstreamUrl.searchParams.set("lat", String(latNum));
    upstreamUrl.searchParams.set("lon", String(lonNum));
    upstreamUrl.searchParams.set("accept-language", "th");
    upstreamUrl.searchParams.set("addressdetails", "1");
    upstreamUrl.searchParams.set("zoom", "18");

    const res = await fetch(upstreamUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityPulseThailand/1.0 (civic-map-app)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Upstream reverse geocoding failed" },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      display_name?: string;
      address?: NominatimAddress;
    };
    const addr = data.address ?? {};

    const road = addr.road || addr.pedestrian || addr.footway || "";
    const subdistrict =
      addr.quarter || addr.suburb || addr.neighbourhood || "";
    const province = normalizeThaiProvince(
      addr.province || addr.state || (addr.city === "กรุงเทพมหานคร" ? addr.city : ""),
    );
    const district =
      addr.city_district || addr.district || addr.county || addr.town || addr.city || "";

    const parts = [road, subdistrict, district, province].filter(Boolean);
    const shortAddress =
      parts.length > 0 ? parts.join(" • ") : (data.display_name ?? "");

    const payload = {
      displayName: data.display_name ?? shortAddress,
      shortAddress,
      road,
      subdistrict,
      district,
      province,
      postcode: addr.postcode ?? "",
    };

    REVERSE_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json(
      { error: "Reverse geocoding request failed" },
      { status: 504 },
    );
  } finally {
    clearTimeout(timeout);
  }
}

