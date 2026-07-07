# Implementation Plan: SQLite Direct Read

## Overview

Refactor the Express server to read all data directly from SQLite via a persistent `better-sqlite3` connection. Remove the JSON export pipeline, enrich the cats table schema, add `stray_reports` and `suggestions` tables, and update all API handlers to use prepared SQL statements. All existing API response shapes are preserved.

## Tasks

- [x] 1. Extend database schema and interfaces
  - [x] 1.1 Add new columns and tables to `src/db.ts`
    - Add `source_url TEXT`, `sex TEXT`, `age TEXT` columns to `cats` table (with `pragma_table_info` check before ALTER)
    - Create `stray_reports` table with `id`, `description`, `image_url`, `latitude`, `longitude`, `city`, `reported_at`
    - Create `suggestions` table with `id`, `name`, `city`, `voivodeship`, `website_url`, `submitter_email`, `submitted_at`
    - Add indexes: `idx_stray_reports_city`, `idx_suggestions_city`
    - Export `StrayReport` and `Suggestion` TypeScript interfaces
    - Update `Cat` interface to include `source_url`, `sex`, `age`
    - _Requirements: 2.1, 2.2, 5.1, 6.1_

  - [x] 1.2 Create query module `src/queries.ts`
    - Create `createQueries(db)` function returning prepared statements for all endpoints
    - Include: `getAllShelters`, `getCatsByShelter`, `getCatsWithImages`, `countCats`, `countShelters`, `countSheltersWithCats`
    - Include: `insertStrayReport`, `getAllStrays`, `deleteStray`
    - Include: `insertSuggestion`, `getAllSuggestions`, `deleteSuggestion`
    - _Requirements: 1.1, 1.2, 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 5.2, 5.3, 5.4, 6.2, 6.3, 6.4_

- [x] 2. Rewrite server to use SQLite
  - [x] 2.1 Refactor `src/server.ts` — connection and removal of JSON reads
    - Open persistent DB via `initializeDatabase(dbPath)` in `createApp()`
    - Return `{ app, db }` from `createApp()`
    - Remove `loadShelters()`, `loadCats()` functions
    - Remove `DATA_DIR` constant and all `fs.readFileSync`/`writeFileSync` for data files
    - Remove `existsSync`, `readFileSync`, `writeFileSync`, `accessSync`, `constants` imports (where no longer needed)
    - Update `/api/health` to check `db.open` instead of `DATA_DIR` access
    - _Requirements: 1.1, 1.2, 1.3, 8.1_

  - [x] 2.2 Rewrite shelter endpoints in `src/server.ts`
    - `GET /api/shelters`: query via `getAllShelters`, enrich with `getCityCoords`
    - `GET /api/shelters/:id/cats`: query via `getCatsByShelter`
    - Ensure response shapes match existing API contract
    - _Requirements: 3.1, 3.2, 3.3, 10.1_

  - [x] 2.3 Rewrite cat endpoints in `src/server.ts`
    - `GET /api/cats`: SQL query with `WHERE`/`LIKE` for search, voivodeship, sex filters; `ORDER BY` for sorting; `LIMIT`/`OFFSET` for pagination
    - `GET /api/cat-of-the-day`: query cats with images, deterministic selection by date seed
    - `GET /api/random-cat`: query cats with images, random selection
    - `GET /api/stats`: use COUNT queries for `totalCats`, `totalShelters`, `sheltersWithCats`; use `MAX(scraped_at)` for `lastFetched`
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 10.2, 10.4_

  - [x] 2.4 Rewrite stray report endpoints in `src/server.ts`
    - `POST /api/report-stray`: insert into `stray_reports` table
    - `GET /api/strays`: query all from `stray_reports` table
    - `DELETE /api/admin/strays/:id`: delete by ID from `stray_reports` table
    - _Requirements: 5.2, 5.3, 5.4, 10.3_

  - [x] 2.5 Rewrite suggestion endpoints in `src/server.ts`
    - `POST /api/suggest-shelter`: insert into `suggestions` table
    - `GET /api/admin/suggestions`: query all from `suggestions` table
    - `DELETE /api/admin/suggestions/:id`: delete by ID from `suggestions` table
    - _Requirements: 6.2, 6.3, 6.4_

  - [x] 2.6 Rewrite domination and achievements endpoints
    - `GET /api/domination`: query shelters and cats from DB, pass to `computeDomination`
    - `GET /api/achievements`: query shelters and cats from DB, pass to `computeAchievements`
    - _Requirements: 3.1, 4.4_

