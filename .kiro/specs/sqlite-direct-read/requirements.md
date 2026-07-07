# Requirements Document

## Introduction

Refactor the Express server to read data directly from SQLite using a persistent database connection instead of reading from JSON files. This eliminates the intermediate export step, enriches the cats table schema with additional columns, and introduces new SQLite tables for stray reports and shelter suggestions.

## Glossary

- **Server**: The Express HTTP server defined in `server.ts` that serves API endpoints
- **Database**: The SQLite database managed by `better-sqlite3`, accessed via a persistent connection
- **Persistent_Connection**: A single SQLite database connection opened at server startup and reused across all requests
- **Cats_Table**: The `cats` SQLite table storing scraped cat data
- **Shelters_Table**: The `shelters` SQLite table storing shelter information
- **Stray_Reports_Table**: A new SQLite table storing user-submitted stray cat reports (replacing `data/strays.json`)
- **Suggestions_Table**: A new SQLite table storing user-submitted shelter suggestions (replacing `data/suggestions.json`)
- **Export_Data_Activity**: The `exportDataActivity` function and corresponding `export-data.ts` script that exports SQLite data to JSON files
- **JSON_Data_Files**: The files `data/cats.json`, `data/shelters.json`, `data/strays.json`, and `data/suggestions.json`

## Requirements

### Requirement 1: Persistent Database Connection

**User Story:** As a developer, I want the server to open a single SQLite connection at startup and reuse it for all requests, so that query performance improves and WAL mode benefits are realized.

#### Acceptance Criteria

1. WHEN the Server starts, THE Persistent_Connection SHALL open a SQLite connection using WAL journal mode and reuse the connection for all subsequent requests.
2. WHEN `createApp(dbPath?)` is called, THE Server SHALL accept an optional database path parameter and use the Persistent_Connection for all data queries within that application instance.
3. WHEN the Server shuts down, THE Persistent_Connection SHALL close the SQLite connection to release file handles.

### Requirement 2: Schema Enrichment for Cats Table

**User Story:** As a developer, I want the cats table to include `source_url`, `sex`, and `age` columns, so that cat records store richer data without requiring a separate export transformation.

#### Acceptance Criteria

1. WHEN the Database is initialized, THE Cats_Table SHALL include `source_url` (TEXT, nullable), `sex` (TEXT, nullable), and `age` (TEXT, nullable) columns.
2. THE Cats_Table SHALL retain all existing columns (`id`, `shelter_id`, `name`, `description`, `image_url`, `scraped_at`) alongside the new columns.

### Requirement 3: Direct SQLite Reads for Shelter Endpoints

**User Story:** As a developer, I want API endpoints to query shelters directly from SQLite, so that the data is always current without needing an export step.

#### Acceptance Criteria

1. WHEN the `/api/shelters` endpoint is called, THE Server SHALL query the Shelters_Table directly using the Persistent_Connection and return shelter records with cat counts computed via a JOIN on the Cats_Table.
2. WHEN the `/api/shelters/:id/cats` endpoint is called, THE Server SHALL query the Cats_Table directly using the Persistent_Connection filtered by shelter ID, and JOIN with the Shelters_Table for `shelter_name` and `shelter_city`.
3. THE Server SHALL return API responses with identical JSON shapes as the current implementation (no breaking frontend changes).

### Requirement 4: Direct SQLite Reads for Cat Endpoints

**User Story:** As a developer, I want cat listing, search, cat-of-the-day, and random-cat endpoints to read from SQLite directly, so that stale JSON data is no longer served.

#### Acceptance Criteria

1. WHEN the `/api/cats` endpoint is called, THE Server SHALL query the Cats_Table using the Persistent_Connection with JOINs on the Shelters_Table for `shelter_name`, `shelter_city`, and `shelter_voivodeship`.
2. WHEN the `/api/cat-of-the-day` endpoint is called, THE Server SHALL query cats with images directly from the Cats_Table using the Persistent_Connection.
3. WHEN the `/api/random-cat` endpoint is called, THE Server SHALL query cats with images directly from the Cats_Table using the Persistent_Connection.
4. WHEN the `/api/stats` endpoint is called, THE Server SHALL compute statistics (total cats, total shelters, shelters with cats) using COUNT queries on the Database.
5. THE Server SHALL preserve the existing pagination, filtering (search, voivodeship, sex), and sorting behavior for the `/api/cats` endpoint.

### Requirement 5: Stray Reports Table in SQLite

