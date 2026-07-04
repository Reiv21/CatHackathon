import { MapContainer, TileLayer } from "react-leaflet";
import { useShelters } from "../hooks/useShelters";
import { ShelterPin } from "./ShelterPin";
import "leaflet/dist/leaflet.css";

export function MapView() {
  const { data: shelters, loading, error, retry } = useShelters();

  return (
    <div className="relative w-full h-full">
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-500">Ładuję mapę schronisk...</p>
          </div>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 bg-white/90 flex items-center justify-center z-[1000]">
          <div className="text-center">
            <p className="text-red-500 mb-3">Nie udało się załadować mapy</p>
            <button onClick={retry} className="px-4 py-2 bg-primary-600 text-white rounded-lg">Spróbuj ponownie</button>
          </div>
        </div>
      )}
      <MapContainer
        center={[52.0, 19.0]}
        zoom={6}
        className="w-full h-full"
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {shelters?.map((shelter) => (
          <ShelterPin key={shelter.id_zewnetrzne} shelter={shelter} />
        ))}
      </MapContainer>
    </div>
  );
}
