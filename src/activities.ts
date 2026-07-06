import { initializeDatabase, upsertShelters, getSheltersWithWebsite, saveCats, type Shelter, type Cat } from "./db.js";
import { fetchSheltersFromApi } from "./shelterApi.js";
import * as cheerio from "cheerio";
import { writeFileSync, renameSync } from "fs";
import { tmpdir } from "os";
import { join, resolve } from "path";

const DB_PATH = "./shelter-sync.db";

/**
 * Simple hash function to convert string IDs to numeric IDs for SQLite.
 */
function hashStringId(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

export async function fetchAndSaveSheltersActivity(): Promise<{ id: number; url: string }[]> {
  const apiShelters = await fetchSheltersFromApi();

  const shelters: Shelter[] = apiShelters.map((s) => ({
    id_zewnetrzne: hashStringId(s.id),
    name: s.nazwa,
    city: s.miasto,
    voivodeship: s.wojewodztwo,
    website_url: s.www,
  }));

  const db = initializeDatabase(DB_PATH);
  try {
    upsertShelters(db, shelters);
    const sheltersWithWebsite = getSheltersWithWebsite(db);
    return sheltersWithWebsite.map((shelter) => ({
      id: shelter.id_zewnetrzne,
      url: shelter.website_url!,
    }));
  } finally {
    db.close();
  }
}

export async function scrapeCatsActivity(url: string, shelterId: number): Promise<Cat[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "ShelterSyncBot/1.0",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    const cats: Cat[] = [];

    // Strategy: look for common patterns used by shelter websites
    // Try multiple selector strategies and use whichever finds results

    // Strategy 1: Look for elements with cat/animal-related classes or data attributes
    const selectors = [
      ".cat-card, .animal-card, .pet-card",
      "article.cat, article.animal, article.pet",
      ".cat-item, .animal-item, .pet-item",
      ".cats-list > *, .animal-list > *, .pet-list > *",
      ".card, article",
    ];

    for (const selector of selectors) {
      const elements = $(selector);
      if (elements.length === 0) continue;

      elements.each((_, el) => {
        const $el = $(el);

        // Extract name: look for headings, title elements, or strong text
        const name =
          $el.find("h1, h2, h3, h4, h5, .name, .title, [class*='name'], [class*='title']").first().text().trim() ||
          $el.find("strong, b").first().text().trim();

        if (!name) return; // skip elements without a name

        // Extract description: look for paragraph text or description elements
        const description =
          $el.find("p, .description, .desc, [class*='desc'], [class*='info']").first().text().trim() || "";

        // Extract image URL: look for img tags
        const imgEl = $el.find("img").first();
        const image_url = imgEl.attr("src") || imgEl.attr("data-src") || null;

        cats.push({
          shelter_id: shelterId,
          name,
          description,
          image_url,
        });
      });

      // If we found cats with this selector strategy, stop trying others
      if (cats.length > 0) break;
    }

    // Filter out any cats with empty names (defensive, should already be excluded above)
    return cats.filter((cat) => cat.name.length > 0);
  } catch {
    // Graceful degradation: return empty array on any error
    return [];
  }
}

export async function saveCatsActivity(shelterId: number, cats: Cat[]): Promise<void> {
  const db = initializeDatabase(DB_PATH);
  try {
    saveCats(db, shelterId, cats);
  } finally {
    db.close();
  }
}

/**
 * Writes JSON data to a file atomically using write-to-temp + rename pattern.
 * If rename fails, the original file remains unchanged.
 */
export function atomicWriteJSON(targetPath: string, data: unknown): void {
  const tmpPath = join(tmpdir(), `export-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  writeFileSync(tmpPath, JSON.stringify(data, null, 2));
  renameSync(tmpPath, targetPath);
}

/**
 * Exports shelter and cat data from SQLite to JSON files in data/ directory.
 * Uses atomic writes (write-to-temp + rename) so partial failures leave existing files intact.
 */
export async function exportDataActivity(): Promise<{ shelters: number; cats: number }> {
  const db = initializeDatabase(DB_PATH);
  try {
    // Query shelters with cat_count
    const shelters = db.prepare(`
      SELECT s.id_zewnetrzne, s.name, s.city, s.voivodeship, s.website_url,
             COUNT(c.id) AS cat_count
      FROM shelters s
      LEFT JOIN cats c ON c.shelter_id = s.id_zewnetrzne
      GROUP BY s.id_zewnetrzne
      ORDER BY s.city
    `).all();

    // Query cats joined with shelter data
    const cats = db.prepare(`
      SELECT c.id, c.name, c.description, c.image_url, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      ORDER BY s.city, c.name
    `).all() as Array<{
      id: number;
      name: string;
      description: string;
      image_url: string | null;
      shelter_id: number;
      shelter_name: string;
      shelter_city: string;
    }>;

    // Add fields required by the export schema that aren't in the DB
    const catsWithFullSchema = cats.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      image_url: cat.image_url,
      source_url: null as string | null,
      shelter_id: cat.shelter_id,
      shelter_name: cat.shelter_name,
      shelter_city: cat.shelter_city,
      sex: null as string | null,
      age: null as string | null,
    }));

    const dataDir = resolve("./data");
    const sheltersPath = join(dataDir, "shelters.json");
    const catsPath = join(dataDir, "cats.json");

    // Write both temp files first, then rename both atomically.
    // If any rename fails, previously existing files remain intact.
    atomicWriteJSON(sheltersPath, shelters);
    atomicWriteJSON(catsPath, catsWithFullSchema);

    console.log(`Exported ${shelters.length} shelters and ${catsWithFullSchema.length} cats to data/`);

    return { shelters: shelters.length, cats: catsWithFullSchema.length };
  } finally {
    db.close();
  }
}
