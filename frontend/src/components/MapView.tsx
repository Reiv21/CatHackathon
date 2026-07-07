import { useState, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import L from "leaflet";
import { useShelters } from "../hooks/useShelters";
import { useShelterCats } from "../hooks/useShelterCats";
import { ShelterPin } from "./ShelterPin";
import { CatCard } from "./CatCard";
import { NearestShelter } from "./NearestShelter";
import { UserLocation } from "./UserLocation";
import { MapPersist } from "./MapPersist";
import { useI18n } from "../i18n";
import type { ShelterResponse } from "../types";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icons for retina displays
L.Icon.Default.mergeOptions({
  iconUrl: "/marker-icon.png",
  iconRetinaUrl: "/marker-icon-2x.png",
  shadowUrl: "/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export function MapView() {
  const { t, lang } = useI18n();
  const { data: shelters, loading, error, retry } = useShelters();
  const [selectedShelter, setSelectedShelter] = useState<ShelterResponse | null>(null);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showStrays, setShowStrays] = useState(false);
  const [strays, setStrays] = useState<Array<{ id: number; latitude: number; longitude: number; description: string; city: string; reported_at: string; image_url: string | null }>>([]);
  const [showLostCats, setShowLostCats] = useState(false);
  const [lostCats, setLostCats] = useState<Array<{ id: number; name: string; latitude: number; longitude: number; description: string; city: string; reported_at: string; image_url: string | null }>>([]);
  const { data: shelterCats, loading: catsLoading } = useShelterCats(
    selectedShelter?.id_zewnetrzne ?? null
  );

  useEffect(() => {
    if (showStrays) {
      fetch("/api/strays").then(r => r.json()).then(setStrays).catch(() => {});
    }
  }, [showStrays]);

  useEffect(() => {
    if (showLostCats) {
      fetch("/api/lost-cats").then(r => r.json()).then(setLostCats).catch(() => {});
    }
  }, [showLostCats]);

  return (
    <div className="flex flex-col md:flex-row h-full">
      <div className="relative flex-1 min-h-[50vh] md:min-h-0">
        {loading && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-[1000]">
            <div className="text-center">
              <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-gray-500">{t.loadingShelters}</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-[1000]" role="alert" aria-live="assertive">
            <div className="text-center">
              <p className="text-red-500 mb-3">{t.failedMap}</p>
              <button onClick={retry} className="px-4 py-2 bg-primary-600 text-white rounded-lg">{t.retry}</button>
            </div>
          </div>
        )}
        <MapContainer center={[52.0, 19.0]} zoom={6} className="w-full h-full">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <UserLocation />
          <MapPersist />
          {showStrays && strays.filter(s => s.latitude && s.longitude && !(s.latitude === 0 && s.longitude === 0)).map((s) => (
            <CircleMarker key={s.id} center={[s.latitude, s.longitude]} radius={8}
              pathOptions={{ color: "#e94560", fillColor: "#e94560", fillOpacity: 0.7 }}>
              <Popup>
                <div className="text-sm max-w-[200px]">
                  {s.image_url && <img src={s.image_url} alt="" className="w-full h-24 object-cover rounded mb-2" />}
                  <p className="font-bold">{t.strayReported}</p>
                  <p className="text-gray-600">{s.description || s.city}</p>
                  <p className="text-xs text-gray-500">{new Date(s.reported_at).toLocaleDateString()}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {showLostCats && lostCats.filter(c => c.latitude && c.longitude && !(c.latitude === 0 && c.longitude === 0)).map((c) => (
            <CircleMarker key={`lost-${c.id}`} center={[c.latitude, c.longitude]} radius={8}
              pathOptions={{ color: "#eab308", fillColor: "#eab308", fillOpacity: 0.7 }}>
              <Popup>
                <div className="text-sm max-w-[200px]">
                  {c.image_url && <img src={c.image_url} alt="" className="w-full h-24 object-cover rounded mb-2" />}
                  <p className="font-bold">{c.name || t.lostCatReported}</p>
                  <p className="text-gray-600">{c.description || c.city}</p>
                  <p className="text-xs text-gray-500">{new Date(c.reported_at).toLocaleDateString()}</p>
                </div>
              </Popup>
            </CircleMarker>
          ))}
          {shelters?.map((shelter) => (
            <ShelterPin key={shelter.id_zewnetrzne} shelter={shelter} onSelect={() => setSelectedShelter(shelter)} />
          ))}
        </MapContainer>
      </div>

      <div className={`${sidebarExpanded ? "fixed inset-0 z-[2000] md:relative md:inset-auto md:z-auto md:w-80 lg:w-96 md:max-h-none md:h-full" : "w-full md:w-80 lg:w-96 max-h-[50vh] md:max-h-none md:h-full"} bg-white border-t md:border-t-0 md:border-l border-cat-sand overflow-y-auto p-4`}>
        {/* Expand/collapse button — mobile only */}
        {selectedShelter && shelterCats && shelterCats.length > 0 && (
          <button
            onClick={() => setSidebarExpanded(!sidebarExpanded)}
            aria-label={sidebarExpanded ? (lang === "pl" ? "Zwiń panel" : "Minimize panel") : (lang === "pl" ? "Rozwiń panel" : "Expand panel")}
            className="mb-2 text-xs text-primary-600 hover:text-primary-700 font-medium md:hidden"
          >
            {sidebarExpanded ? (lang === "pl" ? "↙ Zwiń" : "↙ Minimize") : (lang === "pl" ? "↗ Rozwiń" : "↗ Expand")}
          </button>
        )}
        {/* Stray toggle */}
        <button onClick={() => setShowStrays(!showStrays)}
          className={`w-full mb-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${showStrays ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
          🐱 {showStrays ? t.hideStrays : t.showStrays}
        </button>

        {/* Lost cats toggle */}
        <button onClick={() => setShowLostCats(!showLostCats)}
          className={`w-full mb-3 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${showLostCats ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}`}>
          🔍 {showLostCats ? t.hideLostCats : t.showLostCats}
        </button>

        {showStrays && strays.length > 0 && (
          <div className="mb-4 space-y-2 max-h-48 overflow-y-auto">
            {strays.map((s) => (
              <div key={s.id} className="bg-red-50 border border-red-200 rounded-lg p-2 text-xs">
                <p className="font-medium">{s.city || "?"} • {new Date(s.reported_at).toLocaleDateString()}</p>
                {s.description && <p className="text-gray-600 truncate">{s.description}</p>}
              </div>
            ))}
          </div>
        )}

        {shelters && !selectedShelter && (
          <NearestShelter shelters={shelters} onSelect={setSelectedShelter} />
        )}

        {!selectedShelter && (
          <div className="text-center text-gray-500 py-6">
            <p className="text-sm">{t.clickShelter}</p>
          </div>
        )}

        {/* Text-based shelter list alternative for accessibility */}
        {shelters && !selectedShelter && shelters.length > 0 && (
          <details className="mt-4 border-t border-cat-sand pt-3">
            <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700 font-medium">
              {lang === "pl" ? "📋 Lista schronisk (tekst)" : "📋 Shelter list (text)"}
            </summary>
            <ul className="mt-2 space-y-1 max-h-60 overflow-y-auto text-xs text-gray-600" role="list">
              {shelters.map((s) => (
                <li key={s.id_zewnetrzne}>
                  <button
                    onClick={() => setSelectedShelter(s)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                  >
                    <span className="font-medium">{s.name}</span> – {s.city}, {s.voivodeship}
                    {s.cat_count > 0 && <span className="text-primary-600 ml-1">({s.cat_count} 🐱)</span>}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        )}

        {selectedShelter && (
          <div>
            <button onClick={() => setSelectedShelter(null)} aria-label={lang === "pl" ? "Powrót do mapy" : "Back to map"} className="text-sm text-primary-600 hover:text-primary-700 mb-3">
              {t.backToMap}
            </button>
            <h3 className="font-display font-bold text-lg mb-1">{selectedShelter.name}</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedShelter.city}, {selectedShelter.voivodeship}</p>

            {catsLoading && (
              <div className="text-center py-8">
                <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto" />
              </div>
            )}

            {!catsLoading && shelterCats && shelterCats.length > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-xs text-gray-500">{shelterCats.length} {t.catsAvailable}</p>
                {shelterCats.map((cat) => <CatCard key={cat.id} cat={cat} />)}
              </div>
            )}

            {!catsLoading && shelterCats && shelterCats.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-3xl mb-3">🐾</div>
                <p className="text-sm">{t.noCatsListed}</p>
                <p className="text-xs mt-2 text-gray-400">{t.notAllShelters}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
