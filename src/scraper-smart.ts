/**
 * Smart scraper with multiple strategies for Polish shelter websites.
 * Reads shelters from data/shelters.json, scrapes cats, writes to data/cats.json.
 */
import { readFileSync, writeFileSync } from "fs";
import * as cheerio from "cheerio";

interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  website_url: string | null;
}

interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
}

function resolveUrl(base: string, relative: string | undefined): string | null {
  if (!relative) return null;
  if (relative.startsWith("http")) return relative;
  if (relative.startsWith("//")) return "https:" + relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

/**
 * Strategy: WordPress-style cards (.entry, .post, article with h2/h3 + img)
 */
function strategyWordPress($: cheerio.CheerioAPI, baseUrl: string): CatRecord[] {
  const cats: CatRecord[] = [];
  const selectors = [
    "article.post",
    ".entry",
    ".post",
    ".type-post",
    ".wp-block-post",
    ".elementor-post",
  ];

  for (const sel of selectors) {
    $(sel).each((_, el) => {
      const $el = $(el);
      const name = $el.find("h2 a, h3 a, h2, h3, .entry-title").first().text().trim();
      if (!name || name.length > 200) return;
      const desc = $el.find(".entry-content p, .entry-summary p, .excerpt, p").first().text().trim();
      const img = $el.find("img").first();
      const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
      cats.push({
        id: 0,
        name,
        description: desc.slice(0, 500),
        image_url: resolveUrl(baseUrl, imgSrc),
        shelter_id: 0,
        shelter_name: "",
        shelter_city: "",
      });
    });
    if (cats.length > 0) return cats;
  }
  return cats;
}

/**
 * Strategy: Grid/card layouts (.card, .animal-card, .pet-card, etc.)
 */
function strategyCards($: cheerio.CheerioAPI, baseUrl: string): CatRecord[] {
  const cats: CatRecord[] = [];
  const selectors = [
    ".card",
    ".animal-card",
    ".pet-card",
    ".cat-card",
    ".zwierze",
    ".animal",
    ".pet-item",
    ".adoptuj-item",
    ".zwierzak",
    "[class*='animal']",
    "[class*='zwierz']",
    "[class*='adopt']",
  ];

  for (const sel of selectors) {
    const elements = $(sel);
    if (elements.length < 2) continue;

    elements.each((_, el) => {
      const $el = $(el);
      const name =
        $el.find("h2, h3, h4, .name, .title, [class*='name'], [class*='title'], strong").first().text().trim() ||
        $el.find("a").first().text().trim();
      if (!name || name.length > 200) return;
      const desc = $el.find("p, .description, .desc, [class*='desc']").first().text().trim();
      const img = $el.find("img").first();
      const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
      cats.push({
        id: 0,
        name,
        description: desc.slice(0, 500),
        image_url: resolveUrl(baseUrl, imgSrc),
        shelter_id: 0,
        shelter_name: "",
        shelter_city: "",
      });
    });
    if (cats.length > 0) return cats;
  }
  return cats;
}

/**
 * Strategy: Gallery with figure/figcaption or img + adjacent text
 */
function strategyGallery($: cheerio.CheerioAPI, baseUrl: string): CatRecord[] {
  const cats: CatRecord[] = [];
  
  // figure with figcaption
  $("figure").each((_, el) => {
    const $el = $(el);
    const caption = $el.find("figcaption").text().trim();
    const img = $el.find("img").first();
    const imgSrc = img.attr("data-src") || img.attr("src");
    const name = caption || img.attr("alt") || img.attr("title") || "";
    if (!name || name.length > 200) return;
    cats.push({
      id: 0,
      name,
      description: "",
      image_url: resolveUrl(baseUrl, imgSrc),
      shelter_id: 0,
      shelter_name: "",
      shelter_city: "",
    });
  });
  if (cats.length > 2) return cats;

  // .gallery-item pattern
  cats.length = 0;
  $(".gallery-item, .gallery-icon").each((_, el) => {
    const $el = $(el);
    const img = $el.find("img").first();
    const imgSrc = img.attr("data-src") || img.attr("src");
    const name = img.attr("alt") || img.attr("title") || $el.find(".gallery-caption").text().trim() || "";
    if (!name) return;
    cats.push({
      id: 0,
      name,
      description: "",
      image_url: resolveUrl(baseUrl, imgSrc),
      shelter_id: 0,
      shelter_name: "",
      shelter_city: "",
    });
  });
  return cats;
}

/**
 * Strategy: Table rows (some shelters use tables)
 */
function strategyTable($: cheerio.CheerioAPI, baseUrl: string): CatRecord[] {
  const cats: CatRecord[] = [];
  $("table tr").each((i, el) => {
    if (i === 0) return; // skip header
    const $el = $(el);
    const cells = $el.find("td");
    if (cells.length < 2) return;
    const name = $(cells[0]).text().trim() || $(cells[1]).text().trim();
    if (!name || name.length > 200) return;
    const img = $el.find("img").first();
    const imgSrc = img.attr("data-src") || img.attr("src");
    const desc = cells.length > 2 ? $(cells[2]).text().trim() : "";
    cats.push({
      id: 0,
      name,
      description: desc,
      image_url: resolveUrl(baseUrl, imgSrc),
      shelter_id: 0,
      shelter_name: "",
      shelter_city: "",
    });
  });
  return cats;
}

/**
 * Strategy: Any repeated element with img + text (fallback)
 */
function strategyRepeatedElements($: cheerio.CheerioAPI, baseUrl: string): CatRecord[] {
  const cats: CatRecord[] = [];
  
  // Look for any container that has multiple children with images
  const containers = $("main, .content, .container, #content, [role='main'], .page-content, .site-content");
  const target = containers.length > 0 ? containers.first() : $("body");
  
  target.find("a").each((_, el) => {
    const $el = $(el);
    const img = $el.find("img").first();
    if (!img.length) return;
    const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
    if (!imgSrc) return;
    const name = img.attr("alt") || img.attr("title") || $el.attr("title") || $el.text().trim();
    if (!name || name.length > 200 || name.length < 2) return;
    // Skip navigation/logo images
    if (name.toLowerCase().includes("logo") || name.toLowerCase().includes("menu")) return;
    cats.push({
      id: 0,
      name,
      description: "",
      image_url: resolveUrl(baseUrl, imgSrc),
      shelter_id: 0,
      shelter_name: "",
      shelter_city: "",
    });
  });
  
  return cats;
}

async function scrapeShelter(url: string): Promise<CatRecord[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; ShelterSyncBot/2.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pl,en;q=0.9",
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return [];

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove navigation, footer, scripts
    $("nav, footer, script, style, header, .navigation, .menu, .sidebar, .footer, .header").remove();

    // Filter function: remove entries that are clearly not animal names
    const isJunkEntry = (name: string): boolean => {
      const junkPatterns = [
        /^(Imię|Gatunek|Płeć|Opis|Rozmiar|Data urodzenia|Data przyjęcia|Kwarantanna|Gmina|Inne|Wiek|Status|Nr chip|Rasa|Kolor|Sterylizacja|Numer|Oddział):?$/i,
        /^(Szukaj|Filtruj|Sortuj|Strona|Następna|Poprzednia|Pokaż|Zamknij|Menu|Kontakt|O nas|Regulamin)$/i,
        /^[\d\s./-]+$/, // only numbers/dates
        /^.{0,1}$/, // single char or empty
      ];
      return junkPatterns.some((p) => p.test(name.trim()));
    };

    // Try strategies in order (most specific to least specific)
    let cats = strategyCards($, url);
    if (cats.length >= 2) return cats.filter((c) => !isJunkEntry(c.name));

    cats = strategyWordPress($, url);
    if (cats.length >= 2) return cats.filter((c) => !isJunkEntry(c.name));

    cats = strategyGallery($, url);
    if (cats.length >= 2) return cats.filter((c) => !isJunkEntry(c.name));

    cats = strategyTable($, url);
    if (cats.length >= 2) return cats.filter((c) => !isJunkEntry(c.name));

    cats = strategyRepeatedElements($, url);
    if (cats.length >= 2) return cats.filter((c) => !isJunkEntry(c.name));

    return [];
  } catch {
    return [];
  }
}

