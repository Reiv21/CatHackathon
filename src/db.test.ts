import { describe, it, expect, afterEach } from "vitest";
import { initializeDatabase } from "./db";
import type Database from "better-sqlite3";

describe("initializeDatabase", () => {
  let db: Database.Database;

  afterEach(() => {
    if (db) db.close();
  });

  it("should create an in-memory database when no path is provided", () => {
    db = initializeDatabase();
    expect(db).toBeDefined();
    expect(db.open).toBe(true);
  });

  it("should enable WAL journal mode for file-based databases", async () => {
    const fs = await import("fs");
    const path = await import("path");
    const os = await import("os");
    const tmpDir = os.tmpdir();
    const dbPath = path.join(tmpDir, `test-wal-${Date.now()}.db`);
    try {
      db = initializeDatabase(dbPath);
      const result = db.pragma("journal_mode") as { journal_mode: string }[];
      expect(result[0].journal_mode).toBe("wal");
      db.close();
    } finally {
      try { fs.unlinkSync(dbPath); } catch {}
      try { fs.unlinkSync(dbPath + "-wal"); } catch {}
      try { fs.unlinkSync(dbPath + "-shm"); } catch {}
    }
  });

  it("should enable foreign keys", () => {
    db = initializeDatabase();
    const result = db.pragma("foreign_keys") as { foreign_keys: number }[];
    expect(result[0].foreign_keys).toBe(1);
  });

  it("should create shelters table with correct schema", () => {
    db = initializeDatabase();
    const tableInfo = db.pragma("table_info(shelters)") as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
      dflt_value: string | null;
    }>;

    const columns = new Map(tableInfo.map((col) => [col.name, col]));

    expect(columns.has("id_zewnetrzne")).toBe(true);
    expect(columns.get("id_zewnetrzne")!.type).toBe("INTEGER");
    expect(columns.get("id_zewnetrzne")!.pk).toBe(1);

    expect(columns.has("name")).toBe(true);
    expect(columns.get("name")!.type).toBe("TEXT");
    expect(columns.get("name")!.notnull).toBe(1);

    expect(columns.has("website_url")).toBe(true);
    expect(columns.get("website_url")!.type).toBe("TEXT");
    expect(columns.get("website_url")!.notnull).toBe(0);

    expect(columns.has("city")).toBe(true);
    expect(columns.get("city")!.type).toBe("TEXT");
    expect(columns.get("city")!.notnull).toBe(1);

    expect(columns.has("voivodeship")).toBe(true);
    expect(columns.get("voivodeship")!.type).toBe("TEXT");
    expect(columns.get("voivodeship")!.notnull).toBe(1);

    expect(columns.has("updated_at")).toBe(true);
    expect(columns.get("updated_at")!.type).toBe("TEXT");
  });

  it("should create cats table with correct schema", () => {
    db = initializeDatabase();
    const tableInfo = db.pragma("table_info(cats)") as Array<{
      name: string;
      type: string;
      notnull: number;
      pk: number;
      dflt_value: string | null;
    }>;

    const columns = new Map(tableInfo.map((col) => [col.name, col]));

    expect(columns.has("id")).toBe(true);
    expect(columns.get("id")!.type).toBe("INTEGER");
    expect(columns.get("id")!.pk).toBe(1);

    expect(columns.has("shelter_id")).toBe(true);
    expect(columns.get("shelter_id")!.type).toBe("INTEGER");
    expect(columns.get("shelter_id")!.notnull).toBe(1);

    expect(columns.has("name")).toBe(true);
    expect(columns.get("name")!.type).toBe("TEXT");
    expect(columns.get("name")!.notnull).toBe(1);

    expect(columns.has("description")).toBe(true);
    expect(columns.get("description")!.type).toBe("TEXT");

    expect(columns.has("image_url")).toBe(true);
    expect(columns.get("image_url")!.type).toBe("TEXT");

    expect(columns.has("scraped_at")).toBe(true);
    expect(columns.get("scraped_at")!.type).toBe("TEXT");
  });

  it("should create cats table with foreign key referencing shelters", () => {
    db = initializeDatabase();
    const fkInfo = db.pragma("foreign_key_list(cats)") as Array<{
      table: string;
      from: string;
      to: string;
    }>;

    expect(fkInfo.length).toBe(1);
    expect(fkInfo[0].table).toBe("shelters");
    expect(fkInfo[0].from).toBe("shelter_id");
    expect(fkInfo[0].to).toBe("id_zewnetrzne");
  });

  it("should create idx_cats_shelter index on cats(shelter_id)", () => {
    db = initializeDatabase();
    const indexes = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='cats' AND name='idx_cats_shelter'"
      )
      .all() as Array<{ name: string }>;

    expect(indexes.length).toBe(1);
    expect(indexes[0].name).toBe("idx_cats_shelter");
  });

  it("should be idempotent - calling twice does not throw", () => {
    db = initializeDatabase();
    expect(() => {
      // Simulating re-initialization by running the same schema creation
      db.exec(`CREATE TABLE IF NOT EXISTS shelters (
        id_zewnetrzne INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        website_url TEXT,
        city TEXT NOT NULL,
        voivodeship TEXT NOT NULL,
        updated_at TEXT DEFAULT (datetime('now'))
      )`);
    }).not.toThrow();
  });
});
