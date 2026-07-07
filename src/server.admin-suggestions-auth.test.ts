import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import crypto from "crypto";
import type Database from "better-sqlite3";
import type { Express } from "express";

/**
 * Security tests for admin suggestions endpoint authentication.
 * 
 * Validates that the pentest finding "Unauthorized access to admin suggestions 
 * via Bearer-prefix check" has been mitigated.
 * 
 * The vulnerability allowed any remote caller to read admin suggestions by 
 * supplying any `Authorization: Bearer ...` header, because the route only 
 * checked for the prefix and never validated the token.
 * 
 * The fix replaces the inline Bearer prefix check with `requireAdminAuth` 
 * middleware that validates the token signature.
 */

/**
 * Generate a properly signed admin token using the same algorithm as the server.
 * This mimics what the login endpoint returns.
 */
function generateValidAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

/**
 * Seed test suggestions directly into the in-memory SQLite DB.
 */
function seedTestSuggestions(db: Database.Database) {
  const insert = db.prepare(`
    INSERT INTO suggestions (name, city, voivodeship, website_url, submitter_email, submitted_at)
    VALUES (@name, @city, @voivodeship, @website_url, @submitter_email, @submitted_at)
  `);
  insert.run({
    name: "Test Shelter",
    city: "Warsaw",
    voivodeship: "mazowieckie",
    website_url: "https://example.com",
    submitter_email: "test@example.com",
    submitted_at: new Date().toISOString(),
  });
}

describe("GET /api/admin/suggestions - Authentication Security", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedTestSuggestions(db);
  });

  /**
   * PENTEST REPRODUCTION: Step 2 - Attempt to access admin endpoint with arbitrary Bearer token
   */
  it("rejects arbitrary Bearer token that only has the prefix (pentest reproduction)", async () => {
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Bearer fake");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
    expect(Array.isArray(res.body)).toBe(false);
  });

  it("rejects Bearer token with random base64 string", async () => {
    const randomToken = Buffer.from("random:data:here").toString("base64");
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${randomToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("rejects Bearer token with correct format but invalid signature", async () => {
    const payload = `admin:${Date.now()}`;
    const wrongSignature = "0000000000000000000000000000000000000000000000000000000000000000";
    const invalidToken = Buffer.from(`${payload}:${wrongSignature}`).toString("base64");
    
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${invalidToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("rejects Bearer token with user: prefix instead of admin:", async () => {
    const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
    const payload = `user:${Date.now()}`;
    const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
    const invalidToken = Buffer.from(`${payload}:${signature}`).toString("base64");
    
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${invalidToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("rejects requests without Authorization header", async () => {
    const res = await request(app).get("/api/admin/suggestions");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("rejects requests with Basic auth instead of Bearer", async () => {
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("accepts properly signed admin token and returns suggestions", async () => {
    const validToken = generateValidAdminToken();
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validToken}`);
    
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    
    const suggestion = res.body[0];
    expect(suggestion).toHaveProperty("name");
    expect(suggestion).toHaveProperty("city");
    expect(suggestion).toHaveProperty("submitter_email");
  });

  it("does not leak sensitive information in 401 responses", async () => {
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Bearer fake");
    
    const body = JSON.stringify(res.body);
    
    expect(body).not.toMatch(/at\s+\w+\s*\(/);
    expect(body).not.toMatch(/\/home\//);
    expect(body).not.toMatch(/\/src\//);
    expect(body).not.toMatch(/node_modules/);
    expect(body).not.toMatch(/ADMIN_PASSWORD/);
    expect(body).not.toMatch(/TOKEN_SECRET/);
    expect(body).not.toMatch(/process\.env/);
    
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("DELETE /api/admin/suggestions/:index - Authentication Security", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedTestSuggestions(db);
  });

  it("rejects arbitrary Bearer token on DELETE endpoint", async () => {
    // Get the suggestion ID
    const rows = db.prepare("SELECT id FROM suggestions").all() as { id: number }[];
    const id = rows[0].id;

    const res = await request(app)
      .delete(`/api/admin/suggestions/${id}`)
      .set("Authorization", "Bearer fake");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("accepts properly signed admin token on DELETE endpoint", async () => {
    const rows = db.prepare("SELECT id FROM suggestions").all() as { id: number }[];
    const id = rows[0].id;

    const validToken = generateValidAdminToken();
    const res = await request(app)
      .delete(`/api/admin/suggestions/${id}`)
      .set("Authorization", `Bearer ${validToken}`);
    
    expect([200, 404]).toContain(res.status);
  });
});

describe("POST /api/suggest-shelter - Public Endpoint", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  it("allows unauthenticated users to submit suggestions", async () => {
    const res = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "New Shelter",
        city: "Krakow",
        voivodeship: "małopolskie",
        website_url: "https://newshelter.example.com",
        submitter_email: "user@example.com",
      });
    
    expect(res.status).toBe(200);
    expect(res.body.message).toContain("submitted for review");
  });

  it("stores suggestions that can only be retrieved by authenticated admins", async () => {
    // Submit a suggestion as unauthenticated user
    const submitRes = await request(app)
      .post("/api/suggest-shelter")
      .send({
        name: "Secret Shelter",
        city: "Gdansk",
        submitter_email: "secret@example.com",
      });
    
    expect(submitRes.status).toBe(200);
    
    // Try to retrieve suggestions without auth - should fail
    const getRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Bearer fake");
    
    expect(getRes.status).toBe(401);
    
    // Retrieve with valid token - should succeed
    const validToken = generateValidAdminToken();
    const authGetRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validToken}`);
    
    expect(authGetRes.status).toBe(200);
    expect(Array.isArray(authGetRes.body)).toBe(true);
    
    const secretSuggestion = authGetRes.body.find(
      (s: any) => s.submitter_email === "secret@example.com"
    );
    expect(secretSuggestion).toBeDefined();
    expect(secretSuggestion.name).toBe("Secret Shelter");
  });
});

describe("Integration: Login flow and token usage", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
    seedTestSuggestions(db);
  });

  it("allows access to suggestions after successful login", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ password: process.env.ADMIN_PASSWORD || "admin123" });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
    
    const token = loginRes.body.token;
    
    const suggestionsRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${token}`);
    
    expect(suggestionsRes.status).toBe(200);
    expect(Array.isArray(suggestionsRes.body)).toBe(true);
  });

  it("denies access with wrong password", async () => {
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ password: "wrongpassword" });
    
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.message).toBe("Invalid password");
  });
});
