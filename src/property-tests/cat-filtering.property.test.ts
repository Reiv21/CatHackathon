import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import { createApp } from "../server.js";
import { upsertShelters, saveCats } from "../db.js";
import type { Shelter, Cat } from "../db.js";

/**
 * Property 3: Cat filtering preserves filter invariants
 *
 * For any combination of search query, voivodeship filter, and sex filter
 * applied to GET /api/cats, every cat in the response SHALL match all active
 * filter criteria: the cat's name, shelter_name, or shelter_city contains the
 * search string; the cat's shelter_voivodeship matches the voivodeship filter;
 * and the cat's sex matches the sex filter.
 *
 * **Validates: Requirements 4.1, 4.5**
 */

// --- Fixed test data ---

const VOIVODESHIPS = [
  "mazowieckie",
  "małopolskie",
  "pomorskie",
  "dolnośląskie",
  "wielkopolskie",
  "śląskie",
] as const;

const SHELTERS: Shelter[] = [
  { id_zewnetrzne: 1, name: "Schronisko Warszawa", website_url: "https://warszawa.pl", city: "Warszawa", voivodeship: "mazowieckie" },
  { id_zewnetrzne: 2, name: "Kocia Przystań Kraków", website_url: "https://krakow.pl", city: "Kraków", voivodeship: "małopolskie" },
  { id_zewnetrzne: 3, name: "Azyl Gdańsk", website_url: "https://gdansk.pl", city: "Gdańsk", voivodeship: "pomorskie" },
  { id_zewnetrzne: 4, name: "Dom Kota Wrocław", website_url: "https://wroclaw.pl", city: "Wrocław", voivodeship: "dolnośląskie" },
  { id_zewnetrzne: 5, name: "Koci Raj Poznań", website_url: "https://poznan.pl", city: "Poznań", voivodeship: "wielkopolskie" },
  { id_zewnetrzne: 6, name: "Miauczek Katowice", website_url: "https://katowice.pl", city: "Katowice", voivodeship: "śląskie" },
];

const CAT_NAMES = [
  "Mruczek", "Filemon", "Kicia", "Puszek", "Luna",
  "Burek", "Cleo", "Felix", "Nala", "Simba",
  "Garfield", "Misiek", "Pyza", "Rudy", "Dymek",
  "Kleopatra", "Tygrys", "Miska", "Koko", "Pumba",
];

// Build cats across all shelters with known names and sexes
const ALL_CATS: Cat[] = [];
for (let i = 0; i < SHELTERS.length; i++) {
  const shelter = SHELTERS[i];
  for (let j = 0; j < CAT_NAMES.length; j++) {
    // Alternate sex: even => samiec, odd => samica, some null
    let sex: string | null;
    if (j % 3 === 0) sex = "samiec";
    else if (j % 3 === 1) sex = "samica";
    else sex = null;

    ALL_CATS.push({
      shelter_id: shelter.id_zewnetrzne,
      name: CAT_NAMES[j],
      description: `Cat ${CAT_NAMES[j]} in ${shelter.city}`,
      image_url: `https://img.example.com/${CAT_NAMES[j].toLowerCase()}.jpg`,
      source_url: null,
      sex,
      age: "2 lata",
    });
  }
}

// --- Arbitraries for filter combinations ---

// Search terms that may match cat names, shelter names, or shelter cities
const searchTermArbitrary = fc.oneof(
  fc.constant(""), // no search
  fc.constantFrom(
    // Substrings of cat names
    "mrucz", "fil", "kic", "pusz", "luna",
    "bur", "cleo", "felix", "nal", "sim",
    // Substrings of shelter names
    "schronisko", "przystań", "azyl", "dom kota", "raj", "miauczek",
    // Substrings of cities
    "warsz", "krak", "gdań", "wrocł", "pozn", "katow",
    // Something that won't match anything
    "zzzzz",
  ),
);

const voivodeshipFilterArbitrary = fc.oneof(
  fc.constant(""), // no filter
  fc.constantFrom(...VOIVODESHIPS),
);

const sexFilterArbitrary = fc.constantFrom("", "male", "female");

describe("Property: Cat filtering preserves filter invariants", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  it("every returned cat matches ALL active filter criteria", async () => {
    await fc.assert(
      fc.asyncProperty(
        searchTermArbitrary,
        voivodeshipFilterArbitrary,
        sexFilterArbitrary,
        async (search, voivodeship, sex) => {
          // Seed database with fixed data
          const { app, db: testDb } = createApp();
          db = testDb;

          upsertShelters(testDb, SHELTERS);
          for (const shelter of SHELTERS) {
            const shelterCats = ALL_CATS.filter((c) => c.shelter_id === shelter.id_zewnetrzne);
            saveCats(testDb, shelter.id_zewnetrzne, shelterCats);
          }

          // Build query params
          const params = new URLSearchParams();
          params.set("page", "1");
          params.set("limit", "50");
          if (search) params.set("search", search);
          if (voivodeship) params.set("voivodeship", voivodeship);
          if (sex) params.set("sex", sex);

          const res = await request(app).get(`/api/cats?${params.toString()}`);
          expect(res.status).toBe(200);

          const cats = res.body.cats as Array<{
            id: number;
            name: string;
            shelter_name: string;
            shelter_city: string;
            shelter_voivodeship: string | null;
            sex: string | null;
          }>;

          // Verify each returned cat matches ALL active filter criteria
          for (const cat of cats) {
            // Search filter check
            if (search) {
              const searchLower = search.toLowerCase();
              const nameMatch = cat.name.toLowerCase().includes(searchLower);
              const shelterNameMatch = cat.shelter_name.toLowerCase().includes(searchLower);
              const shelterCityMatch = cat.shelter_city.toLowerCase().includes(searchLower);
              expect(
                nameMatch || shelterNameMatch || shelterCityMatch,
                `Cat "${cat.name}" (shelter: "${cat.shelter_name}", city: "${cat.shelter_city}") does not match search "${search}"`,
              ).toBe(true);
            }

            // Voivodeship filter check
            if (voivodeship) {
              expect(
                cat.shelter_voivodeship?.toLowerCase(),
                `Cat "${cat.name}" has voivodeship "${cat.shelter_voivodeship}" but filter is "${voivodeship}"`,
              ).toBe(voivodeship.toLowerCase());
            }

            // Sex filter check: "male" → "samiec", "female" → "samica"
            if (sex === "male") {
              expect(
                cat.sex,
                `Cat "${cat.name}" has sex "${cat.sex}" but filter is "male" (samiec)`,
              ).toBe("samiec");
            } else if (sex === "female") {
              expect(
                cat.sex,
                `Cat "${cat.name}" has sex "${cat.sex}" but filter is "female" (samica)`,
              ).toBe("samica");
            }
          }

          testDb.close();
          db = undefined;
        },
      ),
      { numRuns: 50 },
    );
  });
});
