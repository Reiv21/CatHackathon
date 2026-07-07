import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import type Database from "better-sqlite3";
import type { Express } from "express";

/**
 * Security tests for authentication bypass vulnerability (CVE-PENTEST-2024-001)
 * 
 * Pentest Finding: Forged Bearer tokens bypass admin authentication on administrative routes
 * 
 * This test suite verifies that the authentication bypass vulnerability has been mitigated.
 * Previously, admin endpoints only checked if Authorization header started with "Bearer "
 * without validating the token signature. Now all admin endpoints use requireAdminAuth
 * middleware which validates HMAC signatures.
 * 
 * Tests cover:
 * - DELETE /api/admin/strays/:id (previously vulnerable)
 * - GET /api/admin/suggestions (previously vulnerable)
 * - DELETE /api/admin/suggestions/:index (previously vulnerable)
 * - POST /api/admin/sync (already protected)
 * - GET /api/admin/sync/status (already protected)
 */

/**
 * Helper: Generate a properly signed admin token by logging in
 */
async function getValidAdminToken(app: Express): Promise<string> {
  const res = await request(app)
    .post("/api/admin/login")
    .send({ password: process.env.ADMIN_PASSWORD || "admin123" });
  
  if (res.status !== 200 || !res.body.token) {
    throw new Error("Failed to obtain valid admin token");
  }
  
  return res.body.token;
}

/**
 * Helper: Create forged tokens that should be rejected
 */
function createForgedTokens(): Array<{ name: string; token: string }> {
  return [
    {
      name: "Bearer with arbitrary text",
      token: "Bearer arbitrary_text_without_validation",
    },
    {
      name: "Bearer with empty token",
      token: "Bearer ",
    },
    {
      name: "Bearer with base64 encoded admin: prefix (no signature)",
      token: `Bearer ${Buffer.from("admin:12345").toString("base64")}`,
    },
    {
      name: "Bearer with base64 encoded admin: prefix and fake signature",
      token: `Bearer ${Buffer.from("admin:12345:fakesignature").toString("base64")}`,
    },
    {
      name: "Bearer with base64 encoded admin: prefix and wrong signature",
      token: `Bearer ${Buffer.from("admin:12345:0000000000000000000000000000000000000000000000000000000000000000").toString("base64")}`,
    },
    {
      name: "Bearer with just 'admin' (no colon)",
      token: `Bearer ${Buffer.from("admin").toString("base64")}`,
    },
    {
      name: "Bearer with user: prefix instead of admin:",
      token: `Bearer ${Buffer.from("user:12345:signature").toString("base64")}`,
    },
    {
      name: "Bearer with random base64",
      token: `Bearer ${Buffer.from("random_data_12345").toString("base64")}`,
    },
    {
      name: "Bearer with malformed base64",
      token: "Bearer !!!invalid!!!",
    },
  ];
}

/**
 * Seed test stray reports into the in-memory DB.
 */
function seedTestStrays(db: Database.Database, strays: Array<{ id?: number; description: string; city: string }>) {
  const insert = db.prepare(`
    INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
    VALUES (@description, NULL, 52.23, 21.01, @city, datetime('now'))
  `);
  for (const stray of strays) {
    insert.run({ description: stray.description, city: stray.city });
  }
}

/**
 * Seed test suggestions into the in-memory DB.
 */
function seedTestSuggestions(db: Database.Database, suggestions: Array<{ name: string; city: string }>) {
  const insert = db.prepare(`
    INSERT INTO suggestions (name, city, voivodeship, website_url, submitter_email, submitted_at)
    VALUES (@name, @city, '', NULL, NULL, datetime('now'))
  `);
  for (const s of suggestions) {
    insert.run({ name: s.name, city: s.city });
  }
}

