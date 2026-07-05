import { useEffect, useState } from "react";
import { useMap, CircleMarker, Popup } from "react-leaflet";
import { useI18n } from "../i18n";

export function UserLocation() {
  const { t } = useI18n();
  const map = useMap();
  const [position, setPosition] = useState<[number, number] | null>(null);

  useEffect(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        setPosition(coords);
        map.setView(coords, 9); // zoom 9 = shows ~50km radius, good for seeing nearby shelters
      },
      () => {
        // silently fail — keep default Poland view
      }
    );
  }, [map]);

  if (!position) return null;

  return (
    <CircleMarker
      center={position}
      radius={10}
      pathOptions={{ color: "#e06050", fillColor: "#e06050", fillOpacity: 0.7, weight: 2 }}
    >
      <Popup>
        <p className="text-sm font-medium">{t.youAreHere}</p>
      </Popup>
    </CircleMarker>
  );
}
