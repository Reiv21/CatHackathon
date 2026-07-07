# Design Document

## Overview

This design refactors the Express server to read all data directly from SQLite via a persistent `better-sqlite3` connection instead of reading from JSON files. The database schema is enriched with new columns and tables, the export pipeline is removed, and all API endpoints are rewritten to use SQL queries while preserving identical response shapes for the frontend.

## Architecture

### Current State
```
[Temporal Worker] → scrape → [SQLite DB] → exportDataActivity → [JSON files] → [Express Server] → [Frontend]
```

### Target State
```
[Temporal Worker] → scrape → [SQLite DB] ← [Express Server] → [Frontend]
```

The Express server holds a single persistent `Database` instance (from `better-sqlite3`) opened at startup and closed on graceful shutdown. All API handlers query this connection directly. WAL mode allows concurrent reads during Temporal worker writes.

## Components and Interfaces

### 1. Database Layer (`src/db.ts`)

The existing `initializeDatabase` function is extended:

- **New columns on `cats` table**: `source_url TEXT`, `sex TEXT`, `age TEXT`
- **New table `stray_reports`**: stores user-submitted stray cat reports
- **New table `suggestions`**: stores shelter suggestion submissions
- **New indexes**: `idx_stray_reports_city` on `stray_reports(city)`, `idx_suggestions_city` on `suggestions(city)`

```typescript
// Extended Cat interface
export interface Cat {
  id?: number;
  shelter_id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url?: string | null;
  sex?: string | null;
  age?: string | null;
}

export interface StrayReport {
  id?: number;
  description: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  city: string;
  reported_at: string;
}

export interface Suggestion {
  id?: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  submitter_email: string | null;
  submitted_at: string;
}
```

Schema DDL additions:

```sql
-- Extend cats table
ALTER TABLE cats ADD COLUMN source_url TEXT;
ALTER TABLE cats ADD COLUMN sex TEXT;
ALTER TABLE cats ADD COLUMN age TEXT;

-- New tables
CREATE TABLE IF NOT EXISTS stray_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  latitude REAL NOT NULL DEFAULT 0,
  longitude REAL NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  voivodeship TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  submitter_email TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Since `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is not supported in SQLite, the migration checks `pragma_table_info` before adding columns.

### 2. Server (`src/server.ts`)

The `createApp(dbPath?)` function is modified:

- Opens a persistent `Database` connection via `initializeDatabase(dbPath)` at creation time
- Removes all `loadShelters()` / `loadCats()` functions and `DATA_DIR` references
- All route handlers use prepared statements on the persistent DB instance
- Returns `{ app, db }` so tests can access and close the DB
- On graceful shutdown, `db.close()` is called

### 3. Query Module (`src/queries.ts` — new file)

Encapsulates all prepared statements for reuse and testability:

```typescript
import type Database from "better-sqlite3";

export function createQueries(db: Database.Database) {
  return {
    getAllShelters: db.prepare(`
      SELECT s.id_zewnetrzne, s.name, s.city, s.voivodeship, s.website_url,
             COUNT(c.id) AS cat_count
      FROM shelters s
      LEFT JOIN cats c ON c.shelter_id = s.id_zewnetrzne
      GROUP BY s.id_zewnetrzne
      ORDER BY s.city
    `),

    getCatsByShelter: db.prepare(`
      SELECT c.id, c.name, c.description, c.image_url, c.source_url,
             c.sex, c.age, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      WHERE c.shelter_id = ?
      ORDER BY c.name
    `),

    getCatsWithImages: db.prepare(`
      SELECT c.id, c.name, c.description, c.image_url, c.source_url,
             c.sex, c.age, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city,
             s.website_url AS shelter_url, s.voivodeship AS shelter_voivodeship
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      WHERE c.image_url IS NOT NULL AND c.image_url != ''
    `),

    countCats: db.prepare(`SELECT COUNT(*) AS count FROM cats`),
    countShelters: db.prepare(`SELECT COUNT(*) AS count FROM shelters`),
    countSheltersWithCats: db.prepare(`
      SELECT COUNT(DISTINCT shelter_id) AS count FROM cats
    `),

    insertStrayReport: db.prepare(`
      INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
      VALUES (@description, @image_url, @latitude, @longitude, @city, @reported_at)
    `),

    getAllStrays: db.prepare(`SELECT * FROM stray_reports ORDER BY reported_at DESC`),
    deleteStray: db.prepare(`DELETE FROM stray_reports WHERE id = ?`),

    insertSuggestion: db.prepare(`
      INSERT INTO suggestions (name, city, voivodeship, website_url, submitter_email, submitted_at)
      VALUES (@name, @city, @voivodeship, @website_url, @submitter_email, @submitted_at)
    `),

    getAllSuggestions: db.prepare(`SELECT * FROM suggestions ORDER BY submitted_at DESC`),
    deleteSuggestion: db.prepare(`DELETE FROM suggestions WHERE id = ?`),
  };
}
```

