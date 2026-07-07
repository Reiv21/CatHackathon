import { useState, useEffect } from "react";
import { useI18n } from "../i18n";
import { safeUrl } from "../safeUrl";

interface Suggestion {
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  submitter_email: string | null;
  submitted_at: string;
}

export function Admin() {
  const { lang } = useI18n();
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [strayReports, setStrayReports] = useState<Array<{ id: number; description: string; city: string; image_url: string | null; reported_at: string }>>([]);
  const [loading, setLoading] = useState(false);

  const deleteStray = async (id: number) => {
    await fetch(`/api/admin/strays/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setStrayReports(strayReports.filter((s) => s.id !== id));
  };

  const deleteSuggestion = async (index: number) => {
    await fetch(`/api/admin/suggestions/${index}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    setSuggestions(suggestions.filter((_, i) => i !== index));
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.message || "Login failed");
        return;
      }
      const data = await res.json();
      setToken(data.token);
    } catch {
      setError("Connection failed");
    }
  };

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/suggestions", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => setSuggestions(data))
      .catch(() => {})
      .finally(() => setLoading(false));

    // Also fetch stray reports
    fetch("/api/strays")
      .then((r) => r.json())
      .then((data) => setStrayReports(data))
      .catch(() => {});
  }, [token]);

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-display font-bold mb-6 text-center">
          {lang === "pl" ? "Panel administratora" : "Admin Login"}
        </h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={lang === "pl" ? "Hasło" : "Password"}
            className="border border-cat-sand rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <button type="submit" className="bg-cat-dark text-white rounded-xl px-6 py-3 font-semibold hover:opacity-90">
            {lang === "pl" ? "Zaloguj" : "Login"}
          </button>
          {error && <p className="text-red-500 text-sm text-center">{error}</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
        <button onClick={() => setToken(null)} className="text-sm text-gray-500 hover:text-gray-700">Logout</button>
      </div>

      <h2 className="text-lg font-semibold mb-4">Shelter Suggestions ({suggestions.length})</h2>

      {loading && <p className="text-gray-500">Loading...</p>}

      {suggestions.length === 0 && !loading && (
        <p className="text-gray-500 text-center py-8">No suggestions yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-white border border-cat-sand rounded-xl p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex justify-between">
                  <h3 className="font-semibold">{s.name}</h3>
                  <span className="text-xs text-gray-500">{new Date(s.submitted_at).toLocaleDateString()}</span>
                </div>
                <p className="text-sm text-gray-600">{s.city}{s.voivodeship && `, ${s.voivodeship}`}</p>
                {s.website_url && <a href={safeUrl(s.website_url)} target="_blank" rel="noreferrer" className="text-sm text-primary-600">{s.website_url}</a>}
                {s.submitter_email && <p className="text-xs text-gray-500 mt-1">From: {s.submitter_email}</p>}
              </div>
              <button onClick={() => deleteSuggestion(i)} className="ml-3 text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 rounded shrink-0">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Stray reports management */}
      <h2 className="text-lg font-semibold mt-8 mb-4">Stray Reports ({strayReports.length})</h2>
      <div className="flex flex-col gap-3">
        {strayReports.map((s) => (
          <div key={s.id} className="bg-white border border-red-200 rounded-xl p-4 flex justify-between items-start">
            <div>
              <p className="text-sm font-medium">{s.city} • {new Date(s.reported_at).toLocaleDateString()}</p>
              <p className="text-xs text-gray-600">{s.description || "No description"}</p>
              {s.image_url && <a href={s.image_url} target="_blank" rel="noreferrer" className="text-xs text-primary-600">View image</a>}
            </div>
            <button onClick={() => deleteStray(s.id)} className="text-xs text-red-600 hover:text-red-800 font-medium px-2 py-1 bg-red-50 rounded">
              Delete
            </button>
          </div>
        ))}
        {strayReports.length === 0 && <p className="text-gray-500 text-sm">No stray reports.</p>}
      </div>
    </div>
  );
}
