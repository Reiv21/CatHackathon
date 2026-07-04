import { Marker, Popup } from "react-leaflet";
import type { ShelterResponse } from "../types";

interface ShelterPinProps {
  shelter: ShelterResponse;
}

export function ShelterPin({ shelter }: ShelterPinProps) {
  // Skip shelters without coordinates
  if (shelter.latitude === null || shelter.longitude === null) {
    return null;
  }

  return (
    <Marker position={[shelter.latitude, shelter.longitude]}>
      <Popup>
        <div className="font-mono text-gray-900">
          <p className="font-bold text-sm">{shelter.name}</p>
          <p className="text-xs text-gray-600">
            {shelter.city}, {shelter.voivodeship}
          </p>
          <p className="text-xs mt-1">
            <span className="font-bold">{shelter.cat_count}</span> agents stationed
          </p>
        </div>
      </Popup>
    </Marker>
  );
}
