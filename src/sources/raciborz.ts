/**
 * Dedicated scraper for Racibórz shelter (pk-raciborz.pl).
 * Only picks entries with "(kocur)" or "(kotka)" in name — skips dogs.
 */
import * as cheerio from "cheerio";

interface RaciborzCat {
  name: string;
  description: string;
  image_url: string | null;
  source_url: string;
  sex: string | null;
  age: string | null;
}

const URL = "https://www.pk-raciborz.pl/site/index/5-schronisko.html";

export async function fetchRaciborz(): Promise<RaciborzCat[]> {
  try {
    const res = await fetch(URL, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
    });
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);

    const cats: RaciborzCat[] = [];

    // Find all table rows
    $("table.schronisko tr, table tr").each((_, row) => {
      const $row = $(row);
      const text = $row.text();

      // Only process rows that contain "(kocur)" or "(kotka)"
      if (!text.includes("(kocur)") && !text.includes("(kotka)")) return;

      const img = $row.find("img").first();
      const imgSrc = img.attr("src") || null;

      // Parse paragraphs
      const paragraphs: string[] = [];
      $row.find("p").each((_, p) => {
        const t = $(p).text().trim();
        if (t) paragraphs.push(t);
      });

      if (paragraphs.length < 1) return;

      // First paragraph: name with type, e.g. "BAZYL (kocur)"
      const nameLine = paragraphs[0];
      const name = nameLine.replace(/\s*\(kocur\)|\s*\(kotka\)/i, "").trim();
      const sex = nameLine.includes("(kocur)") ? "samiec" : "samica";

      // Second paragraph: year
      let age: string | null = null;
      const yearMatch = paragraphs.find((p) => /rok ur/i.test(p));
      if (yearMatch) {
        const m = yearMatch.match(/\d{4}/);
        if (m) age = m[0];
      }

      // Remaining paragraphs: description
      const desc = paragraphs
        .filter((p) => !p.includes("(kocur)") && !p.includes("(kotka)") && !/rok ur/i.test(p))
        .join(" ")
        .trim();

      if (name && name.length >= 2) {
        cats.push({
          name,
          description: desc.slice(0, 500),
          image_url: imgSrc,
          source_url: URL,
          sex,
          age,
        });
      }
    });

    return cats;
  } catch {
    return [];
  }
}
