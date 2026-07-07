import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import type Database from "better-sqlite3";
import type { Express } from "express";
import { createApp } from "./server.js";
import { upsertShelters, saveCats } from "./db.js";
import type { StrayReport, Suggestion } from "./db.js";
import crypto from "crypto";

/**
 * Endpoint response shape tests.
 * Validates: Requirements 9.1, 9.3, 10.1, 10.2, 10.3, 10.4
 */

let app: Express;
let db: Database.Database;

// Helper: generate a properly signed admin token
function validAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

beforeAll(() => {
  const instance = createApp();
  app = instance.app;
  db = instance.db;

  // Seed shelters
  upsertShelters(db, [
    { id_zewnetrzne: 100, name: "Schronisko Azyl", city: "Warszawa", voivodeship: "mazowieckie", website_url: "https://azyl.pl" },
    { id_zewnetrzne: 200, name: "Kocia Przystań", city: "Kraków", voivodeship: "małopolskie", website_url: null },
  ]);

  // Seed cats
  saveCats(db, 100, [
    { shelter_id: 100, name: "Mruczek", description: "Friendly cat", image_url: "https://img.test/mruczek.jpg", source_url: "https://azyl.pl/mruczek", sex: "samiec", age: "3" },
    { shelter_id: 100, name: "Kicia", description: "Shy cat", image_url: null, source_url: null, sex: "samica", age: "5" },
  ]);
  saveCats(db, 200, [
    { shelter_id: 200, name: "Puszek", description: "Energetic kitten", image_url: "https://img.test/puszek.jpg", source_url: null, sex: "samiec", age: "1" },
  ]);

  // Seed stray reports
  const insertStray = db.prepare(`
    INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
    VALUES (@description, @image_url, @latitude, @longitude, @city, @reported_at)
  `);
  insertStray.run({
    description: "Orange cat near park",
    image_url: "https://img.test/stray1.jpg",
    latitude: 52.23,
    longitude: 21.01,
    city: "Warszawa",
    reported_at: "2024-01-15T10:30:00.000Z",
  });
  insertStray.run({
    description: "Black cat under bridge",
    image_url: null,
    latitude: 50.06,
    longitude: 19.94,
    city: "Kraków",
    reported_at: "2024-01-16T14:00:00.000Z",
  });
});

afterAll(() => {
  db.close();
});

describe("GET /api/shelters — response shape (Req 10.1)", () => {
  it("returns an array of shelters with required fields", async () => {
    const res = await request(app).get("/api/shelters");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    for (const shelter of res.body) {
      expect(shelter).toHaveProperty("id_zewnetrzne");
      expect(shelter).toHaveProperty("name");
      expect(shelter).toHaveProperty("city");
      expect(shelter).toHaveProperty("voivodeship");
      expect(shelter).toHaveProperty("website_url");
      expect(shelter).toHaveProperty("cat_count");
      expect(shelter).toHaveProperty("latitude");
      expect(shelter).toHaveProperty("longitude");

      expect(typeof shelter.id_zewnetrzne).toBe("number");
      expect(typeof shelter.name).toBe("string");
      expect(typeof shelter.city).toBe("string");
      expect(typeof shelter.voivodeship).toBe("string");
      expect(typeof shelter.cat_count).toBe("number");
    }
  });

  it("cat_count reflects actual seeded cats", async () => {
    const res = await request(app).get("/api/shelters");

    const azyl = res.body.find((s: { id_zewnetrzne: number }) => s.id_zewnetrzne === 100);
    const przystan = res.body.find((s: { id_zewnetrzne: number }) => s.id_zewnetrzne === 200);

    expect(azyl.cat_count).toBe(2);
    expect(przystan.cat_count).toBe(1);
  });
});

