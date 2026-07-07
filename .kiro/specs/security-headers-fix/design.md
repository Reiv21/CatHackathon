# Security Headers Fix — Bugfix Design

## Overview

The Express server correctly configures security headers via helmet (CSP, HSTS, X-Content-Type-Options, etc.), but these headers are stripped or never forwarded by the Nginx reverse proxy. The Nginx config in DEPLOY.md section 3 only performs a basic `proxy_pass` without `proxy_pass_header` directives or its own `add_header` statements. As a result, Aikido security scanner flags the production site (https://mrucznik.serwerigora.com) as missing CSP (risk 91), HSTS (risk 89), and frame-ancestors/X-Frame-Options (risk 50).

The fix adds `proxy_pass_header` directives to the Nginx config so that Express-set headers pass through to the client, adds `frame-ancestors 'none'` to the Express helmet CSP config for completeness, and updates DEPLOY.md to reflect the corrected Nginx configuration. Optionally, the deploy workflow will reload Nginx after code deployment.

## Glossary

- **Bug_Condition (C)**: A client request arrives via the Nginx reverse proxy — in production, every request satisfies this condition
- **Property (P)**: The response MUST include Content-Security-Policy, Strict-Transport-Security, and frame-ancestors (or X-Frame-Options) headers with correct values
- **Preservation**: Existing behaviors that must remain unchanged — localhost development headers, API JSON responses, frontend static asset loading, and external resource loading under CSP
- **helmet**: Express middleware (`src/server.ts`) that sets security headers on responses
- **proxy_pass_header**: Nginx directive that allows named upstream headers to pass through to the client
- **frame-ancestors**: CSP directive that controls which origins can embed the page in a frame (supersedes X-Frame-Options)

## Bug Details

### Bug Condition

The bug manifests when any HTTP request passes through the Nginx reverse proxy to the Express backend. Nginx's default behavior strips certain upstream headers, and since the config has no explicit `proxy_pass_header` or `add_header` directives for security headers, the client never receives CSP, HSTS, or frame-protection headers.

**Formal Specification:**
```
FUNCTION isBugCondition(request)
  INPUT: request of type HTTPRequest
  OUTPUT: boolean
  
  RETURN request.passedThroughNginxProxy = true
         AND response.headers NOT CONTAIN 'Content-Security-Policy'
         AND response.headers NOT CONTAIN 'Strict-Transport-Security'
         AND response.headers NOT CONTAIN 'X-Frame-Options'
         AND response.headers['Content-Security-Policy'] NOT CONTAIN 'frame-ancestors'
END FUNCTION
```

### Examples

- **CSP Missing**: `curl -I https://mrucznik.serwerigora.com/` → response has no `Content-Security-Policy` header. Expected: header present with `default-src 'self'; script-src 'self' 'unsafe-inline'; ...`
- **HSTS Missing**: `curl -I https://mrucznik.serwerigora.com/api/cats` → response has no `Strict-Transport-Security` header. Expected: `max-age=31536000; includeSubDomains`
- **Frame Protection Missing**: `curl -I https://mrucznik.serwerigora.com/` → neither `X-Frame-Options` nor `frame-ancestors` in CSP. Expected: `frame-ancestors 'none'` in CSP or `X-Frame-Options: DENY`
- **Localhost works**: `curl -I http://localhost:3001/` → all headers present (bypasses Nginx)

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse/keyboard interaction with the React frontend must continue to work
- Express helmet headers must continue to be set correctly in localhost/development mode
- API endpoints (`/api/cats`, `/api/shelters`, `/api/report-stray`, etc.) must continue to return valid JSON with CORS headers
- Static frontend assets (JS bundles, CSS, images, favicon) must load without being blocked by CSP
- External resources (Google Fonts from fonts.googleapis.com/fonts.gstatic.com, Leaflet CSS from unpkg.com, map tiles, cat images from shelter sites) must continue to load under CSP
- WebSocket upgrade for development hot-reload must not be affected by the Nginx header changes
- PM2 process management and restart behavior must remain unchanged

**Scope:**
All behaviors unrelated to the Nginx security header forwarding should be completely unaffected. This includes:
- Application logic and data handling
- Authentication and rate limiting
- Cron-based scraping
- SSL/TLS termination (already working at Nginx)

## Hypothesized Root Cause

Based on the bug description, the issue is in the Nginx configuration:

1. **Missing `proxy_pass_header` directives**: Nginx does not explicitly forward `Content-Security-Policy`, `Strict-Transport-Security`, or `X-Frame-Options` headers set by the upstream Express server. By default, Nginx may strip or not pass some headers from proxy responses.

2. **No `add_header` fallback**: The Nginx config has no `add_header` statements that would emit security headers at the proxy level itself, regardless of what the upstream sets.

3. **Missing `frame-ancestors` in Express CSP**: While Express sets `frame-src: 'none'` (which controls what the page can frame), it does NOT set `frame-ancestors: 'none'` (which controls who can frame the page). The `frame-ancestors` directive is the CSP replacement for `X-Frame-Options` and should be explicitly set.

4. **Nginx `proxy_hide_header` defaults**: Nginx's default `proxy_hide_header` behavior may suppress some upstream headers. Without explicit pass-through configuration, headers like `Content-Security-Policy` may not reach the client.

## Correctness Properties

Property 1: Bug Condition - Security Headers Present in Proxied Responses

_For any_ HTTP request that passes through the Nginx reverse proxy to the Express backend, the response received by the client SHALL include: (a) a `Content-Security-Policy` header matching the policy defined in `src/server.ts`, (b) a `Strict-Transport-Security` header with `max-age=31536000; includeSubDomains`, and (c) a `frame-ancestors 'none'` directive within the CSP header.

**Validates: Requirements 2.1, 2.2, 2.3**

Property 2: Preservation - Non-Proxied and Functional Behavior Unchanged

_For any_ request served in development mode (localhost without Nginx), OR any API/static-asset request whose behavior depends on application logic rather than Nginx header forwarding, the fixed code SHALL produce exactly the same behavior as the original code, preserving correct Express helmet headers in dev mode, valid JSON API responses, successful static asset loading, and successful external resource loading under CSP.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `DEPLOY.md` (Section 3 — Nginx Config)

**Change**: Replace the basic `proxy_pass` config with one that explicitly passes security headers through

**Specific Changes**:
1. **Add `proxy_pass_header` directives**: Add directives for `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options`, and `Referrer-Policy` to ensure all helmet-set headers pass through to the client.

2. **Alternative: Add `add_header` directives at Nginx level**: As a belt-and-suspenders approach, add `add_header` directives at the Nginx level that mirror the Express config. This provides defense-in-depth if Express headers are ever misconfigured.

3. **Recommended approach — pass-through**: Use `proxy_pass_header` to forward Express headers. This keeps the single source of truth in `src/server.ts` and avoids header duplication/conflicts.

---

**File**: `src/server.ts`

**Function**: `createApp` (helmet configuration)

**Specific Changes**:
4. **Add `frame-ancestors` to CSP directives**: Add `frameAncestors: ["'none'"]` to the helmet contentSecurityPolicy directives object. This adds the `frame-ancestors 'none'` directive to CSP, which is the modern replacement for `X-Frame-Options: DENY` and directly addresses Aikido finding 1.3.

---

**File**: `.github/workflows/deploy.yml`

**Specific Changes**:
5. **Add Nginx config deployment step**: After `pm2 restart`, add a step that copies the updated Nginx config snippet and reloads Nginx. Alternatively, document that the Nginx config must be updated manually on the Pi after deployment (simpler and safer for a personal Raspberry Pi setup).

---

**File**: `DEPLOY.md` (documentation update)

**Specific Changes**:
6. **Update Section 3**: Replace the current minimal Nginx location block with the full security-aware configuration including `proxy_pass_header` directives and comments explaining each header.

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code (missing headers in proxied responses), then verify the fix works correctly and preserves existing behavior.

Since this is primarily an infrastructure/configuration bug (Nginx config), testing involves both unit-level verification of Express headers and integration-level verification of the full proxy chain.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Make HTTP requests through the Nginx proxy (or simulate the proxy behavior) and assert that security headers are present in responses. Run these checks against the UNFIXED Nginx config to observe the missing headers.

**Test Cases**:
1. **CSP Header Check**: `curl -I https://mrucznik.serwerigora.com/` and verify `Content-Security-Policy` header is absent (will fail on unfixed config)
2. **HSTS Header Check**: `curl -I https://mrucznik.serwerigora.com/` and verify `Strict-Transport-Security` header is absent (will fail on unfixed config)
3. **Frame Protection Check**: `curl -I https://mrucznik.serwerigora.com/` and verify neither `X-Frame-Options` nor `frame-ancestors` is present (will fail on unfixed config)
4. **Localhost Baseline**: `curl -I http://localhost:3001/` and verify all headers ARE present (confirms Express is working correctly)

**Expected Counterexamples**:
- Security headers set by Express/helmet are not present in responses received by the client through Nginx
- Localhost responses correctly include all headers, confirming the issue is at the proxy layer

### Fix Checking

**Goal**: Verify that for all requests where the bug condition holds (requests through Nginx), the fixed configuration produces the expected security headers.

**Pseudocode:**
```
FOR ALL request WHERE isBugCondition(request) DO
  response := sendRequestThroughNginx(request)
  ASSERT response.headers CONTAINS 'Content-Security-Policy'
  ASSERT response.headers CONTAINS 'Strict-Transport-Security'
  ASSERT response.headers['Content-Security-Policy'] CONTAINS 'frame-ancestors'
  ASSERT response.headers['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains'
END FOR
```

### Preservation Checking

**Goal**: Verify that for all requests where the bug condition does NOT hold (localhost, and all existing functionality), the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL request WHERE NOT isBugCondition(request) DO
  ASSERT expressApp_original(request).headers = expressApp_fixed(request).headers
  ASSERT expressApp_original(request).body = expressApp_fixed(request).body
  ASSERT expressApp_original(request).status = expressApp_fixed(request).status
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various URL paths, methods, content types)
- It catches edge cases where the CSP change might accidentally block a legitimate resource
- It provides strong guarantees that behavior is unchanged for all non-security-header-related functionality

