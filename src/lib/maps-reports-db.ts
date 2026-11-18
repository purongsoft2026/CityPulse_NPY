import type { ComplaintReport } from "@/data/map-data";

export const reportIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;

export function reportsRequest(query: string, init?: RequestInit) {
  return mapsDbRequest("maps_reports", query, init);
}

export async function mapsDbRequest(table: "maps_reports" | "maps_report_settings" | "maps_report_events" | "maps_agency_referrals", query: string, init?: RequestInit) {
  const url = process.env.MAPS_SUPABASE_URL;
  const key = process.env.MAPS_SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Database is not configured");
  const headers = new Headers(init?.headers);
  headers.set("apikey", key);
  if (key.startsWith("eyJ")) headers.set("Authorization", `Bearer ${key}`);
  headers.set("Content-Type", "application/json");
  const result = await fetch(new URL(`/rest/v1/${table}${query}`, url), {
    ...init, headers, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!result.ok) throw new Error(`Database HTTP ${result.status}`);
  return result;
}

export type ReportRow = {
  id: string;
  title: string;
  description: string;
  category_id: string;
  status: ComplaintReport["status"];
  longitude: number;
  latitude: number;
  province?: string;
  district?: string;
  reporter_name?: string;
  reporter_phone?: string;
  is_anonymous: boolean;
  created_at: string;
  details: Partial<ComplaintReport>;
};

export function toComplaint(row: ReportRow): ComplaintReport {
  return {
    ...row.details, id: row.id, title: row.title, description: row.description,
    categoryId: row.category_id, status: row.status,
    coordinates: [row.longitude, row.latitude], province: row.province ?? undefined,
    district: row.district ?? undefined, isAnonymous: row.is_anonymous,
    reporterName: row.reporter_name ?? "ผู้แจ้งไม่ระบุตัวตน",
    phone: row.reporter_phone ?? undefined,
    createdAt: new Date(row.created_at).toLocaleDateString("th-TH", {
      day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok",
    }),
  };
}
