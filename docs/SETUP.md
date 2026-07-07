# Setup & Deployment Guide

How to run Mrucznik on your own machine, and how the production deployment works.

---

## Running Locally (Development)

### What You Need

- **Node.js 20+** — download from [nodejs.org](https://nodejs.org)
- **Temporal Server** — for the scraping workflow engine
- **npm** — comes with Node.js

### Step-by-Step Setup

```bash
# 1. Clone the repository
git clone https://github.com/Reiv21/CatHackathon.git
cd CatHackathon

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
cd frontend && npm install && cd ..

# 4. Create environment file
cp .env.example .env
# Edit .env with your values (see Environment Variables below)

# 5. Start Temporal server (in a separate terminal)
temporal server start-dev

# 6. Start the Temporal worker (in a separate terminal)
npm run worker

# 7. Start the API server
npm run server

# 8. Start the frontend dev server (in a separate terminal)
cd frontend && npm run dev
```

The app will be available at:
- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001

### Environment Variables

Create a `.env` file with these values:

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | API server port | `3000` |
| `FRONTEND_ORIGIN` | Frontend URL for CORS | `http://localhost:5173` |
| `ADMIN_PASSWORD` | Admin panel password | *(required — choose anything)* |
| `TEMPORAL_ADDRESS` | Temporal server address | `localhost:7233` |

---

## Running Tests

```bash
# Run all backend tests
npm test

# Run frontend tests
cd frontend && npx vitest --run

# Run a specific test file
npx vitest --run src/security-headers.property.test.ts
```

---

## Building for Production

```bash
# Build the frontend
cd frontend && npm run build && cd ..

# The Express server will serve the built frontend from frontend/dist/
npm run server
```

---

## Production Deployment

The live site runs on a **Raspberry Pi** with automated deployment.

### How Auto-Deploy Works

```
Developer pushes to main branch
  ↓
GitHub Actions CI runs (tests + build)
  ↓
If all tests pass:
  ↓
GitHub Actions SSH's into the Raspberry Pi
  ↓
Pulls latest code, installs dependencies, builds frontend
  ↓
PM2 restarts the server (zero-downtime)
  ↓
Site is live at https://mrucznik.serwerigora.com
```

### Server Stack

| Component | Role |
|-----------|------|
| **Nginx** | HTTPS termination, reverse proxy |
| **Express.js** | API + static file serving |
| **PM2** | Process manager (auto-restart on crash) |
| **Temporal** | Workflow engine for scraping |
| **Let's Encrypt** | Free SSL certificate |

### Triggering Data Sync

1. Log into the admin panel (navigate to #admin in the app)
2. Enter the admin password
3. Click "Trigger Sync"
4. The Temporal workflow will scrape all configured shelters

Or manually via API:
```bash
# Login
TOKEN=$(curl -s -X POST https://mrucznik.serwerigora.com/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"YOUR_PASSWORD"}' | jq -r .token)

# Trigger sync
curl -X POST https://mrucznik.serwerigora.com/api/admin/sync \
  -H "Authorization: Bearer $TOKEN"
```

---

## Useful Commands

| Command | What it does |
|---------|-------------|
| `npm run server` | Start the Express API server |
| `npm run worker` | Start the Temporal worker |
| `npm run client` | Trigger a sync workflow |
| `npm test` | Run backend tests |
| `npm run scrape` | Full scrape pipeline |
| `npm run validate` | Validate scraped data |
