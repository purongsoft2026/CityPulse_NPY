import { readFile } from "node:fs/promises";
import path from "node:path";
import type { FeatureCollection, MultiPolygon, Polygon, Position } from "geojson";
import { mapsDbRequest } from "./maps-reports-db";

type ProvinceFeatures = FeatureCollection<Polygon | MultiPolygon, { name_th: string }>;
let boundaries: ProvinceFeatures | undefined;

function insideRing(ring: Position[], longitude: number, latitude: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if ((y1 > latitude) !== (y2 > latitude) &&
        longitude < (x2 - x1) * (latitude - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}

export async function provinceAt(longitude: number, latitude: number) {
  boundaries ??= JSON.parse(await readFile(
    path.join(process.cwd(), "public/data/thailand-provinces.geojson"), "utf8",
  )) as ProvinceFeatures;
  return boundaries.features.find(({ geometry }) => {
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
    return polygons.some(([outer, ...holes]) =>
      insideRing(outer, longitude, latitude) &&
      !holes.some((hole) => insideRing(hole, longitude, latitude)),
    );
  })?.properties.name_th;
}

export async function getAllowedProvinces(): Promise<string[] | undefined> {
  const response = await mapsDbRequest("maps_report_settings", "?id=eq.1&select=allowed_provinces");
  const [settings]: { allowed_provinces: string[] }[] = await response.json();
  return settings?.allowed_provinces;
}
