import { readFileSync } from "fs";

const cats = JSON.parse(readFileSync("./data/cats.json", "utf-8"));

console.log("Total cats:", cats.length);
console.log("");

// Group by city
const byCity: Record<string, number> = {};
cats.forEach((c: { shelter_city: string }) => {
  byCity[c.shelter_city] = (byCity[c.shelter_city] || 0) + 1;
});
const sorted = Object.entries(byCity).sort((a, b) => (b[1] as number) - (a[1] as number));
console.log("Top cities:");
sorted.slice(0, 15).forEach(([city, count]) => console.log("  ", city, ":", count));
console.log("");

// Quality checks
const noImage = cats.filter((c: { image_url: string | null }) => !c.image_url).length;
const noDesc = cats.filter((c: { description: string }) => !c.description || c.description === "").length;
const longName = cats.filter((c: { name: string }) => c.name.length > 60).length;
const hasEmoji = cats.filter((c: { name: string }) => /[\u{1F600}-\u{1FFFF}]/u.test(c.name)).length;
const duplicates = cats.length - new Set(cats.map((c: { name: string; shelter_id: number }) => c.name + "|" + c.shelter_id)).size;

console.log("Quality issues:");
console.log("  No image:", noImage);
console.log("  No description:", noDesc);
console.log("  Name > 60 chars:", longName);
console.log("  Name has emoji:", hasEmoji);
console.log("  Duplicates (same name+shelter):", duplicates);
console.log("");

// Sample problematic entries
console.log("Sample long/weird names:");
cats
  .filter((c: { name: string }) => c.name.length > 50 || /[!❤🚨📣]/.test(c.name))
  .slice(0, 15)
  .forEach((c: { shelter_city: string; name: string }) =>
    console.log("  [" + c.shelter_city + "]", c.name.slice(0, 80))
  );

console.log("");
console.log("Sample entries without image (first 10):");
cats
  .filter((c: { image_url: string | null }) => !c.image_url)
  .slice(0, 10)
  .forEach((c: { shelter_city: string; name: string }) =>
    console.log("  [" + c.shelter_city + "]", c.name)
  );
