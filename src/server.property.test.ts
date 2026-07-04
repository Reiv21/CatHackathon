import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fc from "fast-check";
import request from "supertest";
import type Database from "better-sqlite3";
import { createApp } from "./server.js";

let db: Database.Database;
let app: ReturnType<typeof createApp>["app"];

beforeEach(() => {
  const created = createApp(":memory:");
  app = created.app;
  db = created.db;
});

afterEach(() => {
  db.close();
});

function insertShelter(
  id: number,
  name: string,
  city: string,
  voivodeship = "test-voivodeship",
  websiteUrl: string | null = null
) {
  db.prepare(
    `INSERT INTO shelters (id_zewnetrzne, name, city, voivodeship, website_url) VALUES (?, ?, ?, ?, ?)`
  ).run(id, name, city, voivodeship, websiteUrl);
}

function insertCat(
  shelterId: number,
  name: string,
  description = "",
  imageUrl: string | null = null
) {
  db.prepare(
    `INSERT INTO cats (shelter_id, name, description, image_url) VALUES (?, ?, ?, ?)`
  ).run(shelterId, name, description, imageUrl);
}

// Feature: tactical-cat-frontend, Property 1: Shelter cat_count matches actual cat records
describe("Property 1: Shelter cat_count matches actual cat records", () => {
  it("cat_count equals actual number of cat records for each shelter", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            catCount: fc.integer({ min: 0, max: 5 }),
            name: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
            city: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
          }),
          { minLength: 1, maxLength: 5 }
        ),
        async (shelters) => {
          db.exec("DELETE FROM cats");
          db.exec("DELETE FROM shelters");

          for (let i = 0; i < shelters.length; i++) {
            const s = shelters[i];
            insertShelter(i + 1, s.name, s.city);
            for (let j = 0; j < s.catCount; j++) {
              insertCat(i + 1, `cat-${i}-${j}`);
            }
          }

          const res = await request(app).get("/api/shelters");
          const body = res.body as Array<{ id_zewnetrzne: number; cat_count: number }>;

          for (const shelter of body) {
            const expected = shelters[shelter.id_zewnetrzne - 1].catCount;
            expect(shelter.cat_count).toBe(expected);
          }
        }
      ),
      { numRuns: 50 }
    );
  });
});

