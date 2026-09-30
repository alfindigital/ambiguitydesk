# AmbiguityDesk

**"PEPE yang mana yang asli?"** — a standalone ticker-collision resolver for DEX traders.

Type a ticker, get every token wearing it across every chain CoinMarketCap DEX
tracks, plus the address most worth trusting — labeled honestly as a heuristic,
never as proof.

Live: **https://ambiguitydesk.pages.dev** · Repo: `github.com/alfindigital/ambiguitydesk`

Sibling project of Verdex (same evidence discipline, same "Evidence Desk"
visual language). Built on the **CoinMarketCap DEX API**.

## The problem

Hundreds of tokens share the same symbol. `PEPE` alone returns 32 exact-symbol
matches across 11 chains in a single `/v1/dex/search` call. Traders buy the
wrong one all the time. Existing resolvers are either static directories,
single-chain registries, or paid per-candidate lookups.

## What it does (v2)

1. Query `/v1/dex/search?q=<ticker>` — one call, one credit, up to 50 rows.
2. Split results into **exact-symbol matches** vs **related**, and cut
   **off-chain venue rows** (Robinhood & friends — `/v1/dex/search` mixes them
   with DEX pools; trader counts aren't comparable across venue types).
3. Cluster same-contract rows across chains (incl. bridge refs like
   `eth-0x6982….omft.near`), so a mirrored deployment can't fake a race.
4. Score each candidate: **`liquidity × unique-traders-24h`**, then apply
   honesty penalties — `young-pool` (<30 days since `fpct`/`fpt`) halves the
   effective score, `possible-farming` (traders-per-$100k-liquidity anomaly)
   removes pick eligibility entirely.
5. Detect **canonical multi-chain assets**: when one `cid` shows deep pools on
   ≥3 chains, the answer isn't "the real one" — it's **family mode**, best pool
   per chain. Asking "which USDT is real" is the wrong question.
6. Stamp a **BEST-SUPPORTED CANDIDATE** (`clear-lead` ≥3×, `close-call`,
   `only-candidate`) — heuristic, not proof — and show the full exhibit table
   with flags, explorer links, copyable addresses.

### Why the pick is a 3-signal read, not one number

Real data proved single metrics are gameable:

- The real PEPE (Ethereum): `$34.16M liq × 554 ut24h`. A Solana clone:
  `$0.21M liq × 3,086 ut24h` — **more traders than the real one**. Sort by
  traders → recommend the clone. The product of the two wins 21×.
- PI: a "Pump Inu" clone carried **8,255 unique traders on an $83.7K pool** —
  a textbook farming signature. It now gets `possible-farming` and is
  excluded from the pick.
- Pool age (`fpct`/`fpt`) can't be bought: the real PEPE's pool is from April
  2023; clones were born last week.
- One Arbitrum row reports `mc ≈ 1e23` — market cap is inflatable via supply,
  so it's a flag (`mcap-inflated`), never a sort key.

### Caveat, stated on every result

> Scored on observed liquidity × unique traders. A bought pool and farmed
> wallets can fake both. Read the table before trusting the stamp.

## CMC API usage (named endpoints)

- `GET /v1/dex/search?q=<ticker|address>` — the whole collision map in **one
  call / one credit**. Fields used per row: `plt`, `addr`, `n`, `s`, `liq`,
  `ut24h`, `mc`, `pc24h`, `v24h`, `l`, `cid`, `fpt`, `fpct`.

**Evidence of a real call:** `functions/api/resolve.js` calls
`https://pro-api.coinmarketcap.com/v1/dex/search` server-side with
`X-CMC_PRO_API_KEY`, returns `{ bodySha256, credits, capturedAt }` per query,
and every fixture in `fixtures/` is a sha256-hashed raw response body
(`fixtures/PEPE.json` → `body.data.tks`, 50 rows, `credit_count: 1`).

### What the API made possible — and where it got in the way

Made possible: multi-chain breadth in a single cheap call, and `ut24h`
(unique traders) — a field DexScreener/GeckoTerminal don't expose.

Got in the way (feedback for the API team):
- `/v1/dex/search` mixes **off-chain venues** (Robinhood…) with DEX pools —
  `ut24h` across venue types isn't comparable; a `venueType` field would fix it.
- Results are **capped at 50 rows** — for mega-collisions (USDT: 48 chains)
  the tail is invisible.
- `mc` is supply-inflatable and arrives dirty (`1e23`); a sanity flag helps.

## Architecture

```
ambiguitydesk/
├── index.html                  # the desk
├── css/style.css               # Evidence Desk visual system (Verdex direction A)
├── js/app.js                   # fetch → states → exhibit rows (no framework)
├── functions/api/resolve.js    # Pages Function: CMC proxy + scoring + clustering
├── fixtures/*.json             # 18 committed replay captures (sha256'd raw bodies)
├── specs/                      # PRODUCT_SPEC + TECH_SPEC (v2 upgrade)
├── audit/probe-*.json          # live-probe evidence from the deep audit
├── fonts/ icons/
├── tools/
│   ├── capture-fixtures.mjs    # live capture → fixture (needs CMC key)
│   ├── make-icons.js           # zero-dep PNG icon generator
│   ├── probe-live.mjs          # run queries through the resolver live
│   ├── build-dist.js           # whitelist dist builder — see below
│   └── test-resolve.mjs        # offline resolver unit tests (42 assertions)
└── dist/                       # built artifact — the ONLY thing that deploys
```

**Live mode**: set `CMC_API_KEY` as a Pages secret → the Function calls CMC
server-side; the key never reaches the browser.

**Replay mode**: no key → the Function serves committed fixtures via
`env.ASSETS`. Unknown tickers get an honest 404, never invented data.

**Deploy whitelist**: `tools/build-dist.js` copies ONLY public files to
`dist/`. Docs, `.env*`, and `tools/` never ship.

## Commands

```bash
node tools/test-resolve.mjs          # offline tests (no key needed)
node tools/build-dist.js             # build dist/
wrangler pages dev dist              # local preview → http://127.0.0.1:8788
wrangler pages deploy dist --project-name ambiguitydesk
```

## Design

Inherits Verdex "Evidence Desk" (direction A): Fraunces display, IBM Plex Mono
for data, warm-green dark palette, exhibit numbering, rotated paper stamp.
Dials: ENERGY 2 · RHYTHM 2 · MOTION 1. Dark only. No gradients, no glow, no
fake terminal chrome.

## Deliberately no AI

The pick is a ranking, not a judgment — determinism is the product. Every
number in the UI traces to a sha256-hashed response body you can replay.

## Known limits

- One credit per live query; search is name/symbol/address substring, not
  semantic. Coverage is DEX-visible only — CEX-native assets (e.g. Pi Network)
  may be underrepresented.
- `$`-prefixed symbols are normalized to the bare ticker (`$WIF` ≈ `WIF`).
- Rows without `liq` or `ut24h` are shown but can't be scored — they render
  `unknown` / `no score`, not zero.
- Replay mode covers only the committed fixture tickers.
- The heuristic can't prove authenticity — it shows the best-supported
  candidate and flags the ones that look bought.

Not financial advice. An evidence desk, not a verdict.
