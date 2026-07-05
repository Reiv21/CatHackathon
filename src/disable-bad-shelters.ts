/**
 * Disables shelters whose URLs produce garbage results.
 * These sites don't have cat-specific pages or mix dogs/blog posts.
 */
import { readFileSync, writeFileSync } from "fs";

const DISABLE_DOMAINS = [
  "schronisko-cieszyn.pl",
  "reksio.cdmedia.pl",
  "schroniskokonin.pl",
  "schroniskogaj.pl",
  "coz.mzk.grudziadz.pl",
  "schronisko.olsztyn.pl",
  "schronisko.opole.pl",
  "schronisko.sosnowiec.pl",
  "e-sochaczew.pl",
  "psitulmnie.pl",
  "schronisko.wloclawek.eu",
  "kundelek.rsoz.org",
  "schronisko-torun.oinfo.pl",
  "schronisko.jgora.pl",
  "schronisko-skalowo.pl",
  "schronisko.walbrzych.pl",
  "czekadelko.pl",
  // v5 disables — produce garbage
  "schroniskopromyk.pl",        // blog posts, dates, not cat pages
  "schronisko.info.pl",         // categories (kozy, krowy, lisy...)
  "futrzanylos.pl",             // monthly archives, not cats
  "schronisko.org.pl",          // mixes in dates/authors
  "schronisko.szczecin.pl",     // 242 links, mostly navigation
  "schroniskoturek.pl",         // JS-rendered, 0 content
  "schronisko.leszno.pl",       // cannot fetch
  "schroniskochorzow.pl",       // blog posts (muzykoterapia etc)
  "schronisko-katowice.eu",     // mixed content
  "schroniskoostroda.pl",       // bad results
  "schroniskoostrow.pl",        // categories (psiaki, koty wolnożyjące)
  "ciapkowo.pl",                // JS-rendered
  "schroniskogniezno.pl",       // bad selectors
  "schronisko-koszalin.pl",     // empty results
  "schronisko.radom.pl",        // navigation links
  "zwierzaki.pulawy.pl",        // 0 links found
  "schronisko-jozefow.pl",      // empty
  "schroniskodabrowka.pl",      // empty
  "oazadlazwierzat.mielec.pl",  // empty
  "stowarzyszenienasielsk.pl",  // empty
  "schroniskoogonki.pl",        // empty
  "fundacjapsom.pl",            // empty
  "schroniskoazorek.pl",        // empty
  "schronisko.com",             // empty
];

interface Shelter {
  website_url: string | null;
  [key: string]: unknown;
}

const shelters: Shelter[] = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));

let disabled = 0;
const updated = shelters.map((s) => {
  if (!s.website_url || s.website_url === "null") return s;
  const domain = new URL(s.website_url as string).hostname.replace("www.", "");
  if (DISABLE_DOMAINS.includes(domain)) {
    disabled++;
    return { ...s, website_url: null };
  }
  return s;
});

writeFileSync("./data/shelters.json", JSON.stringify(updated, null, 2));
console.log(`Disabled ${disabled} problematic shelters.`);
