import { NextRequest, NextResponse } from "next/server";
import { COMPLAINT_CATEGORIES } from "@/data/map-data";
import { reportIdPattern, reportsRequest } from "@/lib/maps-reports-db";

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
    await reportsRequest("?on_conflict=id", {
      method: "POST",
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      body: JSON.stringify({
        id: data.id, title, description, category_id: data.categoryId, longitude, latitude,
        province: text(data.province, 120), district: text(data.district, 120),
        reporter_name: anonymous ? null : text(data.reporterName, 120),
        reporter_phone: anonymous ? null : text(data.phone, 32),
        is_anonymous: anonymous,
        details: { imageBase64: image, imageName: text(data.imageName, 200),
          priority: ["low", "medium", "high", "urgent"].includes(data.priority) ? data.priority : "medium",
          departmentId: text(data.departmentId, 80) },
      }),
    });
    return NextResponse.json({ id: data.id }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "ติดต่อฐานข้อมูลไม่ได้ กรุณาลองส่งอีกครั้ง" }, { status: 503 });
  }
}

export async function GET(request: NextRequest) {
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
