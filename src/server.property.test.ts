import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "./server.js";
import { upsertShelters, saveCats } from "./db.js";
import type { Shelter, Cat } from "./db.js";

/**
 * Property-based tests for API query correctness.
 * Uses fast-check to generate random shelter/cat data, seeds into in-memory DB,
 * and verifies that API responses are consistent with the seeded data.
 *
 * **Validates: Requirements 9.1, 9.2**
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

describe("Server Property-Based Tests", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * Property: For any set of shelters/cats, GET /api/stats returns correct counts.
   *
   * **Validates: Requirements 9.1, 9.2**
   */
  describe("Stats returns correct counts for any generated data", () => {
    it("totalCats, totalShelters, and sheltersWithCats match seeded data", async () => {
      await fc.assert(
        fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
          // Generate cats for these shelters
          const catMap = await fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

          const result = seedApp(shelters, catMap);
          db = result.db;

          const res = await request(result.app).get("/api/stats");
          expect(res.status).toBe(200);

          // Calculate expected values
          const totalCats = Array.from(catMap.values()).reduce((sum, cats) => sum + cats.length, 0);
          const totalShelters = shelters.length;
          const sheltersWithCats = Array.from(catMap.entries()).filter(([_, cats]) => cats.length > 0).length;

          expect(res.body.totalCats).toBe(totalCats);
          expect(res.body.totalShelters).toBe(totalShelters);
          expect(res.body.sheltersWithCats).toBe(sheltersWithCats);
          expect(res.body).toHaveProperty("lastFetched");

          db.close();
          db = undefined;
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: For any generated data, GET /api/shelters cat_count matches actual seeded cats.
   *
   * **Validates: Requirements 9.1, 9.2**
   */
  describe("Shelter cat_count matches actual seeded cats", () => {
    it("each shelter's cat_count equals the number of cats seeded for it", async () => {
      await fc.assert(
        fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
          const catMap = await fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

          const result = seedApp(shelters, catMap);
          db = result.db;

          const res = await request(result.app).get("/api/shelters");
          expect(res.status).toBe(200);
          expect(Array.isArray(res.body)).toBe(true);

          for (const shelter of shelters) {
            const apiShelter = res.body.find(
              (s: { id_zewnetrzne: number }) => s.id_zewnetrzne === shelter.id_zewnetrzne
            );
            expect(apiShelter).toBeDefined();

            const expectedCatCount = catMap.get(shelter.id_zewnetrzne)?.length ?? 0;
            expect(apiShelter.cat_count).toBe(expectedCatCount);
          }

          db.close();
          db = undefined;
        }),
        { numRuns: 30 }
      );
    });
  });

  /**
   * Property: For any cats seeded, GET /api/cats pagination is consistent (total matches cat count).
   *
   * **Validates: Requirements 9.1, 9.2**
   */
  describe("Cats pagination total matches seeded cat count", () => {
    it("pagination.total equals total number of seeded cats", async () => {
      await fc.assert(
        fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
          const catMap = await fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

          const result = seedApp(shelters, catMap);
          db = result.db;

          const totalCats = Array.from(catMap.values()).reduce((sum, cats) => sum + cats.length, 0);

          const res = await request(result.app).get("/api/cats?page=1&limit=50");
          expect(res.status).toBe(200);
          expect(res.body.pagination.total).toBe(totalCats);
          expect(res.body.cats.length).toBe(Math.min(totalCats, 50));

          // totalPages should be consistent
          const expectedPages = Math.ceil(totalCats / 50) || 0;
          expect(res.body.pagination.totalPages).toBe(expectedPages);

          db.close();
          db = undefined;
        }),
        { numRuns: 30 }
      );
    });
  });
});
