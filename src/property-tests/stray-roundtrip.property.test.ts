import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import { createApp } from "../server.js";

/**
 * Property 5: Stray report round-trip preservation
 *
 * *For any* valid stray report submitted via `POST /api/report-stray`,
 * the report SHALL appear in the response of `GET /api/strays` with
 * matching `description`, `latitude`, `longitude`, and `city` values.
 *
 * **Validates: Requirements 5.2, 5.3**
 */

// Generate a random description (non-empty string)
const descriptionArb = fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0);

// Generate latitude in Poland range (49-54), always non-zero to avoid geocoding path
const latitudeArb = fc.double({ min: 49.0, max: 54.0, noNaN: true });

// Generate longitude in Poland range (14-24), always non-zero to avoid geocoding path
const longitudeArb = fc.double({ min: 14.0, max: 24.0, noNaN: true });

// Generate a random city name that won't match known geocoding entries
// Using a prefix to avoid matching any real Polish city in CITY_COORDS
const cityArb = fc
  .string({ minLength: 1, maxLength: 30 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `TestCity_${s}`);

describe("Stray Report Round-Trip Property Test", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  it("any valid stray report posted appears in GET /api/strays with matching fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        descriptionArb,
        latitudeArb,
        longitudeArb,
        cityArb,
        async (description, latitude, longitude, city) => {
          const { app, db: testDb } = createApp();
          db = testDb;

          // POST the stray report
          const postRes = await request(app)
            .post("/api/report-stray")
            .send({ description, latitude, longitude, city })
            .set("Content-Type", "application/json");

          expect(postRes.status).toBe(200);

          // GET all strays
          const getRes = await request(app).get("/api/strays");
          expect(getRes.status).toBe(200);
          expect(Array.isArray(getRes.body)).toBe(true);

          // Find the posted report in the list
          const found = getRes.body.find(
            (stray: { description: string; city: string }) =>
              stray.description === description && stray.city === city
          );

          expect(found).toBeDefined();
          expect(found.description).toBe(description);
          expect(found.city).toBe(city);
          // Latitude and longitude should match since we provided valid non-zero values
          // The server parses them with parseFloat, so compare numerically
          expect(found.latitude).toBeCloseTo(latitude, 5);
          expect(found.longitude).toBeCloseTo(longitude, 5);

          db.close();
          db = undefined;
        }
      ),
      { numRuns: 30 }
    );
  });
});