### 4. Workflow Change (`src/workflows.ts`)

Remove the final `exportDataActivity` call from `parentSyncWorkflow`:

```typescript
export async function parentSyncWorkflow(): Promise<void> {
  const shelters = await fetchActivities.fetchAndSaveSheltersActivity();
  const childWorkflows = shelters.map((shelter) =>
    executeChild(catScraperWorkflow, {
      args: [shelter.url, shelter.id],
      workflowId: `cat-scraper-${shelter.id}-${Date.now()}`,
      taskQueue: "shelter-sync",
    })
  );
  await Promise.all(childWorkflows);
  // exportDataActivity removed — server reads directly from SQLite
}
```

### 5. Removals

- `src/export-data.ts` — deleted
- `exportDataActivity` function in `src/activities.ts` — removed along with `atomicWriteJSON`
- `data/cats.json`, `data/shelters.json`, `data/strays.json`, `data/suggestions.json` — deleted
- `"export-data"` script in `package.json` — removed
- `loadShelters()` / `loadCats()` helper functions in `server.ts` — removed
- `DATA_DIR` constant and all `fs.readFileSync`/`writeFileSync` data file access in `server.ts` — removed

### API Response Shapes (unchanged)

**GET /api/shelters** → `Array<ShelterResponse>`
```typescript
interface ShelterResponse {
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  cat_count: number;
  latitude: number | null;
  longitude: number | null;
}
```

**GET /api/cats** → `{ cats: CatResponse[], pagination: Pagination }`
```typescript
interface CatResponse {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
  sex: string | null;
  age: string | null;
  shelter_url: string | null;
  shelter_voivodeship: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}
```

**GET /api/strays** → `Array<StrayResponse>`
```typescript
interface StrayResponse {
  id: number;
  description: string;
  image_url: string | null;
  latitude: number;
  longitude: number;
  city: string;
  reported_at: string;
}
```

**GET /api/stats** → `StatsResponse`
```typescript
interface StatsResponse {
  totalCats: number;
  totalShelters: number;
  sheltersWithCats: number;
  lastFetched: string | null;
}
```

**GET /api/admin/suggestions** → `Array<SuggestionResponse>`
```typescript
interface SuggestionResponse {
  id: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  submitter_email: string | null;
  submitted_at: string;
}
```

## Data Models

### SQLite Schema (complete after migration)

```sql
CREATE TABLE shelters (
  id_zewnetrzne INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  website_url TEXT,
  city TEXT NOT NULL,
  voivodeship TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE cats (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  shelter_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT,
  source_url TEXT,
  sex TEXT,
  age TEXT,
  scraped_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (shelter_id) REFERENCES shelters(id_zewnetrzne)
);

CREATE TABLE stray_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  latitude REAL NOT NULL DEFAULT 0,
  longitude REAL NOT NULL DEFAULT 0,
  city TEXT NOT NULL DEFAULT '',
  reported_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  voivodeship TEXT NOT NULL DEFAULT '',
  website_url TEXT,
  submitter_email TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_cats_shelter ON cats(shelter_id);
CREATE INDEX IF NOT EXISTS idx_stray_reports_city ON stray_reports(city);
CREATE INDEX IF NOT EXISTS idx_suggestions_city ON suggestions(city);
```

## Error Handling

