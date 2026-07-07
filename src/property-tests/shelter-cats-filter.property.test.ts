import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "../server.js";
import { upsertShelters, saveCats } from "../db.js";
import type { Shelter, Cat } from "../db.js";

/**
 * Property 2: Shelter cats endpoint returns only cats belonging to that shelter
 *
 * For any shelter ID and set of cats in the database, GET /api/shelters/:id/cats
 * SHALL return only cat records where shelter_id equals the requested ID,
 * and SHALL return all such records.
 *
 * **Validates: Requirements 3.2**
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
  .array(shelterArbitrary, { minLength: 2, maxLength: 8 })
  .map((shelters) => {
    const seen = new Set<number>();
    return shelters.filter((s) => {
      if (seen.has(s.id_zewnetrzne)) return false;
      seen.add(s.id_zewnetrzne);
      return true;
    });
  })
  .filter((arr) => arr.length >= 2);

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
  return fc.tuple(...(catArrays as [fc.Arbitrary<Cat[]>, ...fc.Arbitrary<Cat[]>[]])).map((arrays) => {
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

describe("Shelter Cats Filter Property Test", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * Property: For any shelter ID and set of cats in the database,
   * GET /api/shelters/:id/cats returns only cat records where shelter_id equals
   * the requested ID, and returns all such records.
   *
   * **Validates: Requirements 3.2**
   */
  it("GET /api/shelters/:id/cats returns only cats belonging to that shelter and all of them", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
        // Generate cats distributed among shelters
        const catMap = fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

        const result = seedApp(shelters, catMap);
        db = result.db;

        // For each shelter, verify the endpoint returns the correct cats
        for (const shelter of shelters) {
          const res = await request(result.app).get(`/api/shelters/${shelter.id_zewnetrzne}/cats`);
          expect(res.status).toBe(200);
          expect(Array.isArray(res.body)).toBe(true);

          const returnedCats = res.body as Array<{ shelter_id: number; name: string }>;

          // All returned cats must have shelter_id matching the requested shelter
          for (const cat of returnedCats) {
            expect(cat.shelter_id).toBe(shelter.id_zewnetrzne);
          }

          // The count of returned cats must match what was seeded for this shelter
          const expectedCount = catMap.get(shelter.id_zewnetrzne)?.length ?? 0;
          expect(returnedCats.length).toBe(expectedCount);
        }

        db.close();
        db = undefined;
      }),
      { numRuns: 50 }
    );
  });
});
