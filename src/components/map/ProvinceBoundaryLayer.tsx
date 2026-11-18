"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as MapLibreGL from "maplibre-gl";
import { useMap } from "@/components/ui/map";
import type { MapStyleKey } from "./MapHeader";

const SOURCE_ID = "thailand-provinces-source";
const FILL_LAYER_ID = "thailand-provinces-fill";
const HALO_LAYER_ID = "thailand-provinces-halo";
const LINE_LAYER_ID = "thailand-provinces-line";

export interface HoveredProvinceInfo {
  id: string;
  nameTh: string;
  nameEn: string;
  region: string;
  center?: [number, number];
}

interface ProvinceBoundaryLayerProps {
  visible: boolean;
  isDark: boolean;
  currentStyle: MapStyleKey;
  isReportMode?: boolean;
  selectedProvinceId?: string | null;
  onHoverProvince?: (province: HoveredProvinceInfo | null) => void;
  onSelectProvince?: (province: HoveredProvinceInfo) => void;
}

let cachedGeoJson: GeoJSON.FeatureCollection | null = null;
let geoJsonPromise: Promise<GeoJSON.FeatureCollection> | null = null;

async function loadThailandProvincesGeoJson(): Promise<GeoJSON.FeatureCollection> {
  if (cachedGeoJson) return cachedGeoJson;
  if (!geoJsonPromise) {
    geoJsonPromise = fetch("/data/thailand-provinces.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load province boundaries");
        return res.json() as Promise<GeoJSON.FeatureCollection>;
      })
      .then((data) => {
        cachedGeoJson = data;
        return data;
      })
      .catch((err) => {
        geoJsonPromise = null;
        throw err;
      });
  }
  return geoJsonPromise;
}

function getBorderColors(isDarkStyle: boolean) {
  if (isDarkStyle) {
    return {
      fill: "#22d3ee",
      halo: "rgba(8, 145, 178, 0.28)",
      line: "#22d3ee",
      lineHover: "#67e8f9",
    };
  }
  return {
    fill: "#0d9488",
    halo: "rgba(255, 255, 255, 0.78)",
    line: "#0f766e",
    lineHover: "#0284c7",
  };
}

function parseCenterProp(
  rawCenter: unknown,
  fallbackLngLat?: MapLibreGL.LngLat,
): [number, number] | undefined {
  if (Array.isArray(rawCenter) && rawCenter.length >= 2) {
    const lng = Number(rawCenter[0]);
    const lat = Number(rawCenter[1]);
    if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
  }
  if (typeof rawCenter === "string") {
    try {
      const parsed = JSON.parse(rawCenter) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 2) {
        const lng = Number(parsed[0]);
        const lat = Number(parsed[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) return [lng, lat];
      }
    } catch {
      // fallback below
    }
  }
  if (fallbackLngLat) {
    return [fallbackLngLat.lng, fallbackLngLat.lat];
  }
  return undefined;
}

export interface HoveredDistrictInfo {
  id: string;
  nameTh: string;
  displayTh: string;
  nameEn: string;
  provincePcode: string;
  provinceTh: string;
  provinceEn: string;
  region: string;
  center?: [number, number];
}

export interface HoveredTambonInfo {
  id: string;
  nameTh: string;
  displayTh: string;
  nameEn: string;
  districtPcode: string;
  districtTh: string;
  districtDisplayTh: string;
  provincePcode: string;
  provinceTh: string;
  provinceEn: string;
  region: string;
  center?: [number, number];
}

const DISTRICT_SOURCE_ID = "thailand-amphoes-source";
const DISTRICT_FILL_LAYER_ID = "thailand-amphoes-fill";
const DISTRICT_LINE_LAYER_ID = "thailand-amphoes-line";
const DISTRICT_MIN_ZOOM = 7.2;

const TAMBON_SOURCE_ID = "thailand-tambons-source";
const TAMBON_FILL_LAYER_ID = "thailand-tambons-fill";
const TAMBON_LINE_LAYER_ID = "thailand-tambons-line";
const TAMBON_MIN_ZOOM = 10.2;

function createCachedGeoJsonLoader(url: string) {
  let cached: GeoJSON.FeatureCollection | null = null;
  let promise: Promise<GeoJSON.FeatureCollection> | null = null;
  return {
    getCached: () => cached,
    load: async (): Promise<GeoJSON.FeatureCollection> => {
      if (cached) return cached;
      if (!promise) {
        promise = fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json() as Promise<GeoJSON.FeatureCollection>;
          })
          .then((data) => {
            cached = data;
            return data;
          })
          .catch((err) => {
            promise = null;
            throw err;
          });
      }
      return promise;
    },
  };
}

const amphoesLoader = createCachedGeoJsonLoader("/data/thailand-amphoes.geojson");
const tambonsLoader = createCachedGeoJsonLoader("/data/thailand-tambons.geojson");

function extractProvinceInfo(
  feature: MapLibreGL.MapGeoJSONFeature,
  lngLat?: MapLibreGL.LngLat,
): HoveredProvinceInfo {
  const props = feature.properties ?? {};
  return {
    id: String(props.id ?? feature.id ?? ""),
    nameTh: String(props.name_th ?? props.name ?? ""),
    nameEn: String(props.name_en ?? props.name ?? ""),
    region: String(props.region ?? ""),
    center: parseCenterProp(props.center, lngLat),
  };
}

