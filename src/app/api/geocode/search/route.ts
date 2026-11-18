import { NextRequest, NextResponse } from "next/server";

interface SearchCacheEntry {
  expiresAt: number;
  payload: Record<string, unknown>;
}

const SEARCH_CACHE = new Map<string, SearchCacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") ?? "").trim();

  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const cacheKey = query.toLowerCase();
  const cached = SEARCH_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const upstreamUrl = new URL("https://nominatim.openstreetmap.org/search");
    upstreamUrl.searchParams.set("format", "jsonv2");
    upstreamUrl.searchParams.set("q", query);
    upstreamUrl.searchParams.set("countrycodes", "th");
    upstreamUrl.searchParams.set("accept-language", "th");
    upstreamUrl.searchParams.set("addressdetails", "1");
    upstreamUrl.searchParams.set("limit", "6");

    const res = await fetch(upstreamUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityPulseThailand/1.0 (civic-map-app)",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const rows = (await res.json()) as Array<{
      place_id: number;
      display_name: string;
      name?: string;
      lat: string;
      lon: string;
      type?: string;
      addresstype?: string;
      address?: {
        province?: string;
        state?: string;
        city?: string;
        district?: string;
        county?: string;
        suburb?: string;
      };
    }>;

    const results = rows
      .map((row) => {
        const lng = Number(row.lon);
        const lat = Number(row.lat);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
        const primaryName =
          row.name?.trim() || row.display_name.split(",")[0]?.trim() || query;
        const rawProvince =
          row.address?.province || row.address?.state || row.address?.city || "";
        const province = rawProvince.includes("กรุงเทพ")
          ? "กรุงเทพมหานคร"
          : rawProvince.replace(/^จังหวัด\s*/, "").trim();
        return {
          id: `osm-${row.place_id}`,
          name: primaryName,
          displayName: row.display_name,
          province,
          center: [lng, lat] as [number, number],
          type: row.addresstype || row.type || "place",
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const payload = { results };
    SEARCH_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({ results: [] });
  } finally {
    clearTimeout(timeout);
  }
}

