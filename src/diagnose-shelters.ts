/**
 * Diagnoses shelter pages — shows what links are available and suggests selectors.
 * Helps fix scraper-config.json.
 */
import { readFileSync } from "fs";
import * as cheerio from "cheerio";

interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  website_url: string | null;
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15_000);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html", "Accept-Language": "pl" },
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return res.text();
  } catch { return null; }
}

function getDomain(url: string): string {
  try { return new URL(url).hostname.replace("www.", ""); } catch { return ""; }
}

async function diagnose(shelter: ShelterRecord) {
  const url = shelter.website_url!;
  const domain = getDomain(url);
  
  const html = await fetchHtml(url);
  if (!html) {
    console.log(`  ❌ Could not fetch`);
    return;
  }

  const $ = cheerio.load(html);
  $("nav, footer, header, script, style").remove();

  // Find all internal links
  const links: { href: string; text: string }[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    let resolved = href;
    if (!href.startsWith("http")) {
      try { resolved = new URL(href, url).href; } catch { return; }
    }
    if (!resolved.includes(domain)) return;
    if (resolved === url || resolved === url + "/") return;
    const text = $(el).text().trim().slice(0, 50);
    if (text) links.push({ href: resolved, text });
  });

  // Group by pattern
  const uniqueLinks = [...new Set(links.map(l => l.href))];
  const withText = links.filter(l => l.text.length > 2).slice(0, 20);

  console.log(`  Links found: ${uniqueLinks.length}`);
  console.log(`  Sample links with text:`);
  withText.slice(0, 8).forEach(l => {
    console.log(`    "${l.text}" → ${l.href.replace(url, "")}`);
  });
  
  // Count images
  const images = $("img").length;
  console.log(`  Images on page: ${images}`);
}

async function main() {
  const shelters: ShelterRecord[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
  const withUrls = shelters.filter(
    (s) => s.website_url && s.website_url !== "null" && (s.website_url as string).startsWith("http")
  );

  // Only diagnose ones that returned 0
  const zeroResults = [
    "Bielsko-Biała", "Bydgoszcz", "Chojnice", "Chorzów", "Częstochowa",
    "Gdańsk", "Gdynia", "Gniezno", "Katowice", "Koszalin", "Kunów",
    "Legionowo", "Luzino", "Mielec", "Nasielsk", "Nowiny",
    "Nowy Dwór Mazowiecki", "Oborniki", "Ostróda", "Poznań",
    "Puszcza Mariańska", "Puławy", "Radom", "Szczecin", "Tarnów",
    "Turek", "Zielona Góra", "Święciechowa", "Żywiec"
  ];

  const toCheck = withUrls.filter(s => zeroResults.includes(s.city));
  console.log(`Diagnosing ${toCheck.length} shelters that returned 0...\n`);

  for (const shelter of toCheck) {
    console.log(`${shelter.city} — ${shelter.website_url}`);
    await diagnose(shelter);
    console.log("");
  }
}

main().catch(console.error);
