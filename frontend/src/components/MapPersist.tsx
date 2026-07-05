import { useEffect } from "react";
import { useMap } from "react-leaflet";

const STORAGE_KEY = "map-view";

interface SavedView {
  lat: number;
  lng: number;
  zoom: number;
}

export function MapPersist() {
  const map = useMap();

  // Restore saved view on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { lat, lng, zoom } = JSON.parse(saved) as SavedView;
        map.setView([lat, lng], zoom);
      }
    } catch {}
  }, [map]);

  // Save view on move/zoom
  useEffect(() => {
    const save = () => {
      const center = map.getCenter();
      const zoom = map.getZoom();
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ lat: center.lat, lng: center.lng, zoom }));
    };
    map.on("moveend", save);
    map.on("zoomend", save);
    return () => {
      map.off("moveend", save);
      map.off("zoomend", save);
    };
  }, [map]);

  return null;
}
