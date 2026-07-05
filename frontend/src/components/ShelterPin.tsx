import { Marker, Popup } from "react-leaflet";
import type { ShelterResponse } from "../types";
import { useI18n } from "../i18n";

interface ShelterPinProps {
  shelter: ShelterResponse;
  onSelect: () => void;
}

export function ShelterPin({ shelter, onSelect }: ShelterPinProps) {
  const { lang } = useI18n();
  if (shelter.latitude === null || shelter.longitude === null) return null;

  return (
    <Marker position={[shelter.latitude, shelter.longitude]} eventHandlers={{ click: onSelect }}>
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
