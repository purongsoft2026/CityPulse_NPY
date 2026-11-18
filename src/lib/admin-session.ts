import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const adminCookie = "maps_admin_session";

function sessionKey() {
  return process.env.MAPS_ADMIN_SESSION_SECRET;
}

function digest(value: string) {
  return createHash("sha256").update(value).digest();
}

export function checkAdminCredentials(email: string, password: string) {
  const expectedEmail = process.env.MAPS_ADMIN_EMAIL?.trim().toLowerCase();
  const expectedPassword = process.env.MAPS_ADMIN_PASSWORD;
  if (!expectedEmail || !expectedPassword || expectedPassword.length < 16) return false;
  const matches = timingSafeEqual(digest(password), digest(expectedPassword));
  return email.trim().toLowerCase() === expectedEmail && matches;
}

export function issueAdminSession(seconds: number) {
  const key = sessionKey();
  if (!key || key.length < 32) return null;
  const payload = `${Math.floor(Date.now() / 1000) + seconds}.${randomBytes(16).toString("hex")}`;
  return `${payload}.${createHmac("sha256", key).update(payload).digest("hex")}`;
}

export function validAdminSession(token?: string) {
  const key = sessionKey();
  if (!key || key.length < 32 || !token) return false;
  const match = /^(\d{1,12}\.[a-f0-9]{32})\.([a-f0-9]{64})$/.exec(token);
  if (!match || Number(match[1].split(".")[0]) <= Date.now() / 1000) return false;
  const signature = createHmac("sha256", key).update(match[1]).digest();
  return timingSafeEqual(signature, Buffer.from(match[2], "hex"));
}
