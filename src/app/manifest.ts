import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CityPulse — แผนที่ร้องเรียนอัจฉริยะ & ศูนย์พลเมืองตื่นรู้",
    short_name: "CityPulse",
    description:
      "ระบบแผนที่แจ้งเหตุและติดตามคุณภาพเมือง 77 จังหวัด พร้อมศูนย์พลเมืองตื่นรู้และศูนย์ปฏิบัติการเจ้าหน้าที่",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#020617",
    theme_color: "#0f766e",
    lang: "th",
    categories: ["navigation", "utilities", "government"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "แจ้งปัญหาบนแผนที่",
        short_name: "แจ้งปัญหา",
        description: "ปักหมุดแจ้งเรื่องร้องเรียนใหม่ (+30 XP)",
        url: "/?report=1",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "ศูนย์พลเมืองตื่นรู้",
        short_name: "พลเมือง",
        description: "ดูระดับ XP เหรียญเกียรติยศ และภารกิจรายวัน",
        url: "/citizen",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

