/**
 * Scraper v3 — two-phase scraping with detail pages.
 * Phase 1: Get list of cat links from shelter pages
 * Phase 2: Visit each cat's detail page for full info
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

interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
  sex: string | null;
  age: string | null;
  chip: string | null;
}

function resolveUrl(base: string, relative: string | undefined | null): string | null {
  if (!relative) return null;
  if (relative.startsWith("data:")) return null;
  if (relative.startsWith("http")) return relative;
  if (relative.startsWith("//")) return "https:" + relative;
  try { return new URL(relative, base).href; } catch { return null; }
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "text/html",
        "Accept-Language": "pl,en;q=0.9",
      },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

// Phase 1: Extract links to individual cat pages
function extractCatLinks($: cheerio.CheerioAPI, baseUrl: string): string[] {
  const links = new Set<string>();

  // Strategy: find all links that look like animal detail pages
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) return;
    const resolved = resolveUrl(baseUrl, href);
    if (!resolved) return;
    // Must be same domain
    try {
      const linkDomain = new URL(resolved).hostname;
      const baseDomain = new URL(baseUrl).hostname;
      if (linkDomain !== baseDomain) return;
    } catch { return; }
    // Skip obvious non-animal pages
    if (/\/(kontakt|regulamin|polityka|o-nas|mapa|galeria|news|aktualnosc|category|tag|page\/\d|wp-content|wp-admin|feed|#)/i.test(resolved)) return;
    // Must not be the same page
    if (resolved === baseUrl || resolved === baseUrl + "/") return;
    links.add(resolved);
  });

  return Array.from(links);
}

// Phase 2: Extract cat details from a detail page
function extractCatDetail($: cheerio.CheerioAPI, url: string): Partial<CatRecord> | null {
  // Remove navigation
  $("nav, footer, header, .menu, .navigation, script, style").remove();

  const body = $("body").text();

  // Find name: first h1/h2, or title patterns
  let name =
    $("h1").first().text().trim() ||
    $("h2").first().text().trim() ||
    $(".entry-title").first().text().trim() ||
    $("title").text().split("|")[0].split("–")[0].split("-")[0].trim();

  // Clean name — remove numbers prefix like "106070 Felek"
  name = name.replace(/^\d+\s+/, "").trim();
  // Remove site name suffix
  name = name.replace(/\s*[-–|].*schronisk.*/i, "").trim();

  if (!name || name.length < 2 || name.length > 80) return null;

  // Find image
  const mainContent = $("main, .content, #content, article, .entry-content, .single-content").first();
  const scope = mainContent.length ? mainContent : $("body");
  const img = scope.find("img").first();
  const imgSrc = img.attr("data-src") || img.attr("data-lazy-src") || img.attr("src");
  const image_url = resolveUrl(url, imgSrc);

  // Find description: main paragraph text
  let description = "";
  scope.find("p").each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 30 && text.length > description.length && !text.includes("cookie")) {
      description = text;
    }
  });

  // Extract structured data
  let sex: string | null = null;
  let age: string | null = null;
  let chip: string | null = null;

  const textLower = body.toLowerCase();
  // Sex
  if (/płeć[:\s]*(samiec|kocur|kot)/i.test(body)) sex = "samiec";
  else if (/płeć[:\s]*(samica|kotka)/i.test(body)) sex = "samica";
  // Age / year
  const yearMatch = body.match(/rok urodzenia[:\s]*(\d{4})/i);
  if (yearMatch) age = yearMatch[1];
  // Chip
  const chipMatch = body.match(/nr chip[:\s]*(\d+)/i);
  if (chipMatch) chip = chipMatch[1];

  // Skip if this doesn't look like an animal page
  if (!image_url && description.length < 20) return null;
  // Skip junk
  if (/regulamin|polityka|kontakt|o nas|mapa strony|kategori/i.test(name)) return null;

  return { name, description: description.slice(0, 500), image_url, source_url: url, sex, age, chip };
}

