import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync, accessSync, constants } from "fs";
import { config as dotenvConfig } from "dotenv";
import { sanitizeSearchQuery, validateShelterId } from "./validation.js";
import { getCityCoords } from "./geocoding.js";
import { getVoivodeshipForCity } from "./city-voivodeship.js";
import { computeAchievements } from "./achievements.js";
import { computeDomination } from "./domination.js";

dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const PORT = parseInt(process.env.PORT || "3000", 10);
const FRONTEND_DIST = path.resolve(__dirname, "../frontend/dist");
const DATA_DIR = path.resolve(__dirname, "../data");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Brute force protection
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 min

function isRateLimited(ip: string): boolean {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.lastAttempt > LOCKOUT_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_ATTEMPTS;
}

function recordAttempt(ip: string): void {
  const entry = loginAttempts.get(ip) || { count: 0, lastAttempt: 0 };
  entry.count++;
  entry.lastAttempt = Date.now();
  loginAttempts.set(ip, entry);
}

function clearAttempts(ip: string): void {
  loginAttempts.delete(ip);
}

interface ShelterRecord {
  id_zewnetrzne: number;
  name: string;
  city: string;
  voivodeship: string;
  website_url: string | null;
  cat_count: number;
}

interface CatRecord {
  id: number;
  name: string;
  description: string;
  image_url: string | null;
  source_url: string | null;
  shelter_id: number;
  shelter_name: string;
  shelter_city: string;
}

