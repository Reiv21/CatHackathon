export interface Achievement {
  name: string;
  description: string;
  icon: string;
  unlocked_at: string;
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

export interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
}

/**
 * Computes achievements based on current cat and shelter data.
 * Pure function — no side effects, easy to test independently.
 */
export function computeAchievements(cats: CatRecord[], shelters: ShelterRecord[]): Achievement[] {
  const achievements: Achievement[] = [];
  const now = new Date().toISOString();

  const shelterIdsWithCats = new Set(cats.map(c => c.shelter_id));
  const distinctVoivodeships = new Set(
    shelters
      .filter(s => shelterIdsWithCats.has(s.id_zewnetrzne))
      .map(s => s.voivodeship)
  );

  if (cats.length >= 100) {
    achievements.push({
      name: "Pierwsza Setka",
      description: "100 kotów w bazie!",
      icon: "🎯",
      unlocked_at: now,
    });
  }

  if (shelterIdsWithCats.size >= 10) {
    achievements.push({
      name: "10 Schronisk",
      description: "10 schronisk z kotami!",
      icon: "🏠",
      unlocked_at: now,
    });
  }

  if (distinctVoivodeships.size === 16) {
    achievements.push({
      name: "Pełna Dominacja",
      description: "Koty ze wszystkich województw!",
      icon: "🇵🇱",
      unlocked_at: now,
    });
  }

  return achievements;
}
