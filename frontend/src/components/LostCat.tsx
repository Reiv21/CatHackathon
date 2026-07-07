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

export function LostCat() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({
    name: "",
    description: "",
    city: "",
    address: "",
    image_data: "" as string,
    contact: "",
  });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert(lang === "pl" ? "Maksymalny rozmiar: 2MB" : "Maximum file size: 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setForm((f) => ({ ...f, image_data: base64 }));
      setPreviewUrl(base64);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert(lang === "pl" ? "Podaj imię kota" : "Enter cat's name");
      return;
    }
    if (!form.city) {
      alert(lang === "pl" ? "Wybierz miasto" : "Select a city");
      return;
    }
    setStatus("sending");
    try {
      const res = await fetch("/api/report-lost-cat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          last_seen_city: form.city,
          last_seen_location: form.address,
          image_url: form.image_data || null,
          contact_info: form.contact,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.message || "Error");
        setStatus("idle");
        return;
      }
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  };

  if (status === "sent") {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-2xl font-display font-bold mb-2">{t.lostCatThanks}</h2>
        <button
          onClick={() => {
            setStatus("idle");
            setForm({ name: "", description: "", city: "", address: "", image_data: "", contact: "" });
          }}
          className="mt-6 text-primary-600 font-medium"
        >
          ↩
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold mb-2">{t.lostCatTitle}</h1>
      <p className="text-gray-500 text-sm mb-6">{t.lostCatSubtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Cat name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.catName} *</label>
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {lang === "pl" ? "Opis (kolor, cechy szczególne)" : "Description (color, distinctive features)"}
          </label>
          <textarea
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Last seen city */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.lastSeenCity} *</label>
          <select
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            required
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200"
          >
            <option value="">{lang === "pl" ? "— Wybierz miasto —" : "— Select city —"}</option>
            {CITIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Last seen address */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.lastSeenLocation}</label>
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder={lang === "pl" ? "np. ul. Kościuszki, park przy..." : "e.g. Main Street, park near..."}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {lang === "pl" ? "Zdjęcie kota (opcjonalnie, max 2MB)" : "Cat photo (optional, max 2MB)"}
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200 text-sm"
          />
          {previewUrl && (
            <img src={previewUrl} alt="Preview" className="mt-2 w-32 h-32 object-cover rounded-lg" />
          )}
        </div>

        {/* Contact info */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.contactInfo}</label>
          <input
            value={form.contact}
            onChange={(e) => setForm({ ...form, contact: e.target.value })}
            placeholder={lang === "pl" ? "Telefon lub email" : "Phone or email"}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>

        <button
          type="submit"
          disabled={status === "sending"}
          className="bg-primary-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-primary-700 disabled:opacity-50"
        >
          {status === "sending" ? t.sending : t.submit}
        </button>
        {status === "error" && <p className="text-red-500 text-sm">{t.somethingWrong}</p>}
      </form>
    </div>
  );
}
