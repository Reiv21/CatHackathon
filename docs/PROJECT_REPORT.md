# #hackthekitty 2026 — Project Report

**Project Name:** Mrucznik  
**Reference ID:** HDS5F9Q8

---

## 1. Executive Summary

Mrucznik is a cat adoption and rescue platform that aggregates data from 94 animal shelters across Poland into one searchable, map-based portal. Users can browse adoptable cats, find their nearest shelter via GPS, report stray or lost cats for the community to help locate, and read adoption guides — all in a responsive, bilingual (Polish/English) web app with dark mode.

---

## 2. Project Overview

### 2a. Why we're building this

Poland has nearly 200 animal shelters, each with their own website (or none at all). There is no unified platform where potential adopters can search across all shelters at once. This means cats sit waiting longer because people simply don't know they exist. Mrucznik solves this by scraping shelter websites and presenting all available cats in one place — searchable, filterable, and displayed on an interactive map.

### 2b. How it relates to the theme

The hackathon theme is "For the Cats — Adoption platforms, lost cat finders, health trackers, feeding schedulers, or anything that makes a cat's life cushier." Mrucznik directly addresses this:
- **Adoption platform** — browse cats from 94 shelters with search, filters, and "Cat of the Day"
- **Lost cat finder** — report missing cats with photos, shown as map pins so the community can help
- **Stray cat reporting** — mark homeless cats on the map to help rescue organizations find them

### 2c. Target Audience

- People in Poland looking to adopt a cat (primary)
- Cat owners who lost their pet and need community help finding them
- Community members who spot stray/neglected cats and want to report them
- First-time cat owners looking for adoption guidance

---

## 3. Key Features

1. **Cat Search with Filters** — search by name, city, or shelter; filter by region (voivodeship), sex; sort by name or city; paginated results (24 per page)
2. **Interactive Shelter Map** — Leaflet map of Poland showing all 94 shelters as pins; click to see available cats; "Find Nearest Shelter" using GPS
3. **Lost Cat Finder** — report a missing cat with photo upload (stored as base64), description, and last seen location; appears as yellow pin on the map
4. **Stray Cat Reporting** — report homeless cats with location; appears as red pin on the map; rate-limited to prevent spam
5. **Cat of the Day** — daily featured cat with photo lightbox, deterministic selection (same cat for everyone each day)
6. **"Surprise Me"** — random cat button with bounce animation and lightbox
7. **Adoption Guides** — 6 comprehensive guides for first-time cat owners (PL/EN)
8. **Dark Mode** — full dark theme with toggle, persisted in localStorage
9. **Bilingual (PL/EN)** — complete internationalization of all UI text
10. **Responsive Design** — works on mobile, tablet, and desktop with 44px touch targets

---

## 4. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TailwindCSS, Leaflet + react-leaflet |
| Backend | Express.js 5, TypeScript, Helmet (security headers), CORS |
| Database | SQLite (better-sqlite3, WAL mode, persistent connection) |
| Scraping | Cheerio, config-driven per-site CSS selectors |
| Orchestration | Temporal.io (durable execution, retries, fault isolation) |
| Testing | Vitest, fast-check (property-based testing), supertest |
| CI/CD | GitHub Actions (test + build on push), auto-deploy to Raspberry Pi |
| Security | Aikido security scanner, Helmet CSP/HSTS/nosniff |
| Infrastructure | Raspberry Pi, Nginx reverse proxy, Cloudflare tunnel |

---

## 5. Technical Architecture

```
[Shelter Websites (40+)] → [Cheerio Scraper (config-driven)]
                                    ↓
                          [Temporal.io Orchestration]
                          (parent/child workflows, retry, backoff)
                                    ↓
                          [SQLite Database (WAL mode)]
                                    ↓
                          [Express.js API Server]
                          (persistent DB connection, prepared statements)
                                    ↓
                          [React Frontend (Vite + Tailwind)]
                                    ↓
                          [Nginx → Cloudflare Tunnel → Users]
```

**Data Flow:**
1. Scraper reads `scraper-config.json` with per-site CSS selectors for each shelter
2. Temporal parent workflow spawns a child workflow per shelter — each scrapes independently with 3x retry and exponential backoff
3. Scraped data is saved to SQLite with foreign key relationships (shelters → cats)
4. Express server holds a persistent SQLite connection in WAL mode — all API endpoints use prepared SQL statements
5. React frontend fetches data via REST API and renders interactive UI with map, search, and forms

