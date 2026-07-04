import { describe, it, expect, vi, afterEach } from "vitest";
import * as fc from "fast-check";
import type { ApiShelter } from "./shelterApi";

/**
 * Property 6: API response parsing correctness
 *
 * For any valid JSON response from the shelter API, fetchSheltersFromApi correctly
 * parses the response and returns typed ApiShelter objects with all fields preserved
 * (id, nazwa, miasto, województwo, strona_www).
 *
 * **Validates: Requirements 2.2, 12.2**
 */

/** Arbitrary for generating valid ApiShelter objects */
const apiShelterArbitrary: fc.Arbitrary<ApiShelter> = fc.record({
  id: fc.integer({ min: 1, max: 100_000 }),
  nazwa: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length > 0),
  miasto: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  województwo: fc.string({ minLength: 1, maxLength: 50 }).filter((s) => s.trim().length > 0),
  strona_www: fc.oneof(fc.constant(null), fc.webUrl()),
});

/** Generate arrays of ApiShelter with unique IDs */
const apiShelterArrayArbitrary: fc.Arbitrary<ApiShelter[]> = fc
  .array(apiShelterArbitrary, { minLength: 0, maxLength: 20 })
  .map((shelters) => {
    const seen = new Set<number>();
    return shelters.filter((s) => {
      if (seen.has(s.id)) return false;
      seen.add(s.id);
      return true;
    });
  });

describe("Shelter API Property Tests", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Property 6: API response parsing correctness", () => {
    it("returned array has same length and preserves all fields from the API response", async () => {
      await fc.assert(
        fc.asyncProperty(apiShelterArrayArbitrary, async (generatedShelters) => {
          // Mock fetch to return the generated shelters as JSON
          const mockResponse = {
            ok: true,
            status: 200,
            statusText: "OK",
            json: async () => generatedShelters,
          } as Response;

          vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockResponse));

          // Dynamically import to pick up the mocked fetch
          const { fetchSheltersFromApi } = await import("./shelterApi");

          const result = await fetchSheltersFromApi();

          // The returned array must have the same length as the generated input
          expect(result.length).toBe(generatedShelters.length);

          // Each element must preserve all fields correctly
          for (let i = 0; i < generatedShelters.length; i++) {
            expect(result[i].id).toBe(generatedShelters[i].id);
            expect(result[i].nazwa).toBe(generatedShelters[i].nazwa);
            expect(result[i].miasto).toBe(generatedShelters[i].miasto);
            expect(result[i].województwo).toBe(generatedShelters[i].województwo);
            expect(result[i].strona_www).toBe(generatedShelters[i].strona_www);
          }
        }),
        { numRuns: 50 }
      );
    });
  });
});