- [x] 3. Checkpoint — verify server compiles and basic routes work
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Remove export pipeline
  - [x] 4.1 Remove `exportDataActivity` and `atomicWriteJSON` from `src/activities.ts`
    - Delete `exportDataActivity` function
    - Delete `atomicWriteJSON` function
    - Remove unused `writeFileSync`, `renameSync`, `tmpdir`, `resolve` imports
    - _Requirements: 7.1_

  - [x] 4.2 Update `src/workflows.ts` — remove export step
    - Remove `exportDataActivity` call from `parentSyncWorkflow`
    - Remove `SaveActivities.exportDataActivity` from the interface
    - Remove `saveActivities` proxy (or keep only `saveCatsActivity` if still needed)
    - _Requirements: 7.2_

  - [x] 4.3 Remove `src/export-data.ts` script
    - Delete the file entirely
    - _Requirements: 7.3_

  - [x] 4.4 Remove `export-data` script from `package.json`
    - Delete the `"export-data": "tsx src/export-data.ts"` entry from scripts
    - _Requirements: 7.4_

  - [x] 4.5 Delete JSON data files
    - Remove `data/cats.json`, `data/shelters.json`, `data/strays.json`, `data/suggestions.json`
    - Remove `data/` directory if empty
    - _Requirements: 8.1, 8.2_

- [x] 5. Update test suite
  - [x] 5.1 Update `src/server.test.ts`
    - Use `createApp()` which now returns `{ app, db }` with in-memory DB
    - Seed test data via `db` reference before assertions
    - Verify security headers, input validation, CORS, health, domination still pass
    - _Requirements: 9.1, 9.2_

  - [x] 5.2 Update `src/server.endpoints.test.ts`
    - Seed shelters and cats into in-memory DB
    - Test all endpoint response shapes match API contract
    - _Requirements: 9.1, 9.3, 10.1, 10.2, 10.3, 10.4_

  - [x] 5.3 Update `src/server.integration.test.ts`
    - Seed data via DB, test shelter-cat relationships, stray CRUD, suggestion CRUD
    - _Requirements: 9.1, 9.2_

  - [x] 5.4 Update `src/server.property.test.ts`
    - Generate random shelter/cat data with `fast-check`, seed into in-memory DB
    - Test query correctness properties
    - _Requirements: 9.1, 9.2_

  - [x] 5.5 Update `src/activities.property.test.ts`
    - Remove tests for `exportDataActivity` and `atomicWriteJSON`
    - Keep or update tests for remaining activities
    - _Requirements: 9.2_

  - [x] 5.6 Remove `src/export.property.test.ts`
    - Delete the file (tests export pipeline that no longer exists)
    - _Requirements: 9.2_

  - [x] 5.7 Update `src/workflows.test.ts` and `src/workflows.property.test.ts`
    - Remove assertions about `exportDataActivity` being called
    - Verify `parentSyncWorkflow` completes without export step
    - _Requirements: 9.2_

- [x] 6. Checkpoint — full test suite passes
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Property-based tests for correctness
  - [x] 7.1 Write property test: shelter cat_count matches actual cat records
    - **Property 1: Shelter cat_count matches actual cat records**
    - **Validates: Requirements 3.1, 4.4**

  - [x] 7.2 Write property test: shelter cats endpoint returns only matching cats
    - **Property 2: Shelter cats endpoint returns only cats belonging to that shelter**
    - **Validates: Requirements 3.2**

  - [x] 7.3 Write property test: cat filtering preserves filter invariants
    - **Property 3: Cat filtering preserves filter invariants**
    - **Validates: Requirements 4.1, 4.5**

  - [x] 7.4 Write property test: stats counts consistent with DB
    - **Property 4: Stats counts are consistent with database contents**
    - **Validates: Requirements 4.4, 10.4**

  - [x] 7.5 Write property test: stray report round-trip preservation
    - **Property 5: Stray report round-trip preservation**
    - **Validates: Requirements 5.2, 5.3**

  - [x] 7.6 Write property test: stray deletion removes exactly targeted record
    - **Property 6: Stray deletion removes exactly the targeted record**
    - **Validates: Requirements 5.4**

  - [x] 7.7 Write property test: suggestion round-trip preservation
    - **Property 7: Suggestion round-trip preservation**
    - **Validates: Requirements 6.2, 6.3**

  - [x] 7.8 Write property test: suggestion deletion removes exactly targeted record
    - **Property 8: Suggestion deletion removes exactly the targeted record**
    - **Validates: Requirements 6.4**

  - [x] 7.9 Write property test: shelter response shape completeness
    - **Property 9: Shelter response shape completeness**
    - **Validates: Requirements 3.3, 10.1**

  - [x] 7.10 Write property test: cat response shape completeness
    - **Property 10: Cat response shape completeness**
    - **Validates: Requirements 10.2**

- [x] 8. Final checkpoint — all tests and property tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript with vitest, supertest, and fast-check
- `createApp()` with no argument creates an in-memory DB (`:memory:`) — tests seed data via the returned `db` reference
- The scraper (`scraper-v4.ts`, `scrape-all.ts`) writes to the DB directly and requires no changes

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "4.3", "4.4", "4.5"] },
    { "id": 2, "tasks": ["2.1", "4.1", "4.2"] },
    { "id": 3, "tasks": ["2.2", "2.3", "2.4", "2.5", "2.6"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3", "5.5", "5.6", "5.7"] },
    { "id": 5, "tasks": ["5.4"] },
    { "id": 6, "tasks": ["7.1", "7.2", "7.3", "7.4", "7.5", "7.6", "7.7", "7.8", "7.9", "7.10"] }
  ]
}
```
