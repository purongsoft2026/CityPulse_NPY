import { createClient, type User } from "@supabase/supabase-js";
import type { CitizenMember } from "./citizen-auth";
import { mapsAuthKey, mapsAuthUrl } from "./maps-auth-config";


let client: ReturnType<typeof createClient> | undefined;

export function getMapsAuth() {
  client ??= createClient(mapsAuthUrl, mapsAuthKey);
  return client.auth;
}

export function toCitizenMember(user: User): CitizenMember {
  const profile = user.user_metadata;
  return {
    id: user.id,
    email: user.email ?? "",
    displayName: typeof profile.displayName === "string" ? profile.displayName : "สมาชิกพลเมือง",
    homeProvince: typeof profile.homeProvince === "string" ? profile.homeProvince : "",
    phone: typeof profile.phone === "string" ? profile.phone : undefined,
    avatarPose: typeof profile.avatarPose === "string" && /^\/images\/mascot\w*\.png$/.test(profile.avatarPose)
      ? profile.avatarPose : "/images/mascot.png",
    joinedAt: user.created_at,
  };
}
