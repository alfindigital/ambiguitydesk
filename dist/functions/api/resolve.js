// AmbiguityDesk resolver — Cloudflare Pages Function.
// GET /api/resolve?q=<ticker|address>
//
// Live path: CMC /v1/dex/search (1 call, 1 credit) when env.CMC_API_KEY is set.
// Replay path: committed fixtures under /fixtures/<QUERY>.json served via
// env.ASSETS, so the desk still works after the key dies.
//
// Scoring contract (see README): score = liqUsd x uniqueTraders24h, both must
// be present and positive for a candidate to be pick-eligible. mcap is a
// sanity flag, never a sort key (it is trivially inflatable via supply).

const CMC_BASE = "https://pro-api.coinmarketcap.com";
const QUERY_RE = /^[A-Za-z0-9$.:_-]{1,32}$/;
const MCAP_LIQ_FLAG_RATIO = 1000;   // mc/liq beyond this = absurd, flag it
const THIN_POOL_USD = 10_000;       // below this the pool is a puddle
const CLOSE_CALL_MARGIN = 3;        // pick vs runner-up score ratio
const FAMILY_MIN_CHAINS = 3;        // same canonical cid on this many chains…
const FAMILY_LIQ_USD = 100_000;     // …each holding a pool this deep → multi-legit asset
const FARMING_TRADERS_PER_100K = 40;// ut24h per $100k liq above this = farmed-looking
const YOUNG_POOL_DAYS = 30;         // pools younger than this get the young-pool flag
const YOUNG_PENALTY = 0.5;          // effective-score multiplier for very young pools

// /v1/dex/search mixes real on-chain pools with off-chain app/CEX venues.
// Trader counts across venue types are not comparable, so app venues are
// split into their own bucket and can never win a pick.
const APP_VENUE_RE = /robinhood|coinbase|binance|kraken|bybit|bitget|kucoin|upbit|crypto\.com|revolut|etoro|paypal|venmo|cash\s*app|okx\b|mexc|gate\.io|bitstamp|bitfinex|gemini|htx|bithumb|bitflyer|lbank|bingx|bitmart|phemex|poloniex|bitvavo|wazirx|zebpay|coinDCX|indodax/i;
const classifyVenue = (plt) => (APP_VENUE_RE.test(String(plt ?? "")) ? "appvenue" : "dex");

const json = (data, status = 200, extra = {}) =>
  new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });

const num = (v) => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Bridge refs like "eth-0x6982….omft.near" map a token back to its origin
// address. Clustering key = the embedded bare address when one exists
// (any 0x40hex substring), else the address with chain prefixes and
// bridge-account suffixes stripped; non-EVM chains keep native form.
function clusterKey(address) {
  const a = String(address ?? "").trim().toLowerCase();
  const evm = a.match(/0x[a-f0-9]{40}/);
  if (evm) return evm[0];
  const m = a.match(/^(?:eth|evm|bsc|bnb|arb|base|poly|polygon|op|avax)-(.+?)(?:\.[a-z0-9_.-]+)?$/);
  return m ? m[1] : a;
}

function normalizeRow(t) {
  return {
    platform: String(t.plt ?? "unknown"),
    address: String(t.addr ?? ""),
    name: String(t.n ?? ""),
    symbol: String(t.s ?? ""),
    liqUsd: num(t.liq),
    uniqueTraders24h: num(t.ut24h),
    mcapUsd: num(t.mc),
    priceChange24h: num(t.pc24h),
    vol24hUsd: num(t.v24h),
    logo: typeof t.l === "string" && t.l ? t.l : null,
    cmcId: num(t.cid),
    // First-pool-created timestamp — an un-fakeable age signal. A clone can
    // farm wallets but cannot make its pool born in April 2023.
    firstPoolMs: num(t.fpct) ?? num(t.fpt),
    venue: classifyVenue(t.plt),
  };
}

function scoreOf(c) {
  if (c.liqUsd === null || c.uniqueTraders24h === null) return null;
  if (c.liqUsd <= 0 || c.uniqueTraders24h <= 0) return null;
  return c.liqUsd * c.uniqueTraders24h;
}

