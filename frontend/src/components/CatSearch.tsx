import { useState } from "react";
import { useSearchCats } from "../hooks/useSearchCats";
import { CatCard } from "./CatCard";

export function CatSearch() {
  const [query, setQuery] = useState("");
  const { data: cats, loading, error } = useSearchCats(query);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Search header */}
      <div className="mb-6">
        <h2 className="text-xl font-mono font-bold text-tactical-amber mb-1">
          Agent Database
        </h2>
        <p className="text-sm text-gray-400 font-mono">
          Search deployed agents by name, city, or shelter
        </p>
      </div>

      {/* Search input */}
      <div className="relative mb-6">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, city, or shelter..."
          className="w-full bg-tactical-surface border border-tactical-accent rounded-lg pl-12 pr-4 py-3 
                     font-mono text-sm text-gray-100 placeholder-gray-500
                     focus:outline-none focus:border-tactical-amber focus:ring-1 focus:ring-tactical-amber/30
                     transition-all duration-200"
        />
        {query.length > 0 && (
          <button
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-500 hover:text-gray-300"
          >
            ✕
          </button>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        {loading && (
          <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
            <div className="w-4 h-4 border-2 border-tactical-accent border-t-tactical-amber rounded-full animate-spin" />
            Searching...
          </div>
        )}
        {!loading && cats !== null && (
          <p className="text-xs text-gray-500 font-mono">
            {cats.length >= 200 ? "200+" : cats.length} agent{cats.length !== 1 ? "s" : ""} found
            {query.length >= 2 && ` for "${query}"`}
          </p>
        )}
        {error && (
          <p className="text-xs text-red-400 font-mono">Error: {error}</p>
        )}
      </div>

      {/* Results grid */}
      {!loading && cats !== null && cats.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500 font-mono text-lg">No agents found</p>
          <p className="text-gray-600 font-mono text-sm mt-2">Try a different search term</p>
        </div>
      )}

      {cats !== null && cats.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cats.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}
    </div>
  );
}
