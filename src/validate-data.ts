/**
 * Post-scrape validation and cleanup.
 * Removes entries that shouldn't be there.
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
  sex: string | null;
  age: string | null;
  [key: string]: unknown;
}

const cats: CatRecord[] = JSON.parse(readFileSync("./data/cats.json", "utf-8"));
console.log(`Input: ${cats.length} entries\n`);

// Problems tracking
const problems: string[] = [];

// Filter 1: Must have image (entries without images are useless)
let filtered = cats.filter((c) => {
  if (!c.image_url) {
    problems.push(`[NO IMAGE] ${c.name} (${c.shelter_city})`);
    return false;
  }
  return true;
});

// Filter 2: Skip known junk names
const junkPatterns = [
  /^nasze koty$/i, /^nasze psy$/i, /^koty$/i, /^psy$/i,
  /^zwierzęta$/i, /^adopcje$/i, /^do adopcji$/i,
  /schronisko dla/i, /witamy/i, /^strona/i,
  /regulamin|polityka|kontakt|o nas/i,
  /galeria|mapa|wybierz|dokumentacja|formatowania/i,
  /historia schroniska|nasi pracownicy|jak możesz/i,
  /potrzeby na już|pomoc finansowa|pomoc materialna/i,
  /adoptuj wirtualnie|zbiórki|warunki adopcji/i,
  /^prev$|^next$|^starsze$|^nowsze$/i,
  /dziękujemy naszym/i, /naszym przyjaciołom/i,
  /na których zawsze/i,
  /^zwierzaki\.{0,3}$/i, /^zwierzak$/i,
  /^\d+[A-Z]$/i, /^\d+[A-Z]\d*$/i,
  /^twoj tekst/i, /twój tekst/i,
  /data przyjęcia/i,
  /^suki$/i, /^kocury$/i, /^kocięta$/i, /^kocieta$/i,
  /^kwarantanna$/i, /^znalezione$/i, /^poszukiwane$/i,
  /psy w fundacji/i, /potrzebna pomoc/i,
  /zostań domem/i, /pomagają nam/i, /wyszukiwarka/i,
  /obowiązki gmin/i, /jak zapewnić/i, /zwierzakom komfort/i,
  /^ur\.\s*\d{4}$/i,
  /przekaż darowizn/i, /1[,.]5% podatku/i, /^edukacja$/i,
  /^wybiegalnia$/i, /cmentarz/i, /kremacja/i,
  /deklaracja dostępności/i, /pomoc rzeczowa/i,
  /w nowym domu/i, /znalazły dom/i, /za tęczowym/i,
  // Months/dates as names
  /^(styczeń|luty|marzec|kwiecień|maj|czerwiec|lipiec|sierpień|wrzesień|październik|listopad|grudzień)\s*,?\s*\d{4}$/i,
  /^\d{4}$/i, /^(stycznia|lutego|marca|kwietnia|maja|czerwca|lipca|sierpnia|września|października|listopada|grudnia)/i,
  // Categories
  /^kozy$/i, /^krowy$/i, /^lisy$/i, /^owce$/i, /^świnie$/i, /^inne$/i, /^konie$/i,
  /^o schronisku$/i, /^biogram$/i, /^nasze publikacje$/i,
  /^kot on$/i, /^kot ona$/i,
  /opublikowane przez/i,
];

filtered = filtered.filter((c) => {
  if (junkPatterns.some((p) => p.test(c.name.trim()))) {
    problems.push(`[JUNK NAME] ${c.name} (${c.shelter_city})`);
    return false;
  }
  return true;
});

// Filter 2b: Skip dogs — check name AND description for dog-related words
const dogPatterns = [
  /\bpies\b/i, /\bpiesek\b/i, /\bpieseczek\b/i,
  /\bsuczka\b/i, /\bsuka\b/i, /\bsunia\b/i, /\bsunka\b/i,
  /\bkundelek\b/i, /\bkundel\b/i,
  /\bszczeni(ak|ę|ąt)/i,
  /data przyjęcia.*data przyjęcia/i,
  /\bpsy\b/i, /\bpsiak\b/i,
];

filtered = filtered.filter((c) => {
  const text = (c.name + " " + c.description).toLowerCase();
  if (dogPatterns.some((p) => p.test(text))) {
    // Double check: if it also mentions "kot/kotka" it might be mixed, keep it
    if (/\bkot\b|\bkotka\b|\bkotek\b|\bkocur\b|\bkoci\b/i.test(text)) return true;
    problems.push(`[DOG] ${c.name} (${c.shelter_city})`);
    return false;
  }
  return true;
});

// Filter 3: Deduplicate (same name + same shelter)
const seen = new Set<string>();
filtered = filtered.filter((c) => {
  const key = c.name.toLowerCase().trim() + "|" + c.shelter_id;
  if (seen.has(key)) {
    return false;
  }
  seen.add(key);
  return true;
});

// Re-index
filtered = filtered.map((c, i) => ({ ...c, id: i + 1 }));

// Report
console.log(`Output: ${filtered.length} entries (removed ${cats.length - filtered.length})`);
console.log(`\nProblems found: ${problems.length}`);
if (problems.length > 0 && problems.length <= 50) {
  problems.forEach((p) => console.log("  " + p));
} else if (problems.length > 50) {
  problems.slice(0, 30).forEach((p) => console.log("  " + p));
  console.log(`  ... and ${problems.length - 30} more`);
}

// Per-city summary
console.log("\nPer city:");
const byCity: Record<string, number> = {};
filtered.forEach((c) => { byCity[c.shelter_city] = (byCity[c.shelter_city] || 0) + 1; });
Object.entries(byCity).sort((a, b) => b[1] - a[1]).forEach(([city, count]) => {
  console.log(`  ${city.padEnd(22)} ${count}`);
});

// Save
writeFileSync("./data/cats.json", JSON.stringify(filtered, null, 2));
console.log("\n✅ Saved validated data.");
