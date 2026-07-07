import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync } from "fs";
import { config as dotenvConfig } from "dotenv";
import crypto from "crypto";
import type Database from "better-sqlite3";
import { initializeDatabase } from "./db.js";
import { createQueries } from "./queries.js";
import { sanitizeSearchQuery, validateShelterId, validateUrl } from "./validation.js";
import { getCityCoords } from "./geocoding.js";


dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const PORT = parseInt(process.env.PORT || "3000", 10);
const FRONTEND_DIST = path.resolve(__dirname, "../frontend/dist");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const TOKEN_SECRET = process.env.TOKEN_SECRET || ADMIN_PASSWORD;

/** Generate a signed admin token */
function generateAdminToken(): string {
  const payload = `admin:${Date.now()}`;
  const signature = crypto.createHmac("sha256", TOKEN_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

/** Validate a signed admin token. Returns true if signature is valid. */
function validateAdminToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length < 3 || parts[0] !== "admin") return false;
    const timestamp = parts[1];
    const providedSig = parts.slice(2).join(":");
    const expectedPayload = `admin:${timestamp}`;
    const expectedSig = crypto.createHmac("sha256", TOKEN_SECRET).update(expectedPayload).digest("hex");
    return crypto.timingSafeEqual(Buffer.from(providedSig), Buffer.from(expectedSig));
  } catch {
    return false;
  }
}

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
  if (!validateAdminToken(token)) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  next();
}