function extractDistrictInfo(
  feature: MapLibreGL.MapGeoJSONFeature,
  lngLat?: MapLibreGL.LngLat,
): HoveredDistrictInfo {
  const props = feature.properties ?? {};
  const adm2Th = String(props.adm2_th ?? "");
  return {
    id: String(props.id ?? feature.id ?? ""),
    nameTh: adm2Th,
    displayTh: String(props.display_th ?? adm2Th),
    nameEn: String(props.adm2_en ?? ""),
    provincePcode: String(props.adm1_pcode ?? ""),
    provinceTh: String(props.adm1_th ?? ""),
    provinceEn: String(props.adm1_en ?? ""),
    region: String(props.region ?? ""),
    center: parseCenterProp(props.center, lngLat),
  };
}

function extractTambonInfo(
  feature: MapLibreGL.MapGeoJSONFeature,
  lngLat?: MapLibreGL.LngLat,
): HoveredTambonInfo {
  const props = feature.properties ?? {};
  const adm3Th = String(props.adm3_th ?? "");
  const adm2Th = String(props.adm2_th ?? "");
  return {
    id: String(props.id ?? feature.id ?? ""),
    nameTh: adm3Th,
    displayTh: String(props.display_th ?? adm3Th),
    nameEn: String(props.adm3_en ?? ""),
    districtPcode: String(props.adm2_pcode ?? ""),
    districtTh: adm2Th,
    districtDisplayTh: String(props.adm2_display_th ?? adm2Th),
    provincePcode: String(props.adm1_pcode ?? ""),
    provinceTh: String(props.adm1_th ?? ""),
    provinceEn: String(props.adm1_en ?? ""),
    region: String(props.region ?? ""),
    center: parseCenterProp(props.center, lngLat),
  };
}

interface PolygonInteractionConfig<T> {
  map: MapLibreGL.Map;
  sourceId: string;
  fillLayerId: string;
  visibleRef: React.MutableRefObject<boolean>;
  isReportModeRef: React.MutableRefObject<boolean>;
  hoveredIdRef: React.MutableRefObject<string | number | null>;
  selectedIdRef: React.MutableRefObject<string | number | null>;
  onHoverRef: React.MutableRefObject<((item: T | null) => void) | undefined>;
  onSelectRef: React.MutableRefObject<((item: T) => void) | undefined>;
  extractInfo: (
    feature: MapLibreGL.MapGeoJSONFeature,
    lngLat?: MapLibreGL.LngLat,
  ) => T;
}

/** Binds hover/click feature-state listeners on a GeoJSON fill layer and returns cleanup. */
function bindPolygonFeatureInteractions<T>({
  map,
  sourceId,
  fillLayerId,
  visibleRef,
  isReportModeRef,
  hoveredIdRef,
  selectedIdRef,
  onHoverRef,
  onSelectRef,
  extractInfo,
}: PolygonInteractionConfig<T>): () => void {
  const clearHover = () => {
    if (hoveredIdRef.current !== null && map.getSource(sourceId)) {
      try {
        map.setFeatureState(
          { source: sourceId, id: hoveredIdRef.current },
          { hover: false },
        );
      } catch {
        // ignore if source already removed
      }
      hoveredIdRef.current = null;
    }
    onHoverRef.current?.(null);
  };

  const handleMouseMove = (
    e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] },
  ) => {
    if (!visibleRef.current || isReportModeRef.current) {
      clearHover();
      return;
    }
    const feature = e.features?.[0];
    if (!feature) {
      clearHover();
      return;
    }

    const featureId = feature.id ?? feature.properties?.id;
    if (featureId !== undefined && featureId !== hoveredIdRef.current) {
      if (hoveredIdRef.current !== null && map.getSource(sourceId)) {
        try {
          map.setFeatureState(
            { source: sourceId, id: hoveredIdRef.current },
            { hover: false },
          );
        } catch {
          // ignore
        }
      }
      hoveredIdRef.current = featureId;
      try {
        map.setFeatureState({ source: sourceId, id: featureId }, { hover: true });
      } catch {
        // ignore
      }
    }

    onHoverRef.current?.(extractInfo(feature, e.lngLat));
  };

  const handleClick = (
    e: MapLibreGL.MapMouseEvent & { features?: MapLibreGL.MapGeoJSONFeature[] },
  ) => {
    if (!visibleRef.current || isReportModeRef.current) return;
    const targetEl = e.originalEvent?.target as HTMLElement | null;
    if (targetEl?.closest?.(".maplibregl-marker, .maplibregl-popup")) return;

    const feature = e.features?.[0];
    if (!feature) return;

    const featureId = feature.id ?? feature.properties?.id;
    if (featureId !== undefined && featureId !== selectedIdRef.current) {
      if (selectedIdRef.current !== null && map.getSource(sourceId)) {
        try {
          map.setFeatureState(
            { source: sourceId, id: selectedIdRef.current },
            { selected: false },
          );
        } catch {
          // ignore
        }
      }
      selectedIdRef.current = featureId;
      try {
        map.setFeatureState({ source: sourceId, id: featureId }, { selected: true });
      } catch {
        // ignore
      }
    }

    onSelectRef.current?.(extractInfo(feature, e.lngLat));
  };

  const handleMouseLeave = () => {
    clearHover();
  };

  map.on("mousemove", fillLayerId, handleMouseMove);
  map.on("mouseleave", fillLayerId, handleMouseLeave);
  map.on("click", fillLayerId, handleClick);

  return () => {
    map.off("mousemove", fillLayerId, handleMouseMove);
    map.off("mouseleave", fillLayerId, handleMouseLeave);
    map.off("click", fillLayerId, handleClick);
    clearHover();
    selectedIdRef.current = null;
  };
}

