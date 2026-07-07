/**
 * Quick DB query script. Run: npx tsx src/query-db.ts
 */
import { initializeDatabase } from "./db.js";
import { stripControlChars } from "./validation.js";

const db = initializeDatabase("./shelter-sync.db");

console.log("\n🐱 CATS IN DATABASE:\n");
const cats = db.prepare("SELECT c.name, c.description, c.image_url, s.name as shelter_name FROM cats c JOIN shelters s ON c.shelter_id = s.id_zewnetrzne").all() as Array<{name: string; description: string; image_url: string | null; shelter_name: string}>;

for (const cat of cats) {
  console.log(`  🐈 ${stripControlChars(cat.name)} (${stripControlChars(cat.shelter_name)})`);
  if (cat.description) console.log(`     ${stripControlChars(cat.description)}`);
  if (cat.image_url) console.log(`     🖼️  ${stripControlChars(cat.image_url)}`);
  console.log();
}

console.log(`Total: ${cats.length} cats in DB`);
db.close();