// Feature: tactical-cat-frontend, Property 2: Search returns only matching results
describe("Property 2: Search returns only matching results", () => {
  it("all returned cats match the search term in name or city", async () => {
    insertShelter(1, "Schronisko", "Kraków");
    insertShelter(2, "Przytulisko", "Warszawa");
    insertCat(1, "Mruczek", "friendly cat");
    insertCat(1, "Burek", "playful");
    insertCat(2, "Filemon", "calm cat");

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("Mruczek", "Kraków", "Filemon", "Warszawa"),
        async (searchTerm) => {
          const res = await request(app).get(`/api/cats?search=${encodeURIComponent(searchTerm)}`);
          const body = res.body as Array<{ name: string; shelter_city: string }>;

          for (const cat of body) {
            const nameMatch = cat.name.toLowerCase().includes(searchTerm.toLowerCase());
            const cityMatch = cat.shelter_city.toLowerCase().includes(searchTerm.toLowerCase());
            expect(nameMatch || cityMatch).toBe(true);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: tactical-cat-frontend, Property 3: Search result count bounded by limit
describe("Property 3: Search result count bounded by limit", () => {
  it("never returns more than 200 results", async () => {
    insertShelter(1, "TestShelter", "TestCity");
    for (let i = 0; i < 250; i++) {
      insertCat(1, `cat-${i}`);
    }

    const res = await request(app).get("/api/cats");
    expect(res.body.length).toBeLessThanOrEqual(200);
  });
});

// Feature: tactical-cat-frontend, Property 4: Sanitized empty input equivalent to no filter
describe("Property 4: Sanitized empty input equivalent to no filter", () => {
  it("stripped-to-empty search returns same as no search", async () => {
    insertShelter(1, "Shelter", "City");
    insertCat(1, "CatA");
    insertCat(1, "CatB");

    await fc.assert(
      fc.asyncProperty(
        fc.stringOf(fc.constantFrom(..."!@#$%^&*()+=[]{}|;:',.<>?/~`".split(""))),
        async (junk) => {
          const withJunk = await request(app).get(`/api/cats?search=${encodeURIComponent(junk)}`);
          const withoutSearch = await request(app).get("/api/cats");
          expect(JSON.stringify(withJunk.body)).toBe(JSON.stringify(withoutSearch.body));
        }
      ),
      { numRuns: 20 }
    );
  });
});

// Feature: tactical-cat-frontend, Property 7: Response format completeness
describe("Property 7: Response format completeness", () => {
  it("cat responses contain all required fields", async () => {
    insertShelter(1, "Shelter", "City", "Voiv", "http://example.com");
    insertCat(1, "TestCat", "desc", null);

    const res = await request(app).get("/api/cats");
    const body = res.body as Array<Record<string, unknown>>;
    const requiredFields = ["id", "name", "description", "image_url", "shelter_id", "shelter_name", "shelter_city"];

    for (const cat of body) {
      for (const field of requiredFields) {
        expect(field in cat).toBe(true);
      }
    }
  });

  it("shelter responses contain all required fields", async () => {
    insertShelter(1, "Shelter", "City", "Voiv", null);

    const res = await request(app).get("/api/shelters");
    const body = res.body as Array<Record<string, unknown>>;
    const requiredFields = ["id_zewnetrzne", "name", "city", "voivodeship", "website_url", "cat_count"];

    for (const shelter of body) {
      for (const field of requiredFields) {
        expect(field in shelter).toBe(true);
      }
    }
  });
});

// Feature: tactical-cat-frontend, Property 8: All success responses have JSON Content-Type
describe("Property 8: All success responses have JSON Content-Type", () => {
  it("success responses have application/json content type", async () => {
    insertShelter(1, "Shelter", "City");
    insertCat(1, "Cat");

    const endpoints = ["/api/shelters", "/api/cats", "/api/shelters/1/cats"];
    for (const endpoint of endpoints) {
      const res = await request(app).get(endpoint);
      expect(res.headers["content-type"]).toContain("application/json");
    }
  });
});

// Feature: tactical-cat-frontend, Property 9: All error responses contain message field
describe("Property 9: All error responses contain message field", () => {
  it("error responses contain a message field", async () => {
    const errorEndpoints = ["/api/shelters/abc/cats", "/api/shelters/999/cats"];
    for (const endpoint of errorEndpoints) {
      const res = await request(app).get(endpoint);
      expect(res.status).toBeGreaterThanOrEqual(400);
      expect(res.body).toHaveProperty("message");
      expect(typeof res.body.message).toBe("string");
    }
  });
});

// Feature: tactical-cat-frontend, Property 12: Shelter cats endpoint returns exactly the shelter's cats
describe("Property 12: Shelter cats endpoint returns exactly the shelter's cats", () => {
  it("returns exactly the cats belonging to requested shelter", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        async (cats1Count, cats2Count) => {
          db.exec("DELETE FROM cats");
          db.exec("DELETE FROM shelters");
          insertShelter(1, "S1", "C1");
          insertShelter(2, "S2", "C2");

          for (let i = 0; i < cats1Count; i++) insertCat(1, `s1-cat-${i}`);
          for (let i = 0; i < cats2Count; i++) insertCat(2, `s2-cat-${i}`);

          const res = await request(app).get("/api/shelters/1/cats");
          const body = res.body as Array<{ shelter_id: number }>;

          expect(body.length).toBe(cats1Count);
          for (const cat of body) {
            expect(cat.shelter_id).toBe(1);
          }
        }
      ),
      { numRuns: 20 }
    );
  });
});
