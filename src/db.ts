import Database from "better-sqlite3";

export interface Shelter {
  id_zewnetrzne: number;
  name: string;
  website_url: string | null;
  city: string;
  voivodeship: string;
}

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

export function initializeDatabase(dbPath?: string): Database.Database {
  const db = new Database(dbPath ?? ":memory:");

  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS shelters (
      id_zewnetrzne INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      website_url TEXT,
      city TEXT NOT NULL,
      voivodeship TEXT NOT NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      shelter_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      image_url TEXT,
      scraped_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (shelter_id) REFERENCES shelters(id_zewnetrzne)
    );
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_cats_shelter ON cats(shelter_id);
  `);

  // Migrate cats table: add new columns if they don't exist
  const catsColumns = db.prepare(`PRAGMA table_info(cats)`).all() as { name: string }[];
  const catsColumnNames = catsColumns.map((col) => col.name);

  if (!catsColumnNames.includes("source_url")) {
    db.exec(`ALTER TABLE cats ADD COLUMN source_url TEXT`);
  }
  if (!catsColumnNames.includes("sex")) {
    db.exec(`ALTER TABLE cats ADD COLUMN sex TEXT`);
  }
  if (!catsColumnNames.includes("age")) {
    db.exec(`ALTER TABLE cats ADD COLUMN age TEXT`);
  }

  // Create stray_reports table
  db.exec(`
    CREATE TABLE IF NOT EXISTS stray_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '',
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create suggestions table
  db.exec(`
    CREATE TABLE IF NOT EXISTS suggestions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      city TEXT NOT NULL,
      voivodeship TEXT NOT NULL DEFAULT '',
      website_url TEXT,
      submitter_email TEXT,
      submitted_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Create indexes for new tables
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_stray_reports_city ON stray_reports(city);
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_suggestions_city ON suggestions(city);
  `);

  // Create lost_cats table
  db.exec(`
    CREATE TABLE IF NOT EXISTS lost_cats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      image_url TEXT,
      latitude REAL NOT NULL DEFAULT 0,
      longitude REAL NOT NULL DEFAULT 0,
      city TEXT NOT NULL DEFAULT '',
      contact_info TEXT,
      reported_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_lost_cats_city ON lost_cats(city);
  `);

  return db;
}

export function upsertShelters(db: Database.Database, shelters: Shelter[]): void {
  const upsertStmt = db.prepare(`
    INSERT INTO shelters (id_zewnetrzne, name, website_url, city, voivodeship, updated_at)
    VALUES (@id_zewnetrzne, @name, @website_url, @city, @voivodeship, datetime('now'))
    ON CONFLICT(id_zewnetrzne) DO UPDATE SET
      name = excluded.name,
      website_url = excluded.website_url,
      city = excluded.city,
      voivodeship = excluded.voivodeship,
      updated_at = datetime('now')
  `);

  const upsertAll = db.transaction((items: Shelter[]) => {
    for (const shelter of items) {
      upsertStmt.run({
        id_zewnetrzne: shelter.id_zewnetrzne,
        name: shelter.name,
        website_url: shelter.website_url,
        city: shelter.city,
        voivodeship: shelter.voivodeship,
      });
    }
  });

  upsertAll(shelters);
}

export function saveCats(db: Database.Database, shelterId: number, cats: Cat[]): void {
  const deleteStmt = db.prepare(`DELETE FROM cats WHERE shelter_id = ?`);
  const insertStmt = db.prepare(`
    INSERT INTO cats (shelter_id, name, description, image_url, source_url, sex, age, scraped_at)
    VALUES (@shelter_id, @name, @description, @image_url, @source_url, @sex, @age, datetime('now'))
  `);

  const replaceAll = db.transaction((items: Cat[]) => {
    deleteStmt.run(shelterId);
    for (const cat of items) {
      insertStmt.run({
        shelter_id: shelterId,
        name: cat.name,
        description: cat.description ?? "",
        image_url: cat.image_url,
        source_url: cat.source_url ?? null,
        sex: cat.sex ?? null,
        age: cat.age ?? null,
      });
    }
  });

  replaceAll(cats);
}

export function getSheltersWithWebsite(db: Database.Database): Shelter[] {
  const stmt = db.prepare(`
    SELECT id_zewnetrzne, name, website_url, city, voivodeship
    FROM shelters
    WHERE website_url IS NOT NULL AND website_url != ''
  `);

  return stmt.all() as Shelter[];
}
