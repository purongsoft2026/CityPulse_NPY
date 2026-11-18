import { NextRequest, NextResponse } from "next/server";

const ALLOWED_WMS_LAYERS = new Set(["flood_warn", "flood_warn_sld"]);

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const bbox = (searchParams.get("bbox") ?? "").trim();
  const rawLayer = (searchParams.get("layers") ?? "flood_warn").trim();
  const layer = ALLOWED_WMS_LAYERS.has(rawLayer) ? rawLayer : "flood_warn";
  const width = Math.min(512, Math.max(64, Number(searchParams.get("width") ?? "256") || 256));
  const height = Math.min(512, Math.max(64, Number(searchParams.get("height") ?? "256") || 256));

  const bboxParts = bbox.split(",").map((s) => Number(s.trim()));
  if (bboxParts.length !== 4 || bboxParts.some((n) => !Number.isFinite(n))) {
    return NextResponse.json({ error: "Invalid bbox" }, { status: 400 });
  }

  const apiKey =
    process.env.GISTDA_API_KEY?.trim() ||
    req.headers.get("x-gistda-api-key")?.trim() ||
    "";

  if (!apiKey) {
    return NextResponse.json({ error: "Missing GISTDA_API_KEY" }, { status: 401 });
  }

  const targetUrl = new URL("https://api-gateway.gistda.or.th/api/2.0/resources/dragonfly/flood-warns");
  targetUrl.searchParams.set("SERVICE", "WMS");
  targetUrl.searchParams.set("VERSION", "1.1.1");
  targetUrl.searchParams.set("REQUEST", "GetMap");
  targetUrl.searchParams.set("LAYERS", layer);
  targetUrl.searchParams.set("STYLES", "");
  targetUrl.searchParams.set("SRS", "EPSG:3857");
  targetUrl.searchParams.set("BBOX", bboxParts.join(","));
  targetUrl.searchParams.set("WIDTH", String(width));
  targetUrl.searchParams.set("HEIGHT", String(height));
  targetUrl.searchParams.set("FORMAT", "image/png");
  targetUrl.searchParams.set("TRANSPARENT", "true");
  targetUrl.searchParams.set("api_key", apiKey);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(targetUrl.toString(), {
      signal: controller.signal,
      next: { revalidate: 300 },
    });
    const contentType = res.headers.get("content-type") ?? "";
    if (!res.ok || !contentType.includes("image/")) {
      return new NextResponse(null, { status: 204 });
    }
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return new NextResponse(null, { status: 204 });
  } finally {
    clearTimeout(timeout);
  }
}

