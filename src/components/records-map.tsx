"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { GeoJSONSource, MapLayerMouseEvent, Map as MlMap } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { GeocodeStatus } from "@/lib/geocode/types";

// OpenFreeMap: free OpenStreetMap vector tiles, no API key. Attribution is added by MapLibre.
const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

export const STATUS_COLORS: Record<GeocodeStatus, string> = {
  high: "#047857",
  medium: "#2563eb",
  postcode: "#d97706",
  failed: "#b91c1c",
  pending: "#94a3b8",
};

export const STATUS_LABELS: Record<GeocodeStatus, string> = {
  high: "Exact",
  medium: "Approximate",
  postcode: "Postcode centre",
  failed: "Not found",
  pending: "Waiting",
};

export type MapRecord = {
  id: number;
  name: string | null;
  lat: number | null;
  lng: number | null;
  geocode_status: GeocodeStatus;
  category: string | null;
  owner: string | null;
};

function toGeoJson(records: MapRecord[]): GeoJSON.FeatureCollection<GeoJSON.Point> {
  return {
    type: "FeatureCollection",
    features: records.flatMap((r) =>
      r.lat === null || r.lng === null
        ? []
        : [
            {
              type: "Feature" as const,
              id: r.id,
              geometry: { type: "Point" as const, coordinates: [r.lng, r.lat] },
              properties: { name: r.name ?? "", status: r.geocode_status, category: r.category ?? "", owner: r.owner ?? "" },
            },
          ],
    ),
  };
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function RecordsMap({ records }: { records: MapRecord[] }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const fitted = useRef(false);
  const latest = useRef(records);
  latest.current = records;

  useEffect(() => {
    let disposed = false;
    void import("maplibre-gl").then((maplibregl) => {
      if (disposed || !container.current) return;
      const m = new maplibregl.Map({ container: container.current, style: STYLE_URL, center: [-40, 45], zoom: 2 });
      m.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.current = m;

      m.on("load", () => {
        m.addSource("records", { type: "geojson", data: toGeoJson(latest.current), cluster: true, clusterRadius: 40, clusterMaxZoom: 9 });
        m.addLayer({
          id: "clusters",
          type: "circle",
          source: "records",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0f172a",
            "circle-opacity": 0.75,
            "circle-radius": ["step", ["get", "point_count"], 14, 50, 20, 500, 28],
          },
        });
        m.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "records",
          filter: ["has", "point_count"],
          layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12, "text-font": ["Noto Sans Regular"] },
          paint: { "text-color": "#ffffff" },
        });
        m.addLayer({
          id: "points",
          type: "circle",
          source: "records",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-radius": 6,
            "circle-color": ["match", ["get", "status"], ...Object.entries(STATUS_COLORS).flat(), "#94a3b8"] as never,
            "circle-stroke-width": 1.5,
            "circle-stroke-color": "#ffffff",
          },
        });

        m.on("click", "clusters", async (e: MapLayerMouseEvent) => {
          const feature = e.features?.[0];
          if (!feature) return;
          const source = m.getSource("records") as GeoJSONSource;
          const zoom = await source.getClusterExpansionZoom(feature.properties.cluster_id);
          m.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
        m.on("click", "points", (e: MapLayerMouseEvent) => {
          const f = e.features?.[0];
          if (!f) return;
          const p = f.properties as { name: string; status: GeocodeStatus; category: string; owner: string };
          const lines = [
            `<strong>${escapeHtml(p.name || "Unnamed")}</strong>`,
            p.category && escapeHtml(p.category),
            p.owner && `Owner: ${escapeHtml(p.owner)}`,
            `Location: ${STATUS_LABELS[p.status]}`,
          ].filter(Boolean);
          new maplibregl.Popup({ offset: 8 })
            .setLngLat((f.geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(lines.join("<br>"))
            .addTo(m);
        });
        for (const layer of ["clusters", "points"]) {
          m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
          m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
        }
        update(m, latest.current);
      });
    });
    return () => {
      disposed = true;
      map.current?.remove();
      map.current = null;
    };
  }, []);

  function update(m: MlMap, recs: MapRecord[]) {
    const source = m.getSource("records") as GeoJSONSource | undefined;
    if (!source) return;
    const data = toGeoJson(recs);
    source.setData(data);
    if (!fitted.current && data.features.length) {
      let [minX, minY, maxX, maxY] = [180, 90, -180, -90];
      for (const f of data.features) {
        const [x, y] = f.geometry.coordinates;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
      m.fitBounds([minX, minY, maxX, maxY], { padding: 40, maxZoom: 12, duration: 0 });
      fitted.current = true;
    }
  }

  useEffect(() => {
    if (map.current?.loaded()) update(map.current, records);
  }, [records]);

  return <div ref={container} className="h-full min-h-[28rem] w-full" />;
}