function flagsOf(c, nowMs) {
  const flags = [];
  if (c.mcapUsd !== null && c.liqUsd !== null && c.liqUsd > 0 && c.mcapUsd / c.liqUsd > MCAP_LIQ_FLAG_RATIO) flags.push("mcap-inflated");
  if (c.mcapUsd !== null && c.mcapUsd > 1e12) flags.push("mcap-inflated");
  if (c.liqUsd !== null && c.liqUsd < THIN_POOL_USD) flags.push("thin-pool");
  if (c.uniqueTraders24h === 0) flags.push("no-traders");
  if (c.liqUsd === null || c.uniqueTraders24h === null) flags.push("data-gap");
  // Farming signature: thousands of "unique" traders on a puddle-deep pool.
  // PI probe: clone had 8,255 traders on $83.7K liq (~9,860 per $100k);
  // real PEPE is ~1.6 per $100k.
  if (c.liqUsd !== null && c.liqUsd > 0 && c.uniqueTraders24h !== null
      && c.uniqueTraders24h / (c.liqUsd / 1e5) > FARMING_TRADERS_PER_100K) flags.push("possible-farming");
  // Age relative to capture time so replay stays deterministic forever.
  if (c.firstPoolMs !== null && nowMs !== null
      && nowMs - c.firstPoolMs < YOUNG_POOL_DAYS * 86400e3) flags.push("young-pool");
  if (c.venue === "appvenue") flags.push("offchain-venue");
  return [...new Set(flags)];
}

