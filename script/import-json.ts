import fs from "node:fs";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "db.json");

console.log("Checking db.json...");
console.log("Path:", dbPath);

if (!fs.existsSync(dbPath)) {
  throw new Error(`db.json not found at: ${dbPath}`);
}

const raw = fs.readFileSync(dbPath, "utf8");
const data = JSON.parse(raw);

console.log("✅ db.json loaded successfully.");
console.log("Top-level collections:");

for (const [key, value] of Object.entries(data)) {
  if (Array.isArray(value)) {
    console.log(`- ${key}: ${value.length} records`);
  } else {
    console.log(`- ${key}: ${typeof value}`);
  }
}