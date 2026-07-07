# Implementation Plan: Security Headers Fix

## Overview

Fix for missing security headers in production (Nginx proxy strips Express/helmet headers). The bug manifests as missing CSP, HSTS, and frame-ancestors headers on proxied responses. The fix adds `frameAncestors: ["'none'"]` to Express helmet config and updates DEPLOY.md Nginx config with `proxy_pass_header` directives. Tasks follow exploratory bugfix methodology: exploration test → preservation test → fix → validate.

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Security Headers Missing in Express Response (frame-ancestors)
  - **IMPORTANT**: Write this property-based test BEFORE implementing the fix
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: The Express helmet config is missing `frameAncestors: ["'none'"]`. Scope the property to requests against the Express app and assert the CSP header contains `frame-ancestors 'none'`
  - Create test file `src/security-headers.property.test.ts` using vitest + fast-check + supertest
  - Generate arbitrary valid URL paths (e.g., `/`, `/api/cats`, `/api/shelters`, `/api/stats`) using fast-check
  - For each generated path, make a GET request to the Express app via supertest
  - Assert that `response.headers['content-security-policy']` contains `frame-ancestors 'none'`
  - Bug Condition from design: `isBugCondition(request) = request passes through proxy AND response headers NOT CONTAIN frame-ancestors`
  - Since we're testing Express directly (without Nginx), the Express-level bug is the missing `frame-ancestors` directive
  - Run test on UNFIXED code — expect FAILURE (CSP header will NOT contain `frame-ancestors 'none'` because `frameAncestors` is not in helmet config)
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — it proves the Express-level bug exists)
  - Document counterexamples found (e.g., "GET / returns CSP without frame-ancestors directive")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.3, 2.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Existing Security Headers and API Behavior Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Step 1 — Observe**: Run the UNFIXED Express app with various requests and record actual outputs:
    - Observe: GET `/api/cats` returns JSON with status 200 and CORS headers on unfixed code
    - Observe: GET `/api/shelters` returns JSON with status 200 on unfixed code
    - Observe: GET `/` returns the frontend HTML with existing CSP directives (default-src, script-src, style-src, font-src, img-src, connect-src, frame-src) on unfixed code
    - Observe: All responses include `Strict-Transport-Security: max-age=31536000; includeSubDomains` on unfixed code
    - Observe: All responses include `X-Content-Type-Options: nosniff` on unfixed code
  - **Step 2 — Write property-based tests** capturing observed behavior patterns:
    - Create tests in `src/security-headers.property.test.ts` (same file as exploration test)
    - Generate arbitrary valid API paths using fast-check (`/api/cats`, `/api/shelters`, `/api/stats`, `/api/report-stray`)
    - For each path, assert: response includes `content-security-policy` header with existing directives (`default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src`, `font-src`, `img-src`, `connect-src`, `frame-src 'none'`)
    - For each path, assert: response includes `strict-transport-security` header with `max-age=31536000; includeSubDomains`
    - For each path, assert: response includes `x-content-type-options: nosniff`
    - For each path, assert: response includes `referrer-policy` header
    - For each path, assert: response includes `x-powered-by` header is NOT present (hidePoweredBy)
    - Property: for all non-bug-condition inputs (any request to Express), existing CSP directives remain intact after adding frameAncestors
  - **Step 3 — Verify**: Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 3. Fix for missing security headers in proxied responses

  - [x] 3.1 Add `frameAncestors` to Express helmet CSP config
    - In `src/server.ts`, inside `createApp()` helmet contentSecurityPolicy directives object
    - Add `frameAncestors: ["'none'"]` alongside the existing `frameSrc: ["'none'"]` directive
    - This adds `frame-ancestors 'none'` to the CSP header, the modern replacement for X-Frame-Options: DENY
    - _Bug_Condition: isBugCondition(request) where Express CSP header lacks frame-ancestors directive_
    - _Expected_Behavior: CSP header includes `frame-ancestors 'none'` for all responses_
    - _Preservation: All existing CSP directives (default-src, script-src, style-src, font-src, img-src, connect-src, frame-src) remain unchanged_
    - _Requirements: 1.3, 2.3, 3.1, 3.3, 3.4_

  - [x] 3.2 Update DEPLOY.md Section 3 with Nginx proxy_pass_header directives
    - Replace the current minimal Nginx location block in Section 3 with a security-aware config
    - Add `proxy_pass_header Content-Security-Policy;` to forward CSP from Express
    - Add `proxy_pass_header Strict-Transport-Security;` to forward HSTS from Express
    - Add `proxy_pass_header X-Frame-Options;` to forward X-Frame-Options from Express
    - Add `proxy_pass_header X-Content-Type-Options;` to forward nosniff from Express
    - Add `proxy_pass_header Referrer-Policy;` to forward referrer policy from Express
    - Keep existing proxy_set_header directives (Upgrade, Connection, Host, X-Real-IP)
    - Add comments explaining each `proxy_pass_header` directive
    - _Bug_Condition: Nginx strips upstream security headers due to missing proxy_pass_header directives_
    - _Expected_Behavior: All security headers from Express pass through Nginx to client_
    - _Preservation: WebSocket upgrade, Host forwarding, and X-Real-IP forwarding remain unchanged_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3_

  - [x] 3.3 Document Nginx reload step in deploy workflow or DEPLOY.md
    - Option A (recommended for personal Pi): Add a note in DEPLOY.md after Section 3 explaining that after updating the Nginx config file, run `sudo nginx -t && sudo systemctl reload nginx`
    - Option B (automation): Add a step in `.github/workflows/deploy.yml` after PM2 restart: `sudo cp ~/cat-hackathon/nginx-site.conf /etc/nginx/sites-available/default && sudo nginx -t && sudo systemctl reload nginx`
    - Choose Option A for safety — manual Nginx config changes on a personal Raspberry Pi are lower risk than automated rewrites
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Security Headers Present After Fix
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (CSP contains `frame-ancestors 'none'`)
    - When this test passes, it confirms the expected behavior is satisfied
    - Run: `npx vitest --run src/security-headers.property.test.ts`
    - **EXPECTED OUTCOME**: Test PASSES (confirms Express-level bug is fixed)
    - _Requirements: 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Existing Security Headers and API Behavior Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions — existing CSP directives, HSTS, nosniff all intact)
    - Confirm all tests still pass after fix (no regressions)
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite: `npx vitest --run`
  - Verify `src/security-headers.property.test.ts` passes (both bug condition and preservation properties)
  - Verify no other tests are broken by the helmet config change
  - Optionally: `curl -I http://localhost:3001/` to manually verify headers include `frame-ancestors 'none'`
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- This is a configuration/infrastructure bug with an Express-level component (missing `frameAncestors`)
- Property-based tests use vitest + fast-check + supertest (already available in devDependencies)
- The Nginx fix is documentation-only (DEPLOY.md) — actual Nginx config changes must be applied manually on the Pi
- Test file: `src/security-headers.property.test.ts`
- Exploration test (Property 1) must FAIL before fix and PASS after fix
- Preservation test (Property 2) must PASS both before and after fix

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3"] },
    { "id": 2, "tasks": ["3.4", "3.5"] },
    { "id": 3, "tasks": ["4"] }
  ]
}
```
