import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import crypto from "crypto";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "./server.js";
import { upsertShelters, saveCats } from "./db.js";

/**
 * Integration tests for shelter-cat relationships, stray CRUD, and suggestion CRUD.
 * Validates: Requirements 9.1, 9.2
 */

// Helper: generate a properly signed admin token
function validAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

describe("API integration — shelter-cat relationships", () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;

    // Seed shelters
    upsertShelters(db, [
      { id_zewnetrzne: 100, name: "Shelter Alpha", website_url: "https://alpha.example.com", city: "Warszawa", voivodeship: "mazowieckie" },
      { id_zewnetrzne: 200, name: "Shelter Beta", website_url: null, city: "Kraków", voivodeship: "małopolskie" },
      { id_zewnetrzne: 300, name: "Empty Shelter", website_url: null, city: "Gdańsk", voivodeship: "pomorskie" },
    ]);

    // Seed cats for shelter 100
    saveCats(db, 100, [
      { shelter_id: 100, name: "Mruczek", description: "Friendly cat", image_url: "https://img.example.com/mruczek.jpg", source_url: "https://alpha.example.com/mruczek", sex: "samiec", age: "2 lata" },
      { shelter_id: 100, name: "Kicia", description: "Shy cat", image_url: null, source_url: null, sex: "samica", age: "3 lata" },
    ]);

    // Seed cats for shelter 200
    saveCats(db, 200, [
      { shelter_id: 200, name: "Puszek", description: "Playful cat", image_url: "https://img.example.com/puszek.jpg", source_url: null, sex: "samiec", age: "1 rok" },
    ]);

    // Shelter 300 has no cats
  });

  afterAll(() => {
    db.close();
  });

  it("GET /api/shelters returns correct cat_count for each shelter", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);

    const alpha = res.body.find((s: { id_zewnetrzne: number }) => s.id_zewnetrzne === 100);
    const beta = res.body.find((s: { id_zewnetrzne: number }) => s.id_zewnetrzne === 200);
    const empty = res.body.find((s: { id_zewnetrzne: number }) => s.id_zewnetrzne === 300);

    expect(alpha).toBeDefined();
    expect(alpha.cat_count).toBe(2);

    expect(beta).toBeDefined();
    expect(beta.cat_count).toBe(1);

    expect(empty).toBeDefined();
    expect(empty.cat_count).toBe(0);
  });

  it("GET /api/shelters/:id/cats returns correct cats for shelter", async () => {
    const res = await request(app).get("/api/shelters/100/cats");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const names = res.body.map((c: { name: string }) => c.name);
    expect(names).toContain("Mruczek");
    expect(names).toContain("Kicia");

    // Verify enrichment from shelter join
    for (const cat of res.body) {
      expect(cat.shelter_name).toBe("Shelter Alpha");
      expect(cat.shelter_city).toBe("Warszawa");
    }
  });

  it("GET /api/shelters/:id/cats returns empty array for shelter with no cats", async () => {
    const res = await request(app).get("/api/shelters/300/cats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("GET /api/shelters/:id/cats returns 404 for non-existent shelter", async () => {
    const res = await request(app).get("/api/shelters/999/cats");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Shelter not found");
  });

  it("GET /api/cats pagination works correctly", async () => {
    const res = await request(app).get("/api/cats?page=1&limit=2");
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.total).toBe(3);
    expect(res.body.pagination.totalPages).toBe(2);
    expect(res.body.cats.length).toBe(2);
  });

  it("GET /api/cats voivodeship filter works", async () => {
    const res = await request(app).get("/api/cats?voivodeship=mazowieckie");
    expect(res.status).toBe(200);
    expect(res.body.cats.length).toBe(2);
    for (const cat of res.body.cats) {
      expect(cat.shelter_voivodeship).toBe("mazowieckie");
    }
  });

  it("GET /api/cats sex filter works", async () => {
    const res = await request(app).get("/api/cats?sex=female");
    expect(res.status).toBe(200);
    expect(res.body.cats.length).toBe(1);
    expect(res.body.cats[0].name).toBe("Kicia");
  });

  it("GET /api/stats returns correct counts", async () => {
    const res = await request(app).get("/api/stats");
    expect(res.status).toBe(200);
    expect(res.body.totalCats).toBe(3);
    expect(res.body.totalShelters).toBe(3);
    expect(res.body.sheltersWithCats).toBe(2);
    expect(res.body).toHaveProperty("lastFetched");
  });
});

