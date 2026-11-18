"use client";

import React, { useEffect, useRef } from "react";
import { useMap } from "@/components/ui/map";
import type {
  Air4ThaiStation,
  GistdaBurnScarItem,
  GistdaFloodCentroid,
  LiveFxWeatherTelemetry,
} from "@/lib/external-apis";
import type { CctvPoint, ComplaintReport } from "@/data/map-data";

export type WeatherAnimationMode = "off" | "rain" | "storm" | "flood" | "dust";

interface MapWeatherAnimationOverlayProps {
  mode: WeatherAnimationMode;
  airStations: Air4ThaiStation[];
  cctvPoints: CctvPoint[];
  complaints: ComplaintReport[];
  gistdaFloodFeatures?: GistdaFloodCentroid[];
  burnScars?: GistdaBurnScarItem[];
  liveWeather?: LiveFxWeatherTelemetry | null;
  isDark?: boolean;
}

interface RainDrop {
  x: number;
  y: number;
  len: number;
  speed: number;
  alpha: number;
  splashY: number;
}

interface SplashRipple {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
}

interface WindParticle {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  age: number;
  maxAge: number;
  speedScale: number;
}

interface DustMicroParticle {
  stationIdx: number;
  angle: number;
  distRatio: number;
  speed: number;
  size: number;
  phase: number;
}

// Major Thailand river / flash-flood corridors [lng, lat][] with higher-resolution river bends
const RIVER_CORRIDORS: [number, number][][] = [
  // Chao Phraya River corridor (Pak Nam Pho Nakhon Sawan bend -> Chai Nat -> Ayutthaya -> Bangkok -> Gulf)
  [
    [100.146, 15.709],
    [100.135, 15.696],
    [100.123, 15.689],
    [100.119, 15.676],
    [100.134, 15.645],
    [100.165, 15.585],
    [100.155, 15.485],
    [100.128, 15.365],
    [100.125, 15.185],
    [100.165, 15.115],
    [100.382, 14.950],
    [100.405, 14.880],
    [100.455, 14.605],
    [100.562, 14.355],
    [100.525, 14.020],
    [100.495, 13.755],
    [100.558, 13.685],
    [100.592, 13.595],
  ],
  // Ping River (Chiang Mai -> Tak -> Kamphaeng Phet -> Nakhon Sawan Pak Nam Pho)
  [
    [98.995, 18.795],
    [99.012, 18.550],
    [98.965, 17.850],
    [99.126, 16.885],
    [99.530, 16.480],
    [99.835, 16.050],
    [100.065, 15.815],
    [100.138, 15.716],
  ],
  // Nan River (Phitsanulok -> Phichit -> Nakhon Sawan Pak Nam Pho)
  [
    [100.258, 16.821],
    [100.345, 16.440],
    [100.275, 16.020],
    [100.185, 15.785],
    [100.146, 15.709],
  ],
  // Mun / Chi corridor (Khon Kaen -> Ubon)
  [
    [102.835, 16.440],
    [103.300, 16.185],
    [103.650, 16.055],
    [104.140, 15.795],
    [104.620, 15.385],
    [104.865, 15.240],
  ],
  // Southern flash-flood basin (Surat Thani / Nakhon Si Thammarat / Hat Yai)
  [
    [99.055, 9.155],
    [99.335, 9.140],
    [99.605, 8.905],
    [99.965, 8.435],
    [100.155, 8.205],
  ],
];

function traceSmoothSpline(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
) {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (pts.length === 2) {
    ctx.lineTo(pts[1].x, pts[1].y);
    return;
  }
  for (let i = 1; i < pts.length - 1; i++) {
    const midX = (pts[i].x + pts[i + 1].x) * 0.5;
    const midY = (pts[i].y + pts[i + 1].y) * 0.5;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, midX, midY);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last.x, last.y);
}

// Local Bangkok drainage / canal vectors for high-zoom urban view
const BANGKOK_CANAL_CORRIDORS: [number, number][][] = [
  // Saen Saep Canal
  [
    [100.64, 13.765],
    [100.59, 13.755],
    [100.56, 13.748],
    [100.535, 13.749],
    [100.515, 13.755],
  ],
  // Sukhumvit -> Chao Phraya drainage flow
  [
    [100.585, 13.745],
    [100.568, 13.738],
    [100.558, 13.726],
    [100.548, 13.708],
  ],
  // Ladprao -> Rama 9 floodway
  [
    [100.605, 13.805],
    [100.585, 13.782],
    [100.575, 13.758],
    [100.568, 13.736],
  ],
];

