/**
 * Standalone script to fetch shelter data, scrape cats, and display results.
 * Run with: npx tsx src/inspect.ts
 *
 * No Temporal server required — calls functions directly.
 */

import { fetchSheltersFromApi } from "./shelterApi.js";
import { initializeDatabase, upsertShelters, getSheltersWithWebsite, saveCats, type Shelter } from "./db.js";
import { scrapeCatsActivity } from "./activities.js";

const DB_PATH = "./shelter-sync.db";

function hashStringId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function main() {
  console.log("=== Shelter Sync — Manual Inspection ===\n");

  // Step 1: Fetch shelters from API
  console.log("📡 Fetching shelters from otwarteschroniska.org.pl...");
  let apiShelters;
  try {
    apiShelters = await fetchSheltersFromApi();
  } catch (err) {
    console.error("❌ Failed to fetch shelters:", err instanceof Error ? err.message : err);
    process.exit(1);
  }

  console.log(`✅ Fetched ${apiShelters.length} shelters from API\n`);

  // Map to internal format
  const shelters: Shelter[] = apiShelters.map((s) => ({
    id_zewnetrzne: hashStringId(s.id),
    name: s.nazwa,
    city: s.miasto,
    voivodeship: s.wojewodztwo,
    website_url: s.www,
  }));

  // Step 2: Save to database
  const db = initializeDatabase(DB_PATH);
  upsertShelters(db, shelters);
  const withWebsite = getSheltersWithWebsite(db);

  console.log("🏠 Shelters summary:");
  console.log(`   Total: ${shelters.length}`);
  console.log(`   With website: ${withWebsite.length}`);
  console.log(`   Without website: ${shelters.length - withWebsite.length}\n`);

  // Step 3: Display all shelters
  console.log("━".repeat(80));
  console.log("📋 ALL SHELTERS:");
  console.log("━".repeat(80));

  for (const s of apiShelters) {
    console.log(`  [${s.id}] ${s.nazwa}`);
    console.log(`      📍 ${s.miasto}, ${s.wojewodztwo}`);
    console.log(`      🌐 ${s.www || "(brak strony)"}`);
    if (s.telefon) console.log(`      📞 ${s.telefon}`);
    if (s.email) console.log(`      ✉️  ${s.email}`);
    console.log();
  }

  // Step 4: Scrape cats from first few shelters with websites
  const MAX_SCRAPE = 3;
  const toScrape = withWebsite.slice(0, MAX_SCRAPE);

  if (toScrape.length > 0) {
    console.log("━".repeat(80));
    console.log(`🐱 SCRAPING CATS (first ${toScrape.length} shelters with websites):`);
    console.log("━".repeat(80));

    for (const shelter of toScrape) {
      console.log(`\n  Scraping: ${shelter.name} (${shelter.website_url})...`);
      const cats = await scrapeCatsActivity(shelter.website_url!, shelter.id_zewnetrzne);

      if (cats.length === 0) {
        console.log("    ⚠️  No cats found (page structure might not match selectors)");
      } else {
        saveCats(db, shelter.id_zewnetrzne, cats);
        console.log(`    ✅ Found ${cats.length} cats:`);
        for (const cat of cats.slice(0, 10)) {
          console.log(`       🐈 ${cat.name}`);
          if (cat.description) console.log(`          ${cat.description.slice(0, 80)}${cat.description.length > 80 ? "..." : ""}`);
          if (cat.image_url) console.log(`          🖼️  ${cat.image_url}`);
        }
        if (cats.length > 10) {
          console.log(`       ... and ${cats.length - 10} more`);
        }
      }
    }
  }

  // Step 5: Show DB stats
  console.log("\n" + "━".repeat(80));
  console.log("📊 DATABASE STATS:");
  console.log("━".repeat(80));
  const shelterCount = (db.prepare("SELECT COUNT(*) as count FROM shelters").get() as { count: number }).count;
  const catCount = (db.prepare("SELECT COUNT(*) as count FROM cats").get() as { count: number }).count;
  console.log(`   Shelters in DB: ${shelterCount}`);
  console.log(`   Cats in DB: ${catCount}`);
  console.log(`   DB file: ${DB_PATH}`);

  db.close();
  console.log("\n✅ Done! Database saved to", DB_PATH);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
