import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "./server.js";
import { upsertShelters, saveCats } from "./db.js";

let app: Express;
let db: Database.Database;

beforeAll(() => {
  const instance = createApp();
  app = instance.app;
  db = instance.db;

  // Seed test data for endpoints that need it
  upsertShelters(db, [
    { id_zewnetrzne: 1, name: "Shelter One", city: "Warszawa", voivodeship: "mazowieckie", website_url: "https://shelter1.pl" },
    { id_zewnetrzne: 2, name: "Shelter Two", city: "Kraków", voivodeship: "małopolskie", website_url: null },
  ]);
  saveCats(db, 1, [
    { shelter_id: 1, name: "Mruczek", description: "Friendly cat", image_url: "https://img.test/1.jpg", source_url: null, sex: "samiec", age: "2" },
    { shelter_id: 1, name: "Filemon", description: "Shy cat", image_url: null, source_url: null, sex: "samiec", age: "3" },
  ]);
  saveCats(db, 2, [
    { shelter_id: 2, name: "Luna", description: "Playful cat", image_url: "https://img.test/2.jpg", source_url: null, sex: "samica", age: "1" },
  ]);
});

afterAll(() => {
  db.close();
});

describe("Security headers", () => {
  it("includes security headers from helmet", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("includes content-security-policy", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.headers["content-security-policy"]).toBeDefined();
  });
});

describe("Input validation", () => {
  it("returns 400 for non-integer shelter ID", async () => {
    const res = await request(app).get("/api/shelters/abc/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });

  it("returns 400 for zero shelter ID", async () => {
    const res = await request(app).get("/api/shelters/0/cats");
    expect(res.status).toBe(400);
  });

  it("returns 400 for negative shelter ID", async () => {
    const res = await request(app).get("/api/shelters/-1/cats");
    expect(res.status).toBe(400);
  });
});

describe("CORS", () => {
  it("allows requests from configured origin", async () => {
    const res = await request(app)
      .get("/api/shelters")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });
});

describe("GET /api/domination", () => {
  it("returns 200 with correct domination response shape", async () => {
    const res = await request(app).get("/api/domination");
    expect(res.status).toBe(200);
    expect(res.body.total_shelters_in_poland).toBe(190);
    expect(typeof res.body.shelters_covered).toBe("number");
    expect(typeof res.body.percentage).toBe("number");
    expect(typeof res.body.cats_in_army).toBe("number");
    expect(typeof res.body.domination_level).toBe("string");
    expect([
      "Kocie Zwiadowcy",
      "Kocia Partyzantka",
      "Kocia Ofensywa",
      "Pełna Kocia Dominacja",
    ]).toContain(res.body.domination_level);
  });

  it("responds within 500ms", async () => {
    const start = Date.now();
    await request(app).get("/api/domination");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(500);
  });

  it("counts seeded data correctly", async () => {
    const res = await request(app).get("/api/domination");
    expect(res.body.shelters_covered).toBe(2);
    expect(res.body.cats_in_army).toBe(3);
  });
});

describe("GET /api/health", () => {
  it("returns 200 with status ok when database is open", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThan(0);
    expect(res.body.timestamp).toBeDefined();
    // Verify timestamp is valid ISO 8601
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it("does not include details field when healthy", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body.details).toBeUndefined();
  });

  it("returns proper health response structure", async () => {
    const res = await request(app).get("/api/health");
    expect(res.body).toHaveProperty("status");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");
    expect(["ok", "degraded"]).toContain(res.body.status);
  });

  it("responds within 100ms", async () => {
    const start = Date.now();
    await request(app).get("/api/health");
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(100);
  });
});