function getPm25Rgb(pm25: number | null): string {
  if (pm25 === null) return "148, 163, 184";
  if (pm25 <= 15) return "14, 165, 233"; // Sky
  if (pm25 <= 25) return "16, 185, 129"; // Emerald
  if (pm25 <= 37.5) return "245, 158, 11"; // Amber
  if (pm25 <= 75) return "249, 115, 22"; // Orange
  return "239, 68, 68"; // Red
}

export function MapWeatherAnimationOverlay({
  mode,
  airStations,
  cctvPoints,
  complaints,
  gistdaFloodFeatures = [],
  burnScars = [],
  liveWeather = null,
  isDark = false,
}: MapWeatherAnimationOverlayProps) {
  const { map, isLoaded } = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Keep latest props accessible inside rAF without restarting loop
  const propsRef = useRef({
    airStations,
    cctvPoints,
    complaints,
    gistdaFloodFeatures,
    burnScars,
    liveWeather,
    isDark,
  });
  useEffect(() => {
    propsRef.current = {
      airStations,
      cctvPoints,
      complaints,
      gistdaFloodFeatures,
      burnScars,
      liveWeather,
      isDark,
    };
  }, [airStations, cctvPoints, complaints, gistdaFloodFeatures, burnScars, liveWeather, isDark]);

  useEffect(() => {
    if (mode === "off" || !map || !isLoaded) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let dpr = 1;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = parent.clientWidth;
      height = parent.clientHeight;
      canvas.width = Math.max(1, Math.floor(width * dpr));
      canvas.height = Math.max(1, Math.floor(height * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    // Anchor storm center near initial viewport center when storm starts
    const initialCenter = map.getCenter();
    const stormEyeLngLat: [number, number] = [initialCenter.lng, initialCenter.lat];

    // Initialize particle pools per mode
    const rainDrops: RainDrop[] = Array.from({ length: 180 }, () => ({
      x: Math.random() * Math.max(width, 800),
      y: Math.random() * Math.max(height, 600),
      len: 14 + Math.random() * 18,
      speed: 13 + Math.random() * 10,
      alpha: 0.28 + Math.random() * 0.45,
      splashY: height * (0.25 + Math.random() * 0.72),
    }));
    const splashes: SplashRipple[] = [];

    const windParticles: WindParticle[] = Array.from({ length: 210 }, () => {
      const x = Math.random() * Math.max(width, 800);
      const y = Math.random() * Math.max(height, 600);
      return {
        x,
        y,
        prevX: x,
        prevY: y,
        age: Math.floor(Math.random() * 90),
        maxAge: 65 + Math.floor(Math.random() * 65),
        speedScale: 0.8 + Math.random() * 0.7,
      };
    });

    const dustParticles: DustMicroParticle[] = Array.from({ length: 140 }, (_, i) => ({
      stationIdx: i,
      angle: Math.random() * Math.PI * 2,
      distRatio: Math.random(),
      speed: 0.004 + Math.random() * 0.009,
      size: 1.5 + Math.random() * 2.8,
      phase: Math.random() * Math.PI * 2,
    }));

    let lightningAlpha = 0;
    let nextLightningAt = performance.now() + 2600;
    let rafId = 0;
    const startTime = performance.now();

    const drawRain = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const dark = propsRef.current.isDark;

      // Subtle storm overcast tint
      ctx.fillStyle = dark ? "rgba(15, 23, 42, 0.22)" : "rgba(30, 58, 138, 0.08)";
      ctx.fillRect(0, 0, width, height);

      // Periodic soft lightning flash
      if (now >= nextLightningAt) {
        lightningAlpha = 0.26;
        nextLightningAt = now + 3500 + Math.random() * 4500;
      }
      if (lightningAlpha > 0.005) {
        ctx.fillStyle = `rgba(224, 242, 254, ${lightningAlpha})`;
        ctx.fillRect(0, 0, width, height);
        lightningAlpha *= 0.86;
      }

      const lw = propsRef.current.liveWeather;
      const windRad = lw ? ((lw.windDirectionDeg + 180) * Math.PI) / 180 : Math.PI * 1.15;
      const windFactor = lw ? Math.min(2.2, Math.max(0.5, lw.windSpeedKmh / 14)) : 1;
      const windDx = Math.sin(windRad) * 3.4 * windFactor;
      const rainBoost = lw && lw.precipitationMm > 0.2 ? 1.25 : 1;
      ctx.lineCap = "round";

      for (const drop of rainDrops) {
        drop.x += windDx;
        drop.y += drop.speed * rainBoost;

        ctx.strokeStyle = dark
          ? `rgba(125, 211, 252, ${Math.min(0.95, drop.alpha * rainBoost)})`
          : `rgba(14, 116, 144, ${Math.min(0.95, drop.alpha * 0.9 * rainBoost)})`;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(drop.x, drop.y);
        ctx.lineTo(drop.x + windDx * 1.4, drop.y + drop.len);
        ctx.stroke();

        if (drop.y >= drop.splashY || drop.y > height) {
          if (splashes.length < 48 && Math.random() < 0.35) {
            splashes.push({
              x: drop.x,
              y: Math.min(drop.y, height - 8),
              radius: 1.5,
              maxRadius: 9 + Math.random() * 9,
              alpha: 0.6,
            });
          }
          drop.x = Math.random() * (width + 140);
          drop.y = -20 - Math.random() * 80;
          drop.splashY = height * (0.2 + Math.random() * 0.78);
        }
      }

      for (let i = splashes.length - 1; i >= 0; i--) {
        const s = splashes[i];
        s.radius += 0.55;
        s.alpha *= 0.92;
        if (s.radius >= s.maxRadius || s.alpha < 0.04) {
          splashes.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = dark
          ? `rgba(186, 230, 253, ${s.alpha})`
          : `rgba(2, 132, 199, ${s.alpha})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(s.x, s.y, s.radius, s.radius * 0.42, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    };

    const drawStorm = (now: number) => {
      const dark = propsRef.current.isDark;
      // Fade previous frame slightly to leave wind streamline tails
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "source-over";

      const eyePt = map.project(stormEyeLngLat);
      const t = (now - startTime) * 0.001;

      // Subtle rotating vortex rings around geo-anchored storm eye
      const maxEyeRadius = Math.min(width, height) * 0.24;
      for (let r = 0; r < 3; r++) {
        const radius = 26 + r * 30;
        const rot = t * (1.8 - r * 0.35);
        ctx.strokeStyle = dark
          ? `rgba(56, 189, 248, ${0.24 - r * 0.05})`
          : `rgba(2, 132, 199, ${0.22 - r * 0.05})`;
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(eyePt.x, eyePt.y, radius, rot, rot + Math.PI * 1.35);
        ctx.stroke();
      }

      // Wind streamline particles spiraling around the storm eye + live meteorological drift
      const lw = propsRef.current.liveWeather;
      const windRad = lw ? ((lw.windDirectionDeg + 180) * Math.PI) / 180 : Math.PI * 0.35;
      const speedMul = lw ? Math.min(2.0, Math.max(0.7, lw.windSpeedKmh / 14)) : 1;
      const driftX = Math.sin(windRad) * 2.6 * speedMul;
      const driftY = -Math.cos(windRad) * 2.6 * speedMul;

      ctx.lineCap = "round";
      for (const p of windParticles) {
        p.prevX = p.x;
        p.prevY = p.y;

        const dx = p.x - eyePt.x;
        const dy = p.y - eyePt.y;
        const dist = Math.hypot(dx, dy) || 1;
        const influence = Math.exp(-dist / Math.max(maxEyeRadius * 1.6, 140));

        // Counter-clockwise cyclone tangent + slight inward suction + real wind vector
        const tx = -dy / dist;
        const ty = dx / dist;
        const baseVx = driftX + Math.sin(p.y * 0.01 + t) * 0.7;
        const baseVy = driftY + Math.cos(p.x * 0.01 + t) * 0.7;

        const swirlSpeed = 5.8 * speedMul * influence;
        const vx = (baseVx * (1 - influence * 0.6) + (tx * swirlSpeed - (dx / dist) * 0.9 * influence)) * p.speedScale;
        const vy = (baseVy * (1 - influence * 0.6) + (ty * swirlSpeed - (dy / dist) * 0.9 * influence)) * p.speedScale;

        p.x += vx;
        p.y += vy;
        p.age += 1;

        const lifeAlpha = Math.sin((p.age / p.maxAge) * Math.PI);
        const speedMag = Math.hypot(vx, vy);
        ctx.strokeStyle =
          speedMag > 5.2
            ? `rgba(45, 212, 191, ${0.72 * lifeAlpha})`
            : dark
            ? `rgba(125, 211, 252, ${0.58 * lifeAlpha})`
            : `rgba(14, 116, 144, ${0.55 * lifeAlpha})`;
        ctx.lineWidth = speedMag > 5.2 ? 2.1 : 1.5;
        ctx.beginPath();
        ctx.moveTo(p.prevX, p.prevY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();

        if (
          p.age >= p.maxAge ||
          p.x < -30 ||
          p.x > width + 30 ||
          p.y < -30 ||
          p.y > height + 30
        ) {
          p.x = Math.random() * width;
          p.y = Math.random() * height;
          p.prevX = p.x;
          p.prevY = p.y;
          p.age = 0;
        }
      }
    };

    const drawFlood = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = (now - startTime) * 0.001;
      const zoom = map.getZoom();
      const dark = propsRef.current.isDark;
      const gistdaPoints = propsRef.current.gistdaFloodFeatures;

      const corridors =
        zoom >= 10.5 ? [...BANGKOK_CANAL_CORRIDORS, ...RIVER_CORRIDORS] : RIVER_CORRIDORS;

      // 1. Draw smooth curved river & flash-flood corridors with flowing crests
      for (const pathLngLat of corridors) {
        const pts = pathLngLat.map((coord) => map.project(coord));
        if (pts.length < 2) continue;

        ctx.save();
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.strokeStyle = dark ? "rgba(6, 182, 212, 0.24)" : "rgba(2, 132, 199, 0.20)";
        ctx.lineWidth = zoom >= 10.5 ? 12 : 9;
        traceSmoothSpline(ctx, pts);
        ctx.stroke();

        // Animated surging water dashes flowing downstream
        ctx.strokeStyle = dark ? "rgba(103, 232, 249, 0.85)" : "rgba(14, 165, 233, 0.88)";
        ctx.lineWidth = zoom >= 10.5 ? 3.5 : 2.8;
        ctx.setLineDash([18, 22]);
        ctx.lineDashOffset = -(t * 75);
        traceSmoothSpline(ctx, pts);
        ctx.stroke();

        ctx.strokeStyle = "rgba(255, 255, 255, 0.72)";
        ctx.lineWidth = 1.4;
        ctx.setLineDash([8, 32]);
        ctx.lineDashOffset = -(t * 105);
        traceSmoothSpline(ctx, pts);
        ctx.stroke();
        ctx.restore();
      }

      // 2. Animated flow vectors & ripples across live GISTDA flood polygons (when API key is active)
      for (let i = 0; i < gistdaPoints.length; i++) {
        const item = gistdaPoints[i];
        const pt = map.project(item.coord);
        if (pt.x < -80 || pt.x > width + 80 || pt.y < -80 || pt.y > height + 80) continue;

        // Subtle downstream directional flow streak through each GISTDA flood feature
        const flowAngle = Math.PI * 0.44 + Math.sin(i * 1.7) * 0.25; // generally southward downstream basin flow
        const halfLen = 22;
        const dx = Math.cos(flowAngle) * halfLen;
        const dy = Math.sin(flowAngle) * halfLen;

        ctx.save();
        ctx.lineCap = "round";
        ctx.strokeStyle = dark ? "rgba(34, 211, 238, 0.85)" : "rgba(3, 105, 161, 0.85)";
        ctx.lineWidth = 2.5;
        ctx.setLineDash([10, 12]);
        ctx.lineDashOffset = -(t * 55 + i * 7);
        ctx.beginPath();
        ctx.moveTo(pt.x - dx, pt.y - dy);
        ctx.lineTo(pt.x + dx, pt.y + dy);
        ctx.stroke();
        ctx.restore();

        for (let wave = 0; wave < 2; wave++) {
          const progress = (t * 0.5 + i * 0.19 + wave * 0.5) % 1;
          const radius = 8 + progress * 38;
          const alpha = (1 - progress) * 0.65;
          ctx.strokeStyle = dark
            ? `rgba(34, 211, 238, ${alpha})`
            : `rgba(2, 132, 199, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }

      // 3. Expanding water-surge ripples around flood complaints & CCTV water points
      const floodOrigins: [number, number][] = [
        ...propsRef.current.cctvPoints.map((c) => c.coordinates),
        ...propsRef.current.complaints
          .filter((c) => c.categoryId === "flood")
          .map((c) => c.coordinates),
      ];

      for (let i = 0; i < floodOrigins.length; i++) {
        const pt = map.project(floodOrigins[i]);
        if (pt.x < -60 || pt.x > width + 60 || pt.y < -60 || pt.y > height + 60) continue;

        for (let wave = 0; wave < 2; wave++) {
          const progress = ((t * 0.55 + i * 0.23 + wave * 0.5) % 1);
          const radius = 10 + progress * 46;
          const alpha = (1 - progress) * 0.55;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, radius, 0, Math.PI * 2);
          ctx.stroke();
        }
      }
    };

    const drawDust = (now: number) => {
      ctx.clearRect(0, 0, width, height);
      const t = (now - startTime) * 0.001;
      const zoom = map.getZoom();
      const stations = propsRef.current.airStations;
      const burnScars = propsRef.current.burnScars;

      // Combine Air4Thai stations + GISTDA 10-day Burn Scar hotspots
      const dustNodes: Array<{ coord: [number, number]; pm25: number; isBurn?: boolean }> = [
        ...(stations.length > 0
          ? stations.map((s) => ({ coord: s.coordinates, pm25: s.pm25 ?? 28 }))
          : propsRef.current.complaints.slice(0, 8).map((c) => ({
              coord: c.coordinates,
              pm25: c.categoryId === "trash" ? 48 : 34,
            }))),
        ...burnScars.slice(0, 80).map((b) => ({
          coord: b.coord,
          pm25: b.areaRai >= 500 ? 88 : b.areaRai >= 100 ? 64 : 44,
          isBurn: true,
        })),
      ];

      if (dustNodes.length === 0) return;

      const baseRadius = Math.max(24, Math.min(95, zoom * 6.2));
      const visibleNodes: Array<{ x: number; y: number; r: number; rgb: string; pm25: number }> = [];

      for (let i = 0; i < dustNodes.length; i++) {
        const node = dustNodes[i];
        const pt = map.project(node.coord);
        if (pt.x < -120 || pt.x > width + 120 || pt.y < -120 || pt.y > height + 120) {
          continue;
        }
        const severityScale = Math.min(1.65, 0.75 + node.pm25 / 65);
        const r = baseRadius * (node.isBurn ? 0.72 * severityScale : severityScale);
        const rgb = node.isBurn ? "249, 115, 22" : getPm25Rgb(node.pm25);

        // Drifting volumetric plume clouds
        const driftX = Math.sin(t * 0.65 + i * 1.1) * 14;
        const driftY = Math.cos(t * 0.5 + i * 0.9) * 9;
        const cx = pt.x + driftX;
        const cy = pt.y + driftY;

        const grad = ctx.createRadialGradient(cx, cy, r * 0.08, cx, cy, r);
        grad.addColorStop(0, `rgba(${rgb}, ${node.isBurn ? 0.52 : 0.44})`);
        grad.addColorStop(0.55, `rgba(${rgb}, 0.18)`);
        grad.addColorStop(1, `rgba(${rgb}, 0)`);

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();

        if (node.isBurn) {
          const pulse = (t * 0.7 + i * 0.23) % 1;
          ctx.strokeStyle = `rgba(239, 68, 68, ${(1 - pulse) * 0.75})`;
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 4 + pulse * 16, 0, Math.PI * 2);
          ctx.stroke();
        }

        visibleNodes.push({ x: cx, y: cy, r, rgb, pm25: node.pm25 });
      }

      // Floating fine PM2.5 particles inside visible plumes
      if (visibleNodes.length > 0) {
        for (const dp of dustParticles) {
          const host = visibleNodes[dp.stationIdx % visibleNodes.length];
          dp.angle += dp.speed;
          const dist = host.r * (0.15 + dp.distRatio * 0.78);
          const px = host.x + Math.cos(dp.angle + dp.phase) * dist + Math.sin(t + dp.phase) * 5;
          const py = host.y + Math.sin(dp.angle + dp.phase) * dist * 0.75;

          const alpha = 0.35 + 0.35 * Math.sin(t * 2 + dp.phase);
          ctx.fillStyle = `rgba(${host.rgb}, ${alpha})`;
          ctx.beginPath();
          ctx.arc(px, py, dp.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    };

    const tick = (now: number) => {
      if (mode === "rain") drawRain(now);
      else if (mode === "storm") drawStorm(now);
      else if (mode === "flood") drawFlood(now);
      else if (mode === "dust") drawDust(now);
      rafId = window.requestAnimationFrame(tick);
    };

    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      ro.disconnect();
      ctx.clearRect(0, 0, width, height);
    };
  }, [mode, map, isLoaded]);

  if (mode === "off") return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-[5] w-full h-full"
    />
  );
}
