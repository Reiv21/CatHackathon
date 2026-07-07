import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "../server.js";
import { upsertShelters, saveCats } from "../db.js";
import type { Shelter, Cat } from "../db.js";

/**
 * Property-based test: Cat response shape completeness.
 *
 * For any cat record returned by GET /api/cats, the object SHALL contain all
 * required fields: id, name, description, image_url, source_url, shelter_id,
 * shelter_name, shelter_city, sex, age, shelter_url, and shelter_voivodeship.
 *
 * **Validates: Requirements 10.2**
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
  .array(shelterArbitrary, { minLength: 1, maxLength: 5 })
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

/** Generate cats for given shelters, ensuring at least one cat exists */
function catsForSheltersArbitrary(shelters: Shelter[]): fc.Arbitrary<Map<number, Cat[]>> {
  const catArrays = shelters.map((s) =>
    fc.array(catArbitrary(s.id_zewnetrzne), { minLength: 1, maxLength: 5 })
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

// --- Required fields and their expected types ---
const REQUIRED_FIELDS: Array<{ key: string; types: string[] }> = [
  { key: "id", types: ["number"] },
  { key: "name", types: ["string"] },
  { key: "description", types: ["string"] },
  { key: "image_url", types: ["string", "null"] },
  { key: "source_url", types: ["string", "null"] },
  { key: "shelter_id", types: ["number"] },
  { key: "shelter_name", types: ["string"] },
  { key: "shelter_city", types: ["string"] },
  { key: "sex", types: ["string", "null"] },
  { key: "age", types: ["string", "null"] },
  { key: "shelter_url", types: ["string", "null"] },
  { key: "shelter_voivodeship", types: ["string", "null"] },
];

describe("Property 10: Cat response shape completeness", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * For any cat record returned by GET /api/cats, the object SHALL contain
   * all required fields: id, name, description, image_url, source_url,
   * shelter_id, shelter_name, shelter_city, sex, age, shelter_url, and
   * shelter_voivodeship.
   *
   * **Validates: Requirements 10.2**
   */
  it("every cat in the response contains all required fields with correct types", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
        const catMap = fc.sample(catsForSheltersArbitrary(shelters), 1)[0];

        const result = seedApp(shelters, catMap);
        db = result.db;

        const res = await request(result.app).get("/api/cats");
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty("cats");
        expect(Array.isArray(res.body.cats)).toBe(true);

        // Ensure we have at least one cat to verify
        expect(res.body.cats.length).toBeGreaterThan(0);

        for (const cat of res.body.cats) {
          for (const { key, types } of REQUIRED_FIELDS) {
            // Field must be present as a key (even if value is null)
            expect(cat).toHaveProperty(key);

            // Check value type matches one of expected types
            const value = cat[key];
            const actualType = value === null ? "null" : typeof value;
            expect(types).toContain(actualType);
          }
        }

        db.close();
        db = undefined;
      }),
      { numRuns: 50 }
    );
  });
});
