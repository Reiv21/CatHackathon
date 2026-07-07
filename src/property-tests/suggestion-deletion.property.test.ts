import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import crypto from "crypto";
import type Database from "better-sqlite3";
import { createApp } from "../server.js";

/**
 * Property 8: Suggestion deletion removes exactly the targeted record
 *
 * *For any* suggestion that exists in the database, calling
 * `DELETE /api/admin/suggestions/:id` SHALL remove that suggestion from subsequent
 * `GET /api/admin/suggestions` responses, and SHALL not affect any other suggestions.
 *
 * **Validates: Requirements 6.4**
 */

function validAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

// Arbitrary for number of suggestions to seed (2-5)
const numSuggestionsArb = fc.integer({ min: 2, max: 5 });

// Arbitrary for a suggestion name
const nameArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

// Arbitrary for a city
const cityArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

// Arbitrary for voivodeship
const voivodeshipArb = fc.constantFrom(
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie"
);

// Arbitrary for optional website_url
const websiteUrlArb = fc.oneof(
  fc.constant(null),
  fc.webUrl({ withFragments: false, withQueryParameters: false })
);

// Arbitrary for optional submitter_email
const emailArb = fc.oneof(fc.constant(null), fc.emailAddress());

interface SuggestionRecord {
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  submitter_email: string | null;
}

// Arbitrary for a single suggestion record
const suggestionRecordArb: fc.Arbitrary<SuggestionRecord> = fc.record({
  name: nameArb,
  city: cityArb,
  voivodeship: voivodeshipArb,
  website_url: websiteUrlArb,
  submitter_email: emailArb,
});

describe("Suggestion Deletion Property Test", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  it("deleting a suggestion removes exactly that record and leaves others unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(
        numSuggestionsArb.chain((n) =>
          fc.tuple(
            fc.array(suggestionRecordArb, { minLength: n, maxLength: n }),
            fc.integer({ min: 0, max: n - 1 })
          )
        ),
        async ([suggestions, deleteIndex]) => {
          const { app, db: testDb } = createApp();
          db = testDb;

          // Seed multiple suggestions directly in the DB
          const insertStmt = db.prepare(`
            INSERT INTO suggestions (name, city, voivodeship, website_url, submitter_email, submitted_at)
            VALUES (?, ?, ?, ?, ?, datetime('now'))
          `);

          const insertedIds: number[] = [];
          for (const suggestion of suggestions) {
            const result = insertStmt.run(
              suggestion.name,
              suggestion.city,
              suggestion.voivodeship,
              suggestion.website_url,
              suggestion.submitter_email
            );
            insertedIds.push(Number(result.lastInsertRowid));
          }

          // Pick the suggestion to delete
          const targetId = insertedIds[deleteIndex];
          const token = validAdminToken();

          // DELETE the targeted suggestion
          const deleteRes = await request(app)
            .delete(`/api/admin/suggestions/${targetId}`)
            .set("Authorization", `Bearer ${token}`);

          expect(deleteRes.status).toBe(200);

          // GET all suggestions
          const getRes = await request(app)
            .get("/api/admin/suggestions")
            .set("Authorization", `Bearer ${token}`);

          expect(getRes.status).toBe(200);
          expect(Array.isArray(getRes.body)).toBe(true);

          // Verify the deleted suggestion is NOT in the response
          const deletedInResponse = getRes.body.find(
            (s: { id: number }) => s.id === targetId
          );
          expect(deletedInResponse).toBeUndefined();

          // Verify all other suggestions ARE still present and unchanged
          for (let i = 0; i < suggestions.length; i++) {
            if (i === deleteIndex) continue;
            const expectedId = insertedIds[i];
            const found = getRes.body.find(
              (s: { id: number }) => s.id === expectedId
            );
            expect(found).toBeDefined();
            expect(found.name).toBe(suggestions[i].name);
            expect(found.city).toBe(suggestions[i].city);
            expect(found.voivodeship).toBe(suggestions[i].voivodeship);
          }

          // Verify the count is correct (total - 1)
          expect(getRes.body.length).toBe(suggestions.length - 1);

          db.close();
          db = undefined;
        }
      ),
      { numRuns: 30 }
    );
  });
});