- If the database file is missing or corrupted at startup, `initializeDatabase` throws immediately — the server does not start in a degraded state.
- SQL query errors in route handlers are caught by the existing Express error middleware and return 503.
- The `/api/health` endpoint checks `db.open` instead of filesystem access to `DATA_DIR`.
- `saveCats` transaction failure rolls back automatically (existing `better-sqlite3` behavior).

## Performance Considerations

- WAL mode allows concurrent reads from the Express server while the Temporal worker writes.
- Prepared statements are created once at startup via `createQueries(db)` and reused across requests.
- Cat search with filters uses SQL `WHERE` clauses and `LIKE` instead of loading all records into memory.
- Pagination is handled with `LIMIT`/`OFFSET` at the SQL level for the `/api/cats` endpoint.

## Testing Strategy

- `createApp()` with no argument creates an in-memory DB (`:memory:`) — same as current behavior.
- Tests seed data via the `db` reference returned by `createApp()`.
- Supertest is used for HTTP-level integration tests.
- Property-based tests use `fast-check` to generate random shelter/cat data and verify query correctness.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Shelter cat_count matches actual cat records

*For any* set of shelters and cats inserted into the database, the `cat_count` field returned by `GET /api/shelters` for each shelter SHALL equal the number of cat records in the `cats` table with that shelter's `id_zewnetrzne` as their `shelter_id`.

**Validates: Requirements 3.1, 4.4**

### Property 2: Shelter cats endpoint returns only cats belonging to that shelter

*For any* shelter ID and set of cats in the database, `GET /api/shelters/:id/cats` SHALL return only cat records where `shelter_id` equals the requested ID, and SHALL return all such records.

**Validates: Requirements 3.2**

### Property 3: Cat filtering preserves filter invariants

*For any* combination of search query, voivodeship filter, and sex filter applied to `GET /api/cats`, every cat in the response SHALL match all active filter criteria: the cat's name, shelter_name, or shelter_city contains the search string; the cat's shelter_voivodeship matches the voivodeship filter; and the cat's sex matches the sex filter.

**Validates: Requirements 4.1, 4.5**

### Property 4: Stats counts are consistent with database contents

*For any* set of shelters and cats in the database, `GET /api/stats` SHALL return `totalCats` equal to the total number of cat records, `totalShelters` equal to the total number of shelter records, and `sheltersWithCats` equal to the number of distinct `shelter_id` values in the cats table.

**Validates: Requirements 4.4, 10.4**

### Property 5: Stray report round-trip preservation

*For any* valid stray report submitted via `POST /api/report-stray`, the report SHALL appear in the response of `GET /api/strays` with matching `description`, `latitude`, `longitude`, and `city` values.

**Validates: Requirements 5.2, 5.3**

### Property 6: Stray deletion removes exactly the targeted record

*For any* stray report that exists in the database, calling `DELETE /api/admin/strays/:id` SHALL remove that report from subsequent `GET /api/strays` responses, and SHALL not affect any other reports.

**Validates: Requirements 5.4**

### Property 7: Suggestion round-trip preservation

*For any* valid shelter suggestion submitted via `POST /api/suggest-shelter`, the suggestion SHALL appear in the response of `GET /api/admin/suggestions` with matching `name`, `city`, and `voivodeship` values.

**Validates: Requirements 6.2, 6.3**

### Property 8: Suggestion deletion removes exactly the targeted record

*For any* suggestion that exists in the database, calling `DELETE /api/admin/suggestions/:id` SHALL remove that suggestion from subsequent `GET /api/admin/suggestions` responses, and SHALL not affect any other suggestions.

**Validates: Requirements 6.4**

### Property 9: Shelter response shape completeness

*For any* shelter record in the database, the corresponding object in the `GET /api/shelters` response SHALL contain all required fields: `id_zewnetrzne`, `name`, `city`, `voivodeship`, `website_url`, `cat_count`, `latitude`, and `longitude`.

**Validates: Requirements 3.3, 10.1**

### Property 10: Cat response shape completeness

*For any* cat record returned by `GET /api/cats`, the object SHALL contain all required fields: `id`, `name`, `description`, `image_url`, `source_url`, `shelter_id`, `shelter_name`, `shelter_city`, `sex`, `age`, `shelter_url`, and `shelter_voivodeship`.

**Validates: Requirements 10.2**
