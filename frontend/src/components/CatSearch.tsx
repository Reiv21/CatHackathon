import { useState } from "react";
import { useSearchCats } from "../hooks/useSearchCats";
import { CatCard } from "./CatCard";
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
  const { data: cats, loading, error, pagination, setPage } = useSearchCats(query, voivodeship, sex, sort);
  const { t, lang } = useI18n();
  const [randomCat, setRandomCat] = useState<CatResponse | null>(null);

  const surprise = async () => {
    const cat = await apiFetch<CatResponse | null>("/api/random-cat");
    setRandomCat(cat);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-6">
        <h1 className="text-3xl font-display font-bold mb-2">{t.searchTitle}</h1>
        <p className="text-gray-500">{t.searchSubtitle}</p>
      </div>

      {/* Surprise me */}
      <div className="text-center mb-6">
        <button onClick={surprise} className="px-4 py-2 bg-warm-100 text-warm-700 rounded-full text-sm font-medium hover:bg-warm-200 transition-colors">
          🎲 {lang === "pl" ? "Zaskocz mnie!" : "Surprise me!"}
        </button>
      </div>

      {/* Random cat modal */}
      {randomCat && (
        <div className="max-w-sm mx-auto mb-8 bg-white rounded-2xl shadow-lg overflow-hidden border border-primary-200">
          {randomCat.image_url && <img src={randomCat.image_url} alt={randomCat.name} className="w-full h-48 object-cover" />}
          <div className="p-4">
            <h3 className="font-display font-bold text-lg">{randomCat.name}</h3>
            <p className="text-xs text-gray-500">📍 {randomCat.shelter_city}</p>
            {randomCat.source_url && <a href={randomCat.source_url} target="_blank" rel="noreferrer" className="text-sm text-primary-600 mt-2 inline-block">{t.viewOnShelter}</a>}
            <button onClick={() => setRandomCat(null)} className="block text-xs text-gray-400 mt-2">✕ {lang === "pl" ? "Zamknij" : "Close"}</button>
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
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {query && <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">✕</button>}
        </div>

        <div className="flex flex-wrap gap-2">
          <select value={voivodeship} onChange={(e) => setVoivodeship(e.target.value)}
            className="bg-white border border-cat-sand rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-200">
            {VOIVODESHIPS.map((v) => <option key={v} value={v}>{VOIV_LABELS[v]}</option>)}
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

        <p className="text-xs text-gray-400 italic">
          {lang === "pl"
            ? "⚠️ Nie wszystkie dane mogą być kompletne — informacje są zbierane automatycznie ze stron schronisk."
            : "⚠️ Not all data may be complete — information is collected automatically from shelter websites."}
        </p>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div className="text-center text-gray-400 py-8">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p>{t.searching}</p>
        </div>
      )}
      {error && <p className="text-center text-red-500 py-4">{error}</p>}

      {/* Count */}
      {!loading && pagination && pagination.total > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          {pagination.total} {pagination.total === 1 ? t.catFound : t.catsFound}
        </p>
      )}

      {/* Empty */}
      {!loading && cats !== null && cats.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">😿</div>
          <p className="text-gray-500">{t.noCats}</p>
          <p className="text-sm text-gray-400 mt-1">{t.noCatsHint}</p>
        </div>
      )}

      {/* Grid */}
      {cats !== null && cats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
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
