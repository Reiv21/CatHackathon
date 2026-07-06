import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "./server.js";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, renameSync, mkdirSync, rmSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, "../data");

/**
 * Integration tests for API endpoints.
 * Validates: Requirements 1.1, 1.2, 3.1, 3.2, 3.3, 3.5, 4.1, 4.7, 6.2, 6.6, 10.1, 10.3, 9.5
 */

// Helper: generate a valid admin token (base64 of "admin:<timestamp>")
function validAdminToken(): string {
  return Buffer.from(`admin:${Date.now()}`).toString("base64");
}

describe("POST /api/admin/sync", () => {
  it("returns 503 when Temporal is unreachable (Req 1.2)", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", `Bearer ${validAdminToken()}`);

    // No Temporal server running → dynamic import connects and fails → 503
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Workflow engine unavailable");
  }, 15000);

  it("returns 401 without auth token", async () => {
    const { app } = createApp();
    const res = await request(app).post("/api/admin/sync");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 with invalid Bearer token (not admin: prefixed)", async () => {
    const { app } = createApp();
    const invalidToken = Buffer.from("user:12345").toString("base64");
    const res = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", `Bearer ${invalidToken}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 without Bearer prefix", async () => {
    const { app } = createApp();
    const res = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", "Basic sometoken");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("GET /api/admin/sync/status", () => {
  it("returns 503 when Temporal is unreachable (Req 3.5)", async () => {
    const { app } = createApp();
    const res = await request(app)
      .get("/api/admin/sync/status")
      .set("Authorization", `Bearer ${validAdminToken()}`);

    // No Temporal server running → 503
    expect(res.status).toBe(503);
    expect(res.body.message).toBe("Sync status temporarily unavailable");
  }, 15000);

  it("returns 401 without auth token (Req 3.4)", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/admin/sync/status");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 with malformed non-base64 token", async () => {
    const { app } = createApp();
    const res = await request(app)
      .get("/api/admin/sync/status")
      .set("Authorization", "Bearer !!!invalid!!!");
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });

  it("returns 401 with token not starting with admin:", async () => {
    const { app } = createApp();
    const token = Buffer.from("notadmin:12345").toString("base64");
    const res = await request(app)
      .get("/api/admin/sync/status")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.message).toBe("Unauthorized");
  });
});

describe("GET /api/domination", () => {
  it("returns correct response shape with real data (Req 4.1)", async () => {
    const { app } = createApp();
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

  it("percentage is between 0 and 100 with max 2 decimal places", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/domination");

    expect(res.body.percentage).toBeGreaterThanOrEqual(0);
    expect(res.body.percentage).toBeLessThanOrEqual(100);
    const decimals = res.body.percentage.toString().split(".")[1];
    if (decimals) {
      expect(decimals.length).toBeLessThanOrEqual(2);
    }
  });

  it("domination_level matches one of the defined levels", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/domination");

    const validLevels = [
      "Kocie Zwiadowcy",
      "Kocia Partyzantka",
      "Kocia Ofensywa",
      "Pełna Kocia Dominacja",
    ];
    expect(validLevels).toContain(res.body.domination_level);
  });

  it("cats_in_army matches actual total cats count (Req 4.1)", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/domination");
    const catsRes = await request(app).get("/api/cats?limit=1");
    expect(res.body.cats_in_army).toBe(catsRes.body.pagination.total);
  });

  it("returns zeroed response when data files are missing (Req 4.7)", async () => {
    const backupDir = `${DATA_DIR}_backup_test`;
    const dataExists = existsSync(DATA_DIR);

    if (!dataExists) {
      const { app } = createApp();
      const res = await request(app).get("/api/domination");
      expect(res.status).toBe(200);
      expect(res.body.shelters_covered).toBe(0);
      expect(res.body.percentage).toBe(0);
      expect(res.body.cats_in_army).toBe(0);
      expect(res.body.domination_level).toBe("Kocie Zwiadowcy");
      return;
    }

    renameSync(DATA_DIR, backupDir);
    try {
      const { app } = createApp();
      const res = await request(app).get("/api/domination");
      expect(res.status).toBe(200);
      expect(res.body.total_shelters_in_poland).toBe(190);
      expect(res.body.shelters_covered).toBe(0);
      expect(res.body.percentage).toBe(0);
      expect(res.body.cats_in_army).toBe(0);
      expect(res.body.domination_level).toBe("Kocie Zwiadowcy");
    } finally {
      renameSync(backupDir, DATA_DIR);
    }
  });

  it("responds within 500ms (Req 4.8)", async () => {
    const { app } = createApp();
    const start = Date.now();
    await request(app).get("/api/domination");
    expect(Date.now() - start).toBeLessThan(500);
  });
});

