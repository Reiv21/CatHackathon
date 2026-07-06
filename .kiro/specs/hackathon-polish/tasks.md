# Implementation Plan: Hackathon Polish

## Overview

Final polish pass for Mrucznik 🐱 — integrating Temporal parent/child workflow hardening, SQLite→JSON atomic export, gamification endpoints, security hardening, frontend theme components, build optimization, and documentation. Tasks are ordered by dependency: backend infrastructure → API endpoints → frontend → docs/tests.

## Tasks

- [x] 1. Backend infrastructure and Temporal workflow enhancements
  - [x] 1.1 Implement exportDataActivity with atomic writes
    - Add `exportDataActivity` to `src/activities.ts` that queries SQLite for shelters (with cat_count) and cats (joined with shelter data including shelter_name, shelter_city, sex, age)
    - Write to temp files first, then rename both atomically (write-to-temp + `renameSync` pattern)
    - Log exported shelter and cat counts on success
    - Retry config: 3 attempts with exponential backoff (1s base), start-to-close 30s
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.2 Update parentSyncWorkflow to call exportDataActivity after child workflows
    - In `src/workflows.ts`, add `exportDataActivity` to the Activities proxy interface
    - After `Promise.all(childWorkflows)` completes, call `activities.exportDataActivity()`
    - Ensure the parent workflow completes only after export finishes
    - _Requirements: 1.6, 2.1_

  - [x] 1.3 Add retry policies with exponential backoff to workflow activities
    - Update `proxyActivities` config in `src/workflows.ts` to include explicit `retry.initialInterval: '1s'` and `retry.backoffCoefficient: 2`
    - Set `startToCloseTimeout: '60s'` for scraper/fetch activities, `'30s'` for save/export
    - _Requirements: 1.5_

  - [x] 1.4 Implement graceful shutdown handler in server
    - In `src/server.ts`, add SIGTERM/SIGINT handlers that call `server.close()`
    - Track in-flight requests, wait up to 10s for completion
    - Force-close remaining connections after timeout, exit(0)
    - On second signal during shutdown, force exit(1)
    - Log "Graceful shutdown initiated" on first signal
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 1.5 Write property test for atomic write safety (Property 3)
    - **Property 3: Atomic write safety**
    - Simulate write failures (mock `writeFileSync` to throw mid-write), verify original files remain unchanged
    - **Validates: Requirements 2.4**

  - [x] 1.6 Write property test for child workflow filtering (Property 1)
    - **Property 1: Child workflow filtering**
    - Generate random shelter lists with various null/empty/valid website_url values
    - Verify that the count of shelters with non-null, non-empty URLs matches the expected child workflow count
    - **Validates: Requirements 1.4**

