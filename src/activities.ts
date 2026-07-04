import { initializeDatabase, upsertShelters, getSheltersWithWebsite, saveCats, type Shelter, type Cat } from "./db.js";
import { fetchSheltersFromApi } from "./shelterApi.js";
import * as cheerio from "cheerio";

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
