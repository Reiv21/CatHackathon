import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { sanitizeSearchQuery, validateShelterId } from "./validation.js";
import { getCityCoords } from "./geocoding.js";
import { getVoivodeshipForCity } from "./city-voivodeship.js";

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

export function createApp(dbPath?: string) {
  const app = express();

  // Security headers
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      },
    })
  );

  // CORS
  app.use(
    cors({
      origin: FRONTEND_ORIGIN,
      methods: ["GET"],
      allowedHeaders: ["Content-Type", "Accept"],
    })
  );

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

  // POST endpoints need body parser
  app.use(express.json());

  // Submit a shelter suggestion (public, no auth)
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

  // Static file serving (production)
  app.use(express.static(FRONTEND_DIST));

  // SPA fallback
  app.use((req, res, next) => {
    if (req.path.startsWith("/api/")) {
      next();
      return;
    }
    const indexPath = path.join(FRONTEND_DIST, "index.html");
    if (existsSync(indexPath)) {
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

// Start server if run directly
if (
  process.argv[1] &&
  (process.argv[1].endsWith("server.ts") ||
    process.argv[1].endsWith("server.js"))
) {
  const { app } = createApp();
  app.listen(PORT, () => {
    console.log(`🐱 Tactical Cat API running on port ${PORT}`);
    console.log(`   Reading data from: ${DATA_DIR}`);
  });
}
