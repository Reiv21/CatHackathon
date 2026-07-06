/**
 * Pure function to compute domination progress stats.
 * Exported separately for testability.
 */

export interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  cat_count: number;
}

export interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
}

export interface DominationResponse {
  total_shelters_in_poland: 190;
  shelters_covered: number;
  percentage: number;
  cats_in_army: number;
  domination_level: string;
}

export function computeDomination(shelters: ShelterRecord[], cats: CatRecord[]): DominationResponse {
  const TOTAL = 190;
  const shelterIdsWithCats = new Set(cats.map(c => c.shelter_id));
  const covered = shelters.filter(s => shelterIdsWithCats.has(s.id_zewnetrzne)).length;
  const percentage = Math.round((covered / TOTAL) * 10000) / 100; // 2 decimal places
  const level = percentage >= 75 ? "Pełna Kocia Dominacja"
    : percentage >= 50 ? "Kocia Ofensywa"
    : percentage >= 25 ? "Kocia Partyzantka"
    : "Kocie Zwiadowcy";
  return {
    total_shelters_in_poland: TOTAL,
    shelters_covered: covered,
    percentage,
    cats_in_army: cats.length,
    domination_level: level,
  };
}
