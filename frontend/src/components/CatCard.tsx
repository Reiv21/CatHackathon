import type { CatResponse } from "../types";
import { useI18n } from "../i18n";

interface CatCardProps {
  cat: CatResponse;
}

export function truncateDescription(description: string | null): string {
  if (!description || description.trim() === "") return "";
  if (description.length > 150) return description.slice(0, 150) + "…";
  return description;
}

export function CatCard({ cat }: CatCardProps) {
  const { t } = useI18n();
  const description = truncateDescription(cat.description);

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-shadow border border-cat-sand group">
      {/* Image */}
      <div className="w-full h-52 bg-gray-100 overflow-hidden">
        {cat.image_url ? (
          <img
            src={cat.image_url}
            alt={cat.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-warm-50">
            <span className="text-5xl opacity-30">🐱</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-lg font-display font-bold text-cat-dark mb-1">{cat.name}</h3>
        
        {description && (
          <p className="text-sm text-gray-500 leading-relaxed mb-3">{description}</p>
        )}

        {/* Meta */}
        <div className="flex flex-wrap gap-2 mb-3">
          {cat.sex && (
            <span className="text-xs bg-primary-50 text-primary-700 px-2 py-1 rounded-full">
              {cat.sex === "samica" ? "♀ samica" : "♂ samiec"}
            </span>
          )}
          {cat.age && (
            <span className="text-xs bg-warm-50 text-warm-700 px-2 py-1 rounded-full">
              ur. {cat.age}
            </span>
          )}
        </div>

        {/* Shelter */}
        <div className="text-xs text-gray-400 border-t border-gray-100 pt-3">
          <p className="flex items-center gap-1">
            <span>📍</span>
            <span className="font-medium text-gray-600">{cat.shelter_city}</span>
            {cat.shelter_voivodeship && <span>• {cat.shelter_voivodeship}</span>}
          </p>
          <p className="truncate mt-0.5" title={cat.shelter_name}>{cat.shelter_name}</p>
        </div>

        {/* Link + Share */}
        <div className="flex items-center gap-3 mt-3">
          {(cat.source_url || cat.shelter_url) && (
            <a href={cat.source_url || cat.shelter_url || "#"} target="_blank" rel="noopener noreferrer"
              className="text-sm text-primary-600 hover:text-primary-700 font-medium">
              {t.viewOnShelter}
            </a>
          )}
          <button
            onClick={() => {
              const url = cat.source_url || cat.shelter_url || window.location.href;
              navigator.clipboard.writeText(url);
            }}
            className="text-xs text-gray-400 hover:text-gray-600"
            title="Share"
          >
            📋
          </button>
        </div>
      </div>
    </div>
  );
}