async function main() {
  const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
  const withUrls = shelters.filter(
    (s) => s.website_url && s.website_url !== "null" && s.website_url.startsWith("http")
  );

  console.log(`Found ${withUrls.length} shelters with valid URLs. Starting smart scrape...\n`);

  const allCats: CatRecord[] = [];
  let nextId = 1;
  let successCount = 0;

  for (const shelter of withUrls) {
    process.stdout.write(`${shelter.city} (${shelter.name.slice(0, 40)})... `);
    const cats = await scrapeShelter(shelter.website_url!);

    if (cats.length > 0) {
      for (const cat of cats) {
        cat.id = nextId++;
        cat.shelter_id = shelter.id_zewnetrzne;
        cat.shelter_name = shelter.name;
        cat.shelter_city = shelter.city;
      }
      allCats.push(...cats);
      successCount++;
      console.log(`✓ ${cats.length} cats`);
    } else {
      console.log(`— no results`);
    }
  }

  // Update cat_count in shelters
  const updatedShelters = shelters.map((s) => ({
    ...s,
    cat_count: allCats.filter((c) => c.shelter_id === s.id_zewnetrzne).length,
  }));

  writeFileSync("./data/cats.json", JSON.stringify(allCats, null, 2));
  writeFileSync("./data/shelters.json", JSON.stringify(updatedShelters, null, 2));

  console.log(`\n✅ Done! ${allCats.length} cats from ${successCount}/${withUrls.length} shelters.`);
  console.log(`   Saved to data/cats.json and updated data/shelters.json`);
}

main().catch(console.error);