describe("API integration — stray report CRUD", () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  afterAll(() => {
    db.close();
  });

  it("POST /api/report-stray creates a new stray report", async () => {
    const res = await request(app)
      .post("/api/report-stray")
      .send({
        description: "Orange cat near park",
        image_url: "https://img.example.com/stray1.jpg",
        latitude: 52.23,
        longitude: 21.01,
        city: "Warszawa",
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("submitted");
  });

  it("GET /api/strays returns the created report", async () => {
    const res = await request(app).get("/api/strays");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const report = res.body.find((s: { description: string }) => s.description === "Orange cat near park");
    expect(report).toBeDefined();
    expect(report.city).toBe("Warszawa");
    expect(report.latitude).toBeCloseTo(52.23, 1);
    expect(report.longitude).toBeCloseTo(21.01, 1);
    expect(report.image_url).toBe("https://img.example.com/stray1.jpg");
    expect(report.reported_at).toBeDefined();
    expect(report.id).toBeDefined();
  });

  it("DELETE /api/admin/strays/:id removes the report", async () => {
    // First get all strays to find the ID
    const listRes = await request(app).get("/api/strays");
    const report = listRes.body.find((s: { description: string }) => s.description === "Orange cat near park");
    expect(report).toBeDefined();

    const deleteRes = await request(app)
      .delete(`/api/admin/strays/${report.id}`)
      .set("Authorization", `Bearer ${validAdminToken()}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe("Deleted");

    // Verify it's gone
    const afterRes = await request(app).get("/api/strays");
    const found = afterRes.body.find((s: { id: number }) => s.id === report.id);
    expect(found).toBeUndefined();
  });

  it("POST /api/report-stray requires location or city", async () => {
    const res = await request(app)
      .post("/api/report-stray")
      .send({ description: "No location cat" });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("required");
  });
});

describe("API integration — suggestion CRUD", () => {
  let app: Express;
  let db: Database.Database;

  beforeAll(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  afterAll(() => {
    db.close();
  });

  it("POST /api/suggest-shelter creates a suggestion", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "New Shelter",
        city: "Poznań",
        voivodeship: "wielkopolskie",
        website_url: "https://newshelter.example.com",
        submitter_email: "user@example.com",
      });
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("submitted");
  });

  it("GET /api/admin/suggestions returns the created suggestion", async () => {
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validAdminToken()}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);

    const suggestion = res.body.find((s: { name: string }) => s.name === "New Shelter");
    expect(suggestion).toBeDefined();
    expect(suggestion.city).toBe("Poznań");
    expect(suggestion.voivodeship).toBe("wielkopolskie");
    expect(suggestion.website_url).toBe("https://newshelter.example.com");
    expect(suggestion.submitter_email).toBe("user@example.com");
    expect(suggestion.submitted_at).toBeDefined();
    expect(suggestion.id).toBeDefined();
  });

  it("DELETE /api/admin/suggestions/:id removes the suggestion", async () => {
    // First get all suggestions to find the ID
    const listRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validAdminToken()}`);
    const suggestion = listRes.body.find((s: { name: string }) => s.name === "New Shelter");
    expect(suggestion).toBeDefined();

    const deleteRes = await request(app)
      .delete(`/api/admin/suggestions/${suggestion.id}`)
      .set("Authorization", `Bearer ${validAdminToken()}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.message).toBe("Deleted");

    // Verify it's gone
    const afterRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validAdminToken()}`);
    const found = afterRes.body.find((s: { id: number }) => s.id === suggestion.id);
    expect(found).toBeUndefined();
  });

  it("POST /api/suggest-shelter requires name and city", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({ name: "" });
    expect(res.status).toBe(400);
  });

  it("POST /api/suggest-shelter rejects javascript: URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "Test Shelter",
        city: "Test City",
        website_url: "javascript:alert('XSS')",
      });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid URL scheme");
  });

  it("POST /api/suggest-shelter accepts valid http URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "Test Shelter",
        city: "Test City",
        website_url: "http://example.com",
      });
    expect(res.status).toBe(200);
  });

  it("POST /api/suggest-shelter accepts valid https URLs", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "Test Shelter",
        city: "Test City",
        website_url: "https://example.com",
      });
    expect(res.status).toBe(200);
  });
});
