import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";
import type { ShelterResponse } from "../types";

// Dynamically load leaflet.markercluster (UMD plugin needs L on window)
let clusterReady: Promise<void> | null = null;
function ensureMarkerCluster(): Promise<void> {
  if (clusterReady) return clusterReady;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).L = L;
  clusterReady = import("leaflet.markercluster/dist/leaflet.markercluster-src.js" as string).then(() => {
    // Also load CSS
    const link1 = document.createElement("link");
    link1.rel = "stylesheet";
    link1.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.css";
    document.head.appendChild(link1);
    const link2 = document.createElement("link");
    link2.rel = "stylesheet";
    link2.href = "https://unpkg.com/leaflet.markercluster@1.5.3/dist/MarkerCluster.Default.css";
    document.head.appendChild(link2);
  });
  return clusterReady;
}

interface MarkerClusterProps {
  shelters: ShelterResponse[];
  onSelect: (shelter: ShelterResponse) => void;
  lang: string;
}

export function MarkerCluster({ shelters, onSelect, lang }: MarkerClusterProps) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    let cancelled = false;

    ensureMarkerCluster().then(() => {
      if (cancelled) return;

      // Remove previous cluster if any
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
      }

      const clusterGroup = L.markerClusterGroup({
        maxClusterRadius: 50,
        spiderfyOnMaxZoom: true,
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        iconCreateFunction: (cluster: any) => {
          const count = cluster.getChildCount();
          let size: "small" | "medium" | "large" = "small";
          if (count >= 50) size = "large";
          else if (count >= 10) size = "medium";

          const sizeMap = { small: 36, medium: 44, large: 52 };
          const px = sizeMap[size];

          return L.divIcon({
            html: `<div style="
              width:${px}px;height:${px}px;
              display:flex;align-items:center;justify-content:center;
              border-radius:50%;
              background:rgba(59,130,246,0.8);
              color:white;font-weight:700;font-size:${size === "large" ? 16 : 13}px;
              border:3px solid rgba(255,255,255,0.9);
              box-shadow:0 2px 8px rgba(0,0,0,0.3);
            ">${count}</div>`,
            className: "custom-cluster-icon",
            iconSize: L.point(px, px),
          });
        },
      });

      const svgIcon = L.divIcon({
        html: `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="36" viewBox="0 0 25 36">
          <path d="M12.5 0C5.6 0 0 5.6 0 12.5c0 2.4.7 4.7 1.9 6.6L12.5 36l10.6-16.9c1.2-1.9 1.9-4.2 1.9-6.6C25 5.6 19.4 0 12.5 0z" fill="#2563eb"/>
          <circle cx="12.5" cy="12.5" r="5" fill="white"/>
        </svg>`,
        className: "svg-marker-icon",
        iconSize: [25, 36],
        iconAnchor: [12.5, 36],
        popupAnchor: [0, -36],
      });

      for (const shelter of shelters) {
        if (shelter.latitude === null || shelter.longitude === null) continue;

        const marker = L.marker([shelter.latitude, shelter.longitude], {
          icon: svgIcon,
          title: `${shelter.name} – ${shelter.city}`,
          alt: `${shelter.name} – ${shelter.city}`,
        });

        const popupContent = `
          <div style="font-size:13px;">
            <p style="font-weight:700;margin:0 0 2px;">${shelter.name}</p>
            <p style="color:#666;margin:0 0 4px;">${shelter.city}, ${shelter.voivodeship}</p>
            ${shelter.cat_count > 0 ? `<p style="color:#2563eb;font-weight:500;margin:0;">🐱 ${shelter.cat_count} ${lang === "pl" ? "kotów" : "cats"}</p>` : ""}
          </div>
        `;
        marker.bindPopup(popupContent);
        marker.on("click", () => onSelect(shelter));
        clusterGroup.addLayer(marker);
      }

      map.addLayer(clusterGroup);
      clusterRef.current = clusterGroup;
    });

    return () => {
      cancelled = true;
      if (clusterRef.current) {
        map.removeLayer(clusterRef.current);
        clusterRef.current = null;
      }
    };
  }, [map, shelters, onSelect, lang]);

  return null;
}
