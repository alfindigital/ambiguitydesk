// Whitelist dist builder: ONLY listed paths ship to Cloudflare Pages.
// Anything new that isn't listed here does not deploy. That is the point.
//   node tools/build-dist.js
import { cpSync, mkdirSync, rmSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, "dist");

const WHITELIST = [
  "index.html",
  "manifest.webmanifest",
  "_headers",
  "css",
  "js",
  "fonts",
  "icons",
  "fixtures",   // public market data, replay mode
  "functions",  // Pages Functions (api/resolve)
];

rmSync(DIST, { recursive: true, force: true });
mkdirSync(DIST, { recursive: true });
for (const entry of WHITELIST) {
  cpSync(path.join(ROOT, entry), path.join(DIST, entry), { recursive: true });
}
console.log("dist whitelist:", WHITELIST.join(", "));
console.log("shipped:", readdirSync(DIST).join(", "));
