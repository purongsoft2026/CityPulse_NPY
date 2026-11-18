export interface CityViewport {
  id: string;
  name: string;
  country: string;
  region?: string;
  center: [number, number]; // [lng, lat]
  zoom: number;
}

export interface CityWeatherData {
  cityId: string;
  cityName: string;
  dayLabel: string;
  temp: number;
  condition: string;
  conditionType: "mostly-cloudy" | "sunny" | "rainy" | "cloudy" | "clear";
  windSpeed: string;
  rainChance: string;
  humidity: string;
  pm25?: number;
  usAqi?: number;
  uvIndex?: number;
  aqiLabel?: string;
  aqiColor?: string;
}

export const CITY_WEATHER: Record<string, CityWeatherData> = {
  bkk: {
    cityId: "bkk",
    cityName: "กรุงเทพมหานคร",
    dayLabel: "วันนี้",
    temp: 32,
    condition: "แดดจัด อบอุ่น",
    conditionType: "sunny",
    windSpeed: "8 km/h",
    rainChance: "20%",
    humidity: "68%",
  },
  cnx: {
    cityId: "cnx",
    cityName: "เชียงใหม่",
    dayLabel: "วันนี้",
    temp: 28,
    condition: "มีเมฆบางส่วน",
    conditionType: "mostly-cloudy",
    windSpeed: "6 km/h",
    rainChance: "15%",
    humidity: "62%",
  },
  hkt: {
    cityId: "hkt",
    cityName: "ภูเก็ต",
    dayLabel: "วันนี้",
    temp: 30,
    condition: "ลมทะเลสดชื่น",
    conditionType: "sunny",
    windSpeed: "12 km/h",
    rainChance: "35%",
    humidity: "75%",
  },
  tor: {
    cityId: "tor",
    cityName: "Toronto",
    dayLabel: "Today",
    temp: 21,
    condition: "Mostly Cloudy",
    conditionType: "mostly-cloudy",
    windSpeed: "4 km/h",
    rainChance: "45%",
    humidity: "56%",
  },
};

export const DEFAULT_MAP_VIEW: CityViewport = {
  id: "nwt-municipality",
  name: "เทศบาลเมืองนราธิวาส",
  country: "Thailand",
  region: "ภาคใต้",
  center: [101.8223403, 6.427896005],
  zoom: 14,
};

