import type { CatResponse } from "../types";

interface CatCardProps {
  cat: CatResponse;
}

function truncateDescription(description: string | null): string {
  if (!description || description.trim() === "") {
    return "No intel available";
  }
  if (description.length > 200) {
    return description.slice(0, 200) + "…";
  }
  return description;
}

export function CatCard({ cat }: CatCardProps) {
  const displayDescription = truncateDescription(cat.description);

  return (
    <div className="bg-tactical-surface border border-tactical-accent rounded-lg overflow-hidden
                    shadow-[0_0_8px_rgba(15,52,96,0.3)] hover:shadow-[0_0_16px_rgba(233,69,96,0.2)]
                    hover:border-tactical-amber/40 transition-all duration-200 flex flex-col">
      {/* Image */}
      <div className="w-full h-48 bg-tactical-bg relative overflow-hidden">
        {cat.image_url ? (
          <img
            src={cat.image_url}
            alt={cat.name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-gray-700" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4.5 12c0-1.232.046-2.453.138-3.662a4.006 4.006 0 013.7-3.7 48.678 48.678 0 017.324 0 4.006 4.006 0 013.7 3.7c.017.22.032.441.046.662M4.5 12l-1.992-.226M4.5 12l1.992-.226m14.508 0c0-1.232-.046-2.453-.138-3.662M19.5 12l1.992-.226M19.5 12l-1.992-.226m0 0a24.11 24.11 0 00-3.578-.232c-1.946 0-3.87.17-5.754.501M4.5 12a24.11 24.11 0 013.578-.232c1.946 0 3.87.17 5.754.501" />
            </svg>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4 flex flex-col flex-1">
        {/* Name */}
        <h3 className="font-mono font-bold text-tactical-amber text-base leading-tight mb-2">
          {cat.name}
        </h3>

        {/* Description */}
        <p className="text-xs text-gray-400 leading-relaxed mb-3 flex-1">
          {displayDescription}
        </p>

        {/* Shelter info */}
        <div className="border-t border-tactical-accent/50 pt-3 mt-auto">
          <div className="flex items-center gap-2 text-xs text-gray-500 font-mono mb-1">
            <span className="text-tactical-accent">📍</span>
            <span>{cat.shelter_city}</span>
            {cat.shelter_voivodeship && (
              <>
                <span className="text-gray-700">•</span>
                <span className="text-gray-600">{cat.shelter_voivodeship}</span>
              </>
            )}
          </div>
          <p className="text-xs text-gray-500 font-mono truncate mb-2" title={cat.shelter_name}>
            {cat.shelter_name}
          </p>

          {/* Source link */}
          {(cat.source_url || cat.shelter_url) && (
            <a
              href={cat.source_url || cat.shelter_url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs font-mono text-tactical-amber/70 
                         hover:text-tactical-amber transition-colors duration-200"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on shelter page
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
