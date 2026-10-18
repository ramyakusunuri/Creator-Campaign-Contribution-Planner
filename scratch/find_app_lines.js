import fs from 'node:fs';

const lines = fs.readFileSync("storefront-app/src/app/app.js", "utf8").split("\n");
lines.forEach((l, idx) => {
  const lower = l.toLowerCase();
  if ((lower.includes("promo") || lower.includes("order")) && (lower.includes("fetch") || lower.includes("function") || lower.includes("api"))) {
    console.log(`${idx + 1}: ${l.trim()}`);
  }
});