export function createApp(dbPath?: string) {
  const db = initializeDatabase(dbPath);
  const queries = createQueries(db);
  const app = express();
  app.set("trust proxy", 1);

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
          frameAncestors: ["'none'"],
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
  app.use(express.json({ limit: "3mb" }));

  // Stats endpoint
  const lastFetchedStmt = db.prepare(`SELECT MAX(scraped_at) AS last_fetched FROM cats`);

  app.get("/api/stats", (_req, res, next) => {
    try {
      const totalCats = (queries.countCats.get() as { count: number }).count;
      const totalShelters = (queries.countShelters.get() as { count: number }).count;
      const sheltersWithCats = (queries.countSheltersWithCats.get() as { count: number }).count;
      const lastFetchedRow = lastFetchedStmt.get() as { last_fetched: string | null };

      res.json({
        totalCats,
        totalShelters,
        sheltersWithCats,
        lastFetched: lastFetchedRow.last_fetched || null,
      });
    } catch (err) {
      next(err);
    }
  });

  // Cat of the day — deterministic based on date
  app.get("/api/cat-of-the-day", (_req, res, next) => {
    try {
      const cats = queries.getCatsWithImages.all() as Array<{
        id: number; name: string; description: string; image_url: string | null;
        source_url: string | null; sex: string | null; age: string | null;
        shelter_id: number; shelter_name: string; shelter_city: string;
        shelter_url: string | null; shelter_voivodeship: string | null;
      }>;
      if (cats.length === 0) {
        res.json(null);
        return;
      }
      const today = new Date();
      const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
      const index = seed % cats.length;
      res.json(cats[index]);
    } catch (err) {
      next(err);
    }
  });

  // API Routes
  app.get("/api/shelters", (_req, res, next) => {
    try {
      const shelters = queries.getAllShelters.all() as Array<{
        id_zewnetrzne: number; name: string; city: string; voivodeship: string;
        website_url: string | null; cat_count: number;
      }>;
      const withCoords = shelters.map((s) => {
        const coords = getCityCoords(s.city);
        return {
          ...s,
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

      // Build SQL dynamically with WHERE clauses for filtering
      const conditions: string[] = [];
      const params: Record<string, string | number> = {};

      if (search.length > 0) {
        conditions.push(`(LOWER(c.name) LIKE @search OR LOWER(s.city) LIKE @search OR LOWER(s.name) LIKE @search)`);
        params.search = `%${search}%`;
      }

      if (voivodeship) {
        conditions.push(`LOWER(s.voivodeship) = @voivodeship`);
        params.voivodeship = voivodeship.toLowerCase();
      }

      if (sex === "male") {
        conditions.push(`c.sex = 'samiec'`);
      } else if (sex === "female") {
        conditions.push(`c.sex = 'samica'`);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Determine ORDER BY
      let orderBy = "ORDER BY c.id";
      if (sort === "name") {
        orderBy = "ORDER BY c.name COLLATE NOCASE";
      } else if (sort === "city") {
        orderBy = "ORDER BY s.city COLLATE NOCASE";
      }

      const offset = (page - 1) * limit;

      // Count total matching records
      const countSql = `
        SELECT COUNT(*) AS total
        FROM cats c
        JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
        ${whereClause}
      `;
      const totalRow = db.prepare(countSql).get(params) as { total: number };
      const total = totalRow.total;
      const totalPages = Math.ceil(total / limit);

      // Fetch paginated results
      const dataSql = `
        SELECT c.id, c.name, c.description, c.image_url, c.source_url,
               c.sex, c.age, c.shelter_id,
               s.name AS shelter_name, s.city AS shelter_city,
               s.website_url AS shelter_url, s.voivodeship AS shelter_voivodeship
        FROM cats c
        JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
        ${whereClause}
        ${orderBy}
        LIMIT @limit OFFSET @offset
      `;
      const cats = db.prepare(dataSql).all({ ...params, limit, offset }) as Array<{
        id: number; name: string; description: string; image_url: string | null;
        source_url: string | null; sex: string | null; age: string | null;
        shelter_id: number; shelter_name: string; shelter_city: string;
        shelter_url: string | null; shelter_voivodeship: string | null;
      }>;

      res.json({
        cats,
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

      const cats = queries.getCatsByShelter.all(shelterId);
      if (!cats || cats.length === 0) {
        // Check if shelter exists
        const shelter = db.prepare("SELECT id_zewnetrzne FROM shelters WHERE id_zewnetrzne = ?").get(shelterId);
        if (!shelter) {
          res.status(404).json({ message: "Shelter not found" });
          return;
        }
      }
      res.json(cats);
    } catch (err) {
      next(err);
    }
  });

  // Random cat
  app.get("/api/random-cat", (_req, res, next) => {
    try {
      const cats = queries.getCatsWithImages.all() as Array<{
        id: number; name: string; description: string; image_url: string | null;
        source_url: string | null; sex: string | null; age: string | null;
        shelter_id: number; shelter_name: string; shelter_city: string;
        shelter_url: string | null; shelter_voivodeship: string | null;
      }>;
      if (cats.length === 0) { res.json(null); return; }
      const index = Math.floor(Math.random() * cats.length);
      res.json(cats[index]);
    } catch (err) { next(err); }
  });

  // Stray cat reports — rate limit 3 per IP per 24h (skip for localhost)
  const strayReports = new Map<string, { count: number; resetAt: number }>();

  app.post("/api/report-stray", async (req, res) => {
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

    const { description, image_url, latitude, longitude, city, address: form_address } = req.body;
    if (!latitude && !city) {
      res.status(400).json({ message: "Location or city is required" });
      return;
    }

    let fixedImageUrl = image_url || null;

    let lat = parseFloat(latitude) || 0;
    let lng = parseFloat(longitude) || 0;

    if ((lat === 0 || isNaN(lat)) && (city || form_address)) {
      const searchQuery = form_address ? `${form_address}, ${city}, Poland` : `${city}, Poland`;
      const coords = getCityCoords(city);
      if (coords) {
        lat = coords[0] + (Math.random() - 0.5) * 0.01;
        lng = coords[1] + (Math.random() - 0.5) * 0.01;
      } else {
        try {
          const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1&countrycodes=pl`;
          const geoRes = await fetch(url, { headers: { "User-Agent": "Mrucznik-CatHackathon/1.0" } });
          const geoData = await geoRes.json() as Array<{ lat: string; lon: string }>;
          if (geoData.length > 0) {
            lat = parseFloat(geoData[0].lat);
            lng = parseFloat(geoData[0].lon);
          }
        } catch {
          // Geocoding failed — pin stays at 0,0
        }
      }
    }

    try {
      queries.insertStrayReport.run({
        description: description || "",
        image_url: fixedImageUrl,
        latitude: lat,
        longitude: lng,
        city: city || "",
        reported_at: new Date().toISOString(),
      });
      res.json({ message: "Report submitted. Thank you for helping!" });
    } catch (err) {
      res.status(500).json({ message: "Failed to save report" });
    }
  });

  app.get("/api/strays", (_req, res, next) => {
    try {
      const strays = queries.getAllStrays.all();
      res.json(strays);
    } catch (err) { next(err); }
  });

  // Admin: delete stray report
  app.delete("/api/admin/strays/:id", requireAdminAuth, (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }
    queries.deleteStray.run(id);
    res.json({ message: "Deleted" });
  });

  // Suggest shelter (public)
  app.post("/api/suggest-shelter", (req, res) => {
    const { name, city, voivodeship, website_url, submitter_email } = req.body;
    if (!name || !city) {
      res.status(400).json({ message: "Name and city are required" });
      return;
    }
    if (!validateUrl(website_url)) {
      res.status(400).json({ message: "Invalid URL scheme. Only http://, https://, and data: are allowed." });
      return;
    }
    try {
      queries.insertSuggestion.run({
        name,
        city,
        voivodeship: voivodeship || "",
        website_url: website_url || null,
        submitter_email: submitter_email || null,
        submitted_at: new Date().toISOString(),
      });
      res.json({ message: "Thank you! Your suggestion has been submitted for review." });
    } catch (err) {
      res.status(500).json({ message: "Failed to save suggestion" });
    }
  });

  // Admin login
  app.post("/api/admin/login", (req, res) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    if (isRateLimited(ip)) {
      res.status(429).json({ message: "Too many attempts. Try again in 15 minutes." });
      return;
    }
    const { password } = req.body;
    const input = Buffer.from(String(password || ""));
    const expected = Buffer.from(ADMIN_PASSWORD);
    const isValid = input.length === expected.length &&
      crypto.timingSafeEqual(input, expected);
    if (isValid) {
      clearAttempts(ip);
      const token = generateAdminToken();
      res.json({ token });
    } else {
      recordAttempt(ip);
      res.status(401).json({ message: "Invalid password" });
    }
  });

  // Admin: get suggestions
  app.get("/api/admin/suggestions", requireAdminAuth, (_req, res) => {
    try {
      const suggestions = queries.getAllSuggestions.all();
      res.json(suggestions);
    } catch (err) {
      res.status(500).json({ message: "Failed to load suggestions" });
    }
  });

  // Admin: delete suggestion by id
  app.delete("/api/admin/suggestions/:id", requireAdminAuth, (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(404).json({ message: "Not found" });
      return;
    }
    queries.deleteSuggestion.run(id);
    res.json({ message: "Deleted" });
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

  // Sync status endpoint
  app.get("/api/admin/sync/status", requireAdminAuth, async (_req, res) => {
    try {
      const { Connection, Client } = await import("@temporalio/client");
      const temporalAddress = process.env.TEMPORAL_ADDRESS || "localhost:7233";
      const connection = await Connection.connect({ address: temporalAddress });
      const client = new Client({ connection });

      const workflows = client.workflow.list({
        query: 'WorkflowId STARTS_WITH "shelter-sync-"',
      });

      let latest: {
        status: "running" | "completed" | "failed" | "never_run";
        start_time: string | null;
        completion_time: string | null;
      } | null = null;

      for await (const workflow of workflows) {
        const statusNum = workflow.status.code;
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

  // Lost cat reports
  app.post("/api/report-lost-cat", (req, res) => {
    const { name, description, image_url, last_seen_location, last_seen_city, contact_info } = req.body;
    if (!name || !last_seen_city) {
      res.status(400).json({ message: "Cat name and last seen city are required" });
      return;
    }
    try {
      const coords = getCityCoords(last_seen_city);
      const lat = coords ? coords[0] + (Math.random() - 0.5) * 0.01 : 0;
      const lng = coords ? coords[1] + (Math.random() - 0.5) * 0.01 : 0;
      db.prepare(`
        INSERT INTO lost_cats (name, description, image_url, latitude, longitude, city, contact_info, reported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(name, description || "", image_url || null, lat, lng, last_seen_city, contact_info || null, new Date().toISOString());
      res.json({ message: "Lost cat report submitted. We hope you find them soon!" });
    } catch {
      res.status(500).json({ message: "Failed to save report" });
    }
  });

  app.get("/api/lost-cats", (_req, res, next) => {
    try {
      const lostCats = db.prepare(`SELECT * FROM lost_cats ORDER BY reported_at DESC`).all();
      res.json(lostCats);
    } catch (err) { next(err); }
  });

  app.delete("/api/admin/lost-cats/:id", requireAdminAuth, (req, res) => {
    const id = parseInt(req.params.id as string);
    if (isNaN(id)) {
      res.status(400).json({ message: "Invalid ID" });
      return;
    }
    db.prepare(`DELETE FROM lost_cats WHERE id = ?`).run(id);
    res.json({ message: "Deleted" });
  });

  // Health check endpoint — checks db.open instead of DATA_DIR access
  app.get("/api/health", (_req, res) => {
    if (db.open) {
      res.json({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: "degraded",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        details: "Database connection is closed",
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

  return { app, db };
}

/**
 * Sets up graceful shutdown handlers for the HTTP server.
 * - On first SIGTERM/SIGINT: stops accepting connections, waits up to 10s for in-flight requests
 * - After timeout: force-closes remaining connections, exits with code 0
 * - On second signal during shutdown: immediately exits with code 1
 */
export function setupGracefulShutdown(server: import("http").Server, db?: Database.Database): void {
  let shuttingDown = false;
  const connections = new Set<import("net").Socket>();

  server.on("connection", (socket) => {
    connections.add(socket);
    socket.on("close", () => connections.delete(socket));
  });

  const shutdown = () => {
    if (shuttingDown) {
      process.exit(1);
      return;
    }
    shuttingDown = true;
    console.log("Graceful shutdown initiated");

    server.close(() => {
      if (db) db.close();
      process.exit(0);
    });

    const timeout = setTimeout(() => {
      for (const socket of connections) {
        socket.destroy();
      }
      if (db) db.close();
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
  const DB_PATH = process.env.DB_PATH || path.resolve(__dirname, "../shelter-sync.db");
  const { app, db } = createApp(DB_PATH);
  const server = app.listen(PORT, () => {
    console.log(`🐱 Tactical Cat API running on port ${PORT}`);
    console.log(`   Using database: ${DB_PATH}`);
  });
  setupGracefulShutdown(server, db);
}