const IS_ACTIVE_EXPR: MapLibreGL.ExpressionSpecification = [
  "any",
  ["boolean", ["feature-state", "hover"], false],
  ["boolean", ["feature-state", "selected"], false],
];

export function ProvinceBoundaryLayer({
  visible,
  isDark,
  currentStyle,
  isReportMode = false,
  selectedProvinceId = null,
  onHoverProvince,
  onSelectProvince,
}: ProvinceBoundaryLayerProps) {
  const { map, isLoaded } = useMap();
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(
    () => cachedGeoJson,
  );
  const hoveredIdRef = useRef<string | number | null>(null);
  const selectedIdRef = useRef<string | number | null>(null);
  const onHoverRef = useRef(onHoverProvince);
  const onSelectRef = useRef(onSelectProvince);
  const visibleRef = useRef(visible);
  const isReportModeRef = useRef(isReportMode);

  useEffect(() => {
    onHoverRef.current = onHoverProvince;
    onSelectRef.current = onSelectProvince;
    visibleRef.current = visible;
    isReportModeRef.current = isReportMode;
  }, [onHoverProvince, onSelectProvince, visible, isReportMode]);

  useEffect(() => {
    let active = true;
    if (!geoJsonData) {
      loadThailandProvincesGeoJson()
        .then((data) => {
          if (active) setGeoJsonData(data);
        })
        .catch(() => {
          // Non-fatal: map remains functional without boundary overlay
        });
    }
    return () => {
      active = false;
    };
  }, [geoJsonData]);

  // Add source and layers whenever map style is ready
  useEffect(() => {
    if (!map || !isLoaded || !geoJsonData) return;

    const isDarkStyle = isDark || currentStyle === "darkmatter";
    const colors = getBorderColors(isDarkStyle);
    const visibility = visibleRef.current ? "visible" : "none";

    if (!map.getSource(SOURCE_ID)) {
      map.addSource(SOURCE_ID, {
        type: "geojson",
        data: geoJsonData,
        promoteId: "id",
      });
    }

    if (!map.getLayer(FILL_LAYER_ID)) {
      map.addLayer({
        id: FILL_LAYER_ID,
        type: "fill",
        source: SOURCE_ID,
        layout: { visibility },
        paint: {
          "fill-color": colors.fill,
          "fill-opacity": ["case", IS_ACTIVE_EXPR, isDarkStyle ? 0.14 : 0.1, 0.001],
        },
      });
    }

    if (!map.getLayer(HALO_LAYER_ID)) {
      map.addLayer({
        id: HALO_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: {
          visibility,
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": colors.halo,
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            2.4,
            7,
            3.5,
            11,
            4.5,
          ],
          "line-opacity": ["case", IS_ACTIVE_EXPR, 0.9, 0.65],
        },
      });
    }

    if (!map.getLayer(LINE_LAYER_ID)) {
      map.addLayer({
        id: LINE_LAYER_ID,
        type: "line",
        source: SOURCE_ID,
        layout: {
          visibility,
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["case", IS_ACTIVE_EXPR, colors.lineHover, colors.line],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            4,
            ["case", IS_ACTIVE_EXPR, 2.4, 0.9],
            7,
            ["case", IS_ACTIVE_EXPR, 2.4, 1.35],
            11,
            ["case", IS_ACTIVE_EXPR, 2.4, 1.85],
          ],
          "line-opacity": ["case", IS_ACTIVE_EXPR, 0.98, isDarkStyle ? 0.72 : 0.68],
          "line-dasharray": [4, 1.5],
        },
      });
    }

    const unbind = bindPolygonFeatureInteractions({
      map,
      sourceId: SOURCE_ID,
      fillLayerId: FILL_LAYER_ID,
      visibleRef,
      isReportModeRef,
      hoveredIdRef,
      selectedIdRef,
      onHoverRef,
      onSelectRef,
      extractInfo: extractProvinceInfo,
    });

    return () => {
      unbind();
      try {
        if (map.getLayer(LINE_LAYER_ID)) map.removeLayer(LINE_LAYER_ID);
        if (map.getLayer(HALO_LAYER_ID)) map.removeLayer(HALO_LAYER_ID);
        if (map.getLayer(FILL_LAYER_ID)) map.removeLayer(FILL_LAYER_ID);
        if (map.getSource(SOURCE_ID)) map.removeSource(SOURCE_ID);
      } catch {
        // ignore cleanup errors on map unmount or style switch
      }
    };
  }, [map, isLoaded, geoJsonData, isDark, currentStyle]);

  // Update layer visibility cleanly without recreating source/layers
  useEffect(() => {
    if (!map || !isLoaded) return;
    const visibility = visible ? "visible" : "none";
    try {
      [FILL_LAYER_ID, HALO_LAYER_ID, LINE_LAYER_ID].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", visibility);
        }
      });
      if (!visible && hoveredIdRef.current !== null && map.getSource(SOURCE_ID)) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
        onHoverRef.current?.(null);
      }
    } catch {
      // ignore if style transition in progress
    }
  }, [map, isLoaded, visible]);

  // Clear selected boundary highlight when external selection is cleared
  useEffect(() => {
    if (!map || !isLoaded || selectedProvinceId !== null) return;
    if (selectedIdRef.current !== null && map.getSource(SOURCE_ID)) {
      try {
        map.setFeatureState(
          { source: SOURCE_ID, id: selectedIdRef.current },
          { selected: false },
        );
      } catch {
        // ignore
      }
      selectedIdRef.current = null;
    }
  }, [map, isLoaded, selectedProvinceId]);

  return null;
}

