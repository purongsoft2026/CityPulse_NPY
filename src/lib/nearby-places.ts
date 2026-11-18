export const NEARBY_PLACE_CATEGORIES = {
  fuel: "ปั๊มน้ำมัน",
  shop: "ร้านค้า",
  food: "ร้านอาหาร",
} as const;

export type NearbyCategory = keyof typeof NEARBY_PLACE_CATEGORIES;

export interface NearbyPlace {
  id: string;
  name: string;
  coordinates: [number, number];
  distanceKm: number;
  address?: string;
}