describe("GET /api/achievements", () => {
  it("returns an array (Req 6.2)", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/achievements");

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each achievement has correct shape (Req 6.2)", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/achievements");

    for (const achievement of res.body) {
      expect(achievement).toHaveProperty("name");
      expect(achievement).toHaveProperty("description");
      expect(achievement).toHaveProperty("icon");
      expect(achievement).toHaveProperty("unlocked_at");
      expect(typeof achievement.name).toBe("string");
      expect(typeof achievement.description).toBe("string");
      expect(typeof achievement.icon).toBe("string");
      // unlocked_at should be valid ISO 8601
      expect(new Date(achievement.unlocked_at).toISOString()).toBe(
        achievement.unlocked_at
      );
    }
  });

  it("returns empty array when no thresholds met (Req 6.6)", async () => {
    const backupDir = `${DATA_DIR}_backup_test_ach`;
    const dataExists = existsSync(DATA_DIR);

    if (!dataExists) {
      const { app } = createApp();
      const res = await request(app).get("/api/achievements");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
      return;
    }

    renameSync(DATA_DIR, backupDir);
    try {
      mkdirSync(DATA_DIR, { recursive: true });
      const { app } = createApp();
      const res = await request(app).get("/api/achievements");
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    } finally {
      rmSync(DATA_DIR, { recursive: true, force: true });
      renameSync(backupDir, DATA_DIR);
    }
  });

  it("achievements include expected ones based on real data", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/achievements");
    const dominationRes = await request(app).get("/api/domination");

    if (dominationRes.body.cats_in_army >= 100) {
      const setka = res.body.find(
        (a: { name: string }) => a.name === "Pierwsza Setka"
      );
      expect(setka).toBeDefined();
      expect(setka.icon).toBe("🎯");
    }

    if (dominationRes.body.shelters_covered >= 10) {
      const shelters = res.body.find(
        (a: { name: string }) => a.name === "10 Schronisk"
      );
      expect(shelters).toBeDefined();
      expect(shelters.icon).toBe("🏠");
    }
  });
});

describe("GET /api/health", () => {
  it("returns 200 with status ok under normal conditions (Req 10.1)", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.uptime).toBe("number");
    expect(res.body.uptime).toBeGreaterThanOrEqual(0);
    expect(res.body.timestamp).toBeDefined();
    // ISO 8601 timestamp validation
    const ts = new Date(res.body.timestamp);
    expect(ts.toISOString()).toBe(res.body.timestamp);
  });

  it("does not include details field when healthy", async () => {
    const { app } = createApp();
    const res = await request(app).get("/api/health");
    if (res.body.status === "ok") {
      expect(res.body.details).toBeUndefined();
    }
  });

  it("returns 503 with degraded status when data dir inaccessible (Req 10.3)", async () => {
    const backupDir = `${DATA_DIR}_backup_test_health`;
    const dataExists = existsSync(DATA_DIR);

    if (!dataExists) {
      const { app } = createApp();
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.details).toBe("Data directory is inaccessible");
      return;
    }

    renameSync(DATA_DIR, backupDir);
    try {
      const { app } = createApp();
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(503);
      expect(res.body.status).toBe("degraded");
      expect(res.body.details).toBe("Data directory is inaccessible");
      expect(typeof res.body.uptime).toBe("number");
      expect(res.body.timestamp).toBeDefined();
    } finally {
      renameSync(backupDir, DATA_DIR);
    }
  });

  it("responds within 100ms (Req 10.2)", async () => {
    const { app } = createApp();
    const start = Date.now();
    await request(app).get("/api/health");
    expect(Date.now() - start).toBeLessThan(100);
  });
});

