/**
 * Full pipeline: scrape + validate in one command.
 */
import { execSync } from "child_process";

console.log("=== Phase 1: Scraping ===\n");
execSync("npx tsx src/scraper-v4.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n=== Phase 2: Validation ===\n");
execSync("npx tsx src/validate-data.ts", { stdio: "inherit", cwd: process.cwd() });

console.log("\n✅ All done! Data is clean and ready.");
