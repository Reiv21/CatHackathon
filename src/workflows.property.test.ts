import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { initializeDatabase, upsertShelters, getSheltersWithWebsite, type Shelter } from "./db.js";

/**
 * Property 1: Child workflow filtering
 *
 * For any list of shelters returned by fetchAndSaveSheltersActivity (where each
 * shelter may or may not have a non-null website_url), the number of child
 * catScraperWorkflow executions launched by parentSyncWorkflow SHALL equal
 * exactly the count of shelters whose website_url is not null and not empty.
 *
 * **Validates: Requirements 1.4**
 *
 * Tag: Feature: hackathon-polish, Property 1: Child workflow filtering
 */

/** Arbitrary for generating a website_url value: null, empty string, or a valid URL */
const websiteUrlArbitrary = fc.oneof(
  fc.constant(null),
  fc.constant(""),
  fc.webUrl()
);

/** Arbitrary for generating a shelter with various website_url values */
const shelterArbitrary = (index: number): fc.Arbitrary<Shelter> =>
  fc.record({
    id_zewnetrzne: fc.constant(index + 1),
    name: fc.string({ minLength: 1, maxLength: 30 }).filter((s) => s.trim().length > 0),
    website_url: websiteUrlArbitrary,
    city: fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim().length > 0),
    voivodeship: fc.constantFrom(
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
      "zachodniopomorskie"
    ),
  });

/** Generate a list of shelters with unique IDs */
const shelterListArbitrary = fc
  .integer({ min: 0, max: 30 })
  .chain((count) =>
    fc.tuple(...Array.from({ length: count }, (_, i) => shelterArbitrary(i)))
  );

describe("Feature: hackathon-polish, Property 1: Child workflow filtering", () => {
  it("count of shelters with non-null non-empty URLs matches child workflow count", () => {
    fc.assert(
      fc.property(shelterListArbitrary, (shelters) => {
        // Compute expected count: shelters where website_url is not null and not empty
        const expectedChildWorkflowCount = shelters.filter(
          (s) => s.website_url !== null && s.website_url !== ""
        ).length;

        // Use in-memory SQLite database to test the actual filtering logic
        const db = initializeDatabase(":memory:");
        try {
          if (shelters.length > 0) {
            upsertShelters(db, shelters);
          }

          // getSheltersWithWebsite is what fetchAndSaveSheltersActivity uses
          // to determine which shelters get child workflows
          const sheltersWithWebsite = getSheltersWithWebsite(db);

          // The count of shelters returned must exactly match those with valid URLs
          expect(sheltersWithWebsite.length).toBe(expectedChildWorkflowCount);

          // Additionally verify each returned shelter actually has a non-null, non-empty URL
          for (const shelter of sheltersWithWebsite) {
            expect(shelter.website_url).not.toBeNull();
            expect(shelter.website_url).not.toBe("");
          }
        } finally {
          db.close();
        }
      }),
      { numRuns: 100 }
    );
  });
});
