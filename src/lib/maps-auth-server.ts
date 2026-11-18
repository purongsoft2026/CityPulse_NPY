import { createClient } from "@supabase/supabase-js";
import { mapsAuthKey, mapsAuthUrl } from "./maps-auth-config";

const { auth } = createClient(mapsAuthUrl, mapsAuthKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export async function getReportCitizen(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (\S+)$/i)?.[1];
  if (!token) return null;
  const { data, error } = await auth.getUser(token);
  if (error) {
    if (error.status && error.status >= 500) throw error;
    return null;
  }
  return data.user;
}
