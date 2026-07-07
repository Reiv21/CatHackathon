/**
 * One-time import script: reads shelters.json and cats.json from git history
 * and imports them into the SQLite database.
 *
 * Usage: npx tsx src/import-json-to-db.ts
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { initializeDatabase, upsertShelters, saveCats, type Shelter, type Cat } from "./db.js";

const DB_PATH = resolve(import.meta.dirname, "../shelter-sync.db");

// Read JSON files from /tmp (extracted from git)
const sheltersJson: Array<{
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
}> = JSON.parse(readFileSync("/tmp/old_shelters.json", "utf-8"));

const catsJson: Array<{
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
}> = JSON.parse(readFileSync("/tmp/old_cats.json", "utf-8"));

console.log(`Importing ${sheltersJson.length} shelters and ${catsJson.length} cats into ${DB_PATH}`);

const db = initializeDatabase(DB_PATH);

// Disable FK checks for import (some cats reference shelter_id=0 from Registry source)
db.pragma("foreign_keys = OFF");

// Import shelters
const shelters: Shelter[] = sheltersJson.map((s) => ({
  id_zewnetrzne: s.id_zewnetrzne,
  name: s.name,
  city: s.city,
  voivodeship: s.voivodeship,
  website_url: s.website_url,
}));

// Add a placeholder shelter for orphan cats (Registry source, id=0)
const shelterIds = new Set(shelters.map((s) => s.id_zewnetrzne));
const catShelterIds = new Set(catsJson.map((c) => c.shelter_id));
for (const sid of catShelterIds) {
  if (!shelterIds.has(sid)) {
    const sample = catsJson.find((c) => c.shelter_id === sid);
    shelters.push({
      id_zewnetrzne: sid,
      name: sample?.shelter_name || "Unknown",
      city: sample?.shelter_city || "Unknown",
      voivodeship: "",
      website_url: null,
    });
    console.log(`  Added placeholder shelter: ${sample?.shelter_name} (id=${sid})`);
  }
}

upsertShelters(db, shelters);
console.log(`✅ ${shelters.length} shelters imported`);

// Import cats grouped by shelter_id
const catsByShelter = new Map<number, Cat[]>();
for (const c of catsJson) {
  const cats = catsByShelter.get(c.shelter_id) || [];
  cats.push({
    shelter_id: c.shelter_id,
    name: c.name,
    description: c.description,
    image_url: c.image_url,
    source_url: c.source_url,
    sex: c.sex,
    age: c.age,
  });
  catsByShelter.set(c.shelter_id, cats);
}

let totalCats = 0;
for (const [shelterId, cats] of catsByShelter) {
  saveCats(db, shelterId, cats);
  totalCats += cats.length;
}
console.log(`✅ ${totalCats} cats imported across ${catsByShelter.size} shelters`);

// Re-enable FK checks
db.pragma("foreign_keys = ON");

db.close();
console.log("\n🎉 Import complete!");