**User Story:** As a developer, I want stray cat reports stored in SQLite instead of a JSON file, so that concurrent writes are safe and data is co-located with other application data.

#### Acceptance Criteria

1. WHEN the Database is initialized, THE Database SHALL create a `stray_reports` table with columns for `id` (INTEGER PRIMARY KEY), `description` (TEXT), `image_url` (TEXT, nullable), `latitude` (REAL), `longitude` (REAL), `city` (TEXT), and `reported_at` (TEXT).
2. WHEN the `/api/report-stray` endpoint receives a valid report, THE Server SHALL insert the report into the Stray_Reports_Table using the Persistent_Connection.
3. WHEN the `/api/strays` endpoint is called, THE Server SHALL query all records from the Stray_Reports_Table using the Persistent_Connection.
4. WHEN the `/api/admin/strays/:id` DELETE endpoint is called, THE Server SHALL delete the report with the matching ID from the Stray_Reports_Table using the Persistent_Connection.

### Requirement 6: Suggestions Table in SQLite

**User Story:** As a developer, I want shelter suggestions stored in SQLite instead of a JSON file, so that data integrity is maintained and queries are consistent with other tables.

#### Acceptance Criteria

1. WHEN the Database is initialized, THE Database SHALL create a `suggestions` table with columns for `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `name` (TEXT NOT NULL), `city` (TEXT NOT NULL), `voivodeship` (TEXT), `website_url` (TEXT, nullable), `submitter_email` (TEXT, nullable), and `submitted_at` (TEXT).
2. WHEN the `/api/suggest-shelter` endpoint receives a valid suggestion, THE Server SHALL insert the suggestion into the Suggestions_Table using the Persistent_Connection.
3. WHEN the `/api/admin/suggestions` endpoint is called, THE Server SHALL query all records from the Suggestions_Table using the Persistent_Connection.
4. WHEN the `/api/admin/suggestions/:id` DELETE endpoint is called, THE Server SHALL delete the suggestion with the matching ID from the Suggestions_Table using the Persistent_Connection.

### Requirement 7: Remove Export Data Pipeline

**User Story:** As a developer, I want to remove the export-data activity and script, so that the codebase has no dead code relying on the obsolete JSON export pattern.

#### Acceptance Criteria

1. THE Server SHALL operate without the `exportDataActivity` function in `activities.ts`.
2. THE `parentSyncWorkflow` in `workflows.ts` SHALL complete without calling `exportDataActivity`.
3. THE `export-data.ts` script SHALL be removed from the codebase.
4. THE `npm run export-data` script entry in `package.json` SHALL be removed.

### Requirement 8: Remove JSON Data Files

**User Story:** As a developer, I want to remove the JSON data files that are no longer read by the server, so that the repository does not contain stale data artifacts.

#### Acceptance Criteria

1. THE Server SHALL not read from `data/cats.json`, `data/shelters.json`, `data/strays.json`, or `data/suggestions.json`.
2. THE JSON_Data_Files SHALL be removed from the repository.

### Requirement 9: Test Compatibility

**User Story:** As a developer, I want all test files updated to work with SQLite directly, so that the test suite validates the new data access pattern.

#### Acceptance Criteria

1. WHEN test files reference data loading, THE test files SHALL use an in-memory SQLite database (or a test-specific database path) instead of JSON file mocks.
2. THE test suite SHALL pass with the refactored data access layer.
3. THE test files SHALL validate that API response shapes remain unchanged after the refactoring.

### Requirement 10: API Response Shape Preservation

**User Story:** As a frontend developer, I want all API response formats to remain identical after the refactoring, so that no frontend changes are required.

#### Acceptance Criteria

1. THE Server SHALL return shelter records from `/api/shelters` containing `id_zewnetrzne`, `name`, `city`, `voivodeship`, `website_url`, `cat_count`, `latitude`, and `longitude` fields.
2. THE Server SHALL return cat records from `/api/cats` containing `id`, `name`, `description`, `image_url`, `source_url`, `shelter_id`, `shelter_name`, `shelter_city`, `sex`, `age`, `shelter_url`, and `shelter_voivodeship` fields.
3. THE Server SHALL return stray reports from `/api/strays` containing `id`, `description`, `image_url`, `latitude`, `longitude`, `city`, and `reported_at` fields.
4. THE Server SHALL return the `/api/stats` response containing `totalCats`, `totalShelters`, `sheltersWithCats`, and `lastFetched` fields.
