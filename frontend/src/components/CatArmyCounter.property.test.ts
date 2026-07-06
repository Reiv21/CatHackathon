import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { formatCounterDisplay } from "./CatArmyCounter";

// Feature: hackathon-polish, Property 6: Counter display formatting
// **Validates: Requirements 5.2**
describe("Property 6: Counter display formatting", () => {
  const langArb = fc.constantFrom("pl" as const, "en" as const);
  const countArb = fc.integer({ min: 0, max: 10_000_000 });

  it("formatted output always contains the cat emoji 🐱", () => {
    fc.assert(
      fc.property(countArb, langArb, (count, lang) => {
        const result = formatCounterDisplay(count, lang);
        expect(result).toContain("🐱");
      }),
      { numRuns: 100 }
    );
  });

  it("formatted output contains correct label based on language", () => {
    fc.assert(
      fc.property(countArb, langArb, (count, lang) => {
        const result = formatCounterDisplay(count, lang);
        if (lang === "pl") {
          expect(result).toContain("Kocia Armia");
        } else {
          expect(result).toContain("Cat Army");
        }
      }),
      { numRuns: 100 }
    );
  });

  it("formatted output contains locale-formatted number representation", () => {
    fc.assert(
      fc.property(countArb, langArb, (count, lang) => {
        const result = formatCounterDisplay(count, lang);
        const locale = lang === "pl" ? "pl-PL" : "en-US";
        const expectedNumber = Math.floor(count).toLocaleString(locale);
        expect(result).toContain(expectedNumber);
      }),
      { numRuns: 100 }
    );
  });
});