- [x] 2. Security hardening
  - [x] 2.1 Harden CSP and security headers
    - Update helmet config in `src/server.ts`: add `hsts` with `maxAge: 31536000, includeSubDomains: true`
    - Set `xContentTypeOptions: true` (nosniff), `hidePoweredBy: true`
    - Update `connectSrc` to dynamically include validated `TEMPORAL_ADDRESS` env var (validate host:port format, fall back to `['self']` only if invalid)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_

  - [x] 2.2 Implement admin auth middleware
    - Create reusable middleware function `requireAdminAuth` that checks `Authorization: Bearer <token>` header
    - Return 401 with generic `{ message: "Unauthorized" }` — no stack traces, no file paths, no config details
    - Apply middleware to all `/api/admin/*` endpoints (sync, sync/status, suggestions, strays delete)
    - _Requirements: 9.5, 3.4_

  - [x] 2.3 Write property test for admin auth rejection (Property 8)
    - **Property 8: Admin auth rejection without information leakage**
    - Generate random admin paths and invalid/missing tokens, verify 401 response body contains no stack traces, file paths, or config values
    - **Validates: Requirements 9.5**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. API endpoints — sync, status, gamification, health
  - [x] 4.1 Implement POST /api/admin/sync endpoint
    - Create Temporal Client connection, start `parentSyncWorkflow` with `workflowId: shelter-sync-${Date.now()}`
    - Return HTTP 200 with `{ workflow_id, message }` immediately (non-blocking)
    - On Temporal connection failure, return HTTP 503 with `{ message: "Workflow engine unavailable" }`
    - Protected by admin auth middleware
    - _Requirements: 1.1, 1.2_

  - [x] 4.2 Implement GET /api/admin/sync/status endpoint
    - Query Temporal for most recent workflow with ID prefix `shelter-sync-`
    - Map workflow state to `{ status, start_time, completion_time }`
    - Return `{ status: "never_run", start_time: null, completion_time: null }` when no workflow found
    - Return HTTP 503 when Temporal is unreachable
    - Protected by admin auth middleware
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 4.3 Implement GET /api/domination endpoint
    - Load shelters.json and cats.json, compute domination stats using `computeDomination` pure function
    - Handle missing/unreadable files gracefully (return zeroed response with "Kocie Zwiadowcy")
    - Response time target: <500ms
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7, 4.8_

  - [x] 4.4 Implement GET /api/achievements endpoint
    - Load data, compute achievements using `computeAchievements` pure function
    - Return empty array when no thresholds met
    - Thresholds: cats ≥ 100 → "Pierwsza Setka", shelters_with_cats ≥ 10 → "10 Schronisk", voivodeships = 16 → "Pełna Dominacja"
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 4.5 Implement GET /api/health endpoint
    - Return `{ status: "ok", uptime, timestamp }` under normal conditions
    - Check data directory accessibility; return 503 with `{ status: "degraded", details }` if inaccessible
    - Target response time: <100ms
    - _Requirements: 10.1, 10.2, 10.3_

  - [x] 4.6 Write property test for domination computation (Property 5)
    - **Property 5: Domination computation**
    - Generate random shelter/cat sets, verify `computeDomination` returns correct `shelters_covered`, `percentage` (rounded to 2 decimals), `cats_in_army`, and `domination_level` matching range brackets
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**

  - [x] 4.7 Write property test for achievement computation (Property 7)
    - **Property 7: Achievement computation**
    - Generate random combinations of cat count, shelter IDs with cats, voivodeships
    - Verify "Pierwsza Setka" iff cats ≥ 100, "10 Schronisk" iff shelters ≥ 10, "Pełna Dominacja" iff voivodeships = 16
    - **Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6**

  - [x] 4.8 Write property test for workflow status mapping (Property 4)
    - **Property 4: Workflow status mapping**
    - Generate random Temporal execution states, verify status mapping to "running"/"completed"/"failed" and ISO 8601 timestamps
    - **Validates: Requirements 3.2**

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Frontend — theme components and gamification UI
  - [x] 6.1 Create DominationTracker component
    - Create `frontend/src/components/DominationTracker.tsx`
    - Render progress bar filled to current percentage, domination_level title, cats_in_army count
    - Accept `data: DominationResponse | null` and `loading: boolean` props
    - Show skeleton placeholder while loading
    - _Requirements: 4.6_

  - [x] 6.2 Create CatArmyCounter component with animation
    - Create `frontend/src/components/CatArmyCounter.tsx`
    - Animate from 0 to targetCount over 2s using `requestAnimationFrame` with easeOutCubic
    - Display: 🐱 {formatted_count} "Kocia Armia" (PL) / "Cat Army" (EN)
    - Format count with locale-appropriate thousands separators
    - Update at least 30fps during animation
    - Show "0" on API failure
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [x] 6.3 Create AchievementBadges component
    - Create `frontend/src/components/AchievementBadges.tsx`
    - Render badges in "Odznaki Dominacji" section showing icon + name
    - Hide section entirely when achievements array is empty or API fails
    - _Requirements: 6.7, 6.8_

  - [x] 6.4 Add thematic banner to Home component
    - Add banner section with "Światowy Dzień Kociej Dominacji" title and subtitle "Katalogujemy wszystkie koty do adopcji w Polsce" above existing hero content
    - Integrate DominationTracker, CatArmyCounter, and AchievementBadges into Home
    - Fetch `/api/domination` and `/api/achievements` on mount
    - _Requirements: 6.1, 4.6, 5.1_

  - [x] 6.5 Write property test for counter display formatting (Property 6)
    - **Property 6: Counter display formatting**
    - Generate random non-negative integers and language (PL/EN), verify output contains 🐱, locale-formatted number, and correct label
    - **Validates: Requirements 5.2**

- [ ] 7. Frontend — skeleton screens and error handling
  - [x] 7.1 Create skeleton components
    - Create `CatCardSkeleton` (208px image area + text lines), `StatsSkeleton` (rounded-2xl cards), `CatOfDaySkeleton` (320px image area)
    - Use Tailwind `animate-pulse` with `bg-gray-200` placeholder blocks
    - Display minimum 6 skeleton cards or page size (24), whichever is smaller
    - _Requirements: 12.1, 12.2_

  - [x] 7.2 Integrate skeleton loading states and error handling into CatSearch and Home
    - Show skeleton cards while fetching in CatSearch grid layout
    - Show skeleton stats and cat-of-day in Home while loading
    - On API error/timeout (15s), show inline error message + retry button
    - Preserve previously loaded data in other sections
    - On retry, show skeleton again; allow unlimited retries
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 8. Frontend — accessibility and responsive design
  - [x] 8.1 Add semantic HTML landmarks and aria attributes
    - Use `nav`, `main`, `article`, `section`, `header`, `footer` for page structure
    - Add `aria-label` to icon-only buttons (hamburger, close, back-to-top, language toggle, map markers)
    - Add `aria-live` regions for dynamic content (search results, errors)
    - Move focus to main content heading on hash navigation
    - Add descriptive alt text for cat images (name + shelter city); empty alt for decorative images
    - Provide text-based shelter list alternative for map view users
    - _Requirements: 13.1, 13.2, 13.5, 13.6, 13.7, 13.8_

  - [x] 8.2 Ensure color contrast and keyboard navigation
    - Verify 4.5:1 contrast for normal text, 3:1 for large text and UI components
    - Ensure logical tab order with visible focus indicators (3:1 contrast)
    - Ensure all interactive elements have minimum 44×44px touch targets on mobile
    - _Requirements: 13.3, 13.4, 14.2_

  - [x] 8.3 Responsive layout adjustments
    - Cat cards: 1-column <640px, 2-column 640–1024px, 3-column >1024px
    - Mobile hamburger menu visible <768px, desktop nav hidden
    - Map view full viewport height minus header (3.5rem) on mobile
    - Prevent horizontal scrolling on all viewports
    - _Requirements: 14.1, 14.3, 14.4, 14.5, 14.6_

