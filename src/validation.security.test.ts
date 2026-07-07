/**
 * Security tests for terminal escape injection mitigation.
 * 
 * Tests verify that the stripControlChars function properly sanitizes
 * terminal control sequences from scraped data to prevent terminal injection attacks.
 * 
 * Pentest finding: Terminal escape injection via unescaped scraped cat names
 */

import { describe, it, expect } from "vitest";
import { stripControlChars } from "./validation.js";

describe("stripControlChars - Terminal Escape Injection Mitigation", () => {
  
  describe("ANSI CSI escape sequences", () => {
    it("should remove ANSI clear screen sequence", () => {
      const malicious = "\x1b[2JCleared Screen";
      const result = stripControlChars(malicious);
      expect(result).toBe("Cleared Screen");
      expect(result).not.toContain("\x1b");
    });

    it("should remove ANSI cursor movement sequences", () => {
      const malicious = "\x1b[10;20HMoved Cursor";
      const result = stripControlChars(malicious);
      expect(result).toBe("Moved Cursor");
      expect(result).not.toContain("\x1b");
    });

    it("should remove ANSI color codes", () => {
      const malicious = "\x1b[31mRed Text\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("Red Text");
      expect(result).not.toContain("\x1b");
    });

    it("should remove ANSI erase line sequences", () => {
      const malicious = "\x1b[2KErase Line";
      const result = stripControlChars(malicious);
      expect(result).toBe("Erase Line");
      expect(result).not.toContain("\x1b");
    });

    it("should remove multiple ANSI sequences in one string", () => {
      const malicious = "\x1b[2J\x1b[H\x1b[31mMultiple\x1b[0m\x1b[1mSequences\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("MultipleSequences");
      expect(result).not.toContain("\x1b");
    });
  });

  describe("Other ESC sequences", () => {
    it("should remove ESC sequences without CSI", () => {
      const malicious = "\x1b7Save Cursor\x1b8";
      const result = stripControlChars(malicious);
      expect(result).toBe("Save Cursor");
      expect(result).not.toContain("\x1b");
    });

    it("should remove ESC with single character commands", () => {
      const malicious = "\x1bMReverse Index";
      const result = stripControlChars(malicious);
      expect(result).toBe("Reverse Index");
      expect(result).not.toContain("\x1b");
    });
  });

  describe("C0 control characters", () => {
    it("should remove null bytes", () => {
      const malicious = "Text\x00With\x00Nulls";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextWithNulls");
      expect(result).not.toContain("\x00");
    });

    it("should remove bell character", () => {
      const malicious = "Text\x07Bell";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextBell");
      expect(result).not.toContain("\x07");
    });

    it("should remove backspace character", () => {
      const malicious = "Text\x08Backspace";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextBackspace");
      expect(result).not.toContain("\x08");
    });

    it("should remove vertical tab", () => {
      const malicious = "Text\x0bVertical";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextVertical");
      expect(result).not.toContain("\x0b");
    });

    it("should remove form feed", () => {
      const malicious = "Text\x0cForm";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextForm");
      expect(result).not.toContain("\x0c");
    });

    it("should remove DEL character", () => {
      const malicious = "Text\x7fDelete";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextDelete");
      expect(result).not.toContain("\x7f");
    });
  });

  describe("C1 control characters", () => {
    it("should remove C1 control characters (0x80-0x9F)", () => {
      const malicious = "Text\x80\x81\x82\x9fC1";
      const result = stripControlChars(malicious);
      expect(result).toBe("TextC1");
      // Verify no C1 control characters remain
      for (let i = 0x80; i <= 0x9f; i++) {
        expect(result).not.toContain(String.fromCharCode(i));
      }
    });
  });

  describe("Preserved whitespace", () => {
    it("should preserve newlines", () => {
      const text = "Line 1\nLine 2";
      const result = stripControlChars(text);
      expect(result).toBe("Line 1\nLine 2");
      expect(result).toContain("\n");
    });

    it("should preserve tabs", () => {
      const text = "Column1\tColumn2";
      const result = stripControlChars(text);
      expect(result).toBe("Column1\tColumn2");
      expect(result).toContain("\t");
    });

    it("should preserve carriage returns", () => {
      const text = "Text\rWith\rCR";
      const result = stripControlChars(text);
      expect(result).toBe("Text\rWith\rCR");
      expect(result).toContain("\r");
    });

    it("should preserve spaces", () => {
      const text = "Text with spaces";
      const result = stripControlChars(text);
      expect(result).toBe("Text with spaces");
    });
  });

  describe("Real-world attack scenarios", () => {
    it("should prevent terminal screen clearing attack", () => {
      // Attacker tries to clear screen and show fake output
      const malicious = "\x1b[2J\x1b[H\x1b[32m✓ All tests passed\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("✓ All tests passed");
      expect(result).not.toContain("\x1b");
    });

    it("should prevent cursor repositioning to forge output", () => {
      // Attacker tries to move cursor up to overwrite previous lines
      const malicious = "Fluffy\x1b[A\x1b[2K\x1b[31mERROR: System compromised\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("FluffyERROR: System compromised");
      expect(result).not.toContain("\x1b");
    });

    it("should prevent hiding malicious content with color codes", () => {
      // Attacker tries to hide text by making it same color as background
      const malicious = "Whiskers\x1b[30;40mHIDDEN PAYLOAD\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("WhiskersHIDDEN PAYLOAD");
      expect(result).not.toContain("\x1b");
    });

    it("should handle cat name from pentest reproduction scenario", () => {
      // Simulates a malicious shelter website returning a cat name with escape sequences
      const maliciousCatName = "\x1b[2J\x1b[H\x1b[31mFake Error Message\x1b[0m";
      const result = stripControlChars(maliciousCatName);
      expect(result).toBe("Fake Error Message");
      expect(result).not.toContain("\x1b");
    });

    it("should handle complex multi-stage attack", () => {
      // Combines multiple techniques: clear, reposition, color, hide
      const malicious = "\x1b[2J\x1b[H\x1b[1;31m[CRITICAL]\x1b[0m System breach detected\x1b[8m(hidden)\x1b[0m";
      const result = stripControlChars(malicious);
      expect(result).toBe("[CRITICAL] System breach detected(hidden)");
      expect(result).not.toContain("\x1b");
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      const result = stripControlChars("");
      expect(result).toBe("");
    });

    it("should handle string with only control characters", () => {
      const malicious = "\x1b[2J\x1b[H\x00\x07\x08";
      const result = stripControlChars(malicious);
      expect(result).toBe("");
    });

    it("should handle normal text without control characters", () => {
      const normal = "Fluffy the Cat";
      const result = stripControlChars(normal);
      expect(result).toBe("Fluffy the Cat");
    });

    it("should handle Unicode characters", () => {
      const text = "Котик 🐈 Mruczek";
      const result = stripControlChars(text);
      expect(result).toBe("Котик 🐈 Mruczek");
    });

    it("should handle Polish diacritics", () => {
      const text = "Puszek ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ";
      const result = stripControlChars(text);
      expect(result).toBe("Puszek ąćęłńóśźż ĄĆĘŁŃÓŚŹŻ");
    });

    it("should handle very long strings with embedded escapes", () => {
      const longText = "A".repeat(1000) + "\x1b[31m" + "B".repeat(1000) + "\x1b[0m";
      const result = stripControlChars(longText);
      expect(result).toBe("A".repeat(1000) + "B".repeat(1000));
      expect(result).not.toContain("\x1b");
      expect(result.length).toBe(2000);
    });
  });

  describe("Comprehensive control character coverage", () => {
    it("should remove all C0 control characters except tab, newline, carriage return", () => {
      // Test all C0 controls (0x00-0x1F) except 0x09 (tab), 0x0A (newline), 0x0D (CR)
      // Note: 0x1B (ESC) is handled by separate regex patterns for ANSI sequences
      const controlChars = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        // 0x09 (tab) - preserved
        // 0x0A (newline) - preserved
        0x0B, 0x0C,
        // 0x0D (CR) - preserved
        0x0E, 0x0F, 0x10, 0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17,
        0x18, 0x19, 0x1A,
        // 0x1B (ESC) - handled by ANSI escape sequence patterns
        0x1C, 0x1D, 0x1E, 0x1F
      ];
      
      for (const code of controlChars) {
        const malicious = `Text${String.fromCharCode(code)}End`;
        const result = stripControlChars(malicious);
        expect(result).toBe("TextEnd");
        expect(result).not.toContain(String.fromCharCode(code));
      }
    });

    it("should preserve tab, newline, and carriage return", () => {
      const text = "Line1\nLine2\tColumn\rReturn";
      const result = stripControlChars(text);
      expect(result).toBe("Line1\nLine2\tColumn\rReturn");
      expect(result).toContain("\n");
      expect(result).toContain("\t");
      expect(result).toContain("\r");
    });
  });

  describe("Integration with console.log output", () => {
    it("should produce safe output for console.log", () => {
      // Simulates the exact scenario from the pentest finding
      const scrapedCatName = "\x1b[2J\x1b[H\x1b[31mMalicious Cat Name\x1b[0m";
      const sanitized = stripControlChars(scrapedCatName);
      
      // Verify the sanitized output is safe for console.log
      expect(sanitized).toBe("Malicious Cat Name");
      expect(sanitized).not.toMatch(/\x1b/);
      expect(sanitized).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/);
    });

    it("should sanitize description field", () => {
      const scrapedDescription = "Friendly cat\x1b[A\x1b[2K\x1b[31mFake error\x1b[0m";
      const sanitized = stripControlChars(scrapedDescription);
      
      expect(sanitized).toBe("Friendly catFake error");
      expect(sanitized).not.toContain("\x1b");
    });

    it("should sanitize image URL field", () => {
      const scrapedUrl = "https://example.com/cat.jpg\x1b[31m?malicious=true\x1b[0m";
      const sanitized = stripControlChars(scrapedUrl);
      
      expect(sanitized).toBe("https://example.com/cat.jpg?malicious=true");
      expect(sanitized).not.toContain("\x1b");
    });

    it("should sanitize shelter name field", () => {
      const scrapedShelterName = "Happy Shelter\x1b[2J\x1b[H";
      const sanitized = stripControlChars(scrapedShelterName);
      
      expect(sanitized).toBe("Happy Shelter");
      expect(sanitized).not.toContain("\x1b");
    });

    it("should sanitize city field", () => {
      const scrapedCity = "Warsaw\x00\x07\x1b[31m";
      const sanitized = stripControlChars(scrapedCity);
      
      expect(sanitized).toBe("Warsaw");
      expect(sanitized).not.toContain("\x1b");
      expect(sanitized).not.toContain("\x00");
      expect(sanitized).not.toContain("\x07");
    });
  });

  describe("Pentest reproduction scenarios", () => {
    it("should mitigate Step 3 from pentest - direct console.log injection", () => {
      // From pentest Step 3: cat.name is written directly to terminal
      // Simulates: console.log(`       🐈 ${cat.name}`);
      
      const maliciousCatName = "\x1b[2J\x1b[H\x1b[32m✓ Security check passed (fake)\x1b[0m";
      const sanitized = stripControlChars(maliciousCatName);
      const consoleOutput = `       🐈 ${sanitized}`;
      
      expect(consoleOutput).toBe("       🐈 ✓ Security check passed (fake)");
      expect(consoleOutput).not.toContain("\x1b");
    });

    it("should mitigate Step 2 from pentest - .text().trim() does not remove escapes", () => {
      // From pentest Step 2: .text().trim() only removes whitespace, not control chars
      // Simulates scraped HTML: <h2>\x1b[31mMalicious Name\x1b[0m</h2>
      
      const scrapedText = "\x1b[31mMalicious Name\x1b[0m".trim(); // .trim() doesn't help
      expect(scrapedText).toContain("\x1b"); // Vulnerability: escapes survive .trim()
      
      const sanitized = stripControlChars(scrapedText);
      expect(sanitized).toBe("Malicious Name");
      expect(sanitized).not.toContain("\x1b"); // Mitigation: stripControlChars removes them
    });

    it("should handle the complete source-to-sink path", () => {
      // Complete path: shelter.website_url → scrapeCatsActivity() → .text().trim() → console.log
      
      // Step 1: Malicious HTML from compromised shelter site
      const maliciousHtml = "<h2>\x1b[2J\x1b[H\x1b[31mEvil Cat\x1b[0m</h2>";
      
      // Step 2: Cheerio extracts text (simulated)
      const extractedText = "\x1b[2J\x1b[H\x1b[31mEvil Cat\x1b[0m".trim();
      
      // Step 3: Without mitigation, this would inject into terminal
      expect(extractedText).toContain("\x1b");
      
      // Step 4: With mitigation, stripControlChars is applied before console.log
      const sanitized = stripControlChars(extractedText);
      expect(sanitized).toBe("Evil Cat");
      expect(sanitized).not.toContain("\x1b");
      
      // Step 5: Safe to log
      const consoleOutput = `🐈 ${sanitized}`;
      expect(consoleOutput).toBe("🐈 Evil Cat");
    });
  });

  describe("Defense in depth - multiple fields", () => {
    it("should sanitize all fields that reach console.log", () => {
      // Simulates a complete cat record from scraping
      const scrapedCat = {
        name: "\x1b[31mMalicious Name\x1b[0m",
        description: "Description\x1b[A\x1b[2K",
        image_url: "http://example.com/cat.jpg\x00",
        shelter_name: "Shelter\x07",
        shelter_city: "City\x1b[H"
      };
      
      // All fields must be sanitized before logging
      const sanitized = {
        name: stripControlChars(scrapedCat.name),
        description: stripControlChars(scrapedCat.description),
        image_url: stripControlChars(scrapedCat.image_url),
        shelter_name: stripControlChars(scrapedCat.shelter_name),
        shelter_city: stripControlChars(scrapedCat.shelter_city)
      };
      
      expect(sanitized.name).toBe("Malicious Name");
      expect(sanitized.description).toBe("Description");
      expect(sanitized.image_url).toBe("http://example.com/cat.jpg");
      expect(sanitized.shelter_name).toBe("Shelter");
      expect(sanitized.shelter_city).toBe("City");
      
      // Verify no control characters remain
      Object.values(sanitized).forEach(value => {
        expect(value).not.toContain("\x1b");
        expect(value).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f-\x9f]/);
      });
    });
  });
});