interface DistrictBoundaryLayerProps {
  visible: boolean;
  isDark: boolean;
  currentStyle?: string;
  isReportMode?: boolean;
  hoveredDistrictId?: string | null;
  selectedDistrictId?: string | null;
  onHoverDistrict?: (district: HoveredDistrictInfo | null) => void;
  onSelectDistrict?: (district: HoveredDistrictInfo) => void;
}

const DISTRICT_LABEL_MIN_ZOOM = 7.8;
const MAX_VISIBLE_DISTRICT_LABELS = 22;
const TAMBON_LABEL_MIN_ZOOM = 11.2;
const MAX_VISIBLE_TAMBON_LABELS = 24;

interface ViewportLabelStyleConfig {
  passiveLightClass: string;
  passiveDarkClass: string;
  activeClass: string;
  activeZIndex: string;
  passiveZIndex: string;
}

const DISTRICT_LABEL_STYLE: ViewportLabelStyleConfig = {
  passiveLightClass:
    "inline-flex items-center w-max px-1.5 py-0.5 rounded-md text-[11px] font-medium tracking-wide whitespace-nowrap text-indigo-950/85",
  passiveDarkClass:
    "inline-flex items-center w-max px-1.5 py-0.5 rounded-md text-[11px] font-medium tracking-wide whitespace-nowrap text-indigo-200/90",
  activeClass:
    "inline-flex items-center w-max px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight whitespace-nowrap shadow-lg border transition-transform duration-150 scale-105 bg-indigo-600/95 text-white border-white/75 backdrop-blur-md",
  activeZIndex: "12",
  passiveZIndex: "2",
};

const TAMBON_LABEL_STYLE: ViewportLabelStyleConfig = {
  passiveLightClass:
    "inline-flex items-center w-max px-1 py-0.5 rounded text-[10px] font-normal tracking-wide whitespace-nowrap text-emerald-900/80",
  passiveDarkClass:
    "inline-flex items-center w-max px-1 py-0.5 rounded text-[10px] font-normal tracking-wide whitespace-nowrap text-emerald-200/85",
  activeClass:
    "inline-flex items-center w-max px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-tight whitespace-nowrap shadow-lg border transition-transform duration-150 scale-105 bg-emerald-600/95 text-white border-white/75 backdrop-blur-md",
  activeZIndex: "13",
  passiveZIndex: "1",
};

function formatShortDistrictLabel(displayTh: string): string {
  return displayTh.replace(/^อำเภอ/, "อ.");
}

function formatShortTambonLabel(displayTh: string): string {
  return displayTh.replace(/^ตำบล/, "ต.");
}

type LabelMarkerMap = globalThis.Map<
  string,
  { marker: MapLibreGL.Marker; rootEl: HTMLDivElement; badgeEl: HTMLSpanElement }
>;

function applyBoundaryLabelStyle(
  rootEl: HTMLDivElement,
  badgeEl: HTMLSpanElement,
  label: string,
  isActive: boolean,
  isDarkStyle: boolean,
  styleCfg: ViewportLabelStyleConfig,
) {
  rootEl.style.pointerEvents = "none";
  rootEl.style.zIndex = isActive ? styleCfg.activeZIndex : styleCfg.passiveZIndex;
  badgeEl.textContent = label;
  badgeEl.style.textShadow = isActive
    ? "none"
    : isDarkStyle
    ? "0 1px 3px rgba(2,6,23,0.95), 0 0 6px rgba(2,6,23,0.85)"
    : "0 1px 3px rgba(255,255,255,0.98), 0 0 6px rgba(255,255,255,0.95)";
  badgeEl.className = isActive
    ? styleCfg.activeClass
    : isDarkStyle
    ? styleCfg.passiveDarkClass
    : styleCfg.passiveLightClass;
}

function clearMarkerMap(markers: LabelMarkerMap) {
  markers.forEach(({ marker }) => marker.remove());
  markers.clear();
}

