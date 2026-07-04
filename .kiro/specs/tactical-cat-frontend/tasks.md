# Implementation Plan: Tactical Cat Frontend

## Overview

This plan implements the REST API server, input validation module, React frontend application, and project documentation for the "Operation Purrfect Storm" tactical cat adoption command center. The implementation is split into backend API (Express + SQLite), validation logic, frontend SPA (Vite + React + TailwindCSS + react-leaflet), static serving/SPA fallback, and README documentation. All code is TypeScript.

## Tasks

- [x] 1. Create input validation module and API server foundation
  - [x] 1.1 Create `src/validation.ts` with `sanitizeSearchQuery` and `validateShelterId` functions
    - Implement `sanitizeSearchQuery(raw: string): string` that strips characters outside `[a-zA-Z0-9 \-ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]` and truncates to 100 characters
    - Implement `validateShelterId(raw: string): number | null` that parses as integer, returns null if not positive or exceeds 2,147,483,647
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.2 Write property tests for input validation (`src/validation.property.test.ts`)
    - **Property 5: Input sanitization output invariant**
    - **Property 6: Shelter ID validation correctness**
    - **Validates: Requirements 5.1, 5.2, 5.3**

  - [x] 1.3 Create `src/server.ts` with Express app, middleware stack, and API routes
    - Set up Express with helmet, CORS (allow only configured origin, GET only), and JSON response
    - Implement `GET /api/shelters` — query shelters with LEFT JOIN cat count
    - Implement `GET /api/cats` — search cats with optional sanitized search parameter, LIMIT 200
    - Implement `GET /api/shelters/:id/cats` — validate ID, return cats for shelter or 404/400
    - Add global error handler returning `{ message }` JSON for all errors
    - Add static file serving from `/frontend/dist` and SPA fallback to `index.html`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 5.4, 5.5, 10.2, 10.3, 10.4, 12.1, 12.2, 12.3, 12.4, 12.5_

  - [x] 1.4 Write property tests for the API server (`src/server.property.test.ts`)
    - **Property 1: Shelter cat_count matches actual cat records**
    - **Property 2: Search returns only matching results**
    - **Property 3: Search result count bounded by limit**
    - **Property 4: Sanitized empty input equivalent to no filter**
    - **Property 7: Response format completeness**
    - **Property 8: All success responses have JSON Content-Type**
    - **Property 9: All error responses contain message field**
    - **Property 12: Shelter cats endpoint returns exactly the shelter's cats**
    - **Validates: Requirements 1.1, 2.1, 2.2, 2.4, 3.1, 5.5, 12.1, 12.2, 12.3, 12.4, 12.5**

  - [x] 1.5 Write unit tests for the API server (`src/server.test.ts`)
    - Test 404 for non-existent shelter ID
    - Test 400 for non-integer shelter ID
    - Test empty database returns empty arrays
    - Test search with specific known data returns correct matches
    - Test CORS headers and security headers present
    - _Requirements: 3.2, 3.3, 3.4, 4.1, 4.2, 12.2_

- [x] 2. Checkpoint - Backend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Initialize frontend project structure
  - [x] 3.1 Scaffold `/frontend` Vite + React + TypeScript project
    - Create `/frontend/package.json` with dependencies: react, react-dom, react-leaflet, leaflet, @types/leaflet
    - Create `/frontend/tsconfig.json` for React JSX
    - Create `/frontend/vite.config.ts` with proxy for `/api` to Express dev server
    - Create `/frontend/index.html` entry point
    - Create `/frontend/postcss.config.js` and `/frontend/tailwind.config.js` with custom dark theme colors
    - Create `/frontend/src/main.tsx` Vite entry point rendering `<App />`
    - _Requirements: 9.2, 10.1_

  - [x] 3.2 Create shared types and API client
    - Create `/frontend/src/types.ts` with `ShelterResponse`, `CatResponse`, `ApiError` interfaces
    - Create `/frontend/src/api.ts` fetch wrapper with typed error handling for non-2xx responses
    - _Requirements: 12.3, 12.4_

- [x] 4. Implement frontend data hooks
  - [x] 4.1 Create `useShelters` hook (`/frontend/src/hooks/useShelters.ts`)
    - Fetch `/api/shelters` on mount, manage `{ data, loading, error }` state
    - Expose a `retry` function for error recovery
    - _Requirements: 6.2, 6.4, 6.5_

  - [x] 4.2 Create `useSearchCats` hook (`/frontend/src/hooks/useSearchCats.ts`)
    - Accept search query string, debounce by 300ms
    - Only fetch when query is >= 2 characters, clear results when < 2 characters
    - Fetch `/api/cats?search=...`, manage `{ data, loading, error }` state
    - _Requirements: 7.2, 7.4, 7.6, 7.7_

  - [x] 4.3 Create `useShelterCats` hook (`/frontend/src/hooks/useShelterCats.ts`)
    - Fetch `/api/shelters/:id/cats` for a given shelter ID
    - Manage loading/error state
    - _Requirements: 3.1_

