// Capture ticker-collision fixtures from /v1/dex/search while the key is alive.
// Usage: node tools/capture-fixtures.mjs   (reads CMC_API_KEY from ../verdex/.env.local or env)
// Output: fixtures/<query>.json — { query, endpoint, capturedAt, httpStatus, credits, bodySha256, body }
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "fixtures");
const QUERIES = process.argv.slice(2).length
  ? process.argv.slice(2).map((s) => s.toUpperCase())
  : existsSync(OUT)
    ? readdirSync(OUT).filter((f) => f.endsWith(".json")).map((f) => f.replace(/\.json$/, ""))
    : ["PEPE", "MOODENG", "TRUMP", "WIF", "W", "BONK", "CAT"];
const BASE = "https://pro-api.coinmarketcap.com";

function loadKey() {
  if (process.env.CMC_API_KEY) return process.env.CMC_API_KEY.trim();
  const envPath = path.resolve(ROOT, "../verdex/.env.local");
  if (existsSync(envPath)) {
    const m = readFileSync(envPath, "utf8").match(/CMC_API_KEY=(.+)/);
    if (m) return m[1].trim();
  }
  return null;
}

const key = loadKey();
if (!key) { console.error("CMC_API_KEY not found"); process.exit(2); }

mkdirSync(OUT, { recursive: true });
for (const q of QUERIES) {
  const url = `${BASE}/v1/dex/search?q=${encodeURIComponent(q)}&limit=100`;
  try {
    const res = await fetch(url, { headers: { "X-CMC_PRO_API_KEY": key, Accept: "application/json" } });
    const text = await res.text();
    const sha = createHash("sha256").update(text, "utf8").digest("hex");
    let body = null;
    try { body = JSON.parse(text); } catch { body = null; }
    const credits = body?.status?.credit_count ?? null;
    const rows = body?.data?.tks?.length ?? 0;
    // bodyRaw is the exact upstream bytes — replay can re-hash and VERIFY the
    // stored sha256 instead of trusting it on faith.
    const fixture = {
      query: q,
      endpoint: "/v1/dex/search?limit=100",
      capturedAt: new Date().toISOString(),
      httpStatus: res.status,
      credits,
      bodySha256: sha,
      bodyRaw: text,
    };
    writeFileSync(path.join(OUT, `${q}.json`), JSON.stringify(fixture, null, 2) + "\n", "utf8");
    console.log(`${q.padEnd(8)} rows=${String(rows).padEnd(3)} credits=${credits} sha=${sha.slice(0, 12)}…`);
  } catch (e) {
    console.log(`${q} FAILED ${e instanceof Error ? e.message : e}`);
  }
  await new Promise((r) => setTimeout(r, 250));
}
console.log("done →", OUT);
