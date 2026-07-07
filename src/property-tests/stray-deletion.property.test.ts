import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import crypto from "crypto";
import type Database from "better-sqlite3";
import { createApp } from "../server.js";

/**
 * Property 6: Stray deletion removes exactly the targeted record
 *
 * *For any* stray report that exists in the database, calling
 * `DELETE /api/admin/strays/:id` SHALL remove that report from subsequent
 * `GET /api/strays` responses, and SHALL not affect any other reports.
 *
 * **Validates: Requirements 5.4**
 */

function validAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

// Arbitrary for number of stray reports to seed (2-5)
const numReportsArb = fc.integer({ min: 2, max: 5 });

// Arbitrary for a stray report description
const descriptionArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

// Arbitrary for latitude (Poland range)
const latitudeArb = fc.double({ min: 49.0, max: 54.0, noNaN: true });

// Arbitrary for longitude (Poland range)
const longitudeArb = fc.double({ min: 14.0, max: 24.0, noNaN: true });

// Arbitrary for city
const cityArb = fc
  .string({ minLength: 1, maxLength: 20 })
  .filter((s) => s.trim().length > 0)
  .map((s) => `City_${s}`);

interface StrayRecord {
  description: string;
  latitude: number;
  longitude: number;
  city: string;
}

// Arbitrary for a single stray report
const strayRecordArb = fc.record({
  description: descriptionArb,
  latitude: latitudeArb,
  longitude: longitudeArb,
  city: cityArb,
});

describe("Stray Deletion Property Test", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  it("deleting a stray report removes exactly that record and leaves others unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        numReportsArb.chain((n) =>
          fc.tuple(
            fc.array(strayRecordArb, { minLength: n, maxLength: n }),
            fc.integer({ min: 0, max: n - 1 })
          )
        ),
        async ([reports, deleteIndex]) => {
          const { app, db: testDb } = createApp();
          db = testDb;

          // Seed multiple stray reports directly in the DB
          const insertStmt = db.prepare(`
            INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
            VALUES (?, NULL, ?, ?, ?, datetime('now'))
          `);

          const insertedIds: number[] = [];
          for (const report of reports) {
            const result = insertStmt.run(
              report.description,
              report.latitude,
              report.longitude,
              report.city
            );
            insertedIds.push(Number(result.lastInsertRowid));
          }

          // Pick the report to delete
          const targetId = insertedIds[deleteIndex];
          const token = validAdminToken();

          // DELETE the targeted report
          const deleteRes = await request(app)
            .delete(`/api/admin/strays/${targetId}`)
            .set("Authorization", `Bearer ${token}`);

          expect(deleteRes.status).toBe(200);

          // GET all strays
          const getRes = await request(app).get("/api/strays");
          expect(getRes.status).toBe(200);
          expect(Array.isArray(getRes.body)).toBe(true);

          // Verify the deleted report is NOT in the response
          const deletedInResponse = getRes.body.find(
            (s: { id: number }) => s.id === targetId
          );
          expect(deletedInResponse).toBeUndefined();

          // Verify all other reports ARE still present and unchanged
          const remainingIds = insertedIds.filter((id) => id !== targetId);
          for (let i = 0; i < reports.length; i++) {
            if (i === deleteIndex) continue;
            const expectedId = insertedIds[i];
            const found = getRes.body.find(
              (s: { id: number }) => s.id === expectedId
            );
            expect(found).toBeDefined();
            expect(found.description).toBe(reports[i].description);
            expect(found.city).toBe(reports[i].city);
            expect(found.latitude).toBeCloseTo(reports[i].latitude, 5);
            expect(found.longitude).toBeCloseTo(reports[i].longitude, 5);
          }

          // Verify the count is correct (total - 1)
          expect(getRes.body.length).toBe(reports.length - 1);

          db.close();
          db = undefined;
        }
      ),
      { numRuns: 30 }
    );
  });
});
