import { readFileSync, writeFileSync } from "fs";

const shelters = JSON.parse(readFileSync("./data/shelters.json", "utf-8"));
const cleaned = shelters.map(({ cat_count, ...rest }: { cat_count?: number; [key: string]: unknown }) => rest);
writeFileSync("./data/shelters.json", JSON.stringify(cleaned, null, 2));
console.log(`Removed cat_count from ${cleaned.length} shelters.`);
