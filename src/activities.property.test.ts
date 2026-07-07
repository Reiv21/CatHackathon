import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { scrapeCatsActivity } from "./activities.js";

/**
 * Property tests for activities module.
 *
 * Note: exportDataActivity and atomicWriteJSON were removed as part of the
 * SQLite direct-read refactor. The scraper property tests for scrapeCatsActivity
 * are in scraper.property.test.ts.
 *
 * **Validates: Requirements 9.2**
 */
describe("activities property tests", () => {
  /**
   * Property: scrapeCatsActivity always returns an array (never throws)
   * for any valid URL and shelter ID combination.
   *
   * This verifies graceful degradation — the function catches errors internally
   * and returns an empty array on failure.
   */
  it("scrapeCatsActivity returns an array for any shelterId", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 1_000_000 }),
        async (shelterId) => {
          // Use an unreachable URL to verify graceful error handling
          const result = await scrapeCatsActivity("http://0.0.0.0:1/nonexistent", shelterId);
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(0);
        }
      ),
      { numRuns: 10 }
    );
  });
});
