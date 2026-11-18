import { DEFAULT_MAP_VIEW, type EmergencyPoint } from "./map-data";

// Area reference for directory entries without a confirmed building coordinate.
const mueangArea = DEFAULT_MAP_VIEW.center;

export const NARATHIWAT_EMERGENCY_POINTS: EmergencyPoint[] = [
  {
    id: "nara-hospital",
    name: "โรงพยาบาลนราธิวาสราชนครินทร์",
    type: "hospital",
    locationName: "ถนนระแงะมรรคา ตำบลบางนาค อำเภอเมืองนราธิวาส",
    coordinates: [101.82366, 6.41466],
    phone: "073-511-880",
    instruction: "พิกัดจากสถาบันรับรองคุณภาพสถานพยาบาล · เบอร์ติดต่อจาก สพม.นราธิวาส",
    is24h: false,
  },
  {
    id: "nara-mueang-police",
    name: "สถานีตำรวจภูธรเมืองนราธิวาส",
    type: "police",
    locationName: "ตำบลบางนาค อำเภอเมืองนราธิวาส",
    coordinates: mueangArea,
    locationApproximate: true,
    phone: "073-513-105",
    instruction: "เบอร์ติดต่อจากสำนักงานอัยการสูงสุด",
    is24h: false,
  },
  {
    id: "nara-rescue-01",
    name: "สมาคมกู้ภัยนรา 01",
    type: "rescue",
    locationName: "ถนนประชาภิรมย์ ตำบลบางนาค อำเภอเมืองนราธิวาส",
    coordinates: mueangArea,
    locationApproximate: true,
    phone: "073-516-290",
    instruction: "เบอร์ติดต่อจากสำนักงานศึกษาธิการจังหวัดนราธิวาส",
    is24h: false,
  },
];