/** Syncs decluttered Thai administrative labels at visible polygon centers inside the map viewport. */
function syncViewportPolygonLabels(options: {
  map: MapLibreGL.Map;
  geoJsonData: GeoJSON.FeatureCollection;
  markers: LabelMarkerMap;
  minZoom: number;
  maxLabels: number;
  minPixelDist: number;
  hoveredId: string | null;
  selectedId: string | null;
  isDarkStyle: boolean;
  styleCfg: ViewportLabelStyleConfig;
  formatLabel: (props: Record<string, unknown>, isActive: boolean) => string;
}) {
  const {
    map,
    geoJsonData,
    markers,
    minZoom,
    maxLabels,
    minPixelDist,
    hoveredId,
    selectedId,
    isDarkStyle,
    styleCfg,
    formatLabel,
  } = options;

  if (map.getZoom() < minZoom) {
    clearMarkerMap(markers);
    return;
  }

  const bounds = map.getBounds();
  const mapCenter = map.getCenter();

  const candidates: {
    id: string;
    label: string;
    center: [number, number];
    distSq: number;
    isActive: boolean;
  }[] = [];

  for (const feat of geoJsonData.features) {
    const props = (feat.properties ?? {}) as Record<string, unknown>;
    const id = String(props.id ?? feat.id ?? "");
    const center = parseCenterProp(props.center);
    if (!id || !center) continue;

    const [lng, lat] = center;
    if (!bounds.contains([lng, lat])) continue;
    const isActive = id === hoveredId || id === selectedId;
    const dx = lng - mapCenter.lng;
    const dy = lat - mapCenter.lat;

    candidates.push({
      id,
      label: formatLabel(props, isActive),
      center,
      distSq: dx * dx + dy * dy,
      isActive,
    });
  }

  candidates.sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return a.distSq - b.distSq;
  });

  const minPixelDistSq = minPixelDist * minPixelDist;
  const placedPoints: { x: number; y: number }[] = [];
  const chosen: typeof candidates = [];

  for (const item of candidates) {
    if (chosen.length >= maxLabels) break;
    const pt = map.project(item.center);
    if (!item.isActive) {
      const tooClose = placedPoints.some((p) => {
        const dx = p.x - pt.x;
        const dy = p.y - pt.y;
        return dx * dx + dy * dy < minPixelDistSq;
      });
      if (tooClose) continue;
    }
    placedPoints.push({ x: pt.x, y: pt.y });
    chosen.push(item);
  }

  const chosenIds = new Set(chosen.map((c) => c.id));
  for (const [id, entry] of markers.entries()) {
    if (!chosenIds.has(id)) {
      entry.marker.remove();
      markers.delete(id);
    }
  }

  for (const item of chosen) {
    const existing = markers.get(item.id);
    if (existing) {
      applyBoundaryLabelStyle(
        existing.rootEl,
        existing.badgeEl,
        item.label,
        item.isActive,
        isDarkStyle,
        styleCfg,
      );
    } else {
      const rootEl = document.createElement("div");
      const badgeEl = document.createElement("span");
      rootEl.appendChild(badgeEl);
      applyBoundaryLabelStyle(rootEl, badgeEl, item.label, item.isActive, isDarkStyle, styleCfg);
      const marker = new MapLibreGL.Marker({ element: rootEl, anchor: "center" })
        .setLngLat(item.center)
        .addTo(map);
      markers.set(item.id, { marker, rootEl, badgeEl });
    }
  }
}

