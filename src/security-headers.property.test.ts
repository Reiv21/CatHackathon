import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import request from "supertest";
import { createApp } from "./server.js";

/**
 * Property 1: Bug Condition — Security Headers Missing in Express Response (frame-ancestors)
 *
 * For any HTTP request to the Express app, the Content-Security-Policy header
 * SHALL contain the `frame-ancestors 'none'` directive. This directive is the
 * modern CSP replacement for X-Frame-Options: DENY and prevents clickjacking.
 *
 * The Express helmet config currently has `frameSrc: ["'none'"]` (controls what
 * the page can frame) but is MISSING `frameAncestors: ["'none'"]` (controls who
 * can frame the page). Helmet 8.x adds `frame-ancestors 'self'` by default, but
 * the security requirement demands `frame-ancestors 'none'` to fully prevent
 * clickjacking (no origin should be able to embed the page in a frame).
 *
 * **Validates: Requirements 1.3, 2.3**
 *
 * Tag: Bugfix: security-headers-fix, Property 1: Bug Condition
 */
describe("Bugfix: security-headers-fix, Property 1: Bug Condition - frame-ancestors missing", () => {
  const { app } = createApp();

  /**
   * Arbitrary: generates valid URL paths that the Express app serves.
   * Includes both API endpoints and frontend routes.
   */
  const validPathArbitrary = fc.constantFrom(
    "/",
    "/api/cats",
    "/api/shelters",
    "/api/stats",
    "/api/strays",
    "/api/health",
    "/api/achievements",
    "/api/domination",
    "/api/cat-of-the-day",
    "/api/random-cat"
  );

  it("CSP header contains frame-ancestors 'none' for all paths", async () => {
    await fc.assert(
      fc.asyncProperty(validPathArbitrary, async (urlPath) => {
        const res = await request(app).get(urlPath);
        const csp = res.headers["content-security-policy"];
        expect(csp).toBeDefined();
        expect(csp).toContain("frame-ancestors 'none'");
      }),
      { numRuns: 20 }
    );
  });
});

/**
 * Property 2: Preservation — Existing Security Headers and API Behavior Unchanged
 *
 * For any GET request to the Express app on valid paths, all existing security
 * headers remain intact. This captures the baseline behavior observed on the
 * UNFIXED code so that after adding frameAncestors: ["'none'"], we can confirm
 * no regressions occurred.
 *
 * Observed behavior on unfixed code:
 * - CSP contains: default-src 'self', script-src 'self' 'unsafe-inline', style-src,
 *   font-src, img-src, connect-src, frame-src 'none', frame-ancestors 'self',
 *   base-uri, form-action, object-src, script-src-attr, upgrade-insecure-requests
 * - HSTS: max-age=31536000; includeSubDomains
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: no-referrer-when-downgrade
 * - X-Powered-By: NOT present (hidePoweredBy)
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4**
 *
 * Tag: Bugfix: security-headers-fix, Property 2: Preservation
 */
describe("Bugfix: security-headers-fix, Property 2: Preservation — Existing Security Headers Unchanged", () => {
  const { app } = createApp();

  /**
   * Arbitrary: generates valid GET-accessible paths that the Express app serves.
   * Note: /api/report-stray is POST-only and excluded (GET returns Express 404
   * with a minimal CSP that differs from the helmet-configured one).
   */
  const validPathArbitrary = fc.constantFrom(
    "/api/cats",
    "/api/shelters",
    "/api/stats",
    "/api/strays",
    "/api/health",
    "/api/domination",
    "/api/achievements",
    "/api/random-cat",
    "/api/cat-of-the-day",
    "/"
  );

  it("all responses include CSP with existing directives (default-src, script-src, style-src, font-src, img-src, connect-src, frame-src)", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        const csp = res.headers["content-security-policy"];
        expect(csp).toBeDefined();

        // Verify all existing CSP directives are present
        expect(csp).toContain("default-src 'self'");
        expect(csp).toContain("script-src 'self' 'unsafe-inline'");
        expect(csp).toContain("style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com");
        expect(csp).toContain("font-src 'self' https://fonts.gstatic.com");
        expect(csp).toContain("img-src 'self' data: https: http:");
        expect(csp).toContain("connect-src 'self'");
        expect(csp).toContain("frame-src 'none'");
      }),
      { numRuns: 20 }
    );
  });

  it("all responses include strict-transport-security with max-age=31536000; includeSubDomains", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        const hsts = res.headers["strict-transport-security"];
        expect(hsts).toBe("max-age=31536000; includeSubDomains");
      }),
      { numRuns: 20 }
    );
  });

  it("all responses include x-content-type-options: nosniff", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        expect(res.headers["x-content-type-options"]).toBe("nosniff");
      }),
      { numRuns: 20 }
    );
  });

  it("all responses include referrer-policy header", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        expect(res.headers["referrer-policy"]).toBeDefined();
        expect(res.headers["referrer-policy"]).toBe("no-referrer-when-downgrade");
      }),
      { numRuns: 20 }
    );
  });

  it("all responses do NOT include x-powered-by header (hidePoweredBy)", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        expect(res.headers["x-powered-by"]).toBeUndefined();
      }),
      { numRuns: 20 }
    );
  });

  it("existing CSP directives remain intact for all request paths — preservation property", () => {
    return fc.assert(
      fc.asyncProperty(validPathArbitrary, async (path) => {
        const res = await request(app).get(path);
        const csp = res.headers["content-security-policy"];
        expect(csp).toBeDefined();

        // The full set of directives observed on unfixed code must remain
        const requiredDirectives = [
          "default-src 'self'",
          "script-src 'self' 'unsafe-inline'",
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://unpkg.com",
          "font-src 'self' https://fonts.gstatic.com",
          "img-src 'self' data: https: http:",
          "frame-src 'none'",
        ];

        for (const directive of requiredDirectives) {
          expect(csp).toContain(directive);
        }
      }),
      { numRuns: 20 }
    );
  });
});