- [ ] 9. Build optimization and cache headers
  - [x] 9.1 Configure Vite chunking and gzip compression
    - Update `frontend/vite.config.ts` with `manualChunks` for vendor (react, react-dom) and leaflet (leaflet, react-leaflet)
    - Add `vite-plugin-compression` for gzip generation of files > 1kB
    - Ensure no single chunk exceeds 500kB uncompressed
    - Ensure content hashes (8+ chars) in output filenames
    - _Requirements: 15.1, 15.2, 15.3_

  - [x] 9.2 Add cache headers middleware to Express server
    - For static files with content hash in filename: `Cache-Control: max-age=31536000, immutable`
    - For index.html: `Cache-Control: no-cache`
    - _Requirements: 15.4, 15.5_

  - [x] 9.3 Write property test for cache-control headers (Property 9)
    - **Property 9: Cache-Control headers for hashed assets**
    - Generate filenames with/without 8+ hex character hashes, verify correct Cache-Control header values
    - **Validates: Requirements 15.4**

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 11. Documentation
  - [x] 11.1 Overhaul README.md
    - Add project description (name, purpose, hackathon theme) in first 5 lines
    - Architecture overview section with Mermaid diagram (Cheerio → Temporal → SQLite → JSON → Express → React/Vite)
    - Setup section with numbered steps (prerequisites Node.js 20+, Temporal server, deps install, env config, verification command)
    - Deployment section (env vars, build commands, running server + worker)
    - Security section linking to SECURITY.md, listing sanitization, helmet, CORS
    - Technology stack grouped by function with one-line descriptions
    - Contributing section (code style, PR process)
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [x] 11.2 Create SECURITY.md
    - Document helmet config and CSP directives with explanations
    - Document input validation (sanitizeSearchQuery, validateShelterId)
    - Document rate limiting (brute force login, stray reports)
    - Document authentication approach and known limitations
    - Document data handling practices
    - Include future improvements section (JWT, HTTPS, Aikido)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 12. Integration tests
  - [x] 12.1 Write integration tests for new API endpoints
    - Test POST `/api/admin/sync` with mock Temporal client (success + 503 on connection failure)
    - Test GET `/api/admin/sync/status` with mock Temporal query (running, completed, failed, never_run, 503)
    - Test GET `/api/domination` with real data files and missing files
    - Test GET `/api/achievements` with various data states
    - Test GET `/api/health` normal and degraded conditions
    - Test auth middleware rejection across all admin endpoints
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 3.3, 3.5, 4.1, 4.7, 6.2, 6.6, 10.1, 10.3, 9.5_

  - [x] 12.2 Write property test for export data correctness (Property 2)
    - **Property 2: Export data correctness and schema**
    - Generate random DB states with shelters and cats, run export query logic, verify output schema and join correctness (cat_count matches, shelter_name/shelter_city match joined records)
    - **Validates: Requirements 2.1, 2.2**

- [x] 13. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The project uses TypeScript throughout (backend: tsx/vitest, frontend: React/Vite/vitest)
- fast-check is already available in both backend and frontend devDependencies

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.4", "2.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "2.2"] },
    { "id": 2, "tasks": ["1.5", "1.6", "2.3"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5"] },
    { "id": 4, "tasks": ["4.6", "4.7", "4.8", "9.2"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "9.1"] },
    { "id": 6, "tasks": ["6.4", "6.5", "7.1"] },
    { "id": 7, "tasks": ["7.2", "8.1"] },
    { "id": 8, "tasks": ["8.2", "8.3", "9.3"] },
    { "id": 9, "tasks": ["11.1", "11.2"] },
    { "id": 10, "tasks": ["12.1", "12.2"] }
  ]
}
```
