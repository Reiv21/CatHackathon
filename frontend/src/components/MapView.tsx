import { MapContainer, TileLayer } from "react-leaflet";
import { useShelters } from "../hooks/useShelters";
import { ShelterPin } from "./ShelterPin";
import { LoadingOverlay } from "./LoadingOverlay";
import { ErrorMessage } from "./ErrorMessage";
import "leaflet/dist/leaflet.css";

export function MapView() {
  const { data: shelters, loading, error, retry } = useShelters();

  return (
    <div className="relative w-full h-full min-h-[400px]">
      {loading && <LoadingOverlay />}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center z-[1000] bg-tactical-bg/80">
          <ErrorMessage message="Could not load shelter locations" onRetry={retry} />
        </div>
      )}
      <MapContainer
        center={[52.0, 19.0]}
        zoom={6}
        className="w-full h-full"
        style={{ background: "#0d0d1a" }}
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
