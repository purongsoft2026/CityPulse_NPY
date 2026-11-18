import {
  INITIAL_CIVIC_POLLS,
  INITIAL_COMPLAINTS,
  getDefaultDepartmentForCategory,
  inferDistrictFromCoord,
  inferProvinceFromCoord,
  type CivicPoll,
  type ComplaintReport,
} from "@/data/map-data";
import type { MapStyleKey } from "@/components/map/MapHeader";

export const STORAGE_KEY = "complaint-map-data";
export const THEME_STORAGE_KEY = "complaint-map-theme";
export const MAP_STYLE_STORAGE_KEY = "complaint-map-style";
export const UPVOTES_STORAGE_KEY = "complaint-user-upvotes";
export const MY_REPORTS_STORAGE_KEY = "complaint-user-reports";
export const POLLS_STORAGE_KEY = "civic-community-polls";
export const POLL_VOTES_STORAGE_KEY = "civic-user-poll-votes";
export const CHECKINS_STORAGE_KEY = "civic-user-checkins";
export const MY_COMMENTS_STORAGE_KEY = "civic-user-comments";

const STORAGE_SYNC_EVENT = "citypulse-storage-sync";
const THEME_SYNC_EVENT = "citypulse-theme-sync";

export const EMPTY_STRING_ARRAY: string[] = [];
export const EMPTY_POLL_VOTES: Record<string, "agree" | "disagree"> = {};

let cachedComplaintsRaw: string | null = null;
let cachedComplaintsParsed: ComplaintReport[] = INITIAL_COMPLAINTS;

let cachedUpvotesRaw: string | null = null;
let cachedUpvotesParsed: string[] = EMPTY_STRING_ARRAY;

let cachedMyReportsRaw: string | null = null;
let cachedMyReportsParsed: string[] = EMPTY_STRING_ARRAY;

let cachedPollsRaw: string | null = null;
let cachedPollsParsed: CivicPoll[] = INITIAL_CIVIC_POLLS;

let cachedPollVotesRaw: string | null = null;
let cachedPollVotesParsed: Record<string, "agree" | "disagree"> = EMPTY_POLL_VOTES;

export function getComplaintsSnapshot(): ComplaintReport[] {
  if (typeof window === "undefined") return INITIAL_COMPLAINTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === cachedComplaintsRaw) return cachedComplaintsParsed;
    cachedComplaintsRaw = raw;
    if (raw) {
      const stored: unknown = JSON.parse(raw);
      if (Array.isArray(stored)) {
        const initMap = new Map(INITIAL_COMPLAINTS.map((c) => [c.id, c]));
        cachedComplaintsParsed = stored.map((entry) => {
          const item = entry as Partial<ComplaintReport> & { id: string };
          const init = initMap.get(item.id);
          const categoryId = item.categoryId ?? init?.categoryId ?? "other";
          const coords = item.coordinates ?? init?.coordinates ?? [100.5231, 13.7367];
          return {
            ...(init ?? {}),
            ...item,
            categoryId,
            coordinates: coords,
            status: item.status ?? init?.status ?? "pending",
            title: item.title ?? init?.title ?? "",
            description: item.description ?? init?.description ?? "",
            reporterName: item.reporterName ?? init?.reporterName ?? "ไม่ระบุชื่อ",
            createdAt: item.createdAt ?? init?.createdAt ?? "วันนี้",
            province: item.province || init?.province || inferProvinceFromCoord(coords),
            district: item.district || init?.district || inferDistrictFromCoord(coords),
            departmentId:
              item.departmentId || init?.departmentId || getDefaultDepartmentForCategory(categoryId),
            priority: item.priority || init?.priority || "medium",
            assignedOfficer: item.assignedOfficer || init?.assignedOfficer,
            imageBase64: item.imageBase64 || init?.imageBase64,
            imageName: item.imageName || init?.imageName,
            resolvedImageBase64: item.resolvedImageBase64 || init?.resolvedImageBase64,
            comments: item.comments ?? init?.comments ?? [],
            upvotes: item.upvotes ?? init?.upvotes ?? 0,
          } as ComplaintReport;
        });
        return cachedComplaintsParsed;
      }
    }
  } catch {
    // ignore
  }
  cachedComplaintsParsed = INITIAL_COMPLAINTS;
  return cachedComplaintsParsed;
}

