# AmbiguityDesk

**"PEPE yang mana yang asli?"** — a standalone ticker-collision resolver for DEX traders.

Type a ticker, get every token wearing it across every chain CoinMarketCap DEX
tracks, plus the address most worth trusting — labeled honestly as a heuristic,
never as proof.

Live: **https://ambiguitydesk.pages.dev**

Sibling project of Verdex (same evidence discipline, same "Evidence Desk"
visual language). Built on the CoinMarketCap DEX API.

## The problem

Hundreds of tokens share the same symbol. `PEPE` alone returns 32 exact-symbol
matches across 11 chains in a single `/v1/dex/search` call. Traders buy the
wrong one all the time. Existing resolvers are either static directories,
single-chain registries, or paid per-candidate lookups.

## What it does

1. Query `/v1/dex/search?q=<ticker>` — one call, one credit, up to 50 rows.
2. Split results into **exact-symbol matches** vs **related** (symbol/name
   contains the query but isn't an exact collision).
3. Cluster same-contract rows across chains (incl. bridge refs like
   `eth-0x6982….omft.near`), so a mirrored deployment can't fake a race.
4. Score each candidate: **`liquidity × unique-traders-24h`**, both
   provider-reported. Missing either → no score, no pick eligibility.
5. Stamp a **SAFEST PICK** with the margin over the runner-up's best cluster:
   `clear-lead` (≥3×), `close-call` (<3×, amber stamp), `only-candidate`.
6. Show the full exhibit table — every candidate, flags, explorer links,
   copyable addresses.

### Why `liq × ut24h` and not just one metric

Real data proved both single metrics are gameable:

- The real PEPE (Ethereum): `$34.16M liq × 554 ut24h`. A Solana clone:
  `$0.21M liq × 3,086 ut24h` — **more traders than the real one**. Sort by
  traders → recommend the clone. The product of the two wins 21×.
- One Arbitrum row reports `mc ≈ 1e23` — market cap is inflatable via supply,
  so it's a flag (`mcap-inflated`), never a sort key.

### Caveat, stated on every result

> Scored on observed liquidity × unique traders. A bought pool and farmed
> wallets can fake both. Read the table before trusting the stamp.

## Architecture

```
ambiguitydesk/
├── index.html                  # the desk
├── css/style.css               # Evidence Desk visual system (Verdex direction A)
├── js/app.js                   # fetch → states → exhibit rows (no framework)
├── functions/api/resolve.js    # Pages Function: CMC proxy + scoring + clustering
├── fixtures/*.json             # committed replay captures (PEPE, MOODENG, …)
├── fonts/                      # Fraunces VF + IBM Plex Mono + Archivo (local, no CDN)
├── icons/                      # generated PNGs (tools/make-icons.js)
├── tools/
│   ├── capture-fixtures.mjs    # live capture → fixture (needs CMC key)
│   ├── make-icons.js           # zero-dep PNG icon generator
│   ├── build-dist.js           # whitelist dist builder — see below
│   └── test-resolve.mjs        # offline resolver unit tests (26 assertions)
└── dist/                       # built artifact — the ONLY thing that deploys
```

**Live mode**: set `CMC_API_KEY` as a Pages secret → the Function calls CMC
server-side; the key never reaches the browser.

**Replay mode**: no key → the Function serves committed fixtures via
`env.ASSETS`. Unknown tickers get an honest 404, never invented data.

**Deploy whitelist**: `tools/build-dist.js` copies ONLY public files to
`dist/`. `README.md`, `HANDOFF.md`, `.env*`, and `tools/` never ship.

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

## Known limits

- One credit per live query; search is name/symbol/address substring, not
  semantic.
- `$`-prefixed symbols are normalized to the bare ticker (`$WIF` ≈ `WIF`).
- Rows without `liq` or `ut24h` are shown but can't be scored — they render
  `unknown` / `no score`, not zero.
- Replay mode covers only the 7 committed fixture tickers.

Not financial advice. An evidence desk, not a verdict.
