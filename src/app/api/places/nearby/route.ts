import { NextRequest, NextResponse } from "next/server";
import { haversineDistanceKm } from "@/data/map-data";
import type { NearbyCategory, NearbyPlace } from "@/lib/nearby-places";

const filters = {
  fuel: ['["amenity"="fuel"]'],
  shop: ['["shop"~"^(supermarket|convenience|department_store|mall|general|greengrocer|grocery)$"]'],
  food: ['["amenity"~"^(restaurant|fast_food|cafe|food_court)$"]'],
  carTyre: [
    '["shop"="tyres"]["repair"="yes"]',
    '["car:tyres"~"^(yes|repair)$"]',
    '["shop"="car_repair"]["service:vehicle:tyres"="yes"]',
    '["name"~"ปะยางรถยนต์|ปะยางรถเก๋ง"]',
  ],
  motorcycleTyre: [
    '["motorcycle:tyres"~"^(yes|repair)$"]',
    '["shop"="motorcycle_repair"]["service:vehicle:tyres"="yes"]',
    '["name"~"ปะยางมอเตอร์ไซ|ปะยางรถจักรยานยนต์"]',
  ],
} satisfies Record<NearbyCategory, string[]>;

interface Element {
  id: number;
  type: string;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? "";
  const lat = Number(params.get("lat") || NaN);
  const lng = Number(params.get("lng") || NaN);
  const radius = Number(params.get("radius") ?? 5);
  if (!Object.hasOwn(filters, category) || !Number.isFinite(lat) || !Number.isFinite(lng) ||
      Math.abs(lat) > 90 || Math.abs(lng) > 180 || ![2, 5, 10].includes(radius)) {
    return NextResponse.json({ error: "พิกัดหรือหมวดหมู่ไม่ถูกต้อง" }, { status: 400 });
  }

  const area = `(around:${radius * 1000},${lat},${lng})`;
  const selectors = filters[category as NearbyCategory].map((filter) => `nwr${filter}${area};`);
  const query = `[out:json][timeout:6];(${selectors.join("")});out center;`;
  for (const endpoint of ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "MapsSystems/1.0 (nearby places)" },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(6500),
        cache: "no-store",
      });
      if (!response.ok) continue;
      const { elements, remark } = await response.json() as { elements?: Element[]; remark?: string };
      if (!Array.isArray(elements) || remark) continue;

      const places: NearbyPlace[] = [];
      for (const element of elements) {
        const latitude = element.lat ?? element.center?.lat;
        const longitude = element.lon ?? element.center?.lon;
        if (typeof latitude !== "number" || !Number.isFinite(latitude) ||
            typeof longitude !== "number" || !Number.isFinite(longitude)) continue;
        const coordinates: [number, number] = [longitude, latitude];
        const distanceKm = haversineDistanceKm([lng, lat], coordinates);
        if (distanceKm > radius) continue;
        const tags = element.tags ?? {};
        const name = (tags["name:th"] || tags.name || tags.brand || "").trim();
        if (!name) continue;
        const address = [tags["addr:housenumber"], tags["addr:street"], tags["addr:subdistrict"]]
          .filter(Boolean).join(" ");
        places.push({ id: `${element.type}-${element.id}`, name, coordinates, distanceKm, address });
      }
      const closest: NearbyPlace[] = [];
      for (const place of places.sort((a, b) => a.distanceKm - b.distanceKm)) {
        if (!closest.some((other) => other.name === place.name &&
          haversineDistanceKm(other.coordinates, place.coordinates) < 0.08)) closest.push(place);
        if (closest.length === 50) break;
      }
      return NextResponse.json({ places: closest }, { headers: { "Cache-Control": "private, max-age=60" } });
    } catch {
      // Try the next OpenStreetMap endpoint.
    }
  }
  return NextResponse.json({ error: "แหล่งข้อมูลแผนที่ไม่ตอบสนอง กรุณาลองใหม่" }, { status: 503 });
}
