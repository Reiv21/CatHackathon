/**
 * Full pipeline: scrape shelters + fetch additional sources + validate.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { fetchFromRegistry } from "./sources/registry.js";
import { fetchRaciborz } from "./sources/raciborz.js";

console.log("=== Phase 1: Scraping configured shelters ===\n");
execSync("npx tsx src/scraper-v4.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n=== Phase 2: Additional sources ===\n");
try {
  // Registry (puszatek)
  const registryCats = await fetchFromRegistry();
  console.log(`Registry: fetched ${registryCats.length} cats`);

  // Racibórz (dedicated scraper)
  const raciborzCats = await fetchRaciborz();
  console.log(`Racibórz: fetched ${raciborzCats.length} cats`);

  // Load current cats and merge
  const currentCats = JSON.parse(readFileSync("./data/cats.json", "utf-8"));
  const maxId = currentCats.length > 0
    ? Math.max(...currentCats.map((c: { id: number }) => c.id))
    : 0;

  let nextId = maxId + 1;

  const registryMapped = registryCats.map((c) => ({
    id: nextId++,
    name: c.name,
    description: c.description,
    image_url: c.image_url,
    source_url: c.source_url,
    shelter_id: 0,
    shelter_name: "Registry",
    shelter_city: c.city,
    sex: c.sex,
    age: c.age,
  }));

  const raciborzMapped = raciborzCats.map((c) => ({
    id: nextId++,
    name: c.name,
    description: c.description,
    image_url: c.image_url,
    source_url: c.source_url,
    shelter_id: 1077175817, // Racibórz shelter ID from shelters.json
    shelter_name: "Schronisko dla Zwierząt w Raciborzu",
    shelter_city: "Racibórz",
    sex: c.sex,
    age: c.age,
  }));

  const merged = [...currentCats, ...registryMapped, ...raciborzMapped];
  writeFileSync("./data/cats.json", JSON.stringify(merged, null, 2));
  console.log(`Merged: ${currentCats.length} + ${registryMapped.length} + ${raciborzMapped.length} = ${merged.length} total`);
} catch (err) {
  console.log(`Additional sources failed: ${err instanceof Error ? err.message : err}`);
}

console.log("\n=== Phase 3: Validation ===\n");
execSync("npx tsx src/validate-data.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n✅ All done! Data is clean and ready.");
