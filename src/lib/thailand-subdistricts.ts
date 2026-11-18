export type CompactSubdistrictTuple = [
  pcode: string,
  displayTh: string,
  lng: number,
  lat: number,
];

export interface ThailandSubdistrictItem {
  pcode: string;
  displayTh: string;
  center: [number, number];
}

export type SubdistrictsByDistrictMap = Record<string, ThailandSubdistrictItem[]>;

const EMPTY_SUBDISTRICTS: SubdistrictsByDistrictMap = {};
let cachedSubdistricts: SubdistrictsByDistrictMap = EMPTY_SUBDISTRICTS;
let isLoaded = false;
let isLoading = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((cb) => cb());
}

export function subscribeSubdistricts(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export function getServerSubdistrictsSnapshot(): SubdistrictsByDistrictMap {
  return EMPTY_SUBDISTRICTS;
}

export function getSubdistrictsSnapshot(): SubdistrictsByDistrictMap {
  return cachedSubdistricts;
}

export function getSubdistrictsLoadedSnapshot(): boolean {
  return isLoaded;
}

export function getSubdistrictsLoadingSnapshot(): boolean {
  return isLoading;
}

export function ensureSubdistrictsLoaded(): void {
  if (typeof window === "undefined" || isLoaded || loadPromise) return;
  isLoading = true;
  notifyListeners();

  loadPromise = fetch("/data/thailand-subdistricts.json")
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<Record<string, CompactSubdistrictTuple[]>>;
    })
    .then((raw) => {
      const next: SubdistrictsByDistrictMap = {};
      for (const [districtPcode, tuples] of Object.entries(raw)) {
        next[districtPcode] = tuples.map(([pcode, displayTh, lng, lat]) => ({
          pcode,
          displayTh,
          center: [lng, lat],
        }));
      }
      cachedSubdistricts = next;
      isLoaded = true;
    })
    .catch(() => {
      // Keep empty map if offline; allow retry next time
    })
    .finally(() => {
      isLoading = false;
      loadPromise = null;
      notifyListeners();
    });
}

