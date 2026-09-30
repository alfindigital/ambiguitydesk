# HANDOFF — AmbiguityDesk

**Status: LIVE** — https://ambiguitydesk.pages.dev (deployed 2026-09-30, project `ambiguitydesk` on account `b534…3eaf`)

## What exists

| Piece | Path | State |
|---|---|---|
| Resolver Function | `functions/api/resolve.js` | ✅ tested (26 assertions) |
| UI (Evidence Desk / Verdex A) | `index.html`, `css/`, `js/` | ✅ verified in browser |
| Replay fixtures | `fixtures/` — PEPE, MOODENG, TRUMP, WIF, W, BONK, CAT | ✅ committed (7 tickers) |
| Dist builder | `tools/build-dist.js` (whitelist) | ✅ |
| Tests | `tools/test-resolve.mjs` | ✅ 26/26 offline |
| Icons | `tools/make-icons.js` → `icons/` | ✅ generated, zero-dep |
| Prod deploy | `wrangler pages deploy dist` | ✅ done, replay mode |

## Verified evidence (not just "it compiles")

- `?q=pepe` prod: 50 candidates, 32 exact, pick = Ethereum PEPE, `clear-lead` 21.5×.
- `?q=wif`: canonical **dogwifhat `$WIF`** wins (1740×) — the `$`-prefix
  normalization fix matters: without it a pump.fun clone ($20K liq, 529 ut24h)
  took the pick.
- `?q=moodeng`: legit multi-chain case — Solana Moo Deng wins 28.4×, runner-up
  is a different contract, no false scam labels.
- Unknown ticker → honest 404 (checked on prod).
- Console clean on prod. CSP + nosniff + DENY headers live.
- Responsive: 360 / 390 / 820 (cards) / 1280 (full 9-col table).
- Keyboard Enter + reduced-motion verified.

## Live mode (not yet enabled)

Prod runs **replay mode** — no `CMC_API_KEY` secret set yet. To go live:

```bash
wrangler pages secret put CMC_API_KEY --project-name ambiguitydesk
```

Wrangler account env needed in non-interactive shells:
`CLOUDFLARE_ACCOUNT_ID=b534acd3a8238a6391b64da112d23eaf` (personal account;
`Archived` account also exists — do not use it).

## Known limits / next steps

1. Replay covers 7 fixture tickers only; unknown queries 404 honestly.
2. `mcap-inflated` flag threshold is `mc/liq > 1000` or `mc > 1e12` — heuristic,
   may need tuning for tiny legit pools.
3. No caching on `/api/resolve` live path — every query = 1 credit. Consider
   Pages KV cache keyed by query if traffic matters.
4. Logo URLs are provider-supplied; `ipfs://` logos are skipped (not loadable).
5. Competitor check done 2026-09-30: whichone.edycu.dev caps ~8 candidates on
   Nansen credits; this tool shows all 50 rows from 1 CMC credit.

## Session notes

- Dev-mode gotcha: `wrangler pages dev` SPA-fallbacks missing assets to
  `index.html` with 200 — resolver validates content-type + fixture shape,
  never trusts `asset.ok` alone.
- `_headers` is parsed at dev-server start — restart wrangler after editing it.
