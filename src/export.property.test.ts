import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import { initializeDatabase, upsertShelters, saveCats } from "./db";
import type { Shelter, Cat } from "./db";
import type Database from "better-sqlite3";

/**
 * Property 2: Export data correctness and schema
 *
 * For any valid SQLite database state containing shelters and cats (with foreign key
 * relationships), the exportDataActivity SHALL produce a shelters.json array where each
 * object contains exactly the fields id_zewnetrzne, name, city, voivodeship, website_url,
 * cat_count, and the cat_count for each shelter equals the number of cats in the cats table
 * with matching shelter_id; and a cats.json array where each object contains the fields id,
 * name, description, image_url, source_url, shelter_id, shelter_name, shelter_city, sex, age
 * with shelter_name and shelter_city matching the joined shelter record.
 *
 * **Validates: Requirements 2.1, 2.2**
 *
 * Tag: Feature: hackathon-polish, Property 2: Export data correctness and schema
 */
describe("Feature: hackathon-polish, Property 2: Export data correctness and schema", () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) {
      try {
        db.close();
      } catch {
        // already closed
      }
    }
  });

  /**
   * Generate shelters with unique id_zewnetrzne values (1-20 shelters).
   */
  const uniqueSheltersArbitrary: fc.Arbitrary<Shelter[]> = fc
    .array(
      fc.record({
        id_zewnetrzne: fc.integer({ min: 1, max: 100_000 }),
        name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        website_url: fc.oneof(fc.constant(null), fc.webUrl()),
        city: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
        voivodeship: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
      }),
      { minLength: 1, maxLength: 20 }
    )
    .map((shelters) => {
      const seen = new Set<number>();
      return shelters.filter((s) => {
        if (seen.has(s.id_zewnetrzne)) return false;
        seen.add(s.id_zewnetrzne);
        return true;
      });
    })
    .filter((arr) => arr.length >= 1);

  /**
   * Generate cats (0-50) referencing shelter IDs from a given set.
   */
  function catsForShelters(shelterIds: number[]): fc.Arbitrary<Cat[]> {
    if (shelterIds.length === 0) return fc.constant([]);
    return fc.array(
      fc.record({
        shelter_id: fc.constantFrom(...shelterIds),
        name: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
        description: fc.string({ minLength: 0, maxLength: 100 }),
        image_url: fc.oneof(fc.constant(null), fc.webUrl()),
      }),
      { minLength: 0, maxLength: 50 }
    );
  }

  /**
   * Reproduce the same export queries as exportDataActivity (from src/activities.ts)
   * but run against an in-memory DB instead of the file-based one.
   */
  function runExportQueries(database: Database.Database): {
    shelters: Array<{
      id_zewnetrzne: number;
      name: string;
      city: string;
      voivodeship: string;
      website_url: string | null;
      cat_count: number;
    }>;
    cats: Array<{
      id: number;
      name: string;
      description: string;
      image_url: string | null;
      source_url: string | null;
      shelter_id: number;
      shelter_name: string;
      shelter_city: string;
      sex: string | null;
      age: string | null;
    }>;
  } {
    // Same query as in exportDataActivity
    const shelters = database
      .prepare(
        `
      SELECT s.id_zewnetrzne, s.name, s.city, s.voivodeship, s.website_url,
             COUNT(c.id) AS cat_count
      FROM shelters s
      LEFT JOIN cats c ON c.shelter_id = s.id_zewnetrzne
      GROUP BY s.id_zewnetrzne
      ORDER BY s.city
    `
      )
      .all() as Array<{
      id_zewnetrzne: number;
      name: string;
      city: string;
      voivodeship: string;
      website_url: string | null;
      cat_count: number;
    }>;

    const catsRaw = database
      .prepare(
        `
      SELECT c.id, c.name, c.description, c.image_url, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      ORDER BY s.city, c.name
    `
      )
      .all() as Array<{
      id: number;
      name: string;
      description: string;
      image_url: string | null;
      shelter_id: number;
      shelter_name: string;
      shelter_city: string;
    }>;

    // Add fields required by export schema that aren't in the DB (matching activities.ts)
    const cats = catsRaw.map((cat) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description,
      image_url: cat.image_url,
      source_url: null as string | null,
      shelter_id: cat.shelter_id,
      shelter_name: cat.shelter_name,
      shelter_city: cat.shelter_city,
      sex: null as string | null,
      age: null as string | null,
    }));

    return { shelters, cats };
  }

  it("shelters.json has correct schema and cat_count matches actual cat counts", () => {
    fc.assert(
      fc.property(
        uniqueSheltersArbitrary.chain((shelters) => {
          const shelterIds = shelters.map((s) => s.id_zewnetrzne);
          return catsForShelters(shelterIds).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          db = initializeDatabase();

          // Insert shelters
          upsertShelters(db, shelters);

          // Insert cats grouped by shelter
          const catsByShelter = new Map<number, Cat[]>();
          for (const cat of cats) {
            if (!catsByShelter.has(cat.shelter_id)) {
              catsByShelter.set(cat.shelter_id, []);
            }
            catsByShelter.get(cat.shelter_id)!.push(cat);
          }
          for (const [shelterId, shelterCats] of catsByShelter) {
            saveCats(db, shelterId, shelterCats);
          }

          // Run the export queries
          const result = runExportQueries(db);

          // --- Verify shelters.json schema ---
          // Must contain exactly the inserted shelters
          expect(result.shelters.length).toBe(shelters.length);

          for (const exportedShelter of result.shelters) {
            // Verify schema: all required fields present
            expect(exportedShelter).toHaveProperty("id_zewnetrzne");
            expect(exportedShelter).toHaveProperty("name");
            expect(exportedShelter).toHaveProperty("city");
            expect(exportedShelter).toHaveProperty("voivodeship");
            expect(exportedShelter).toHaveProperty("website_url");
            expect(exportedShelter).toHaveProperty("cat_count");

            // Find the original shelter
            const original = shelters.find(
              (s) => s.id_zewnetrzne === exportedShelter.id_zewnetrzne
            );
            expect(original).toBeDefined();
            expect(exportedShelter.name).toBe(original!.name);
            expect(exportedShelter.city).toBe(original!.city);
            expect(exportedShelter.voivodeship).toBe(original!.voivodeship);
            expect(exportedShelter.website_url).toBe(original!.website_url);

            // Verify cat_count matches actual number of cats for this shelter
            const expectedCatCount = catsByShelter.get(exportedShelter.id_zewnetrzne)?.length ?? 0;
            expect(exportedShelter.cat_count).toBe(expectedCatCount);
          }

          db.close();
          db = undefined as any;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("cats.json has correct schema and shelter_name/shelter_city match joined records", () => {
    fc.assert(
      fc.property(
        uniqueSheltersArbitrary.chain((shelters) => {
          const shelterIds = shelters.map((s) => s.id_zewnetrzne);
          return catsForShelters(shelterIds).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          db = initializeDatabase();

          // Insert shelters
          upsertShelters(db, shelters);

          // Insert cats grouped by shelter
          const catsByShelter = new Map<number, Cat[]>();
          for (const cat of cats) {
            if (!catsByShelter.has(cat.shelter_id)) {
              catsByShelter.set(cat.shelter_id, []);
            }
            catsByShelter.get(cat.shelter_id)!.push(cat);
          }
          for (const [shelterId, shelterCats] of catsByShelter) {
            saveCats(db, shelterId, shelterCats);
          }

          // Run the export queries
          const result = runExportQueries(db);

          // Total exported cats should equal total inserted cats
          const totalInsertedCats = cats.length;
          expect(result.cats.length).toBe(totalInsertedCats);

          // Build a shelter lookup map
          const shelterMap = new Map(shelters.map((s) => [s.id_zewnetrzne, s]));

          for (const exportedCat of result.cats) {
            // Verify schema: all required fields present
            expect(exportedCat).toHaveProperty("id");
            expect(exportedCat).toHaveProperty("name");
            expect(exportedCat).toHaveProperty("description");
            expect(exportedCat).toHaveProperty("image_url");
            expect(exportedCat).toHaveProperty("source_url");
            expect(exportedCat).toHaveProperty("shelter_id");
            expect(exportedCat).toHaveProperty("shelter_name");
            expect(exportedCat).toHaveProperty("shelter_city");
            expect(exportedCat).toHaveProperty("sex");
            expect(exportedCat).toHaveProperty("age");

            // Verify types
            expect(typeof exportedCat.id).toBe("number");
            expect(typeof exportedCat.name).toBe("string");
            expect(typeof exportedCat.description).toBe("string");
            expect(typeof exportedCat.shelter_id).toBe("number");
            expect(typeof exportedCat.shelter_name).toBe("string");
            expect(typeof exportedCat.shelter_city).toBe("string");

            // Verify join correctness: shelter_name and shelter_city match the shelter record
            const matchingShelter = shelterMap.get(exportedCat.shelter_id);
            expect(matchingShelter).toBeDefined();
            expect(exportedCat.shelter_name).toBe(matchingShelter!.name);
            expect(exportedCat.shelter_city).toBe(matchingShelter!.city);

            // source_url, sex, age should be null (not in DB schema)
            expect(exportedCat.source_url).toBeNull();
            expect(exportedCat.sex).toBeNull();
            expect(exportedCat.age).toBeNull();
          }

          db.close();
          db = undefined as any;
        }
      ),
      { numRuns: 100 }
    );
  });
});