describe("Auth middleware rejects unauthenticated requests (Req 9.5)", () => {
  /**
   * Endpoints using requireAdminAuth middleware (full token validation):
   * - POST /api/admin/sync
   * - GET /api/admin/sync/status
   *
   * Endpoints using inline auth check (Bearer prefix only):
   * - GET /api/admin/suggestions
   * - DELETE /api/admin/strays/:id
   */

  const strictAdminEndpoints = [
    { method: "post" as const, path: "/api/admin/sync" },
    { method: "get" as const, path: "/api/admin/sync/status" },
  ];

  const simpleAdminEndpoints = [
    { method: "get" as const, path: "/api/admin/suggestions" },
    { method: "delete" as const, path: "/api/admin/strays/1" },
  ];

  const allAdminEndpoints = [...strictAdminEndpoints, ...simpleAdminEndpoints];

  for (const endpoint of allAdminEndpoints) {
    it(`rejects ${endpoint.method.toUpperCase()} ${endpoint.path} without any auth header`, async () => {
      const { app } = createApp();
      const res = await request(app)[endpoint.method](endpoint.path);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });
  }

  for (const endpoint of allAdminEndpoints) {
    it(`rejects ${endpoint.method.toUpperCase()} ${endpoint.path} with non-Bearer auth`, async () => {
      const { app } = createApp();
      const res = await request(app)
        [endpoint.method](endpoint.path)
        .set("Authorization", "Basic sometoken");
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });
  }

  // requireAdminAuth also validates the token content (must base64-decode to "admin:...")
  for (const endpoint of strictAdminEndpoints) {
    it(`rejects ${endpoint.method.toUpperCase()} ${endpoint.path} with invalid token content`, async () => {
      const { app } = createApp();
      const invalidToken = Buffer.from("user:fake").toString("base64");
      const res = await request(app)
        [endpoint.method](endpoint.path)
        .set("Authorization", `Bearer ${invalidToken}`);
      expect(res.status).toBe(401);
      expect(res.body.message).toBe("Unauthorized");
    });
  }

  for (const endpoint of allAdminEndpoints) {
    it(`no information leakage in 401 response for ${endpoint.method.toUpperCase()} ${endpoint.path}`, async () => {
      const { app } = createApp();
      const res = await request(app)[endpoint.method](endpoint.path);
      const body = JSON.stringify(res.body);
      // No stack traces
      expect(body).not.toMatch(/at\s+\w+\s*\(/);
      // No filesystem paths
      expect(body).not.toMatch(/\/home\//);
      expect(body).not.toMatch(/\/src\//);
      expect(body).not.toMatch(/node_modules/);
      // No env var names
      expect(body).not.toMatch(/ADMIN_PASSWORD/);
      expect(body).not.toMatch(/TEMPORAL_ADDRESS/);
      expect(body).not.toMatch(/process\.env/);
    });
  }

  it("accepts requests with valid admin token on sync endpoint (returns 503 not 401)", async () => {
    const { app } = createApp();
    const token = validAdminToken();

    // POST /api/admin/sync — will fail with 503 (no Temporal) but NOT 401
    const syncRes = await request(app)
      .post("/api/admin/sync")
      .set("Authorization", `Bearer ${token}`);
    expect(syncRes.status).not.toBe(401);
    // Expected: 503 (Workflow engine unavailable)
    expect(syncRes.status).toBe(503);
  }, 15000);

  it("accepts requests with valid admin token on status endpoint (returns 503 not 401)", async () => {
    const { app } = createApp();
    const token = validAdminToken();

    const statusRes = await request(app)
      .get("/api/admin/sync/status")
      .set("Authorization", `Bearer ${token}`);
    expect(statusRes.status).not.toBe(401);
    expect(statusRes.status).toBe(503);
  }, 15000);

  it("accepts requests with valid admin token on suggestions endpoint", async () => {
    const { app } = createApp();
    const token = validAdminToken();

    const suggestionsRes = await request(app)
      .get("/api/admin/suggestions")
      .set("Authorization", `Bearer ${token}`);
    expect(suggestionsRes.status).not.toBe(401);
    // Expect 200 (returns suggestions array)
    expect(suggestionsRes.status).toBe(200);
  });
});
