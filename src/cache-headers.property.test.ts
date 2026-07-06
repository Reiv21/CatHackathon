import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { isHashedAsset } from "./server.js";

/**
 * Property 9: Cache-Control headers for hashed assets
 *
 * For any static file request where the filename matches the pattern `name.HASH.ext`
 * (where HASH is 8+ hexadecimal characters), the response SHALL include a Cache-Control
 * header with value `max-age=31536000, immutable`.
 *
 * The `isHashedAsset` function is exported from `src/server.ts`. We test the pure function
 * rather than the HTTP middleware.
 *
 * **Validates: Requirements 15.4**
 *
 * Tag: Feature: hackathon-polish, Property 9: Cache-Control headers for hashed assets
 */
describe("Feature: hackathon-polish, Property 9: Cache-Control headers for hashed assets", () => {
  /**
   * Arbitrary: generates a valid hex hash string of 8+ characters (lowercase).
   */
  const hexHashArbitrary = fc
    .integer({ min: 8, max: 32 })
    .chain((len) =>
      fc.stringOf(fc.constantFrom(..."0123456789abcdef"), {
        minLength: len,
        maxLength: len,
      })
    );

  /**
   * Arbitrary: generates a valid filename base (no dots, alphanumeric + dash/underscore).
   */
  const filenameBaseArbitrary = fc.stringOf(
    fc.constantFrom(..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_"),
    { minLength: 1, maxLength: 20 }
  );

  /**
   * Arbitrary: generates a valid extension for hashed assets (js or css).
   */
  const hashedExtArbitrary = fc.constantFrom("js", "css");

  /**
   * Arbitrary: generates filenames WITH a valid content hash.
   * Format: name.HASH.ext where HASH is 8+ hex characters.
   */
  const hashedFilenameArbitrary = fc
    .tuple(filenameBaseArbitrary, hexHashArbitrary, hashedExtArbitrary)
    .map(([base, hash, ext]) => `${base}.${hash}.${ext}`);

  /**
   * Arbitrary: generates filenames WITHOUT any hash (simple name.ext).
   */
  const simpleFilenameArbitrary = fc
    .tuple(
      filenameBaseArbitrary,
      fc.constantFrom("html", "txt", "png", "svg", "ico", "json", "xml", "woff2")
    )
    .map(([base, ext]) => `${base}.${ext}`);

  /**
   * Arbitrary: generates filenames with short hex-like segments (< 8 chars)
   * that should NOT be treated as hashed assets.
   */
  const shortHashFilenameArbitrary = fc
    .tuple(
      filenameBaseArbitrary,
      fc.stringOf(fc.constantFrom(..."0123456789abcdef"), {
        minLength: 1,
        maxLength: 7,
      }),
      hashedExtArbitrary
    )
    .map(([base, shortHash, ext]) => `${base}.${shortHash}.${ext}`);

  it("filenames with 8+ hex character hashes are identified as hashed assets", () => {
    fc.assert(
      fc.property(hashedFilenameArbitrary, (filename) => {
        expect(isHashedAsset(filename)).toBe(true);
      }),
      { numRuns: 100 }
    );
  });

  it("filenames without hashes are NOT identified as hashed assets", () => {
    fc.assert(
      fc.property(simpleFilenameArbitrary, (filename) => {
        expect(isHashedAsset(filename)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("filenames with fewer than 8 hex characters are NOT hashed assets (edge case)", () => {
    fc.assert(
      fc.property(shortHashFilenameArbitrary, (filename) => {
        expect(isHashedAsset(filename)).toBe(false);
      }),
      { numRuns: 100 }
    );
  });

  it("exactly 8 hex characters qualifies as hashed asset (boundary)", () => {
    fc.assert(
      fc.property(
        filenameBaseArbitrary,
        fc.stringOf(fc.constantFrom(..."0123456789abcdef"), {
          minLength: 8,
          maxLength: 8,
        }),
        hashedExtArbitrary,
        (base, hash, ext) => {
          const filename = `${base}.${hash}.${ext}`;
          expect(isHashedAsset(filename)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