export const CITIES: CityViewport[] = [
  // ภาคกลาง (22 จังหวัด)
  { id: "bkk", name: "กรุงเทพมหานคร (Bangkok)", country: "Thailand", region: "ภาคกลาง", center: [100.5018, 13.7563], zoom: 12 },
  { id: "spk", name: "สมุทรปราการ (Samut Prakan)", country: "Thailand", region: "ภาคกลาง", center: [100.5998, 13.5991], zoom: 11.5 },
  { id: "nbi", name: "นนทบุรี (Nonthaburi)", country: "Thailand", region: "ภาคกลาง", center: [100.5217, 13.8621], zoom: 12 },
  { id: "pte", name: "ปทุมธานี (Pathum Thani)", country: "Thailand", region: "ภาคกลาง", center: [100.5250, 14.0208], zoom: 11.5 },
  { id: "aya", name: "พระนครศรีอยุธยา (Phra Nakhon Si Ayutthaya)", country: "Thailand", region: "ภาคกลาง", center: [100.5775, 14.3532], zoom: 11.5 },
  { id: "atg", name: "อ่างทอง (Ang Thong)", country: "Thailand", region: "ภาคกลาง", center: [100.4550, 14.5896], zoom: 11.5 },
  { id: "lop", name: "ลพบุรี (Lopburi)", country: "Thailand", region: "ภาคกลาง", center: [100.6534, 14.7995], zoom: 11.5 },
  { id: "sbr", name: "สิงห์บุรี (Sing Buri)", country: "Thailand", region: "ภาคกลาง", center: [100.3967, 14.8879], zoom: 11.5 },
  { id: "cnt", name: "ชัยนาท (Chai Nat)", country: "Thailand", region: "ภาคกลาง", center: [100.1252, 15.1852], zoom: 11.5 },
  { id: "sri", name: "สระบุรี (Saraburi)", country: "Thailand", region: "ภาคกลาง", center: [100.9101, 14.5289], zoom: 11.5 },
  { id: "nyk", name: "นครนายก (Nakhon Nayok)", country: "Thailand", region: "ภาคกลาง", center: [101.2131, 14.2069], zoom: 11.5 },
  { id: "npt", name: "นครปฐม (Nakhon Pathom)", country: "Thailand", region: "ภาคกลาง", center: [100.0621, 13.8199], zoom: 11.5 },
  { id: "spb", name: "สุพรรณบุรี (Suphan Buri)", country: "Thailand", region: "ภาคกลาง", center: [100.1177, 14.4745], zoom: 11.5 },
  { id: "skn", name: "สมุทรสาคร (Samut Sakhon)", country: "Thailand", region: "ภาคกลาง", center: [100.2744, 13.5475], zoom: 11.5 },
  { id: "skm", name: "สมุทรสงคราม (Samut Songkhram)", country: "Thailand", region: "ภาคกลาง", center: [99.9999, 13.4098], zoom: 11.5 },
  { id: "pnb", name: "เพชรบูรณ์ (Phetchabun)", country: "Thailand", region: "ภาคกลาง", center: [101.1578, 16.4190], zoom: 11 },
  { id: "pct", name: "พิจิตร (Phichit)", country: "Thailand", region: "ภาคกลาง", center: [100.3488, 16.4418], zoom: 11.5 },
  { id: "plk", name: "พิษณุโลก (Phitsanulok)", country: "Thailand", region: "ภาคกลาง", center: [100.2659, 16.8211], zoom: 11.5 },
  { id: "nsn", name: "นครสวรรค์ (Nakhon Sawan)", country: "Thailand", region: "ภาคกลาง", center: [100.1252, 15.6987], zoom: 11.5 },
  { id: "utn", name: "อุทัยธานี (Uthai Thani)", country: "Thailand", region: "ภาคกลาง", center: [100.0245, 15.3835], zoom: 11.5 },
  { id: "kpt", name: "กำแพงเพชร (Kamphaeng Phet)", country: "Thailand", region: "ภาคกลาง", center: [99.5227, 16.4828], zoom: 11.5 },
  { id: "sth", name: "สุโขทัย (Sukhothai)", country: "Thailand", region: "ภาคกลาง", center: [99.8264, 17.0056], zoom: 11.5 },

  // ภาคเหนือ (9 จังหวัด)
  { id: "cnx", name: "เชียงใหม่ (Chiang Mai)", country: "Thailand", region: "ภาคเหนือ", center: [98.9853, 18.7883], zoom: 12 },
  { id: "lpn", name: "ลำพูน (Lamphun)", country: "Thailand", region: "ภาคเหนือ", center: [99.0087, 18.5745], zoom: 11.5 },
  { id: "lpg", name: "ลำปาง (Lampang)", country: "Thailand", region: "ภาคเหนือ", center: [99.5050, 18.2888], zoom: 11.5 },
  { id: "utt", name: "อุตรดิตถ์ (Uttaradit)", country: "Thailand", region: "ภาคเหนือ", center: [100.0993, 17.6201], zoom: 11.5 },
  { id: "pre", name: "แพร่ (Phrae)", country: "Thailand", region: "ภาคเหนือ", center: [100.1412, 18.1446], zoom: 11.5 },
  { id: "nan", name: "น่าน (Nan)", country: "Thailand", region: "ภาคเหนือ", center: [100.7730, 18.7756], zoom: 11.5 },
  { id: "pyo", name: "พะเยา (Phayao)", country: "Thailand", region: "ภาคเหนือ", center: [99.9022, 19.1664], zoom: 11.5 },
  { id: "cri", name: "เชียงราย (Chiang Rai)", country: "Thailand", region: "ภาคเหนือ", center: [99.8325, 19.9072], zoom: 11.5 },
  { id: "msn", name: "แม่ฮ่องสอน (Mae Hong Son)", country: "Thailand", region: "ภาคเหนือ", center: [97.9654, 19.3021], zoom: 11.5 },

  // ภาคตะวันออกเฉียงเหนือ (20 จังหวัด)
  { id: "nma", name: "นครราชสีมา (Nakhon Ratchasima)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.0978, 14.9799], zoom: 11.5 },
  { id: "brm", name: "บุรีรัมย์ (Buriram)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.1029, 14.9930], zoom: 11.5 },
  { id: "srn", name: "สุรินทร์ (Surin)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.4936, 14.8818], zoom: 11.5 },
  { id: "ssk", name: "ศรีสะเกษ (Sisaket)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.3220, 15.1186], zoom: 11.5 },
  { id: "ubn", name: "อุบลราชธานี (Ubon Ratchathani)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.8601, 15.2448], zoom: 11.5 },
  { id: "yst", name: "ยโสธร (Yasothon)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.1451, 15.7926], zoom: 11.5 },
  { id: "cpm", name: "ชัยภูมิ (Chaiyaphum)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.0315, 15.8105], zoom: 11.5 },
  { id: "acr", name: "อำนาจเจริญ (Amnat Charoen)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.6258, 15.8657], zoom: 11.5 },
  { id: "bkn", name: "บึงกาฬ (Bueng Kan)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.6464, 18.3609], zoom: 11.5 },
  { id: "nbp", name: "หนองบัวลำภู (Nong Bua Lamphu)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.4410, 17.2044], zoom: 11.5 },
  { id: "kkn", name: "ขอนแก่น (Khon Kaen)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.8359, 16.4419], zoom: 12 },
  { id: "udn", name: "อุดรธานี (Udon Thani)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.7872, 17.4157], zoom: 11.5 },
  { id: "lei", name: "เลย (Loei)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [101.7223, 17.4860], zoom: 11.5 },
  { id: "nki", name: "หนองคาย (Nong Khai)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [102.7413, 17.8783], zoom: 11.5 },
  { id: "msk", name: "มหาสารคาม (Maha Sarakham)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.3007, 16.1851], zoom: 11.5 },
  { id: "ret", name: "ร้อยเอ็ด (Roi Et)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.6520, 16.0538], zoom: 11.5 },
  { id: "ksn", name: "กาฬสินธุ์ (Kalasin)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [103.5061, 16.4322], zoom: 11.5 },
  { id: "snk", name: "สกลนคร (Sakon Nakhon)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.1486, 17.1546], zoom: 11.5 },
  { id: "npm", name: "นครพนม (Nakhon Phanom)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.7787, 17.4043], zoom: 11.5 },
  { id: "mdh", name: "มุกดาหาร (Mukdahan)", country: "Thailand", region: "ภาคตะวันออกเฉียงเหนือ", center: [104.7235, 16.5436], zoom: 11.5 },

  // ภาคตะวันออก (7 จังหวัด)
  { id: "cbi", name: "ชลบุรี (Chonburi)", country: "Thailand", region: "ภาคตะวันออก", center: [100.9847, 13.3611], zoom: 11.5 },
  { id: "ryg", name: "ระยอง (Rayong)", country: "Thailand", region: "ภาคตะวันออก", center: [101.2816, 12.6814], zoom: 11.5 },
  { id: "cti", name: "จันทบุรี (Chanthaburi)", country: "Thailand", region: "ภาคตะวันออก", center: [102.1039, 12.6114], zoom: 11.5 },
  { id: "trt", name: "ตราด (Trat)", country: "Thailand", region: "ภาคตะวันออก", center: [102.5175, 12.2428], zoom: 11.5 },
  { id: "cco", name: "ฉะเชิงเทรา (Chachoengsao)", country: "Thailand", region: "ภาคตะวันออก", center: [101.0714, 13.6904], zoom: 11.5 },
  { id: "pri", name: "ปราจีนบุรี (Prachinburi)", country: "Thailand", region: "ภาคตะวันออก", center: [101.3744, 14.0509], zoom: 11.5 },
  { id: "skw", name: "สระแก้ว (Sa Kaeo)", country: "Thailand", region: "ภาคตะวันออก", center: [102.0646, 13.8140], zoom: 11.5 },

  // ภาคตะวันตก (5 จังหวัด)
  { id: "kan", name: "กาญจนบุรี (Kanchanaburi)", country: "Thailand", region: "ภาคตะวันตก", center: [99.5328, 14.0228], zoom: 11.5 },
  { id: "tak", name: "ตาก (Tak)", country: "Thailand", region: "ภาคตะวันตก", center: [99.1258, 16.8839], zoom: 11.5 },
  { id: "pkn", name: "ประจวบคีรีขันธ์ (Prachuap Khiri Khan)", country: "Thailand", region: "ภาคตะวันตก", center: [99.7958, 11.8126], zoom: 11.5 },
  { id: "pbi", name: "เพชรบุรี (Phetchaburi)", country: "Thailand", region: "ภาคตะวันตก", center: [99.9391, 13.1114], zoom: 11.5 },
  { id: "rbr", name: "ราชบุรี (Ratchaburi)", country: "Thailand", region: "ภาคตะวันตก", center: [99.8164, 13.5358], zoom: 11.5 },

  // ภาคใต้ (14 จังหวัด)
  { id: "hkt", name: "ภูเก็ต (Phuket)", country: "Thailand", region: "ภาคใต้", center: [98.3923, 7.8804], zoom: 11.5 },
  { id: "kbi", name: "กระบี่ (Krabi)", country: "Thailand", region: "ภาคใต้", center: [98.9147, 8.0863], zoom: 11.5 },
  { id: "pna", name: "พังงา (Phang Nga)", country: "Thailand", region: "ภาคใต้", center: [98.5255, 8.4509], zoom: 11.5 },
  { id: "sni", name: "สุราษฎร์ธานี (Surat Thani)", country: "Thailand", region: "ภาคใต้", center: [99.3334, 9.1382], zoom: 11.5 },
  { id: "nrt", name: "นครศรีธรรมราช (Nakhon Si Thammarat)", country: "Thailand", region: "ภาคใต้", center: [99.9631, 8.4304], zoom: 11.5 },
  { id: "ska", name: "สงขลา (Songkhla)", country: "Thailand", region: "ภาคใต้", center: [100.5954, 7.1898], zoom: 11.5 },
  { id: "cpn", name: "ชุมพร (Chumphon)", country: "Thailand", region: "ภาคใต้", center: [99.1800, 10.4930], zoom: 11.5 },
  { id: "rng", name: "ระนอง (Ranong)", country: "Thailand", region: "ภาคใต้", center: [98.6348, 9.9658], zoom: 11.5 },
  { id: "trg", name: "ตรัง (Trang)", country: "Thailand", region: "ภาคใต้", center: [99.6114, 7.5563], zoom: 11.5 },
  { id: "plg", name: "พัทลุง (Phatthalung)", country: "Thailand", region: "ภาคใต้", center: [100.0778, 7.6167], zoom: 11.5 },
  { id: "stn", name: "สตูล (Satun)", country: "Thailand", region: "ภาคใต้", center: [100.0674, 6.6238], zoom: 11.5 },
  { id: "ptn", name: "ปัตตานี (Pattani)", country: "Thailand", region: "ภาคใต้", center: [101.2501, 6.8696], zoom: 11.5 },
  { id: "yla", name: "ยะลา (Yala)", country: "Thailand", region: "ภาคใต้", center: [101.2813, 6.5411], zoom: 11.5 },
  { id: "nwt", name: "นราธิวาส (Narathiwat)", country: "Thailand", region: "ภาคใต้", center: [101.8253, 6.4255], zoom: 11.5 },
];

export interface POIItem {
  id: string;
  name: string;
  nameEn: string;
  category: "landmark" | "lifestyle" | "transit" | "park" | "food";
  coordinates: [number, number]; // [lng, lat]
  description: string;
  rating: number;
  reviewsCount: number;
  address: string;
  openHours: string;
  imageUrl: string;
  tags: string[];
}

export const POI_PLACES: POIItem[] = [
  {
    id: "poi-1",
    name: "วัดพระศรีรัตนศาสดาราม (วัดพระแก้ว)",
    nameEn: "Wat Phra Kaew & Grand Palace",
    category: "landmark",
    coordinates: [100.4927, 13.7513],
    description: "วัดคู่บ้านคู่เมืองและพระบรมมหาราชวัง ศูนย์รวมสถาปัตยกรรมไทยอันวิจิตรงดงาม",
    rating: 4.8,
    reviewsCount: 42100,
    address: "ถนนหน้าพระลาน แขวงพระบรมมหาราชวัง เขตพระนคร",
    openHours: "08:30 - 15:30 น.",
    imageUrl: "https://images.unsplash.com/photo-1563492065599-3520f775eeed?auto=format&fit=crop&w=600&q=80",
    tags: ["มรดกทางวัฒนธรรม", "แลนด์มาร์ก", "ประวัติศาสตร์"],
  },
  {
    id: "poi-2",
    name: "ไอคอนสยาม (ICONSIAM)",
    nameEn: "ICONSIAM Riverfront Mall",
    category: "lifestyle",
    coordinates: [100.5104, 13.7267],
    description: "อภิมหาโครงการเมืองริมแม่น้ำเจ้าพระยา รวมแบรนด์ระดับโลกและเมืองสุขสยาม",
    rating: 4.7,
    reviewsCount: 56300,
    address: "299 ถนนเจริญนคร แขวงคลองต้นไทร เขตคลองสาน",
    openHours: "10:00 - 22:00 น.",
    imageUrl: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80",
    tags: ["ริมแม่น้ำ", "ช้อปปิ้ง", "อาหาร"],
  },
  {
    id: "poi-3",
    name: "สวนเบญจกิติ (Benchakitti Forest Park)",
    nameEn: "Benchakitti Forest Park",
    category: "park",
    coordinates: [100.5583, 13.7302],
    description: "สวนป่าใจกลางเมืองพร้อมสกายวอล์ก พื้นที่ชุ่มน้ำ และเส้นทางวิ่งจักรยานร่มรื่น",
    rating: 4.9,
    reviewsCount: 18400,
    address: "ถนนรัชดาภิเษก แขวงคลองเตย เขตคลองเตย",
    openHours: "05:00 - 21:00 น.",
    imageUrl: "https://images.unsplash.com/photo-1519331379826-f10be5486c6f?auto=format&fit=crop&w=800&q=80",
    tags: ["ธรรมชาติ", "ออกกำลังกาย", "สกายวอล์ก"],
  },
  {
    id: "poi-4",
    name: "สถานีกลางกรุงเทพอภิวัฒน์",
    nameEn: "Krung Thep Aphiwat Central Terminal",
    category: "transit",
    coordinates: [100.5401, 13.8037],
    description: "ศูนย์กลางระบบรางและสถานีรถไฟหลักที่ใหญ่ที่สุดในเอเชียตะวันออกเฉียงใต้",
    rating: 4.6,
    reviewsCount: 12900,
    address: "ถนนกำแพงเพชร แขวงจตุจักร เขตจตุจักร",
    openHours: "เปิดบริการ 24 ชั่วโมง",
    imageUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
    tags: ["ระบบราง", "ขนส่งมวลชน", "ไฮสปีด"],
  },
  {
    id: "poi-5",
    name: "สยามพารากอน (Siam Paragon)",
    nameEn: "Siam Paragon & Sea Life",
    category: "lifestyle",
    coordinates: [100.5348, 13.7462],
    description: "ศูนย์กลางแฟชั่นระดับเวิลด์คลาส โรงภาพยนตร์และพิพิธภัณฑ์สัตว์น้ำ ซีไลฟ์",
    rating: 4.7,
    reviewsCount: 68900,
    address: "991 ถนนพระรามที่ 1 แขวงปทุมวัน เขตปทุมวัน",
    openHours: "10:00 - 22:00 น.",
    imageUrl: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=600&q=80",
    tags: ["แฟชั่น", "ใจกลางเมือง", "ความบันเทิง"],
  },
  {
    id: "poi-6",
    name: "ตลาดนัดจตุจักร (Chatuchak Market)",
    nameEn: "Chatuchak Weekend Market",
    category: "lifestyle",
    coordinates: [100.5501, 13.7999],
    description: "ตลาดนัดวันหยุดสุดสัปดาห์ที่ใหญ่ที่สุดในโลก รวมสินค้าและงานฝีมือกว่า 15,000 ร้านค้า",
    rating: 4.6,
    reviewsCount: 82000,
    address: "ถนนกำแพงเพชร 2 แขวงจตุจักร เขตจตุจักร",
    openHours: "เสาร์ - อาทิตย์ 09:00 - 18:00 น.",
    imageUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    tags: ["ของฝาก", "สตรีทฟู้ด", "วินเทจ"],
  },
  {
    id: "poi-7",
    name: "เยาวราช ไชน่าทาวน์ (Yaowarat)",
    nameEn: "Yaowarat Chinatown Street Food",
    category: "food",
    coordinates: [100.5093, 13.7412],
    description: "สวรรค์แห่งสตรีทฟู้ดยามค่ำคืนและย่านการค้าทองคำที่เก่าแก่ที่สุดในไทย",
    rating: 4.8,
    reviewsCount: 45000,
    address: "ถนนเยาวราช แขวงสัมพันธวงศ์ เขตสัมพันธวงศ์",
    openHours: "17:00 - 01:00 น. (คึกคักช่วงค่ำ)",
    imageUrl: "https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?auto=format&fit=crop&w=600&q=80",
    tags: ["สตรีทฟู้ด", "มิชลิน", "ไนท์ไลฟ์"],
  },
  {
    id: "poi-8",
    name: "วัน แบงค็อก (One Bangkok)",
    nameEn: "One Bangkok Integrated District",
    category: "lifestyle",
    coordinates: [100.5478, 13.7289],
    description: "โครงการมิกซ์ยูสระดับโลกแห่งใหม่ ติดสวนลุมพินี ผสานนวัตกรรมและความยั่งยืน",
    rating: 4.9,
    reviewsCount: 9200,
    address: "ถนนวิทยุ-พระราม 4 แขวงลุมพินี เขตปทุมวัน",
    openHours: "10:00 - 22:00 น.",
    imageUrl: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=600&q=80",
    tags: ["สมาร์ทซิตี้", "สถาปัตยกรรม", "สวนลุมพินี"],
  }
];

// Route Coordinates: ICONSIAM -> Taksin Bridge -> Sathorn -> Rama IV -> Benchakitti Park
export const NAVIGATION_ROUTE: [number, number][] = [
  [100.5104, 13.7267], // ICONSIAM Origin
  [100.5112, 13.7248],
  [100.5125, 13.7215],
  [100.5140, 13.7198],
  [100.5158, 13.7192], // Crossing Taksin Bridge over Chao Phraya
  [100.5185, 13.7190],
  [100.5218, 13.7193],
  [100.5255, 13.7202],
  [100.5292, 13.7215], // Sathorn Road
  [100.5332, 13.7231],
  [100.5365, 13.7245],
  [100.5401, 13.7261], // Sathorn / Rama IV intersection (Lumphini)
  [100.5442, 13.7269],
  [100.5480, 13.7275],
  [100.5515, 13.7282],
  [100.5552, 13.7291],
  [100.5583, 13.7302], // Destination: Benchakitti Park
];

export interface NavigationStep {
  instruction: string;
  distance: string;
  time: string;
}

export const ROUTE_STEPS: NavigationStep[] = [
  { instruction: "ออกจากจุดเริ่มต้น ICONSIAM มุ่งหน้าไปทางทิศใต้บนถนนเจริญนคร", distance: "450 ม.", time: "2 นาที" },
  { instruction: "เลี้ยวซ้ายข้ามแม่น้ำเจ้าพระยาผ่านสะพานสมเด็จพระเจ้าตากสิน", distance: "1.2 กม.", time: "4 นาที" },
  { instruction: "ขับตรงต่อไปยังถนนสาทรเหนือ มุ่งหน้าแยกวิทยุ", distance: "2.4 กม.", time: "6 นาที" },
  { instruction: "เลี้ยวซ้ายเข้าถนนพระรามที่ 4 ผ่านสวนลุมพินีและโครงการ One Bangkok", distance: "1.8 กม.", time: "5 นาที" },
  { instruction: "เลี้ยวซ้ายเข้าสู่ประตูทางเข้าสวนเบญจกิติ (ถึงจุดหมายปลายทาง)", distance: "300 ม.", time: "1 นาที" },
];

export interface FlightArcDatum {
  id: string;
  from: [number, number]; // [lng, lat]
  to: [number, number];   // [lng, lat]
  flightCode: string;
  airline: string;
  originName: string;
  destName: string;
  status: "In Transit" | "Scheduled" | "Approaching";
  altitude: string;
  aircraft: string;
  duration: string;
}

export const FLIGHT_ARCS: FlightArcDatum[] = [
  {
    id: "arc-bkk-tyo",
    from: [100.7501, 13.6900], // BKK
    to: [139.7798, 35.5494],   // HND Tokyo
    flightCode: "TG-660",
    airline: "Thai Airways Cargo",
    originName: "Bangkok (BKK)",
    destName: "Tokyo Haneda (HND)",
    status: "In Transit",
    altitude: "38,000 ft",
    aircraft: "Boeing 777-300ER",
    duration: "5 ชม. 45 นาที",
  },
  {
    id: "arc-bkk-sin",
    from: [100.7501, 13.6900], // BKK
    to: [103.9894, 1.3644],    // SIN Singapore
    flightCode: "SQ-975",
    airline: "Singapore Cargo",
    originName: "Bangkok (BKK)",
    destName: "Singapore (SIN)",
    status: "Approaching",
    altitude: "14,000 ft",
    aircraft: "Airbus A350-900",
    duration: "2 ชม. 15 นาที",
  },
  {
    id: "arc-bkk-dxb",
    from: [100.7501, 13.6900], // BKK
    to: [55.3644, 25.2532],    // DXB Dubai
    flightCode: "EK-385",
    airline: "Emirates SkyCargo",
    originName: "Bangkok (BKK)",
    destName: "Dubai (DXB)",
    status: "In Transit",
    altitude: "41,000 ft",
    aircraft: "Boeing 777F",
    duration: "6 ชม. 10 นาที",
  },
  {
    id: "arc-bkk-fra",
    from: [100.7501, 13.6900], // BKK
    to: [8.5706, 50.0379],     // FRA Frankfurt
    flightCode: "LH-773",
    airline: "Lufthansa Cargo",
    originName: "Bangkok (BKK)",
    destName: "Frankfurt (FRA)",
    status: "In Transit",
    altitude: "36,000 ft",
    aircraft: "Boeing 777-200F",
    duration: "11 ชม. 30 นาที",
  },
  {
    id: "arc-bkk-lhr",
    from: [100.7501, 13.6900], // BKK
    to: [-0.4543, 51.4700],    // LHR London
    flightCode: "BA-010",
    airline: "British Airways Cargo",
    originName: "Bangkok (BKK)",
    destName: "London Heathrow (LHR)",
    status: "Scheduled",
    altitude: "Standby",
    aircraft: "Boeing 787-9",
    duration: "12 ชม. 40 นาที",
  },
  {
    id: "arc-bkk-sfo",
    from: [100.7501, 13.6900], // BKK
    to: [-122.375, 37.6189],   // SFO San Francisco
    flightCode: "UA-820",
    airline: "United Global Express",
    originName: "Bangkok (BKK)",
    destName: "San Francisco (SFO)",
    status: "In Transit",
    altitude: "39,000 ft",
    aircraft: "Boeing 777-300ER",
    duration: "16 ชม. 20 นาที",
  },
];

// Generate 120 distributed sample points in Bangkok & Metropolitan Region for MapClusterLayer
export function generateClusterData(): GeoJSON.FeatureCollection<GeoJSON.Point> {
  const categories = ["EV Charger", "Locker Box", "Branch Store", "Warehouse", "Pickup Point"];
  const bkkBounds = {
    minLng: 100.35,
    maxLng: 100.75,
    minLat: 13.60,
    maxLat: 13.90,
  };

  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  for (let i = 1; i <= 150; i++) {
    // Generate natural clusters around central Bangkok
    const centerFactor = Math.random() < 0.6 ? 0.4 : 1.0;
    const midLng = 100.53;
    const midLat = 13.75;
    
    const lng = midLng + (Math.random() - 0.5) * (bkkBounds.maxLng - bkkBounds.minLng) * centerFactor;
    const lat = midLat + (Math.random() - 0.5) * (bkkBounds.maxLat - bkkBounds.minLat) * centerFactor;
    const category = categories[i % categories.length];

    features.push({
      type: "Feature",
      id: i,
      properties: {
        id: `node-${i}`,
        name: `${category} สาขา #${i}`,
        category,
        capacity: Math.floor(Math.random() * 80) + 20,
        status: Math.random() > 0.15 ? "Active" : "Maintenance",
      },
      geometry: {
        type: "Point",
        coordinates: [lng, lat],
      },
    });
  }

  return {
    type: "FeatureCollection",
    features,
  };
}

export interface UserCustomPin {
  id: string;
  title: string;
  category: string;
  notes: string;
  coordinates: [number, number];
  createdAt: string;
}

// ============================================================
// COMPLAINT REPORTING SYSTEM
// ============================================================

export type ComplaintStatus = "pending" | "inprogress" | "resolved";

export interface ComplaintCategory {
  id: string;
  label: string;
  icon: string; // JKIcon name
  color: string; // hex color for marker
  bgClass: string; // tailwind bg class
  textClass: string; // tailwind text class
}

export const COMPLAINT_CATEGORIES: ComplaintCategory[] = [
  {
    id: "road",
    label: "ถนน/ทางเท้า",
    icon: "road",
    color: "#f59e0b",
    bgClass: "bg-amber-500",
    textClass: "text-amber-600 dark:text-amber-400",
  },
  {
    id: "flood",
    label: "น้ำท่วม/ระบายน้ำ",
    icon: "droplet",
    color: "#3b82f6",
    bgClass: "bg-blue-500",
    textClass: "text-blue-600 dark:text-blue-400",
  },
  {
    id: "electric",
    label: "ไฟฟ้า/แสงสว่าง",
    icon: "bolt",
    color: "#eab308",
    bgClass: "bg-yellow-500",
    textClass: "text-yellow-600 dark:text-yellow-400",
  },
  {
    id: "trash",
    label: "ขยะ/สิ่งแวดล้อม",
    icon: "trash-can",
    color: "#22c55e",
    bgClass: "bg-green-500",
    textClass: "text-green-600 dark:text-green-400",
  },
  {
    id: "crime",
    label: "อาชญากรรม/ความปลอดภัย",
    icon: "shield-halved",
    color: "#ef4444",
    bgClass: "bg-red-500",
    textClass: "text-red-600 dark:text-red-400",
  },
  {
    id: "noise",
    label: "เสียงรบกวน",
    icon: "volume-high",
    color: "#8b5cf6",
    bgClass: "bg-violet-500",
    textClass: "text-violet-600 dark:text-violet-400",
  },
  {
    id: "other",
    label: "อื่นๆ",
    icon: "clipboard-list",
    color: "#64748b",
    bgClass: "bg-slate-500",
    textClass: "text-slate-600 dark:text-slate-400",
  },
];

export interface ComplaintTimelineEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  description: string;
  status: ComplaintStatus;
  officer?: string;
  icon: string; // JKIcon name
}

export interface ComplaintComment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
  role?: "citizen" | "officer";
}

export type ComplaintPriority = "low" | "medium" | "high" | "urgent";

export interface CityDepartment {
  id: string;
  name: string;
  code: string;
  categoryIds: string[];
  responsibleDistricts: string[];
  headOfficer: string;
  contactPhone: string;
  email: string;
  activeStaffCount: number;
  slaHours: number;
  color: string;
  icon: string;
}

export const BANGKOK_DISTRICTS = [
  "เขตปทุมวัน",
  "เขตวัฒนา",
  "เขตคลองเตย",
  "เขตราชเทวี",
  "เขตบางรัก",
  "เขตสาทร",
  "เขตจตุจักร",
  "เขตดินแดง",
  "เขตพระนคร",
  "เขตห้วยขวาง",
] as const;

export function getProvinceName(city: CityViewport): string {
  return city.name.split(" (")[0].trim();
}

export const THAILAND_REGIONS: string[] = Array.from(
  new Set(CITIES.map((c) => c.region).filter((r): r is string => Boolean(r)))
);

export const THAILAND_PROVINCES: string[] = CITIES.map(getProvinceName);

export const PROVINCE_GROUPS: { region: string; provinces: string[] }[] =
  THAILAND_REGIONS.map((region) => ({
    region,
    provinces: CITIES.filter((c) => c.region === region).map(getProvinceName),
  }));

export const DISTRICT_CENTERS: Record<string, [number, number]> = {
  "เขตปทุมวัน": [100.5348, 13.7442],
  "เขตวัฒนา": [100.5665, 13.7395],
  "เขตคลองเตย": [100.5680, 13.7155],
  "เขตราชเทวี": [100.5382, 13.7580],
  "เขตบางรัก": [100.5220, 13.7268],
  "เขตสาทร": [100.5285, 13.7145],
  "เขตจตุจักร": [100.5525, 13.8120],
  "เขตดินแดง": [100.5585, 13.7705],
  "เขตพระนคร": [100.4955, 13.7565],
  "เขตห้วยขวาง": [100.5815, 13.7745],
};

/** Haversine distance in kilometers between two [lng, lat] points */
export function haversineDistanceKm(a: [number, number], b: [number, number]): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.max(10, Math.round(km * 1000))} ม.`;
  }
  return `${km.toFixed(1)} กม.`;
}

export function inferProvinceFromCoord(coord: [number, number]): string {
  let nearest = "กรุงเทพมหานคร";
  let minKm = Infinity;
  for (const city of CITIES) {
    const d = haversineDistanceKm(coord, city.center);
    if (d < minKm) {
      minKm = d;
      nearest = getProvinceName(city);
    }
  }
  return nearest;
}

export function inferDistrictFromCoord(coord: [number, number]): string {
  let nearest = "เขตปทุมวัน";
  let minKm = Infinity;
  for (const [dist, center] of Object.entries(DISTRICT_CENTERS)) {
    const d = haversineDistanceKm(coord, center);
    if (d < minKm) {
      minKm = d;
      nearest = dist;
    }
  }
  if (minKm <= 28) {
    return nearest;
  }
  const prov = inferProvinceFromCoord(coord);
  return `อ.เมือง${prov}`;
}

export function getDefaultDepartmentForCategory(categoryId: string): string {
  const match = CITY_DEPARTMENTS.find((d) => d.categoryIds.includes(categoryId));
  return match?.id ?? "dept-public-works";
}

export const CITIZEN_XP_REWARDS = {
  DAILY_CHECKIN: 10,
  UPVOTE: 15,
  COMMENT: 10,
  POLL_VOTE: 20,
  REPORT: 30,
  PHOTO_BONUS: 15,
  RESOLVED_BONUS: 25,
} as const;

export interface CitizenXpExtras {
  dailyCheckInCount?: number;
  pollVoteCount?: number;
  commentCount?: number;
  photoReportCount?: number;
  resolvedImpactCount?: number;
}

export interface CitizenLevelTier {
  level: number;
  minXp: number;
  nextXp: number;
  title: string;
}

export const CITIZEN_LEVEL_TIERS: CitizenLevelTier[] = [
  { level: 1, minXp: 0, nextXp: 50, title: "อาสาสมัครใหม่ (Civic Rookie)" },
  { level: 2, minXp: 50, nextXp: 150, title: "สายตรวจพลเมือง (Active Scout)" },
  { level: 3, minXp: 150, nextXp: 300, title: "นักขับเคลื่อนชุมชน (Community Driver)" },
  { level: 4, minXp: 300, nextXp: 500, title: "ผู้พิทักษ์เมือง (City Guardian)" },
  { level: 5, minXp: 500, nextXp: 800, title: "วีรบุรุษพัฒนาเมือง (Civic Hero)" },
];

export function calculateCitizenStats(
  userUpvoteCount: number,
  userReportCount: number,
  extras: CitizenXpExtras = {}
) {
  const dailyCheckInCount = Math.max(0, extras.dailyCheckInCount ?? 0);
  const pollVoteCount = Math.max(0, extras.pollVoteCount ?? 0);
  const commentCount = Math.max(0, extras.commentCount ?? 0);
  const photoReportCount = Math.max(0, extras.photoReportCount ?? 0);
  const resolvedImpactCount = Math.max(0, extras.resolvedImpactCount ?? 0);

  const breakdown = {
    checkIns: dailyCheckInCount * CITIZEN_XP_REWARDS.DAILY_CHECKIN,
    upvotes: userUpvoteCount * CITIZEN_XP_REWARDS.UPVOTE,
    comments: commentCount * CITIZEN_XP_REWARDS.COMMENT,
    polls: pollVoteCount * CITIZEN_XP_REWARDS.POLL_VOTE,
    reports: userReportCount * CITIZEN_XP_REWARDS.REPORT,
    photos: photoReportCount * CITIZEN_XP_REWARDS.PHOTO_BONUS,
    resolved: resolvedImpactCount * CITIZEN_XP_REWARDS.RESOLVED_BONUS,
  };

  const currentXp =
    breakdown.checkIns +
    breakdown.upvotes +
    breakdown.comments +
    breakdown.polls +
    breakdown.reports +
    breakdown.photos +
    breakdown.resolved;

  let level = 1;
  let levelMinXp = 0;
  let nextLevelXp = 50;
  let title = CITIZEN_LEVEL_TIERS[0].title;

  if (currentXp >= 800) {
    const extraLevels = Math.floor((currentXp - 800) / 350);
    level = 6 + extraLevels;
    levelMinXp = 800 + extraLevels * 350;
    nextLevelXp = levelMinXp + 350;
    title = "ผู้นำการเปลี่ยนแปลง (Civic Legend)";
  } else {
    for (let i = CITIZEN_LEVEL_TIERS.length - 1; i >= 0; i -= 1) {
      const tier = CITIZEN_LEVEL_TIERS[i];
      if (currentXp >= tier.minXp) {
        level = tier.level;
        levelMinXp = tier.minXp;
        nextLevelXp = tier.nextXp;
        title = tier.title;
        break;
      }
    }
  }

  const xpNeededForNext = Math.max(1, nextLevelXp - levelMinXp);
  const xpIntoLevel = Math.max(0, currentXp - levelMinXp);
  const xpToNextLevel = Math.max(0, nextLevelXp - currentXp);
  const levelProgress = Math.min(100, Math.max(0, Math.round((xpIntoLevel / xpNeededForNext) * 100)));

  return {
    currentXp,
    level,
    levelMinXp,
    nextLevelXp,
    xpIntoLevel,
    xpNeededForNext,
    xpToNextLevel,
    levelProgress,
    title,
    breakdown,
  };
}

export function deriveComplaintXpMetrics(
  complaints: ComplaintReport[],
  myReportIds: Set<string>,
  upvotedIds: Set<string>
) {
  let photoReportCount = 0;
  let resolvedImpactCount = 0;

  for (const c of complaints) {
    const isMine = myReportIds.has(c.id);
    if (isMine && c.imageBase64) photoReportCount += 1;
    if (c.status === "resolved" && (isMine || upvotedIds.has(c.id))) {
      resolvedImpactCount += 1;
    }
  }

  return { photoReportCount, resolvedImpactCount };
}

export const CITY_DEPARTMENTS: CityDepartment[] = [
  {
    id: "dept-public-works",
    name: "สำนักโยธาและทางหลวงท้องถิ่น",
    code: "DEPT-PW",
    categoryIds: ["road", "sidewalk"],
    responsibleDistricts: ["กรุงเทพมหานคร", "ภาคกลาง (22 จ.)", "ภาคเหนือ (9 จ.)", "ภาคอีสาน (20 จ.)", "ภาคตะวันออก (7 จ.)", "ภาคตะวันตก (5 จ.)", "ภาคใต้ (14 จ.)"],
    headOfficer: "นายธีระ โยธาพัฒนา",
    contactPhone: "02-224-6011",
    email: "publicworks@citypulse.go.th",
    activeStaffCount: 148,
    slaHours: 48,
    color: "#f97316",
    icon: "trowel-bricks",
  },
  {
    id: "dept-drainage",
    name: "สำนักบริหารจัดการน้ำและระบายน้ำ",
    code: "DEPT-DDS",
    categoryIds: ["water", "flood"],
    responsibleDistricts: ["กรุงเทพมหานคร", "ภาคกลาง (22 จ.)", "ภาคเหนือ (9 จ.)", "ภาคอีสาน (20 จ.)", "ภาคตะวันออก (7 จ.)", "ภาคตะวันตก (5 จ.)", "ภาคใต้ (14 จ.)"],
    headOfficer: "นายชัชวาล วารีเกษม",
    contactPhone: "02-248-5115",
    email: "drainage@citypulse.go.th",
    activeStaffCount: 136,
    slaHours: 24,
    color: "#06b6d4",
    icon: "faucet-drip",
  },
  {
    id: "dept-traffic",
    name: "สำนักจราจรขนส่งและไฟฟ้าสาธารณะ",
    code: "DEPT-TRF",
    categoryIds: ["traffic", "electric"],
    responsibleDistricts: ["กรุงเทพมหานคร", "ภาคกลาง (22 จ.)", "ภาคเหนือ (9 จ.)", "ภาคอีสาน (20 จ.)", "ภาคตะวันออก (7 จ.)", "ภาคตะวันตก (5 จ.)", "ภาคใต้ (14 จ.)"],
    headOfficer: "นางสาวศิริพร ทางสัญจร",
    contactPhone: "02-354-1234",
    email: "traffic@citypulse.go.th",
    activeStaffCount: 132,
    slaHours: 36,
    color: "#3b82f6",
    icon: "traffic-light",
  },
  {
    id: "dept-environment",
    name: "สำนักสิ่งแวดล้อมและจัดการขยะ",
    code: "DEPT-ENV",
    categoryIds: ["trash", "noise"],
    responsibleDistricts: ["กรุงเทพมหานคร", "ภาคกลาง (22 จ.)", "ภาคเหนือ (9 จ.)", "ภาคอีสาน (20 จ.)", "ภาคตะวันออก (7 จ.)", "ภาคตะวันตก (5 จ.)", "ภาคใต้ (14 จ.)"],
    headOfficer: "นางกัลยา รักษ์เมือง",
    contactPhone: "02-246-0301",
    email: "environment@citypulse.go.th",
    activeStaffCount: 154,
    slaHours: 24,
    color: "#10b981",
    icon: "recycle",
  },
  {
    id: "dept-city-law",
    name: "สำนักความปลอดภัยและเทศกิจท้องถิ่น",
    code: "DEPT-SEC",
    categoryIds: ["crime", "safety"],
    responsibleDistricts: ["กรุงเทพมหานคร", "ภาคกลาง (22 จ.)", "ภาคเหนือ (9 จ.)", "ภาคอีสาน (20 จ.)", "ภาคตะวันออก (7 จ.)", "ภาคตะวันตก (5 จ.)", "ภาคใต้ (14 จ.)"],
    headOfficer: "พ.ต.ท. ประจักษ์ เทศกิจมั่นคง",
    contactPhone: "02-465-0025",
    email: "safety@citypulse.go.th",
    activeStaffCount: 140,
    slaHours: 12,
    color: "#8b5cf6",
    icon: "shield-halved",
  },
];

export interface ComplaintReport {
  id: string;
  title: string;
  description: string;
  categoryId: string;
  status: ComplaintStatus;
  coordinates: [number, number]; // [lng, lat]
  reporterName: string;
  phone?: string;
  isAnonymous?: boolean;
  reporterMemberId?: string;
  imageBase64?: string; // base64 encoded image
  imageName?: string;
  resolvedImageBase64?: string; // resolution proof photo
  createdAt: string;
  timeline?: ComplaintTimelineEvent[];
  comments?: ComplaintComment[];
  upvotes?: number;
  province?: string;
  district?: string;
  departmentId?: string;
  assignedOfficer?: string;
  priority?: ComplaintPriority;
}

export const INITIAL_COMPLAINTS: ComplaintReport[] = [
  {
    id: "complaint-1",
    title: "ถนนพระรามที่ 4 มีหลุมขนาดใหญ่",
    description: "หลุมบ่อขนาดใหญ่กลางถนน ทำให้รถยนต์เสียหายและอาจเกิดอุบัติเหตุได้",
    categoryId: "road",
    status: "inprogress",
    coordinates: [100.5401, 13.7290],
    reporterName: "สมชาย ใจดี",
    phone: "081-234-5678",
    imageBase64: "/images/complaints/pothole.jpg",
    imageName: "pothole-rama4.jpg",
    createdAt: "8 ก.ย. 2026",
    upvotes: 42,
    province: "กรุงเทพมหานคร",
    district: "เขตปทุมวัน",
    departmentId: "dept-public-works",
    assignedOfficer: "นายวิทยา สมบูรณ์ (ทีมซ่อมบำรุง)",
    priority: "urgent",
    timeline: [
      { id: "t1-1", date: "8 ก.ย. 2026", time: "09:15", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t1-2", date: "8 ก.ย. 2026", time: "10:30", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "ส่งเรื่องไปยังกองช่างสุขาภิบาล สำนักงานเขตปทุมวัน", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
      { id: "t1-3", date: "8 ก.ย. 2026", time: "14:00", title: "เจ้าหน้าที่รับเรื่อง", description: "นายวิทยา หัวหน้าทีมซ่อมบำรุง รับเรื่องดำเนินการ", status: "inprogress", officer: "วิทยา สมบูรณ์", icon: "user-check" },
      { id: "t1-4", date: "9 ก.ย. 2026", time: "08:30", title: "ลงพื้นที่ตรวจสอบ", description: "ทีมช่างลงพื้นที่สำรวจสภาพหลุมถนน ขนาดประมาณ 60x40 ซม. ลึก 15 ซม.", status: "inprogress", officer: "ทีมซ่อมบำรุงเขตปทุมวัน", icon: "magnifying-glass" },
      { id: "t1-5", date: "10 ก.ย. 2026", time: "07:00", title: "เริ่มดำเนินการซ่อมแซม", description: "ส่งทีมซ่อมถนนพร้อมอุปกรณ์ เตรียมปิดเลนเพื่อซ่อมแซม", status: "inprogress", officer: "ทีมซ่อมบำรุงเขตปทุมวัน", icon: "wrench" },
    ],
  },
  {
    id: "complaint-2",
    title: "น้ำท่วมขังซอยสุขุมวิท 11",
    description: "น้ำท่วมขังสูง 30 ซม. หลังฝนตก ท่อระบายน้ำอุดตัน ไม่สามารถสัญจรได้",
    categoryId: "flood",
    status: "pending",
    coordinates: [100.5595, 13.7453],
    reporterName: "วิภา มั่นคง",
    imageBase64: "/images/complaints/flood.jpg",
    imageName: "flood-sukhumvit11.jpg",
    createdAt: "9 ก.ย. 2026",
    upvotes: 38,
    province: "กรุงเทพมหานคร",
    district: "เขตวัฒนา",
    departmentId: "dept-drainage",
    assignedOfficer: "ทีมสูบน้ำเคลื่อนที่เร็ว สรน.",
    priority: "high",
    timeline: [
      { id: "t2-1", date: "9 ก.ย. 2026", time: "18:45", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t2-2", date: "9 ก.ย. 2026", time: "19:00", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "ส่งเรื่องไปยังกองระบายน้ำ สำนักงานเขตวัฒนา", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
    ],
  },
  {
    id: "complaint-3",
    title: "ไฟถนนดับหลายดวงย่านสีลม",
    description: "ไฟส่องสว่างถนนดับ 4 ดวงติดกัน บริเวณถนนสีลมใกล้แยก ทำให้มืดและเสี่ยงอันตราย",
    categoryId: "electric",
    status: "resolved",
    coordinates: [100.5268, 13.7245],
    reporterName: "อนันต์ สว่างใจ",
    createdAt: "5 ก.ย. 2026",
    upvotes: 19,
    province: "กรุงเทพมหานคร",
    district: "เขตบางรัก",
    departmentId: "dept-traffic",
    assignedOfficer: "สมศักดิ์ ไฟฟ้า (กฟน. สีลม)",
    priority: "medium",
    timeline: [
      { id: "t3-1", date: "5 ก.ย. 2026", time: "20:00", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t3-2", date: "5 ก.ย. 2026", time: "20:15", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "ส่งเรื่องไปยังการไฟฟ้านครหลวง เขตสีลม", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
      { id: "t3-3", date: "6 ก.ย. 2026", time: "09:00", title: "เจ้าหน้าที่รับเรื่อง", description: "ช่างไฟฟ้ารับเรื่องและเตรียมอุปกรณ์", status: "inprogress", officer: "สมศักดิ์ ไฟฟ้า", icon: "user-check" },
      { id: "t3-4", date: "6 ก.ย. 2026", time: "13:30", title: "ลงพื้นที่ซ่อมแซม", description: "ทีมช่างลงพื้นที่เปลี่ยนหลอดไฟ LED ใหม่ 4 ดวง และตรวจสอบสายไฟ", status: "inprogress", officer: "ทีมช่างไฟฟ้า กฟน.", icon: "wrench" },
      { id: "t3-5", date: "6 ก.ย. 2026", time: "16:00", title: "ทดสอบระบบ", description: "ทดสอบไฟส่องสว่างทั้ง 4 ดวง ทำงานปกติ", status: "inprogress", officer: "สมศักดิ์ ไฟฟ้า", icon: "vial" },
      { id: "t3-6", date: "7 ก.ย. 2026", time: "08:00", title: "แก้ไขเสร็จสมบูรณ์", description: "ยืนยันว่าไฟถนนทุกดวงทำงานปกติ ปิดเรื่องร้องเรียน", status: "resolved", officer: "หัวหน้างาน กฟน. สีลม", icon: "circle-check" },
    ],
  },
  {
    id: "complaint-4",
    title: "ขยะล้นถังบริเวณตลาดนัด MRT จตุจักร",
    description: "ขยะล้นออกมานอกถัง มีกลิ่นรุนแรง เจ้าหน้าที่ไม่ได้มาเก็บมาหลายวัน",
    categoryId: "trash",
    status: "pending",
    coordinates: [100.5498, 13.8012],
    reporterName: "กนกวรรณ สะอาด",
    createdAt: "9 ก.ย. 2026",
    upvotes: 27,
    province: "กรุงเทพมหานคร",
    district: "เขตจตุจักร",
    departmentId: "dept-environment",
    assignedOfficer: "ฝ่ายรักษาความสะอาด เขตจตุจักร",
    priority: "high",
    timeline: [
      { id: "t4-1", date: "9 ก.ย. 2026", time: "07:30", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
    ],
  },
  {
    id: "complaint-5",
    title: "พบคนต้องสงสัยบริเวณลาดพร้าว 80",
    description: "พบบุคคลต้องสงสัยกลุ่มหนึ่งมั่วสุมช่วงดึก บริเวณซอยลาดพร้าว 80 ควรเพิ่มการตรวจตรา",
    categoryId: "crime",
    status: "inprogress",
    coordinates: [100.5897, 13.7822],
    reporterName: "ประชา ปลอดภัย",
    phone: "082-765-4321",
    createdAt: "7 ก.ย. 2026",
    upvotes: 31,
    province: "กรุงเทพมหานคร",
    district: "เขตห้วยขวาง",
    departmentId: "dept-city-law",
    assignedOfficer: "ร.ต.อ. สุรชัย อำนวยการ (สน.ลาดพร้าว)",
    priority: "urgent",
    timeline: [
      { id: "t5-1", date: "7 ก.ย. 2026", time: "23:15", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t5-2", date: "7 ก.ย. 2026", time: "23:30", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "แจ้งสถานีตำรวจนครบาลลาดพร้าว ขอให้เพิ่มการตรวจตรา", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
      { id: "t5-3", date: "8 ก.ย. 2026", time: "01:00", title: "ตำรวจลงพื้นที่", description: "สายตรวจลาดพร้าวส่งรถตรวจลงพื้นที่ ไม่พบบุคคลต้องสงสัย จะเพิ่มรอบตรวจ", status: "inprogress", officer: "ร.ต.อ. สุรชัย อำนวยการ", icon: "shield-halved" },
      { id: "t5-4", date: "9 ก.ย. 2026", time: "22:00", title: "ตรวจตราเพิ่มเติม", description: "สายตรวจเพิ่มรอบตรวจในพื้นที่ ติดตั้งไฟส่องสว่างเพิ่มเติม", status: "inprogress", officer: "สน.ลาดพร้าว", icon: "eye" },
    ],
  },
  {
    id: "complaint-6",
    title: "ร้านคาราโอเกะเปิดเสียงดังดึกดื่น",
    description: "ร้านคาราโอเกะในซอยเปิดเสียงดังมากหลังเที่ยงคืน รบกวนผู้อยู่อาศัยโดยรอบ",
    categoryId: "noise",
    status: "pending",
    coordinates: [100.5148, 13.7412],
    reporterName: "นิภา นอนหลับ",
    createdAt: "10 ก.ย. 2026",
    upvotes: 14,
    province: "กรุงเทพมหานคร",
    district: "เขตบางรัก",
    departmentId: "dept-environment",
    assignedOfficer: "ฝ่ายสิ่งแวดล้อมและสุขาภิบาล เขตบางรัก",
    priority: "medium",
    timeline: [
      { id: "t6-1", date: "10 ก.ย. 2026", time: "01:30", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t6-2", date: "10 ก.ย. 2026", time: "02:00", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "แจ้งสำนักงานเขตบางรัก ฝ่ายสิ่งแวดล้อมและสุขาภิบาล", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
    ],
  },
  {
    id: "complaint-7",
    title: "ป้ายสัญญาณไฟจราจรชำรุด แยกอโศก",
    description: "ป้ายสัญญาณไฟจราจรแสดงผลไม่ถูกต้อง ไฟแดง-เขียวกระพริบพร้อมกัน ทำให้รถติดและเสี่ยงอุบัติเหตุ",
    categoryId: "road",
    status: "inprogress",
    coordinates: [100.5614, 13.7442],
    reporterName: "วรพงษ์ ขับขี่",
    createdAt: "6 ก.ย. 2026",
    upvotes: 29,
    province: "กรุงเทพมหานคร",
    district: "เขตวัฒนา",
    departmentId: "dept-traffic",
    assignedOfficer: "นายณรงค์ สัญญาณ (สจส.)",
    priority: "urgent",
    timeline: [
      { id: "t7-1", date: "6 ก.ย. 2026", time: "17:00", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
      { id: "t7-2", date: "6 ก.ย. 2026", time: "17:15", title: "ส่งต่อหน่วยงานรับผิดชอบ", description: "แจ้งกองบัญชาการตำรวจจราจร และสำนักการจราจรฯ กทม.", status: "pending", officer: "ระบบอัตโนมัติ", icon: "paper-plane" },
      { id: "t7-3", date: "7 ก.ย. 2026", time: "10:00", title: "เจ้าหน้าที่รับเรื่อง", description: "ช่างไฟสัญญาณจราจรรับเรื่อง เตรียมลงพื้นที่", status: "inprogress", officer: "ณรงค์ สัญญาณ", icon: "user-check" },
      { id: "t7-4", date: "8 ก.ย. 2026", time: "09:00", title: "ลงพื้นที่ตรวจสอบ", description: "พบว่าบอร์ดควบคุมไฟสัญญาณชำรุด ต้องสั่งอะไหล่", status: "inprogress", officer: "ทีมซ่อมสัญญาณจราจร", icon: "magnifying-glass" },
      { id: "t7-5", date: "10 ก.ย. 2026", time: "08:00", title: "รออะไหล่", description: "สั่งบอร์ดควบคุมใหม่ คาดว่าจะได้รับภายใน 2-3 วัน", status: "inprogress", officer: "ณรงค์ สัญญาณ", icon: "clock" },
    ],
  },
  {
    id: "complaint-8",
    title: "สายไฟห้อยต่ำอันตราย ถนนเจริญกรุง",
    description: "สายไฟฟ้าห้อยต่ำลงมาจากเสาไฟ ต่ำกว่ามาตรฐาน ทำให้รถสูงไม่สามารถผ่านได้",
    categoryId: "electric",
    status: "pending",
    coordinates: [100.5021, 13.7342],
    reporterName: "ชัชวาล ไฟฟ้า",
    createdAt: "10 ก.ย. 2026",
    upvotes: 22,
    province: "กรุงเทพมหานคร",
    district: "เขตบางรัก",
    departmentId: "dept-traffic",
    assignedOfficer: "ช่างไฟฟ้าพื้นที่ส่วนกลาง",
    priority: "high",
    timeline: [
      { id: "t8-1", date: "10 ก.ย. 2026", time: "11:00", title: "รับเรื่องร้องเรียน", description: "ระบบบันทึกเรื่องร้องเรียนจากประชาชนเรียบร้อยแล้ว", status: "pending", icon: "inbox" },
    ],
  },
  {
    id: "complaint-9",
    title: "น้ำท่วมขังและท่อระบายน้ำอุดตันย่านคูเมืองเชียงใหม่",
    description: "หลังฝนตกหนักมีน้ำรอการระบายบริเวณประตูท่าแพและถนนรอบคูเมือง ทำให้การจราจรชะลอตัว",
    categoryId: "flood",
    status: "inprogress",
    coordinates: [98.9933, 18.7878],
    reporterName: "อรทัย เมืองเหนือ",
    createdAt: "10 ก.ย. 2026",
    upvotes: 35,
    province: "เชียงใหม่",
    district: "อ.เมืองเชียงใหม่",
    departmentId: "dept-drainage",
    assignedOfficer: "ทีมสูบน้ำเทศบาลนครเชียงใหม่",
    priority: "high",
    timeline: [
      { id: "t9-1", date: "10 ก.ย. 2026", time: "08:20", title: "รับเรื่องร้องเรียน", description: "บันทึกพิกัดจุดน้ำท่วมขังรอบคูเมืองเชียงใหม่", status: "pending", icon: "inbox" },
      { id: "t9-2", date: "10 ก.ย. 2026", time: "10:15", title: "ส่งทีมลอกท่อระบายน้ำ", description: "สำนักจัดการน้ำส่งรถดูดโคลนและทีมช่างเข้าเคลียร์ปากท่อ", status: "inprogress", officer: "ทีมระบายน้ำ จ.เชียงใหม่", icon: "wrench" },
    ],
  },
  {
    id: "complaint-10",
    title: "ถนนมิตรภาพช่วงหน้า ม.ขอนแก่น มีหลุมลึกและผิวจราจรทรุด",
    description: "ช่องทางซ้ายมีหลุมกว้างและขอบทางชำรุด เสี่ยงอันตรายต่อรถจักรยานยนต์ในช่วงกลางคืน",
    categoryId: "road",
    status: "pending",
    coordinates: [102.8236, 16.4694],
    reporterName: "กิตติศักดิ์ อีสานใต้",
    createdAt: "10 ก.ย. 2026",
    upvotes: 28,
    province: "ขอนแก่น",
    district: "อ.เมืองขอนแก่น",
    departmentId: "dept-public-works",
    assignedOfficer: "แขวงทางหลวงขอนแก่นที่ 1",
    priority: "urgent",
    timeline: [
      { id: "t10-1", date: "10 ก.ย. 2026", time: "09:40", title: "รับเรื่องร้องเรียน", description: "บันทึกเรื่องร้องเรียนและส่งต่อศูนย์โยธาประจำจังหวัดขอนแก่น", status: "pending", icon: "inbox" },
    ],
  },
  {
    id: "complaint-11",
    title: "ไฟส่องสว่างทางเท้าเลียบหาดพัทยาดับหลายจุด",
    description: "ไฟทางเท้าช่วงโค้งถนนเลียบหาดดับติดต่อกันเกือบ 300 เมตร มืดและไม่ปลอดภัยต่อนักท่องเที่ยว",
    categoryId: "electric",
    status: "pending",
    coordinates: [100.8825, 12.9347],
    reporterName: "ปรีชา บูรพา",
    createdAt: "9 ก.ย. 2026",
    upvotes: 24,
    province: "ชลบุรี",
    district: "อ.บางละมุง",
    departmentId: "dept-traffic",
    assignedOfficer: "ฝ่ายไฟฟ้าสาธารณะ เมืองพัทยา",
    priority: "high",
    timeline: [
      { id: "t11-1", date: "9 ก.ย. 2026", time: "19:30", title: "รับเรื่องร้องเรียน", description: "แจ้งทีมช่างไฟฟ้าประจำพื้นที่ จ.ชลบุรี ตรวจสอบสายไฟใต้ดิน", status: "pending", icon: "inbox" },
    ],
  },
  {
    id: "complaint-12",
    title: "ขยะตกค้างจุดชมวิวและทางเดินหาดป่าตองช่วงวันหยุด",
    description: "ปริมาณขยะสะสมล้นถังรองรับบริเวณทางขึ้นจุดชมวิว ส่งกลิ่นรบกวนนักท่องเที่ยว",
    categoryId: "trash",
    status: "resolved",
    coordinates: [98.2965, 7.8961],
    reporterName: "ศิริลักษณ์ อันดามัน",
    createdAt: "7 ก.ย. 2026",
    upvotes: 18,
    province: "ภูเก็ต",
    district: "อ.กะทู้",
    departmentId: "dept-environment",
    assignedOfficer: "หน่วยรักษาความสะอาด เทศบาลเมืองป่าตอง",
    priority: "medium",
    timeline: [
      { id: "t12-1", date: "7 ก.ย. 2026", time: "08:00", title: "รับเรื่องร้องเรียน", description: "ระบบส่งต่อข้อมูลไปยังสำนักสิ่งแวดล้อม จ.ภูเก็ต", status: "pending", icon: "inbox" },
      { id: "t12-2", date: "7 ก.ย. 2026", time: "11:00", title: "จัดเก็บและเพิ่มจุดวางถังขยะ", description: "จัดเก็บขยะตกค้างทั้งหมดพร้อมเพิ่มความถี่รอบเก็บช่วงวันหยุด", status: "resolved", officer: "ทีมสิ่งแวดล้อม จ.ภูเก็ต", icon: "circle-check" },
    ],
  },
  {
    id: "complaint-13",
    title: "สัญญาณไฟจราจรแยกแครายขัดข้องช่วงเร่งด่วน",
    description: "ไฟสัญญาณฝั่งถนนติวานนท์จังหวะเวลาสั้นผิดปกติ ทำให้รถสะสมยาวหลายกิโลเมตร",
    categoryId: "traffic",
    status: "inprogress",
    coordinates: [100.5229, 13.8615],
    reporterName: "ธนวัฒน์ ปริมณฑล",
    createdAt: "10 ก.ย. 2026",
    upvotes: 33,
    province: "นนทบุรี",
    district: "อ.เมืองนนทบุรี",
    departmentId: "dept-traffic",
    assignedOfficer: "ศูนย์ควบคุมจราจร จ.นนทบุรี",
    priority: "urgent",
    timeline: [
      { id: "t13-1", date: "10 ก.ย. 2026", time: "07:45", title: "รับเรื่องร้องเรียน", description: "ส่งต่อศูนย์ควบคุมสัญญาณไฟจราจรจังหวัดนนทบุรี", status: "pending", icon: "inbox" },
      { id: "t13-2", date: "10 ก.ย. 2026", time: "09:10", title: "ปรับจูนรอบสัญญาณไฟ", description: "วิศวกรจราจรเข้าตรวจสอบตู้ควบคุมและปรับตั้งเวลาชั่วคราว", status: "inprogress", officer: "ทีมจราจร จ.นนทบุรี", icon: "wrench" },
    ],
  },
];

export type CityLayerKey = "complaints" | "emergency" | "polls" | "cctv" | "environment";

export interface EmergencyPoint {
  id: string;
  name: string;
  type: "aed" | "hospital" | "fire_station" | "police" | "rescue";
  locationName: string;
  coordinates: [number, number];
  locationApproximate?: boolean;
  phone?: string;
  instruction?: string;
  is24h: boolean;
}

export const EMERGENCY_POINTS: EmergencyPoint[] = [
  {
    id: "emg-1",
    name: "จุดติดตั้งเครื่องกระตุกหัวใจ AED สถานีสยาม",
    type: "aed",
    locationName: "BTS สถานีสยาม ชั้นจำหน่ายตั๋ว ฝั่งทางออก 3",
    coordinates: [100.5347, 13.7456],
    instruction: "ตู้สีเขียวติดเสาใกล้ห้องเจ้าหน้าที่สถานี เปิดตู้สัญญาณเตือนจะดังอัตโนมัติ",
    is24h: false,
    phone: "02-617-6000",
  },
  {
    id: "emg-2",
    name: "จุดติดตั้งเครื่องกระตุกหัวใจ AED สวนลุมพินี",
    type: "aed",
    locationName: "สวนลุมพินี ประตู 1 ฝั่งพระบรมราชานุสาวรีย์ ร.6",
    coordinates: [100.5415, 13.7314],
    instruction: "ตู้ AED ติดตั้งบริเวณป้อมรักษาความปลอดภัยทางเข้า",
    is24h: true,
    phone: "1669",
  },
  {
    id: "emg-3",
    name: "โรงพยาบาลจุฬาลงกรณ์ สภากาชาดไทย",
    type: "hospital",
    locationName: "1874 ถนนพระรามที่ 4 แขวงปทุมวัน เขตปทุมวัน",
    coordinates: [100.5360, 13.7325],
    instruction: "ศูนย์อุบัติเหตุและฉุกเฉิน ชั้น 1 อาคารภูมิสิริมังคลานุสรณ์",
    is24h: true,
    phone: "02-256-4000",
  },
  {
    id: "emg-4",
    name: "โรงพยาบาลตำรวจ",
    type: "hospital",
    locationName: "492/1 ถนนพระรามที่ 1 แขวงปทุมวัน เขตปทุมวัน",
    coordinates: [100.5390, 13.7445],
    instruction: "แผนกอุบัติเหตุฉุกเฉิน ตึกเฉลิมพระเกียรติ",
    is24h: true,
    phone: "02-207-6000",
  },
  {
    id: "emg-5",
    name: "สถานีดับเพลิงและกู้ภัยบรรทัดทอง",
    type: "fire_station",
    locationName: "ถนนบรรทัดทอง แขวงรองเมือง เขตปทุมวัน",
    coordinates: [100.5230, 13.7420],
    instruction: "ทีมกู้ภัยและดับเพลิงพร้อมออกปฏิบัติการ 24 ชั่วโมง",
    is24h: true,
    phone: "199",
  },
  {
    id: "emg-6",
    name: "สถานีดับเพลิงและกู้ภัยคลองเตย",
    type: "fire_station",
    locationName: "ถนนอาจณรงค์ แขวงคลองเตย เขตคลองเตย",
    coordinates: [100.5645, 13.7145],
    instruction: "ศูนย์ดับเพลิงเขตคลองเตยและใกล้เคียง",
    is24h: true,
    phone: "199",
  },
  {
    id: "emg-7",
    name: "สถานีตำรวจนครบาลลุมพินี",
    type: "police",
    locationName: "ถนนวิทยุ แขวงลุมพินี เขตปทุมวัน",
    coordinates: [100.5475, 13.7340],
    instruction: "บริการแจ้งความคดีฉุกเฉินและสายตรวจเคลื่อนที่เร็ว",
    is24h: true,
    phone: "02-255-5455",
  },
  {
    id: "emg-8",
    name: "จุดติดตั้งเครื่องกระตุกหัวใจ AED สถานีอโศก",
    type: "aed",
    locationName: "BTS อโศก เชื่อม Skywalk MRT สุขุมวิท",
    coordinates: [100.5604, 13.7372],
    instruction: "ตู้ AED ด้านหน้าทางเข้าศูนย์การค้าเทอร์มินอล 21",
    is24h: false,
    phone: "1669",
  },
];

export interface CivicPoll {
  id: string;
  title: string;
  description: string;
  locationName: string;
  province?: string;
  district?: string;
  subdistrict?: string;
  coordinates: [number, number];
  category: "safety" | "traffic" | "environment" | "pedestrian";
  agreeCount: number;
  disagreeCount: number;
  totalVotes: number;
  proposalBy: string;
  endDate: string;
}

export const INITIAL_CIVIC_POLLS: CivicPoll[] = [
  {
    id: "poll-1",
    title: "โครงการติดตั้งทางม้าลายอัจฉริยะพร้อมไฟสัญญาณคนข้าม แยกอโศก",
    description: "เนื่องจากคนเดินเท้าข้ามถนนหนาแน่น เสนอติดตั้งสัญญาณไฟตรวจจับคนข้ามและกล้องตรวจจับผู้ฝ่าฝืน",
    locationName: "สี่แยกอโศก-สุขุมวิท เขตวัฒนา",
    coordinates: [100.5614, 13.7365],
    category: "pedestrian",
    agreeCount: 248,
    disagreeCount: 19,
    totalVotes: 267,
    proposalBy: "เครือข่ายความปลอดภัยคนเดินเท้า",
    endDate: "30 ก.ย. 2026",
  },
  {
    id: "poll-2",
    title: "ข้อเสนอขยายทางจักรยานและทางเดินริมคลองแสนแสบ สู่สวนเบญจกิติ",
    description: "สร้างทางเชื่อมสีเขียวร่มรื่น ลดการใช้รถยนต์ส่วนบุคคล เชื่อมต่อสถานีขนส่งสาธารณะ",
    locationName: "สะพานอโศก - ท่าเรือคลองแสนแสบ",
    coordinates: [100.5620, 13.7485],
    category: "environment",
    agreeCount: 182,
    disagreeCount: 14,
    totalVotes: 196,
    proposalBy: "กลุ่มพัฒนาเมืองยั่งยืน",
    endDate: "15 ต.ค. 2026",
  },
  {
    id: "poll-3",
    title: "ปรับปรุงจุดเปลี่ยวซอยร่วมฤดี ติดตั้งเสาไฟส่องสว่างโซลาร์เซลล์ 20 ต้น",
    description: "ซอยย่อยแสงสว่างไม่เพียงพอช่วงดึก ประชาชนเสนอเพิ่มไฟทางและกล้องวงจรปิด",
    locationName: "ซอยร่วมฤดี ถนนวิทยุ เขตปทุมวัน",
    coordinates: [100.5470, 13.7380],
    category: "safety",
    agreeCount: 310,
    disagreeCount: 8,
    totalVotes: 318,
    proposalBy: "คณะกรรมการชุมชนร่วมฤดี",
    endDate: "5 ต.ค. 2026",
  },
  {
    id: "poll-4",
    title: "โครงการจัดระเบียบที่จอดรถรับส่งและจุดพักไรเดอร์ ถนนสีลม",
    description: "กำหนดจุดพักรถส่งอาหารเป็นสัดส่วนเพื่อลดการจอดกีดขวางทางเท้าและการจราจรหน้าอาคารสำนักงาน",
    locationName: "ถนนสีลม บริเวณหน้าปากซอยคอนแวนต์",
    coordinates: [100.5315, 13.7265],
    category: "traffic",
    agreeCount: 215,
    disagreeCount: 42,
    totalVotes: 257,
    proposalBy: "สมาคมผู้ประกอบการย่านสีลม",
    endDate: "20 ต.ค. 2026",
  },
];

export interface CctvPoint {
  id: string;
  name: string;
  locationName: string;
  coordinates: [number, number];
  status: "normal" | "warning" | "alert";
  waterLevel?: string;
  trafficCondition: "smooth" | "moderate" | "congested";
  snapshotUrl: string;
  lastUpdated: string;
}

export const CCTV_POINTS: CctvPoint[] = [
  {
    id: "cctv-1",
    name: "สถานีสูบน้ำคลองเตย - คลองพระโขนง",
    locationName: "ประตูระบายน้ำพระโขนง เขตคลองเตย",
    coordinates: [100.5890, 13.7085],
    status: "normal",
    waterLevel: "-0.45 ม. (ระดับปกติ)",
    trafficCondition: "smooth",
    snapshotUrl: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80",
    lastUpdated: "5 นาทีที่แล้ว",
  },
  {
    id: "cctv-2",
    name: "อุโมงค์ระบายน้ำคลองแสนแสบ (ประตูน้ำ)",
    locationName: "คลองแสนแสบ บริเวณแยกประตูน้ำ เขตราชเทวี",
    coordinates: [100.5405, 13.7500],
    status: "normal",
    waterLevel: "-0.28 ม. (ระบายน้ำได้ดี)",
    trafficCondition: "moderate",
    snapshotUrl: "https://images.unsplash.com/photo-1519451241324-20b4ea2c4220?auto=format&fit=crop&w=600&q=80",
    lastUpdated: "2 นาทีที่แล้ว",
  },
  {
    id: "cctv-3",
    name: "กล้องจราจรและตรวจน้ำท่วม สี่แยกรัชดา-พระราม 4",
    locationName: "แยกพระราม 4 ติดศูนย์การประชุมแห่งชาติสิริกิติ์",
    coordinates: [100.5590, 13.7225],
    status: "warning",
    waterLevel: "+0.05 ม. (รอการระบายเล็กน้อย)",
    trafficCondition: "congested",
    snapshotUrl: "https://images.unsplash.com/photo-1583417319070-4a69db38a482?auto=format&fit=crop&w=600&q=80",
    lastUpdated: "3 นาทีที่แล้ว",
  },
  {
    id: "cctv-4",
    name: "กล้องตรวจการจราจร อนุสาวรีย์ชัยสมรภูมิ",
    locationName: "วงเวียนอนุสาวรีย์ชัยสมรภูมิ เขตราชเทวี",
    coordinates: [100.5385, 13.7650],
    status: "normal",
    trafficCondition: "moderate",
    snapshotUrl: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80",
    lastUpdated: "1 นาทีที่แล้ว",
  },
];

