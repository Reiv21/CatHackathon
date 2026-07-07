import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "../server.js";
import { upsertShelters } from "../db.js";
import type { Shelter } from "../db.js";

/**
 * Property-based test: Shelter response shape completeness.
 *
 * For any shelter record in the database, the corresponding object in the
 * GET /api/shelters response SHALL contain all required fields: `id_zewnetrzne`,
 * `name`, `city`, `voivodeship`, `website_url`, `cat_count`, `latitude`, and `longitude`.
 *
 * **Validates: Requirements 3.3, 10.1**
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

// --- Tests ---

describe("Property 9: Shelter response shape completeness", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  /**
   * For any shelter record in the database, the corresponding object in the
   * GET /api/shelters response SHALL contain all required fields with correct types.
   *
   * **Validates: Requirements 3.3, 10.1**
   */
  it("every shelter in the response contains all required fields with correct types", async () => {
    await fc.assert(
      fc.asyncProperty(uniqueSheltersArbitrary, async (shelters) => {
        const { app, db: appDb } = createApp();
        db = appDb;

        upsertShelters(db, shelters);

        const res = await request(app).get("/api/shelters");
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body.length).toBe(shelters.length);

        for (const shelterResponse of res.body) {
          // id_zewnetrzne: number
          expect(shelterResponse).toHaveProperty("id_zewnetrzne");
          expect(typeof shelterResponse.id_zewnetrzne).toBe("number");

          // name: string
          expect(shelterResponse).toHaveProperty("name");
          expect(typeof shelterResponse.name).toBe("string");

          // city: string
          expect(shelterResponse).toHaveProperty("city");
          expect(typeof shelterResponse.city).toBe("string");

          // voivodeship: string
          expect(shelterResponse).toHaveProperty("voivodeship");
          expect(typeof shelterResponse.voivodeship).toBe("string");

          // website_url: string | null
          expect(shelterResponse).toHaveProperty("website_url");
          expect(
            shelterResponse.website_url === null ||
            typeof shelterResponse.website_url === "string"
          ).toBe(true);

          // cat_count: number
          expect(shelterResponse).toHaveProperty("cat_count");
          expect(typeof shelterResponse.cat_count).toBe("number");

          // latitude: number | null
          expect(shelterResponse).toHaveProperty("latitude");
          expect(
            shelterResponse.latitude === null ||
            typeof shelterResponse.latitude === "number"
          ).toBe(true);

          // longitude: number | null
          expect(shelterResponse).toHaveProperty("longitude");
          expect(
            shelterResponse.longitude === null ||
            typeof shelterResponse.longitude === "number"
          ).toBe(true);
        }

        db.close();
        db = undefined;
      }),
      { numRuns: 50 }
    );
  });
});
