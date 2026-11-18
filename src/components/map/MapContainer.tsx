"use client";

import React, { useRef, useState, useEffect, useCallback, useSyncExternalStore } from "react";
import type * as MapLibreGL from "maplibre-gl";
import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  usePopup,
} from "@/components/ui/map";
import { JKIcon } from "@/components/ui/jk-icon";
import {
  COMPLAINT_CATEGORIES,
  DEFAULT_MAP_VIEW,
  inferProvinceFromCoord,
  type ComplaintReport,
  type CityViewport,
  type CityLayerKey,
  type EmergencyPoint,
  type CivicPoll,
  type CctvPoint,
  CCTV_POINTS,
} from "@/data/map-data";
import { CityLayerSwitcher } from "./CityLayerSwitcher";
import {
  MapWeatherAnimationOverlay,
  type WeatherAnimationMode,
} from "./MapWeatherAnimationOverlay";
import { GistdaFloodLayer } from "./GistdaFloodLayer";
import {
  DEFAULT_SYSTEM_SETTINGS,
  GISTDA_FLOOD_PERIOD_OPTIONS,
  getSystemSettingsSnapshot,
  subscribeSystemSettings,
  type GistdaFloodPeriod,
} from "@/lib/system-settings";
import {
  DistrictBoundaryLayer,
  ProvinceBoundaryLayer,
  TambonBoundaryLayer,
  type HoveredDistrictInfo,
  type HoveredProvinceInfo,
  type HoveredTambonInfo,
} from "./ProvinceBoundaryLayer";
import { districtsMatch } from "@/data/thailand-districts";
import type { MapStyleKey } from "./MapHeader";
import {
  fetchAir4ThaiStations,
  fetchGistdaBurnScars,
  fetchGistdaDragonflyStatus,
  fetchGistdaFloodFeatures,
  fetchNearbyEmergencyPoints,
  fetchNearbyMonitoringPoints,
  fetchOpenMeteoFlood,
  fetchOsrmDrivingRoute,
  fetchUsgsEarthquakes,
  getAirQualityRating,
  type Air4ThaiStation,
  type FloodDischargeInfo,
  type GistdaBurnScarItem,
  type GistdaFloodResponse,
  type LiveFxWeatherTelemetry,
  type OsrmRouteResult,
  type UsgsEarthquakeFeature,
} from "@/lib/external-apis";

const serverSystemSettings = () => DEFAULT_SYSTEM_SETTINGS;

const STATUS_PULSE: Record<string, string> = {
  pending: "#f59e0b",
  inprogress: "#3b82f6",
  resolved: "#22c55e",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "รอดำเนินการ",
  inprogress: "กำลังดำเนินการ",
  resolved: "แก้ไขแล้ว",
};

const STATUS_ICON: Record<string, string> = {
  pending: "clock",
  inprogress: "arrows-spin",
  resolved: "circle-check",
};

interface MapContainerProps {
  currentStyle: MapStyleKey;
  isDark: boolean;
  complaints: ComplaintReport[];
  selectedComplaint: ComplaintReport | null;
  onSelectComplaint: (c: ComplaintReport | null) => void;
  isReportMode: boolean;
  pendingCoord: [number, number] | null;
  onSetPendingCoord: (coord: [number, number] | null) => void;
  targetCity: CityViewport | null;
  onOpenDetail?: (c: ComplaintReport) => void;
  upvotedIds?: Set<string>;
  onToggleUpvote?: (id: string) => void;
  onShareComplaint?: (c: ComplaintReport) => void;
  activeLayer?: CityLayerKey;
  onChangeLayer?: (layer: CityLayerKey) => void;
  civicPolls?: CivicPoll[];
  onVotePoll?: (pollId: string, choice: "agree" | "disagree") => void;
  userPollVotes?: Record<string, "agree" | "disagree">;
  onOpenSosModal?: (coordinates?: [number, number]) => void;
  onSelectProvince?: (province: HoveredProvinceInfo | null) => void;
  onSelectDistrict?: (district: HoveredDistrictInfo | null) => void;
  onSelectTambon?: (tambon: HoveredTambonInfo | null) => void;
}

function ComplaintPopupClose({ onClose }: { onClose: () => void }) {
  const popup = usePopup();

  const handleClose = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (popup) {
      popup.close();
    } else {
      onClose();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClose}
      className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/50 hover:bg-black/80 text-white flex items-center justify-center backdrop-blur-md transition cursor-pointer text-xs border border-white/20 z-20 shadow-md active:scale-95"
      aria-label="ปิดหน้าต่างนี้"
    >
      <JKIcon name="xmark" className="text-xs" />
    </button>
  );
}

