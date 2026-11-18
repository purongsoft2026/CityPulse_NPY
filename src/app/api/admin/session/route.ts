import { NextRequest, NextResponse } from "next/server";
import { adminCookie, checkAdminCredentials, issueAdminSession } from "@/lib/admin-session";
import { DEMO_OFFICER_CREDENTIALS } from "@/lib/officer-auth";

function cookieOptions(request: NextRequest) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: request.nextUrl.protocol === "https:",
    path: "/",
  };
}

export async function POST(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const input = await request.json().catch(() => null);
  if (
    typeof input?.email !== "string" ||
    typeof input?.password !== "string" ||
    !checkAdminCredentials(input.email, input.password)
  ) {
    return NextResponse.json({ ok: false, error: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  const duration = input.rememberMe === true ? 86400 : 3600;
  const token = issueAdminSession(duration);
  if (!token) {
    return NextResponse.json({ ok: false, error: "ยังไม่ได้ตั้งค่าระบบเข้าสู่ระบบ" }, { status: 503 });
  }
  const { password: _password, ...profile } = DEMO_OFFICER_CREDENTIALS[0];
  const response = NextResponse.json({
    ok: true,
    officer: { ...profile, email: input.email.trim().toLowerCase() },
  });
  response.cookies.set(adminCookie, token, {
    ...cookieOptions(request),
    ...(input.rememberMe === true ? { maxAge: duration } : {}),
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function DELETE(request: NextRequest) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const response = new NextResponse(null, { status: 204 });
  response.cookies.set(adminCookie, "", { ...cookieOptions(request), maxAge: 0 });
  return response;
}
