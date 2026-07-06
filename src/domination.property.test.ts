/**
 * Property 5: Domination computation
 * Feature: hackathon-polish, Property 5: Domination computation
 *
 * *For any* non-negative integer totalCats and any set of shelter records
 * (each with a unique id_zewnetrzne and voivodeship), and any set of cat records
 * (each with a shelter_id referencing a shelter), the computeDomination function SHALL return:
 * - shelters_covered equal to the number of distinct shelter IDs that appear in the cats set
 * - percentage equal to round(shelters_covered / 190 * 100, 2)
 * - cats_in_army equal to the total number of cats
 * - domination_level matching the correct range bracket
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { computeDomination, ShelterRecord, CatRecord } from "./domination.js";

const TOTAL_SHELTERS = 190;

function expectedLevel(percentage: number): string {
  if (percentage >= 75) return "Pełna Kocia Dominacja";
  if (percentage >= 50) return "Kocia Ofensywa";
  if (percentage >= 25) return "Kocia Partyzantka";
  return "Kocie Zwiadowcy";
}

function roundTo2Decimals(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Arbitrary for a unique set of shelter records */
const shelterArb = fc
  .uniqueArray(fc.integer({ min: 1, max: 1000 }), { minLength: 0, maxLength: 50 })
  .map((ids) =>
    ids.map(
      (id): ShelterRecord => ({
        id_zewnetrzne: id,
        name: `Shelter ${id}`,
        city: `City ${id}`,
        voivodeship: `Voivodeship ${id % 16}`,
        website_url: null,
        cat_count: 0,
      })
    )
  );

/** Arbitrary for cat records that reference existing shelters */
const catsForSheltersArb = (shelterIds: number[]) => {
  if (shelterIds.length === 0) {
    return fc.constant([] as CatRecord[]);
  }
  return fc
    .array(
      fc.record({
        id: fc.integer({ min: 1, max: 10000 }),
        name: fc.constant("Cat"),
        description: fc.constant("A cat"),
        image_url: fc.constant(null),
        source_url: fc.constant(null),
        shelter_id: fc.constantFrom(...shelterIds),
        shelter_name: fc.constant("Shelter"),
        shelter_city: fc.constant("City"),
      }),
      { minLength: 0, maxLength: 100 }
    )
    .map((cats) => cats as CatRecord[]);
};

describe("Feature: hackathon-polish, Property 5: Domination computation", () => {
  it("shelters_covered equals distinct shelter IDs in cats set", () => {
    fc.assert(
      fc.property(
        shelterArb.chain((shelters) => {
          const ids = shelters.map((s) => s.id_zewnetrzne);
          return catsForSheltersArb(ids).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          const result = computeDomination(shelters, cats);
          const distinctShelterIdsInCats = new Set(cats.map((c) => c.shelter_id));
          const expectedCovered = shelters.filter((s) =>
            distinctShelterIdsInCats.has(s.id_zewnetrzne)
          ).length;
          expect(result.shelters_covered).toBe(expectedCovered);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("percentage equals round(shelters_covered / 190 * 100, 2)", () => {
    fc.assert(
      fc.property(
        shelterArb.chain((shelters) => {
          const ids = shelters.map((s) => s.id_zewnetrzne);
          return catsForSheltersArb(ids).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          const result = computeDomination(shelters, cats);
          const expectedPercentage = roundTo2Decimals(
            (result.shelters_covered / TOTAL_SHELTERS) * 100
          );
          expect(result.percentage).toBe(expectedPercentage);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("cats_in_army equals total number of cats", () => {
    fc.assert(
      fc.property(
        shelterArb.chain((shelters) => {
          const ids = shelters.map((s) => s.id_zewnetrzne);
          return catsForSheltersArb(ids).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          const result = computeDomination(shelters, cats);
          expect(result.cats_in_army).toBe(cats.length);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("domination_level matches correct range bracket for computed percentage", () => {
    fc.assert(
      fc.property(
        shelterArb.chain((shelters) => {
          const ids = shelters.map((s) => s.id_zewnetrzne);
          return catsForSheltersArb(ids).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          const result = computeDomination(shelters, cats);
          expect(result.domination_level).toBe(expectedLevel(result.percentage));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("total_shelters_in_poland is always 190", () => {
    fc.assert(
      fc.property(
        shelterArb.chain((shelters) => {
          const ids = shelters.map((s) => s.id_zewnetrzne);
          return catsForSheltersArb(ids).map((cats) => ({ shelters, cats }));
        }),
        ({ shelters, cats }) => {
          const result = computeDomination(shelters, cats);
          expect(result.total_shelters_in_poland).toBe(190);
        }
      ),
      { numRuns: 100 }
    );
  });
});
