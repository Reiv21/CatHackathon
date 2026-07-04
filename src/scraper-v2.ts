/**
 * Scraper v2 — smarter extraction with site-specific patterns.
 * Reads shelters from data/shelters.json, scrapes cats, writes to data/cats.json.
 */
import { readFileSync, writeFileSync } from "fs";
import * as cheerio from "cheerio";

interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  website_url: string | null;
  [key: string]: unknown;
}

interface CatResult {
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
}

function resolveUrl(base: string, relative: string | undefined | null): string | null {
  if (!relative) return null;
  if (relative.startsWith("data:")) return null;
  if (relative.startsWith("http")) return relative;
  if (relative.startsWith("//")) return "https:" + relative;
  try {
    return new URL(relative, base).href;
  } catch {
    return null;
  }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "pl,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

/**
 * Pattern: article/card elements with link + image + name
 * Works for: Kraków, Szczecin, Celestynów, Chorzów, etc.
 */
function extractCards($: cheerio.CheerioAPI, baseUrl: string): CatResult[] {
  const results: CatResult[] = [];
  
  // Try various card selectors
  const cardSelectors = [
    "article[class*='card']",
    "article[class*='animal']",
    "article[class*='pet']",
    "[class*='animal-card']",
    "[class*='pet-card']",
    "[class*='zwierz']",
    ".card-animal",
    ".pet-item",
    ".animal-item",
  ];

  for (const sel of cardSelectors) {
    const cards = $(sel);
    if (cards.length < 2) continue;

    cards.each((_, el) => {
      const $el = $(el);
      // Get link
      const link = $el.find("a[href]").first();
      const href = link.attr("href");
      // Get name from aria-label, title, heading, or link text
      const name =
        link.attr("aria-label") ||
        $el.find("h2, h3, h4, .name, [class*='name'], [class*='title']").first().text().trim() ||
        link.attr("title") ||
        link.text().trim();
      if (!name || name.length < 2 || name.length > 80) return;
      // Get image
      const img = $el.find("img").first();
      const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
      // Get description
      const desc = $el.find("p, .desc, [class*='desc']").first().text().trim();

      results.push({
        name,
        description: desc.slice(0, 300),
        image_url: resolveUrl(baseUrl, imgSrc),
        source_url: resolveUrl(baseUrl, href),
      });
    });
    if (results.length >= 2) return results;
  }

  return results;
}

/**
 * Pattern: Links with images (most common pattern)
 * Works for: most WordPress sites with galleries
 */
function extractLinksWithImages($: cheerio.CheerioAPI, baseUrl: string): CatResult[] {
  const results: CatResult[] = [];
  
  // Remove navigation/footer
  $("nav, footer, header, .menu, .navigation, .sidebar, script, style").remove();
  
  const mainContent = $("main, .content, #content, .site-content, article, .page-content").first();
  const scope = mainContent.length ? mainContent : $("body");

  // Find links that contain images
  scope.find("a[href]").each((_, el) => {
    const $a = $(el);
    const href = $a.attr("href");
    if (!href || href === "#" || href.includes("javascript:")) return;
    
    const img = $a.find("img").first();
    if (!img.length) return;
    
    const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
    if (!imgSrc || imgSrc.includes("logo") || imgSrc.includes("icon") || imgSrc.includes("banner")) return;
    
    const name =
      img.attr("alt") ||
      img.attr("title") ||
      $a.attr("title") ||
      $a.find("h2, h3, h4, .name, strong").first().text().trim() ||
      $a.text().trim();
    
    if (!name || name.length < 2 || name.length > 80) return;
    // Skip common non-animal links
    if (/logo|menu|banner|social|facebook|instagram|twitter/i.test(name)) return;
    if (/regulamin|polityka|kontakt|o nas|mapa/i.test(name)) return;
    
    results.push({
      name,
      description: "",
      image_url: resolveUrl(baseUrl, imgSrc),
      source_url: resolveUrl(baseUrl, href),
    });
  });

  return results;
}

/**
 * Pattern: WordPress posts (article.post with featured image)
 */
function extractWpPosts($: cheerio.CheerioAPI, baseUrl: string): CatResult[] {
  const results: CatResult[] = [];
  
  $("article.post, article.type-post, .post, .hentry").each((_, el) => {
    const $el = $(el);
    const titleEl = $el.find(".entry-title a, h2 a, h3 a").first();
    const name = titleEl.text().trim();
    if (!name || name.length < 2 || name.length > 80) return;
    
    const href = titleEl.attr("href");
    const img = $el.find("img").first();
    const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
    const desc = $el.find(".entry-content, .entry-summary, .excerpt").first().text().trim();
    
    results.push({
      name,
      description: desc.slice(0, 300),
      image_url: resolveUrl(baseUrl, imgSrc),
      source_url: resolveUrl(baseUrl, href),
    });
  });

  return results;
}

async function scrapeShelter(url: string): Promise<CatResult[]> {
  const html = await fetchHtml(url);
  if (!html) return [];
  
  const $ = cheerio.load(html);

  // Try strategies in order
  let results = extractCards($, url);
  if (results.length >= 2) return results;

  results = extractWpPosts($, url);
  if (results.length >= 2) return results;

  results = extractLinksWithImages($, url);
  if (results.length >= 2) return results;

  return [];
}

// Junk filter
const junkPatterns = [
  /znajd(ź|z) nowego/i,
  /dołącz do nas/i,
  /adoptuj zwierz/i,
  /facebook|instagram|twitter/i,
  /nowo przyjęci/i,
  /czytaj więcej|zobacz więcej|więcej inf/i,
  /^kot (on|ona)$/i, /^koty?$/i, /^psy?$/i,
  /apel o pomoc|potrzebujemy|zbiórka|darowizna/i,
  /newsletter|cookie|regulamin|polityka/i,
  /^prev|^next|strona \d/i,
];

function isJunk(name: string): boolean {
  return junkPatterns.some((p) => p.test(name.trim()));
}

async function main() {
  const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
  const withUrls = shelters.filter(
    (s) => s.website_url && s.website_url !== "null" && (s.website_url as string).startsWith("http")
  );

  console.log(`Scraping ${withUrls.length} shelters...\n`);

  interface FullCatRecord extends CatResult {
    id: number;
    shelter_id: number;
    shelter_name: string;
    shelter_city: string;
  }

  const allCats: FullCatRecord[] = [];
  let nextId = 1;
  let successCount = 0;

  for (const shelter of withUrls) {
    process.stdout.write(`${shelter.city.padEnd(22)} `);
    const results = await scrapeShelter(shelter.website_url as string);
    
    // Filter junk and require image OR source_url
    const good = results.filter(
      (r) => !isJunk(r.name) && (r.image_url || r.source_url) && r.name.length >= 2 && r.name.length <= 80
    );

    if (good.length > 0) {
      for (const cat of good) {
        allCats.push({
          id: nextId++,
          ...cat,
          shelter_id: shelter.id_zewnetrzne,
          shelter_name: shelter.name,
          shelter_city: shelter.city,
        });
      }
      successCount++;
      console.log(`✓ ${good.length} cats`);
    } else {
      console.log(`— (${results.length} raw, 0 after filter)`);
    }
  }

  // Deduplicate
  const seen = new Set<string>();
  const deduped = allCats.filter((c) => {
    const key = c.name.toLowerCase() + "|" + c.shelter_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((c, i) => ({ ...c, id: i + 1 }));

  writeFileSync("./data/cats.json", JSON.stringify(deduped, null, 2));
  
  // Update shelter counts
  const updated = shelters.map((s) => ({
    ...s,
    cat_count: deduped.filter((c) => c.shelter_id === s.id_zewnetrzne).length,
  }));
  writeFileSync("./data/shelters.json", JSON.stringify(updated, null, 2));

  console.log(`\n✅ Done! ${deduped.length} cats from ${successCount} shelters (after dedup + filter).`);
}

main().catch(console.error);
