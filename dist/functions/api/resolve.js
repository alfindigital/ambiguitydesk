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
const QUERY_RE = /^[A-Za-z0-9$.:_-]{1,44}$/;
const EVM_ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
const BASE58_ADDR_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const MCAP_LIQ_FLAG_RATIO = 1000;   // mc/liq beyond this = absurd, flag it
const THIN_POOL_USD = 10_000;       // below this the pool is a puddle
const CLOSE_CALL_MARGIN = 3;        // pick vs runner-up score ratio
const FAMILY_MIN_CHAINS = 3;        // same canonical cid on this many chains…
const FAMILY_LIQ_USD = 100_000;     // …each holding a pool this deep → multi-legit asset
const FARMING_TRADERS_PER_100K = 40;// ut24h per $100k liq above this = farmed-looking
const FARMING_EXCLUDE_MAX_LIQ = 1_000_000; // farming = crowds on a puddle; a deep pool is evidence, not a farm
const YOUNG_POOL_DAYS = 30;         // pools younger than this get the young-pool flag
const YOUNG_PENALTY = 0.5;          // effective-score multiplier for very young pools

// Venue classification is a typed registry, not brand guessing. Known chain
// names → dex; known app/CEX venue names → appvenue (never pick-eligible);
// anything else → "unmapped" (kept, pick-eligible, but visibly flagged).
const APP_VENUE_NAMES = new Set([
  "robinhood", "coinbase", "binance", "kraken", "bybit", "bitget", "kucoin",
  "upbit", "crypto.com", "revolut", "etoro", "paypal", "venmo", "cash app",
  "okx", "mexc", "gate.io", "bitstamp", "bitfinex", "gemini", "htx",
  "bithumb", "bitflyer", "lbank", "bingx", "bitmart", "phemex", "poloniex",
  "bitvavo", "wazirx", "zebpay", "coindcx", "indodax",
]);
const KNOWN_CHAINS = new Set([
  "ethereum", "solana", "bsc", "bnb chain", "base", "arbitrum", "polygon",
  "avalanche", "avax", "optimism", "pulsechain", "unichain", "cronos",
  "fantom", "sui", "ton", "tron", "near", "aptos", "cardano", "hyperliquid",
  "linea", "mantle", "blast", "scroll", "zksync", "stellar", "algorand",
  "osmosis", "bitcoin", "xrpl", "sei", "injective", "celo", "moonbeam",
  "moonriver", "aurora", "gnosis", "kava", "harmony", "eos", "waves",
  "tezos", "flow", "hedera", "kaspa", "stacks", "manta", "mode", "zora",
  "taiko", "sonic", "berachain", "abstract", "world chain", "soneium",
  "core", "bob", "merlin chain", "polynomial", "polygon zkevm", "era",
]);
const APP_VENUE_RE = /robinhood|coinbase|binance|kraken|bybit|bitget|kucoin|upbit|crypto\.com|revolut|etoro|paypal|venmo|cash\s*app|okx\b|mexc|gate\.io|bitstamp|bitfinex|gemini|htx|bithumb|bitflyer|lbank|bingx|bitmart|phemex|poloniex|bitvavo|wazirx|zebpay|coindcx|indodax/i;
const classifyVenue = (plt) => {
  const p = String(plt ?? "").trim().toLowerCase();
  if (!p || p === "unknown") return "unmapped";
  if (KNOWN_CHAINS.has(p)) return "dex";
  if (APP_VENUE_NAMES.has(p) || APP_VENUE_RE.test(p)) return "appvenue";
  return "unmapped";
};

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
  const a = String(address ?? "").trim();
  // Bridge refs like "eth-0x6982….omft.near" embed their origin address —
  // cluster on the embedded 0x. Non-EVM addresses keep native casing
  // (Solana base58 is case-sensitive: AbCd and abcd are different mints).
  const evm = a.match(/0x[0-9a-fA-F]{40}/);
  if (evm) return evm[0].toLowerCase();
  const m = a.match(/^(?:eth|evm|bsc|bnb|arb|base|poly|polygon|op|avax)-(.+?)(?:\.[a-z0-9_.-]+)?$/i);
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
      && c.liqUsd < FARMING_EXCLUDE_MAX_LIQ
      && c.uniqueTraders24h / (c.liqUsd / 1e5) > FARMING_TRADERS_PER_100K) flags.push("possible-farming");
  // Age relative to capture time so replay stays deterministic forever.
  if (c.firstPoolMs !== null && nowMs !== null
      && nowMs - c.firstPoolMs < YOUNG_POOL_DAYS * 86400e3) flags.push("young-pool");
  if (c.venue === "appvenue") flags.push("offchain-venue");
  if (c.venue === "unmapped") flags.push("venue-unmapped");
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
  const exact = rows.filter((c) => symNorm(c.symbol) === q && c.venue !== "appvenue");
  const related = rows.filter((c) => symNorm(c.symbol) !== q && c.venue !== "appvenue");
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
    if (c.cmcId === null || c.cmcId <= 0 || c.venue === "appvenue") continue;
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

  // Pick = best-scoring cluster. Pool is the exact bucket; only ADDRESS
  // queries fall back to the whole result set (nothing symbol-matches there).
  // A ticker query with zero exact matches must NOT crown a different symbol —
  // "PEPE2.0" is not an answer to "PEPE".
  const isAddressQuery = EVM_ADDR_RE.test(query) || BASE58_ADDR_RE.test(query);
  const pickBase = exact.length ? exact : isAddressQuery ? rows : [];
  // Farmed candidates are fake evidence — excluded from pick eligibility.
  // If every candidate is flagged there is NO honest pick: the desk abstains
  // instead of crowning a suspect.
  const pickDex = pickBase.filter((c) => c.venue !== "appvenue");
  const pickPool = pickDex.filter((c) => !c.flags.includes("possible-farming"));
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
      ? ` Same address string also listed on ${top.cluster.platforms.slice(1).join(", ")} — relationship unverified.`
      : "";
    const reason = runnerUp
      ? `${fmtUsd(top.best.liqUsd)} pool depth x ${top.best.uniqueTraders24h} unique traders, ${marginX.toFixed(1)}x the runner-up.${clusterNote} Heuristic, not proof.`
      : `Only candidate with both liquidity and trader data.${clusterNote} Heuristic, not proof.`;
    pick = { candidate: top.best, marginX, label, reason, runnerUp: runnerUp?.best ?? null };
  }

  const chains = new Set(rows.map((c) => c.platform));
  const farmingFlagged = rows.filter((c) => c.flags.includes("possible-farming")).length;
  let noneReason = null;
  if (!family && !pick) {
    noneReason =
      rows.length === 0 ? "no-candidates"
      : !isAddressQuery && exact.length === 0 ? "no-exact-symbol-match"
      : pickDex.length === 0 ? "no-dex-candidates"
      : pickPool.length === 0 ? "all-candidates-farming-flagged"
      : "no-candidate-with-liquidity-and-trader-data";
  }
  return {
    ok: true,
    query,
    endpoint: "/v1/dex/search",
    ...meta,
    resolution: rows.length === 0 || (!family && !pick) ? "none" : family ? "family" : "pick",
    noneReason,
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

const RULES_VERSION = "2026-10-01.2";
const UPSTREAM_TIMEOUT_MS = 8000;
const UPSTREAM_LIMIT = 100;
const CACHE_TTL_MS = 5 * 60_000;
const CACHE_MAX = 64;
const upstreamCache = new Map(); // qLower → { t, payload }
const inflight = new Map();      // qLower → Promise<payload> (burst dedup)

async function fetchUpstream(raw, apiKey) {
  const key = raw.toLowerCase();
  const hit = upstreamCache.get(key);
  if (hit && Date.now() - hit.t < CACHE_TTL_MS) return { ...hit, cached: true };
  if (inflight.has(key)) return inflight.get(key);
  const job = (async () => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), UPSTREAM_TIMEOUT_MS);
    try {
      const res = await fetch(`${CMC_BASE}/v1/dex/search?q=${encodeURIComponent(raw)}&limit=${UPSTREAM_LIMIT}`, {
        headers: { "X-CMC_PRO_API_KEY": apiKey, Accept: "application/json" },
        signal: ctrl.signal,
      });
      const text = await res.text();
      if (!res.ok) throw new Error(`cmc http ${res.status}`);
      const body = JSON.parse(text);
      const errCode = body?.status?.error_code;
      if (errCode !== undefined && errCode !== null && String(errCode) !== "0")
        throw new Error(`cmc error ${errCode}: ${body?.status?.error_message ?? "unknown"}`);
      if (!Array.isArray(body?.data?.tks)) throw new Error("cmc payload missing data.tks");
      const payload = {
        rows: body.data.tks,
        credits: body?.status?.credit_count ?? null,
        capturedAt: new Date().toISOString(),
        bodySha256: await sha256Hex(text),
      };
      if (upstreamCache.size >= CACHE_MAX) upstreamCache.delete(upstreamCache.keys().next().value);
      upstreamCache.set(key, { t: Date.now(), ...payload });
      return payload;
    } finally {
      clearTimeout(timer);
      inflight.delete(key);
    }
  })();
  inflight.set(key, job);
  return job;
}

