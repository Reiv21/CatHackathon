import { useState } from "react";
import type { ShelterResponse } from "../types";

interface NearestShelterProps {
  shelters: ShelterResponse[];
  onSelect: (shelter: ShelterResponse) => void;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Poland bounding box roughly
function isInPoland(lat: number, lon: number): boolean {
  return lat >= 49.0 && lat <= 54.9 && lon >= 14.1 && lon <= 24.2;
}

export function NearestShelter({ shelters, onSelect }: NearestShelterProps) {
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error" | "outside">("idle");
  const [results, setResults] = useState<{ shelter: ShelterResponse; distance: number }[]>([]);
  const [onlyWithCats, setOnlyWithCats] = useState(false);

  const findNearest = () => {
    setStatus("loading");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;

        if (!isInPoland(latitude, longitude)) {
          setStatus("outside");
          return;
        }

        let eligible = shelters.filter((s) => s.latitude !== null && s.longitude !== null);
        if (onlyWithCats) {
          eligible = eligible.filter((s) => s.cat_count > 0);
        }

        const sorted = eligible
          .map((s) => ({
            shelter: s,
            distance: haversineDistance(latitude, longitude, s.latitude!, s.longitude!),
          }))
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);

        setResults(sorted);
        setStatus("done");
      },
      () => setStatus("error")
    );
  };

  return (
    <div className="bg-white rounded-xl border border-cat-sand p-4 mb-4">
      <h3 className="font-semibold text-sm mb-3">📍 Find nearest shelter</h3>

      <div className="flex items-center gap-3 mb-3">
        <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyWithCats}
            onChange={(e) => setOnlyWithCats(e.target.checked)}
            className="rounded border-gray-300"
          />
          Only shelters with cats listed
        </label>
      </div>

      {status === "idle" && (
        <button onClick={findNearest} className="w-full px-4 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 transition-colors">
          Use my location
        </button>
      )}

      {status === "loading" && <p className="text-sm text-gray-400">Getting your location...</p>}
      {status === "error" && <p className="text-sm text-red-500">Location access denied. Enable it in browser settings.</p>}

      {status === "outside" && (
        <div className="text-center py-3">
          <p className="text-sm text-gray-600">😅 Looks like you're not in Poland!</p>
          <p className="text-xs text-gray-400 mt-1">This app covers Polish shelters only. But thanks for caring about cats!</p>
          <button onClick={() => setStatus("idle")} className="text-xs text-primary-600 mt-2">Try again</button>
        </div>
      )}

      {status === "done" && results.length > 0 && (
        <div className="space-y-2 mt-2">
          {results.map(({ shelter, distance }) => (
            <button
              key={shelter.id_zewnetrzne}
              onClick={() => onSelect(shelter)}
              className="w-full text-left p-2 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-cat-sand"
            >
              <p className="text-sm font-medium">{shelter.name}</p>
              <p className="text-xs text-gray-500">
                {shelter.city} • {Math.round(distance)} km away
                {shelter.cat_count > 0 && <span className="text-primary-600 ml-2">🐱 {shelter.cat_count} cats</span>}
              </p>
            </button>
          ))}
          <button onClick={() => setStatus("idle")} className="text-xs text-gray-400 mt-1">Search again</button>
        </div>
      )}
    </div>
  );
}
