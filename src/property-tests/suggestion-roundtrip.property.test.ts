import { describe, it, expect, afterEach } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import crypto from "crypto";
import type Database from "better-sqlite3";
import { createApp } from "../server.js";

/**
 * Property 7: Suggestion round-trip preservation
 *
 * *For any* valid shelter suggestion submitted via `POST /api/suggest-shelter`,
 * the suggestion SHALL appear in the response of `GET /api/admin/suggestions`
 * with matching `name`, `city`, and `voivodeship` values.
 *
 * **Validates: Requirements 6.2, 6.3**
 */

function validAdminToken(): string {
  const TOKEN_SECRET = process.env.TOKEN_SECRET || process.env.ADMIN_PASSWORD || "admin123";
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

// Generate a non-empty name
const nameArb = fc.string({ minLength: 1, maxLength: 80 }).filter((s) => s.trim().length > 0);

// Generate a non-empty city
const cityArb = fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0);

// Generate a voivodeship (can be empty or a real-ish value)
const voivodeshipArb = fc.oneof(
  fc.constant(""),
  fc.constantFrom(
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
  )
);

// Generate optional website_url — only valid http/https URLs
const websiteUrlArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.webUrl({ withFragments: false, withQueryParameters: false })
);

// Generate optional submitter_email
const emailArb = fc.oneof(
  fc.constant(undefined),
  fc.constant(null),
  fc.emailAddress()
);

describe("Suggestion Round-Trip Property Test", () => {
  let db: Database.Database | undefined;

  afterEach(() => {
    if (db && db.open) {
      db.close();
    }
    db = undefined;
  });

  it("any valid suggestion posted appears in GET /api/admin/suggestions with matching fields", async () => {
    await fc.assert(
      fc.asyncProperty(
        nameArb,
        cityArb,
        voivodeshipArb,
        websiteUrlArb,
        emailArb,
        async (name, city, voivodeship, website_url, submitter_email) => {
          const { app, db: testDb } = createApp();
          db = testDb;

          // Build the request body
          const body: Record<string, string | null | undefined> = {
            name,
            city,
            voivodeship,
          };
          if (website_url !== undefined) {
            body.website_url = website_url;
          }
          if (submitter_email !== undefined) {
            body.submitter_email = submitter_email;
          }

          // POST the suggestion
          const postRes = await request(app)
            .post("/api/suggest-shelter")
            .send(body)
            .set("Content-Type", "application/json");

          expect(postRes.status).toBe(200);

          // GET all suggestions (requires admin auth)
          const token = validAdminToken();
          const getRes = await request(app)
            .get("/api/admin/suggestions")
            .set("Authorization", `Bearer ${token}`);

          expect(getRes.status).toBe(200);
          expect(Array.isArray(getRes.body)).toBe(true);

          // Find the posted suggestion in the list
          const found = getRes.body.find(
            (s: { name: string; city: string; voivodeship: string }) =>
              s.name === name && s.city === city && s.voivodeship === (voivodeship || "")
          );

          expect(found).toBeDefined();
          expect(found.name).toBe(name);
          expect(found.city).toBe(city);
          expect(found.voivodeship).toBe(voivodeship || "");

          db.close();
          db = undefined;
        }
      ),
      { numRuns: 30 }
    );
  });
});