// Load a committed replay fixture. New-format fixtures keep the RAW response
// body (bodyRaw) so the stored sha256 is actually re-verifiable — old-format
// fixtures only kept the parsed body and report verified:false.
async function loadFixture(env, url, raw) {
  const fixtureUrl = new URL(`/fixtures/${encodeURIComponent(raw.toUpperCase())}.json`, url.origin);
  const asset = await env.ASSETS.fetch(new Request(fixtureUrl));
  const ct = asset.headers.get("content-type") ?? "";
  if (!asset.ok || !ct.includes("json")) return null;
  let fixture = null;
  try { fixture = await asset.json(); } catch { return null; }
  if (typeof fixture?.bodyRaw === "string") {
    const sha = await sha256Hex(fixture.bodyRaw);
    let rows = [];
    try { rows = JSON.parse(fixture.bodyRaw)?.data?.tks ?? []; } catch { return null; }
    return {
      rows,
      capturedAt: fixture.capturedAt ?? null,
      credits: fixture.credits ?? null,
      bodySha256: fixture.bodySha256 ?? sha,
      verified: fixture.bodySha256 ? sha === fixture.bodySha256 : false,
    };
  }
  if (Array.isArray(fixture?.body?.data?.tks)) {
    return {
      rows: fixture.body.data.tks,
      capturedAt: fixture.capturedAt ?? null,
      credits: fixture.credits ?? null,
      bodySha256: fixture.bodySha256 ?? null,
      verified: false,
    };
  }
  return null;
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const raw = (url.searchParams.get("q") ?? "").trim().replace(/^\$/, "");
  if (!raw || !QUERY_RE.test(raw)) {
    return json({ ok: false, error: "q must be a ticker or address (1-44 chars, letters/digits/$._:-)", query: raw }, 400);
  }

  const meta = {
    rulesVersion: RULES_VERSION,
    coverage: { requestedLimit: UPSTREAM_LIMIT, note: "query-bounded result set — completeness unknown" },
  };
  const apiKey = context.env.CMC_API_KEY;
  if (apiKey) {
    try {
      const up = await fetchUpstream(raw, apiKey);
      return json(buildResult(raw, up.rows, {
        ...meta,
        mode: up.cached ? "live (cached)" : "live",
        capturedAt: up.capturedAt,
        credits: up.credits,
        bodySha256: up.bodySha256,
      }));
    } catch (e) {
      // Explicit, labeled fallback: a committed replay fixture marked stale —
      // never dressed up as a live answer.
      const fx = await loadFixture(context.env, url, raw);
      if (fx) {
        return json(buildResult(raw, fx.rows, {
          ...meta,
          mode: "stale-replay",
          staleReason: `upstream failed: ${e instanceof Error ? e.message : e}`,
          capturedAt: fx.capturedAt,
          credits: fx.credits,
          bodySha256: fx.bodySha256,
          receiptVerified: fx.verified,
        }));
      }
      return json({ ok: false, error: `upstream failure: ${e instanceof Error ? e.message : e}`, query: raw }, 502);
    }
  }

  // Replay path: committed fixtures only, honest 404 when uncovered.
  const fx = await loadFixture(context.env, url, raw);
  if (!fx) {
    return json({
      ok: false,
      error: "no live key configured and no committed fixture for this query",
      query: raw,
      fixturesNote: "replay covers only the committed example tickers",
    }, 404);
  }
  return json(buildResult(raw, fx.rows, {
    ...meta,
    mode: "replay",
    capturedAt: fx.capturedAt,
    credits: fx.credits,
    bodySha256: fx.bodySha256,
    receiptVerified: fx.verified,
  }));
}
