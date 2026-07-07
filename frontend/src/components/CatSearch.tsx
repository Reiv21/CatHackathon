import { useState } from "react";
import { useSearchCats } from "../hooks/useSearchCats";
import { CatCard } from "./CatCard";
import { CatCardSkeletonGrid } from "./Skeletons";
import { InlineError } from "./InlineError";
import { safeUrl } from "../safeUrl";
import { useI18n } from "../i18n";
import { apiFetch } from "../api";
import type { CatResponse } from "../types";

const VOIVODESHIPS = [
  "", "dolnoslaskie", "kujawsko-pomorskie", "lodzkie", "lubelskie", "lubuskie",
  "malopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie",
  "pomorskie", "slaskie", "swietokrzyskie", "warminsko-mazurskie",
  "wielkopolskie", "zachodniopomorskie",
];

const VOIV_LABELS: Record<string, string> = {
  "": "All regions", "dolnoslaskie": "Dolnośląskie", "kujawsko-pomorskie": "Kujawsko-Pomorskie",
  "lodzkie": "Łódzkie", "lubelskie": "Lubelskie", "lubuskie": "Lubuskie",
  "malopolskie": "Małopolskie", "mazowieckie": "Mazowieckie", "opolskie": "Opolskie",
  "podkarpackie": "Podkarpackie", "podlaskie": "Podlaskie", "pomorskie": "Pomorskie",
  "slaskie": "Śląskie", "swietokrzyskie": "Świętokrzyskie",
  "warminsko-mazurskie": "Warmińsko-Mazurskie", "wielkopolskie": "Wielkopolskie",
  "zachodniopomorskie": "Zachodniopomorskie",
};

