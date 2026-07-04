import { describe, it, expect, beforeEach, afterEach } from "vitest";
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

describe("GET /api/shelters/:id/cats", () => {
  it("returns 404 for non-existent shelter ID", async () => {
    const res = await request(app).get("/api/shelters/9999/cats");
    expect(res.status).toBe(404);
    expect(res.body.message).toBe("Shelter not found");
  });

  it("returns 400 for non-integer shelter ID", async () => {
    const res = await request(app).get("/api/shelters/abc/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });

  it("returns 400 for zero shelter ID", async () => {
    const res = await request(app).get("/api/shelters/0/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });

  it("returns 400 for negative shelter ID", async () => {
    const res = await request(app).get("/api/shelters/-1/cats");
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Invalid shelter ID");
  });
});

describe("GET /api/shelters", () => {
  it("returns empty array for empty database", async () => {
    const res = await request(app).get("/api/shelters");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe("GET /api/cats", () => {
  it("returns empty array for empty database", async () => {
    const res = await request(app).get("/api/cats");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns matching cats for search term", async () => {
    insertShelter(1, "Schronisko", "Kraków");
    insertShelter(2, "Przytulisko", "Warszawa");
    insertCat(1, "Mruczek", "friendly");
    insertCat(2, "Burek", "playful");

    const res = await request(app).get("/api/cats?search=Mruczek");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe("Mruczek");
  });

  it("returns cats matching by city", async () => {
    insertShelter(1, "Schronisko", "Kraków");
    insertShelter(2, "Przytulisko", "Warszawa");
    insertCat(1, "Cat1", "test");
    insertCat(2, "Cat2", "test");

    const res = await request(app).get("/api/cats?search=Krak%C3%B3w");
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].shelter_city).toBe("Kraków");
  });
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

describe("CORS", () => {
  it("allows requests from configured origin", async () => {
    const res = await request(app)
      .get("/api/shelters")
      .set("Origin", "http://localhost:5173");
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
  });

  it("does not allow requests from other origins", async () => {
    const res = await request(app)
      .get("/api/shelters")
      .set("Origin", "http://evil.com");
    // CORS with a specific origin string won't reflect a non-matching origin
    const allowOrigin = res.headers["access-control-allow-origin"];
    expect(allowOrigin).not.toBe("http://evil.com");
  });
});
