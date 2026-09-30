# AmbiguityDesk — Submission Kit

Everything below is copy-paste ready for the CMC API Hackathon form and the
announcement post.

---

## Form fields

- **Project name:** AmbiguityDesk
- **Track:** Markets and Trading Tools
- **Live demo:** https://ambiguitydesk.pages.dev
- **Public repo:** https://github.com/alfindigital/ambiguitydesk
- **Video:** upload `video/out/ambiguitydesk-demo.mp4` (80 s, 1080p, English VO)
  to YouTube / Google Drive and paste the link.

## Tagline

One ticker, thirty-two impostors. Type the ticker — get every token wearing it
across every chain, and the contract most worth inspecting.

## Submission description (long)

AmbiguityDesk answers the question every DEX user actually asks: "which PEPE /
TRUMP / WIF is the real one?"

Same-name scam tokens live on ticker collision. The tool calls
`GET /v1/dex/search?q=<ticker>`, lays out every deployment wearing that symbol,
and marks the best-supported candidate — with the evidence on the table, not a
black-box answer.

How it decides, in plain terms:

- **Score = pool liquidity × unique 24h traders**, the two numbers a clone
  cannot fake cheaply at scale.
- **Pool age bonus** — the real deployment was almost always born first;
  clones arrive yesterday.
- **Farming flag** — thousands of "unique traders" inside a dust-sized pool is
  a sybil signature, not organic demand. Flagged candidates are excluded from
  the pick.
- **Venue split** — CEX/app listings (e.g. Robinhood rows) are separated from
  on-chain candidates instead of silently outranking them.
- **Family mode** — USDT and WBTC are legitimately multi-chain. When one
  canonical CMC ID spans ≥3 well-funded chains, the honest answer is "real on
  every chain — pick your chain," not a fake single winner.

Every result links out to the chain explorer. The pick is labeled
**heuristic, not proof** — the tool shows receipts instead of claiming truth.

Built entirely on the public DEX API. No AI makes the call; deterministic rules
you can re-run and check. 48 captured query fixtures ship in the repo for
replay-based verification and tests (42 passing).

## Where the API got in the way

- **Venue mixing:** `/v1/dex/search` returns app/CEX venue rows next to on-chain
  pools (a Robinhood listing outranked the real ApeCoin until we split venues).
- **Query cap:** results cap at 50 rows per query — popular tickers get
  truncated, so coverage is query-bounded, not exhaustive.
- **Noisy market-cap field:** raw `mc` values arrive absurdly inflated
  (`1e23`-scale) for junk clones; we flag and de-format them rather than trust.
- **Farmable trader counts:** `ut24h` is reported, not verified — shallow pools
  with thousands of "traders" required a density heuristic, not a raw score.

## X post draft

> Built AmbiguityDesk for #BuildwithCMC — the tool for "which PEPE is the real
> one?"
>
> Type a ticker → every deployment wearing it across every chain, and the
> contract most worth trusting. Liquidity × unique traders, pool age, farming
> flags, CEX rows separated out. Heuristic, not proof — the evidence stays on
> the table.
>
> ambiguitydesk.pages.dev

## Video script (recorded VO)

- **S0 (title):** "AmbiguityDesk — which one is the real one?"
- **S1 (PEPE):** "Type a ticker. Every token wearing it appears across every
  chain — and the contract most worth trusting is marked."
- **S2 (WIF/clones):** "Clones can't fake deep liquidity and real traders. The
  evidence decides — not us."
- **S3 (USDT/family):** "Some tickers are legitimately multi-chain. USDT is
  real on twenty-six of them — pick your chain."
- **S4 (close):** "Free, open-source, deterministic. Built on the CoinMarketCap
  API."

## Manual check before submit

- [ ] https://ambiguitydesk.pages.dev/?q=pepe → BEST PICK card, explorer link
- [ ] https://ambiguitydesk.pages.dev/?q=usdt → MULTI-CHAIN ASSET family card
- [ ] https://ambiguitydesk.pages.dev/?q=ape → pick = ApeCoin (Ethereum),
      Robinhood under "listed elsewhere"
- [ ] https://ambiguitydesk.pages.dev/?q=pi → Pump Inu flagged possible-farming
- [ ] dark/light toggle works; `?` modal opens; GitHub icon top-right
