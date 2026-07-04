import type { CatResponse } from "../types";

interface AgentCardProps {
  cat: CatResponse;
}

export function truncateDescription(description: string | null): string {
  if (!description || description.trim() === "") {
    return "No intel available";
  }
  if (description.length > 150) {
    return description.slice(0, 150) + "…";
  }
  return description;
}

export function AgentCard({ cat }: AgentCardProps) {
  const displayDescription = truncateDescription(cat.description);

  return (
    <div
      className="bg-tactical-bg border border-tactical-accent rounded-lg p-3 
                 shadow-[0_0_8px_rgba(15,52,96,0.3)] hover:shadow-[0_0_12px_rgba(233,69,96,0.2)]
                 transition-all duration-200"
    >
      <div className="flex gap-3">
        {/* Image */}
        <div className="w-16 h-16 flex-shrink-0 rounded overflow-hidden bg-tactical-surface">
          {cat.image_url ? (
            <img
              src={cat.image_url}
              alt={cat.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-600">
              <svg
                className="w-8 h-8"
                fill="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <h3 className="font-mono font-bold text-tactical-amber text-sm truncate">
            {cat.name}
          </h3>
          <p className="text-xs text-gray-400 mt-1 leading-relaxed">
            {displayDescription}
          </p>
          <div className="flex gap-2 mt-2 text-xs text-gray-500 font-mono">
            <span>{cat.shelter_name}</span>
            <span>•</span>
            <span>{cat.shelter_city}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