**Test Plan**: Observe behavior on UNFIXED code first for API calls, static asset serving, and external resource loading, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Express Header Preservation**: Verify that Express/helmet still sets all security headers correctly on localhost (no regression in Express middleware)
2. **API Response Preservation**: Verify `/api/cats`, `/api/shelters` return correct JSON with CORS headers after adding `frameAncestors` to CSP
3. **CSP Resource Loading**: Verify that Google Fonts, unpkg Leaflet CSS, and external cat images are not blocked by the updated CSP (adding `frameAncestors` should not affect other directives)
4. **Static Asset Serving**: Verify frontend JS/CSS bundles load without CSP violations

### Unit Tests

- Test that Express app sets `Content-Security-Policy` header including `frame-ancestors 'none'` (new directive)
- Test that Express app sets `Strict-Transport-Security: max-age=31536000; includeSubDomains`
- Test that adding `frameAncestors` does not affect other CSP directives (script-src, style-src, etc.)
- Test that API endpoints return correct status codes and JSON structure after helmet config change

### Property-Based Tests

- Generate random valid URL paths and verify all responses include the expected security headers from Express
- Generate random combinations of request methods and paths and verify CSP header always contains the same policy string
- Test that no previously-allowed resource origin is blocked by the CSP after adding `frame-ancestors`

### Integration Tests

- Test full request through Nginx proxy and verify all three security headers are present
- Test that frontend page loads completely (all assets, fonts, map tiles) with updated Nginx config
- Test that WebSocket upgrade (if used for dev) still works with the new Nginx directives
- Run Aikido scanner (or equivalent curl-based check) against the production URL to confirm findings are resolved