describe("GET /api/cats — response shape (Req 10.2)", () => {
  it("returns cats array and pagination object", async () => {
    const res = await request(app).get("/api/cats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("cats");
    expect(res.body).toHaveProperty("pagination");
    expect(Array.isArray(res.body.cats)).toBe(true);
  });

  it("pagination has required fields", async () => {
    const res = await request(app).get("/api/cats");

    const { pagination } = res.body;
    expect(pagination).toHaveProperty("page");
    expect(pagination).toHaveProperty("limit");
    expect(pagination).toHaveProperty("total");
    expect(pagination).toHaveProperty("totalPages");

    expect(typeof pagination.page).toBe("number");
    expect(typeof pagination.limit).toBe("number");
    expect(typeof pagination.total).toBe("number");
    expect(typeof pagination.totalPages).toBe("number");
  });

  it("each cat has all required fields", async () => {
    const res = await request(app).get("/api/cats");

    expect(res.body.cats.length).toBeGreaterThan(0);

    for (const cat of res.body.cats) {
      expect(cat).toHaveProperty("id");
      expect(cat).toHaveProperty("name");
      expect(cat).toHaveProperty("description");
      expect(cat).toHaveProperty("image_url");
      expect(cat).toHaveProperty("source_url");
      expect(cat).toHaveProperty("shelter_id");
      expect(cat).toHaveProperty("shelter_name");
      expect(cat).toHaveProperty("shelter_city");
      expect(cat).toHaveProperty("sex");
      expect(cat).toHaveProperty("age");
      expect(cat).toHaveProperty("shelter_url");
      expect(cat).toHaveProperty("shelter_voivodeship");

      expect(typeof cat.id).toBe("number");
      expect(typeof cat.name).toBe("string");
      expect(typeof cat.shelter_id).toBe("number");
      expect(typeof cat.shelter_name).toBe("string");
      expect(typeof cat.shelter_city).toBe("string");
    }
  });

  it("total reflects all seeded cats", async () => {
    const res = await request(app).get("/api/cats");
    expect(res.body.pagination.total).toBe(3);
  });
});

describe("GET /api/strays — response shape (Req 10.3)", () => {
  it("returns an array of stray reports with required fields", async () => {
    const res = await request(app).get("/api/strays");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    for (const stray of res.body) {
      expect(stray).toHaveProperty("id");
      expect(stray).toHaveProperty("description");
      expect(stray).toHaveProperty("image_url");
      expect(stray).toHaveProperty("latitude");
      expect(stray).toHaveProperty("longitude");
      expect(stray).toHaveProperty("city");
      expect(stray).toHaveProperty("reported_at");

      expect(typeof stray.id).toBe("number");
      expect(typeof stray.description).toBe("string");
      expect(typeof stray.latitude).toBe("number");
      expect(typeof stray.longitude).toBe("number");
      expect(typeof stray.city).toBe("string");
      expect(typeof stray.reported_at).toBe("string");
    }
  });
});

describe("GET /api/stats — response shape (Req 10.4)", () => {
  it("returns stats with all required fields", async () => {
    const res = await request(app).get("/api/stats");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("totalCats");
    expect(res.body).toHaveProperty("totalShelters");
    expect(res.body).toHaveProperty("sheltersWithCats");
    expect(res.body).toHaveProperty("lastFetched");

    expect(typeof res.body.totalCats).toBe("number");
    expect(typeof res.body.totalShelters).toBe("number");
    expect(typeof res.body.sheltersWithCats).toBe("number");
  });

  it("stats values match seeded data", async () => {
    const res = await request(app).get("/api/stats");

    expect(res.body.totalCats).toBe(3);
    expect(res.body.totalShelters).toBe(2);
    expect(res.body.sheltersWithCats).toBe(2);
  });
});

describe("GET /api/health — response shape", () => {
  it("returns status ok with uptime and timestamp", async () => {
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("status", "ok");
    expect(res.body).toHaveProperty("uptime");
    expect(res.body).toHaveProperty("timestamp");

    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    // Timestamp should be a valid ISO 8601 string
    const ts = new Date(res.body.timestamp);
    expect(ts.toISOString()).toBe(res.body.timestamp);
  });
});

describe("POST /api/admin/sync — auth enforcement", () => {
  it("returns 503 when Temporal is unreachable with valid token", async () => {
    const res = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", `Bearer ${validAdminToken()}`);

    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Workflow engine unavailable");
  }, 15000);

  it("returns 401 without auth token", async () => {
    const res = await request(app).post("/api/admin/sync");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 with invalid Bearer token", async () => {
    const invalidToken = Buffer.from("user:12345").toString("base64");
    const res = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("GET /api/admin/sync/status — auth enforcement", () => {
  it("returns 503 when Temporal is unreachable with valid token", async () => {
    const res = await request(app)
      .get("/api/admin/sync/status")
      .set("Authorization", `Bearer ${validAdminToken()}`);

    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Sync status temporarily unavailable");
  }, 15000);

  it("returns 401 without auth token", async () => {
    const res = await request(app).get("/api/admin/sync/status");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("Auth middleware rejects unauthenticated requests", () => {
  const adminEndpoints = [
    { method: "post" as const, path: "/api/admin/sync" },
    { method: "get" as const, path: "/api/admin/sync/status" },
    { method: "get" as const, path: "/api/admin/suggestions" },
    { method: "delete" as const, path: "/api/admin/strays/1" },
  ];

  for (const endpoint of adminEndpoints) {
    it(`rejects ${endpoint.method.toUpperCase()} ${endpoint.path} without auth`, async () => {
      const res = await request(app)[endpoint.method](endpoint.path);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });
  }

  for (const endpoint of adminEndpoints) {
    it(`rejects ${endpoint.method.toUpperCase()} ${endpoint.path} with non-Bearer auth`, async () => {
      const res = await request(app)
        [endpoint.method](endpoint.path)
        .set("Authorization", "Basic sometoken");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });
  }
});

describe("GET /api/domination — response shape", () => {
  it("returns correct domination structure", async () => {
    const res = await request(app).get("/api/domination");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("total_shelters_in_poland", 190);
    expect(res.body).toHaveProperty("shelters_covered");
    expect(res.body).toHaveProperty("percentage");
    expect(res.body).toHaveProperty("cats_in_army");
    expect(res.body).toHaveProperty("domination_level");

    expect(typeof res.body.shelters_covered).toBe("number");
    expect(typeof res.body.percentage).toBe("number");
    expect(typeof res.body.cats_in_army).toBe("number");
    expect(typeof res.body.domination_level).toBe("string");
  });

  it("domination_level is one of the valid levels", async () => {
    const res = await request(app).get("/api/domination");

    const validLevels = [
      "Kocie Zwiadowcy",
      "Kocia Partyzantka",
      "Kocia Ofensywa",
      "Pełna Kocia Dominacja",
    ];
    expect(validLevels).toContain(res.body.domination_level);
  });
});

describe("GET /api/achievements — response shape", () => {
  it("returns an array of achievements", async () => {
    const res = await request(app).get("/api/achievements");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each achievement has correct shape", async () => {
    const res = await request(app).get("/api/achievements");

    for (const achievement of res.body) {
      expect(achievement).toHaveProperty("name");
      expect(achievement).toHaveProperty("description");
      expect(achievement).toHaveProperty("icon");
      expect(achievement).toHaveProperty("unlocked_at");
      expect(typeof achievement.name).toBe("string");
      expect(typeof achievement.description).toBe("string");
      expect(typeof achievement.icon).toBe("string");
    }
  });
});
