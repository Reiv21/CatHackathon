import express from "express";
import helmet from "helmet";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import { existsSync, readFileSync } from "fs";
import { sanitizeSearchQuery, validateShelterId } from "./validation.js";
import { getCityCoords } from "./geocoding.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || "http://localhost:5173";
const PORT = parseInt(process.env.PORT || "3000", 10);
const FRONTEND_DIST = path.resolve(__dirname, "../frontend/dist");
const DATA_DIR = path.resolve(__dirname, "../data");

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

  // API Routes — read from JSON files (reloads on each request for live editing)
  app.get("/api/shelters", (_req, res, next) => {
    try {
      const shelters = loadShelters();
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

      let cats = loadCats();
      const shelters = loadShelters();

      // Enrich cats with shelter URL
      const enriched = cats.map((c) => {
        const shelter = shelters.find((s) => s.id_zewnetrzne === c.shelter_id);
        return {
          ...c,
          shelter_url: shelter?.website_url || null,
          shelter_voivodeship: shelter?.voivodeship || null,
        };
      });

      let filtered = enriched;
      if (search.length > 0) {
        filtered = enriched.filter(
          (c) =>
            c.name.toLowerCase().includes(search) ||
            c.shelter_city.toLowerCase().includes(search) ||
            c.shelter_name.toLowerCase().includes(search)
        );
      }

      // Limit to 200
      res.json(filtered.slice(0, 200));
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