---

## 6. Testing Matrix

| Feature / Flow | Steps | Expected Result | Actual Result | Pass/Fail |
|---|---|---|---|---|
| Cat search | Type "Mruczek" in search | Shows cats matching name | Matching cats displayed | ✅ Pass |
| Voivodeship filter | Select "mazowieckie" | Only cats from that region | Correct filtering | ✅ Pass |
| Sex filter | Select "female" | Only female cats | Shows only "samica" | ✅ Pass |
| Pagination | Navigate to page 2 | Next 24 cats shown | Correct offset | ✅ Pass |
| Shelter map | Click a shelter pin | Sidebar shows shelter's cats | Correct cats listed | ✅ Pass |
| Find nearest shelter | Click "Use my location" | Shows 5 closest shelters | Sorted by distance | ✅ Pass |
| Report stray cat | Submit form with city | Report appears in /api/strays | Saved to DB | ✅ Pass |
| Report lost cat | Submit with photo | Report with base64 image saved | Appears on map | ✅ Pass |
| Cat of the Day | Load homepage | Featured cat with image | Deterministic per date | ✅ Pass |
| Dark mode | Click 🌙 toggle | UI switches to dark theme | All elements readable | ✅ Pass |
| Language switch | Click PL/EN toggle | All text changes language | Persists in localStorage | ✅ Pass |
| Admin login | Enter correct password | Token issued | Bearer token returned | ✅ Pass |
| Rate limiting | Submit 4th stray report | Rejected with 429 | "Max 3 per day" | ✅ Pass |
| Health check | GET /api/health | Returns status: ok | DB open confirmed | ✅ Pass |
| Property tests | Run `npm test` | All 48+ tests pass | 48 passed | ✅ Pass |

---

## 8. Future Improvements

- **Adoption Matcher Quiz** — 5-question personality quiz that matches users to compatible cats based on lifestyle preferences
- **Push Notifications** — alert users when new cats are added in their area
- **Shelter Rating System** — community feedback on adoption experience
- **Image-based Cat Search** — upload a photo of a cat you saw, find similar ones in the database
- **Mobile App (PWA)** — installable progressive web app with offline support
- **Improved Scraper** — integrate the config-driven scraper into Temporal workflows for fully automated updates

---

## 9. Tools Used

| Tool | Purpose |
|------|---------|
| Kiro (AI IDE) | Spec-driven development, code generation, property test design |
| Aikido Security | Automated security scanning (CSP, HSTS, clickjacking) |
| GitHub Actions | CI/CD pipeline (test, build, auto-deploy) |
| OBS Studio | Video demo recording |
| Temporal.io | Workflow orchestration for scraping |
| fast-check | Property-based testing |

---

## 11. Learnings & Takeaways

- **Security is iterative** — learned to use Aikido to identify and fix vulnerabilities (CSP headers, HSTS, clickjacking protection, timing-safe token comparison). Security isn't a one-time task, it's a continuous process of scanning and hardening.
- **Durable execution matters for unreliable tasks** — Temporal.io showed us how to make scraping 40+ websites reliable with automatic retries, fault isolation, and observability. When one shelter's site is down, it doesn't affect the others.
- **Dark mode is harder than it looks** — learned about CSS specificity issues, hover state overrides, shadow color handling, and the importance of testing every component in both modes.
- **CI/CD automation saves time** — setting up GitHub Actions for auto-testing and auto-deploying to a Raspberry Pi meant we could push changes confidently and see them live in minutes.
- **Config-driven design scales better** — instead of writing custom scraping code for each shelter, we learned to use a JSON config with CSS selectors per site, making it easy to add new shelters without code changes.

---

## 12. Acknowledgments

- **[Otwarte Schroniska API](https://otwarteschroniska.org.pl/)** — public registry of Polish animal shelters, used as our shelter data source
- **[Fundacja Puszatek](https://puszatek.pl/)** — cat registry data used as an additional scraping source
- **[OpenStreetMap](https://www.openstreetmap.org/)** — map tiles via Leaflet
- **[Temporal.io](https://temporal.io/)** — durable execution platform for workflow orchestration
- **[Aikido Security](https://www.aikido.dev/)** — automated security scanning

---

## Submission Checklist

- [x] Video demo (HD or at least 720p)
- [x] README.md (prerequisites, run instructions, configuration)
- [x] Project report (this document, in docs/)
- [x] Source code in src/
- [x] No unrelated files, executables, auto-generated code, or package folders
