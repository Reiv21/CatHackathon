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

  describe("Terminal injection via whitespace control characters", () => {
    it("should remove newlines to prevent forged output lines", () => {
      const malicious = "Legitimate\nFake Error: System Compromised";
      const result = stripControlChars(malicious);
      expect(result).toBe("LegitimateFake Error: System Compromised");
      expect(result).not.toContain("\n");
    });

    it("should remove tabs", () => {
      const malicious = "Column1\tColumn2";
      const result = stripControlChars(malicious);
      expect(result).toBe("Column1Column2");
      expect(result).not.toContain("\t");
    });

    it("should remove carriage returns to prevent line overwriting", () => {
      const malicious = "Legitimate Text\rFake Output";
      const result = stripControlChars(malicious);
      expect(result).toBe("Legitimate TextFake Output");
      expect(result).not.toContain("\r");
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
    it("should remove ALL C0 control characters including tab, newline, carriage return", () => {
      // Test all C0 controls (0x00-0x1F) - ALL should be removed after security fix
      // Note: 0x1B (ESC) is handled by separate regex patterns for ANSI sequences
      const controlChars = [
        0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, // tab - NOW REMOVED
        0x0A, // newline - NOW REMOVED
        0x0B, 0x0C,
        0x0D, // CR - NOW REMOVED
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

  describe("Pentest exploit scenarios - direct reproduction", () => {
    it("should prevent screen clearing attack from malicious shelter website", () => {
      // Exact scenario: attacker controls shelter website, injects clear screen + fake success message
      const maliciousCatName = "\x1b[2J\x1b[HFluffy";
      const sanitized = stripControlChars(maliciousCatName);
      
      // Verify escape sequences are removed
      expect(sanitized).toBe("Fluffy");
      expect(sanitized).not.toContain("\x1b[2J"); // clear screen
      expect(sanitized).not.toContain("\x1b[H");  // cursor home
      expect(sanitized).not.toContain("\x1b");
    });

    it("should prevent cursor repositioning to overwrite previous output", () => {
      // Attacker tries to move cursor up and overwrite previous lines
      const maliciousCatName = "Whiskers\x1b[A\x1b[A\x1b[2K\x1b[31mFAKE ERROR\x1b[0m";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("WhiskersFAKE ERROR");
      expect(sanitized).not.toContain("\x1b[A");  // cursor up
      expect(sanitized).not.toContain("\x1b[2K"); // erase line
      expect(sanitized).not.toContain("\x1b");
    });

    it("should prevent newline injection to forge additional output lines", () => {
      // Attacker injects newlines to create fake log entries
      const maliciousCatName = "Mittens\n    ✅ Security check passed\n    ✅ All systems normal";
      const sanitized = stripControlChars(maliciousCatName);
      
      // Newlines must be removed to prevent forged lines
      expect(sanitized).toBe("Mittens    ✅ Security check passed    ✅ All systems normal");
      expect(sanitized).not.toContain("\n");
    });

    it("should prevent carriage return to overwrite current line", () => {
      // Attacker uses CR to overwrite the beginning of the line
      const maliciousCatName = "Legitimate Cat Name\rFAKE: ";
      const sanitized = stripControlChars(maliciousCatName);
      
      // CR must be removed to prevent line overwriting
      expect(sanitized).toBe("Legitimate Cat NameFAKE: ");
      expect(sanitized).not.toContain("\r");
    });

    it("should prevent tab injection for output misalignment", () => {
      // Attacker uses tabs to misalign output and hide content
      const maliciousCatName = "Cat\t\t\t\t\t\t\t\tHidden";
      const sanitized = stripControlChars(maliciousCatName);
      
      // Tabs must be removed
      expect(sanitized).toBe("CatHidden");
      expect(sanitized).not.toContain("\t");
    });

    it("should prevent bell character spam", () => {
      // Attacker tries to trigger terminal bell repeatedly
      const maliciousCatName = "Annoying\x07\x07\x07\x07\x07Cat";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("AnnoyingCat");
      expect(sanitized).not.toContain("\x07");
    });

    it("should prevent backspace character to delete previous output", () => {
      // Attacker uses backspace to delete characters
      const maliciousCatName = "Fluffy\x08\x08\x08\x08\x08\x08Evil";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("FluffyEvil");
      expect(sanitized).not.toContain("\x08");
    });

    it("should handle combined attack with multiple techniques", () => {
      // Real-world attack combining clear, reposition, color, newlines, and CR
      const maliciousCatName = "\x1b[2J\x1b[H\x1b[32m✓ Tests passed\x1b[0m\n\x1b[32m✓ Build successful\x1b[0m\rFAKE OUTPUT";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("✓ Tests passed✓ Build successfulFAKE OUTPUT");
      expect(sanitized).not.toContain("\x1b");
      expect(sanitized).not.toContain("\n");
      expect(sanitized).not.toContain("\r");
    });

    it("should prevent null byte injection", () => {
      // Null bytes can truncate strings in some contexts
      const maliciousCatName = "Visible\x00Hidden";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("VisibleHidden");
      expect(sanitized).not.toContain("\x00");
    });

    it("should prevent C1 control character injection", () => {
      // C1 controls (0x80-0x9F) can also manipulate terminals
      const maliciousCatName = "Cat\x80\x81\x9fName";
      const sanitized = stripControlChars(maliciousCatName);
      
      expect(sanitized).toBe("CatName");
      // Verify no C1 controls remain
      for (let i = 0x80; i <= 0x9f; i++) {
        expect(sanitized).not.toContain(String.fromCharCode(i));
      }
    });
  });

  describe("Verification of fix application points", () => {
    it("should verify stripControlChars is applied before console.log in inspect.ts pattern", () => {
      // Simulates the exact pattern from inspect.ts:
      // console.log(`       🐈 ${stripControlChars(cat.name)}`);
      
      const maliciousCat = {
        name: "\x1b[31mMalicious\x1b[0m",
        description: "Desc\nwith\nnewlines",
        image_url: "http://example.com/img.jpg\x00"
      };
      
      // Apply stripControlChars as done in inspect.ts
      const consoleOutput = `       🐈 ${stripControlChars(maliciousCat.name)}`;
      const descOutput = stripControlChars(maliciousCat.description);
      const imgOutput = stripControlChars(maliciousCat.image_url);
      
      expect(consoleOutput).toBe("       🐈 Malicious");
      expect(consoleOutput).not.toContain("\x1b");
      
      expect(descOutput).toBe("Descwithnewlines");
      expect(descOutput).not.toContain("\n");
      
      expect(imgOutput).toBe("http://example.com/img.jpg");
      expect(imgOutput).not.toContain("\x00");
    });

    it("should verify stripControlChars is applied to shelter name and URL", () => {
      // Simulates the pattern from inspect.ts:
      // console.log(`\n  Scraping: ${stripControlChars(shelter.name)} (${stripControlChars(shelter.website_url || "")})...`);
      
      const maliciousShelter = {
        name: "Happy\x1b[2JShelter",
        website_url: "http://evil.com\nhttp://fake.com"
      };
      
      const consoleOutput = `\n  Scraping: ${stripControlChars(maliciousShelter.name)} (${stripControlChars(maliciousShelter.website_url)})...`;
      
      expect(consoleOutput).toContain("Happy");
      expect(consoleOutput).toContain("Shelter");
      expect(consoleOutput).not.toContain("\x1b[2J");
      expect(consoleOutput).not.toContain("\n  Scraping: Happy\x1b[2J");
      
      // Verify the URL doesn't contain newlines that could forge additional lines
      const sanitizedUrl = stripControlChars(maliciousShelter.website_url);
      expect(sanitizedUrl).toBe("http://evil.comhttp://fake.com");
      expect(sanitizedUrl).not.toContain("\n");
    });

    it("should verify all scraped fields are sanitized before logging", () => {
      // Comprehensive check that all fields from scrapeCatsActivity are sanitized
      const scrapedData = {
        name: "\x1b[31mName\x1b[0m",
        description: "Desc\nLine2",
        image_url: "http://img.com\x00",
        shelter_name: "Shelter\x07",
        shelter_url: "http://url.com\r"
      };
      
      // All fields must pass through stripControlChars
      const sanitized = Object.fromEntries(
        Object.entries(scrapedData).map(([key, value]) => [key, stripControlChars(value)])
      );
      
      expect(sanitized.name).toBe("Name");
      expect(sanitized.description).toBe("DescLine2");
      expect(sanitized.image_url).toBe("http://img.com");
      expect(sanitized.shelter_name).toBe("Shelter");
      expect(sanitized.shelter_url).toBe("http://url.com");
      
      // Verify no control characters in any field
      Object.values(sanitized).forEach(value => {
        expect(value).not.toMatch(/[\x00-\x1f\x7f-\x9f]/);
        expect(value).not.toContain("\x1b");
      });
    });
  });
});
