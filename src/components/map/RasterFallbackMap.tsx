"use client";

import { useEffect, useRef, useState } from "react";
import type { LayerGroup, Map as LeafletMap, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import { DEFAULT_MAP_VIEW, type CityViewport, type ComplaintReport } from "@/data/map-data";

interface Props {
  targetCity: CityViewport | null;
  reports: ComplaintReport[];
  isReportMode: boolean;
  onChooseCoordinates: (coordinates: [number, number]) => void;
  onSelectReport: (report: ComplaintReport) => void;
  onUnavailable: () => void;
}

export function RasterFallbackMap({ targetCity, reports, isReportMode, onChooseCoordinates, onSelectReport, onUnavailable }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<{ instance: LeafletMap; leaflet: typeof import("leaflet") }>();

  useEffect(() => {
    let stopped = false;
    let instance: LeafletMap | undefined;
    let tiles: TileLayer | undefined;
    let tileLoaded = false;
    const timeout = window.setTimeout(() => {
      if (!tileLoaded) onUnavailable();
    }, 12000);

    void import("leaflet").then((leaflet) => {
      if (stopped || !container.current) return;
      const [lng, lat] = DEFAULT_MAP_VIEW.center;
      instance = leaflet.map(container.current, { scrollWheelZoom: true, zoomControl: false })
        .setView([lat, lng], DEFAULT_MAP_VIEW.zoom);
      leaflet.control.zoom({ position: "topright" }).addTo(instance);
      tiles = leaflet.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxNativeZoom: 19, maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      }).on("tileload", () => {
        tileLoaded = true;
        window.clearTimeout(timeout);
      }).addTo(instance);
      setMap({ instance, leaflet });
    }).catch(() => { if (!stopped) onUnavailable(); });

    return () => {
      stopped = true;
      window.clearTimeout(timeout);
      tiles?.off();
      instance?.remove();
    };
  }, [onUnavailable]);

  useEffect(() => {
    if (!map || !targetCity) return;
    const [lng, lat] = targetCity.center;
    map.instance.setView([lat, lng], Math.round(targetCity.zoom));
  }, [map, targetCity]);

  useEffect(() => {
    if (!map || !isReportMode) return;
    const choose = ({ latlng }: { latlng: { lat: number; lng: number } }) => {
      const { lat, lng } = map.instance.wrapLatLng(latlng);
      onChooseCoordinates([lng, lat]);
    };
    map.instance.on("click", choose);
    return () => { map.instance.off("click", choose); };
  }, [map, isReportMode, onChooseCoordinates]);

  useEffect(() => {
    if (!map) return;
    const markers: LayerGroup = map.leaflet.layerGroup().addTo(map.instance);
    for (const report of reports) {
      const [lng, lat] = report.coordinates;
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
      map.leaflet.marker([lat, lng], {
        title: report.title,
        icon: map.leaflet.divIcon({
          className: "",
          html: '<span class="block size-5 rounded-full border-2 border-white bg-sky-700 shadow-md"></span>',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
        }),
      }).on("click", () => onSelectReport(report)).addTo(markers);
    }
    return () => { markers.remove(); };
  }, [map, reports, onSelectReport]);

  return <div ref={container} aria-label="แผนที่สำรองแบบ 2 มิติ"
    className="absolute inset-0 isolate bg-slate-200 [&_.leaflet-top]:top-24" />;
}