export function MapContainer({
  currentStyle,
  isDark,
  complaints,
  selectedComplaint,
  onSelectComplaint,
  isReportMode,
  pendingCoord,
  onSetPendingCoord,
  targetCity,
  onOpenDetail,
  upvotedIds = new Set(),
  onToggleUpvote,
  onShareComplaint,
  activeLayer = "complaints",
  onChangeLayer,
  civicPolls = [],
  onVotePoll,
  userPollVotes = {},
  onOpenSosModal,
  onSelectProvince,
  onSelectDistrict,
  onSelectTambon,
}: MapContainerProps) {
  const mapRef = useRef<MapLibreGL.Map | null>(null);

  const [viewport, setViewport] = useState({
    lng: DEFAULT_MAP_VIEW.center[0],
    lat: DEFAULT_MAP_VIEW.center[1],
    zoom: DEFAULT_MAP_VIEW.zoom,
    bearing: 0,
    pitch: 0,
  });
  const [hasCopiedCoord, setHasCopiedCoord] = useState(false);
  const [showProvinceBorders, setShowProvinceBorders] = useState(true);
  const [showDistrictBorders, setShowDistrictBorders] = useState(true);
  const [showTambonBorders, setShowTambonBorders] = useState(true);
  const [hoveredProvince, setHoveredProvince] = useState<HoveredProvinceInfo | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<HoveredProvinceInfo | null>(null);
  const [hoveredDistrict, setHoveredDistrict] = useState<HoveredDistrictInfo | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<HoveredDistrictInfo | null>(null);
  const [hoveredTambon, setHoveredTambon] = useState<HoveredTambonInfo | null>(null);
  const [selectedTambon, setSelectedTambon] = useState<HoveredTambonInfo | null>(null);
  const selectedDistrictRef = useRef<HoveredDistrictInfo | null>(null);
  const selectedTambonRef = useRef<HoveredTambonInfo | null>(null);

  // Selection states for secondary layers
  const [selectedEmergencyPoint, setSelectedEmergencyPoint] = useState<EmergencyPoint | null>(null);
  const [selectedPoll, setSelectedPoll] = useState<CivicPoll | null>(null);
  const [selectedCctv, setSelectedCctv] = useState<CctvPoint | null>(null);
  const [selectedAirStation, setSelectedAirStation] = useState<Air4ThaiStation | null>(null);
  const [selectedEarthquake, setSelectedEarthquake] = useState<UsgsEarthquakeFeature | null>(null);
  const [selectedBurnScar, setSelectedBurnScar] = useState<GistdaBurnScarItem | null>(null);

  // Live API states: Air4Thai + USGS + Flood + OSRM Route
  const [airStations, setAirStations] = useState<Air4ThaiStation[]>([]);
  const [earthquakes, setEarthquakes] = useState<UsgsEarthquakeFeature[]>([]);
  const [hasLoadedEnvData, setHasLoadedEnvData] = useState(false);
  const [isLoadingEnvData, setIsLoadingEnvData] = useState(false);

  const [floodByCctvId, setFloodByCctvId] = useState<
    Record<string, FloodDischargeInfo | null>
  >({});

  const [activeRoute, setActiveRoute] = useState<OsrmRouteResult | null>(null);
  const [isCalculatingRoute, setIsCalculatingRoute] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [weatherFx, setWeatherFx] = useState<WeatherAnimationMode>("off");
  const [isFxMenuOpen, setIsFxMenuOpen] = useState(false);
  const fxMenuRef = useRef<HTMLDivElement | null>(null);

  const systemSettings = useSyncExternalStore(
    subscribeSystemSettings,
    getSystemSettingsSnapshot,
    serverSystemSettings,
  );
  const [gistdaPeriodOverride, setGistdaPeriodOverride] = useState<GistdaFloodPeriod | null>(null);
  const activeFloodPeriod = gistdaPeriodOverride ?? systemSettings.gistdaFloodPeriod;
  const [gistdaFlood, setGistdaFlood] = useState<GistdaFloodResponse | null>(null);
  const [isLoadingGistdaFlood, setIsLoadingGistdaFlood] = useState(false);
  const [gistdaViewportTick, setGistdaViewportTick] = useState(0);
  const [showGistdaWmsWarn, setShowGistdaWmsWarn] = useState(true);
  const [fxTelemetry, setFxTelemetry] = useState<LiveFxWeatherTelemetry | null>(null);
  const [gistdaBurnScars, setGistdaBurnScars] = useState<GistdaBurnScarItem[]>([]);
  const [burnScarMatched, setBurnScarMatched] = useState(0);
  const [isLoadingBurnScars, setIsLoadingBurnScars] = useState(false);
  const [nearbyEmergencyPoints, setNearbyEmergencyPoints] =
    useState<EmergencyPoint[]>([]);
  const [nearbyCctvPoints, setNearbyCctvPoints] = useState<CctvPoint[]>(CCTV_POINTS);
  const [nearbyCenterTick, setNearbyCenterTick] = useState(0);

  useEffect(() => {
    if (!isFxMenuOpen) return;
    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (fxMenuRef.current && !fxMenuRef.current.contains(e.target as Node)) {
        setIsFxMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFxMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isFxMenuOpen]);

  useEffect(() => {
    const needsEnv = activeLayer === "environment" || weatherFx === "dust";
    if (!needsEnv || hasLoadedEnvData) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setIsLoadingEnvData(true);
    });
    Promise.allSettled([
      fetchAir4ThaiStations(controller.signal),
      fetchUsgsEarthquakes(controller.signal),
    ])
      .then(([airRes, eqRes]) => {
        if (controller.signal.aborted) return;
        if (airRes.status === "fulfilled") setAirStations(airRes.value);
        if (eqRes.status === "fulfilled") setEarthquakes(eqRes.value);
        setHasLoadedEnvData(true);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingEnvData(false);
      });

    return () => controller.abort();
  }, [activeLayer, weatherFx, hasLoadedEnvData]);

  useEffect(() => {
    if (weatherFx !== "flood" && weatherFx !== "rain" && weatherFx !== "storm") return;
    const mapInstance = mapRef.current;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setGistdaViewportTick((t) => t + 1);
      }, 650);
    };
    mapInstance?.on("moveend", onMoveEnd);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      mapInstance?.off("moveend", onMoveEnd);
    };
  }, [weatherFx]);

  useEffect(() => {
    if (weatherFx !== "flood") return;
    const controller = new AbortController();
    const bounds = mapRef.current?.getBounds();
    const bbox: [number, number, number, number] = bounds
      ? [
          Math.max(96, bounds.getWest()),
          Math.max(5, bounds.getSouth()),
          Math.min(106.5, bounds.getEast()),
          Math.min(21, bounds.getNorth()),
        ]
      : [
          Math.max(96, viewport.lng - 0.8),
          Math.max(5, viewport.lat - 0.8),
          Math.min(106.5, viewport.lng + 0.8),
          Math.min(21, viewport.lat + 0.8),
        ];

    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setIsLoadingGistdaFlood(true);
    });

    fetchGistdaFloodFeatures({
      period: activeFloodPeriod,
      bbox,
      limit: 250,
      apiKey: systemSettings.gistdaApiKey,
      signal: controller.signal,
    })
      .then((res) => {
        if (!controller.signal.aborted) setGistdaFlood(res);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingGistdaFlood(false);
      });

    return () => controller.abort();
  }, [weatherFx, activeFloodPeriod, systemSettings.gistdaApiKey, gistdaViewportTick, viewport.lng, viewport.lat]);

  useEffect(() => {
    if (weatherFx !== "rain" && weatherFx !== "storm" && weatherFx !== "flood") return;
    const controller = new AbortController();
    const center = mapRef.current?.getCenter();
    const targetLat = center?.lat ?? viewport.lat;
    const targetLng = center?.lng ?? viewport.lng;

    fetchGistdaDragonflyStatus({
      lat: targetLat,
      lng: targetLng,
      apiKey: systemSettings.gistdaApiKey,
      signal: controller.signal,
    }).then((res) => {
      if (!controller.signal.aborted && res) setFxTelemetry(res);
    });

    return () => controller.abort();
  }, [weatherFx, systemSettings.gistdaApiKey, gistdaViewportTick, viewport.lat, viewport.lng]);

  useEffect(() => {
    if (weatherFx !== "dust") return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) setIsLoadingBurnScars(true);
    });
    fetchGistdaBurnScars({
      limit: 150,
      apiKey: systemSettings.gistdaApiKey,
      signal: controller.signal,
    })
      .then((res) => {
        if (controller.signal.aborted) return;
        if (res.ok) {
          setGistdaBurnScars(res.items);
          setBurnScarMatched(res.numberMatched);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsLoadingBurnScars(false);
      });

    return () => controller.abort();
  }, [weatherFx, systemSettings.gistdaApiKey]);

  useEffect(() => {
    if (!selectedCctv) return;
    const cctvId = selectedCctv.id;
    if (cctvId in floodByCctvId) return;

    const controller = new AbortController();
    fetchOpenMeteoFlood(
      selectedCctv.coordinates[1],
      selectedCctv.coordinates[0],
      controller.signal,
    )
      .then((info) => {
        if (!controller.signal.aborted) {
          setFloodByCctvId((prev) => ({ ...prev, [cctvId]: info }));
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFloodByCctvId((prev) => ({ ...prev, [cctvId]: null }));
        }
      });

    return () => controller.abort();
  }, [selectedCctv, floodByCctvId]);

  useEffect(() => {
    if (activeLayer !== "emergency" && activeLayer !== "cctv") return;
    const mapInstance = mapRef.current;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        setNearbyCenterTick((t) => t + 1);
      }, 650);
    };
    mapInstance?.on("moveend", onMoveEnd);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      mapInstance?.off("moveend", onMoveEnd);
    };
  }, [activeLayer]);

  useEffect(() => {
    if (activeLayer !== "emergency") return;
    const controller = new AbortController();
    const mapCenter = mapRef.current?.getCenter();
    const targetLat = pendingCoord?.[1] ?? selectedComplaint?.coordinates[1] ?? mapCenter?.lat ?? viewport.lat;
    const targetLng = pendingCoord?.[0] ?? selectedComplaint?.coordinates[0] ?? mapCenter?.lng ?? viewport.lng;

    fetchNearbyEmergencyPoints(targetLat, targetLng, 20, controller.signal).then((res) => {
      if (!controller.signal.aborted) {
        setNearbyEmergencyPoints(res?.points ?? []);
      }
    });

    return () => controller.abort();
  }, [activeLayer, viewport.lat, viewport.lng, nearbyCenterTick, pendingCoord, selectedComplaint]);

  useEffect(() => {
    if (activeLayer !== "cctv") return;
    const controller = new AbortController();
    const mapCenter = mapRef.current?.getCenter();
    const targetLat = mapCenter?.lat ?? viewport.lat;
    const targetLng = mapCenter?.lng ?? viewport.lng;

    fetchNearbyMonitoringPoints(targetLat, targetLng, controller.signal).then((res) => {
      if (!controller.signal.aborted && res?.points?.length) {
        setNearbyCctvPoints(res.points);
      }
    });

    return () => controller.abort();
  }, [activeLayer, viewport.lat, viewport.lng, nearbyCenterTick]);

  const handleCalculateRoute = useCallback(
    async (destination: [number, number], destinationName: string) => {
      setRouteError("");
      setIsCalculatingRoute(true);

      const getOrigin = (): Promise<{ coord: [number, number]; label: string }> =>
        new Promise((resolve) => {
          if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
            resolve({
              coord: [viewport.lng, viewport.lat],
              label: "จุดกึ่งกลางแผนที่",
            });
            return;
          }
          navigator.geolocation.getCurrentPosition(
            (pos) =>
              resolve({
                coord: [pos.coords.longitude, pos.coords.latitude],
                label: "ตำแหน่ง GPS ของคุณ",
              }),
            () =>
              resolve({
                coord: [viewport.lng, viewport.lat],
                label: "จุดกึ่งกลางแผนที่",
              }),
            { enableHighAccuracy: false, timeout: 4000 },
          );
        });

      const origin = await getOrigin();
      const route = await fetchOsrmDrivingRoute(
        origin.coord,
        destination,
        destinationName,
        origin.label,
      );

      setIsCalculatingRoute(false);

      if (!route) {
        setRouteError("ไม่สามารถคำนวณเส้นทาง OSRM ได้ในขณะนี้");
        return;
      }

      setActiveRoute(route);
      if (mapRef.current && route.coordinates.length >= 2) {
        const lngs = route.coordinates.map((c) => c[0]);
        const lats = route.coordinates.map((c) => c[1]);
        mapRef.current.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 90, duration: 1100 },
        );
      }
    },
    [viewport.lat, viewport.lng],
  );

  const handleLayerChange = useCallback(
    (layer: CityLayerKey) => {
      setSelectedEmergencyPoint(null);
      setSelectedPoll(null);
      setSelectedCctv(null);
      setSelectedAirStation(null);
      setSelectedEarthquake(null);
      onSelectComplaint(null);
      onChangeLayer?.(layer);
    },
    [onChangeLayer, onSelectComplaint]
  );

  // Map style URLs
  const styleUrls = React.useMemo(() => {
    switch (currentStyle) {
      case "darkmatter":
        return {
          light: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
          dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        };
      case "positron":
        return {
          light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
          dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        };
      case "openfreemap":
        return {
          light: "https://tiles.openfreemap.org/styles/liberty",
          dark: "https://tiles.openfreemap.org/styles/dark",
        };
      case "voyager":
      default:
        return {
          light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
          dark: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        };
    }
  }, [currentStyle]);

  // Resize on window resize
  useEffect(() => {
    const handleResize = () => mapRef.current?.resize();
    window.addEventListener("resize", handleResize);
    const timer = setTimeout(handleResize, 150);
    return () => { window.removeEventListener("resize", handleResize); clearTimeout(timer); };
  }, []);

  // Fly to target city
  useEffect(() => {
    if (targetCity && mapRef.current) {
      mapRef.current.flyTo({ center: targetCity.center, zoom: targetCity.zoom, essential: true, duration: 2200 });
    }
  }, [targetCity]);

  // Fly to selected complaint
  useEffect(() => {
    if (selectedComplaint && mapRef.current) {
      mapRef.current.flyTo({ center: selectedComplaint.coordinates, zoom: 15, essential: true, duration: 1500 });
    }
  }, [selectedComplaint]);

  // Map click handler for report mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const clickHandler = (e: MapLibreGL.MapMouseEvent) => {
      if (isReportMode) {
        onSetPendingCoord([e.lngLat.lng, e.lngLat.lat]);
      }
    };
    map.on("click", clickHandler);
    return () => { map.off("click", clickHandler); };
  }, [isReportMode, onSetPendingCoord]);

  // Cursor change in report mode
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = isReportMode ? "crosshair" : "";
  }, [isReportMode]);

  const handleViewportChange = useCallback((vp: { center: [number, number]; zoom: number; bearing: number; pitch: number }) => {
    setViewport({ lng: vp.center[0], lat: vp.center[1], zoom: vp.zoom, bearing: vp.bearing, pitch: vp.pitch });
  }, []);

  const copyCoordinates = () => {
    navigator.clipboard.writeText(`${viewport.lat.toFixed(6)}, ${viewport.lng.toFixed(6)}`);
    setHasCopiedCoord(true);
    setTimeout(() => setHasCopiedCoord(false), 2000);
  };

  const handleSelectMapProvince = useCallback(
    (province: HoveredProvinceInfo) => {
      setSelectedProvince(province);
      const prevDistrict = selectedDistrictRef.current;
      const keepDistrict = Boolean(
        prevDistrict && prevDistrict.provinceTh === province.nameTh && showDistrictBorders
      );
      if (!keepDistrict) {
        selectedDistrictRef.current = null;
        setSelectedDistrict(null);
        onSelectDistrict?.(null);
      }
      const prevTambon = selectedTambonRef.current;
      const keepTambon = Boolean(
        prevTambon && prevTambon.provinceTh === province.nameTh && showTambonBorders
      );
      if (!keepTambon) {
        selectedTambonRef.current = null;
        setSelectedTambon(null);
        onSelectTambon?.(null);
      }
      onSelectProvince?.(province);
    },
    [onSelectProvince, onSelectDistrict, onSelectTambon, showDistrictBorders, showTambonBorders],
  );

  const handleSelectMapDistrict = useCallback(
    (district: HoveredDistrictInfo) => {
      selectedDistrictRef.current = district;
      setSelectedDistrict(district);
      const prevTambon = selectedTambonRef.current;
      const keepTambon = Boolean(
        prevTambon && prevTambon.districtPcode === district.id && showTambonBorders
      );
      if (!keepTambon) {
        selectedTambonRef.current = null;
        setSelectedTambon(null);
        onSelectTambon?.(null);
      }
      const provInfo: HoveredProvinceInfo = {
        id: district.provincePcode,
        nameTh: district.provinceTh,
        nameEn: district.provinceEn,
        region: district.region,
        center: district.center,
      };
      setSelectedProvince(provInfo);
      onSelectProvince?.(provInfo);
      onSelectDistrict?.(district);
    },
    [onSelectProvince, onSelectDistrict, onSelectTambon, showTambonBorders],
  );

  const handleSelectMapTambon = useCallback(
    (tambon: HoveredTambonInfo) => {
      selectedTambonRef.current = tambon;
      setSelectedTambon(tambon);
      const distInfo: HoveredDistrictInfo = {
        id: tambon.districtPcode,
        nameTh: tambon.districtTh,
        displayTh: tambon.districtDisplayTh,
        nameEn: "",
        provincePcode: tambon.provincePcode,
        provinceTh: tambon.provinceTh,
        provinceEn: tambon.provinceEn,
        region: tambon.region,
        center: tambon.center,
      };
      const provInfo: HoveredProvinceInfo = {
        id: tambon.provincePcode,
        nameTh: tambon.provinceTh,
        nameEn: tambon.provinceEn,
        region: tambon.region,
        center: tambon.center,
      };
      selectedDistrictRef.current = distInfo;
      setSelectedDistrict(distInfo);
      setSelectedProvince(provInfo);
      onSelectProvince?.(provInfo);
      onSelectDistrict?.(distInfo);
      onSelectTambon?.(tambon);
    },
    [onSelectProvince, onSelectDistrict, onSelectTambon],
  );

  const handleClearSelectedProvince = useCallback(() => {
    setSelectedProvince(null);
    selectedDistrictRef.current = null;
    setSelectedDistrict(null);
    selectedTambonRef.current = null;
    setSelectedTambon(null);
    onSelectProvince?.(null);
    onSelectDistrict?.(null);
    onSelectTambon?.(null);
  }, [onSelectProvince, onSelectDistrict, onSelectTambon]);

  const handleToggleDistrictBorders = useCallback(() => {
    const next = !showDistrictBorders;
    setShowDistrictBorders(next);
    if (next && viewport.zoom < 7.2) {
      mapRef.current?.flyTo({
        zoom: 7.8,
        duration: 750,
      });
    }
  }, [showDistrictBorders, viewport.zoom]);

  const handleToggleTambonBorders = useCallback(() => {
    const next = !showTambonBorders;
    setShowTambonBorders(next);
    if (next && viewport.zoom < 10.2) {
      mapRef.current?.flyTo({
        zoom: 10.8,
        duration: 750,
      });
    }
  }, [showTambonBorders, viewport.zoom]);

  const activeProvinceInfo = hoveredProvince ?? selectedProvince;
  const activeDistrictInfo = hoveredDistrict
    ? hoveredDistrict
    : !hoveredProvince || hoveredProvince.nameTh === selectedDistrict?.provinceTh
    ? selectedDistrict
    : null;
  const activeTambonInfo = hoveredTambon
    ? hoveredTambon
    : (!hoveredProvince || hoveredProvince.nameTh === selectedTambon?.provinceTh) &&
      (!hoveredDistrict || hoveredDistrict.id === selectedTambon?.districtPcode)
    ? selectedTambon
    : null;

  const activeProvinceStats = React.useMemo(() => {
    if (!activeProvinceInfo) return null;
    const matching = complaints.filter(
      (c) => (c.province || inferProvinceFromCoord(c.coordinates)) === activeProvinceInfo.nameTh,
    );
    return {
      total: matching.length,
      pending: matching.filter((c) => c.status === "pending").length,
    };
  }, [activeProvinceInfo, complaints]);

  const activeDistrictStats = React.useMemo(() => {
    if (!activeDistrictInfo) return null;
    const matching = complaints.filter((c) => {
      const compProv = c.province || inferProvinceFromCoord(c.coordinates);
      return (
        compProv === activeDistrictInfo.provinceTh &&
        districtsMatch(c.district, activeDistrictInfo.nameTh)
      );
    });
    return {
      total: matching.length,
    };
  }, [activeDistrictInfo, complaints]);

  const flyToThailandOverview = () => {
    mapRef.current?.flyTo({
      center: [100.8, 13.2],
      zoom: 5.6,
      duration: 1400,
    });
  };

  return (
    <div className="relative w-full h-full">
      <Map
        ref={mapRef}
        center={DEFAULT_MAP_VIEW.center}
        zoom={DEFAULT_MAP_VIEW.zoom}
        styles={styleUrls}
        theme={isDark ? "dark" : "light"}
        onViewportChange={handleViewportChange}
      >
        {/* Provincial Boundaries Layer (All 77 Provinces) */}
        <ProvinceBoundaryLayer
          visible={showProvinceBorders}
          isDark={isDark}
          currentStyle={currentStyle}
          isReportMode={isReportMode}
          selectedProvinceId={selectedProvince?.id ?? null}
          onHoverProvince={setHoveredProvince}
          onSelectProvince={handleSelectMapProvince}
        />

        {/* District / Amphoe Boundaries Layer (All 928 Districts, shown at zoom >= 7.2) */}
        <DistrictBoundaryLayer
          visible={showDistrictBorders}
          isDark={isDark}
          currentStyle={currentStyle}
          isReportMode={isReportMode}
          hoveredDistrictId={hoveredDistrict?.id ?? null}
          selectedDistrictId={selectedDistrict?.id ?? null}
          onHoverDistrict={setHoveredDistrict}
          onSelectDistrict={handleSelectMapDistrict}
        />

        {/* Subdistrict / Tambon Boundaries Layer (All 7,425 Tambons, lazy-loaded at zoom >= 10.2) */}
        <TambonBoundaryLayer
          visible={showTambonBorders}
          isDark={isDark}
          currentStyle={currentStyle}
          isReportMode={isReportMode}
          hoveredTambonId={hoveredTambon?.id ?? null}
          selectedTambonId={selectedTambon?.id ?? null}
          onHoverTambon={setHoveredTambon}
          onSelectTambon={handleSelectMapTambon}
        />

        {/* Live OSRM Driving Route Overlay */}
        {activeRoute && (
          <>
            <MapRoute
              id="osrm-active-route"
              coordinates={activeRoute.coordinates}
              color="#06b6d4"
              width={5}
              opacity={0.92}
              interactive={false}
            />
            <MapMarker
              longitude={activeRoute.origin[0]}
              latitude={activeRoute.origin[1]}
            >
              <MarkerContent>
                <div className="relative flex items-center justify-center">
                  <div className="w-6 h-6 rounded-full bg-cyan-500/25 animate-ping absolute" />
                  <div className="w-4 h-4 rounded-full bg-cyan-500 border-2 border-white shadow-lg" />
                </div>
              </MarkerContent>
              <MarkerTooltip className="pointer-events-none">
                <div className="px-2.5 py-1 rounded-lg bg-slate-900/90 text-white text-[11px] font-bold whitespace-nowrap shadow-lg">
                  {activeRoute.originLabel}
                </div>
              </MarkerTooltip>
            </MapMarker>
          </>
        )}

        {/* Map Controls */}
        <MapControls
          position="top-right"
          showZoom
          showCompass
          showFullscreen
          showLocate
          className="mt-16 mr-3"
        />

        {/* GISTDA Disaster Open API Flood Polygons & Dragonfly WMS */}
        <GistdaFloodLayer
          visible={weatherFx === "flood"}
          showWmsWarn={(weatherFx === "rain" || weatherFx === "flood") && showGistdaWmsWarn}
          featureCollection={gistdaFlood?.featureCollection ?? null}
          isDark={isDark}
        />

        {/* Animated Weather & Hazard Canvas Overlay */}
        <MapWeatherAnimationOverlay
          mode={weatherFx}
          airStations={airStations}
          cctvPoints={nearbyCctvPoints}
          complaints={complaints}
          gistdaFloodFeatures={gistdaFlood?.centroids ?? []}
          burnScars={gistdaBurnScars}
          liveWeather={fxTelemetry}
          isDark={isDark}
        />

        {/* ============ PENDING COORD MARKER (while in report mode) ============ */}
        {pendingCoord && (
          <MapMarker longitude={pendingCoord[0]} latitude={pendingCoord[1]}>
            <MarkerContent>
              <div className="relative flex items-center justify-center">
                <div className="absolute -inset-3 rounded-full bg-red-500 animate-ping opacity-70" />
                <div className="relative flex items-center justify-center w-10 h-10 rounded-full
                  bg-gradient-to-tr from-red-500 to-orange-500 text-white shadow-2xl ring-2 ring-white/90 border border-white/40">
                  <JKIcon name="location-crosshairs" className="text-sm" />
                </div>
              </div>
            </MarkerContent>
            <MarkerTooltip>
              <div className="flex items-center gap-1 px-3 py-1 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20">
                <JKIcon name="location-dot" className="text-red-500 text-xs" />
                <span>ตำแหน่งเกิดเหตุ</span>
              </div>
            </MarkerTooltip>
          </MapMarker>
        )}

        {/* ============ COMPLAINT MARKERS ============ */}
        {activeLayer === "complaints" &&
          complaints.map((complaint) => {
            const cat = COMPLAINT_CATEGORIES.find((c) => c.id === complaint.categoryId);
            const isSelected = selectedComplaint?.id === complaint.id;
            const pulseColor = STATUS_PULSE[complaint.status] ?? "#f59e0b";

            return (
              <MapMarker
                key={complaint.id}
                longitude={complaint.coordinates[0]}
                latitude={complaint.coordinates[1]}
                onClick={() => onSelectComplaint(complaint)}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectComplaint(complaint);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-300 cursor-pointer ${isSelected ? "scale-125 z-30" : "hover:scale-110"}`}
                  >
                    {/* Pulse ring for pending */}
                    {complaint.status === "pending" && (
                      <div
                        className="absolute -inset-2 rounded-full animate-ping opacity-60"
                        style={{ backgroundColor: pulseColor }}
                      />
                    )}
                    {/* Marker body */}
                    <div
                      className={`relative flex items-center justify-center w-9 h-9 rounded-2xl text-white shadow-xl transition-all
                        ${isSelected ? "ring-4 ring-white/80 shadow-2xl" : ""}`}
                      style={{ backgroundColor: cat?.color ?? "#64748b" }}
                    >
                      <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-xs" />
                    </div>
                    {/* Status dot */}
                    <span
                      className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: pulseColor }}
                    />
                    {/* Hot / Trending badge on marker */}
                    {(complaint.upvotes ?? 0) >= 25 && (
                      <span
                        className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-orange-500 text-white border-2 border-white shadow-sm flex items-center justify-center text-[8px] animate-pulse"
                        title="ปัญหาเร่งด่วน มีผู้ร่วมโหวตสูง"
                      >
                        <JKIcon name="fire" />
                      </span>
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[180px] truncate shadow-xl">
                    {complaint.title}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => onSelectComplaint(null)}
                  className="w-80 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  {/* Image or gradient header */}
                  {complaint.imageBase64 ? (
                    <div className="relative h-40 overflow-hidden">
                      <img src={complaint.imageBase64} alt={complaint.title} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                      <ComplaintPopupClose onClose={() => onSelectComplaint(null)} />
                      {/* Category + status pills */}
                      <div className="absolute top-3 left-3 flex items-center gap-1.5">
                        <span
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black text-white"
                          style={{ backgroundColor: cat?.color ?? "#64748b" }}
                        >
                          <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[10px]" />
                          {cat?.label}
                        </span>
                      </div>
                      <div className="absolute bottom-3 left-3.5 right-3.5">
                        <h3 className="text-sm font-black text-white leading-snug drop-shadow-md">{complaint.title}</h3>
                      </div>
                    </div>
                  ) : (
                    <div className="relative h-16 overflow-hidden" style={{ background: `linear-gradient(135deg, ${cat?.color ?? "#64748b"}33, ${cat?.color ?? "#64748b"}18)` }}>
                      <ComplaintPopupClose onClose={() => onSelectComplaint(null)} />
                      <div className="absolute bottom-2 left-3.5 right-10 flex items-center gap-2">
                        <span className="flex items-center justify-center w-7 h-7 rounded-xl text-white text-xs flex-shrink-0" style={{ backgroundColor: cat?.color }}>
                          <JKIcon name={cat?.icon ?? "clipboard-list"} className="text-[11px]" />
                        </span>
                        <h3 className="text-xs font-black text-white leading-snug drop-shadow-md line-clamp-2">{complaint.title}</h3>
                      </div>
                    </div>
                  )}

                  <div className="p-4 space-y-3">
                    {/* Status */}
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black"
                        style={{ backgroundColor: (STATUS_PULSE[complaint.status] ?? "#f59e0b") + "25", color: STATUS_PULSE[complaint.status] ?? "#f59e0b" }}
                      >
                        <JKIcon name={STATUS_ICON[complaint.status] ?? "clock"} className="text-[10px]" />
                        {STATUS_LABEL[complaint.status]}
                      </span>
                      <span className="text-[10px] text-slate-400">{complaint.createdAt}</span>
                    </div>

                    {/* Description */}
                    <p className="text-xs text-slate-300 leading-relaxed">{complaint.description}</p>

                    {/* Reporter */}
                    <div className="flex items-center gap-3 pt-1 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        <JKIcon name="user" className="text-slate-400 text-xs" />
                        <span className="text-[11px] text-slate-300 font-medium">{complaint.reporterName}</span>
                      </div>
                      {complaint.phone && (
                        <div className="flex items-center gap-1.5">
                          <JKIcon name="phone" className="text-slate-400 text-xs" />
                          <span className="text-[11px] text-slate-300 font-medium">{complaint.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Coordinates */}
                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-slate-500">
                      <JKIcon name="location-dot" className="text-slate-500 text-[10px]" />
                      {complaint.coordinates[1].toFixed(5)}°N, {complaint.coordinates[0].toFixed(5)}°E
                    </div>

                    {/* Community Upvote & Share Bar */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleUpvote?.(complaint.id);
                        }}
                        className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2.5 rounded-xl text-xs font-black whitespace-nowrap transition-all cursor-pointer border ${
                          upvotedIds.has(complaint.id)
                            ? "bg-gradient-to-r from-orange-500 to-amber-500 text-white border-orange-500 shadow-md shadow-orange-500/30"
                            : "bg-white/10 hover:bg-orange-500/20 text-white border-white/15"
                        }`}
                      >
                        <JKIcon name="thumbs-up" className={`text-xs ${upvotedIds.has(complaint.id) ? "animate-bounce" : ""}`} />
                        <span>{upvotedIds.has(complaint.id) ? "โหวตแล้ว" : "+1 โหวต"}</span>
                        <span className="font-mono text-[11px] opacity-90">({complaint.upvotes ?? 0})</span>
                      </button>

                      {onShareComplaint && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onShareComplaint(complaint);
                          }}
                          className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/15 transition cursor-pointer"
                          title="แชร์การ์ดปัญหา"
                        >
                          <JKIcon name="share-nodes" className="text-xs" />
                        </button>
                      )}
                    </div>

                    {/* Detail & Route Action Buttons */}
                    <div className="flex items-center gap-2 mt-1">
                      {onOpenDetail && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenDetail(complaint);
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap bg-white/10 hover:bg-white/20 active:scale-[0.98] text-white transition-all border border-white/15 cursor-pointer shadow-sm"
                        >
                          <JKIcon name="eye" className="text-xs shrink-0" />
                          <span>ดูรายละเอียด</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCalculateRoute(complaint.coordinates, complaint.title);
                        }}
                        disabled={isCalculatingRoute}
                        className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap shrink-0 bg-cyan-500/20 hover:bg-cyan-500/35 text-cyan-300 border border-cyan-400/30 transition cursor-pointer disabled:opacity-60"
                        title="คำนวณเส้นทางจริงด้วย OSRM"
                      >
                        <JKIcon name="route" className="text-xs shrink-0" />
                        <span>เส้นทาง</span>
                      </button>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {/* ============ EMERGENCY & AED MARKERS ============ */}
        {activeLayer === "emergency" &&
          nearbyEmergencyPoints.map((emg) => {
            const isSelected = selectedEmergencyPoint?.id === emg.id;
            const iconMap = {
              aed: "heart-pulse",
              hospital: "truck-medical",
              fire_station: "fire-extinguisher",
              police: "shield-halved",
              rescue: "truck-medical",
            };
            const colorMap = {
              aed: "#10b981",
              hospital: "#ef4444",
              fire_station: "#f59e0b",
              police: "#3b82f6",
              rescue: "#0f766e",
            };
            const labelMap = {
              aed: "ตู้กระตุกหัวใจ AED",
              hospital: "โรงพยาบาลฉุกเฉิน",
              fire_station: "ดับเพลิงและกู้ภัย",
              police: "สถานีตำรวจ",
              rescue: "หน่วยกู้ชีพและกู้ภัย",
            };
            const color = colorMap[emg.type];
            const icon = iconMap[emg.type];

            return (
              <MapMarker
                key={emg.id}
                longitude={emg.coordinates[0]}
                latitude={emg.coordinates[1]}
                onClick={() => setSelectedEmergencyPoint(emg)}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEmergencyPoint(emg);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-300 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    {emg.type === "aed" && (
                      <div
                        className="absolute -inset-2 rounded-full animate-ping opacity-60"
                        style={{ backgroundColor: color }}
                      />
                    )}
                    <div
                      className={`relative flex items-center justify-center w-9 h-9 rounded-2xl text-white shadow-xl transition-all ${
                        isSelected ? "ring-4 ring-white/80 shadow-2xl" : ""
                      }`}
                      style={{ backgroundColor: color }}
                    >
                      <JKIcon name={icon} className="text-xs" />
                    </div>
                    {emg.is24h && (
                      <span className="absolute -bottom-1 -right-1 px-1 py-0.2 rounded-full bg-slate-900 text-[8px] font-bold text-white border border-white/60">
                        24h
                      </span>
                    )}
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[200px] truncate shadow-xl">
                    {emg.name}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedEmergencyPoint(null)}
                  className="w-80 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="relative p-4 pb-3" style={{ background: `linear-gradient(135deg, ${color}33, ${color}15)` }}>
                    <ComplaintPopupClose onClose={() => setSelectedEmergencyPoint(null)} />
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: color }}
                      >
                        <JKIcon name={icon} className="text-[10px]" />
                        {labelMap[emg.type]}
                      </span>
                      {emg.is24h && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold">
                          เปิด 24 ชั่วโมง
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-black text-white leading-tight pr-6">{emg.name}</h3>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-start gap-2 text-xs text-slate-300">
                      <JKIcon name="location-dot" className="text-slate-400 text-xs mt-0.5 flex-shrink-0" />
                      <span>{emg.locationName}</span>
                    </div>

                    {emg.instruction && (
                      <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-emerald-300/90 leading-relaxed flex items-start gap-2">
                        <JKIcon name="circle-info" className="text-xs text-emerald-400 mt-0.5 flex-shrink-0" />
                        <span>{emg.instruction}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10">
                      {emg.phone && (
                        <a
                          href={`tel:${emg.phone}`}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-black whitespace-nowrap shadow-md cursor-pointer transition active:scale-95"
                        >
                          <JKIcon name="phone" className="text-xs shrink-0" />
                          <span>{["1669", "191", "199"].includes(emg.phone) ? "สายด่วน" : "โทร"} {emg.phone}</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleCalculateRoute(emg.coordinates, emg.name);
                        }}
                        disabled={isCalculatingRoute}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-cyan-600/80 hover:bg-cyan-500 text-white text-xs font-bold whitespace-nowrap border border-cyan-400/40 cursor-pointer transition disabled:opacity-60"
                      >
                        <JKIcon name={isCalculatingRoute ? "arrows-rotate" : "route"} className={`text-xs shrink-0 ${isCalculatingRoute ? "animate-spin" : ""}`} />
                        <span>{isCalculatingRoute ? "กำลังคำนวณ..." : "เส้นทาง OSRM"}</span>
                      </button>
                    </div>

                    <a className="block text-center text-xs font-semibold text-cyan-200"
                      href={`https://www.google.com/maps/dir/?api=1&destination=${emg.coordinates[1]},${emg.coordinates[0]}`}
                      target="_blank" rel="noopener noreferrer">นำทางด้วย Google Maps</a>

                    {onOpenSosModal && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmergencyPoint(null);
                          onOpenSosModal(emg.coordinates);
                        }}
                        className="w-full py-1.5 text-[11px] font-bold whitespace-nowrap text-red-300 hover:text-white flex items-center justify-center gap-1 transition cursor-pointer"
                      >
                        <JKIcon name="truck-medical" className="text-xs" />
                        <span>เปิดศูนย์ช่วยเหลือฉุกเฉินด่วน</span>
                      </button>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {/* ============ CIVIC POLLS MARKERS ============ */}
        {activeLayer === "polls" &&
          (civicPolls ?? []).map((poll) => {
            const isSelected = selectedPoll?.id === poll.id;
            const userVote = userPollVotes?.[poll.id];
            const agreePercent = poll.totalVotes > 0 ? Math.round((poll.agreeCount / poll.totalVotes) * 100) : 0;
            const disagreePercent = 100 - agreePercent;

            const categoryMeta = {
              safety: { label: "ความปลอดภัย", color: "#f59e0b", icon: "shield-halved" },
              traffic: { label: "การจราจร", color: "#3b82f6", icon: "car" },
              environment: { label: "สิ่งแวดล้อม", color: "#10b981", icon: "leaf" },
              pedestrian: { label: "ทางเท้าคนเดิน", color: "#ec4899", icon: "person-walking" },
            }[poll.category] ?? { label: "ทั่วไป", color: "#6366f1", icon: "check-to-slot" };

            return (
              <MapMarker
                key={poll.id}
                longitude={poll.coordinates[0]}
                latitude={poll.coordinates[1]}
                onClick={() => setSelectedPoll(poll)}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedPoll(poll);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-300 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-xl ring-2 ring-white/60">
                      <JKIcon name="check-to-slot" className="text-sm" />
                    </div>
                    <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-black border border-white shadow-xs">
                      {agreePercent}%
                    </span>
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[220px] truncate shadow-xl">
                    {poll.title}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedPoll(null)}
                  className="w-84 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div className="relative p-4 pb-3 bg-gradient-to-r from-blue-900/60 to-indigo-900/60 border-b border-white/10">
                    <ComplaintPopupClose onClose={() => setSelectedPoll(null)} />
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black text-white"
                        style={{ backgroundColor: categoryMeta.color }}
                      >
                        <JKIcon name={categoryMeta.icon} className="text-[10px]" />
                        {categoryMeta.label}
                      </span>
                      <span className="text-[10px] font-bold text-slate-300">สิ้นสุด {poll.endDate}</span>
                    </div>
                    <h3 className="text-sm font-black text-white leading-snug pr-6">{poll.title}</h3>
                  </div>

                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">{poll.description}</p>

                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                      <JKIcon name="location-dot" className="text-xs text-slate-500" />
                      <span>{poll.locationName}</span>
                    </div>

                    {/* Live Voting Bar */}
                    <div className="space-y-1.5 pt-2 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs font-black">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <JKIcon name="thumbs-up" className="text-[10px]" /> เห็นด้วย {agreePercent}% ({poll.agreeCount})
                        </span>
                        <span className="text-rose-400 flex items-center gap-1">
                          ไม่เห็นด้วย {disagreePercent}% ({poll.disagreeCount}) <JKIcon name="thumbs-down" className="text-[10px]" />
                        </span>
                      </div>
                      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 transition-all duration-500"
                          style={{ width: `${agreePercent}%` }}
                        />
                        <div
                          className="bg-rose-500 transition-all duration-500"
                          style={{ width: `${disagreePercent}%` }}
                        />
                      </div>
                      <div className="text-right text-[10px] text-slate-400">
                        รวมผู้ลงคะแนน {poll.totalVotes} เสียง
                      </div>
                    </div>

                    {/* Interactive Vote Buttons */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVotePoll?.(poll.id, "agree");
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer border ${
                          userVote === "agree"
                            ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 scale-[1.02]"
                            : "bg-white/10 hover:bg-emerald-500/20 text-emerald-400 border-white/15"
                        }`}
                      >
                        <JKIcon name="thumbs-up" />
                        <span>{userVote === "agree" ? "คุณเห็นด้วยแล้ว" : "เห็นด้วย"}</span>
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onVotePoll?.(poll.id, "disagree");
                        }}
                        className={`flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-black transition cursor-pointer border ${
                          userVote === "disagree"
                            ? "bg-rose-600 text-white border-rose-400 shadow-lg shadow-rose-600/30 scale-[1.02]"
                            : "bg-white/10 hover:bg-rose-500/20 text-rose-400 border-white/15"
                        }`}
                      >
                        <JKIcon name="thumbs-down" />
                        <span>{userVote === "disagree" ? "คุณไม่เห็นด้วย" : "ไม่เห็นด้วย"}</span>
                      </button>
                    </div>

                    <div className="text-[10px] text-slate-400 text-center font-medium pt-1">
                      เสนอโดย: {poll.proposalBy}
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {/* ============ CCTV & FLOOD MONITORING MARKERS ============ */}
        {activeLayer === "cctv" &&
          nearbyCctvPoints.map((cctv) => {
            const isSelected = selectedCctv?.id === cctv.id;
            const statusColor = {
              normal: "#10b981",
              warning: "#f59e0b",
              alert: "#ef4444",
            }[cctv.status];
            const statusLabel = {
              normal: "สถานการณ์ปกติ",
              warning: "เฝ้าระวัง / รอการระบาย",
              alert: "ระดับวิกฤต",
            }[cctv.status];

            return (
              <MapMarker
                key={cctv.id}
                longitude={cctv.coordinates[0]}
                latitude={cctv.coordinates[1]}
                onClick={() => setSelectedCctv(cctv)}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCctv(cctv);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-300 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    <div className="relative flex items-center justify-center w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-600 to-teal-600 text-white shadow-xl ring-2 ring-white/60">
                      <JKIcon name="video" className="text-sm" />
                    </div>
                    <span
                      className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white shadow-sm"
                      style={{ backgroundColor: statusColor }}
                    />
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[220px] truncate shadow-xl">
                    {cctv.name}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedCctv(null)}
                  className="w-80 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  {/* CCTV Snapshot view */}
                  <div className="relative h-44 overflow-hidden bg-black">
                    <img src={cctv.snapshotUrl} alt={cctv.name} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-black/40" />
                    <ComplaintPopupClose onClose={() => setSelectedCctv(null)} />

                    {/* Live badge */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-wider shadow-md">
                      <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                      <span>LIVE CCTV</span>
                    </div>

                    <div className="absolute bottom-2 left-3 right-3">
                      <h3 className="text-xs font-black text-white leading-tight drop-shadow-md">
                        {cctv.name}
                      </h3>
                      <span className="text-[10px] text-slate-300 drop-shadow">
                        อัปเดตเมื่อ {cctv.lastUpdated}
                      </span>
                    </div>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[10px] font-black"
                        style={{ backgroundColor: `${statusColor}25`, color: statusColor }}
                      >
                        <JKIcon name="circle-dot" className="text-[10px]" />
                        {statusLabel}
                      </span>
                    </div>

                    {cctv.waterLevel && (
                      <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <JKIcon name="water" className="text-cyan-400 text-sm" />
                          <span className="text-xs text-slate-300 font-bold">ระดับน้ำ:</span>
                        </div>
                        <span className="text-xs font-mono font-black text-cyan-300">
                          {cctv.waterLevel}
                        </span>
                      </div>
                    )}

                    {/* Live Open-Meteo Flood River Discharge */}
                    {(() => {
                      const hasLoaded = cctv.id in floodByCctvId;
                      const floodInfo = floodByCctvId[cctv.id];
                      if (!hasLoaded) {
                        return (
                          <div className="p-2 rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-400 flex items-center gap-2">
                            <JKIcon name="arrows-rotate" className="text-[10px] animate-spin text-sky-400" />
                            <span>กำลังดึงอัตราการไหลน้ำท่า (Open-Meteo Flood)...</span>
                          </div>
                        );
                      }
                      if (!floodInfo) return null;
                      return (
                        <div className="p-2.5 rounded-xl bg-sky-950/40 border border-sky-500/30 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] text-slate-300 font-bold flex items-center gap-1.5">
                              <JKIcon name="wave-pulse" className="text-sky-400 text-xs" />
                              <span>น้ำท่า (Flood API):</span>
                            </span>
                            <span className="text-xs font-mono font-black text-sky-300">
                              {floodInfo.dischargeM3s} m³/s
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[10px]">
                            <span className="font-bold" style={{ color: floodInfo.statusColor }}>
                              {floodInfo.statusLabel}
                            </span>
                            {floodInfo.date && (
                              <span className="text-slate-400 font-mono">{floodInfo.date}</span>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex items-center justify-between text-xs text-slate-300 pt-1 border-t border-white/10">
                      <span className="text-slate-400 font-medium">สภาพการจราจร:</span>
                      <span className="font-bold">
                        {cctv.trafficCondition === "smooth" && "คล่องตัว"}
                        {cctv.trafficCondition === "moderate" && "ชะลอตัวปานกลาง"}
                        {cctv.trafficCondition === "congested" && "ติดขัดหนาแน่น"}
                      </span>
                    </div>

                    <div className="text-[10px] text-slate-400 flex items-center gap-1">
                      <JKIcon name="location-dot" className="text-[10px]" />
                      <span>{cctv.locationName}</span>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {/* ============ AIR4THAI (PM2.5) + USGS EARTHQUAKE MARKERS ============ */}
        {activeLayer === "environment" &&
          airStations.map((station) => {
            const isSelected = selectedAirStation?.id === station.id;
            const rating = getAirQualityRating(station.pm25 ?? 20);
            const metricVal = station.pm25 ?? station.aqi ?? 0;

            return (
              <MapMarker
                key={`air-${station.id}`}
                longitude={station.coordinates[0]}
                latitude={station.coordinates[1]}
                onClick={() => {
                  setSelectedEarthquake(null);
                  setSelectedAirStation(station);
                }}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedEarthquake(null);
                      setSelectedAirStation(station);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    <div
                      className={`px-2 py-1 rounded-xl text-white font-mono font-black text-[10px] shadow-lg border border-white/80 flex items-center gap-1 ${
                        isSelected ? "ring-4 ring-white/70" : ""
                      }`}
                      style={{ backgroundColor: rating.color }}
                    >
                      <JKIcon name="lungs" className="text-[9px]" />
                      <span>{metricVal}</span>
                    </div>
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[230px] truncate shadow-xl">
                    {station.nameTH} • PM2.5 {station.pm25 ?? "-"} µg/m³
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedAirStation(null)}
                  className="w-80 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div
                    className="relative p-4 pb-3 border-b border-white/10"
                    style={{ background: `linear-gradient(135deg, ${rating.color}44, ${rating.color}15)` }}
                  >
                    <ComplaintPopupClose onClose={() => setSelectedAirStation(null)} />
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white flex items-center gap-1"
                        style={{ backgroundColor: rating.color }}
                      >
                        <JKIcon name="lungs" className="text-[10px]" />
                        Air4Thai กรมควบคุมมลพิษ
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white leading-snug pr-6">
                      {station.nameTH}
                    </h3>
                    <p className="text-[11px] text-slate-300 mt-0.5">{station.areaTH}</p>
                  </div>

                  <div className="p-4 space-y-3">
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-slate-400">PM2.5</p>
                        <p className="text-sm font-black font-mono" style={{ color: rating.color }}>
                          {station.pm25 ?? "-"}
                        </p>
                        <p className="text-[9px] text-slate-400">µg/m³</p>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-slate-400">PM10</p>
                        <p className="text-sm font-black font-mono text-white">
                          {station.pm10 ?? "-"}
                        </p>
                        <p className="text-[9px] text-slate-400">µg/m³</p>
                      </div>
                      <div className="p-2 rounded-xl bg-white/5 border border-white/10">
                        <p className="text-[10px] text-slate-400">Thai AQI</p>
                        <p className="text-sm font-black font-mono text-cyan-300">
                          {station.aqi ?? "-"}
                        </p>
                        <p className="text-[9px] text-slate-400">{rating.label}</p>
                      </div>
                    </div>

                    {station.updatedAt && (
                      <div className="text-[10px] text-slate-400 flex items-center justify-between pt-2 border-t border-white/10">
                        <span>อัปเดตล่าสุด</span>
                        <span className="font-mono text-slate-200">{station.updatedAt} น.</span>
                      </div>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {activeLayer === "environment" &&
          earthquakes.map((eq) => {
            const isSelected = selectedEarthquake?.id === eq.id;
            const eqColor = eq.magnitude >= 5 ? "#ef4444" : eq.magnitude >= 4 ? "#f97316" : "#eab308";

            return (
              <MapMarker
                key={`eq-${eq.id}`}
                longitude={eq.coordinates[0]}
                latitude={eq.coordinates[1]}
                onClick={() => {
                  setSelectedAirStation(null);
                  setSelectedEarthquake(eq);
                }}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAirStation(null);
                      setSelectedEarthquake(eq);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    <div
                      className="absolute -inset-2 rounded-full animate-ping opacity-55"
                      style={{ backgroundColor: eqColor }}
                    />
                    <div
                      className={`relative px-2 py-1 rounded-full text-white font-mono font-black text-[10px] shadow-xl border-2 border-white flex items-center gap-1 ${
                        isSelected ? "ring-4 ring-white/70" : ""
                      }`}
                      style={{ backgroundColor: eqColor }}
                    >
                      <JKIcon name="house-tsunami" className="text-[9px]" />
                      <span>M{eq.magnitude}</span>
                    </div>
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-3 py-1.5 rounded-xl liquid-glass text-slate-900 dark:text-white text-xs font-black whitespace-nowrap border border-white/20 max-w-[240px] truncate shadow-xl">
                    แผ่นดินไหว M{eq.magnitude} • {eq.place}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedEarthquake(null)}
                  className="w-80 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[28px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20 animate-in fade-in zoom-in-95 duration-200"
                >
                  <div
                    className="relative p-4 pb-3 border-b border-white/10"
                    style={{ background: `linear-gradient(135deg, ${eqColor}44, ${eqColor}15)` }}
                  >
                    <ComplaintPopupClose onClose={() => setSelectedEarthquake(null)} />
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-black text-white flex items-center gap-1"
                        style={{ backgroundColor: eqColor }}
                      >
                        <JKIcon name="house-tsunami" className="text-[10px]" />
                        USGS แจ้งเตือนแผ่นดินไหว
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-white/15 text-xs font-mono font-black">
                        M{eq.magnitude}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-white leading-snug pr-6">
                      {eq.place}
                    </h3>
                  </div>

                  <div className="p-4 space-y-2.5 text-xs">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">ความลึกจากผิวดิน</span>
                      <span className="font-mono font-bold text-white">{eq.depthKm} กม.</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="text-slate-400">เวลาที่เกิด</span>
                      <span className="font-mono text-white">
                        {new Date(eq.timeMs).toLocaleString("th-TH", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <a
                      href={eq.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full mt-2 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-center font-bold text-cyan-300 block transition"
                    >
                      ดูรายงานละเอียดที่ USGS
                    </a>
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}

        {/* ============ GISTDA BURN SCAR 10 DAYS MARKERS (DUST & SMOKE FX) ============ */}
        {weatherFx === "dust" &&
          gistdaBurnScars.slice(0, 60).map((scar) => {
            const isSelected = selectedBurnScar?.id === scar.id;
            const scarColor = scar.areaRai >= 500 ? "#ef4444" : scar.areaRai >= 100 ? "#f97316" : "#f59e0b";

            return (
              <MapMarker
                key={scar.id}
                longitude={scar.coord[0]}
                latitude={scar.coord[1]}
                onClick={() => setSelectedBurnScar(scar)}
              >
                <MarkerContent>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBurnScar(scar);
                    }}
                    className={`relative flex items-center justify-center transition-all duration-200 cursor-pointer ${
                      isSelected ? "scale-125 z-30" : "hover:scale-110"
                    }`}
                  >
                    <div
                      className="w-7 h-7 rounded-full text-white flex items-center justify-center shadow-lg border-2 border-white/90"
                      style={{ backgroundColor: scarColor }}
                    >
                      <JKIcon name="fire" className="text-[11px]" />
                    </div>
                  </div>
                </MarkerContent>

                <MarkerTooltip className="pointer-events-none">
                  <div className="pointer-events-none px-2.5 py-1 rounded-xl liquid-glass text-slate-900 dark:text-white text-[11px] font-black whitespace-nowrap border border-white/20 shadow-xl">
                    เผาไหม้ {scar.areaRai.toLocaleString("th-TH")} ไร่ · อ.{scar.amphoe} จ.{scar.province}
                  </div>
                </MarkerTooltip>

                <MarkerPopup
                  open={isSelected}
                  onClose={() => setSelectedBurnScar(null)}
                  className="w-72 max-w-[calc(100vw-2rem)] p-0 overflow-hidden rounded-[24px] bg-slate-950/92 backdrop-blur-2xl text-white shadow-2xl border border-white/20"
                >
                  <div
                    className="relative p-3.5 pb-2.5 border-b border-white/10"
                    style={{ background: `linear-gradient(135deg, ${scarColor}44, ${scarColor}15)` }}
                  >
                    <ComplaintPopupClose onClose={() => setSelectedBurnScar(null)} />
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9.5px] font-black text-white mb-1" style={{ backgroundColor: scarColor }}>
                      <JKIcon name="fire" className="text-[9px]" />
                      GISTDA Burn Scar (10 วัน)
                    </span>
                    <h3 className="text-xs font-black text-white leading-snug pr-6">
                      ต.{scar.tambon} อ.{scar.amphoe} จ.{scar.province}
                    </h3>
                  </div>
                  <div className="p-3.5 space-y-1.5 text-[11px]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">พื้นที่เผาไหม้</span>
                      <span className="font-mono font-black text-orange-300">
                        {scar.areaRai.toLocaleString("th-TH")} ไร่
                      </span>
                    </div>
                    {scar.cropType && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">พืช/พื้นที่</span>
                        <span className="font-bold text-white">{scar.cropType}</span>
                      </div>
                    )}
                    {scar.landUse && (
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-slate-400 shrink-0">เขตที่ดิน</span>
                        <span className="font-medium text-slate-200 truncate">{scar.landUse}</span>
                      </div>
                    )}
                    {scar.dateRange && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">ช่วงเวลา</span>
                        <span className="font-mono text-slate-300">{scar.dateRange}</span>
                      </div>
                    )}
                  </div>
                </MarkerPopup>
              </MapMarker>
            );
          })}
      </Map>

      {/* Top-Center HUD Stack (prevents overlap between Layer Switcher, Report Banner, Province Readout, and Route HUD) */}
      <div className="absolute top-15 sm:top-16 left-1/2 -translate-x-1/2 z-30 flex flex-col items-center gap-2 pointer-events-none max-w-[calc(100vw-24px)]">
        {/* Row 1: City Layer Switcher OR Report Mode Banner */}
        {!isReportMode && onChangeLayer && (
          <CityLayerSwitcher
            activeLayer={activeLayer}
            onChangeLayer={handleLayerChange}
            className="relative z-30 pointer-events-auto"
            counts={{
              complaints: complaints.length,
              emergency: nearbyEmergencyPoints.length,
              polls: (civicPolls ?? []).length,
              cctv: nearbyCctvPoints.length,
              environment: hasLoadedEnvData ? airStations.length + earthquakes.length : undefined,
            }}
          />
        )}

        {activeLayer === "emergency" && !isReportMode && onOpenSosModal && (
          <button type="button"
            className="pointer-events-auto rounded-full bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow"
            onClick={() => {
              const center = mapRef.current?.getCenter();
              onOpenSosModal(pendingCoord ?? selectedComplaint?.coordinates ??
                (center ? [center.lng, center.lat] : [viewport.lng, viewport.lat]));
            }}>
            ดูสถานที่ฉุกเฉินใกล้เคียง
          </button>
        )}

        {isReportMode && (
          <div className="pointer-events-none">
            <div className="flex items-center gap-3 px-4 sm:px-5 py-2 sm:py-2.5 rounded-2xl weather-glass-card shadow-2xl border border-red-400/40 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="relative w-8 h-8 sm:w-9 sm:h-9 -my-1 flex-shrink-0">
                <img
                  src="/images/mascot_camera.png"
                  alt="Select Point Mascot"
                  className="w-full h-full object-contain drop-shadow"
                />
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-red-500 animate-ping flex-shrink-0" />
                <p className="text-xs sm:text-sm font-black text-slate-900 dark:text-white whitespace-nowrap">
                  คลิกบนแผนที่เพื่อเลือกตำแหน่งเกิดเหตุ
                </p>
              </div>
              <JKIcon name="crosshairs" className="text-red-500 text-sm flex-shrink-0" />
            </div>
          </div>
        )}

        {/* Row 2: Desktop Active Tambon, District & Province Readout */}
        {!isReportMode && activeProvinceInfo && activeProvinceStats && (
          <div className="relative hidden sm:flex items-center gap-2 px-3.5 py-1.5 rounded-full weather-glass-card text-[11px] shadow-xl border border-teal-500/35 dark:border-cyan-400/35 pointer-events-auto max-w-[calc(100vw-160px)] animate-in fade-in duration-150">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                selectedProvince && !hoveredProvince
                  ? "bg-sky-500 dark:bg-cyan-400"
                  : "bg-teal-500 dark:bg-emerald-400"
              }`}
            />
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {activeTambonInfo && (
                <>
                  <span className="font-bold text-emerald-700 dark:text-emerald-300 whitespace-nowrap">
                    {activeTambonInfo.displayTh.replace(/^ตำบล/, "ต.")}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                </>
              )}
              {activeDistrictInfo && (
                <>
                  <span className="font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                    {activeDistrictInfo.displayTh.replace(/^อำเภอ/, "อ.")}
                  </span>
                  <span className="text-slate-400 dark:text-slate-500">•</span>
                </>
              )}
              <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                จ.{activeProvinceInfo.nameTh}
              </span>
              {activeProvinceInfo.region && (
                <span className="text-[10px] text-slate-500 dark:text-slate-300 whitespace-nowrap">
                  ({activeProvinceInfo.region})
                </span>
              )}
            </div>
            {activeDistrictInfo && activeDistrictStats && (
              <span className="px-2 py-0.5 rounded-full bg-indigo-500/15 dark:bg-indigo-400/20 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold whitespace-nowrap shrink-0">
                เขตนี้ {activeDistrictStats.total}
              </span>
            )}
            <span className="px-2 py-0.5 rounded-full bg-teal-500/15 dark:bg-cyan-500/20 text-teal-700 dark:text-cyan-300 font-mono text-[10px] font-bold whitespace-nowrap shrink-0">
              {activeProvinceStats.total} เรื่อง
            </span>
            {activeProvinceStats.pending > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-mono text-[10px] font-bold whitespace-nowrap shrink-0">
                ค้าง {activeProvinceStats.pending}
              </span>
            )}
            {selectedProvince && hoveredProvince && hoveredProvince.nameTh !== selectedProvince.nameTh ? (
              <button
                type="button"
                onClick={() => handleSelectMapProvince(selectedProvince)}
                className="text-[10px] text-sky-600 dark:text-cyan-300 hover:underline font-bold cursor-pointer whitespace-nowrap shrink-0"
                title="กลับไปดูพื้นที่ที่เลือกไว้"
              >
                (เลือก: {selectedProvince.nameTh})
              </button>
            ) : (
              selectedProvince && (
                <button
                  type="button"
                  onClick={handleClearSelectedProvince}
                  aria-label="ล้างพื้นที่ที่เลือก"
                  className="w-5 h-5 rounded-full hover:bg-slate-900/10 dark:hover:bg-white/15 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
                >
                  <JKIcon name="xmark" className="text-[10px]" />
                </button>
              )
            )}
          </div>
        )}

        {/* Row 3: Active OSRM Route / Env Loading Floating HUD */}
        {(activeRoute || routeError || (activeLayer === "environment" && isLoadingEnvData)) && (
          <div className="pointer-events-auto max-w-[calc(100vw-24px)]">
            {activeRoute ? (
              <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-2xl weather-glass-card shadow-2xl border border-cyan-500/40 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="w-7 h-7 rounded-xl bg-cyan-600 text-white flex items-center justify-center shrink-0">
                  <JKIcon name="route" className="text-xs" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-black text-slate-900 dark:text-white truncate max-w-[180px] sm:max-w-[260px]">
                    ไปยัง: {activeRoute.destinationName}
                  </p>
                  <p className="text-[10px] font-bold text-teal-700 dark:text-cyan-300">
                    {activeRoute.distanceKm} กม. • ประมาณ {activeRoute.durationMin} นาที (OSRM)
                  </p>
                </div>
                <a
                  href={`https://www.google.com/maps/dir/?api=1&origin=${activeRoute.origin[1]},${activeRoute.origin[0]}&destination=${activeRoute.destination[1]},${activeRoute.destination[0]}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-xl bg-slate-900/10 dark:bg-white/15 hover:bg-slate-900/20 dark:hover:bg-white/25 text-[10px] font-black text-slate-900 dark:text-white whitespace-nowrap transition"
                >
                  Google Maps
                </a>
                <button
                  type="button"
                  onClick={() => setActiveRoute(null)}
                  aria-label="ปิดเส้นทาง"
                  className="w-6 h-6 rounded-full bg-slate-900/10 dark:bg-white/15 hover:bg-red-500 hover:text-white text-slate-700 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                >
                  <JKIcon name="xmark" className="text-[10px]" />
                </button>
              </div>
            ) : routeError ? (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full weather-glass-card border border-amber-500/40 text-xs font-bold text-amber-700 dark:text-amber-300 shadow-lg">
                <span>{routeError}</span>
                <button
                  type="button"
                  onClick={() => setRouteError("")}
                  className="p-0.5 hover:opacity-70 cursor-pointer"
                >
                  <JKIcon name="xmark" className="text-[10px]" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full weather-glass-card border border-violet-500/35 text-[11px] font-bold text-slate-800 dark:text-white shadow-lg">
                <JKIcon name="arrows-rotate" className="text-xs animate-spin text-violet-500" />
                <span>กำลังโหลดสถานี Air4Thai และข้อมูลแผ่นดินไหว USGS...</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Animated Weather & Hazard FX Selector */}
      {!isReportMode && (
        <div
          ref={fxMenuRef}
          className="absolute bottom-[138px] left-3 sm:bottom-auto sm:top-[70px] sm:left-auto sm:right-[62px] z-[25] pointer-events-auto"
        >
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsFxMenuOpen((prev) => !prev)}
              aria-expanded={isFxMenuOpen}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-full text-[11px] font-black shadow-xl backdrop-blur-2xl border transition cursor-pointer active:scale-95 ${
                weatherFx !== "off"
                  ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white border-sky-400/50 shadow-sky-500/25"
                  : "weather-glass-card text-slate-800 dark:text-slate-100 border-white/50 dark:border-white/15"
              }`}
            >
              <JKIcon
                name={
                  weatherFx === "rain"
                    ? "cloud-rain"
                    : weatherFx === "storm"
                    ? "wind"
                    : weatherFx === "flood"
                    ? "water"
                    : weatherFx === "dust"
                    ? "smog"
                    : "sparkles"
                }
                className="text-xs"
              />
              <span>
                {weatherFx === "off"
                  ? "เอฟเฟกต์แผนที่"
                  : weatherFx === "rain"
                  ? "ฝนตก / ฟ้าแลบ"
                  : weatherFx === "storm"
                  ? "พายุลมหมุน"
                  : weatherFx === "flood"
                  ? "กระแสน้ำป่า/น้ำหลาก"
                  : "กลุ่มฝุ่น PM2.5"}
              </span>
              {weatherFx !== "off" && (
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
              )}
            </button>

            {isFxMenuOpen && (
              <div className="absolute bottom-full mb-2 left-0 sm:bottom-auto sm:top-full sm:mt-2 sm:mb-0 sm:left-auto sm:right-0 w-60 p-2 rounded-[22px] weather-glass-card border border-white/60 dark:border-white/15 shadow-2xl backdrop-blur-2xl space-y-1 animate-in fade-in duration-150">
                <div className="px-2.5 py-1 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  <span>จำลองสภาพอากาศ &amp; ภัยพิบัติ</span>
                  {weatherFx !== "off" && (
                    <button
                      type="button"
                      onClick={() => {
                        setWeatherFx("off");
                        setIsFxMenuOpen(false);
                      }}
                      className="text-rose-500 hover:underline cursor-pointer normal-case"
                    >
                      ปิด
                    </button>
                  )}
                </div>
                {(
                  [
                    {
                      id: "rain",
                      label: "ฝนตก & เตือนภัยฝน/น้ำท่วม GISTDA",
                      sub: "GISTDA Dragonfly WMS + ปริมาณฝน/ลมจริง",
                      icon: "cloud-rain",
                      color: "from-sky-500 to-blue-600",
                    },
                    {
                      id: "storm",
                      label: "พายุพัด & กระแสลม GISTDA / Meteo",
                      sub: "ทิศทาง/ความเร็วลมจริง + สถานะ Dragonfly",
                      icon: "wind",
                      color: "from-teal-500 to-cyan-600",
                    },
                    {
                      id: "flood",
                      label: "การไหลของน้ำป่า / น้ำท่วม GISTDA",
                      sub: "เชื่อม GISTDA Open API & เส้นทางน้ำไหลโค้ง",
                      icon: "water",
                      color: "from-cyan-600 to-indigo-600",
                    },
                    {
                      id: "dust",
                      label: "หมอกควัน เผาไหม้ GISTDA & PM2.5",
                      sub:
                        gistdaBurnScars.length > 0
                          ? `พื้นที่เผาไหม้ ${burnScarMatched.toLocaleString("th-TH")} จุด + Air4Thai`
                          : airStations.length > 0
                            ? `GISTDA Burn Scar 10 วัน + Air4Thai (${airStations.length} จุด)`
                            : "เชื่อมพื้นที่เผาไหม้ 10 วัน GISTDA & ฝุ่น PM2.5",
                      icon: "smog",
                      color: "from-amber-500 to-rose-500",
                    },
                    {
                      id: "off",
                      label: "ปิดเอฟเฟกต์",
                      sub: "แสดงแผนที่ปกติ",
                      icon: "eye-slash",
                      color: "from-slate-500 to-slate-600",
                    },
                  ] as const
                ).map((item) => {
                  const active = weatherFx === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        setWeatherFx(item.id);
                        setIsFxMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 p-2 rounded-2xl text-left transition cursor-pointer ${
                        active
                          ? `bg-gradient-to-r ${item.color} text-white shadow-md`
                          : "hover:bg-slate-900/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-100"
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 ${
                          active
                            ? "bg-white/20 text-white"
                            : `bg-gradient-to-br ${item.color} text-white`
                        }`}
                      >
                        <JKIcon name={item.icon} />
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-black truncate">{item.label}</p>
                        <p
                          className={`text-[9.5px] truncate ${
                            active ? "text-white/85" : "text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          {item.sub}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* GISTDA Disaster Open API Live Flood Control Panel */}
            {weatherFx === "flood" && !isFxMenuOpen && (
              <div className="hidden sm:block absolute top-full mt-2 right-0 w-72 p-3 rounded-[22px] weather-glass-card border border-white/60 dark:border-white/15 shadow-2xl backdrop-blur-2xl space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          gistdaFlood?.ok ? "bg-emerald-500 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                        GISTDA Disaster Open API
                      </span>
                    </div>
                    <a
                      href="https://disaster.gistda.or.th/services/open-api"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[9.5px] font-mono text-sky-600 dark:text-cyan-400 hover:underline truncate block"
                    >
                      disaster.gistda.or.th/services/open-api
                    </a>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setGistdaViewportTick((t) => t + 1)}
                      title="รีเฟรชข้อมูลน้ำท่วมบริเวณนี้"
                      className="w-7 h-7 rounded-xl bg-slate-900/5 dark:bg-white/10 hover:bg-sky-500/15 text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer"
                    >
                      <JKIcon
                        name="arrows-spin"
                        className={`text-[10px] ${isLoadingGistdaFlood ? "animate-spin text-sky-500" : ""}`}
                      />
                    </button>
                  </div>
                </div>

                {/* WMS Flood Warning Overlay Toggle */}
                <button
                  type="button"
                  onClick={() => setShowGistdaWmsWarn((v) => !v)}
                  className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                    showGistdaWmsWarn
                      ? "bg-indigo-500/15 border-indigo-400/35 text-indigo-700 dark:text-indigo-200"
                      : "bg-slate-900/5 dark:bg-white/5 border-transparent text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <JKIcon name="layer-group" className="text-[10px]" />
                    <span>ซ้อนแผนที่เตือนภัย GISTDA (WMS)</span>
                  </span>
                  <span className="font-mono text-[9.5px] font-black">
                    {showGistdaWmsWarn ? "ON" : "OFF"}
                  </span>
                </button>

                {/* Period Pills */}
                <div className="flex items-center gap-1 flex-wrap">
                  {GISTDA_FLOOD_PERIOD_OPTIONS.map((opt) => {
                    const selected = activeFloodPeriod === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setGistdaPeriodOverride(opt.id)}
                        className={`px-2 py-1 rounded-lg text-[10px] font-black transition cursor-pointer ${
                          selected
                            ? "bg-sky-600 text-white shadow-sm"
                            : "bg-slate-900/5 dark:bg-white/10 text-slate-600 dark:text-slate-300 hover:bg-sky-500/15"
                        }`}
                      >
                        {opt.shortLabel}
                      </button>
                    );
                  })}
                </div>

                {/* Status / Key Prompt */}
                {gistdaFlood?.ok ? (
                  <div className="rounded-xl bg-sky-500/10 border border-sky-500/20 px-2.5 py-2 text-[10.5px] text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2">
                    {gistdaFlood.centroids.length > 0 ? (
                      <>
                        <span className="font-bold">
                          พบพื้นที่น้ำท่วม{" "}
                          <strong className="font-mono text-sky-700 dark:text-cyan-300">
                            {(gistdaFlood.numberMatched ?? gistdaFlood.centroids.length).toLocaleString("th-TH")}
                          </strong>{" "}
                          จุด
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            mapRef.current?.flyTo({
                              center: gistdaFlood.centroids[0].coord,
                              zoom: Math.max(mapRef.current.getZoom(), 11.5),
                              duration: 900,
                            })
                          }
                          className="text-[10px] font-black text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                        >
                          ไปจุดน้ำท่วม
                        </button>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold text-slate-600 dark:text-slate-300">
                          ไม่พบพื้นที่น้ำท่วมช่วงนี้
                        </span>
                        {activeFloodPeriod !== "7days" && (
                          <button
                            type="button"
                            onClick={() => setGistdaPeriodOverride("7days")}
                            className="text-[10px] font-black text-sky-600 dark:text-cyan-400 hover:underline cursor-pointer shrink-0"
                          >
                            ดูรอบ 7 วัน
                          </button>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="rounded-xl bg-slate-500/10 border border-slate-500/20 px-2.5 py-2 text-[10px] text-slate-600 dark:text-slate-300">
                    <p className="font-bold leading-relaxed">
                      {isLoadingGistdaFlood
                        ? "กำลังโหลดข้อมูลพื้นที่น้ำท่วมจาก GISTDA..."
                        : "กำลังแสดงแนวแม่น้ำหลักและพื้นที่เฝ้าระวัง GISTDA"}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* GISTDA Dragonfly + Weather HUD for Rain & Storm Modes */}
            {(weatherFx === "rain" || weatherFx === "storm") && !isFxMenuOpen && (
              <div className="hidden sm:block absolute top-full mt-2 right-0 w-72 p-3 rounded-[22px] weather-glass-card border border-white/60 dark:border-white/15 shadow-2xl backdrop-blur-2xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          fxTelemetry?.gistdaOk ? "bg-emerald-500 animate-pulse" : "bg-sky-500"
                        }`}
                      />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                        {weatherFx === "rain"
                          ? "GISTDA Dragonfly Rain & Warn"
                          : "GISTDA & Live Wind Telemetry"}
                      </span>
                    </div>
                    <p className="text-[9.5px] font-mono text-sky-600 dark:text-cyan-400 truncate">
                      {fxTelemetry?.gistdaChecks?.length
                        ? `Dragonfly: ${fxTelemetry.gistdaChecks.map((c) => c.servicename).join(", ")}`
                        : "Open-Meteo + GISTDA Open API"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setGistdaViewportTick((t) => t + 1)}
                    title="รีเฟรชข้อมูลสภาพอากาศ & GISTDA"
                    className="w-7 h-7 rounded-xl bg-slate-900/5 dark:bg-white/10 hover:bg-sky-500/15 text-slate-600 dark:text-slate-200 flex items-center justify-center transition cursor-pointer shrink-0"
                  >
                    <JKIcon name="arrows-spin" className="text-[10px]" />
                  </button>
                </div>

                {fxTelemetry && (
                  <div className="grid grid-cols-3 gap-1.5 text-center">
                    <div className="rounded-xl bg-slate-900/5 dark:bg-white/10 px-2 py-1.5">
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 block">ความเร็วลม</span>
                      <span className="text-[11px] font-mono font-black text-slate-900 dark:text-white">
                        {fxTelemetry.windSpeedKmh} km/h
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-900/5 dark:bg-white/10 px-2 py-1.5">
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 block">
                        {weatherFx === "rain" ? "ปริมาณฝน" : "ลมกระโชก"}
                      </span>
                      <span className="text-[11px] font-mono font-black text-sky-600 dark:text-cyan-300">
                        {weatherFx === "rain"
                          ? `${fxTelemetry.precipitationMm} mm`
                          : `${fxTelemetry.windGustsKmh} km/h`}
                      </span>
                    </div>
                    <div className="rounded-xl bg-slate-900/5 dark:bg-white/10 px-2 py-1.5">
                      <span className="text-[9px] text-slate-500 dark:text-slate-400 block">
                        {weatherFx === "rain" ? "ทิศทางลม" : "ความกดอากาศ"}
                      </span>
                      <span className="text-[11px] font-mono font-black text-slate-900 dark:text-white">
                        {weatherFx === "rain"
                          ? `${fxTelemetry.windDirectionDeg}°`
                          : `${fxTelemetry.pressureHpa} hPa`}
                      </span>
                    </div>
                  </div>
                )}

                {weatherFx === "rain" && (
                  <button
                    type="button"
                    onClick={() => setShowGistdaWmsWarn((v) => !v)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-[10px] font-bold border transition cursor-pointer ${
                      showGistdaWmsWarn
                        ? "bg-sky-500/15 border-sky-400/35 text-sky-700 dark:text-cyan-200"
                        : "bg-slate-900/5 dark:bg-white/5 border-transparent text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <span className="flex items-center gap-1.5">
                      <JKIcon name="layer-group" className="text-[10px]" />
                      <span>ซ้อนพื้นที่เสี่ยงน้ำท่วม GISTDA WMS</span>
                    </span>
                    <span className="font-mono text-[9.5px] font-black">
                      {showGistdaWmsWarn ? "ON" : "OFF"}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* GISTDA Burn Scar 10 Days + Air4Thai HUD for Dust Mode */}
            {weatherFx === "dust" && !isFxMenuOpen && (
              <div className="hidden sm:block absolute top-full mt-2 right-0 w-72 p-3 rounded-[22px] weather-glass-card border border-white/60 dark:border-white/15 shadow-2xl backdrop-blur-2xl space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`w-2 h-2 rounded-full ${
                          gistdaBurnScars.length > 0 ? "bg-orange-500 animate-pulse" : "bg-amber-500"
                        }`}
                      />
                      <span className="text-[11px] font-black text-slate-900 dark:text-white truncate">
                        GISTDA Burn Scar 10 วัน &amp; PM2.5
                      </span>
                    </div>
                    <p className="text-[9.5px] font-mono text-orange-600 dark:text-orange-300 truncate">
                      /analytics/burn-scar/10days + Air4Thai
                    </p>
                  </div>
                  {isLoadingBurnScars && (
                    <JKIcon name="arrows-spin" className="text-[10px] animate-spin text-orange-500 shrink-0" />
                  )}
                </div>

                <div className="rounded-xl bg-orange-500/10 border border-orange-500/20 px-2.5 py-2 text-[10.5px] text-slate-700 dark:text-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold">
                    จุดเผาไหม้{" "}
                    <strong className="font-mono text-orange-600 dark:text-orange-300">
                      {(burnScarMatched || gistdaBurnScars.length).toLocaleString("th-TH")}
                    </strong>{" "}
                    จุด · Air4Thai{" "}
                    <strong className="font-mono">{airStations.length}</strong>
                  </span>
                  {gistdaBurnScars[0] && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedBurnScar(gistdaBurnScars[0]);
                        mapRef.current?.flyTo({
                          center: gistdaBurnScars[0].coord,
                          zoom: Math.max(mapRef.current.getZoom(), 10.5),
                          duration: 900,
                        });
                      }}
                      className="text-[10px] font-black text-orange-600 dark:text-orange-300 hover:underline cursor-pointer shrink-0"
                    >
                      ไปจุดใหญ่สุด
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile: Provincial, District & Subdistrict Borders Toggle Pill */}
      <div className="absolute top-[110px] left-3 z-20 flex sm:hidden items-center gap-1 pointer-events-auto flex-wrap max-w-[calc(100vw-24px)]">
        <button
          type="button"
          onClick={() => setShowProvinceBorders((prev) => !prev)}
          aria-pressed={showProvinceBorders}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black shadow-lg backdrop-blur-2xl border transition cursor-pointer active:scale-95 ${
            showProvinceBorders
              ? "bg-teal-600/90 text-white border-teal-400/50 shadow-teal-500/20"
              : "weather-glass-card text-slate-700 dark:text-slate-200 border-white/40 dark:border-white/15"
          }`}
        >
          <JKIcon name="border-all" className="text-[11px]" />
          <span>จังหวัด</span>
        </button>
        <button
          type="button"
          onClick={handleToggleDistrictBorders}
          aria-pressed={showDistrictBorders}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black shadow-lg backdrop-blur-2xl border transition cursor-pointer active:scale-95 ${
            showDistrictBorders
              ? "bg-indigo-600/90 text-white border-indigo-400/50 shadow-indigo-500/20"
              : "weather-glass-card text-slate-700 dark:text-slate-200 border-white/40 dark:border-white/15"
          }`}
        >
          <JKIcon name="location-dot" className="text-[11px]" />
          <span>เขต/อำเภอ</span>
        </button>
        <button
          type="button"
          onClick={handleToggleTambonBorders}
          aria-pressed={showTambonBorders}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-black shadow-lg backdrop-blur-2xl border transition cursor-pointer active:scale-95 ${
            showTambonBorders
              ? "bg-emerald-600/90 text-white border-emerald-400/50 shadow-emerald-500/20"
              : "weather-glass-card text-slate-700 dark:text-slate-200 border-white/40 dark:border-white/15"
          }`}
        >
          <JKIcon name="map-pin" className="text-[11px]" />
          <span>ตำบล/แขวง</span>
        </button>
        {(showProvinceBorders || showDistrictBorders || showTambonBorders) && (
          <button
            type="button"
            onClick={flyToThailandOverview}
            aria-label="ดูภาพรวมทั้ง 77 จังหวัด"
            title="ดูภาพรวมทั้ง 77 จังหวัด"
            className="w-7 h-7 rounded-full weather-glass-card border border-white/40 dark:border-white/15 text-teal-700 dark:text-cyan-300 flex items-center justify-center shadow-lg backdrop-blur-2xl cursor-pointer active:scale-95 transition"
          >
            <JKIcon name="globe" className="text-[11px]" />
          </button>
        )}
      </div>

      {/* Mobile: Selected Province / District / Tambon Info Pill */}
      {!isReportMode && selectedProvince && activeProvinceStats && (
        <div className="absolute bottom-[138px] right-3 z-20 flex sm:hidden items-center gap-2 px-3 py-1.5 rounded-full weather-glass-card text-[11px] shadow-xl border border-teal-500/35 dark:border-cyan-400/35 pointer-events-auto max-w-[calc(100vw-168px)] animate-in fade-in duration-150">
          <span className="w-2 h-2 rounded-full bg-sky-500 dark:bg-cyan-400 shrink-0" />
          <span className="font-bold text-slate-900 dark:text-white truncate">
            {[
              selectedTambon?.displayTh.replace(/^ตำบล/, "ต."),
              selectedDistrict?.displayTh.replace(/^อำเภอ/, "อ."),
              `จ.${selectedProvince.nameTh}`,
            ]
              .filter(Boolean)
              .join(" • ")}
          </span>
          {selectedProvince.region && (
            <span className="text-[10px] text-slate-500 dark:text-slate-300 shrink-0">
              {selectedProvince.region}
            </span>
          )}
          <span className="px-2 py-0.5 rounded-full bg-teal-500/15 dark:bg-cyan-500/20 text-teal-700 dark:text-cyan-300 font-mono text-[10px] font-bold shrink-0">
            {activeProvinceStats.total} เรื่อง
          </span>
          <button
            type="button"
            onClick={handleClearSelectedProvince}
            aria-label="ล้างพื้นที่ที่เลือก"
            className="w-5 h-5 rounded-full bg-slate-900/10 dark:bg-white/10 text-slate-600 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
          >
            <JKIcon name="xmark" className="text-[9px]" />
          </button>
        </div>
      )}

      {/* HUD: Border Toggles + Coordinates */}
      <div className="absolute bottom-20 right-3 sm:bottom-4 sm:right-12 z-20 hidden sm:flex items-center gap-3 pointer-events-auto">

        <div className="flex items-center gap-1.5 p-1 rounded-full weather-glass-card text-[11px] shadow-xl border border-white/60 dark:border-white/20">
          <button
            type="button"
            onClick={() => setShowProvinceBorders((prev) => !prev)}
            aria-pressed={showProvinceBorders}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black transition cursor-pointer active:scale-95 ${
              showProvinceBorders
                ? "bg-teal-600 dark:bg-cyan-600 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
            }`}
          >
            <JKIcon name="border-all" className="text-xs" />
            <span>จังหวัด</span>
          </button>
          <button
            type="button"
            onClick={handleToggleDistrictBorders}
            aria-pressed={showDistrictBorders}
            title="แสดงเส้นแบ่งเขต / อำเภอ ทั้ง 928 แห่งทั่วประเทศ (แสดงเมื่อซูมระดับภูมิภาค/เมือง)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black transition cursor-pointer active:scale-95 ${
              showDistrictBorders
                ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
            }`}
          >
            <JKIcon name="location-dot" className="text-xs" />
            <span>เขต/อำเภอ</span>
          </button>
          <button
            type="button"
            onClick={handleToggleTambonBorders}
            aria-pressed={showTambonBorders}
            title="แสดงเส้นแบ่งตำบล / แขวง ทั้ง 7,425 แห่งทั่วประเทศ (แสดงเมื่อซูมระดับพื้นที่ >= 10.2x)"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full font-black transition cursor-pointer active:scale-95 ${
              showTambonBorders
                ? "bg-emerald-600 dark:bg-emerald-500 text-white shadow-sm"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10"
            }`}
          >
            <JKIcon name="map-pin" className="text-xs" />
            <span>ตำบล/แขวง</span>
          </button>
          {(showProvinceBorders || showDistrictBorders || showTambonBorders) && (
            <button
              type="button"
              onClick={flyToThailandOverview}
              aria-label="ดูภาพรวมทั้ง 77 จังหวัด"
              title="ดูภาพรวมทั้ง 77 จังหวัด"
              className="px-3 py-1.5 rounded-full text-teal-700 dark:text-cyan-300 hover:bg-teal-500/15 dark:hover:bg-cyan-400/15 font-bold flex items-center gap-1 transition cursor-pointer active:scale-95"
            >
              <JKIcon name="globe" className="text-xs" />
              <span>77 จว.</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 rounded-full weather-glass-card text-[11px] font-mono shadow-xl border border-white/60 dark:border-white/20">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-600 dark:text-white/70 font-sans font-bold">พิกัด:</span>
            <span className="font-black text-slate-900 dark:text-white">
              {viewport.lat.toFixed(4)}°, {viewport.lng.toFixed(4)}°
            </span>
          </div>
          <div className="w-px h-3.5 bg-slate-300 dark:bg-white/25" />
          <div className="flex items-center gap-1">
            <span className="text-slate-600 dark:text-white/70 font-sans font-bold">ซูม:</span>
            <span className="font-black text-teal-700 dark:text-cyan-300">{viewport.zoom.toFixed(1)}x</span>
          </div>
          <button
            onClick={copyCoordinates}
            aria-label="Copy coordinates"
            className="p-1 rounded-lg hover:bg-slate-900/5 dark:hover:bg-white/20 text-slate-600 dark:text-white/80 hover:text-slate-950 dark:hover:text-white transition cursor-pointer"
          >
            {hasCopiedCoord ? (
              <JKIcon name="check" className="text-emerald-600 dark:text-emerald-400 text-xs" />
            ) : (
              <JKIcon name="copy" className="text-xs" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
