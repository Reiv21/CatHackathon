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
    INSERT INTO cats (shelter_id, name, description, image_url, scraped_at)
    VALUES (@shelter_id, @name, @description, @image_url, datetime('now'))
  `);

  const replaceAll = db.transaction((items: Cat[]) => {
    deleteStmt.run(shelterId);
    for (const cat of items) {
      insertStmt.run({
        shelter_id: shelterId,
        name: cat.name,
        description: cat.description ?? "",
        image_url: cat.image_url,
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
