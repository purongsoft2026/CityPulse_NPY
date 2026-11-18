import { gunzipSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import directory from "@/data/local-agencies.json";
import { adminCookie, validAdminSession } from "@/lib/admin-session";
import { mapsDbRequest, reportIdPattern, reportsRequest } from "@/lib/maps-reports-db";

type DirectoryRow = [id: string, province: string, district: string, type: string, name: string];
const agencies: DirectoryRow[] = JSON.parse(gunzipSync(Buffer.from(directory.gzip, "base64")).toString("utf8"));

function authorized(request: NextRequest) {
  return request.headers.get("sec-fetch-site") !== "cross-site" &&
    validAdminSession(request.cookies.get(adminCookie)?.value);
}

const denied = () => NextResponse.json({ error: "ต้องเข้าสู่ระบบเจ้าหน้าที่" }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "ติดต่อฐานข้อมูลกลางไม่ได้" }, { status: 503 });
const invalid = () => NextResponse.json({ error: "กรุณาตรวจข้อมูลการส่งต่อ" }, { status: 400 });
const privateHeaders = { "Cache-Control": "no-store" };

export async function GET(request: NextRequest) {
  if (!authorized(request)) return denied();
  const id = request.nextUrl.searchParams.get("reportId") ?? "";
  if (!reportIdPattern.test(id)) return invalid();
  try {
    const [reportResponse, referralResponse] = await Promise.all([
      reportsRequest(`?id=eq.${id}&select=province,district`),
      mapsDbRequest("maps_agency_referrals", `?report_id=eq.${id}&order=created_at.desc,id.desc`),
    ]);
    const [report]: { province: string; district: string | null }[] = await reportResponse.json();
    if (!report) return NextResponse.json({ error: "ไม่พบเรื่องแจ้ง" }, { status: 404 });
    const district = (report.district ?? "").replace(/^(อำเภอ|เขต|อ\.)\s*/, "").trim();
    const local = agencies.filter(([, province]) => province === report.province).map(
      ([code, , area, type, name]) => ({ code, district: area, name: `${type}${name}`, sameDistrict: area === district }),
    );
    if (report.province === "กรุงเทพมหานคร") {
      local.push({ code: "bangkok", district: "", name: "กรุงเทพมหานคร", sameDistrict: false });
    }
    local.sort((a, b) => Number(b.sameDistrict) - Number(a.sameDistrict) || a.name.localeCompare(b.name, "th"));
    return NextResponse.json({ agencies: local, referrals: await referralResponse.json() }, { headers: privateHeaders });
  } catch { return unavailable(); }
}

export async function POST(request: NextRequest) {
  if (!authorized(request)) return denied();
  const body = await request.json().catch(() => null);
  const id = body?.reportId;
  const agency = typeof body?.agency === "string" ? body.agency.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const note = typeof body?.note === "string" ? body.note.trim() : "";
  if (typeof id !== "string" || !reportIdPattern.test(id) || !agency || agency.length > 180 ||
      note.length > 1500 || email.length > 254 ||
      (email && !/^[A-Z0-9._+\-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(email))) return invalid();
  try {
    const result = await mapsDbRequest("maps_agency_referrals", "", {
      method: "POST", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ report_id: id, agency, email: email || null, note }),
    });
    const [referral] = await result.json();
    return NextResponse.json(referral, { status: 201, headers: privateHeaders });
  } catch { return unavailable(); }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return denied();
  const body = await request.json().catch(() => null);
  const id = body?.referralId;
  const reportId = body?.reportId;
  if (typeof id !== "string" || !reportIdPattern.test(id) ||
      typeof reportId !== "string" || !reportIdPattern.test(reportId)) return invalid();
  try {
    const result = await mapsDbRequest("maps_agency_referrals",
      `?id=eq.${id}&report_id=eq.${reportId}&sent_at=is.null`, {
        method: "PATCH", headers: { Prefer: "return=representation" },
        body: JSON.stringify({ sent_at: new Date().toISOString() }),
      });
    const [referral] = await result.json();
    if (!referral) return NextResponse.json({ error: "รายการถูกบันทึกแล้วหรือไม่พบรายการ" }, { status: 409 });
    return NextResponse.json(referral, { headers: privateHeaders });
  } catch { return unavailable(); }
}