// Heuristic: Is this link likely a cat detail page?
function isLikelyCatDetailLink(url: string, listUrl: string): boolean {
  // Same path prefix or specific patterns
  const urlLower = url.toLowerCase();
  if (/adopcj|zwierz|kot|cat|pet|animal|podopieczn/i.test(urlLower)) return true;
  // If it's a WordPress single post from the same domain
  if (urlLower.includes("/20") && urlLower.includes(".html")) return true;
  // If listUrl had "adopcje" and link is deeper
  if (/adopcj/i.test(listUrl) && url.startsWith(listUrl.replace(/[?#].*/, "").replace(/\/$/, ""))) return true;
  return false;
}

async function scrapeShelter(shelter: ShelterRecord): Promise<Partial<CatRecord>[]> {
  const url = shelter.website_url as string;
  const html = await fetchHtml(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  $("nav, footer, header, .menu, script, style").remove();

  // Phase 1: Get links
  const allLinks = extractCatLinks($, url);
  const catLinks = allLinks.filter((l) => isLikelyCatDetailLink(l, url));

  // If we have very few likely links, use all links (but limit)
  const linksToVisit = catLinks.length >= 3 ? catLinks : allLinks;
  const limited = linksToVisit.slice(0, 50); // Don't hit more than 50 pages per shelter

  if (limited.length === 0) return [];

  // Phase 2: Visit each detail page
  const results: Partial<CatRecord>[] = [];
  for (const link of limited) {
    const detailHtml = await fetchHtml(link);
    if (!detailHtml) continue;

    const detail$ = cheerio.load(detailHtml);
    const cat = extractCatDetail(detail$, link);
    if (cat && cat.name) {
      results.push(cat);
    }

    // Small delay to be polite
    await new Promise((r) => setTimeout(r, 200));
  }

  return results;
}

const junkNames = [
  /znajd(ź|z) nowego/i, /dołącz do nas/i, /adoptuj zwierz/i,
  /facebook|instagram/i, /czytaj więcej|zobacz więcej/i,
  /^koty?$/i, /^psy?$/i, /apel o pomoc|potrzebujemy|zbiórka/i,
  /newsletter|cookie|regulamin|polityka/i, /strona \d/i,
  /adopcja|do adopcji/i, /schronisko/i, /archiwum/i, /aktualności/i,
];

function isJunk(name: string): boolean {
  return junkNames.some((p) => p.test(name.trim()));
}

async function main() {
  const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
  const withUrls = shelters.filter(
    (s) => s.website_url && s.website_url !== "null" && (s.website_url as string).startsWith("http")
  );

  console.log(`Scraping ${withUrls.length} shelters (v3 deep mode)...\n`);

  const allCats: CatRecord[] = [];
  let nextId = 1;
  let successCount = 0;

  for (const shelter of withUrls) {
    process.stdout.write(`${shelter.city.padEnd(22)} `);
    const results = await scrapeShelter(shelter);

    const good = results.filter(
      (r) => r.name && !isJunk(r.name!) && r.name!.length >= 2 && r.name!.length <= 80
    );

    if (good.length > 0) {
      for (const cat of good) {
        allCats.push({
          id: nextId++,
          name: cat.name!,
          description: cat.description || "",
          image_url: cat.image_url || null,
          source_url: cat.source_url || null,
          shelter_id: shelter.id_zewnetrzne,
          shelter_name: shelter.name,
          shelter_city: shelter.city,
          sex: cat.sex || null,
          age: cat.age || null,
          chip: cat.chip || null,
        });
      }
      successCount++;
      console.log(`✓ ${good.length} cats (visited ${results.length} pages)`);
    } else {
      console.log(`— (${results.length} pages, 0 valid cats)`);
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

  const updated = shelters.map((s) => ({
    ...s,
    cat_count: deduped.filter((c) => c.shelter_id === s.id_zewnetrzne).length,
  }));
  writeFileSync("./data/shelters.json", JSON.stringify(updated, null, 2));

  console.log(`\n✅ Done! ${deduped.length} cats from ${successCount} shelters.`);
}

main().catch(console.error);
