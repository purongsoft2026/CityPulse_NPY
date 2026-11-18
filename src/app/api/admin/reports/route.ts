import { NextRequest, NextResponse } from "next/server";
import { adminCookie, validAdminSession } from "@/lib/admin-session";
import { reportIdPattern, reportsRequest, toComplaint, type ReportRow } from "@/lib/maps-reports-db";

function authorized(request: NextRequest) {
  return request.headers.get("sec-fetch-site") !== "cross-site" &&
    validAdminSession(request.cookies.get(adminCookie)?.value);
}

const denied = () => NextResponse.json({ error: "ต้องเข้าสู่ระบบ" }, { status: 401 });
const unavailable = () => NextResponse.json({ error: "ติดต่อฐานข้อมูลไม่ได้" }, { status: 503 });

export async function GET(request: NextRequest) {
  if (!authorized(request)) return denied();
  const reports = [];
  try {
    for (let offset = 0; ; offset += 100) {
      const response = await reportsRequest(`?order=created_at.desc,id.asc&limit=100&offset=${offset}`);
      const rows: ReportRow[] = await response.json();
      reports.push(...rows.map(toComplaint));
      if (rows.length < 100) break;
    }
    return NextResponse.json(reports, { headers: { "Cache-Control": "no-store" } });
  } catch { return unavailable(); }
}

export async function PATCH(request: NextRequest) {
  if (!authorized(request)) return denied();
  const data = await request.json().catch(() => null);
  if (typeof data?.id !== "string" || !reportIdPattern.test(data.id) ||
      !["pending", "inprogress", "resolved"].includes(data.status)) {
    return NextResponse.json({ error: "ข้อมูลเคสไม่ถูกต้อง" }, { status: 400 });
  }
  const filter = `?id=eq.${data.id}`;
  try {
    const response = await reportsRequest(filter);
    const [existing]: ReportRow[] = await response.json();
    if (!existing) return NextResponse.json({ error: "ไม่พบเคส" }, { status: 404 });
    const details = {
      ...existing.details, priority: data.priority, departmentId: data.departmentId,
      assignedOfficer: data.assignedOfficer, timeline: data.timeline,
      resolvedImageBase64: data.resolvedImageBase64,
    };
    const updated = await reportsRequest(filter, {
      method: "PATCH", headers: { Prefer: "return=representation" },
      body: JSON.stringify({ status: data.status, details }),
    });
    const [row]: ReportRow[] = await updated.json();
    return row ? NextResponse.json(toComplaint(row)) :
      NextResponse.json({ error: "ไม่พบเคส" }, { status: 404 });
  } catch { return unavailable(); }
}

export async function DELETE(request: NextRequest) {
  if (!authorized(request)) return denied();
  const id = request.nextUrl.searchParams.get("id");
  if (!id || !reportIdPattern.test(id)) return NextResponse.json({ error: "รหัสเคสไม่ถูกต้อง" }, { status: 400 });
  try {
    await reportsRequest(`?id=eq.${id}`, { method: "DELETE" });
    return new NextResponse(null, { status: 204 });
  } catch { return unavailable(); }
}