export function CatSearch() {
  const [query, setQuery] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const [sex, setSex] = useState("");
  const [sort, setSort] = useState("");
  const [showStrays, setShowStrays] = useState(false);
  const [strays, setStrays] = useState<Array<{id: number; description: string; image_url: string | null; city: string; reported_at: string}>>([]);
  const { data: cats, loading, error, pagination, setPage, retry } = useSearchCats(query, voivodeship, sex, sort);
  const { t, lang } = useI18n();
  const [randomCat, setRandomCat] = useState<CatResponse | null>(null);
  const [surpriseLoading, setSurpriseLoading] = useState(false);
  const [surpriseLightbox, setSurpriseLightbox] = useState(false);

  // Fetch strays when toggled
  if (showStrays && strays.length === 0) {
    fetch("/api/strays").then(r => r.json()).then(setStrays).catch(() => {});
  }

  const surprise = async () => {
    setSurpriseLoading(true);
    setRandomCat(null);
    const cat = await apiFetch<CatResponse | null>("/api/random-cat");
    // Small delay for animation effect
    await new Promise((r) => setTimeout(r, 500));
    setRandomCat(cat);
    setSurpriseLoading(false);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Surprise cat lightbox */}
      {surpriseLightbox && randomCat?.image_url && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={() => setSurpriseLightbox(false)} role="dialog" aria-label={`${randomCat.name} – ${randomCat.shelter_city}`}>
          <img src={randomCat.image_url} alt={`${randomCat.name} – ${randomCat.shelter_city}`} className="max-w-full max-h-full rounded-xl object-contain" />
        </div>
      )}

      <div className="text-center mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">{t.searchTitle}</h1>
        <p className="text-gray-500">{t.searchSubtitle}</p>
      </div>

      {/* Surprise me */}
      <div className="text-center mb-6">
        <button onClick={surprise} disabled={surpriseLoading} className="px-4 py-2 bg-warm-100 text-warm-700 rounded-full text-sm font-medium hover:bg-warm-200 transition-colors disabled:opacity-70">
          {surpriseLoading ? <span className="inline-block animate-bounce">🐱</span> : "🎲"} {lang === "pl" ? "Zaskocz mnie!" : "Surprise me!"}
        </button>
      </div>

      {/* Random cat modal */}
      {randomCat && (
        <div className="max-w-sm mx-auto mb-8 bg-white rounded-2xl shadow-lg overflow-hidden border border-primary-200">
          {randomCat.image_url && <img src={randomCat.image_url} alt={`${randomCat.name} – ${randomCat.shelter_city}`} className="w-full h-48 object-cover cursor-pointer" onClick={() => setSurpriseLightbox(true)} />}
          <div className="p-4">
            <h3 className="font-display font-bold text-lg">{randomCat.name}</h3>
            <p className="text-xs text-gray-500">📍 {randomCat.shelter_city}</p>
            {randomCat.source_url && <a href={safeUrl(randomCat.source_url)} target="_blank" rel="noreferrer" className="text-sm text-primary-600 mt-2 inline-block">{t.viewOnShelter}</a>}
            <button onClick={() => setRandomCat(null)} aria-label={lang === "pl" ? "Zamknij" : "Close"} className="block text-xs text-gray-500 mt-2">✕ {lang === "pl" ? "Zamknij" : "Close"}</button>
          </div>
        </div>
      )}

      {/* Search + Filters */}
      <div className="max-w-3xl mx-auto mb-6 space-y-3">
        <div className="relative">
          <input
            type="text" value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-white border border-cat-sand rounded-xl pl-12 pr-10 py-3 text-cat-dark placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 transition-all"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {query && <button onClick={() => setQuery("")} aria-label={lang === "pl" ? "Wyczyść wyszukiwanie" : "Clear search"} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-700">✕</button>}
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={voivodeship} onChange={(e) => setVoivodeship(e.target.value)}
            className="bg-white border border-cat-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
            <option value="">{t.allRegions}</option>
            {VOIVODESHIPS.filter(v => v).map((v) => <option key={v} value={v}>{VOIV_LABELS[v]}</option>)}
          </select>

          <select value={sex} onChange={(e) => setSex(e.target.value)}
            className="bg-white border border-cat-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
            <option value="">{lang === "pl" ? "Płeć: wszystkie" : "Sex: all"}</option>
            <option value="male">♂ {lang === "pl" ? "Samiec" : "Male"}</option>
            <option value="female">♀ {lang === "pl" ? "Samica" : "Female"}</option>
          </select>

          <select value={sort} onChange={(e) => setSort(e.target.value)}
            className="bg-white border border-cat-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
            <option value="">{lang === "pl" ? "Sortowanie: domyślne" : "Sort: default"}</option>
            <option value="name">{lang === "pl" ? "Po imieniu" : "By name"}</option>
            <option value="city">{lang === "pl" ? "Po mieście" : "By city"}</option>
          </select>
        </div>

        <p className="text-xs text-gray-500 italic">
          {lang === "pl"
            ? "⚠️ Nie wszystkie dane mogą być kompletne — informacje są zbierane automatycznie ze stron schronisk."
            : "⚠️ Not all data may be complete — information is collected automatically from shelter websites."}
        </p>

        {/* Stray toggle */}
        <button onClick={() => setShowStrays(!showStrays)}
          className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors ${showStrays ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
          🐱 {showStrays ? t.hideStrays : t.showStrays}
        </button>
      </div>

      {/* Loading / Error */}
      <div aria-live="polite" aria-atomic="false">
        {loading && <CatCardSkeletonGrid pageSize={24} />}
        {!loading && error && <div role="alert" aria-live="assertive"><InlineError message={error} onRetry={retry} /></div>}

        {/* Count */}
        {!loading && pagination && pagination.total > 0 && (
          <p className="text-sm text-gray-500 mb-4">
            {pagination.total} {pagination.total === 1 ? t.catFound : t.catsFound}
          </p>
        )}

        {/* Empty */}
        {!loading && cats !== null && cats.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">😿</div>
            <p className="text-gray-500">{t.noCats}</p>
            <p className="text-sm text-gray-500 mt-1">{t.noCatsHint}</p>
          </div>
        )}
      </div>

      {/* Stray reports */}
      {showStrays && strays.length > 0 && (
        <div className="mb-8">
          <h3 className="text-sm font-semibold text-red-600 mb-3">🐱 {t.strayReported} ({strays.length})</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {strays.map((s) => (
              <div key={s.id} className="bg-white rounded-xl border border-red-200 p-4 shadow-sm">
                {s.image_url && <img src={s.image_url} alt={lang === "pl" ? `Zgłoszony kot bezdomny – ${s.city}` : `Reported stray cat – ${s.city}`} className="w-full h-32 object-cover rounded-lg mb-2" />}
                <p className="text-sm text-gray-700">{s.description || (lang === "pl" ? "Brak opisu" : "No description")}</p>
                <p className="text-xs text-gray-500 mt-1">📍 {s.city} • {new Date(s.reported_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grid */}
      {cats !== null && cats.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cats.map((cat) => <CatCard key={cat.id} cat={cat} />)}
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <button disabled={pagination.page <= 1} onClick={() => setPage(pagination.page - 1)}
            className="px-4 py-2 rounded-lg bg-white border border-cat-sand text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
            {t.prev}
          </button>
          <span className="text-sm text-gray-500 px-3">{t.page} {pagination.page} {t.of} {pagination.totalPages}</span>
          <button disabled={pagination.page >= pagination.totalPages} onClick={() => setPage(pagination.page + 1)}
            className="px-4 py-2 rounded-lg bg-white border border-cat-sand text-sm font-medium disabled:opacity-40 hover:bg-gray-50">
            {t.next}
          </button>
        </div>
      )}
    </div>
  );
}
