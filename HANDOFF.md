# HANDOFF — AmbiguityDesk

**Status: LIVE (live mode)** — https://ambiguitydesk.pages.dev · repo `alfindigital/ambiguitydesk` · Pages project `ambiguitydesk` on account `b534…3eaf` · `CMC_API_KEY` secret set 2026-09-30.

## What exists

| Piece | Path | State |
|---|---|---|
| Resolver Function | `functions/api/resolve.js` | ✅ tested (49 assertions) |
| UI (amber terminal) | `index.html`, `css/`, `js/` | ✅ deployed |
| Replay fixtures | `fixtures/` — 48 tickers, `bodyRaw` + sha256 | ✅ committed, byte-verifiable |
| Dist builder | `tools/build-dist.js` (whitelist) | ✅ |
| Tests | `tools/test-resolve.mjs` | ✅ 49/49 offline |
| Icons / logo | `icons/` (amber pick-row) + `logo-concepts/` (4 alternates) + `logo-480.png` | ✅ |
| Video | `video/out/` — `ambiguitydesk-demo.mp4` (Deepgram) + `-el-m`/`-el-f` (ElevenLabs eleven_v3) | ✅ rendered |
| Submission kit | `SUBMISSION.md` | ✅ |

## Rules version `2026-10-01.2` — post-audit fixes (external review)

- **Farming flag exempts deep pools** (liq ≥ $1M): Solana BONK origin ($6.3M)
  was farm-excluded while an ETH mirror won the pick. Now the origin wins.
- **No-exact ticker query → `resolution: "none"`** — a different symbol is
  never crowned. Only address-shaped queries pool the whole result set.
- **`pick: null` never reports `"pick"`** — resolution becomes `"none"` with a
  `noneReason` (`no-exact-symbol-match`, `all-candidates-farming-flagged`,
  `no-candidate-with-liquidity-and-trader-data`, …).
- **All-farmed → abstain**, not a flagged pick.
- **Address search works**: `QUERY_RE` 32→44 chars (full EVM 0x40hex + Solana
  base58); UI maxlength 44.
- **clusterKey preserves non-EVM casing** (Solana base58 is case-sensitive);
  cross-chain same-address clusters are labeled "relationship unverified".
- **Family requires positive cmcId** (`<=0`/null rejected).
- **Upstream hardening**: `limit=100`, 8s timeout, envelope validation
  (`error_code` is a STRING "0" in CMC payloads — compare as string),
  5-min in-memory cache + inflight dedup per isolate, `stale-replay`
  labeled fallback to fixtures on upstream failure.
- **Venue registry**: known chains / known app venues / `unmapped` (shown,
  pick-eligible, flagged `venue-unmapped`) instead of brand-regex only.
- **CSP**: inline theme script moved to `js/theme-boot.js` — `script-src
  'self'` no longer blocks theme boot.
- **Fixtures**: `bodyRaw` (raw bytes) stored so sha256 is re-verifiable —
  `receiptVerified` in the audit chip.

## Verified evidence

- `?q=pepe` live: pick = Ethereum PEPE 0x6982…, 100-row window.
- `?q=bonk` live: pick = Solana BONK `DezXAZ8z…` (origin), no farm flag.
- `?q=wif` live: canonical `$WIF` Solana wins.
- `?q=usdt` → family mode; `?q=dogs` → `none` (no eligible candidate).
- `?q=0x6982…933` (full EVM address) → 200, pick = that contract.
- Unknown ticker → 404 replay / honest error live.
- 49/49 offline tests; BONK/DEGEN/PI regression cases pinned.

## Ops notes

- Deploy: `node tools/build-dist.js && wrangler pages deploy dist --project-name ambiguitydesk`
- Non-interactive wrangler needs `CLOUDFLARE_ACCOUNT_ID=b534acd3a8238a6391b64da112d23eaf`.
- Re-capture fixtures (uses 1 credit per ticker): `node tools/capture-fixtures.mjs [TICKERS…]`
- ElevenLabs VO: `ELEVENLABS_API_KEY=… python video/scripts/gen-vo-eleven.py <voice_id> public/vo-el-X` — Brian `nPczCjzI2devNBz1zQrb` (m), Matilda `XrExE9yKIg1WjnnlVkGX` (f). Keys via env only.
- `wrangler pages dev` SPA-fallbacks missing assets to index.html — resolver validates content-type + fixture shape.
- `_headers` parsed at dev-server start — restart wrangler after editing.

## Known limits / next steps

1. Farming detection is still a density heuristic (thin-pool scoped) — a
   cohort-normalized band (per-chain peer percentiles) is the planned upgrade.
2. Identity provenance (issuer/bridge registry) not built — same-address
   clusters are labeled "unverified", family mode needs provenance edges.
3. Cache is per-isolate in-memory (5 min TTL) — no cross-region KV yet.
4. Video VO still says "the real one" in title line variants — copy updated in
   scripts; re-render picks it up.
5. Competitor delta: whichone.edycu.dev caps ~8 candidates on Nansen credits;
   this tool shows up to 100 rows from 1 CMC credit.

Not financial advice. An evidence desk, not a verdict.
