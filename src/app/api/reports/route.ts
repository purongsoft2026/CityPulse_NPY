import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { COMPLAINT_CATEGORIES } from "@/data/map-data";
import { getAllowedProvinces, provinceAt } from "@/lib/report-provinces";
import { getReportCitizen } from "@/lib/maps-auth-server";
import { reportIdPattern, reportsRequest, toComplaint, type ReportRow } from "@/lib/maps-reports-db";

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "คำขอไม่ถูกต้อง" }, { status: 403 });
  }
  const raw = await request.text();
  if (raw.length > 2000000) return NextResponse.json({ error: "รูปมีขนาดใหญ่เกินไป" }, { status: 413 });
  let data;
  try { data = JSON.parse(raw); } catch {
    return NextResponse.json({ error: "ข้อมูลแจ้งเหตุไม่ถูกต้อง" }, { status: 400 });
  }
  const text = (value: unknown, limit: number) =>
    typeof value === "string" ? value.trim().slice(0, limit) : "";
  const title = text(data?.title, 200);
  const description = text(data?.description, 3000);
  const [longitude, latitude] = Array.isArray(data?.coordinates) ? data.coordinates : [];
  if (!title || !description || typeof data?.id !== "string" || !reportIdPattern.test(data.id) ||
    !COMPLAINT_CATEGORIES.some(({ id }) => id === data.categoryId) ||
    !Number.isFinite(longitude) || Math.abs(longitude) > 180 ||
    !Number.isFinite(latitude) || Math.abs(latitude) > 90) {
    return NextResponse.json({ error: "ตรวจสอบข้อมูลและพิกัดอีกครั้ง" }, { status: 400 });
  }
  const image = data.imageBase64;
  if (image !== undefined && image !== "" &&
    (typeof image !== "string" || !/^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=]+$/i.test(image))) {
    return NextResponse.json({ error: "รูปภาพไม่ถูกต้อง" }, { status: 400 });
  }
  const anonymous = data.isAnonymous === true;
  try {
    const citizen = await getReportCitizen(request);
    if (request.headers.has("authorization") && !citizen) {
      return NextResponse.json({ error: "กรุณาเข้าสู่ระบบอีกครั้ง" }, { status: 401 });
    }
    const allowed = await getAllowedProvinces();
    const province = await provinceAt(longitude, latitude);
    if (!province || (allowed && !allowed.includes(province))) {
      return NextResponse.json({
        error: province ? `จ.${province} ยังไม่เปิดรับแจ้งเหตุ` : "พิกัดนี้อยู่นอกขอบเขตจังหวัดที่รับแจ้ง",
      }, { status: 403 });
    }
    const forwardedIp = request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
    const platform = process.env.VERCEL === "1";
    const context = {
      ip: platform && forwardedIp && isIP(forwardedIp) ? forwardedIp : null,
      country: platform ? text(request.headers.get("x-vercel-ip-country"), 2) : "",
      city: platform ? text(request.headers.get("x-vercel-ip-city"), 120) : "",
      browser: text(request.headers.get("user-agent"), 250),
    };
    await reportsRequest("?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        id: data.id, title, description, category_id: data.categoryId, longitude, latitude,
        province, district: text(data.district, 120),
        reporter_name: anonymous ? null : text(data.reporterName, 120),
        reporter_phone: anonymous ? null : text(data.phone, 32),
        is_anonymous: anonymous, citizen_user_id: citizen?.id ?? null, audit_context: context,
        details: { imageBase64: image, imageName: text(data.imageName, 200),
          priority: ["low", "medium", "high", "urgent"].includes(data.priority) ? data.priority : "medium",
          departmentId: text(data.departmentId, 80) },
      }),
    });
    return NextResponse.json({ id: data.id, province }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "ติดต่อฐานข้อมูลไม่ได้ กรุณาลองส่งอีกครั้ง" }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("mine")) {
    try {
      const citizen = await getReportCitizen(request);
      if (!citizen) return NextResponse.json({ error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
      const offset = Number(request.nextUrl.searchParams.get("offset") ?? 0);
      if (!Number.isSafeInteger(offset) || offset < 0) {
        return NextResponse.json({ error: "ข้อมูลหน้าไม่ถูกต้อง" }, { status: 400 });
      }
      const params = new URLSearchParams({
        citizen_user_id: `eq.${citizen.id}`, order: "created_at.desc,id.desc", limit: "50",
        offset: String(offset),
        select: "id,title,description,category_id,status,longitude,latitude,province,district,reporter_name,is_anonymous,created_at,details",
      });
      const result = await reportsRequest(`?${params}`);
      const rows: ReportRow[] = await result.json();
      return NextResponse.json(rows.map(toComplaint), { headers: { "Cache-Control": "private, no-store" } });
    } catch {
      return NextResponse.json({ error: "โหลดประวัติไม่ได้" }, { status: 503 });
    }
  }
  const ids = request.nextUrl.searchParams.getAll("id");
  if (ids.length === 0 || ids.length > 50 || ids.some((id) => !reportIdPattern.test(id))) {
    return NextResponse.json({ error: "รหัสรายการไม่ถูกต้อง" }, { status: 400 });
  }
  const params = new URLSearchParams({ select: "id,status", id: `in.(${ids.join(",")})` });
  try {
    const response = await reportsRequest(`?${params}`);
    return NextResponse.json(await response.json(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "โหลดสถานะล่าสุดไม่ได้" }, { status: 503 });
  }
}
