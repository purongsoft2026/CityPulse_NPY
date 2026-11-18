"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import { useMap } from "@/components/ui/map";

const GISTDA_FLOOD_SOURCE_ID = "gistda-flood-geojson-source";
const GISTDA_FLOOD_FILL_ID = "gistda-flood-geojson-fill";
const GISTDA_FLOOD_LINE_ID = "gistda-flood-geojson-line";
const GISTDA_WMS_SOURCE_ID = "gistda-dragonfly-wms-source";
const GISTDA_WMS_LAYER_ID = "gistda-dragonfly-wms-layer";

interface GistdaFloodLayerProps {
  visible: boolean;
  showWmsWarn?: boolean;
  featureCollection: GeoJSON.FeatureCollection | null;
  isDark?: boolean;
}

const EMPTY_COLLECTION: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function GistdaFloodLayer({
  visible,
  showWmsWarn = false,
  featureCollection,
  isDark = false,
}: GistdaFloodLayerProps) {
  const { map, isLoaded } = useMap();
  const popupRef = useRef<maplibregl.Popup | null>(null);

  useEffect(() => {
    if (!map || !isLoaded) return;

    if (!map.getSource(GISTDA_WMS_SOURCE_ID)) {
      map.addSource(GISTDA_WMS_SOURCE_ID, {
        type: "raster",
        tiles: [
          "/api/gistda/wms?bbox={bbox-epsg-3857}&width=256&height=256&layers=flood_warn",
        ],
        tileSize: 256,
      });
    }

    if (!map.getLayer(GISTDA_WMS_LAYER_ID)) {
      map.addLayer({
        id: GISTDA_WMS_LAYER_ID,
        type: "raster",
        source: GISTDA_WMS_SOURCE_ID,
        layout: {
          visibility: showWmsWarn ? "visible" : "none",
        },
        paint: {
          "raster-opacity": isDark ? 0.65 : 0.55,
        },
      });
    } else {
      map.setLayoutProperty(
        GISTDA_WMS_LAYER_ID,
        "visibility",
        showWmsWarn ? "visible" : "none",
      );
      map.setPaintProperty(
        GISTDA_WMS_LAYER_ID,
        "raster-opacity",
        isDark ? 0.65 : 0.55,
      );
    }
  }, [map, isLoaded, showWmsWarn, isDark]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const data = visible && featureCollection ? featureCollection : EMPTY_COLLECTION;

    if (!map.getSource(GISTDA_FLOOD_SOURCE_ID)) {
      map.addSource(GISTDA_FLOOD_SOURCE_ID, {
        type: "geojson",
        data,
      });
    } else {
      const src = map.getSource(GISTDA_FLOOD_SOURCE_ID) as maplibregl.GeoJSONSource | undefined;
      src?.setData(data);
    }

    if (!map.getLayer(GISTDA_FLOOD_FILL_ID)) {
      map.addLayer({
        id: GISTDA_FLOOD_FILL_ID,
        type: "fill",
        source: GISTDA_FLOOD_SOURCE_ID,
        layout: {
          visibility: visible ? "visible" : "none",
        },
        paint: {
          "fill-color": isDark ? "#06b6d4" : "#0284c7",
          "fill-opacity": isDark ? 0.34 : 0.28,
        },
      });
    } else {
      map.setLayoutProperty(GISTDA_FLOOD_FILL_ID, "visibility", visible ? "visible" : "none");
      map.setPaintProperty(GISTDA_FLOOD_FILL_ID, "fill-color", isDark ? "#06b6d4" : "#0284c7");
      map.setPaintProperty(GISTDA_FLOOD_FILL_ID, "fill-opacity", isDark ? 0.34 : 0.28);
    }

    if (!map.getLayer(GISTDA_FLOOD_LINE_ID)) {
      map.addLayer({
        id: GISTDA_FLOOD_LINE_ID,
        type: "line",
        source: GISTDA_FLOOD_SOURCE_ID,
        layout: {
          visibility: visible ? "visible" : "none",
        },
        paint: {
          "line-color": isDark ? "#67e8f9" : "#0369a1",
          "line-width": 1.6,
          "line-opacity": 0.8,
        },
      });
    } else {
      map.setLayoutProperty(GISTDA_FLOOD_LINE_ID, "visibility", visible ? "visible" : "none");
      map.setPaintProperty(GISTDA_FLOOD_LINE_ID, "line-color", isDark ? "#67e8f9" : "#0369a1");
    }
  }, [map, isLoaded, visible, featureCollection, isDark]);

  useEffect(() => {
    if (!map || !isLoaded) return;

    const handleEnter = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const handleLeave = () => {
      map.getCanvas().style.cursor = "";
    };
    const handleClick = (e: maplibregl.MapLayerMouseEvent) => {
      const feature = e.features?.[0];
      if (!feature) return;
      const props = (feature.properties ?? {}) as Record<string, unknown>;
      const areaLabel =
        typeof props.__areaLabel === "string" && props.__areaLabel
          ? props.__areaLabel
          : "พื้นที่น้ำท่วม (GISTDA)";
      const updatedAt =
        typeof props.__updatedAt === "string" && props.__updatedAt ? props.__updatedAt : "";
      const areaRai = Number(props.__areaRai);
      const freq = Number(props.__freq);
      const fileName =
        typeof props.__fileName === "string" && props.__fileName ? props.__fileName : "";

      popupRef.current?.remove();
      const container = document.createElement("div");
      container.className = "p-2.5 text-xs space-y-1 max-w-[240px]";

      const badge = document.createElement("div");
      badge.className = "text-[10px] font-black uppercase tracking-wider text-sky-600";
      badge.textContent = "GISTDA Disaster Open API";
      container.appendChild(badge);

      const title = document.createElement("div");
      title.className = "font-bold text-slate-900 leading-snug";
      title.textContent = areaLabel;
      container.appendChild(title);

      if (Number.isFinite(areaRai) && areaRai > 0) {
        const areaLine = document.createElement("div");
        areaLine.className = "text-[11px] text-slate-600";
        areaLine.textContent = `พื้นที่ประมาณ ${areaRai.toLocaleString("th-TH")} ไร่`;
        container.appendChild(areaLine);
      }

      if (Number.isFinite(freq) && freq > 0) {
        const freqLine = document.createElement("div");
        freqLine.className = "text-[11px] font-semibold text-indigo-700";
        freqLine.textContent = `ความถี่น้ำท่วมซ้ำซาก: ${freq} ครั้ง/ปี`;
        container.appendChild(freqLine);
      }

      if (updatedAt || fileName) {
        const dateLine = document.createElement("div");
        dateLine.className = "text-[10px] text-slate-500 font-mono";
        dateLine.textContent = [
          updatedAt ? `อัปเดต: ${updatedAt}` : "",
          fileName ? `(${fileName})` : "",
        ]
          .filter(Boolean)
          .join(" ");
        container.appendChild(dateLine);
      }

      popupRef.current = new maplibregl.Popup({ closeButton: true, offset: 8 })
        .setLngLat(e.lngLat)
        .setDOMContent(container)
        .addTo(map);
    };

    map.on("mouseenter", GISTDA_FLOOD_FILL_ID, handleEnter);
    map.on("mouseleave", GISTDA_FLOOD_FILL_ID, handleLeave);
    map.on("click", GISTDA_FLOOD_FILL_ID, handleClick);

    return () => {
      map.off("mouseenter", GISTDA_FLOOD_FILL_ID, handleEnter);
      map.off("mouseleave", GISTDA_FLOOD_FILL_ID, handleLeave);
      map.off("click", GISTDA_FLOOD_FILL_ID, handleClick);
      popupRef.current?.remove();
    };
  }, [map, isLoaded]);

  useEffect(() => {
    return () => {
      popupRef.current?.remove();
      if (!map) return;
      try {
        if (map.getLayer(GISTDA_WMS_LAYER_ID)) map.removeLayer(GISTDA_WMS_LAYER_ID);
        if (map.getSource(GISTDA_WMS_SOURCE_ID)) map.removeSource(GISTDA_WMS_SOURCE_ID);
        if (map.getLayer(GISTDA_FLOOD_LINE_ID)) map.removeLayer(GISTDA_FLOOD_LINE_ID);
        if (map.getLayer(GISTDA_FLOOD_FILL_ID)) map.removeLayer(GISTDA_FLOOD_FILL_ID);
        if (map.getSource(GISTDA_FLOOD_SOURCE_ID)) map.removeSource(GISTDA_FLOOD_SOURCE_ID);
      } catch {
        // map may already be destroyed
      }
    };
  }, [map]);

  return null;
}
