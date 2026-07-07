import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

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
async function getValidAdminToken(app: Express.Application): Promise<string> {
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

describe("Security: Authentication Bypass Mitigation (CVE-PENTEST-2024-001)", () => {
  let app: Express.Application;

  beforeEach(() => {
    const result = createApp();
    app = result.app;
    
    // Ensure data directory exists for tests
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
  });

  describe("DELETE /api/admin/strays/:id - Previously vulnerable endpoint", () => {
    beforeEach(() => {
      // Setup test data
      const straysPath = path.join(DATA_DIR, "strays.json");
      const testStrays = [
        { id: 1, description: "Test stray 1", location: "Test location 1" },
        { id: 2, description: "Test stray 2", location: "Test location 2" },
        { id: 999, description: "Test stray 999", location: "Test location 999" },
      ];
      writeFileSync(straysPath, JSON.stringify(testStrays, null, 2));
    });

    it("rejects request with no Authorization header", async () => {
      const res = await request(app).delete("/api/admin/strays/1");
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects request with non-Bearer authorization", async () => {
      const res = await request(app)
        .delete("/api/admin/strays/1")
        .set("Authorization", "Basic sometoken");
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .delete("/api/admin/strays/999")
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
        
        // Verify the stray was NOT deleted (data integrity check)
        const straysPath = path.join(DATA_DIR, "strays.json");
        const strays = JSON.parse(readFileSync(straysPath, "utf-8"));
        const stray999 = strays.find((s: { id: number }) => s.id === 999);
        expect(stray999, `Stray was deleted with forged token: ${name}`).toBeDefined();
      }
    });

    it("accepts request with valid signed token from login", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .delete("/api/admin/strays/1")
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Deleted");
      
      // Verify the stray was actually deleted
      const straysPath = path.join(DATA_DIR, "strays.json");
      const strays = JSON.parse(readFileSync(straysPath, "utf-8"));
      const stray1 = strays.find((s: { id: number }) => s.id === 1);
      expect(stray1).toBeUndefined();
    });

    it("prevents destructive write with forged token (data integrity)", async () => {
      const straysPath = path.join(DATA_DIR, "strays.json");
      const beforeStrays = JSON.parse(readFileSync(straysPath, "utf-8"));
      const beforeCount = beforeStrays.length;
      
      // Attempt deletion with forged token
      const forgedToken = `Bearer ${Buffer.from("admin:12345:fakesig").toString("base64")}`;
      await request(app)
        .delete("/api/admin/strays/2")
        .set("Authorization", forgedToken);
      
      // Verify data was NOT modified
      const afterStrays = JSON.parse(readFileSync(straysPath, "utf-8"));
      expect(afterStrays.length).toBe(beforeCount);
      expect(afterStrays).toEqual(beforeStrays);
    });
  });

  describe("GET /api/admin/suggestions - Previously vulnerable endpoint", () => {
    beforeEach(() => {
      // Setup test data
      const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
      const testSuggestions = [
        { name: "Test Shelter 1", city: "Warsaw", submitted_at: "2024-01-01T00:00:00.000Z" },
        { name: "Test Shelter 2", city: "Krakow", submitted_at: "2024-01-02T00:00:00.000Z" },
      ];
      writeFileSync(suggestionsPath, JSON.stringify(testSuggestions, null, 2));
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
      // Should not return suggestions data
      expect(Array.isArray(res.body)).toBe(false);
      expect(res.body.message).toBe("Unauthorized");
    });
  });

  describe("DELETE /api/admin/suggestions/:index - Previously vulnerable endpoint", () => {
    beforeEach(() => {
      // Setup test data
      const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
      const testSuggestions = [
        { name: "Test Shelter 1", city: "Warsaw", submitted_at: "2024-01-01T00:00:00.000Z" },
        { name: "Test Shelter 2", city: "Krakow", submitted_at: "2024-01-02T00:00:00.000Z" },
        { name: "Test Shelter 3", city: "Gdansk", submitted_at: "2024-01-03T00:00:00.000Z" },
      ];
      writeFileSync(suggestionsPath, JSON.stringify(testSuggestions, null, 2));
    });

    it("rejects request with no Authorization header", async () => {
      const res = await request(app).delete("/api/admin/suggestions/0");
      
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });

    it("rejects all forged Bearer tokens", async () => {
      const forgedTokens = createForgedTokens();
      
      for (const { name, token } of forgedTokens) {
        const res = await request(app)
          .delete("/api/admin/suggestions/0")
          .set("Authorization", token);
        
        expect(res.status, `Failed for: ${name}`).toBe(401);
        expect(res.body.message, `Failed for: ${name}`).toBe("Unauthorized");
        
        // Verify the suggestion was NOT deleted
        const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
        const suggestions = JSON.parse(readFileSync(suggestionsPath, "utf-8"));
        expect(suggestions.length, `Suggestion was deleted with forged token: ${name}`).toBe(3);
      }
    });

    it("accepts request with valid signed token from login", async () => {
      const validToken = await getValidAdminToken(app);
      
      const res = await request(app)
        .delete("/api/admin/suggestions/0")
        .set("Authorization", `Bearer ${validToken}`);
      
      expect(res.status).toBe(200);
      expect(res.body.message).toBe("Deleted");
      
      // Verify the suggestion was actually deleted
      const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
      const suggestions = JSON.parse(readFileSync(suggestionsPath, "utf-8"));
      expect(suggestions.length).toBe(2);
      expect(suggestions[0].name).toBe("Test Shelter 2");
    });

    it("prevents destructive write with forged token (data integrity)", async () => {
      const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
      const beforeSuggestions = JSON.parse(readFileSync(suggestionsPath, "utf-8"));
      const beforeCount = beforeSuggestions.length;
      
      // Attempt deletion with forged token
      const forgedToken = `Bearer ${Buffer.from("admin:99999:fakesignature").toString("base64")}`;
      await request(app)
        .delete("/api/admin/suggestions/1")
        .set("Authorization", forgedToken);
      
      // Verify data was NOT modified
      const afterSuggestions = JSON.parse(readFileSync(suggestionsPath, "utf-8"));
      expect(afterSuggestions.length).toBe(beforeCount);
      expect(afterSuggestions).toEqual(beforeSuggestions);
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
      // Create a token with correct structure but wrong signature
      const timestamp = Date.now();
      const payload = `admin:${timestamp}`;
      const wrongSignature = "0".repeat(64); // 64 zeros instead of real HMAC
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
      // Use a different secret to compute signature
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
      /at\s+\w+\s*\(/i,           // Stack trace
      /Error:\s/i,                // Error details
      /\/home\//i,                // File paths
      /\/usr\//i,                 // System paths
      /\/src\//i,                 // Source paths
      /node_modules/i,            // Dependencies
      /\.ts\b/i,                  // TypeScript files
      /\.js:/i,                   // JS files with line numbers
      /ADMIN_PASSWORD/i,          // Config values
      /TOKEN_SECRET/i,            // Config values
      /TEMPORAL_ADDRESS/i,        // Config values
      /process\.env/i,            // Environment references
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
        
        // Response should only contain generic message
        expect(res.body).toEqual({ message: "Unauthorized" });
      }
    });
  });

  describe("Exploit scenario reproduction", () => {
    it("reproduces pentest Step 1: DELETE /api/admin/strays/:id with Bearer prefix only", async () => {
      // Setup: Create a stray record
      const straysPath = path.join(DATA_DIR, "strays.json");
      const testStrays = [
        { id: 42, description: "Critical stray", location: "Important location" },
      ];
      writeFileSync(straysPath, JSON.stringify(testStrays, null, 2));
      
      // Attack: Try to delete with just "Bearer " prefix (no validation)
      const res = await request(app)
        .delete("/api/admin/strays/42")
        .set("Authorization", "Bearer anything_goes_here");
      
      // Verify: Attack is blocked
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
      
      // Verify: Data is NOT deleted
      const strays = JSON.parse(readFileSync(straysPath, "utf-8"));
      expect(strays.length).toBe(1);
      expect(strays[0].id).toBe(42);
    });

    it("reproduces pentest Step 2: GET /api/admin/suggestions with Bearer prefix only", async () => {
      // Setup: Create sensitive suggestions
      const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
      const testSuggestions = [
        { name: "Sensitive Shelter", city: "Secret City", submitter_email: "secret@example.com" },
      ];
      writeFileSync(suggestionsPath, JSON.stringify(testSuggestions, null, 2));
      
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
      // Attack: Create token with admin: prefix but no valid signature
      const forgedToken = Buffer.from("admin:12345").toString("base64");
      
      const res = await request(app)
        .get("/api/admin/suggestions")
        .set("Authorization", `Bearer ${forgedToken}`);
      
      // Verify: Attack is blocked (signature validation fails)
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
        
        // All endpoints should reject the forged token
        expect(res.status, `${endpoint.method.toUpperCase()} ${endpoint.path}`).toBe(401);
        expect(res.body.message, `${endpoint.method.toUpperCase()} ${endpoint.path}`).toBe("Unauthorized");
      }
    });
  });
});
