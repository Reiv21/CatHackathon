import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, writeFileSync, mkdirSync, rmSync } from "fs";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

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
 * Setup test suggestions data
 */
function setupTestSuggestions() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
  const testSuggestions = [
    {
      name: "Test Shelter",
      city: "Warsaw",
      voivodeship: "mazowieckie",
      website_url: "https://example.com",
      submitter_email: "test@example.com",
      submitted_at: new Date().toISOString(),
    },
  ];
  writeFileSync(suggestionsPath, JSON.stringify(testSuggestions, null, 2));
}

describe("GET /api/admin/suggestions - Authentication Security", () => {
  beforeEach(() => {
    setupTestSuggestions();
  });

  /**
   * PENTEST REPRODUCTION: Step 2 - Attempt to access admin endpoint with arbitrary Bearer token
   * 
   * This test reproduces the exact attack scenario from the pentest:
   * An attacker sends a request with any Bearer-prefixed header (e.g., "Bearer fake")
   * 
   * EXPECTED BEHAVIOR (after fix):
   * - The endpoint should reject the request with 401 Unauthorized
   * - The token signature should be validated, not just the prefix
   */
  it("rejects arbitrary Bearer token that only has the prefix (pentest reproduction)", async () => {
    const { app } = createApp();
    
    // Attacker sends any Bearer-prefixed header
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Bearer fake");
    
    // Should be rejected with 401
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
    
    // Should NOT return suggestions data
    expect(Array.isArray(res.body)).toBe(false);
  });

  /**
   * Test that various invalid Bearer tokens are rejected
   */
  it("rejects Bearer token with random base64 string", async () => {
    const { app } = createApp();
    
    const randomToken = Buffer.from("random:data:here").toString("base64");
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${randomToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  /**
   * Test that a token with correct format but wrong signature is rejected
   */
  it("rejects Bearer token with correct format but invalid signature", async () => {
    const { app } = createApp();
    
    // Create a token with correct format (admin:timestamp:signature) but wrong signature
    const payload = `admin:${Date.now()}`;
    const wrongSignature = "0000000000000000000000000000000000000000000000000000000000000000";
    const invalidToken = Buffer.from(`${payload}:${wrongSignature}`).toString("base64");
    
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${invalidToken}`);
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  /**
   * Test that a token with wrong prefix is rejected
   */
  it("rejects Bearer token with user: prefix instead of admin:", async () => {
    const { app } = createApp();
    
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

  /**
   * Test that requests without Authorization header are rejected
   */
  it("rejects requests without Authorization header", async () => {
    const { app } = createApp();
    
    const res = await request(app).get("/api/admin/suggestions");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  /**
   * Test that requests with non-Bearer auth schemes are rejected
   */
  it("rejects requests with Basic auth instead of Bearer", async () => {
    const { app } = createApp();
    
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Basic dXNlcjpwYXNz");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  /**
   * Test that a properly signed token IS accepted
   * This verifies that legitimate admin access still works after the fix
   */
  it("accepts properly signed admin token and returns suggestions", async () => {
    const { app } = createApp();
    
    const validToken = generateValidAdminToken();
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${validToken}`);
    
    // Should succeed
    expect(res.status).toBe(200);
    
    // Should return array of suggestions
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    
    // Verify the suggestion data structure
    const suggestion = res.body[0];
    expect(suggestion).toHaveProperty("name");
    expect(suggestion).toHaveProperty("city");
    expect(suggestion).toHaveProperty("submitter_email");
  });

  /**
   * Test that error responses don't leak sensitive information
   */
  it("does not leak sensitive information in 401 responses", async () => {
    const { app } = createApp();
    
    const res = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", "Bearer fake");
    
    const body = JSON.stringify(res.body);
    
    // No stack traces
    expect(body).not.toMatch(/at\s+\w+\s*\(/);
    
    // No filesystem paths
    expect(body).not.toMatch(/\/home\//);
    expect(body).not.toMatch(/\/src\//);
    expect(body).not.toMatch(/node_modules/);
    
    // No env var names or secrets
    expect(body).not.toMatch(/ADMIN_PASSWORD/);
    expect(body).not.toMatch(/TOKEN_SECRET/);
    expect(body).not.toMatch(/process\.env/);
    
    // Only contains generic message
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("DELETE /api/admin/suggestions/:index - Authentication Security", () => {
  beforeEach(() => {
    setupTestSuggestions();
  });

  /**
   * Test that DELETE endpoint also requires valid token
   */
  it("rejects arbitrary Bearer token on DELETE endpoint", async () => {
    const { app } = createApp();
    
    const res = await request(app)
      .delete("/api/admin/suggestions/0")
      .set("Authorization", "Bearer fake");
    
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  /**
   * Test that DELETE works with valid token
   */
  it("accepts properly signed admin token on DELETE endpoint", async () => {
    const { app } = createApp();
    
    const validToken = generateValidAdminToken();
    const res = await request(app)
      .delete("/api/admin/suggestions/0")
      .set("Authorization", `Bearer ${validToken}`);
    
    // Should succeed (200 or 404 depending on whether suggestions exist)
    expect([200, 404]).toContain(res.status);
  });
});

describe("POST /api/suggest-shelter - Public Endpoint", () => {
  /**
   * Verify that the public suggestion submission endpoint still works
   * without authentication (as intended)
   */
  it("allows unauthenticated users to submit suggestions", async () => {
    const { app } = createApp();
    
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

  /**
   * Verify that submitted suggestions are stored but not directly accessible
   * without proper authentication
   */
  it("stores suggestions that can only be retrieved by authenticated admins", async () => {
    const { app } = createApp();
    
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
    
    // Verify the submitted suggestion is in the list
    const secretSuggestion = authGetRes.body.find(
      (s: any) => s.submitter_email === "secret@example.com"
    );
    expect(secretSuggestion).toBeDefined();
    expect(secretSuggestion.name).toBe("Secret Shelter");
  });
});

describe("Integration: Login flow and token usage", () => {
  /**
   * Test the complete flow: login -> get token -> use token to access admin endpoint
   */
  it("allows access to suggestions after successful login", async () => {
    const { app } = createApp();
    setupTestSuggestions();
    
    // Login with correct password
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ password: process.env.ADMIN_PASSWORD || "admin123" });
    
    expect(loginRes.status).toBe(200);
    expect(loginRes.body).toHaveProperty("token");
    
    const token = loginRes.body.token;
    
    // Use the token to access suggestions
    const suggestionsRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${token}`);
    
    expect(suggestionsRes.status).toBe(200);
    expect(Array.isArray(suggestionsRes.body)).toBe(true);
  });

  /**
   * Test that login fails with wrong password
   */
  it("denies access with wrong password", async () => {
    const { app } = createApp();
    
    const loginRes = await request(app)
      .post("/api/admin/login")
      .send({ password: "wrongpassword" });
    
    expect(loginRes.status).toBe(401);
    expect(loginRes.body.message).toBe("Invalid password");
  });
});