describe("Security: Authentication Bypass Mitigation (CVE-PENTEST-2024-001)", () => {
  let app: Express;
  let db: Database.Database;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    db = result.db;
  });

  describe("DELETE /api/admin/strays/:id - Previously vulnerable endpoint", () => {
    let strayIds: number[];

    beforeEach(() => {
      seedTestStrays(db, [
        { description: "Test stray 1", city: "Location 1" },
        { description: "Test stray 2", city: "Location 2" },
        { description: "Test stray 999", city: "Location 999" },
      ]);
      strayIds = (db.prepare("SELECT id FROM stray_reports ORDER BY id").all() as { id: number }[]).map(r => r.id);
    });

    it("rejects request with no Authorization header", async () => {
      const res = await request(app).delete(`/api/admin/strays/${strayIds[0]}`);
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects request with non-Bearer authorization", async () => {
      const res = await request(app)
        .delete(`/api/admin/strays/${strayIds[0]}`)
        .set("Authorization", "Basic sometoken");
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      const targetId = strayIds[2]; // "Test stray 999"
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .delete(`/api/admin/strays/${targetId}`)
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
        
        // Verify the stray was NOT deleted (data integrity check)
        const row = db.prepare("SELECT id FROM stray_reports WHERE id = ?").get(targetId) as { id: number } | undefined;
        expect(row, `Stray was deleted with forged token: ${name}`).toBeDefined();
      }
    });

    it("accepts request with valid signed token from login", async () => {
      const validToken = await getValidAdminToken(app);
      const targetId = strayIds[0]; // "Test stray 1"
      
      const res = await request(app)
        .delete(`/api/admin/strays/${targetId}`)
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Deleted");
      
      // Verify the stray was actually deleted
      const row = db.prepare("SELECT id FROM stray_reports WHERE id = ?").get(targetId) as { id: number } | undefined;
      expect(row).toBeUndefined();
    });

    it("prevents destructive write with forged token (data integrity)", async () => {
      const beforeCount = (db.prepare("SELECT COUNT(*) AS count FROM stray_reports").get() as { count: number }).count;
      
      // Attempt deletion with forged token
      const forgedToken = `Bearer ${Buffer.from("admin:12345:fakesig").toString("base64")}`;
      await request(app)
        .delete(`/api/admin/strays/${strayIds[1]}`)
        .set("Authorization", forgedToken);
      
      // Verify data was NOT modified
      const afterCount = (db.prepare("SELECT COUNT(*) AS count FROM stray_reports").get() as { count: number }).count;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe("GET /api/admin/suggestions - Previously vulnerable endpoint", () => {
    beforeEach(() => {
      seedTestSuggestions(db, [
        { name: "Test Shelter 1", city: "Warsaw" },
        { name: "Test Shelter 2", city: "Krakow" },
      ]);
    });

    it("rejects request with no Authorization header", async () => {
      const res = await request(app).get("/api/admin/suggestions");
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .get("/api/admin/suggestions")
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
      }
    });

    it("accepts request with valid signed token from login", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
    });

    it("prevents information disclosure with forged token", async () => {
      const forgedToken = `Bearer ${Buffer.from("admin:12345").toString("base64")}`;
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", forgedToken);
      
      expect(res.status).toBe(401);
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/admin/suggestions/:index - Previously vulnerable endpoint", () => {
    let suggestionIds: number[];

    beforeEach(() => {
      seedTestSuggestions(db, [
        { name: "Test Shelter 1", city: "Warsaw" },
        { name: "Test Shelter 2", city: "Krakow" },
        { name: "Test Shelter 3", city: "Gdansk" },
      ]);
      suggestionIds = (db.prepare("SELECT id FROM suggestions ORDER BY id").all() as { id: number }[]).map(r => r.id);
    });

    it("rejects request with no Authorization header", async () => {
      const res = await request(app).delete(`/api/admin/suggestions/${suggestionIds[0]}`);
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .delete(`/api/admin/suggestions/${suggestionIds[0]}`)
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
        
        // Verify the suggestion was NOT deleted
        const count = (db.prepare("SELECT COUNT(*) AS count FROM suggestions").get() as { count: number }).count;
        expect(count, `Suggestion was deleted with forged token: ${name}`).toBe(3);
      }
    });

    it("accepts request with valid signed token from login", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .delete(`/api/admin/suggestions/${suggestionIds[0]}`)
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Deleted");
      
      // Verify the suggestion was actually deleted
      const count = (db.prepare("SELECT COUNT(*) AS count FROM suggestions").get() as { count: number }).count;
      expect(count).toBe(2);
      
      // Verify the right one was deleted (first one gone, second remains)
      const remaining = db.prepare("SELECT name FROM suggestions ORDER BY id").all() as { name: string }[];
      expect(remaining[0].name).toBe("Test Shelter 2");
    });

    it("prevents destructive write with forged token (data integrity)", async () => {
      const beforeCount = (db.prepare("SELECT COUNT(*) AS count FROM suggestions").get() as { count: number }).count;
      
      // Attempt deletion with forged token
      const forgedToken = `Bearer ${Buffer.from("admin:99999:fakesignature").toString("base64")}`;
      await request(app)
        .delete(`/api/admin/suggestions/${suggestionIds[1]}`)
        .set("Authorization", forgedToken);
      
      // Verify data was NOT modified
      const afterCount = (db.prepare("SELECT COUNT(*) AS count FROM suggestions").get() as { count: number }).count;
      expect(afterCount).toBe(beforeCount);
    });
  });

  describe("POST /api/admin/sync - Already protected endpoint", () => {
    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .post("/api/admin/sync")
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
      }
    });

    it("accepts valid signed token (returns 503 due to no Temporal, not 401)", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .post("/api/admin/sync")
        .set("Authorization", `Bearer ${validToken}`);
      
      // Should not be 401 (auth passed)
      expect(res.status).not.toBe(401);
      // Expected: 503 (Workflow engine unavailable)
      expect(res.status).toBe(503);
    }, 15000);
  });

  describe("GET /api/admin/sync/status - Already protected endpoint", () => {
    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .get("/api/admin/sync/status")
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
      }
    });

    it("accepts valid signed token (returns 503 due to no Temporal, not 401)", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .get("/api/admin/sync/status")
        .set("Authorization", `Bearer ${validToken}`);
      
      // Should not be 401 (auth passed)
      expect(res.status).not.toBe(401);
      // Expected: 503 (Sync status temporarily unavailable)
      expect(res.status).toBe(503);
    }, 15000);
  });

  describe("Token signature validation", () => {
    it("rejects token with valid format but invalid signature", async () => {
      const timestamp = Date.now();
      const payload = `admin:${timestamp}`;
      const wrongSignature = "0".repeat(64);
      const forgedToken = Buffer.from(`${payload}:${wrongSignature}`).toString("base64");
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${forgedToken}`);
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects token with signature computed using wrong secret", async () => {
      const timestamp = Date.now();
      const payload = `admin:${timestamp}`;
      const crypto = await import("crypto");
      const wrongSignature = crypto.createHmac("sha256", "wrong_secret").update(payload).digest("hex");
      const forgedToken = Buffer.from(`${payload}:${wrongSignature}`).toString("base64");
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${forgedToken}`);
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("accepts token with valid HMAC signature from login endpoint", async () => {
      const validToken = await getValidAdminToken(app);
      
      // Decode to verify structure
      const decoded = Buffer.from(validToken, "base64").toString("utf-8");
      const parts = decoded.split(":");
      
      expect(parts.length).toBe(3);
      expect(parts[0]).toBe("admin");
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-f0-9]{64}$/); // HMAC-SHA256 hex
      
      // Use the token
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
    });
  });

  describe("No information leakage in error responses", () => {
    const sensitivePatterns = [
      /at\s+\w+\s*\(/i,
      /Error:\s/i,
      /\/home\//i,
      /\/usr\//i,
      /\/src\//i,
      /node_modules/i,
      /\.ts\b/i,
      /\.js:/i,
      /ADMIN_PASSWORD/i,
      /TOKEN_SECRET/i,
      /TEMPORAL_ADDRESS/i,
      /process\.env/i,
    ];

    it("401 responses contain no sensitive information", async () => {
      const forgedToken = `Bearer ${Buffer.from("admin:12345:fake").toString("base64")}`;
      
      const endpoints = [
        { method: "get" as const, path: "/api/admin/suggestions" },
        { method: "delete" as const, path: "/api/admin/strays/1" },
        { method: "delete" as const, path: "/api/admin/suggestions/0" },
        { method: "post" as const, path: "/api/admin/sync" },
        { method: "get" as const, path: "/api/admin/sync/status" },
      ];
      
      for (const endpoint of endpoints) {
        const res = await request(app)[endpoint.method](endpoint.path)
          .set("Authorization", forgedToken);
        
        expect(res.status).toBe(401);
        
        const responseText = JSON.stringify(res.body);
        for (const pattern of sensitivePatterns) {
          expect(responseText, `Leaked info in ${endpoint.method.toUpperCase()} ${endpoint.path}`).not.toMatch(pattern);
        }
        
        expect(res.body).toEqual({ message: "Unauthorized" });
      }
    });
  });

  describe("Exploit scenario reproduction", () => {
    it("reproduces pentest Step 1: DELETE /api/admin/strays/:id with Bearer prefix only", async () => {
      // Setup: Create a stray record
      db.prepare(`
        INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
        VALUES ('Critical stray', NULL, 52.23, 21.01, 'Important location', datetime('now'))
      `).run();
      const row = db.prepare("SELECT id FROM stray_reports WHERE description = 'Critical stray'").get() as { id: number };
      
      // Attack: Try to delete with just "Bearer " prefix (no validation)
      const res = await request(app)
        .delete(`/api/admin/strays/${row.id}`)
        .set("Authorization", "Bearer anything_goes_here");
      
      // Verify: Attack is blocked
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
      
      // Verify: Data is NOT deleted
      const count = (db.prepare("SELECT COUNT(*) AS count FROM stray_reports WHERE id = ?").get(row.id) as { count: number }).count;
      expect(count).toBe(1);
    });

    it("reproduces pentest Step 2: GET /api/admin/suggestions with Bearer prefix only", async () => {
      // Setup: Create sensitive suggestions
      seedTestSuggestions(db, [
        { name: "Sensitive Shelter", city: "Secret City" },
      ]);
      
      // Attack: Try to read with just "Bearer " prefix
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", "Bearer fake_token");
      
      // Verify: Attack is blocked
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
      
      // Verify: No data is leaked
      expect(res.body).not.toHaveProperty("name");
      expect(res.body).not.toHaveProperty("submitter_email");
    });

    it("reproduces pentest Step 3: forged admin: prefix token", async () => {
      const forgedToken = Buffer.from("admin:12345").toString("base64");
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${forgedToken}`);
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("reproduces pentest Step 4: forged token on multiple admin endpoints", async () => {
      const forgedToken = Buffer.from("admin:99999:fakesig").toString("base64");
      
      const endpoints = [
        { method: "get" as const, path: "/api/admin/suggestions" },
        { method: "delete" as const, path: "/api/admin/strays/1" },
        { method: "delete" as const, path: "/api/admin/suggestions/0" },
        { method: "post" as const, path: "/api/admin/sync" },
        { method: "get" as const, path: "/api/admin/sync/status" },
      ];
      
      for (const endpoint of endpoints) {
        const res = await request(app)[endpoint.method](endpoint.path)
          .set("Authorization", `Bearer ${forgedToken}`);
        
        expect(res.status, `${endpoint.method.toUpperCase()} ${endpoint.path}`).toBe(401);
        expect(res.body.message, `${endpoint.method.toUpperCase()} ${endpoint.path}`).toBe("Unauthorized");
      }
    });
  });
});
