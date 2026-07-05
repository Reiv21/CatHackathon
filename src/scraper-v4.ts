/**
 * Scraper v4 — config-driven per-site scraping.
 * Uses scraper-config.json for CSS selectors per domain.
 * Falls back to generic heuristics for unconfigured sites.
 */
import { readFileSync, writeFileSync } from "fs";
import * as cheerio from "cheerio";

interface SiteConfig {
  listSelector: string;
  nameSelector?: string;
  nameFromAttr?: string;
  nameCleanRegex?: string;
  imageSelector?: string;
  descSelector?: string;
  skipPatterns?: string[];
}

interface ScraperConfig {
  sites: Record<string, SiteConfig>;
  globalFilters: {
    skipNames: string[];
    skipImagePatterns: string[];
  };
}

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
}

const config: ScraperConfig = JSON.parse(readFileSync("./scraper-config.json", "utf-8"));

function resolveUrl(base: string, relative: string | undefined | null): string | null {
  if (!relative) return null;
  if (relative.startsWith("data:")) return null;
  if (relative.startsWith("http")) return relative;
  if (relative.startsWith("//")) return "https:" + relative;
  try { return new URL(relative, base).href; } catch { return null; }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

function isSkipName(name: string): boolean {
  const lower = name.toLowerCase().trim();
  return config.globalFilters.skipNames.some((s) => lower.includes(s));
}

function isSkipImage(url: string): boolean {
  const lower = url.toLowerCase();
  return config.globalFilters.skipImagePatterns.some((p) => lower.includes(p));
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

// Extract detail from a single cat page using config
function extractDetail($: cheerio.CheerioAPI, url: string, siteConf: SiteConfig | null): Partial<CatRecord> | null {
  $("nav, footer, header, .menu, .navigation, script, style, .sidebar").remove();

  // Name
  let name = "";
  if (siteConf?.nameFromAttr) {
    // Used in list phase, skip here
  }
  if (siteConf?.nameSelector) {
    name = $(siteConf.nameSelector).first().text().trim();
  } else {
    name = $("h1").first().text().trim() || $("h2").first().text().trim();
  }
  if (siteConf?.nameCleanRegex) {
    name = name.replace(new RegExp(siteConf.nameCleanRegex), "").trim();
  }
  // Generic cleaning
  name = name.replace(/^\d+\s+/, "").trim();
  name = name.replace(/\s*[-–|].*schronisk.*/i, "").trim();
  name = name.replace(/\s*[-–|].*adopcj.*/i, "").trim();

  if (!name || name.length < 2 || name.length > 80) return null;
  if (isSkipName(name)) return null;

  // Image
  let image_url: string | null = null;
  const imgSel = siteConf?.imageSelector || "main img, article img, .content img, .entry-content img";
  $(imgSel).each((_, el) => {
    if (image_url) return;
    const $img = $(el);
    const src = $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("src");
    const resolved = resolveUrl(url, src);
    if (resolved && !isSkipImage(resolved)) {
      // Skip banners: width > 3x height means it's a thin banner
      const w = parseInt($img.attr("width") || "0", 10);
      const h = parseInt($img.attr("height") || "0", 10);
      if (w > 0 && h > 0 && w > h * 3) return; // skip wide banners
      image_url = resolved;
    }
  });

  // Fallback: try ANY image on page that's from uploads and not a banner
  if (!image_url) {
    $("body").find("img[src*='uploads'], img[src*='photo'], img[src*='images']").each((_, el) => {
      if (image_url) return;
      const $img = $(el);
      const src = $img.attr("data-src") || $img.attr("data-lazy-src") || $img.attr("src");
      const resolved = resolveUrl(url, src);
      if (resolved && !isSkipImage(resolved)) {
        const w = parseInt($img.attr("width") || "0", 10);
        const h = parseInt($img.attr("height") || "0", 10);
        if (w > 0 && h > 0 && w > h * 3) return;
        image_url = resolved;
      }
    });
  }

  // Description
  let description = "";
  const descSel = siteConf?.descSelector || "main p, article p, .content p, .entry-content p";
  $(descSel).each((_, el) => {
    if (description.length > 200) return;
    const text = $(el).text().trim();
    if (text.length > 30 && !text.toLowerCase().includes("cookie") && !text.toLowerCase().includes("polityk")) {
      description = description ? description + " " + text : text;
    }
  });

  // Metadata
  const bodyText = $("body").text();
  let sex: string | null = null;
  let age: string | null = null;
  if (/płeć[:\s]*(samiec|kocur)/i.test(bodyText)) sex = "samiec";
  else if (/płeć[:\s]*(samica|kotka)/i.test(bodyText)) sex = "samica";
  else if (/\bkot\b.*ur\./i.test(bodyText)) sex = "samiec";
  else if (/\bkotka\b.*ur\./i.test(bodyText)) sex = "samica";
  const yearMatch = bodyText.match(/(?:rok urodzenia|ur\.?)[:\s]*(?:w\s+)?(?:\w+\s+)?(\d{4})/i);
  if (yearMatch) age = yearMatch[1];

  // Skip check
  if (siteConf?.skipPatterns) {
    const nameLower = name.toLowerCase();
    if (siteConf.skipPatterns.some((p) => nameLower.includes(p))) return null;
  }

  return { name, description: description.slice(0, 500), image_url, source_url: url, sex, age };
}

async function scrapeShelter(shelter: ShelterRecord): Promise<CatRecord[]> {
  const url = shelter.website_url as string;
  const domain = getDomain(url);
  const siteConf = config.sites[domain] || null;

  const html = await fetchHtml(url);
  if (!html) return [];
  const $ = cheerio.load(html);

  // Phase 1: Get links to detail pages — ONLY use configured selector
  const listSel = siteConf?.listSelector || "a[href]";
  const links: string[] = [];

  // Skip disabled sites
  if (listSel.startsWith("DISABLED")) {
    return [];
  }

  $(listSel).each((_, el) => {
    const href = $(el).attr("href");
    const resolved = resolveUrl(url, href);
    if (resolved && resolved !== url && resolved !== url + "/") {
      if (getDomain(resolved) === domain) links.push(resolved);
    }
  });

  // Also handle nameFromAttr (e.g. Kraków)
  const ariaNames = new Map<string, string>();
  if (siteConf?.nameFromAttr) {
    $(listSel).each((_, el) => {
      const href = resolveUrl(url, $(el).attr("href"));
      const attrName = $(el).attr(siteConf.nameFromAttr!);
      if (href && attrName) ariaNames.set(href, attrName);
    });
  }

  const uniqueLinks = [...new Set(links)].slice(0, 60);
  if (uniqueLinks.length === 0) return [];

  // Phase 2: Visit detail pages
  const results: CatRecord[] = [];
  for (const link of uniqueLinks) {
    const detailHtml = await fetchHtml(link);
    if (!detailHtml) continue;

    const detail$ = cheerio.load(detailHtml);
    const cat = extractDetail(detail$, link, siteConf);
    if (!cat) continue;

    // Override name from aria-label if available
    if (ariaNames.has(link)) {
      cat.name = ariaNames.get(link)!;
    }

    if (cat.name && !isSkipName(cat.name)) {
      results.push({
        id: 0,
        name: cat.name,
        description: cat.description || "",
        image_url: cat.image_url || null,
        source_url: link,
        shelter_id: shelter.id_zewnetrzne,
        shelter_name: shelter.name,
        shelter_city: shelter.city,
        sex: cat.sex || null,
        age: cat.age || null,
      });
    }

    await new Promise((r) => setTimeout(r, 150));
  }

  return results;
}

async function main() {
  const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
  const withUrls = shelters.filter(
    (s) => s.website_url && s.website_url !== "null" && (s.website_url as string).startsWith("http")
  );

  console.log(`Scraper v4 — ${withUrls.length} shelters, ${Object.keys(config.sites).length} configured\n`);

  const allCats: CatRecord[] = [];
  let successCount = 0;

  for (const shelter of withUrls) {
    const domain = getDomain(shelter.website_url as string);
    const hasConfig = domain in config.sites;
    process.stdout.write(`${shelter.city.padEnd(22)} ${hasConfig ? "⚙" : "?"} `);

    const cats = await scrapeShelter(shelter);
    if (cats.length > 0) {
      allCats.push(...cats);
      successCount++;
      console.log(`✓ ${cats.length} cats`);
    } else {
      console.log("—");
    }
  }

  // Deduplicate + re-index
  const seen = new Set<string>();
  const deduped = allCats.filter((c) => {
    const key = c.name.toLowerCase() + "|" + c.shelter_id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((c, i) => ({ ...c, id: i + 1 }));

  writeFileSync("./data/cats.json", JSON.stringify(deduped, null, 2));

  console.log(`\n✅ ${deduped.length} cats from ${successCount} shelters.`);
}

main().catch(console.error);