/** Renders all 928 Thailand District / Khet boundaries with zoom-adaptive stroke, Thai labels, and hover/click states. */
export function DistrictBoundaryLayer({
  visible,
  isDark,
  currentStyle,
  isReportMode = false,
  hoveredDistrictId = null,
  selectedDistrictId = null,
  onHoverDistrict,
  onSelectDistrict,
}: DistrictBoundaryLayerProps) {
  const { map, isLoaded } = useMap();
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(() =>
    amphoesLoader.getCached(),
  );
  const hoveredIdRef = useRef<string | number | null>(null);
  const selectedIdRef = useRef<string | number | null>(null);
  const markersRef = useRef<LabelMarkerMap>(new globalThis.Map());
  const onHoverRef = useRef(onHoverDistrict);
  const onSelectRef = useRef(onSelectDistrict);
  const visibleRef = useRef(visible);
  const isReportModeRef = useRef(isReportMode);
  const activeStateRef = useRef({
    hoveredId: hoveredDistrictId,
    selectedId: selectedDistrictId,
    isDarkStyle: isDark || currentStyle === "darkmatter",
  });

  useEffect(() => {
    onHoverRef.current = onHoverDistrict;
    onSelectRef.current = onSelectDistrict;
    visibleRef.current = visible;
    isReportModeRef.current = isReportMode;
  }, [onHoverDistrict, onSelectDistrict, visible, isReportMode]);

  useEffect(() => {
    activeStateRef.current = {
      hoveredId: hoveredDistrictId,
      selectedId: selectedDistrictId,
      isDarkStyle: isDark || currentStyle === "darkmatter",
    };
  }, [hoveredDistrictId, selectedDistrictId, isDark, currentStyle]);

  const clearDistrictLabels = useCallback(() => {
    clearMarkerMap(markersRef.current);
  }, []);

  const syncDistrictLabels = useCallback(() => {
    if (!map || !isLoaded || !geoJsonData || !visibleRef.current) {
      clearDistrictLabels();
      return;
    }
    const { hoveredId, selectedId, isDarkStyle } = activeStateRef.current;
    const zoom = map.getZoom();
    syncViewportPolygonLabels({
      map,
      geoJsonData,
      markers: markersRef.current,
      minZoom: DISTRICT_LABEL_MIN_ZOOM,
      maxLabels: MAX_VISIBLE_DISTRICT_LABELS,
      minPixelDist: zoom >= 11 ? 82 : 98,
      hoveredId,
      selectedId,
      isDarkStyle,
      styleCfg: DISTRICT_LABEL_STYLE,
      formatLabel: (props, isActive) => {
        const base = formatShortDistrictLabel(String(props.display_th ?? props.adm2_th ?? ""));
        const provTh = String(props.adm1_th ?? "");
        return isActive && provTh ? `${base} • จ.${provTh}` : base;
      },
    });
  }, [map, isLoaded, geoJsonData, clearDistrictLabels]);

  useEffect(() => {
    if (!visible || geoJsonData) return;
    let active = true;
    amphoesLoader
      .load()
      .then((data) => {
        if (active) setGeoJsonData(data);
      })
      .catch(() => {
        // Non-fatal: map remains functional without district overlay
      });
    return () => {
      active = false;
    };
  }, [visible, geoJsonData]);

  useEffect(() => {
    if (!map || !isLoaded || !geoJsonData) return;

    const isDarkStyle = isDark || currentStyle === "darkmatter";
    const visibility = visibleRef.current ? "visible" : "none";
    const lineColor = isDarkStyle ? "#a5b4fc" : "#4f46e5";
    const activeColor = isDarkStyle ? "#38bdf8" : "#2563eb";
    const fillColor = isDarkStyle ? "#818cf8" : "#6366f1";

    if (!map.getSource(DISTRICT_SOURCE_ID)) {
      map.addSource(DISTRICT_SOURCE_ID, {
        type: "geojson",
        data: geoJsonData,
        promoteId: "id",
      });
    }

    if (!map.getLayer(DISTRICT_FILL_LAYER_ID)) {
      map.addLayer({
        id: DISTRICT_FILL_LAYER_ID,
        type: "fill",
        source: DISTRICT_SOURCE_ID,
        minzoom: DISTRICT_MIN_ZOOM,
        layout: { visibility },
        paint: {
          "fill-color": fillColor,
          "fill-opacity": ["case", IS_ACTIVE_EXPR, isDarkStyle ? 0.16 : 0.12, 0.001],
        },
      });
    }

    if (!map.getLayer(DISTRICT_LINE_LAYER_ID)) {
      map.addLayer({
        id: DISTRICT_LINE_LAYER_ID,
        type: "line",
        source: DISTRICT_SOURCE_ID,
        minzoom: DISTRICT_MIN_ZOOM,
        layout: {
          visibility,
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["case", IS_ACTIVE_EXPR, activeColor, lineColor],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            DISTRICT_MIN_ZOOM,
            ["case", IS_ACTIVE_EXPR, 1.8, 0.55],
            10,
            ["case", IS_ACTIVE_EXPR, 2.2, 0.9],
            13,
            ["case", IS_ACTIVE_EXPR, 2.6, 1.35],
          ],
          "line-opacity": ["case", IS_ACTIVE_EXPR, 0.95, isDarkStyle ? 0.58 : 0.55],
          "line-dasharray": [2, 1.5],
        },
      });
    }

    const unbind = bindPolygonFeatureInteractions({
      map,
      sourceId: DISTRICT_SOURCE_ID,
      fillLayerId: DISTRICT_FILL_LAYER_ID,
      visibleRef,
      isReportModeRef,
      hoveredIdRef,
      selectedIdRef,
      onHoverRef,
      onSelectRef,
      extractInfo: extractDistrictInfo,
    });

    const handleViewChange = () => {
      syncDistrictLabels();
    };
    map.on("moveend", handleViewChange);
    map.on("zoomend", handleViewChange);
    syncDistrictLabels();

    return () => {
      map.off("moveend", handleViewChange);
      map.off("zoomend", handleViewChange);
      clearDistrictLabels();
      unbind();
      try {
        if (map.getLayer(DISTRICT_LINE_LAYER_ID)) map.removeLayer(DISTRICT_LINE_LAYER_ID);
        if (map.getLayer(DISTRICT_FILL_LAYER_ID)) map.removeLayer(DISTRICT_FILL_LAYER_ID);
        if (map.getSource(DISTRICT_SOURCE_ID)) map.removeSource(DISTRICT_SOURCE_ID);
      } catch {
        // ignore cleanup errors on map unmount or style switch
      }
    };
  }, [map, isLoaded, geoJsonData, isDark, currentStyle, syncDistrictLabels, clearDistrictLabels]);

  useEffect(() => {
    syncDistrictLabels();
  }, [visible, hoveredDistrictId, selectedDistrictId, isDark, currentStyle, syncDistrictLabels]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const visibility = visible ? "visible" : "none";
    try {
      [DISTRICT_FILL_LAYER_ID, DISTRICT_LINE_LAYER_ID].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", visibility);
        }
      });
      if (!visible && hoveredIdRef.current !== null && map.getSource(DISTRICT_SOURCE_ID)) {
        map.setFeatureState(
          { source: DISTRICT_SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
        onHoverRef.current?.(null);
      }
    } catch {
      // ignore if style transition in progress
    }
  }, [map, isLoaded, visible]);

  useEffect(() => {
    if (!map || !isLoaded || selectedDistrictId !== null) return;
    if (selectedIdRef.current !== null && map.getSource(DISTRICT_SOURCE_ID)) {
      try {
        map.setFeatureState(
          { source: DISTRICT_SOURCE_ID, id: selectedIdRef.current },
          { selected: false },
        );
      } catch {
        // ignore
      }
      selectedIdRef.current = null;
    }
  }, [map, isLoaded, selectedDistrictId]);

  return null;
}

