import { NextRequest, NextResponse } from "next/server";
import { adminCookie, validAdminSession } from "@/lib/admin-session";
import { mapsDbRequest } from "@/lib/maps-reports-db";

export async function GET(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    !validAdminSession(request.cookies.get(adminCookie)?.value)) {
    return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });
  }

  const before = request.nextUrl.searchParams.get("before");
  if (before !== null && !/^\d{1,16}$/.test(before)) {
    return NextResponse.json({ error: "เลขหน้าประวัติไม่ถูกต้อง" }, { status: 400 });
  }
  const params = new URLSearchParams({ order: "id.desc", limit: "50" });
  if (before) params.set("id", `lt.${before}`);
  try {
    const response = await mapsDbRequest("maps_report_events", `?${params}`);
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "โหลดประวัติไม่ได้" }, { status: 503 });
  }
}
