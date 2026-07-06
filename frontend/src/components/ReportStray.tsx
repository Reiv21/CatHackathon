import { useState } from "react";
import { useI18n } from "../i18n";

const CITIES = [
  "Białystok", "Bełchatów", "Bielsko-Biała", "Bydgoszcz", "Bytom",
  "Celestynów", "Chorzów", "Częstochowa", "Gdańsk", "Gdynia",
  "Gliwice", "Katowice", "Kielce", "Konin", "Koszalin", "Kraków",
  "Legnica", "Lublin", "Łódź", "Mielec", "Nowy Dwór Mazowiecki",
  "Olsztyn", "Opole", "Oświęcim", "Poznań", "Przemyśl", "Puławy",
  "Racibórz", "Radom", "Rzeszów", "Skierniewice", "Sosnowiec",
  "Szczecin", "Tarnów", "Toruń", "Warszawa", "Wrocław",
  "Zabrze", "Zielona Góra", "Żyrardów", "Żywiec",
].sort();

export function ReportStray() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ description: "", image_url: "", city: "", address: "" });
  const [gps, setGps] = useState<{ lat: string; lng: string } | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [locating, setLocating] = useState(false);

  const getLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: String(pos.coords.latitude), lng: String(pos.coords.longitude) });
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city) {
      alert(lang === "pl" ? "Wybierz miasto" : "Select a city");
      return;
    }
    setStatus("sending");
    try {
      const body = {
        description: form.description,
        image_url: form.image_url,
        city: form.city,
        address: form.address,
        latitude: gps?.lat || "0",
        longitude: gps?.lng || "0",
      };
      const res = await fetch("/api/report-stray", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Error");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch { setStatus("error"); }
  };

  if (status === "sent") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-display font-bold mb-2">{t.reportThanks}</h2>
        <p className="text-gray-500">{t.reportThanksSub}</p>
        <button onClick={() => { setStatus("idle"); setForm({ description: "", image_url: "", city: "", address: "" }); setGps(null); }}
          className="mt-6 text-primary-600 font-medium">↩</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold mb-2">{t.reportStrayTitle}</h1>
      <p className="text-gray-500 text-sm mb-6">{t.reportStraySubtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* City select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{lang === "pl" ? "Miasto *" : "City *"}</label>
          <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200">
            <option value="">{lang === "pl" ? "— Wybierz miasto —" : "— Select city —"}</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Address / details */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {lang === "pl" ? "Adres / okolica (opcjonalnie)" : "Address / area (optional)"}
          </label>
          <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={lang === "pl" ? "np. ul. Kościuszki, park przy..." : "e.g. Main Street, park near..."}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.strayDesc}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>

        {/* Image upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {lang === "pl" ? "Zdjęcie kota (opcjonalnie)" : "Cat photo (optional)"}
          </label>
          <input type="file" accept="image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 5 * 1024 * 1024) {
                alert(lang === "pl" ? "Maks. 5MB" : "Max 5MB");
                return;
              }
              const reader = new FileReader();
              reader.onload = () => setForm({ ...form, image_url: reader.result as string });
              reader.readAsDataURL(file);
            }}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200 file:mr-3 file:rounded-lg file:border-0 file:bg-primary-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-primary-700" />
          {form.image_url && (
            <img src={form.image_url} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
          )}
        </div>

        {/* GPS (optional, for map pin) */}
        <div className="bg-gray-50 rounded-xl p-3">
          <p className="text-xs text-gray-500 mb-2">
            {lang === "pl"
              ? "📍 Opcjonalnie: udostępnij dokładną lokalizację, aby kot pojawił się na mapie"
              : "📍 Optional: share exact location to show the cat on the map"}
          </p>
          <button type="button" onClick={getLocation} disabled={locating}
            className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium disabled:opacity-50">
            📍 {locating ? "..." : t.useMyLocation}
          </button>
          {gps && <p className="text-xs text-green-600 mt-2">✓ {lang === "pl" ? "Lokalizacja pobrana" : "Location captured"} ({parseFloat(gps.lat).toFixed(3)}, {parseFloat(gps.lng).toFixed(3)})</p>}
        </div>

        <button type="submit" disabled={status === "sending"}
          className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 disabled:opacity-50">
          {status === "sending" ? t.reportSending : t.reportSubmit}
        </button>
        {status === "error" && <p className="text-red-500 text-sm">{t.somethingWrong}</p>}
      </form>
    </div>
  );
}
