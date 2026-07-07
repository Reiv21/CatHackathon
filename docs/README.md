# 🐱 Mrucznik — Project Documentation

> **Cat Adoption Platform for the "For the Cats" Hackathon**
> Helping shelter cats across Poland find loving homes through technology.

🌐 **Live Demo:** [mrucznik.serwerigora.com](https://mrucznik.serwerigora.com)

---

## Table of Contents

1. [What is Mrucznik?](#what-is-mrucznik)
2. [Features Overview](./FEATURES.md)
3. [Architecture & How It Works](./ARCHITECTURE.md)
4. [Security Report](./SECURITY.md)
5. [Setup & Deployment](./SETUP.md)
6. [Screenshots & Demo](./SCREENSHOTS.md)

---

## What is Mrucznik?

**Mrucznik** (Polish for "Purrer" 🐱) is a web application that aggregates cats available for adoption from **40+ animal shelters across all 16 Polish voivodeships** into one searchable, map-enabled platform.

### The Problem

Poland has approximately 190 animal shelters. Each shelter has its own website (if any), with different layouts, different information structures, and often no English support. A person looking to adopt a cat needs to visit dozens of individual websites one by one.

### Our Solution

Mrucznik automatically collects cat adoption listings from shelter websites using an intelligent scraping system powered by **Temporal.io** (a durable execution platform). It presents all available cats in a single, beautiful interface with:

- **Search & Filter** — find cats by name, city, region, or sex
- **Interactive Map** — see all shelters on a map, find the nearest one to you
- **Stray Cat Reporting** — community feature to report homeless cats with GPS location
- **Lost Cat Finder** — report missing cats so the community can help locate them
- **Adoption Guides** — practical guides for first-time cat adopters (in Polish and English)

### Why This Matters

Every day cats sit in shelters waiting for homes. By making them visible in one place, we dramatically increase their chances of being found and adopted. The platform is bilingual (Polish/English) and works on all devices.

---

## Quick Links

| Document | What's Inside |
|----------|---------------|
| [Features](./FEATURES.md) | Complete list of all features with descriptions |
| [Architecture](./ARCHITECTURE.md) | How the system works, tech stack, data flow |
| [Security](./SECURITY.md) | All security measures, Aikido scan report |
| [Setup](./SETUP.md) | How to run the project locally |
| [Screenshots](./SCREENSHOTS.md) | Visual guide to the application |

---

## Technology Highlights

| Layer | Technology | Why |
|-------|-----------|-----|
| Workflow Engine | **Temporal.io** | Durable execution — if scraping fails mid-way, it retries automatically without losing progress |
| Backend | Express.js 5 + TypeScript | Fast, typed, well-tested REST API |
| Database | SQLite (WAL mode) | Zero-config embedded database, perfect for single-server deployment |
| Frontend | React 18 + Vite + TailwindCSS | Modern, fast, responsive UI |
| Maps | Leaflet + OpenStreetMap | Free, open-source interactive maps |
| Testing | Vitest + fast-check (property-based) | Mathematically rigorous testing approach |
| CI/CD | GitHub Actions → Raspberry Pi | Automated deployment on every push to main |

---

## Team

Built during the "For the Cats" hackathon with ❤️ for homeless cats everywhere.
