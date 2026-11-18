"use client";

import React, { useEffect, useId, useMemo, useState } from "react";
import { JKIcon } from "@/components/ui/jk-icon";
import { type CityWeatherData, CITY_WEATHER, type CityViewport } from "@/data/map-data";
import { fetchOpenMeteoAirQuality } from "@/lib/external-apis";

interface WeatherCardProps {
  currentCity?: CityViewport | null;
  onSelectCity?: (cityId: string) => void;
  defaultMinimized?: boolean;
  className?: string;
}

interface LiveWeatherEntry {
  data: CityWeatherData;
  fetchedAt: string;
  isLive: boolean;
}

const WEATHER_CACHE = new Map<string, LiveWeatherEntry>();

function mapWmoCodeToCondition(code: number): {
  text: string;
  type: CityWeatherData["conditionType"];
} {
  if (code === 0) return { text: "ท้องฟ้าแจ่มใส", type: "clear" };
  if (code === 1) return { text: "แดดจัด ท้องฟ้าโปร่ง", type: "sunny" };
  if (code === 2) return { text: "มีเมฆบางส่วน", type: "mostly-cloudy" };
  if (code === 3) return { text: "มีเมฆมาก", type: "cloudy" };
  if (code === 45 || code === 48) return { text: "มีหมอกบาง", type: "cloudy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { text: "มีฝนตก", type: "rainy" };
  }
  if (code >= 95) return { text: "ฝนฟ้าคะนอง", type: "rainy" };
  return { text: "อากาศอบอุ่น", type: "mostly-cloudy" };
}

function getFallbackWeather(city?: CityViewport | null): CityWeatherData {
  if (city?.id && CITY_WEATHER[city.id]) {
    return CITY_WEATHER[city.id];
  }
  if (city) {
    const thaiName = city.name.split("(")[0].trim();
    return {
      cityId: city.id,
      cityName: thaiName || city.name,
      dayLabel: "วันนี้",
      temp: 32,
      condition: "มีเมฆบางส่วน",
      conditionType: "mostly-cloudy",
      windSpeed: "9 km/h",
      rainChance: "25%",
      humidity: "68%",
    };
  }
  return CITY_WEATHER.bkk;
}

