import { NextRequest, NextResponse } from "next/server";
import { THAILAND_DISTRICTS_BY_PROVINCE } from "@/data/thailand-districts";
import { CITIES } from "@/data/map-data";

const GISTDA_PORTAL_URL = "https://disaster.gistda.or.th/services/open-api";
const BURN_SCAR_ENDPOINT =
  "https://api-gateway.gistda.or.th/api/2.0/resources/analytics/burn-scar/10days";

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

interface CacheEntry {
  expiresAt: number;
  payload: unknown;
}

const BURN_SCAR_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes

// Pre-build district lookup index by pcode ("TH6408") and province+amphoe name
const DISTRICT_BY_PCODE = new Map<string, [number, number]>();
const DISTRICT_BY_NAME = new Map<string, [number, number]>();
const PROVINCE_CENTER_BY_NAME = new Map<string, [number, number]>();

for (const [province, districts] of Object.entries(THAILAND_DISTRICTS_BY_PROVINCE)) {
  if (districts.length > 0) {
    let sumLng = 0;
    let sumLat = 0;
    for (const d of districts) {
      DISTRICT_BY_PCODE.set(d.pcode.toUpperCase(), d.center);
      DISTRICT_BY_NAME.set(`${province}|${d.nameTh}`, d.center);
      sumLng += d.center[0];
      sumLat += d.center[1];
    }
    PROVINCE_CENTER_BY_NAME.set(province, [
      sumLng / districts.length,
      sumLat / districts.length,
    ]);
  }
}

for (const c of CITIES) {
  const thName = c.name.split("(")[0].trim();
  if (thName && !PROVINCE_CENTER_BY_NAME.has(thName)) {
    PROVINCE_CENTER_BY_NAME.set(thName, c.center);
  }
}

function deterministicJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return (x - Math.floor(x) - 0.5) * 0.045;
}

function resolveCoordinates(
  province: string,
  amphoe: string,
  amphoeCode: number | undefined,
  tambonCode: number | undefined,
): [number, number] | null {
  const base =
    (amphoeCode ? DISTRICT_BY_PCODE.get(`TH${amphoeCode}`) : undefined) ??
    DISTRICT_BY_NAME.get(`${province}|${amphoe}`) ??
    PROVINCE_CENTER_BY_NAME.get(province);

  if (!base) return null;
  const seed = (tambonCode ?? amphoeCode ?? province.length) + amphoe.length;
  return [
    Number((base[0] + deterministicJitter(seed)).toFixed(5)),
    Number((base[1] + deterministicJitter(seed + 7)).toFixed(5)),
  ];
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawLimit = Number(searchParams.get("limit") ?? "120");
  const limit = Number.isFinite(rawLimit) ? Math.max(10, Math.min(250, Math.round(rawLimit))) : 120;
  const provinceFilter = (searchParams.get("province") ?? "").trim();

  const apiKey =
    process.env.GISTDA_API_KEY?.trim() ||
    req.headers.get("x-gistda-api-key")?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json({
      ok: false,
      requiresApiKey: true,
      source: "gistda",
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: BURN_SCAR_ENDPOINT,
      numberMatched: 0,
      items: [] as GistdaBurnScarItem[],
      message: "กรุณาระบุ GISTDA API Key เพื่อดึงข้อมูลพื้นที่เผาไหม้ 10 วันล่าสุด",
    });
  }

  const keySuffix = apiKey.slice(-4);
  const cacheKey = `${limit}|${provinceFilter}|${apiKey.length}:${keySuffix}`;
  const cached = BURN_SCAR_CACHE.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  }

  const targetUrl = new URL(BURN_SCAR_ENDPOINT);
  targetUrl.searchParams.set("limit", String(limit));
  targetUrl.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      headers: {
        "User-Agent": "CityPulseThailand/1.0",
        Accept: "application/json",
      },
      next: { revalidate: 300 },
    });

    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        ok: false,
        authError: true,
        source: "gistda",
        portalUrl: GISTDA_PORTAL_URL,
        endpoint: BURN_SCAR_ENDPOINT,
        numberMatched: 0,
        items: [] as GistdaBurnScarItem[],
        message: "GISTDA API Key ไม่ถูกต้องหรือหมดอายุ",
      });
    }

    if (!res.ok) {
      return NextResponse.json({
        ok: false,
        status: res.status,
        source: "gistda",
        portalUrl: GISTDA_PORTAL_URL,
        endpoint: BURN_SCAR_ENDPOINT,
        numberMatched: 0,
        items: [] as GistdaBurnScarItem[],
        message: `GISTDA Burn Scar API ตอบกลับ HTTP ${res.status}`,
      });
    }

    const rawText = await res.text();
    const json = JSON.parse(rawText) as {
      numberMatched?: number;
      items?: Array<{
        province?: string;
        amphoe?: string;
        tambon?: string;
        amphoeCode?: number;
        tambonCode?: number;
        area?: number;
        date?: string;
        lu_hp_name?: string;
        lu_name?: string;
      }>;
    };

    const rawItems = Array.isArray(json.items) ? json.items : [];
    const mapped: GistdaBurnScarItem[] = [];

    rawItems.forEach((row, idx) => {
      const province = (row.province ?? "").trim();
      const amphoe = (row.amphoe ?? "").trim();
      const tambon = (row.tambon ?? "").trim();
      if (!province) return;
      if (provinceFilter && !province.includes(provinceFilter)) return;

      const coord = resolveCoordinates(province, amphoe, row.amphoeCode, row.tambonCode);
      if (!coord) return;

      mapped.push({
        id: `burn-${row.tambonCode ?? row.amphoeCode ?? idx}-${idx}`,
        coord,
        province,
        amphoe,
        tambon,
        areaRai: Math.round(Number(row.area ?? 0) * 10) / 10,
        dateRange: (row.date ?? "").trim(),
        cropType: (row.lu_hp_name ?? "").trim(),
        landUse: (row.lu_name ?? "").trim(),
      });
    });

    // Sort larger burn scars first so high-impact hotspots render clearly
    mapped.sort((a, b) => b.areaRai - a.areaRai);

    const payload = {
      ok: true,
      source: "gistda",
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: BURN_SCAR_ENDPOINT,
      numberMatched: json.numberMatched ?? mapped.length,
      items: mapped,
    };

    BURN_SCAR_CACHE.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload,
    });

    return NextResponse.json(payload, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch {
    return NextResponse.json({
      ok: false,
      source: "gistda",
      portalUrl: GISTDA_PORTAL_URL,
      endpoint: BURN_SCAR_ENDPOINT,
      numberMatched: 0,
      items: [] as GistdaBurnScarItem[],
      message: "ไม่สามารถเชื่อมต่อ GISTDA Burn Scar 10 Days API ได้ในขณะนี้",
    });
  } finally {
    clearTimeout(timeout);
  }
}

