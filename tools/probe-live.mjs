// Live audit probe: run queries through the REAL resolver (onRequestGet)
// against live CMC — not fixtures. Evidence lands in audit/probe-<Q>.json.
//   node tools/probe-live.mjs USDT APE TRUMP
import { onRequestGet } from "../functions/api/resolve.js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const OUT = path.join(ROOT, "audit");
const envFile = path.join(ROOT, "..", "verdex", ".env.local");

const envText = readFileSync(envFile, "utf8");
const key = envText.match(/CMC_API_KEY\s*=\s*["']?([^\s"']+)/)?.[1];
if (!key) { console.error("no CMC_API_KEY in verdex/.env.local"); process.exit(1); }

const queries = process.argv.slice(2);
if (!queries.length) { console.error("usage: node tools/probe-live.mjs <Q...>"); process.exit(1); }

mkdirSync(OUT, { recursive: true });
const ctx = (q) => ({
  request: { url: `http://audit.local/api/resolve?q=${encodeURIComponent(q)}` },
  env: {
    CMC_API_KEY: key,
    ASSETS: { fetch: async () => new Response("nf", { status: 404 }) },
  },
});

for (const q of queries) {
  const res = await onRequestGet(ctx(q));
  const body = await res.json();
  const file = path.join(OUT, `probe-${q.toUpperCase()}.json`);
  writeFileSync(file, JSON.stringify(body, null, 2));
  const p = body.pick;
  console.log(
    `${q.padEnd(10)} ${res.status} | rows=${body.stats?.totalRows ?? "-"} exact=${body.stats?.exactCount ?? "-"} chains=${body.stats?.chainCount ?? "-"} | ` +
    (p ? `pick=${p.candidate.platform} ${p.candidate.name} ${p.label} ${p.marginX ? p.marginX.toFixed(1) + "x" : "-"}` : `err=${body.error}`),
  );
}
