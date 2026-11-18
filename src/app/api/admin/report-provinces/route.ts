import { NextRequest, NextResponse } from "next/server";
import { THAILAND_PROVINCES } from "@/data/map-data";
import { adminCookie, validAdminSession } from "@/lib/admin-session";
import { mapsDbRequest } from "@/lib/maps-reports-db";
import { getAllowedProvinces } from "@/lib/report-provinces";

function authorized(request: NextRequest) {
  return request.headers.get("sec-fetch-site") !== "cross-site" &&
    validAdminSession(request.cookies.get(adminCookie)?.value);
}
const denied = () => NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "ติดต่อฐานข้อมูลไม่ได้" }, { status: 503 });

export async function GET(request: NextRequest) {
  if (!authorized(request)) return denied();
  try {
    return NextResponse.json({ provinces: await getAllowedProvinces() ?? THAILAND_PROVINCES });
  } catch { return unavailable(); }
}

export async function PUT(request: NextRequest) {
  if (!authorized(request)) return denied();
  const body = await request.json().catch(() => null);
  const provinces = body?.provinces;
  if (!Array.isArray(provinces) || provinces.length > THAILAND_PROVINCES.length ||
      provinces.some((province) => typeof province !== "string" || !THAILAND_PROVINCES.includes(province))) {
    return NextResponse.json({ error: "รายการจังหวัดไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    await mapsDbRequest("maps_report_settings", "?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify({ id: 1, allowed_provinces: [...new Set(provinces)] }),
    });
    return NextResponse.json({ ok: true });
  } catch { return unavailable(); }
}
