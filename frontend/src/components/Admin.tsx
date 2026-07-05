import { useState, useEffect } from "react";

interface Suggestion {
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  submitter_email: string | null;
  submitted_at: string;
}

export function Admin() {
  const [password, setPassword] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

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
  }, [token]);

  if (!token) {
    return (
      <div className="max-w-sm mx-auto px-4 py-16">
        <h1 className="text-2xl font-display font-bold mb-6 text-center">Admin Login</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="border border-cat-sand rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <button type="submit" className="bg-cat-dark text-white rounded-xl px-6 py-3 font-semibold hover:opacity-90">
            Login
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

      {loading && <p className="text-gray-400">Loading...</p>}

      {suggestions.length === 0 && !loading && (
        <p className="text-gray-400 text-center py-8">No suggestions yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {suggestions.map((s, i) => (
          <div key={i} className="bg-white border border-cat-sand rounded-xl p-4">
            <div className="flex justify-between">
              <h3 className="font-semibold">{s.name}</h3>
              <span className="text-xs text-gray-400">{new Date(s.submitted_at).toLocaleDateString()}</span>
            </div>
            <p className="text-sm text-gray-600">{s.city}{s.voivodeship && `, ${s.voivodeship}`}</p>
            {s.website_url && <a href={s.website_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600">{s.website_url}</a>}
            {s.submitter_email && <p className="text-xs text-gray-400 mt-1">From: {s.submitter_email}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
