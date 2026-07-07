# Architecture & How It Works

This document explains how the system is built, what technologies are used, and why.

---

## System Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│                        TEMPORAL.IO SERVER                          │
│  ┌─────────────────┐    ┌──────────────────────────────────┐     │
│  │ Parent Workflow  │───▶│ Child Workflow (per shelter)       │    │
│  │ - fetch shelters │    │ - scrape cats from website         │    │
│  │ - spawn children │    │ - save to database                 │    │
│  └─────────────────┘    │ - retry on failure (3x, exp backoff│    │
│                          └──────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
┌─────────────────┐          ┌──────────────────┐
│ Shelter Registry│          │ Shelter Websites  │
│ API (external)  │          │ (40+ sites)       │
└─────────────────┘          └──────────────────┘
         │                              │
         └──────────────┬───────────────┘
                        ▼
              ┌───────────────────┐
              │   SQLite Database  │
              │   (WAL mode)       │
              └────────┬──────────┘
                       │ read
                       ▼
              ┌───────────────────┐         ┌───────────────────┐
              │  Express.js API    │◀───────▶│  React Frontend    │
              │  (port 3001)       │  HTTP   │  (Vite + Tailwind) │
              │  + Security Headers│         │  + Leaflet Maps    │
              └───────────────────┘         └───────────────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Nginx Reverse     │
              │  Proxy (HTTPS)     │
              │  + SSL termination │
              └───────────────────┘
                       │
                       ▼
              ┌───────────────────┐
              │  Users (browsers)  │
              └───────────────────┘
```

---

## Technology Stack Explained

### Why Temporal.io? (Durable Execution)

Scraping 40+ websites is inherently unreliable — sites go down, connections time out, pages change structure. Traditional approaches (cron jobs, simple scripts) break silently and lose progress.

**Temporal.io** solves this by providing **durable execution**:
- If a scrape fails mid-way, Temporal retries just the failed step (not the whole pipeline)
- Progress is never lost — even if our server crashes, Temporal remembers where it was
- Each shelter is scraped in its own isolated workflow — one failure doesn't affect others
- Built-in exponential backoff prevents hammering failing sites
- Full observability — we can see which shelters succeeded and which failed

This is the same technology used by companies like Netflix, Uber, and Stripe for their critical workflows.

### Why SQLite?

- **Zero configuration** — no separate database server to install or manage
- **WAL mode** — allows reading while writing (no blocking)
- **Perfect for our scale** — handles thousands of records effortlessly
- **Single file** — easy to backup, move, or reset

### Why Express.js 5?

- Latest version with improved error handling and async support
- Mature ecosystem with battle-tested middleware (Helmet, CORS)
- Lightweight — serves both the API and the built frontend

### Why React + Vite + Tailwind?

- **React 18** — component-based UI with hooks for clean state management
- **Vite** — extremely fast build times and hot module replacement during development
- **TailwindCSS** — utility-first CSS that keeps styles consistent and maintainable
- **Leaflet** — the most popular open-source map library (free, no API key needed)

### Why Vitest + fast-check?

- **Vitest** — Vite-native test runner, fast and compatible with our build setup
- **fast-check** — property-based testing generates hundreds of test cases automatically, catching edge cases that manual tests miss

---

## Data Flow (Step by Step)

### 1. Data Collection

```
Admin triggers sync → Temporal parent workflow starts
  → Fetches shelter list from otwarteschroniska.org.pl API
  → For each shelter with a website:
     → Spawns child workflow
     → Child uses Cheerio to parse HTML
     → CSS selectors from scraper-config.json extract cat names, photos, descriptions
     → Saves results to SQLite
  → After all children complete:
     → Data is immediately available to API via SQLite
```

### 2. Serving Data

```
User opens mrucznik.serwerigora.com
  → Nginx terminates SSL, forwards to Express
  → Express reads directly from SQLite (persistent WAL-mode connection)
  → Returns data with security headers (CSP, HSTS, etc.)
  → React frontend renders the UI
```

### 3. User Interactions

```
User searches for "Mruczek" in Kraków
  → Frontend calls GET /api/cats?search=mruczek&voivodeship=malopolskie
  → Express sanitizes input, filters data, returns paginated results
  → Frontend renders cat cards with photos and links

User reports a stray cat
  → Frontend sends POST /api/report-stray with description + GPS
  → Express validates, rate-checks, geocodes if needed
  → Saves to SQLite database
  → Cat appears on the map for other users
```

---

## Project Structure

```
CatHackathon/
├── src/                    # Backend source (TypeScript)
│   ├── server.ts           # Express API server (main entry point)
│   ├── workflows.ts        # Temporal workflow definitions
│   ├── activities.ts       # Temporal activity implementations (scraping logic)
│   ├── worker.ts           # Temporal worker process
│   ├── db.ts               # SQLite database schema and queries
│   ├── validation.ts       # Input sanitization utilities
│   ├── achievements.ts     # Achievement badge computation
│   ├── domination.ts       # Domination level calculation
│   ├── geocoding.ts        # City → GPS coordinate mapping
│   └── *.test.ts           # Backend tests
│
├── frontend/               # Frontend source
│   ├── src/
│   │   ├── App.tsx         # Main app with routing
│   │   ├── components/     # React components (MapView, CatSearch, etc.)
│   │   ├── hooks/          # Custom React hooks
│   │   ├── i18n.tsx        # Internationalization (PL/EN)
│   │   └── api.ts          # API client with timeout handling
│   └── dist/               # Production build output
│
├── scraper-config.json     # Per-shelter CSS selectors for scraping
├── shelter-sync.db         # SQLite database file
│
├── .github/workflows/      # CI/CD pipelines
│   ├── ci.yml              # Test + build on every push/PR
│   └── deploy.yml          # Auto-deploy to Raspberry Pi on main
│
├── docs/                   # This documentation
├── SECURITY.md             # Security documentation
├── DEPLOY.md               # Deployment guide
└── README.md               # Project overview
```

---

## Deployment Architecture

```
GitHub (push to main)
  → GitHub Actions (CI: test + build)
  → SSH deploy to Raspberry Pi
     → git pull + npm install + frontend build
     → PM2 restarts Express server
     → Nginx reverse proxy serves HTTPS

Temporal Server (running on the Pi)
  → Worker process listens for sync tasks
  → Scraping runs independently from the web server
```

The entire application runs on a single **Raspberry Pi** — demonstrating that the architecture is lightweight and resource-efficient despite using enterprise-grade tools like Temporal.

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | /api/cats | Search and list cats (paginated) | No |
| GET | /api/shelters | List all shelters with coordinates | No |
| GET | /api/shelters/:id/cats | Cats for a specific shelter | No |
| GET | /api/stats | Platform statistics | No |
| GET | /api/cat-of-the-day | Featured cat | No |
| GET | /api/random-cat | Random cat | No |
| GET | /api/strays | Stray cat reports | No |
| GET | /api/lost-cats | Lost cat reports | No |
| GET | /api/health | Server health check | No |
| POST | /api/report-stray | Submit stray report | No (rate-limited) |
| POST | /api/report-lost-cat | Report a lost cat | No (rate-limited) |
| POST | /api/suggest-shelter | Suggest a shelter | No |
| POST | /api/admin/login | Admin authentication | No |
| POST | /api/admin/sync | Trigger Temporal sync | Bearer token |
| GET | /api/admin/sync/status | Check sync status | Bearer token |
| GET | /api/admin/suggestions | List suggestions | Bearer token |
| DELETE | /api/admin/suggestions/:i | Delete suggestion | Bearer token |
| DELETE | /api/admin/strays/:id | Delete stray report | Bearer token |
