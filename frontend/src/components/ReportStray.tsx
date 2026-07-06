import { useState } from "react";
import { useI18n } from "../i18n";

export function ReportStray() {
  const { t, lang } = useI18n();
  const [form, setForm] = useState({ description: "", image_url: "", latitude: "", longitude: "", city: "" });
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [locating, setLocating] = useState(false);

  const getLocation = () => {
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm({ ...form, latitude: String(pos.coords.latitude), longitude: String(pos.coords.longitude) });
        setLocating(false);
      },
      () => setLocating(false)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.latitude && !form.city) {
      alert(lang === "pl" ? "Podaj lokalizację lub miasto" : "Provide location or city");
      return;
    }
    setStatus("sending");
    try {
      const body = {
        ...form,
        latitude: form.latitude || "0",
        longitude: form.longitude || "0",
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
        <button onClick={() => { setStatus("idle"); setForm({ description: "", image_url: "", latitude: "", longitude: "", city: "" }); }}
          className="mt-6 text-primary-600 font-medium">↩</button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold mb-2">{t.reportStrayTitle}</h1>
      <p className="text-gray-500 text-sm mb-6">{t.reportStraySubtitle}</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.strayDesc}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
            rows={3} className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.strayImageUrl}</label>
          <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })}
            placeholder="https://..." className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
          <p className="text-xs text-gray-400 mt-1">
            {lang === "pl"
              ? "Wrzuć zdjęcie na imgur.com lub postimg.cc i wklej link. Nie przechowujemy zdjęć."
              : "Upload your photo to imgur.com or postimg.cc and paste the link. We don't store images."}
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.strayLocation} *</label>
          <div className="flex gap-2 mb-2">
            <button type="button" onClick={getLocation} disabled={locating}
              className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg text-sm font-medium disabled:opacity-50">
              📍 {locating ? "..." : t.useMyLocation}
            </button>
          </div>
          {form.latitude && <p className="text-xs text-gray-400">📍 {parseFloat(form.latitude).toFixed(4)}, {parseFloat(form.longitude).toFixed(4)}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.strayCity}</label>
          <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full border border-cat-sand rounded-xl px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-200" />
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