- [x] 5. Implement frontend UI components
  - [x] 5.1 Create `App.tsx` layout shell with dark tactical header
    - Render "Operation Purrfect Storm" title and tactical subtitle
    - Apply dark color palette (background < #1a1a2e), military green and amber accents
    - Layout: map on left/top, search panel on right/bottom
    - _Requirements: 9.1, 9.3, 9.4_

  - [x] 5.2 Create `MapView.tsx` and `ShelterPin.tsx` components
    - Render react-leaflet map centered on Poland (~52.0, 19.0, zoom 6)
    - Display `ShelterPin` for each shelter with popup showing name and cat count
    - Show `LoadingOverlay` while fetching, `ErrorMessage` with retry on failure
    - Dismiss popup on click-away or close button
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 5.3 Create `SearchPanel.tsx` component
    - Render search input labeled "Agent Database" with placeholder mentioning name and city
    - Wire to `useSearchCats` hook
    - Display loading indicator during requests
    - Display "No agents found" when results are empty
    - Display error message on failure
    - Render up to 50 `AgentCard` components from results
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7_

  - [x] 5.4 Create `AgentCard.tsx` component
    - Display cat name (monospace font), description (truncated to 150 chars + ellipsis), image or placeholder, shelter name, shelter city
    - Apply dark tactical styling with border, glow effect, smooth transitions
    - Show "No intel available" when description is empty/null
    - Show placeholder cat silhouette when image_url is null
    - _Requirements: 8.1, 8.2, 8.3, 8.4_

  - [x] 5.5 Create `LoadingOverlay.tsx` and `ErrorMessage.tsx` utility components
    - `LoadingOverlay` shows a spinner/pulsing indicator
    - `ErrorMessage` shows error text and a "Retry" button that invokes a callback
    - Apply tactical styling consistent with theme
    - _Requirements: 6.4, 6.5, 7.4, 7.7_

  - [x] 5.6 Write unit test for AgentCard description truncation (`/frontend/src/components/AgentCard.test.ts`)
    - **Property 11: Description truncation**
    - **Validates: Requirements 8.1**

- [x] 6. Checkpoint - Frontend verification
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Integration, SPA fallback wiring, and documentation
  - [x] 7.1 Wire SPA fallback and static serving in `src/server.ts`
    - Ensure Express serves `/frontend/dist` static files with correct Content-Type
    - Ensure non-API, non-static paths serve `index.html` (SPA fallback)
    - Return 404 JSON error if `index.html` missing
    - _Requirements: 10.2, 10.3, 10.4_

  - [x] 7.2 Write integration tests for static serving and SPA fallback
    - Test static file served with correct Content-Type
    - Test SPA fallback returns index.html for non-API paths
    - Test 404 JSON when index.html missing
    - **Property 10: SPA fallback for non-API paths**
    - **Validates: Requirements 10.2, 10.3, 10.4**

  - [x] 7.3 Create `README.md` at project root
    - Write project overview explaining "Wholesome World Domination" theme
    - Include Mermaid architecture diagram showing Temporal → SQLite → Express API → React frontend
    - Add setup instructions with shell commands for Temporal, worker, and frontend dev server
    - List full technology stack
    - Add placeholder section for Aikido Security Scan Report
    - Organize under navigable markdown headings
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [x] 7.4 Add `"server"` script to root `package.json` and install Express dependencies
    - Add express, helmet, cors, @types/express, @types/cors to root package.json
    - Add `"server": "tsx src/server.ts"` script
    - _Requirements: 4.1, 4.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The backend uses the existing `initializeDatabase` from `src/db.ts` for database access
- Frontend is an independent Vite project under `/frontend` with its own `package.json`
- All API tests use in-memory SQLite (`:memory:`) for fast, isolated test runs

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "3.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "3.2"] },
    { "id": 2, "tasks": ["1.4", "1.5", "4.1", "4.2", "4.3"] },
    { "id": 3, "tasks": ["5.1", "5.2", "5.3", "5.5", "7.4"] },
    { "id": 4, "tasks": ["5.4", "5.6"] },
    { "id": 5, "tasks": ["7.1", "7.3"] },
    { "id": 6, "tasks": ["7.2"] }
  ]
}
```
