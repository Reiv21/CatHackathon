/**
 * Direct scraping script — runs without Temporal.
 * Scrapes cats from all shelters that have website URLs.
 * Also reads custom shelters from shelters-custom.json.
 */
import { readFileSync } from "fs";
import { initializeDatabase, getSheltersWithWebsite, saveCats, upsertShelters, type Shelter } from "./db.js";
import { scrapeCatsActivity } from "./activities.js";
import { stripControlChars } from "./validation.js";

const DB_PATH = "./shelter-sync.db";

interface CustomShelter {
  name: string;
  city: string;
  voivodeship: string;
  url: string;
}

interface CustomSheltersFile {
  shelters: CustomShelter[];
}

function hashStringId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function loadCustomShelters(): { id: number; name: string; city: string; voivodeship: string; url: string }[] {
  try {
    const raw = readFileSync("./shelters-custom.json", "utf-8");
    const data: CustomSheltersFile = JSON.parse(raw);
    
    // Upsert custom shelters to DB and return them
    const db = initializeDatabase(DB_PATH);
    const shelters: Shelter[] = data.shelters.map((s) => ({
      id_zewnetrzne: hashStringId(s.url),
      name: s.name,
      city: s.city,
      voivodeship: s.voivodeship,
      website_url: s.url,
    }));
    upsertShelters(db, shelters);
    db.close();

    return data.shelters.map((s) => ({
      id: hashStringId(s.url),
      name: s.name,
      city: s.city,
      voivodeship: s.voivodeship,
      url: s.url,
    }));
  } catch (err) {
    console.log("No custom shelters file or parse error:", (err as Error).message);
    return [];
  }
}

async function main() {
  // Load custom shelters first
  const customShelters = loadCustomShelters();
  if (customShelters.length > 0) {
    console.log(`Loaded ${customShelters.length} custom shelters from shelters-custom.json`);
  }

  const db = initializeDatabase(DB_PATH);
  const dbShelters = getSheltersWithWebsite(db);
  db.close();

  // Merge: DB shelters + custom shelters (custom first for priority)
  const allShelters = [
    ...customShelters.map((s) => ({ id: s.id, name: s.name, city: s.city, url: s.url })),
    ...dbShelters.map((s) => ({ id: s.id_zewnetrzne, name: s.name, city: s.city, url: s.website_url! })),
  ];

  // Deduplicate by ID
  const seen = new Set<number>();
  const uniqueShelters = allShelters.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });

  console.log(`Found ${uniqueShelters.length} shelters total. Starting scrape...`);

  let totalCats = 0;
  let successCount = 0;

  for (const shelter of uniqueShelters) {
    try {
      console.log(`Scraping: ${stripControlChars(shelter.name)} (${stripControlChars(shelter.city)}) — ${stripControlChars(shelter.url)}`);
      const cats = await scrapeCatsActivity(shelter.url, shelter.id);
      
      if (cats.length > 0) {
        const saveDb = initializeDatabase(DB_PATH);
        saveCats(saveDb, shelter.id, cats);
        saveDb.close();
        totalCats += cats.length;
        successCount++;
        console.log(`  ✓ Found ${cats.length} animals`);
      } else {
        console.log(`  — No animals found (selectors didn't match)`);
      }
    } catch (err) {
      console.log(`  ✗ Error: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  console.log(`\nDone! Scraped ${totalCats} animals from ${successCount}/${uniqueShelters.length} shelters.`);
}

main().catch(console.error);
