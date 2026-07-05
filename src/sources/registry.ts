/**
 * Additional data sources integrated into the scraping pipeline.
 * Fetches from external registries that aggregate shelter data.
 */
import * as cheerio from "cheerio";

interface RegistryCat {
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  city: string;
  age: string | null;
  sex: string | null;
}

const BASE = "https://puszatek.pl";
const PAGES_TO_FETCH = 25; // fetch all pages

async function fetchPage(page: number): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(`${BASE}/pets.html/${page}?type=CAT`, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

function parsePage(html: string): RegistryCat[] {
  const $ = cheerio.load(html);
  const cats: RegistryCat[] = [];

  $(".pet-card-lite").each((_, el) => {
    const $card = $(el);
    const name = $card.find("h5.card-title").text().trim();
    if (!name || name.length < 2) return;

    const link = $card.find("a[href*='/zwierzak/']").attr("href");
    const img = $card.find("img.card-img-top").attr("src");
    
    // City from map marker icon text
    let city = "";
    $card.find("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text && !city && !text.includes("lat") && !text.includes("mies")) {
        city = text;
      }
    });

    // Age from calendar icon text
    let age: string | null = null;
    $card.find("p").each((_, p) => {
      const text = $(p).text().trim();
      if (text.includes("lat") || text.includes("mies")) {
        age = text;
      }
    });

    cats.push({
      name,
      description: "",
      image_url: img ? (img.startsWith("http") ? img : BASE + img) : null,
      source_url: link ? BASE + link : null,
      city,
      age,
      sex: null,
    });
  });

  return cats;
}

export async function fetchFromRegistry(): Promise<RegistryCat[]> {
  const allCats: RegistryCat[] = [];

  for (let page = 1; page <= PAGES_TO_FETCH; page++) {
    const html = await fetchPage(page);
    if (!html) break;
    const cats = parsePage(html);
    if (cats.length === 0) break;
    allCats.push(...cats);
    // Small delay
    await new Promise((r) => setTimeout(r, 300));
  }

  return allCats;
}
