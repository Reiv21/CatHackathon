/**
 * Deep clean cats.json — aggressive junk removal.
 */
import { readFileSync, writeFileSync } from "fs";

interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
}

const cats: CatRecord[] = JSON.parse(readFileSync("./data/cats.json", "utf-8"));
console.log("Before:", cats.length);

// 1. Remove entries that are clearly not animal names
const junkNames = [
  /znajd(ź|z) nowego/i,
  /dołącz do nas/i,
  /adoptuj zwierz/i,
  /facebook/i,
  /instagram/i,
  /nowo przyjęci/i,
  /czytaj więcej/i,
  /zobacz więcej/i,
  /więcej informacji/i,
  /strona główna/i,
  /regulamin/i,
  /polityka prywatności/i,
  /kontakt/i,
  /^kot (on|ona|samiec|samica)$/i,
  /^koty?$/i,
  /^psy?$/i,
  /^zwierzęta?$/i,
  /^adopcja$/i,
  /^do adopcji$/i,
  /^aktualne$/i,
  /apel o pomoc/i,
  /potrzebujemy/i,
  /zbiórka/i,
  /darowizna/i,
  /wpłat/i,
  /1% podatku/i,
  /newsletter/i,
  /cookie/i,
  /^prev(ious)?$|^next$/i,
  /^[\d]+$/,
  /^strona \d/i,
];

function isJunkName(name: string): boolean {
  return junkNames.some((p) => p.test(name.trim()));
}

// 2. Remove duplicates (same name + same shelter)
function deduplicate(items: CatRecord[]): CatRecord[] {
  const seen = new Set<string>();
  return items.filter((c) => {
    const key = c.name.toLowerCase().trim() + "|" + c.shelter_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// 3. Filter
let cleaned = cats
  .filter((c) => !isJunkName(c.name))
  .filter((c) => c.name.length >= 3 && c.name.length <= 80)
  // Must have image — without image it's likely not a real animal listing
  .filter((c) => c.image_url !== null && c.image_url !== "");

cleaned = deduplicate(cleaned);

// Re-index
cleaned = cleaned.map((c, i) => ({ ...c, id: i + 1 }));

console.log("After:", cleaned.length);
console.log("Removed:", cats.length - cleaned.length);
console.log("");

// Show per city
const byCity: Record<string, number> = {};
cleaned.forEach((c) => { byCity[c.shelter_city] = (byCity[c.shelter_city] || 0) + 1; });
const sorted = Object.entries(byCity).sort((a, b) => b[1] - a[1]);
console.log("Cats by city:");
sorted.forEach(([city, count]) => console.log("  ", city, ":", count));

writeFileSync("./data/cats.json", JSON.stringify(cleaned, null, 2));

// Update shelters
const shelters = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
const updated = shelters.map((s: { id_zewnetrzne: number }) => ({
  ...s,
  cat_count: cleaned.filter((c) => c.shelter_id === s.id_zewnetrzne).length,
}));
writeFileSync("./data/shelters.json", JSON.stringify(updated, null, 2));
console.log("\nSaved cleaned data.");
