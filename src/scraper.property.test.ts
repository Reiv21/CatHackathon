import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import * as fc from "fast-check";
import type { Cat } from "./db.js";

/**
 * Property 5: Scraper output validity
 *
 * For any HTML page containing cat elements matching the expected selectors,
 * scrapeCatsActivity returns Cat objects where every cat has a non-empty name,
 * and all returned cats have shelter_id set to the input shelterId.
 *
 * **Validates: Requirements 5.2, 5.3**
 */

/** Arbitrary for generating a non-empty cat name */
const catNameArbitrary = fc
  .string({ minLength: 1, maxLength: 50 })
  .filter((s) => s.trim().length > 0)
  .map((s) => s.trim());

/** Arbitrary for generating an optional description */
const descriptionArbitrary = fc.oneof(
  fc.constant(""),
  fc.string({ minLength: 1, maxLength: 100 }).map((s) => s.trim())
);

/** Arbitrary for generating an optional image URL */
const imageUrlArbitrary = fc.oneof(fc.constant(null), fc.webUrl());

/** A single cat entry for HTML generation */
interface CatEntry {
  name: string;
  description: string;
  imageUrl: string | null;
}

/** Arbitrary for a cat entry */
const catEntryArbitrary: fc.Arbitrary<CatEntry> = fc.record({
  name: catNameArbitrary,
  description: descriptionArbitrary,
  imageUrl: imageUrlArbitrary,
});

/** Escape HTML special characters to prevent malformed HTML */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Generate HTML containing cat card elements that match the scraper's selectors */
function generateHtml(cats: CatEntry[]): string {
  const cards = cats
    .map((cat) => {
      const imgTag = cat.imageUrl ? `<img src="${escapeHtml(cat.imageUrl)}" alt="${escapeHtml(cat.name)}">` : "";
      const descTag = cat.description ? `<p>${escapeHtml(cat.description)}</p>` : "";
      return `<div class="card">
        <h3>${escapeHtml(cat.name)}</h3>
        ${descTag}
        ${imgTag}
      </div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html>
<head><title>Shelter Cats</title></head>
<body>
  <div class="cats-list">
    ${cards}
  </div>
</body>
</html>`;
}

/** Arbitrary for shelterId */
const shelterIdArbitrary = fc.integer({ min: 1, max: 100_000 });

describe("Scraper Property Tests", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Property 5: Scraper output validity", () => {
    it("every returned Cat has a non-empty name and shelter_id matches input", async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.array(catEntryArbitrary, { minLength: 1, maxLength: 10 }),
          shelterIdArbitrary,
          async (catEntries, shelterId) => {
            const html = generateHtml(catEntries);

            // Mock global fetch to return the generated HTML
            const mockResponse = {
              ok: true,
              status: 200,
              statusText: "OK",
              text: async () => html,
              headers: new Headers(),
            } as Response;

            vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

            const { scrapeCatsActivity } = await import("./activities.js");

            const result = await scrapeCatsActivity("https://example.com/cats", shelterId);

            // Every returned cat must have a non-empty name
            for (const cat of result) {
              expect(cat.name.length).toBeGreaterThan(0);
              expect(cat.name.trim().length).toBeGreaterThan(0);
            }

            // Every returned cat must have shelter_id equal to the input
            for (const cat of result) {
              expect(cat.shelter_id).toBe(shelterId);
            }

            // The result should only contain valid Cat objects
            for (const cat of result) {
              expect(cat).toHaveProperty("name");
              expect(cat).toHaveProperty("shelter_id");
              expect(cat).toHaveProperty("description");
              expect(cat).toHaveProperty("image_url");
            }
          }
        ),
        { numRuns: 50 }
      );
    });
  });
});
