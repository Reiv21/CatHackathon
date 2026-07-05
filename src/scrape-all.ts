/**
 * Full pipeline: scrape shelters + fetch additional sources + validate.
 */
import { execSync } from "child_process";
import { readFileSync, writeFileSync } from "fs";
import { fetchFromRegistry } from "./sources/registry.js";

console.log("=== Phase 1: Scraping configured shelters ===\n");
execSync("npx tsx src/scraper-v4.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n=== Phase 2: Additional sources ===\n");
try {
  const registryCats = await fetchFromRegistry();
  console.log(`Registry: fetched ${registryCats.length} cats`);

  if (registryCats.length > 0) {
    // Load current cats and merge
    const currentCats = JSON.parse(readFileSync("./data/cats.json", "utf-8"));
    const maxId = currentCats.length > 0
      ? Math.max(...currentCats.map((c: { id: number }) => c.id))
      : 0;

    const newCats = registryCats.map((c, i) => ({
      id: maxId + i + 1,
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

    const merged = [...currentCats, ...newCats];
    writeFileSync("./data/cats.json", JSON.stringify(merged, null, 2));
    console.log(`Merged: ${currentCats.length} + ${newCats.length} = ${merged.length} total`);
  }
} catch (err) {
  console.log(`Registry fetch failed: ${err instanceof Error ? err.message : err}`);
}

console.log("\n=== Phase 3: Validation ===\n");
execSync("npx tsx src/validate-data.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n✅ All done! Data is clean and ready.");
