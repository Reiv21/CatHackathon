import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import {
  initializeDatabase,
  upsertShelters,
  getSheltersWithWebsite,
  saveCats,
} from "./db";
import type { Shelter, Cat } from "./db";
import type Database from "better-sqlite3";

/**
 * Arbitraries for generating test data
 */

const shelterArbitrary: fc.Arbitrary<Shelter> = fc.record({
  id_zewnetrzne: fc.integer({ min: 1, max: 100_000 }),
  name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  website_url: fc.oneof(
    fc.constant(null),
    fc.constant(""),
    fc.webUrl()
  ),
  city: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  voivodeship: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
});

/** Generate shelters with unique id_zewnetrzne values */
const uniqueSheltersArbitrary: fc.Arbitrary<Shelter[]> = fc
  .array(shelterArbitrary, { minLength: 1, maxLength: 20 })
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
    name: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
    description: fc.string({ minLength: 0, maxLength: 200 }),
    image_url: fc.oneof(fc.constant(null), fc.webUrl()),
  });

describe("Database Layer Property Tests", () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) db.close();
  });

  /**
   * Property 1: Upsert completeness
   * For any array of valid Shelter objects, after calling upsertShelters,
   * every shelter in the input array exists in the database with matching field values.
   *
   * **Validates: Requirements 3.1, 3.2, 3.4**
   */
  describe("Property 1: Upsert completeness", () => {
    it("all upserted shelters exist in DB with correct fields", () => {
      fc.assert(
        fc.property(uniqueSheltersArbitrary, (shelters) => {
          db = initializeDatabase();

          upsertShelters(db, shelters);

          const rows = db
            .prepare("SELECT id_zewnetrzne, name, website_url, city, voivodeship FROM shelters")
            .all() as Shelter[];

          // Total count in DB must be >= input length
          expect(rows.length).toBeGreaterThanOrEqual(shelters.length);

          // Every input shelter must exist with matching fields
          for (const shelter of shelters) {
            const row = rows.find((r) => r.id_zewnetrzne === shelter.id_zewnetrzne);
            expect(row).toBeDefined();
            expect(row!.name).toBe(shelter.name);
            expect(row!.website_url).toBe(shelter.website_url);
            expect(row!.city).toBe(shelter.city);
            expect(row!.voivodeship).toBe(shelter.voivodeship);
          }

          db.close();
          db = undefined as any;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 2: Upsert idempotence
   * Calling upsertShelters twice with the same data produces identical DB state.
   *
   * **Validates: Requirements 3.5**
   */
  describe("Property 2: Upsert idempotence", () => {
    it("upserting same data twice yields identical DB state", () => {
      fc.assert(
        fc.property(uniqueSheltersArbitrary, (shelters) => {
          db = initializeDatabase();

          upsertShelters(db, shelters);
          const afterFirst = db
            .prepare("SELECT id_zewnetrzne, name, website_url, city, voivodeship FROM shelters ORDER BY id_zewnetrzne")
            .all() as Shelter[];

          upsertShelters(db, shelters);
          const afterSecond = db
            .prepare("SELECT id_zewnetrzne, name, website_url, city, voivodeship FROM shelters ORDER BY id_zewnetrzne")
            .all() as Shelter[];

          // Same row count
          expect(afterSecond.length).toBe(afterFirst.length);

          // Identical field values for each row
          for (let i = 0; i < afterFirst.length; i++) {
            expect(afterSecond[i].id_zewnetrzne).toBe(afterFirst[i].id_zewnetrzne);
            expect(afterSecond[i].name).toBe(afterFirst[i].name);
            expect(afterSecond[i].website_url).toBe(afterFirst[i].website_url);
            expect(afterSecond[i].city).toBe(afterFirst[i].city);
            expect(afterSecond[i].voivodeship).toBe(afterFirst[i].voivodeship);
          }

          db.close();
          db = undefined as any;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 3: Website filter correctness
   * getSheltersWithWebsite returns exactly the shelters with non-null, non-empty website_url.
   *
   * **Validates: Requirements 4.1, 4.2**
   */
  describe("Property 3: Website filter correctness", () => {
    it("returns only shelters with non-null non-empty website_url", () => {
      fc.assert(
        fc.property(uniqueSheltersArbitrary, (shelters) => {
          db = initializeDatabase();

          upsertShelters(db, shelters);

          const result = getSheltersWithWebsite(db);

          // Expected: shelters where website_url is not null and not empty
          const expected = shelters.filter(
            (s) => s.website_url !== null && s.website_url !== ""
          );

          expect(result.length).toBe(expected.length);

          // Every returned shelter should have a valid website_url
          for (const r of result) {
            expect(r.website_url).not.toBeNull();
            expect(r.website_url).not.toBe("");
          }

          // Every expected shelter should be in the result
          for (const e of expected) {
            const found = result.find((r) => r.id_zewnetrzne === e.id_zewnetrzne);
            expect(found).toBeDefined();
            expect(found!.name).toBe(e.name);
            expect(found!.city).toBe(e.city);
            expect(found!.voivodeship).toBe(e.voivodeship);
            expect(found!.website_url).toBe(e.website_url);
          }

          db.close();
          db = undefined as any;
        }),
        { numRuns: 50 }
      );
    });
  });

  /**
   * Property 4: Cat save replacement semantics
   * Saving cats twice for the same shelter results in only the latest set being stored,
   * with the count matching the latest input array length.
   *
   * **Validates: Requirements 6.1, 6.2, 6.3, 6.4**
   */
  describe("Property 4: Cat save replacement semantics", () => {
    it("saving cats replaces previous cats, count matches latest input", () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 100_000 }),
          fc.array(catArbitrary(1), { minLength: 0, maxLength: 10 }),
          fc.array(catArbitrary(1), { minLength: 0, maxLength: 10 }),
          (shelterId, firstBatch, secondBatch) => {
            db = initializeDatabase();

            // Insert the shelter first (foreign key requirement)
            upsertShelters(db, [
              {
                id_zewnetrzne: shelterId,
                name: "Test Shelter",
                website_url: "https://example.com",
                city: "TestCity",
                voivodeship: "TestVoivodeship",
              },
            ]);

            // Fix shelter_id in cat batches to match our shelter
            const batch1 = firstBatch.map((c) => ({ ...c, shelter_id: shelterId }));
            const batch2 = secondBatch.map((c) => ({ ...c, shelter_id: shelterId }));

            // Save first batch
            saveCats(db, shelterId, batch1);

            // Save second batch (should replace first)
            saveCats(db, shelterId, batch2);

            // Query cats for this shelter
            const storedCats = db
              .prepare("SELECT shelter_id, name, description, image_url FROM cats WHERE shelter_id = ?")
              .all(shelterId) as Cat[];

            // Count must equal the second batch length
            expect(storedCats.length).toBe(batch2.length);

            // All stored cats must match the second batch content
            for (const cat of batch2) {
              const found = storedCats.find(
                (sc) =>
                  sc.name === cat.name &&
                  sc.description === cat.description &&
                  sc.image_url === cat.image_url
              );
              expect(found).toBeDefined();
            }

            db.close();
            db = undefined as any;
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
