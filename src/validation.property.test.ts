import { describe, it } from "vitest";
import fc from "fast-check";
import { sanitizeSearchQuery, validateShelterId } from "./validation.js";

// Feature: tactical-cat-frontend, Property 5: Input sanitization output invariant
describe("sanitizeSearchQuery", () => {
  it("output contains only allowed characters", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeSearchQuery(input);
        // Only allowed chars remain
        const allowedPattern = /^[a-zA-Z0-9 \-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]*$/;
        return allowedPattern.test(result);
      }),
      { numRuns: 100 }
    );
  });

  it("output length is at most 100 characters", () => {
    fc.assert(
      fc.property(fc.string(), (input) => {
        const result = sanitizeSearchQuery(input);
        return result.length <= 100;
      }),
      { numRuns: 100 }
    );
  });

  it("preserves allowed characters in order", () => {
    fc.assert(
      fc.property(
        fc.stringOf(
          fc.constantFrom(
            ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 -ąćęłńóśźżĄĆĘŁŃÓŚŹŻ".split(
              ""
            )
          )
        ),
        (input) => {
          const result = sanitizeSearchQuery(input);
          // For all-allowed input, only truncation should happen
          return result === input.slice(0, 100);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// Feature: tactical-cat-frontend, Property 6: Shelter ID validation correctness
describe("validateShelterId", () => {
  it("returns a positive integer for valid positive integer strings within range", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 2_147_483_647 }), (n) => {
        const result = validateShelterId(String(n));
        return result === n;
      }),
      { numRuns: 100 }
    );
  });

  it("returns null for non-positive integers", () => {
    fc.assert(
      fc.property(fc.integer({ min: -1_000_000, max: 0 }), (n) => {
        const result = validateShelterId(String(n));
        return result === null;
      }),
      { numRuns: 100 }
    );
  });

  it("returns null for values exceeding MAX_INT32", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2_147_483_648, max: Number.MAX_SAFE_INTEGER }),
        (n) => {
          const result = validateShelterId(String(n));
          return result === null;
        }
      ),
      { numRuns: 100 }
    );
  });

  it("returns null for non-numeric strings", () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => isNaN(Number(s)) || !Number.isInteger(Number(s))),
        (s) => {
          const result = validateShelterId(s);
          return result === null;
        }
      ),
      { numRuns: 100 }
    );
  });
});
