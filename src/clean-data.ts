/**
 * Cleans cats.json — removes junk entries from bad scraping.
 * Adds source_url field (shelter website URL) to each cat.
 */
import { readFileSync, writeFileSync } from "fs";

interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url?: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
}

interface ShelterRecord {
  id_zewnetrzne: number;
  website_url: string | null;
  [key: string]: unknown;
}

const junkPatterns = [
  /^(Imię|Gatunek|Płeć|Opis|Rozmiar|Data urodzenia|Data przyjęcia|Kwarantanna|Gmina|Inne|Wiek|Status|Nr chip|Rasa|Kolor|Sterylizacja|Numer|Oddział):?$/i,
  /^(Szukaj|Filtruj|Sortuj|Strona|Następna|Poprzednia|Pokaż|Zamknij|Menu|Kontakt|O nas|Regulamin|Adopcja|Polityka)$/i,
  /^[\d\s./-]+$/, // only numbers/dates
  /^.{0,2}$/, // 2 chars or less
  /^https?:\/\//, // URLs as names
];

function isJunk(name: string): boolean {
  return junkPatterns.some((p) => p.test(name.trim()));
}

const cats: CatRecord[] = JSON.parse(readFileSync("./data/cats.json", "utf-8"));
const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));

const shelterMap = new Map(shelters.map((s) => [s.id_zewnetrzne, s]));

// Clean: remove junk, add source_url
const cleaned = cats
  .filter((c) => !isJunk(c.name))
  .filter((c) => c.name.length >= 3 && c.name.length <= 150)
  .map((c, i) => {
    const shelter = shelterMap.get(c.shelter_id);
    return {
      ...c,
      id: i + 1,
      source_url: c.source_url || shelter?.website_url || null,
    };
  });

const before = cats.length;
const after = cleaned.length;

writeFileSync("./data/cats.json", JSON.stringify(cleaned, null, 2));
console.log(`Cleaned: ${before} → ${after} cats (removed ${before - after} junk entries)`);

// Update shelters cat_count
const updatedShelters = shelters.map((s) => ({
  ...s,
  cat_count: cleaned.filter((c) => c.shelter_id === s.id_zewnetrzne).length,
}));
writeFileSync("./data/shelters.json", JSON.stringify(updatedShelters, null, 2));
console.log("Updated shelter cat counts.");
