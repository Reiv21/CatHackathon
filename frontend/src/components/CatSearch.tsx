import { useState } from "react";
import { useSearchCats } from "../hooks/useSearchCats";
import { CatCard } from "./CatCard";
import { useI18n } from "../i18n";

const VOIVODESHIPS = [
  "", "dolnoslaskie", "kujawsko-pomorskie", "lodzkie", "lubelskie", "lubuskie",
  "malopolskie", "mazowieckie", "opolskie", "podkarpackie", "podlaskie",
  "pomorskie", "slaskie", "swietokrzyskie", "warminsko-mazurskie",
  "wielkopolskie", "zachodniopomorskie",
];

const VOIV_LABELS: Record<string, string> = {
  "": "All regions",
  "dolnoslaskie": "Dolnośląskie",
  "kujawsko-pomorskie": "Kujawsko-Pomorskie",
  "lodzkie": "Łódzkie",
  "lubelskie": "Lubelskie",
  "lubuskie": "Lubuskie",
  "malopolskie": "Małopolskie",
  "mazowieckie": "Mazowieckie",
  "opolskie": "Opolskie",
  "podkarpackie": "Podkarpackie",
  "podlaskie": "Podlaskie",
  "pomorskie": "Pomorskie",
  "slaskie": "Śląskie",
  "swietokrzyskie": "Świętokrzyskie",
  "warminsko-mazurskie": "Warmińsko-Mazurskie",
  "wielkopolskie": "Wielkopolskie",
  "zachodniopomorskie": "Zachodniopomorskie",
};

export function CatSearch() {
  const [query, setQuery] = useState("");
  const [voivodeship, setVoivodeship] = useState("");
  const { data: cats, loading, error, pagination, setPage } = useSearchCats(query, voivodeship);
  const { t } = useI18n();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-display font-bold mb-2">{t.searchTitle}</h1>
        <p className="text-gray-500">{t.searchSubtitle}</p>
      </div>

      {/* Search + Filter */}
      <div className="max-w-2xl mx-auto mb-8 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className="w-full bg-white border border-cat-sand rounded-xl pl-12 pr-10 py-3 text-cat-dark placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-300 transition-all"
          />
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {query && (
            <button onClick={() => setQuery("")} className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600">✕</button>
          )}
        </div>
        <select
          value={voivodeship}
          onChange={(e) => setVoivodeship(e.target.value)}
          className="bg-white border border-cat-sand rounded-xl px-4 py-3 text-cat-dark shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-200 text-sm"
        >
          {VOIVODESHIPS.map((v) => (
            <option key={v} value={v}>{VOIV_LABELS[v]}</option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center text-gray-400 py-8">
          <div className="w-8 h-8 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-3" />
          <p>Searching...</p>
        </div>
      )}
      {error && <p className="text-center text-red-500 py-4">Error: {error}</p>}

      {/* Results count */}
      {!loading && pagination && pagination.total > 0 && (
        <p className="text-sm text-gray-400 mb-4">
          {pagination.total} cat{pagination.total !== 1 ? "s" : ""} found
          {query.length >= 2 && ` for "${query}"`}
          {voivodeship && ` in ${VOIV_LABELS[voivodeship]}`}
        </p>
      )}

      {/* Empty */}
      {!loading && cats !== null && cats.length === 0 && (
        <div className="text-center py-12">
          <div className="text-5xl mb-4">😿</div>
          <p className="text-gray-500">No cats found</p>
          <p className="text-sm text-gray-400 mt-1">Try a different search term or region</p>
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
          <button
            disabled={pagination.page <= 1}
            onClick={() => setPage(pagination.page - 1)}
            className="px-4 py-2 rounded-lg bg-white border border-cat-sand text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            ← Prev
          </button>
          <span className="text-sm text-gray-500 px-3">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPage(pagination.page + 1)}
            className="px-4 py-2 rounded-lg bg-white border border-cat-sand text-sm font-medium disabled:opacity-40 hover:bg-gray-50 transition-colors"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
