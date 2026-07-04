/**
 * Exports current DB data to editable JSON files in /data folder.
 */
import { writeFileSync } from "fs";
import { initializeDatabase } from "./db.js";

const DB_PATH = "./shelter-sync.db";
const db = initializeDatabase(DB_PATH);

// Export shelters
const shelters = db.prepare(`
  SELECT s.id_zewnetrzne, s.name, s.city, s.voivodeship, s.website_url,
         COUNT(c.id) AS cat_count
  FROM shelters s
  LEFT JOIN cats c ON c.shelter_id = s.id_zewnetrzne
  GROUP BY s.id_zewnetrzne
  ORDER BY s.city
`).all();

writeFileSync("./data/shelters.json", JSON.stringify(shelters, null, 2));
console.log(`Exported ${shelters.length} shelters to data/shelters.json`);

// Export cats
const cats = db.prepare(`
  SELECT c.id, c.name, c.description, c.image_url, c.shelter_id,
         s.name AS shelter_name, s.city AS shelter_city
  FROM cats c
  JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
  ORDER BY s.city, c.name
`).all();

writeFileSync("./data/cats.json", JSON.stringify(cats, null, 2));
console.log(`Exported ${cats.length} cats to data/cats.json`);

db.close();
console.log("\nDone! Edit data/shelters.json and data/cats.json to manage your data.");
console.log("The API server will read from these files instead of SQLite.");