interface TambonBoundaryLayerProps {
  visible: boolean;
  isDark: boolean;
  currentStyle?: string;
  isReportMode?: boolean;
  hoveredTambonId?: string | null;
  selectedTambonId?: string | null;
  onHoverTambon?: (tambon: HoveredTambonInfo | null) => void;
  onSelectTambon?: (tambon: HoveredTambonInfo) => void;
}

/** Renders all 7,425 Thailand Subdistrict (Tambon / Khwaeng) boundaries, lazy-loaded at zoom >= 10.2. */
export function TambonBoundaryLayer({
  visible,
  isDark,
  currentStyle,
  isReportMode = false,
  hoveredTambonId = null,
  selectedTambonId = null,
  onHoverTambon,
  onSelectTambon,
}: TambonBoundaryLayerProps) {
  const { map, isLoaded } = useMap();
  const [geoJsonData, setGeoJsonData] = useState<GeoJSON.FeatureCollection | null>(() =>
    tambonsLoader.getCached(),
  );
  const [shouldFetch, setShouldFetch] = useState(false);
  const hoveredIdRef = useRef<string | number | null>(null);
  const selectedIdRef = useRef<string | number | null>(null);
  const markersRef = useRef<LabelMarkerMap>(new globalThis.Map());
  const onHoverRef = useRef(onHoverTambon);
  const onSelectRef = useRef(onSelectTambon);
  const visibleRef = useRef(visible);
  const isReportModeRef = useRef(isReportMode);
  const activeStateRef = useRef({
    hoveredId: hoveredTambonId,
    selectedId: selectedTambonId,
    isDarkStyle: isDark || currentStyle === "darkmatter",
  });

  useEffect(() => {
    onHoverRef.current = onHoverTambon;
    onSelectRef.current = onSelectTambon;
    visibleRef.current = visible;
    isReportModeRef.current = isReportMode;
  }, [onHoverTambon, onSelectTambon, visible, isReportMode]);

  useEffect(() => {
    activeStateRef.current = {
      hoveredId: hoveredTambonId,
      selectedId: selectedTambonId,
      isDarkStyle: isDark || currentStyle === "darkmatter",
    };
  }, [hoveredTambonId, selectedTambonId, isDark, currentStyle]);

  useEffect(() => {
    if (!map || !isLoaded || !visible || geoJsonData) return;
    const checkZoom = () => {
      if (map.getZoom() >= TAMBON_MIN_ZOOM) {
        setShouldFetch(true);
      }
    };
    checkZoom();
    map.on("zoomend", checkZoom);
    return () => {
      map.off("zoomend", checkZoom);
    };
  }, [map, isLoaded, visible, geoJsonData]);

  useEffect(() => {
    if (!visible || !shouldFetch || geoJsonData) return;
    let active = true;
    tambonsLoader
      .load()
      .then((data) => {
        if (active) setGeoJsonData(data);
      })
      .catch(() => {
        // Non-fatal: map remains functional without subdistrict overlay
      });
    return () => {
      active = false;
    };
  }, [visible, shouldFetch, geoJsonData]);

  const clearTambonLabels = useCallback(() => {
    clearMarkerMap(markersRef.current);
  }, []);

  const syncTambonLabels = useCallback(() => {
    if (!map || !isLoaded || !geoJsonData || !visibleRef.current) {
      clearTambonLabels();
      return;
    }
    const { hoveredId, selectedId, isDarkStyle } = activeStateRef.current;
    syncViewportPolygonLabels({
      map,
      geoJsonData,
      markers: markersRef.current,
      minZoom: TAMBON_LABEL_MIN_ZOOM,
      maxLabels: MAX_VISIBLE_TAMBON_LABELS,
      minPixelDist: 76,
      hoveredId,
      selectedId,
      isDarkStyle,
      styleCfg: TAMBON_LABEL_STYLE,
      formatLabel: (props, isActive) => {
        const base = formatShortTambonLabel(String(props.display_th ?? props.adm3_th ?? ""));
        const distTh = formatShortDistrictLabel(String(props.adm2_display_th ?? props.adm2_th ?? ""));
        return isActive && distTh ? `${base} • ${distTh}` : base;
      },
    });
  }, [map, isLoaded, geoJsonData, clearTambonLabels]);

  useEffect(() => {
    if (!map || !isLoaded || !geoJsonData) return;

    const isDarkStyle = isDark || currentStyle === "darkmatter";
    const visibility = visibleRef.current ? "visible" : "none";
    const lineColor = isDarkStyle ? "#6ee7b7" : "#059669";
    const activeColor = isDarkStyle ? "#34d399" : "#047857";
    const fillColor = isDarkStyle ? "#34d399" : "#10b981";

    if (!map.getSource(TAMBON_SOURCE_ID)) {
      map.addSource(TAMBON_SOURCE_ID, {
        type: "geojson",
        data: geoJsonData,
        promoteId: "id",
      });
    }

    if (!map.getLayer(TAMBON_FILL_LAYER_ID)) {
      map.addLayer({
        id: TAMBON_FILL_LAYER_ID,
        type: "fill",
        source: TAMBON_SOURCE_ID,
        minzoom: TAMBON_MIN_ZOOM,
        layout: { visibility },
        paint: {
          "fill-color": fillColor,
          "fill-opacity": ["case", IS_ACTIVE_EXPR, isDarkStyle ? 0.14 : 0.1, 0.001],
        },
      });
    }

    if (!map.getLayer(TAMBON_LINE_LAYER_ID)) {
      map.addLayer({
        id: TAMBON_LINE_LAYER_ID,
        type: "line",
        source: TAMBON_SOURCE_ID,
        minzoom: TAMBON_MIN_ZOOM,
        layout: {
          visibility,
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": ["case", IS_ACTIVE_EXPR, activeColor, lineColor],
          "line-width": [
            "interpolate",
            ["linear"],
            ["zoom"],
            TAMBON_MIN_ZOOM,
            ["case", IS_ACTIVE_EXPR, 1.5, 0.45],
            12,
            ["case", IS_ACTIVE_EXPR, 1.9, 0.7],
            14,
            ["case", IS_ACTIVE_EXPR, 2.2, 1.0],
          ],
          "line-opacity": ["case", IS_ACTIVE_EXPR, 0.92, isDarkStyle ? 0.45 : 0.42],
          "line-dasharray": [1.5, 1.5],
        },
      });
    }

    const unbind = bindPolygonFeatureInteractions({
      map,
      sourceId: TAMBON_SOURCE_ID,
      fillLayerId: TAMBON_FILL_LAYER_ID,
      visibleRef,
      isReportModeRef,
      hoveredIdRef,
      selectedIdRef,
      onHoverRef,
      onSelectRef,
      extractInfo: extractTambonInfo,
    });

    const handleViewChange = () => {
      syncTambonLabels();
    };
    map.on("moveend", handleViewChange);
    map.on("zoomend", handleViewChange);
    syncTambonLabels();

    return () => {
      map.off("moveend", handleViewChange);
      map.off("zoomend", handleViewChange);
      clearTambonLabels();
      unbind();
      try {
        if (map.getLayer(TAMBON_LINE_LAYER_ID)) map.removeLayer(TAMBON_LINE_LAYER_ID);
        if (map.getLayer(TAMBON_FILL_LAYER_ID)) map.removeLayer(TAMBON_FILL_LAYER_ID);
        if (map.getSource(TAMBON_SOURCE_ID)) map.removeSource(TAMBON_SOURCE_ID);
      } catch {
        // ignore cleanup errors on map unmount or style switch
      }
    };
  }, [map, isLoaded, geoJsonData, isDark, currentStyle, syncTambonLabels, clearTambonLabels]);

  useEffect(() => {
    syncTambonLabels();
  }, [visible, hoveredTambonId, selectedTambonId, isDark, currentStyle, syncTambonLabels]);

  useEffect(() => {
    if (!map || !isLoaded) return;
    const visibility = visible ? "visible" : "none";
    try {
      [TAMBON_FILL_LAYER_ID, TAMBON_LINE_LAYER_ID].forEach((layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", visibility);
        }
      });
      if (!visible && hoveredIdRef.current !== null && map.getSource(TAMBON_SOURCE_ID)) {
        map.setFeatureState(
          { source: TAMBON_SOURCE_ID, id: hoveredIdRef.current },
          { hover: false },
        );
        hoveredIdRef.current = null;
        onHoverRef.current?.(null);
      }
    } catch {
      // ignore if style transition in progress
    }
  }, [map, isLoaded, visible]);

  useEffect(() => {
    if (!map || !isLoaded || selectedTambonId !== null) return;
    if (selectedIdRef.current !== null && map.getSource(TAMBON_SOURCE_ID)) {
      try {
        map.setFeatureState(
          { source: TAMBON_SOURCE_ID, id: selectedIdRef.current },
          { selected: false },
        );
      } catch {
        // ignore
      }
      selectedIdRef.current = null;
    }
  }, [map, isLoaded, selectedTambonId]);

  return null;
}