export function WeatherCard({
  currentCity,
  defaultMinimized = true,
  className = "",
}: WeatherCardProps) {
  const uid = useId().replace(/:/g, "");
  const [isMinimized, setIsMinimized] = useState(defaultMinimized);
  const [liveByCacheKey, setLiveByCacheKey] = useState<Record<string, LiveWeatherEntry>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [gpsState, setGpsState] = useState<{ city: CityViewport; forTargetId: string | null } | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  const currentTargetId = currentCity?.id ?? null;
  const gpsCity = gpsState && gpsState.forTargetId === currentTargetId ? gpsState.city : null;
  const activeCity = gpsCity || currentCity;
  const targetLng = activeCity?.center?.[0] ?? 100.5018;
  const targetLat = activeCity?.center?.[1] ?? 13.7563;
  const cityLabel = activeCity ? activeCity.name.split("(")[0].trim() : "กรุงเทพมหานคร";
  const cacheKey = `${targetLat.toFixed(2)},${targetLng.toFixed(2)}`;
  const liveEntry = liveByCacheKey[cacheKey] ?? null;

  useEffect(() => {
    let cancelled = false;
    const cached = refreshTick === 0 ? WEATHER_CACHE.get(cacheKey) : undefined;
    if (cached) {
      Promise.resolve(cached).then((entry) => {
        if (!cancelled) {
          setLiveByCacheKey((prev) =>
            prev[cacheKey] === entry ? prev : { ...prev, [cacheKey]: entry }
          );
          setIsLoading(false);
        }
      });
      return () => {
        cancelled = true;
      };
    }

    const controller = new AbortController();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${targetLat}&longitude=${targetLng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&hourly=precipitation_probability&forecast_days=1&timezone=Asia%2FBangkok`;

    Promise.allSettled([
      fetch(url, { signal: controller.signal }).then((res) => {
        if (!res.ok) throw new Error("Weather fetch failed");
        return res.json();
      }),
      fetchOpenMeteoAirQuality(targetLat, targetLng, controller.signal),
    ])
      .then(([weatherRes, airRes]) => {
        if (cancelled) return;
        if (weatherRes.status !== "fulfilled") throw new Error("Weather failed");

        const json = weatherRes.value;
        const current = json?.current;
        if (!current) throw new Error("Missing current weather");

        const air = airRes.status === "fulfilled" ? airRes.value : null;

        const cond = mapWmoCodeToCondition(Number(current.weather_code ?? 1));
        const nowHour = new Date().getHours();
        const hourlyProb = json?.hourly?.precipitation_probability?.[nowHour];
        const rainPct = typeof hourlyProb === "number" ? hourlyProb : cond.type === "rainy" ? 70 : 20;

        const data: CityWeatherData = {
          cityId: activeCity?.id ?? "bkk",
          cityName: cityLabel,
          dayLabel: "สภาพอากาศ & คุณภาพอากาศสด",
          temp: Math.round(Number(current.temperature_2m ?? 32)),
          condition: cond.text,
          conditionType: cond.type,
          windSpeed: `${Math.round(Number(current.wind_speed_10m ?? 8))} km/h`,
          rainChance: `${rainPct}%`,
          humidity: `${Math.round(Number(current.relative_humidity_2m ?? 65))}%`,
          pm25: air?.pm25,
          usAqi: air?.usAqi,
          uvIndex: air?.uvIndex,
          aqiLabel: air?.levelLabel,
          aqiColor: air?.levelColor,
        };

        const entry: LiveWeatherEntry = {
          data,
          fetchedAt: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }),
          isLive: true,
        };
        WEATHER_CACHE.set(cacheKey, entry);
        setLiveByCacheKey((prev) => ({ ...prev, [cacheKey]: entry }));
      })
      .catch(() => {
        if (!cancelled) {
          setLiveByCacheKey((prev) => ({
            ...prev,
            [cacheKey]: {
              data: getFallbackWeather(activeCity),
              fetchedAt: "",
              isLive: false,
            },
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [cacheKey, cityLabel, activeCity, refreshTick, targetLat, targetLng]);

  const weather: CityWeatherData = useMemo(() => {
    if (liveEntry) {
      return { ...liveEntry.data, cityName: cityLabel };
    }
    return getFallbackWeather(activeCity);
  }, [liveEntry, cityLabel, activeCity]);

  const handleLocateWeather = () => {
    if (!navigator.geolocation) return;
    setIsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsState({
          forTargetId: currentTargetId,
          city: {
            id: "gps-current",
            name: "ตำแหน่งปัจจุบันของคุณ",
            country: "Thailand",
            center: [pos.coords.longitude, pos.coords.latitude],
            zoom: 13,
          },
        });
        setRefreshTick((t) => t + 1);
      },
      () => {
        setIsLoading(false);
      },
      { enableHighAccuracy: false, timeout: 6000 }
    );
  };

  const sunGlowId = `sunGlow-${uid}`;
  const backCloudId = `backCloud-${uid}`;
  const frontCloudId = `frontCloud-${uid}`;
  const highlightId = `cloudHighlight-${uid}`;
  const shadowId = `cloudShadow-${uid}`;
  const dropId = `dropGrad-${uid}`;

  if (isMinimized) {
    return (
      <button
        type="button"
        onClick={() => setIsMinimized(false)}
        className={`pointer-events-auto flex items-center gap-2.5 px-4 py-2 rounded-full weather-glass-card border border-white/60 dark:border-white/20 shadow-xl hover:scale-[1.03] active:scale-95 transition-all duration-300 group cursor-pointer ${className}`}
        title="ขยายดูสภาพอากาศสด"
      >
        <div className="w-5 h-5 flex items-center justify-center shrink-0">
          {weather.conditionType === "rainy" ? (
            <JKIcon name="cloud-rain" className="text-sky-500 text-sm" />
          ) : weather.conditionType === "cloudy" ? (
            <JKIcon name="cloud" className="text-slate-400 text-sm" />
          ) : weather.conditionType === "clear" || weather.conditionType === "sunny" ? (
            <JKIcon name="sun" className="text-amber-400 text-sm" />
          ) : (
            <JKIcon name="cloud-sun" className="text-amber-400 text-sm" />
          )}
        </div>
        <span className="frosted-text font-bold text-[11px] max-w-[140px] sm:max-w-[180px] truncate">
          {weather.cityName}
        </span>
        <span className="frosted-text font-black text-xs text-teal-700 dark:text-cyan-300">{weather.temp}°</span>
        {weather.pm25 !== undefined && (
          <span
            className="px-1.5 py-0.5 rounded-full text-[9px] font-black text-white shadow-xs"
            style={{ backgroundColor: weather.aqiColor || "#10b981" }}
            title={`PM2.5 ${weather.pm25} µg/m³ (${weather.aqiLabel})`}
          >
            PM {weather.pm25}
          </span>
        )}
        {liveEntry?.isLive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
      </button>
    );
  }

  const showSun = weather.conditionType !== "cloudy" && weather.conditionType !== "rainy";
  const showCloud = weather.conditionType !== "clear";
  const showRain = weather.conditionType === "rainy";

  return (
    <div
      className={`relative pointer-events-auto weather-glass-card w-[290px] sm:w-[315px] p-5 flex flex-col items-center justify-between select-none animate-in fade-in zoom-in-95 duration-200 ${className}`}
      style={{ borderRadius: "34px" }}
    >
      {/* Top Action Controls */}
      <div className="w-full flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          {liveEntry?.isLive ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 text-[9px] font-black border border-emerald-500/25">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE {liveEntry.fetchedAt}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 text-[9px] font-bold">
              ข้อมูลพื้นที่
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleLocateWeather}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/20 text-slate-600 dark:text-white/80 transition cursor-pointer"
            title="ดึงสภาพอากาศจากพิกัด GPS ปัจจุบัน"
            aria-label="ดึงสภาพอากาศจากพิกัด GPS ปัจจุบัน"
          >
            <JKIcon name="location-crosshairs" className="text-[11px]" />
          </button>
          <button
            type="button"
            onClick={() => setRefreshTick((t) => t + 1)}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/20 text-slate-600 dark:text-white/80 transition cursor-pointer"
            title="อัปเดตสภาพอากาศ"
            aria-label="อัปเดตสภาพอากาศ"
          >
            <JKIcon name="arrows-rotate" className={`text-[11px] ${isLoading ? "animate-spin" : ""}`} />
          </button>
          <button
            type="button"
            onClick={() => setIsMinimized(true)}
            className="w-7 h-7 rounded-full flex items-center justify-center bg-slate-900/5 dark:bg-white/10 hover:bg-slate-900/10 dark:hover:bg-white/20 text-slate-600 dark:text-white/80 transition cursor-pointer"
            title="ย่อขนาด"
            aria-label="ย่อขนาดสภาพอากาศ"
          >
            <JKIcon name="xmark" className="text-xs" />
          </button>
        </div>
      </div>

      {/* City Name */}
      <div className="w-full text-center pt-0.5">
        <h2 className="frosted-text text-xl sm:text-2xl font-black tracking-tight leading-tight truncate px-2">
          {weather.cityName}
        </h2>
        <p className="frosted-text-sub text-xs font-semibold tracking-wide mt-0.5">
          {weather.dayLabel}
        </p>
      </div>

      {/* Dynamic Weather Illustration */}
      <div className="my-3 relative flex items-center justify-center w-36 h-24 group">
        <svg
          viewBox="0 0 200 150"
          className="w-full h-full filter drop-shadow-[0_10px_14px_rgba(0,0,0,0.22)] transition-transform duration-500 ease-out group-hover:scale-105"
        >
          <defs>
            <radialGradient id={sunGlowId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffd84d" />
              <stop offset="65%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#d97706" />
            </radialGradient>
            <linearGradient id={backCloudId} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%" stopColor="#f8fafc" />
              <stop offset="60%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id={frontCloudId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="45%" stopColor="#f1f5f9" />
              <stop offset="85%" stopColor="#cbd5e1" />
              <stop offset="100%" stopColor="#94a3b8" />
            </linearGradient>
            <linearGradient id={highlightId} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
            </linearGradient>
            <filter id={shadowId} x="-10%" y="-10%" width="120%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodOpacity="0.2" />
            </filter>
          </defs>

          {showSun && (
            <g className="animate-pulse" style={{ animationDuration: "4s" }}>
              <circle
                cx={showCloud ? 126 : 100}
                cy={showCloud ? 62 : 74}
                r={showCloud ? 34 : 42}
                fill={`url(#${sunGlowId})`}
                filter="drop-shadow(0 0 14px rgba(245, 158, 11, 0.65))"
              />
            </g>
          )}

          {showCloud && (
            <>
              <g filter={`url(#${shadowId})`}>
                <path
                  d="M 62 82 A 26 26 0 0 1 106 58 A 32 32 0 0 1 156 74 A 24 24 0 0 1 152 106 L 70 106 A 22 22 0 0 1 62 82 Z"
                  fill={`url(#${backCloudId})`}
                  opacity="0.9"
                />
              </g>
              <g filter={`url(#${shadowId})`}>
                <path
                  d="M 52 110 A 26 26 0 0 1 76 72 A 34 34 0 0 1 130 68 A 28 28 0 0 1 162 100 A 22 22 0 0 1 154 116 L 58 116 A 18 18 0 0 1 52 110 Z"
                  fill={`url(#${frontCloudId})`}
                />
                <path
                  d="M 55 106 A 24 24 0 0 1 78 74 A 32 32 0 0 1 128 71 A 26 26 0 0 1 158 98 C 142 86 112 80 84 86 Z"
                  fill={`url(#${highlightId})`}
                />
              </g>
            </>
          )}

          {showRain && (
            <g stroke="#38bdf8" strokeWidth="4" strokeLinecap="round">
              <line x1="76" y1="122" x2="70" y2="138" className="animate-pulse" />
              <line x1="104" y1="124" x2="98" y2="142" className="animate-pulse" />
              <line x1="132" y1="122" x2="126" y2="138" className="animate-pulse" />
            </g>
          )}
        </svg>
      </div>

      {/* Temperature & Condition */}
      <div className="w-full text-center flex flex-col items-center">
        <div className="frosted-text text-5xl font-black tracking-tight leading-none">
          {weather.temp}°
        </div>
        <div className="frosted-text-sub text-sm font-bold tracking-wide mt-1.5">
          {weather.condition}
        </div>
      </div>

      {/* Live Air Quality & UV Strip (Open-Meteo Air Quality) */}
      {weather.pm25 !== undefined && (
        <div className="w-full mt-3 p-2.5 rounded-2xl bg-slate-900/5 dark:bg-white/10 border border-slate-200/60 dark:border-white/15 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center text-white shrink-0 shadow-xs"
              style={{ backgroundColor: weather.aqiColor || "#10b981" }}
            >
              <JKIcon name="lungs" className="text-xs" />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1.5">
                <span className="frosted-text text-xs font-black">
                  PM2.5 {weather.pm25}
                </span>
                <span className="text-[9px] font-semibold text-slate-500 dark:text-slate-300">
                  µg/m³
                </span>
              </div>
              <p className="text-[10px] font-bold truncate" style={{ color: weather.aqiColor || "#10b981" }}>
                {weather.aqiLabel} {weather.usAqi !== undefined ? `(AQI ${weather.usAqi})` : ""}
              </p>
            </div>
          </div>

          {weather.uvIndex !== undefined && (
            <div className="text-right shrink-0 pl-2 border-l border-slate-300/60 dark:border-white/15">
              <div className="flex items-center justify-end gap-1 text-[11px] font-black text-amber-600 dark:text-amber-300">
                <JKIcon name="sun" className="text-[10px]" />
                <span>UV {weather.uvIndex}</span>
              </div>
              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                {weather.uvIndex >= 8 ? "สูงมาก" : weather.uvIndex >= 6 ? "สูง" : weather.uvIndex >= 3 ? "ปานกลาง" : "ต่ำ"}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      <div className="w-full h-px my-4 bg-gradient-to-r from-transparent via-slate-400/30 dark:via-white/20 to-transparent" />

      {/* Bottom Metrics: Wind | Rain | Humidity */}
      <div className="w-full grid grid-cols-3 gap-2 text-center items-end">
        <div className="flex flex-col items-center justify-center">
          <div className="h-6 flex items-center justify-center mb-1.5 text-slate-600 dark:text-white/90">
            <JKIcon name="wind" className="text-base" />
          </div>
          <span className="frosted-text text-xs font-bold whitespace-nowrap">{weather.windSpeed}</span>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">ลม</span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="h-6 flex items-center justify-center mb-1.5 text-sky-500">
            <JKIcon name="cloud-rain" className="text-base" />
          </div>
          <span className="frosted-text text-xs font-bold whitespace-nowrap">{weather.rainChance}</span>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">โอกาสฝน</span>
        </div>

        <div className="flex flex-col items-center justify-center">
          <div className="h-6 flex items-center justify-center mb-1.5">
            <svg viewBox="0 0 24 24" className="w-4 h-5">
              <defs>
                <linearGradient id={dropId} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#67e8f9" />
                  <stop offset="50%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#0284c7" />
                </linearGradient>
              </defs>
              <path
                d="M12 2.5 C12 2.5 5 11.5 5 16 A 7 7 0 0 0 19 16 C 19 11.5 12 2.5 12 2.5 Z"
                fill={`url(#${dropId})`}
              />
            </svg>
          </div>
          <span className="frosted-text text-xs font-bold whitespace-nowrap">{weather.humidity}</span>
          <span className="text-[9px] text-slate-500 dark:text-slate-400 font-semibold">ความชื้น</span>
        </div>
      </div>
    </div>
  );
}
