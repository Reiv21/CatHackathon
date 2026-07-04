# Implementation Plan: Shelter Sync with Cat Scraper

## Overview

This plan implements a Temporal.io-based backend in TypeScript that synchronizes animal shelter data from otwarteschroniska.org.pl into SQLite, then orchestrates cheerio-based web scraping of cat listings. Tasks are ordered by dependency: project setup → database layer → API client → activities → workflows → worker/client entry points.

## Tasks

- [x] 1. Set up project structure and dependencies
  - Initialize a new TypeScript project with `package.json` and `tsconfig.json`
  - Install dependencies: `@temporalio/client`, `@temporalio/worker`, `@temporalio/workflow`, `@temporalio/activity`, `better-sqlite3`, `cheerio`, `fast-check`, `vitest`, `typescript`, `tsx`
  - Install type definitions: `@types/better-sqlite3`
  - Create `src/` directory with placeholder files: `db.ts`, `shelterApi.ts`, `activities.ts`, `workflows.ts`, `worker.ts`, `client.ts`
  - Add scripts to package.json: `build`, `worker`, `client`, `test`
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [x] 2. Implement database layer (db.ts)
  - [x] 2.1 Implement initializeDatabase function
    - Create or open SQLite database at specified path using better-sqlite3
    - Enable WAL mode and foreign keys pragma
    - Create `shelters` table with schema: id_zewnetrzne INTEGER PRIMARY KEY, name TEXT NOT NULL, website_url TEXT, city TEXT NOT NULL, voivodeship TEXT NOT NULL, updated_at TEXT DEFAULT (datetime('now'))
    - Create `cats` table with schema: id INTEGER PRIMARY KEY AUTOINCREMENT, shelter_id INTEGER NOT NULL, name TEXT NOT NULL, description TEXT DEFAULT '', image_url TEXT, scraped_at TEXT DEFAULT (datetime('now')), FOREIGN KEY (shelter_id) REFERENCES shelters(id_zewnetrzne)
    - Create index idx_cats_shelter on cats(shelter_id)
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 2.2 Implement upsertShelters function
    - Use INSERT OR REPLACE (or INSERT ... ON CONFLICT DO UPDATE) to upsert shelter records by id_zewnetrzne
    - Refresh updated_at to current datetime on each upsert
    - Wrap in a transaction for atomicity
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [x] 2.3 Implement saveCats function
    - Delete all existing cats for the given shelter_id
    - Insert all provided cat records with the shelter_id
    - Wrap in a transaction for atomicity
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [x] 2.4 Implement getSheltersWithWebsite function
    - Query shelters where website_url IS NOT NULL AND website_url != ''
    - Return typed Shelter objects with all fields mapped
    - _Requirements: 4.1, 4.2_

  - [x] 2.5 Write property tests for database layer
    - **Property 1: Upsert completeness** — generate random Shelter arrays, upsert, verify all exist with correct fields
    - **Property 2: Upsert idempotence** — upsert same data twice, verify identical DB state
    - **Property 3: Website filter correctness** — generate shelters with/without URLs, verify filter returns only those with URLs
    - **Property 4: Cat save replacement semantics** — save cats twice for same shelter, verify only latest set exists with correct count
    - **Validates: Requirements 3.1, 3.2, 3.4, 3.5, 4.1, 4.2, 6.1, 6.2, 6.3, 6.4**

- [x] 3. Implement shelter API client (shelterApi.ts)
  - [x] 3.1 Implement fetchSheltersFromApi function
    - Send HTTP GET request to otwarteschroniska.org.pl API endpoint
    - Parse JSON response into ApiShelter[] (fields: id, nazwa, miasto, województwo, strona_www)
    - Throw descriptive error on non-200 status (include HTTP status code in message)
    - Throw descriptive error on network timeout
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [x] 3.2 Write property test for API response parsing
    - **Property 6: API response parsing correctness** — generate random valid JSON shelter responses, verify field mapping (nazwa→name, miasto→city, województwo→voivodeship, strona_www→website_url)
    - **Validates: Requirements 2.2, 12.2**

- [x] 4. Checkpoint - Database and API layers
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement activities (activities.ts)
  - [x] 5.1 Implement fetchAndSaveSheltersActivity
    - Call fetchSheltersFromApi() to get shelter data
    - Map ApiShelter fields to Shelter interface (nazwa→name, miasto→city, województwo→voivodeship, strona_www→website_url)
    - Call upsertShelters() with mapped data
    - Call getSheltersWithWebsite() and return array of {id, url} pairs
    - _Requirements: 7.1, 3.1, 3.2, 12.2_

  - [x] 5.2 Implement scrapeCatsActivity
    - Fetch HTML from the provided URL using fetch/node-fetch
    - Parse HTML with cheerio, extract cat elements (name, description, image_url)
    - Return Cat[] where each cat has non-empty name
    - On fetch failure or parsing failure, return empty array (graceful degradation)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 5.3 Implement saveCatsActivity
    - Call saveCats() from db.ts with provided shelterId and cats array
    - _Requirements: 6.1, 6.2, 6.3_

  - [x] 5.4 Write property test for scraper output validity
    - **Property 5: Scraper output validity** — generate HTML fixtures with cat elements, verify extraction produces Cat objects with non-empty names
    - **Validates: Requirements 5.2, 5.3**

- [x] 6. Implement workflows (workflows.ts)
  - [x] 6.1 Implement parentSyncWorkflow
    - Import activities with proxyActivities and configure retry policy (max 3 attempts, exponential backoff)
    - Call fetchAndSaveSheltersActivity() as first step
    - For each shelter with a website, start a catScraperWorkflow child workflow using executeChild
    - Await all child workflows before completing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 11.1_

  - [x] 6.2 Implement catScraperWorkflow
    - Accept url and shelterId as parameters
    - Import activities with proxyActivities and configure retry policy (max 3 attempts, exponential backoff)
    - Call scrapeCatsActivity(url, shelterId) to get cat data
    - Call saveCatsActivity(shelterId, cats) regardless of whether array is empty
    - _Requirements: 8.1, 8.2, 8.3, 11.2_

- [x] 7. Implement worker entry point (worker.ts)
  - Create Temporal connection to configured server address (default localhost:7233)
  - Create Worker with workflowsPath pointing to workflows.ts, activities imported, taskQueue "shelter-sync"
  - Call worker.run() to start listening
  - Handle connection errors with descriptive messages
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

- [x] 8. Implement client entry point (client.ts)
  - Create Temporal connection to configured server address
  - Start parentSyncWorkflow with unique workflowId (e.g., "shelter-sync-" + timestamp)
  - Log workflow ID to console after starting
  - Await workflow result and log completion
  - Handle connection errors: log error and exit with non-zero code
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [x] 9. Checkpoint - Full integration
  - Ensure all tests pass, ask the user if questions arise.
  - Verify worker and client can be compiled without errors (npx tsc --noEmit)

- [x] 10. Write integration tests for workflow orchestration
  - Test parentSyncWorkflow calls fetchAndSaveSheltersActivity first, then fans out child workflows
  - Test catScraperWorkflow calls scrapeCatsActivity then saveCatsActivity in order
  - Test graceful handling when scrapeCatsActivity returns empty array
  - Use Temporal test utilities or mocked activities
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3_

- [x] 11. Final checkpoint
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `npx tsc --noEmit` succeeds with zero errors

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The project uses TypeScript throughout with vitest as test runner and fast-check for property-based testing
- Temporal workflows must import activities via proxyActivities (not direct imports) to maintain determinism
