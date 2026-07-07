import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "../server.js";
import { upsertShelters, saveCats } from "../db.js";
import type { Shelter, Cat } from "../db.js";

/**
 * Property-based test: Shelter cat_count matches actual cat records.
 *
 * For any set of shelters and cats inserted into the database, the `cat_count`
 * field returned by GET /api/shelters for each shelter SHALL equal the number
 * of cat records in the cats table with that shelter's id_zewnetrzne as their shelter_id.
 *
 * **Validates: Requirements 3.1, 4.4**
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

describe("Property 1: Shelter cat_count matches actual cat records", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * For any set of shelters and cats inserted into the database, the cat_count
   * field returned by GET /api/shelters for each shelter equals the number of
   * cat records with that shelter's id_zewnetrzne as their shelter_id.
   *
   * **Validates: Requirements 3.1, 4.4**
   */
  it("each shelter's cat_count equals the number of cats seeded for it", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
        const catMap = fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

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
      { numRuns: 50 }
    );
  });
});
