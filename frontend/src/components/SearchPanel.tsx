import { useState } from "react";
import { useSearchCats } from "../hooks/useSearchCats";
import { AgentCard } from "./AgentCard";
import { ErrorMessage } from "./ErrorMessage";

export function SearchPanel() {
  const [query, setQuery] = useState("");
  const { data: cats, loading, error } = useSearchCats(query);

  return (
    <div className="p-4 flex flex-col gap-4 h-full">
      {/* Search input */}
      <div className="flex-shrink-0">
        <label htmlFor="agent-search" className="block text-xs font-mono text-tactical-amber mb-2 uppercase tracking-wider">
          Agent Database
        </label>
        <input
          id="agent-search"
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or city..."
          className="w-full bg-tactical-bg border border-tactical-accent rounded px-3 py-2 
                     font-mono text-sm text-gray-100 placeholder-gray-500
                     focus:outline-none focus:border-tactical-amber transition-colors duration-200"
        />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center gap-2 text-gray-400 font-mono text-xs">
          <div className="w-4 h-4 border-2 border-tactical-accent border-t-tactical-amber rounded-full animate-spin" />
          Loading agents...
        </div>
      )}

      {/* Error */}
      {error && <ErrorMessage message="Could not load agents" />}

      {/* Results */}
      {!loading && !error && cats !== null && (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto min-h-0">
          {cats.length === 0 ? (
            <p className="text-gray-500 font-mono text-sm text-center py-4">
              No agents found
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500 font-mono flex-shrink-0">
                {cats.length >= 200 ? "200+" : cats.length} agent{cats.length !== 1 ? "s" : ""} deployed
              </p>
              {cats.slice(0, 50).map((cat) => <AgentCard key={cat.id} cat={cat} />)}
            </>
          )}
        </div>
      )}
    </div>
  );
}