function loadShelters(): ShelterRecord[] {
  const filePath = path.join(DATA_DIR, "shelters.json");
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

function loadCats(): CatRecord[] {
  const filePath = path.join(DATA_DIR, "cats.json");
  if (!existsSync(filePath)) return [];
  return JSON.parse(readFileSync(filePath, "utf-8"));
}

/**
 * Regex that matches filenames containing a content hash (8+ hex characters)
 * in the format: .XXXXXXXX.js or .XXXXXXXX.css
 */
export const HASHED_ASSET_REGEX = /\.[a-f0-9]{8,}\.(js|css)$/;

/**
 * Returns true if the given filename/path contains a content hash,
 * indicating it's a fingerprinted static asset suitable for immutable caching.
 */
export function isHashedAsset(filename: string): boolean {
  return HASHED_ASSET_REGEX.test(filename);
}

/**
 * Validates TEMPORAL_ADDRESS env var as host:port format and returns it
 * as an array suitable for CSP connectSrc. Returns empty array if format is invalid.
 */
export function getTemporalConnectSrc(): string[] {
  const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
  const hostPortRegex = /^([a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?)*):(\d{1,5})$/;
  const match = temporalAddress.match(hostPortRegex);
  if (!match) return [];
  const port = parseInt(match[5], 10);
  if (port < 1 || port > 65535) return [];
  return [temporalAddress];
}

/**
 * Admin auth middleware — validates Bearer token issued by login endpoint.
 * Returns 401 with generic message on failure (no information leakage).
 */
export function requireAdminAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  const token = auth.slice(7);
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    if (!decoded.startsWith("admin:")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
  } catch {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

export function createApp(dbPath?: string) {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://unpkg.com"],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https:", "http:"],
          connectSrc: ["'self'", ...getTemporalConnectSrc()],
          frameSrc: ["'none'"],
        },
      },
      hsts: { maxAge: 31536000, includeSubDomains: true },
      xContentTypeOptions: true,
      hidePoweredBy: true,
      referrerPolicy: { policy: "no-referrer-when-downgrade" },
    })
  );

  // CORS
  app.use(
    cors({
      origin: FRONTEND_ORIGIN,
      methods: ["GET", "POST", "DELETE"],
      allowedHeaders: ["Content-Type", "Accept", "Authorization"],
    })
  );

  // JSON body parser (must be before POST routes)
  app.use(express.json());

  // Stats endpoint
  app.get("/api/stats", (_req, res, next) => {
    try {
      const cats = loadCats();
      const shelters = loadShelters();
      const sheltersWithCats = new Set(cats.map((c) => c.shelter_id)).size;
      
      const catsPath = path.join(DATA_DIR, "cats.json");
      let lastFetched: string | null = null;
      try {
        const { statSync } = require("fs");
        const stat = statSync(catsPath);
        lastFetched = stat.mtime.toISOString();
      } catch {}

      res.json({
        totalCats: cats.length,
        totalShelters: shelters.length,
        sheltersWithCats,
        lastFetched,
      });
    } catch (err) {
      next(err);
    }
  });

  // Cat of the day — deterministic based on date
  app.get("/api/cat-of-the-day", (_req, res, next) => {
    try {
      const cats = loadCats().filter((c) => c.image_url);
      if (cats.length === 0) {
        res.json(null);
        return;
      }
      // Use today's date as seed for consistent daily pick
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const index = seed % cats.length;
      const shelters = loadShelters();
      const cat = cats[index];
      const shelter = shelters.find((s) => s.id_zewnetrzne === cat.shelter_id);
      res.json({
        ...cat,
        shelter_url: shelter?.website_url || null,
        shelter_voivodeship: shelter?.voivodeship || null,
      });
    } catch (err) {
      next(err);
    }
  });

  // API Routes — read from JSON files (reloads on each request for live editing)
  app.get("/api/shelters", (_req, res, next) => {
    try {
      const shelters = loadShelters();
      const cats = loadCats();
      const withCoords = shelters.map((s) => {
        const coords = getCityCoords(s.city);
        const catCount = cats.filter((c) => c.shelter_id === s.id_zewnetrzne).length;
        return {
          ...s,
          cat_count: catCount,
          latitude: coords ? coords[0] : null,
          longitude: coords ? coords[1] : null,
        };
      });
      res.json(withCoords);
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/cats", (req, res, next) => {
    try {
      const rawSearch = (req.query.search as string) || "";
      const search = sanitizeSearchQuery(rawSearch).toLowerCase();
      const voivodeship = (req.query.voivodeship as string) || "";
      const sex = (req.query.sex as string) || "";
      const sort = (req.query.sort as string) || "";
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 24));

      let cats = loadCats();
      const shelters = loadShelters();

      // Enrich cats with shelter URL and voivodeship
      const enriched = cats.map((c) => {
        const shelter = shelters.find((s) => s.id_zewnetrzne === c.shelter_id);
        // For registry cats (shelter_id=0), try to find voivodeship by city
        let voiv = shelter?.voivodeship || null;
        if (!voiv && c.shelter_city) {
          const matchingShelter = shelters.find(
            (s) => s.city.toLowerCase() === c.shelter_city.toLowerCase()
          );
          if (matchingShelter) voiv = matchingShelter.voivodeship;
          if (!voiv) voiv = getVoivodeshipForCity(c.shelter_city);
        }
        return {
          ...c,
          shelter_url: shelter?.website_url || null,
          shelter_voivodeship: voiv,
        };
      });

      let filtered = enriched;
      
      // Search filter
      if (search.length > 0) {
        filtered = filtered.filter(
          (c) =>
            c.name.toLowerCase().includes(search) ||
            c.shelter_city.toLowerCase().includes(search) ||
            c.shelter_name.toLowerCase().includes(search)
        );
      }

      // Voivodeship filter
      if (voivodeship) {
        filtered = filtered.filter(
          (c) => c.shelter_voivodeship?.toLowerCase() === voivodeship.toLowerCase()
        );
      }

      // Sex filter
      if (sex === "male") {
        filtered = filtered.filter((c) => c.sex === "samiec");
      } else if (sex === "female") {
        filtered = filtered.filter((c) => c.sex === "samica");
      }

      // Sort
      if (sort === "name") {
        filtered.sort((a, b) => a.name.localeCompare(b.name, "pl"));
      } else if (sort === "city") {
        filtered.sort((a, b) => a.shelter_city.localeCompare(b.shelter_city, "pl"));
      }

      const total = filtered.length;
      const totalPages = Math.ceil(total / limit);
      const offset = (page - 1) * limit;
      const paginated = filtered.slice(offset, offset + limit);

      res.json({
        cats: paginated,
        pagination: { page, limit, total, totalPages },
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/shelters/:id/cats", (req, res, next) => {
    try {
      const shelterId = validateShelterId(req.params.id);
      if (shelterId === null) {
        res.status(400).json({ message: "Invalid shelter ID" });
        return;
      }

      const shelters = loadShelters();
      const shelter = shelters.find((s) => s.id_zewnetrzne === shelterId);
      if (!shelter) {
        res.status(404).json({ message: "Shelter not found" });
        return;
      }

      const cats = loadCats().filter((c) => c.shelter_id === shelterId);
      res.json(cats);
    } catch (err) {
      next(err);
    }
  });

  // Random cat
  app.get("/api/random-cat", (_req, res, next) => {
    try {
      const cats = loadCats().filter((c) => c.image_url);
      if (cats.length === 0) { res.json(null); return; }
      const index = Math.floor(Math.random() * cats.length);
      const shelters = loadShelters();
      const cat = cats[index];
      const shelter = shelters.find((s) => s.id_zewnetrzne === cat.shelter_id);
      res.json({
        ...cat,
        shelter_url: shelter?.website_url || null,
        shelter_voivodeship: shelter?.voivodeship || null,
      });
    } catch (err) { next(err); }
  });

  // Stray cat reports — rate limit 3 per IP per 24h (skip for localhost)
  const strayReports = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/report-stray", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const isLocal = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
    const now = Date.now();

    if (!isLocal) {
      const entry = strayReports.get(ip);
      if (entry && entry.resetAt > now && entry.count >= 3) {
        res.status(429).json({ message: "Too many reports. Max 3 per day. Try again tomorrow." });
        return;
      }
      if (!entry || entry.resetAt <= now) {
        strayReports.set(ip, { count: 1, resetAt: now + 24 * 60 * 60 * 1000 });
      } else {
        entry.count++;
      }
    }

    const { description, image_url, latitude, longitude, city } = req.body;
    if (!latitude && !city) {
      res.status(400).json({ message: "Location or city is required" });
      return;
    }

    // Fix imgur links: convert imgur.com/XYZ to i.imgur.com/XYZ.png
    let fixedImageUrl = image_url || null;
    if (fixedImageUrl) {
      const imgurMatch = fixedImageUrl.match(/(?:https?:\/\/)?(?:www\.)?imgur\.com\/(\w+)$/);
      if (imgurMatch) {
        fixedImageUrl = `https://i.imgur.com/${imgurMatch[1]}.png`;
      }
    }

    let lat = parseFloat(latitude) || 0;
    let lng = parseFloat(longitude) || 0;

    // If no GPS but city given, use geocoding for approximate map pin
    if ((lat === 0 || isNaN(lat)) && city) {
      const coords = getCityCoords(city);
      if (coords) {
        lat = coords[0] + (Math.random() - 0.5) * 0.01;
        lng = coords[1] + (Math.random() - 0.5) * 0.01;
      }
    }

    const report = {
      id: Date.now(),
      description: description || "",
      image_url: fixedImageUrl,
      latitude: lat,
      longitude: lng,
      city: city || "",
      reported_at: new Date().toISOString(),
    };

    const straysPath = path.join(DATA_DIR, "strays.json");
    let strays: unknown[] = [];
    if (existsSync(straysPath)) {
      strays = JSON.parse(readFileSync(straysPath, "utf-8"));
    }
    strays.push(report);
    writeFileSync(straysPath, JSON.stringify(strays, null, 2));
    res.json({ message: "Report submitted. Thank you for helping!" });
  });

  app.get("/api/strays", (_req, res, next) => {
    try {
      const straysPath = path.join(DATA_DIR, "strays.json");
      if (!existsSync(straysPath)) { res.json([]); return; }
      res.json(JSON.parse(readFileSync(straysPath, "utf-8")));
    } catch (err) { next(err); }
  });

  // Admin: delete stray report
  app.delete("/api/admin/strays/:id", (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const straysPath = path.join(DATA_DIR, "strays.json");
    if (!existsSync(straysPath)) { res.json({ message: "Not found" }); return; }
    const strays = JSON.parse(readFileSync(straysPath, "utf-8")) as Array<{ id: number }>;
    const id = parseInt(req.params.id);
    const filtered = strays.filter((s) => s.id !== id);
    writeFileSync(straysPath, JSON.stringify(filtered, null, 2));
    res.json({ message: "Deleted" });
  });

  app.delete("/api/admin/strays/:id", (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const straysPath = path.join(DATA_DIR, "strays.json");
    if (!existsSync(straysPath)) { res.json({ message: "Not found" }); return; }
    const strays = JSON.parse(readFileSync(straysPath, "utf-8"));
    const id = parseInt(req.params.id);
    const filtered = strays.filter((s: { id: number }) => s.id !== id);
    writeFileSync(straysPath, JSON.stringify(filtered, null, 2));
    res.json({ message: "Deleted" });
  });

  // Suggest shelter (public)
  app.post("/api/suggest-shelter", (req, res) => {
    const { name, city, voivodeship, website_url, submitter_email } = req.body;
    if (!name || !city) {
      res.status(400).json({ message: "Name and city are required" });
      return;
    }
    const suggestion = {
      name, city, voivodeship: voivodeship || "", website_url: website_url || null,
      submitter_email: submitter_email || null,
      submitted_at: new Date().toISOString(),
    };
    // Append to suggestions file
    const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
    let suggestions = [];
    if (existsSync(suggestionsPath)) {
      suggestions = JSON.parse(readFileSync(suggestionsPath, "utf-8"));
    }
    suggestions.push(suggestion);
    writeFileSync(suggestionsPath, JSON.stringify(suggestions, null, 2));
    res.json({ message: "Thank you! Your suggestion has been submitted for review." });
  });

  // Admin login
  app.post("/api/admin/login", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
      return;
    }
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
      clearAttempts(ip);
      // Simple token (in production use JWT)
      const token = Buffer.from(`admin:${Date.now()}`).toString("base64");
      res.json({ token });
    } else {
      recordAttempt(ip);
      res.status(401).json({ message: "Invalid password" });
    }
  });

  // Admin: get suggestions
  app.get("/api/admin/suggestions", (req, res) => {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith("Bearer ")) {
      res.status(401).json({ message: "Unauthorized" });
      return;
    }
    const suggestionsPath = path.join(DATA_DIR, "suggestions.json");
    if (!existsSync(suggestionsPath)) {
      res.json([]);
      return;
    }
    res.json(JSON.parse(readFileSync(suggestionsPath, "utf-8")));
  });

  // Sync trigger endpoint — starts Temporal workflow (non-blocking)
  app.post("/api/admin/sync", requireAdminAuth, async (_req, res) => {
    try {
      const { Connection, Client } = await import("@temporalio/client");
      const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
      const connection = await Connection.connect({ address: temporalAddress });
      const client = new Client({ connection });
      const workflowId = `shelter-sync-${Date.now()}`;
      await client.workflow.start("parentSyncWorkflow", {
        taskQueue: "shelter-sync",
        workflowId,
      });
      res.json({ workflow_id: workflowId, message: "Sync started" });
    } catch {
      res.status(503).json({ message: "Workflow engine unavailable" });
    }
  });

  // Sync status endpoint — queries Temporal for most recent shelter-sync-* workflow
  app.get("/api/admin/sync/status", requireAdminAuth, async (_req, res) => {
    try {
      const { Connection, Client } = await import("@temporalio/client");
      const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
      const connection = await Connection.connect({ address: temporalAddress });
      const client = new Client({ connection });

      // List workflows matching the shelter-sync- prefix, sorted by start time desc
      const workflows = client.workflow.list({
        query: 'WorkflowId STARTS_WITH "shelter-sync-"',
      });

      let latest: {
        status: "running" | "completed" | "failed" | "never_run";
        start_time: string | null;
        completion_time: string | null;
      } | null = null;

      for await (const workflow of workflows) {
        // Take only the first (most recent) result
        const statusNum = workflow.status.code;
        // Temporal status codes:
        // 1 = RUNNING, 2 = COMPLETED, 3 = FAILED, 4 = CANCELLED, 5 = TERMINATED, 6 = CONTINUED_AS_NEW, 7 = TIMED_OUT
        let status: "running" | "completed" | "failed";
        if (statusNum === 1) {
          status = "running";
        } else if (statusNum === 2) {
          status = "completed";
        } else {
          status = "failed";
        }

        latest = {
          status,
          start_time: workflow.startTime?.toISOString() ?? null,
          completion_time: workflow.closeTime?.toISOString() ?? null,
        };
        break;
      }

      if (!latest) {
        res.json({ status: "never_run", start_time: null, completion_time: null });
      } else {
        res.json(latest);
      }
    } catch {
      res.status(503).json({ message: "Sync status temporarily unavailable" });
    }
  });

  // Domination endpoint
  app.get("/api/domination", (_req, res) => {
    try {
      const shelters = loadShelters();
      const cats = loadCats();
      const result = computeDomination(shelters, cats);
      res.json(result);
    } catch {
      res.json({
        total_shelters_in_poland: 190,
        shelters_covered: 0,
        percentage: 0,
        cats_in_army: 0,
        domination_level: "Kocie Zwiadowcy",
      });
    }
  });

  // Achievements endpoint
  app.get("/api/achievements", (_req, res, next) => {
    try {
      const cats = loadCats();
      const shelters = loadShelters();
      const achievements = computeAchievements(cats, shelters);
      res.json(achievements);
    } catch {
      res.json([]);
    }
  });

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    try {
      accessSync(DATA_DIR, constants.R_OK);
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({
        status: "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        details: "Data directory is inaccessible",
      });
    }
  });

  // Cache headers for hashed static assets (must be before express.static)
  app.use("/assets", (req, res, next) => {
    if (isHashedAsset(req.path)) {
      res.setHeader("Cache-Control", "max-age=31536000, immutable");
    }
    next();
  });

  // Cache-Control: no-cache for index.html served by express.static
  app.use((req, res, next) => {
    if (req.path === "/" || req.path === "/index.html") {
      res.setHeader("Cache-Control", "no-cache");
    }
    next();
  });

  // Static file serving (production)
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback — serves index.html with no-cache for non-API routes
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    const indexPath = path.join(FRONTEND_DIST, "index.html");
    if (existsSync(indexPath)) {
      res.setHeader("Cache-Control", "no-cache");
      res.sendFile(indexPath);
    } else {
      res.status(404).json({ message: "Frontend not built" });
    }
  });

  // Global error handler
  app.use(
    (
      err: Error,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      console.error("Server error:", err.message);
      res.status(503).json({ message: "Service temporarily unavailable" });
    }
  );

  return { app, db: null as unknown };
}

/**
 * Sets up graceful shutdown handlers for the HTTP server.
 * - On first SIGTERM/SIGINT: stops accepting connections, waits up to 10s for in-flight requests
 * - After timeout: force-closes remaining connections, exits with code 0
 * - On second signal during shutdown: immediately exits with code 1
 */
export function setupGracefulShutdown(server: import("http").Server): void {
  let shuttingDown = false;
  const connections = new Set<import("net").Socket>();

  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });

  const shutdown = () => {
    if (shuttingDown) {
      // Second signal — force exit
      process.exit(1);
      return;
    }
    shuttingDown = true;
    console.log("Graceful shutdown initiated");

    server.close(() => {
      process.exit(0);
    });

    // Force-close after 10s
    const timeout = setTimeout(() => {
      for (const socket of connections) {
        socket.destroy();
      }
      process.exit(0);
    }, 10_000);
    timeout.unref();
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

// Start server if run directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"))
) {
  const { app } = createApp();
  const server = app.listen(PORT, () => {
    console.log(`🐱 Tactical Cat API running on port ${PORT}`);
    console.log(`   Reading data from: ${DATA_DIR}`);
  });
  setupGracefulShutdown(server);
}