function fmtUsd(v) {
  if (v === null) return "unknown";
  if (v >= 1e15) return `$${v.toExponential(1)}`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function buildResult(query, rawRows, meta) {
  const rows = (Array.isArray(rawRows) ? rawRows : []).map(normalizeRow).filter((c) => c.address);
  const nowMs = meta?.capturedAt ? Date.parse(meta.capturedAt) : Date.now();
  const q = query.toLowerCase();
  // Exact-symbol match tolerates the $ prefix convention (dogwifhat is
  // literally "$WIF" in CMC data — a bare "wif" query must still hit it).
  const symNorm = (s) => s.toLowerCase().replace(/^\$/, "");
  const exact = rows.filter((c) => symNorm(c.symbol) === q && c.venue === "dex");
  const related = rows.filter((c) => symNorm(c.symbol) !== q && c.venue === "dex");
  const elsewhere = rows.filter((c) => c.venue === "appvenue");

  // Cluster same-contract rows across ALL candidates (bridged deployments,
  // e.g. 0x6982… on Ethereum/PulseChain/Unichain or "eth-0x…" refs on Near).
  const clusterOf = new Map();
  let clusterSeq = 0;
  const keyToCluster = new Map();
  for (const c of rows) {
    const k = clusterKey(c.address);
    if (!keyToCluster.has(k)) keyToCluster.set(k, `C${++clusterSeq}`);
    c.cluster = keyToCluster.get(k);
    const entry = clusterOf.get(c.cluster) ?? { id: c.cluster, platforms: [], addresses: new Set() };
    entry.platforms.push(c.platform);
    entry.addresses.add(c.address);
    clusterOf.set(c.cluster, entry);
  }

  for (const c of rows) {
    c.score = scoreOf(c);
    c.flags = flagsOf(c, nowMs);
    // Effective = ranking score after honesty penalties. Farmed/very-young
    // pools keep their raw score visible but get demoted for picking.
    c.effectiveScore = c.score === null ? null
      : c.score * (c.flags.includes("young-pool") ? YOUNG_PENALTY : 1);
    c.eligible = c.score !== null && c.venue !== "appvenue";
    c.bucket = c.venue === "appvenue" ? "elsewhere" : exact.includes(c) ? "exact" : "related";
  }

  // Sort: exact bucket first by score desc (ineligible last by liq desc),
  // related bucket after, same rule.
  const byScore = (a, b) =>
    (b.score ?? -1) - (a.score ?? -1) || (b.liqUsd ?? -1) - (a.liqUsd ?? -1);
  exact.sort(byScore);
  related.sort(byScore);
  elsewhere.sort(byScore);

  // Family detection: one canonical cmcId spread across ≥N chains, each with a
  // real pool → this is a legitimate multi-chain asset (USDT, WBTC). "Which is
  // the real one" is then the wrong question — render best-per-chain instead.
  const cidGroups = new Map();
  for (const c of exact) {
    if (c.cmcId === null || c.venue !== "dex") continue;
    const g = cidGroups.get(c.cmcId) ?? [];
    g.push(c);
    cidGroups.set(c.cmcId, g);
  }
  let family = null;
  for (const [cid, members] of cidGroups) {
    const fatChains = new Set(members.filter((c) => (c.liqUsd ?? 0) >= FAMILY_LIQ_USD).map((c) => c.platform));
    if (fatChains.size < FAMILY_MIN_CHAINS) continue;
    const perChain = new Map();
    for (const c of members.filter((m) => fatChains.has(m.platform))) {
      const prev = perChain.get(c.platform);
      if (!prev || (c.effectiveScore ?? -1) > (prev.effectiveScore ?? -1)) perChain.set(c.platform, c);
    }
    family = [...perChain.values()].sort((a, b) => (b.effectiveScore ?? -1) - (a.effectiveScore ?? -1));
    break;
  }

  // Pick = best-scoring cluster. Pool is the exact bucket; for address queries
  // nothing symbol-matches, so the whole result set is the pool instead.
  // Farmed candidates are fake evidence — excluded from pick eligibility,
  // unless every candidate is flagged (then the pick itself carries the flag).
  const pickBase = exact.length ? exact : rows;
  const pickDex = pickBase.filter((c) => c.venue === "dex");
  const unFarmed = pickDex.filter((c) => !c.flags.includes("possible-farming"));
  const pickPool = unFarmed.length ? unFarmed : pickDex;
  const pickAllFarmed = unFarmed.length === 0;
  let pick = null;
  const eligibleClusters = [...clusterOf.values()]
    .map((cl) => {
      const members = pickPool.filter((c) => c.cluster === cl.id);
      const best = members.reduce((m, c) => (c.effectiveScore !== null && (m === null || c.effectiveScore > m.effectiveScore) ? c : m), null);
      return best ? { cluster: cl, best, score: best.effectiveScore } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);

  if (eligibleClusters.length > 0) {
    const top = eligibleClusters[0];
    const runnerUp = eligibleClusters[1] ?? null;
    const marginX = runnerUp ? top.score / runnerUp.score : null;
    const label = runnerUp === null ? "only-candidate" : marginX >= CLOSE_CALL_MARGIN ? "clear-lead" : "close-call";
    const clusterNote = top.cluster.addresses.size > 1
      ? ` Same contract also listed on ${top.cluster.platforms.slice(1).join(", ")}.`
      : "";
    const farmNote = pickAllFarmed
      ? " Every pickable candidate shows a farming signature — treat all of them as suspect."
      : "";
    const reason = runnerUp
      ? `${fmtUsd(top.best.liqUsd)} pool depth x ${top.best.uniqueTraders24h} unique traders, ${marginX.toFixed(1)}x the runner-up.${clusterNote} Heuristic, not proof.${farmNote}`
      : `Only candidate with both liquidity and trader data.${clusterNote} Heuristic, not proof.${farmNote}`;
    pick = { candidate: top.best, marginX, label, reason, runnerUp: runnerUp?.best ?? null };
  }

  const chains = new Set(rows.map((c) => c.platform));
  const farmingFlagged = rows.filter((c) => c.flags.includes("possible-farming")).length;
  return {
    ok: true,
    query,
    endpoint: "/v1/dex/search",
    ...meta,
    resolution: rows.length === 0 ? "none" : family ? "family" : "pick",
    family,
    stats: {
      totalRows: rows.length,
      exactCount: exact.length,
      relatedCount: related.length,
      elsewhereCount: elsewhere.length,
      farmingFlagged,
      chainCount: chains.size,
      clusterCount: clusterSeq,
    },
    pick: family ? null : pick,
    candidates: [...exact, ...related, ...elsewhere],
  };
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get("q") ?? "").trim().replace(/^\$/, "");
  if (!raw || !QUERY_RE.test(raw)) {
    return json({ ok: false, error: "q must be a ticker or address (1-32 chars, letters/digits/$._:-)", query: raw }, 400);
  }

  const apiKey = context.env.CMC_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(`${CMC_BASE}/v1/dex/search?q=${encodeURIComponent(raw)}`, {
        headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" },
      });
      const text = await res.text();
      if (!res.ok) return json({ ok: false, error: `cmc http ${res.status}`, query: raw }, 502);
      const body = JSON.parse(text);
      const sha = await sha256Hex(text);
      return json(buildResult(raw, body?.data?.tks ?? [], {
        mode: "live",
        capturedAt: new Date().toISOString(),
        credits: body?.status?.credit_count ?? null,
        bodySha256: sha,
      }));
    } catch (e) {
      return json({ ok: false, error: `upstream failure: ${e instanceof Error ? e.message : e}`, query: raw }, 502);
    }
  }

  // Replay path: committed fixtures only, honest 404 when uncovered.
  // Dev/SPA fallback can return index.html with a 200 for missing assets —
  // require JSON content-type AND the fixture shape before trusting it.
  const fixtureUrl = new URL(`/fixtures/${encodeURIComponent(raw.toUpperCase())}.json`, url.origin);
  const asset = await context.env.ASSETS.fetch(new Request(fixtureUrl));
  const ct = asset.headers.get("content-type") ?? "";
  let fixture = null;
  if (asset.ok && ct.includes("json")) {
    try { fixture = await asset.json(); } catch { fixture = null; }
  }
  if (!fixture || !Array.isArray(fixture?.body?.data?.tks)) {
    return json({
      ok: false,
      error: "no live key configured and no committed fixture for this query",
      query: raw,
      fixturesNote: "replay covers only the committed example tickers",
    }, 404);
  }
  return json(buildResult(raw, fixture.body.data.tks, {
    mode: "replay",
    capturedAt: fixture.capturedAt ?? null,
    credits: fixture.credits ?? null,
    bodySha256: fixture.bodySha256 ?? null,
  }));
}
