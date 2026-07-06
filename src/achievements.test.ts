import { describe, it, expect } from "vitest";
import { computeAchievements, CatRecord, ShelterRecord } from "./achievements.js";
import request from "supertest";
import { createApp } from "./server.js";

function makeCat(id: number, shelterId: number): CatRecord {
  return {
    id,
    name: `Cat${id}`,
    description: "",
    image_url: null,
    source_url: null,
    shelter_id: shelterId,
    shelter_name: `Shelter${shelterId}`,
    shelter_city: "City",
  };
}

function makeShelter(id: number, voivodeship: string): ShelterRecord {
  return {
    id_zewnetrzne: id,
    name: `Shelter${id}`,
    city: "City",
    voivodeship,
    website_url: null,
  };
}

describe("computeAchievements", () => {
  it("returns empty array when no thresholds met", () => {
    const cats = [makeCat(1, 1)];
    const shelters = [makeShelter(1, "mazowieckie")];
    const result = computeAchievements(cats, shelters);
    expect(result).toEqual([]);
  });

  it("returns empty array with empty data", () => {
    const result = computeAchievements([], []);
    expect(result).toEqual([]);
  });

  it("returns 'Pierwsza Setka' when cats >= 100", () => {
    const cats = Array.from({ length: 100 }, (_, i) => makeCat(i, 1));
    const shelters = [makeShelter(1, "mazowieckie")];
    const result = computeAchievements(cats, shelters);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Pierwsza Setka");
    expect(result[0].description).toBe("100 kotów w bazie!");
    expect(result[0].icon).toBe("🎯");
    expect(result[0].unlocked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns '10 Schronisk' when shelters with cats >= 10", () => {
    const shelters = Array.from({ length: 10 }, (_, i) => makeShelter(i + 1, "mazowieckie"));
    const cats = shelters.map((s, i) => makeCat(i, s.id_zewnetrzne));
    const result = computeAchievements(cats, shelters);
    expect(result.some(a => a.name === "10 Schronisk")).toBe(true);
  });

  it("returns 'Pełna Dominacja' when all 16 voivodeships represented", () => {
    const voivodeships = [
      "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie",
      "lodzkie", "malopolskie", "mazowieckie", "opolskie",
      "podkarpackie", "podlaskie", "pomorskie", "slaskie",
      "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie", "zachodniopomorskie",
    ];
    const shelters = voivodeships.map((v, i) => makeShelter(i + 1, v));
    const cats = shelters.map((s, i) => makeCat(i, s.id_zewnetrzne));
    const result = computeAchievements(cats, shelters);
    expect(result.some(a => a.name === "Pełna Dominacja")).toBe(true);
  });

  it("does not include 'Pełna Dominacja' when only 15 voivodeships", () => {
    const voivodeships = [
      "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie",
      "lodzkie", "malopolskie", "mazowieckie", "opolskie",
      "podkarpackie", "podlaskie", "pomorskie", "slaskie",
      "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie",
    ];
    const shelters = voivodeships.map((v, i) => makeShelter(i + 1, v));
    const cats = shelters.map((s, i) => makeCat(i, s.id_zewnetrzne));
    const result = computeAchievements(cats, shelters);
    expect(result.some(a => a.name === "Pełna Dominacja")).toBe(false);
  });

  it("only counts voivodeships for shelters that have cats", () => {
    const voivodeships = [
      "dolnoslaskie", "kujawsko-pomorskie", "lubelskie", "lubuskie",
      "lodzkie", "malopolskie", "mazowieckie", "opolskie",
      "podkarpackie", "podlaskie", "pomorskie", "slaskie",
      "swietokrzyskie", "warminsko-mazurskie", "wielkopolskie", "zachodniopomorskie",
    ];
    const shelters = voivodeships.map((v, i) => makeShelter(i + 1, v));
    // Only give cats to first 15 shelters (missing zachodniopomorskie)
    const cats = shelters.slice(0, 15).map((s, i) => makeCat(i, s.id_zewnetrzne));
    const result = computeAchievements(cats, shelters);
    expect(result.some(a => a.name === "Pełna Dominacja")).toBe(false);
  });
});

describe("GET /api/achievements endpoint", () => {
  const { app } = createApp();

  it("returns a JSON array", async () => {
    const res = await request(app).get("/api/achievements");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("each achievement has required fields", async () => {
    const res = await request(app).get("/api/achievements");
    expect(res.status).toBe(200);
    for (const achievement of res.body) {
      expect(achievement).toHaveProperty("name");
      expect(achievement).toHaveProperty("description");
      expect(achievement).toHaveProperty("icon");
      expect(achievement).toHaveProperty("unlocked_at");
    }
  });
});
