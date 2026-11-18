import { NextRequest, NextResponse } from "next/server";
import { THAILAND_PROVINCES } from "@/data/map-data";
import { reportIdPattern, reportsRequest, toComplaint, type ReportRow } from "@/lib/maps-reports-db";

export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams;
  const province = search.get("province") ?? "";
  const id = search.get("id");
  const offset = Number(search.get("offset") ?? 0);
  if ((id !== null ? !reportIdPattern.test(id) : !THAILAND_PROVINCES.includes(province)) ||
      !Number.isSafeInteger(offset) || offset < 0) {
    return NextResponse.json({ error: "ข้อมูลค้นหาไม่ถูกต้อง" }, { status: 400 });
  }

  const params = new URLSearchParams({
    select: "id,title,description,category_id,status,longitude,latitude,province,district,created_at",
    status: "in.(inprogress,resolved)",
    order: "created_at.desc,id.desc",
    limit: id ? "1" : "50",
    offset: String(offset),
  });
  if (id) params.set("id", `eq.${id}`);
  else params.set("province", `eq.${province}`);

  try {
    const result = await reportsRequest(`?${params}`);
    const rows: ReportRow[] = await result.json();
    return NextResponse.json(rows.map((row) => toComplaint({
      ...row, details: {}, is_anonymous: true,
    })), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "โหลดเรื่องร้องเรียนไม่ได้" }, { status: 503 });
  }
}
