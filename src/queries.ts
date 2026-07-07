import type Database from "better-sqlite3";

export function createQueries(db: Database.Database) {
  return {
    getAllShelters: db.prepare(`
      SELECT s.id_zewnetrzne, s.name, s.city, s.voivodeship, s.website_url,
             COUNT(c.id) AS cat_count
      FROM shelters s
      LEFT JOIN cats c ON c.shelter_id = s.id_zewnetrzne
      GROUP BY s.id_zewnetrzne
      ORDER BY s.city
    `),

    getCatsByShelter: db.prepare(`
      SELECT c.id, c.name, c.description, c.image_url, c.source_url,
             c.sex, c.age, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      WHERE c.shelter_id = ?
      ORDER BY c.name
    `),

    getCatsWithImages: db.prepare(`
      SELECT c.id, c.name, c.description, c.image_url, c.source_url,
             c.sex, c.age, c.shelter_id,
             s.name AS shelter_name, s.city AS shelter_city,
             s.website_url AS shelter_url, s.voivodeship AS shelter_voivodeship
      FROM cats c
      JOIN shelters s ON s.id_zewnetrzne = c.shelter_id
      WHERE c.image_url IS NOT NULL AND c.image_url != ''
    `),

    countCats: db.prepare(`SELECT COUNT(*) AS count FROM cats`),
    countShelters: db.prepare(`SELECT COUNT(*) AS count FROM shelters`),
    countSheltersWithCats: db.prepare(`
      SELECT COUNT(DISTINCT shelter_id) AS count FROM cats
    `),

    insertStrayReport: db.prepare(`
      INSERT INTO stray_reports (description, image_url, latitude, longitude, city, reported_at)
      VALUES (@description, @image_url, @latitude, @longitude, @city, @reported_at)
    `),

    getAllStrays: db.prepare(`SELECT * FROM stray_reports ORDER BY reported_at DESC`),
    deleteStray: db.prepare(`DELETE FROM stray_reports WHERE id = ?`),

    insertSuggestion: db.prepare(`
      INSERT INTO suggestions (name, city, voivodeship, website_url, submitter_email, submitted_at)
      VALUES (@name, @city, @voivodeship, @website_url, @submitter_email, @submitted_at)
    `),

    getAllSuggestions: db.prepare(`SELECT * FROM suggestions ORDER BY submitted_at DESC`),
    deleteSuggestion: db.prepare(`DELETE FROM suggestions WHERE id = ?`),
  };
}
