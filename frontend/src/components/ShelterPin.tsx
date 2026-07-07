import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import type { ShelterResponse } from "../types";
import { useI18n } from "../i18n";

const shelterIcon = new L.Icon({
  iconUrl: "/marker-shelter.svg",
  iconSize: [25, 36],
  iconAnchor: [12, 36],
  popupAnchor: [1, -34],
  // No shadow for SVG markers
});

interface ShelterPinProps {
  shelter: ShelterResponse;
  onSelect: () => void;
}

export function ShelterPin({ shelter, onSelect }: ShelterPinProps) {
  const { lang } = useI18n();
  if (shelter.latitude === null || shelter.longitude === null) return null;

  const markerTitle = `${shelter.name} – ${shelter.city}${shelter.cat_count > 0 ? ` (${shelter.cat_count} ${lang === "pl" ? "kotów" : "cats"})` : ""}`;

  return (
    <Marker
      position={[shelter.latitude, shelter.longitude]}
      icon={shelterIcon}
      eventHandlers={{ click: onSelect }}
      title={markerTitle}
      alt={markerTitle}
    >
      <Popup>
        <div className="text-sm">
          <p className="font-bold">{shelter.name}</p>
          <p className="text-gray-600">{shelter.city}, {shelter.voivodeship}</p>
          {shelter.cat_count > 0 && (
            <p className="mt-1 font-medium text-primary-600">
              🐱 {shelter.cat_count} {lang === "pl" ? "kotów" : "cats"}
            </p>
          )}
        </div>
      </Popup>
    </Marker>
  );
}
