import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { computeAchievements, CatRecord, ShelterRecord } from "./achievements.js";

/**
 * Feature: hackathon-polish, Property 7: Achievement computation
 *
 * Validates: Requirements 6.2, 6.3, 6.4, 6.5, 6.6
 *
 * For any combination of total cat count, set of shelter IDs with cats,
 * and set of distinct voivodeships, computeAchievements returns:
 * - "Pierwsza Setka" iff cat count ≥ 100
 * - "10 Schronisk" iff shelter count ≥ 10
 * - "Pełna Dominacja" iff voivodeship count = 16
 * - Empty array when no thresholds are met
 */

const ALL_VOIVODESHIPS = [
  "dolnośląskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "łódzkie",
  "małopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "śląskie",
  "świętokrzyskie",
  "warmińsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

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

/**
 * Generator that produces a controlled test scenario:
 * - catCount: total number of cats (0–200)
 * - shelterCount: number of distinct shelters that have cats (1–20)
 * - voivodeshipCount: number of distinct voivodeships (1–16)
 */
const achievementScenarioArb = fc
  .record({
    catCount: fc.integer({ min: 0, max: 200 }),
    shelterCount: fc.integer({ min: 1, max: 20 }),
    voivodeshipCount: fc.integer({ min: 1, max: 16 }),
  })
  .map(({ catCount, shelterCount, voivodeshipCount }) => {
    // Pick voivodeships for our shelters
    const voivodeships = ALL_VOIVODESHIPS.slice(0, voivodeshipCount);

    // Create shelters distributed across the chosen voivodeships
    const shelters: ShelterRecord[] = [];
    for (let i = 0; i < shelterCount; i++) {
      const voivodeship = voivodeships[i % voivodeships.length];
      shelters.push(makeShelter(i + 1, voivodeship));
    }

    // Create cats distributed across the shelters
    const cats: CatRecord[] = [];
    for (let i = 0; i < catCount; i++) {
      const shelterId = shelters[i % shelters.length].id_zewnetrzne;
      cats.push(makeCat(i + 1, shelterId));
    }

    return { cats, shelters, catCount, shelterCount, voivodeshipCount };
  });

describe("Property 7: Achievement computation", () => {
  it("returns 'Pierwsza Setka' iff cats ≥ 100", () => {
    fc.assert(
      fc.property(achievementScenarioArb, ({ cats, shelters, catCount }) => {
        const achievements = computeAchievements(cats, shelters);
        const hasFirstHundred = achievements.some(
          (a) => a.name === "Pierwsza Setka"
        );
        if (catCount >= 100) {
          expect(hasFirstHundred).toBe(true);
        } else {
          expect(hasFirstHundred).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns '10 Schronisk' iff shelters with cats ≥ 10", () => {
    fc.assert(
      fc.property(achievementScenarioArb, ({ cats, shelters }) => {
        const achievements = computeAchievements(cats, shelters);
        const has10Shelters = achievements.some(
          (a) => a.name === "10 Schronisk"
        );

        // The function counts distinct shelter_ids from cats
        const shelterIdsWithCats = new Set(cats.map((c) => c.shelter_id));

        if (shelterIdsWithCats.size >= 10) {
          expect(has10Shelters).toBe(true);
        } else {
          expect(has10Shelters).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns 'Pełna Dominacja' iff voivodeship count = 16", () => {
    fc.assert(
      fc.property(achievementScenarioArb, ({ cats, shelters }) => {
        const achievements = computeAchievements(cats, shelters);
        const hasFullDomination = achievements.some(
          (a) => a.name === "Pełna Dominacja"
        );

        // The function counts distinct voivodeships from shelters that have cats
        const shelterIdsWithCats = new Set(cats.map((c) => c.shelter_id));
        const distinctVoivodeships = new Set(
          shelters
            .filter((s) => shelterIdsWithCats.has(s.id_zewnetrzne))
            .map((s) => s.voivodeship)
        );

        if (distinctVoivodeships.size === 16) {
          expect(hasFullDomination).toBe(true);
        } else {
          expect(hasFullDomination).toBe(false);
        }
      }),
      { numRuns: 100 }
    );
  });

  it("returns empty array when no thresholds are met", () => {
    fc.assert(
      fc.property(
        fc.record({
          catCount: fc.integer({ min: 1, max: 99 }),
          shelterCount: fc.integer({ min: 1, max: 9 }),
          voivodeshipCount: fc.integer({ min: 1, max: 15 }),
        }),
        ({ catCount, shelterCount, voivodeshipCount }) => {
          const voivodeships = ALL_VOIVODESHIPS.slice(0, voivodeshipCount);
          const shelters: ShelterRecord[] = [];
          for (let i = 0; i < shelterCount; i++) {
            shelters.push(
              makeShelter(i + 1, voivodeships[i % voivodeships.length])
            );
          }

          const cats: CatRecord[] = [];
          for (let i = 0; i < catCount; i++) {
            const shelterId = shelters[i % shelters.length].id_zewnetrzne;
            cats.push(makeCat(i + 1, shelterId));
          }

          const achievements = computeAchievements(cats, shelters);
          expect(achievements).toHaveLength(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("achievement entries have correct structure when unlocked", () => {
    fc.assert(
      fc.property(achievementScenarioArb, ({ cats, shelters }) => {
        const achievements = computeAchievements(cats, shelters);
        for (const a of achievements) {
          expect(a).toHaveProperty("name");
          expect(a).toHaveProperty("description");
          expect(a).toHaveProperty("icon");
          expect(a).toHaveProperty("unlocked_at");
          expect(a.unlocked_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
        }
      }),
      { numRuns: 100 }
    );
  });
});
