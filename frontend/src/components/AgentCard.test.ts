import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { truncateDescription } from "./AgentCard";

// Feature: tactical-cat-frontend, Property 11: Description truncation
describe("Property 11: Description truncation", () => {
  it("descriptions longer than 150 chars are truncated to 150 + ellipsis", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 151, maxLength: 500 }),
        (desc) => {
          const result = truncateDescription(desc);
          expect(result.length).toBe(151); // 150 chars + "…"
          expect(result.endsWith("…")).toBe(true);
          expect(result.slice(0, 150)).toBe(desc.slice(0, 150));
        }
      ),
      { numRuns: 100 }
    );
  });

  it("descriptions of 150 chars or fewer are displayed unchanged", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 150 }).filter((s) => s.trim().length > 0),
        (desc) => {
          const result = truncateDescription(desc);
          expect(result).toBe(desc);
        }
      ),
      { numRuns: 100 }
    );
  });

  it("empty or null descriptions show 'No intel available'", () => {
    expect(truncateDescription(null)).toBe("No intel available");
    expect(truncateDescription("")).toBe("No intel available");
    expect(truncateDescription("   ")).toBe("No intel available");
  });
});
