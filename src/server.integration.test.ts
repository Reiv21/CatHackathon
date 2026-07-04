import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from "vitest";
import request from "supertest";
import { mkdirSync, writeFileSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type Database from "better-sqlite3";
import { createApp } from "./server.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, "../frontend/dist");
const INDEX_PATH = path.join(DIST_DIR, "index.html");

let db: Database.Database;
let app: ReturnType<typeof createApp>["app"];

describe("SPA fallback and static serving", () => {
  describe("when frontend/dist/index.html exists", () => {
    beforeAll(() => {
      mkdirSync(DIST_DIR, { recursive: true });
      writeFileSync(INDEX_PATH, "<!DOCTYPE html><html><body>SPA</body></html>");
      writeFileSync(path.join(DIST_DIR, "test.js"), "console.log('test')");
    });

    afterAll(() => {
      rmSync(DIST_DIR, { recursive: true, force: true });
    });

    beforeEach(() => {
      const created = createApp(":memory:");
      app = created.app;
      db = created.db;
    });

    afterEach(() => {
      db.close();
    });

    // Feature: tactical-cat-frontend, Property 10: SPA fallback for non-API paths
    it("serves index.html for non-API, non-static paths (SPA fallback)", async () => {
      const res = await request(app).get("/some/random/path");
      expect(res.status).toBe(200);
      expect(res.text).toContain("SPA");
    });

    it("serves static files with correct Content-Type", async () => {
      const res = await request(app).get("/test.js");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("javascript");
    });

    it("API paths still return JSON, not index.html", async () => {
      const res = await request(app).get("/api/shelters");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/json");
    });
  });

  describe("when frontend/dist/index.html does NOT exist", () => {
    beforeEach(() => {
      // Ensure no dist directory
      rmSync(DIST_DIR, { recursive: true, force: true });
      const created = createApp(":memory:");
      app = created.app;
      db = created.db;
    });

    afterEach(() => {
      db.close();
    });

    it("returns 404 JSON when index.html is missing", async () => {
      const res = await request(app).get("/some/path");
      expect(res.status).toBe(404);
      expect(res.body.message).toBe("Frontend not built");
    });
  });
});