export function writeComplaintsStore(nextComplaints: ComplaintReport[]): boolean {
  try {
    const serialized = JSON.stringify(nextComplaints);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    cachedComplaintsRaw = serialized;
    cachedComplaintsParsed = nextComplaints;
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
    return true;
  } catch {
    return false;
  }
}

export function clearSampleComplaints(): boolean {
  const sampleIds = new Set(INITIAL_COMPLAINTS.map((report) => report.id));
  return writeComplaintsStore(getComplaintsSnapshot().filter((report) => !sampleIds.has(report.id)));
}

export function getUpvotesSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_STRING_ARRAY;
  try {
    const raw = window.localStorage.getItem(UPVOTES_STORAGE_KEY);
    if (raw === cachedUpvotesRaw) return cachedUpvotesParsed;
    cachedUpvotesRaw = raw;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedUpvotesParsed = parsed.filter((x): x is string => typeof x === "string");
        return cachedUpvotesParsed;
      }
    }
  } catch {
    // ignore
  }
  cachedUpvotesParsed = EMPTY_STRING_ARRAY;
  return cachedUpvotesParsed;
}

export function writeUpvotesStore(nextSet: Set<string>) {
  try {
    const arr = Array.from(nextSet);
    const serialized = JSON.stringify(arr);
    cachedUpvotesRaw = serialized;
    cachedUpvotesParsed = arr;
    window.localStorage.setItem(UPVOTES_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getMyReportsSnapshot(): string[] {
  if (typeof window === "undefined") return EMPTY_STRING_ARRAY;
  try {
    const raw = window.localStorage.getItem(MY_REPORTS_STORAGE_KEY);
    if (raw === cachedMyReportsRaw) return cachedMyReportsParsed;
    cachedMyReportsRaw = raw;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        cachedMyReportsParsed = parsed.filter((x): x is string => typeof x === "string");
        return cachedMyReportsParsed;
      }
    }
  } catch {
    // ignore
  }
  cachedMyReportsParsed = EMPTY_STRING_ARRAY;
  return cachedMyReportsParsed;
}

export function writeMyReportsStore(nextIds: string[]) {
  try {
    const serialized = JSON.stringify(nextIds);
    cachedMyReportsRaw = serialized;
    cachedMyReportsParsed = nextIds;
    window.localStorage.setItem(MY_REPORTS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getCivicPollsSnapshot(): CivicPoll[] {
  if (typeof window === "undefined") return INITIAL_CIVIC_POLLS;
  try {
    const raw = window.localStorage.getItem(POLLS_STORAGE_KEY);
    if (raw === cachedPollsRaw) return cachedPollsParsed;
    cachedPollsRaw = raw;
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedPollsParsed = parsed as CivicPoll[];
        return cachedPollsParsed;
      }
    }
  } catch {
    // ignore
  }
  cachedPollsParsed = INITIAL_CIVIC_POLLS;
  return cachedPollsParsed;
}

export function writeCivicPollsStore(nextPolls: CivicPoll[]) {
  try {
    const serialized = JSON.stringify(nextPolls);
    cachedPollsRaw = serialized;
    cachedPollsParsed = nextPolls;
    window.localStorage.setItem(POLLS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getPollVotesSnapshot(): Record<string, "agree" | "disagree"> {
  if (typeof window === "undefined") return EMPTY_POLL_VOTES;
  try {
    const raw = window.localStorage.getItem(POLL_VOTES_STORAGE_KEY);
    if (raw === cachedPollVotesRaw) return cachedPollVotesParsed;
    cachedPollVotesRaw = raw;
    if (raw) {
      cachedPollVotesParsed = JSON.parse(raw) as Record<string, "agree" | "disagree">;
      return cachedPollVotesParsed;
    }
  } catch {
    // ignore
  }
  cachedPollVotesParsed = EMPTY_POLL_VOTES;
  return cachedPollVotesParsed;
}

export function writePollVotesStore(nextVotes: Record<string, "agree" | "disagree">) {
  try {
    const serialized = JSON.stringify(nextVotes);
    cachedPollVotesRaw = serialized;
    cachedPollVotesParsed = nextVotes;
    window.localStorage.setItem(POLL_VOTES_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getTodayCheckInKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

let cachedCheckInsRaw: string | null = null;
let cachedCheckInsParsed: string[] = EMPTY_STRING_ARRAY;

let cachedMyCommentsRaw: string | null = null;
let cachedMyCommentsParsed: string[] = EMPTY_STRING_ARRAY;

function readStringArrayKey(
  key: string,
  prevRaw: string | null,
  prevParsed: string[]
): { raw: string | null; parsed: string[] } {
  if (typeof window === "undefined") return { raw: prevRaw, parsed: EMPTY_STRING_ARRAY };
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === prevRaw) return { raw, parsed: prevParsed };
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { raw, parsed: parsed.filter((x): x is string => typeof x === "string") };
      }
    }
    return { raw, parsed: EMPTY_STRING_ARRAY };
  } catch {
    return { raw: prevRaw, parsed: EMPTY_STRING_ARRAY };
  }
}

export function getCheckInsSnapshot(): string[] {
  const res = readStringArrayKey(CHECKINS_STORAGE_KEY, cachedCheckInsRaw, cachedCheckInsParsed);
  cachedCheckInsRaw = res.raw;
  cachedCheckInsParsed = res.parsed;
  return res.parsed;
}

export function writeCheckInsStore(nextDates: string[]) {
  try {
    const unique = Array.from(new Set(nextDates));
    const serialized = JSON.stringify(unique);
    cachedCheckInsRaw = serialized;
    cachedCheckInsParsed = unique;
    window.localStorage.setItem(CHECKINS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getMyCommentsSnapshot(): string[] {
  const res = readStringArrayKey(
    MY_COMMENTS_STORAGE_KEY,
    cachedMyCommentsRaw,
    cachedMyCommentsParsed
  );
  cachedMyCommentsRaw = res.raw;
  cachedMyCommentsParsed = res.parsed;
  return res.parsed;
}

export function writeMyCommentsStore(nextIds: string[]) {
  try {
    const serialized = JSON.stringify(nextIds);
    cachedMyCommentsRaw = serialized;
    cachedMyCommentsParsed = nextIds;
    window.localStorage.setItem(MY_COMMENTS_STORAGE_KEY, serialized);
    window.dispatchEvent(new Event(STORAGE_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function getIsDarkSnapshot(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (savedTheme === "dark") return true;
    if (savedTheme === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  } catch {
    return false;
  }
}

export function getMapStyleSnapshot(): MapStyleKey {
  if (typeof window === "undefined") return "voyager";
  try {
    const savedStyle = window.localStorage.getItem(MAP_STYLE_STORAGE_KEY) as MapStyleKey | null;
    if (savedStyle) return savedStyle;
    return getIsDarkSnapshot() ? "darkmatter" : "voyager";
  } catch {
    return "voyager";
  }
}

export function toggleThemeStore(nextDark: boolean, currentStyle: MapStyleKey) {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextDark ? "dark" : "light");
    if (nextDark) {
      document.documentElement.classList.add("dark");
      if (currentStyle === "voyager") {
        window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, "darkmatter");
      }
    } else {
      document.documentElement.classList.remove("dark");
      if (currentStyle === "darkmatter") {
        window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, "voyager");
      }
    }
    window.dispatchEvent(new Event(THEME_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function writeMapStyleStore(style: MapStyleKey) {
  try {
    window.localStorage.setItem(MAP_STYLE_STORAGE_KEY, style);
    window.dispatchEvent(new Event(THEME_SYNC_EVENT));
  } catch {
    // ignore
  }
}

export function subscribeStorageSync(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(STORAGE_SYNC_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(STORAGE_SYNC_EVENT, callback);
  };
}

export function subscribeThemeSync(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_SYNC_EVENT, callback);
  mql.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_SYNC_EVENT, callback);
    mql.removeEventListener("change", callback);
  };
}

export function subscribePopState(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
}

export function getUrlSearchParamSnapshot(param: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(param);
}

