import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "../server.js";
import { upsertShelters, saveCats } from "../db.js";
import type { Shelter, Cat } from "../db.js";

/**
 * Property 4: Stats counts are consistent with database contents
 *
 * For any set of shelters and cats in the database, GET /api/stats SHALL return
 * totalCats equal to the total number of cat records, totalShelters equal to
 * the total number of shelter records, and sheltersWithCats equal to the number
 * of distinct shelter_id values in the cats table.
 *
 * **Validates: Requirements 4.4, 10.4**
 */

// --- Arbitraries ---

const shelterArbitrary: fc.Arbitrary<Shelter> = fc.record({
  id_zewnetrzne: fc.integer({ min: 1, max: 100_000 }),
  name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  website_url: fc.oneof(fc.constant(null), fc.webUrl()),
  city: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
  voivodeship: fc.constantFrom(
    "mazowieckie", "małopolskie", "pomorskie", "dolnośląskie",
    "wielkopolskie", "śląskie", "łódzkie", "podkarpackie"
  ),
});

/** Generate shelters with unique id_zewnetrzne values */
const uniqueSheltersArbitrary: fc.Arbitrary<Shelter[]> = fc
  .array(shelterArbitrary, { minLength: 1, maxLength: 10 })
  .map((shelters) => {
    const seen = new Set<number>();
    return shelters.filter((s) => {
      if (seen.has(s.id_zewnetrzne)) return false;
      seen.add(s.id_zewnetrzne);
      return true;
    });
  })
  .filter((arr) => arr.length > 0);

const catArbitrary = (shelterId: number): fc.Arbitrary<Cat> =>
  fc.record({
    shelter_id: fc.constant(shelterId),
    name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
    description: fc.string({ minLength: 0, maxLength: 100 }),
    image_url: fc.oneof(fc.constant(null), fc.webUrl()),
    source_url: fc.oneof(fc.constant(null), fc.webUrl()),
    sex: fc.oneof(fc.constant(null), fc.constantFrom("samiec", "samica")),
    age: fc.oneof(fc.constant(null), fc.constantFrom("1 rok", "2 lata", "5 lat")),
  });

/** Generate a mapping of shelterId -> cats for given shelters */
function catsForSheltersArbitrary(shelters: Shelter[]): fc.Arbitrary<Map<number, Cat[]>> {
  const catArrays = shelters.map((s) =>
    fc.array(catArbitrary(s.id_zewnetrzne), { minLength: 0, maxLength: 8 })
  );
  return fc.tuple(...catArrays).map((arrays) => {
    const map = new Map<number, Cat[]>();
    shelters.forEach((s, i) => map.set(s.id_zewnetrzne, arrays[i]));
    return map;
  });
}

// --- Helper to seed and get app ---
function seedApp(shelters: Shelter[], catMap: Map<number, Cat[]>): { app: Express; db: Database.Database } {
  const { app, db } = createApp();
  upsertShelters(db, shelters);
  for (const [shelterId, cats] of catMap) {
    saveCats(db, shelterId, cats);
  }
  return { app, db };
}

describe("Property 4: Stats counts consistent with DB", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * Property: For any set of shelters and cats in the database, GET /api/stats
   * SHALL return totalCats equal to the total number of cat records, totalShelters
   * equal to the total number of shelter records, and sheltersWithCats equal to the
   * number of distinct shelter_id values in the cats table.
   *
   * **Validates: Requirements 4.4, 10.4**
   */
  it("stats counts are consistent with database contents", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
        // Generate cats for these shelters
        const catMap = fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

        const result = seedApp(shelters, catMap);
        db = result.db;

        const res = await request(result.app).get("/api/stats");
        expect(res.status).toBe(200);

        // Calculate expected values
        const totalCats = Array.from(catMap.values()).reduce((sum, cats) => sum + cats.length, 0);
        const totalShelters = shelters.length;
        const sheltersWithCats = Array.from(catMap.entries()).filter(([_, cats]) => cats.length > 0).length;

        // Verify totalCats
        expect(res.body.totalCats).toBe(totalCats);

        // Verify totalShelters
        expect(res.body.totalShelters).toBe(totalShelters);

        // Verify sheltersWithCats
        expect(res.body.sheltersWithCats).toBe(sheltersWithCats);

        // Verify lastFetched is present (either null or a timestamp string)
        expect(res.body).toHaveProperty("lastFetched");
        const lastFetched = res.body.lastFetched;
        expect(lastFetched === null || typeof lastFetched === "string").toBe(true);

        db.close();
        db = undefined;
      }),
      { numRuns: 50 }
    );
  });
});
