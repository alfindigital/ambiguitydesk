# AmbiguityDesk — Tech Spec (v2)

> Brownfield upgrade ke resolver existing. Stack tetap: static HTML/CSS/JS +
> Cloudflare Pages Function (`functions/api/resolve.js`) + fixture replay via
> `env.ASSETS`. Harness semua di folder ini — tidak menyentuh verdex/ghosttape.

## Perubahan kontrak data

`normalizeRow` bertambah field (semua sudah ada di response `/v1/dex/search`):

```js
{
  ...,                      // field lama tidak berubah
  firstPoolMs: num(t.fpct) ?? num(t.fpt),  // umur pool — sinyal ortogonal
  cmcId: num(t.cid),                       // canonical link (shared cid = aset sama)
  venue: classifyVenue(t.plt),             // "dex" | "appvenue"
}
```

`classifyVenue`: allowlist chain DEX (ethereum, solana, base, bsc, arbitrum, polygon,
optimism, avalanche, tron, pulsechain, unichain, sui, near, aptos, ton, cronos,
fantom, linea, mantle, blast, scroll, zksync, gnosis, celo, sonic, berachain,
hyperevm, plasma, monad, injective, sei, starknet, cardano, algorand, hedera,
bitcoin, litecoin, dogecoin, xrp — + `okx-dex`/`jupiter`-style DEX venue names yang
muncul di data) → `dex`; platform yang match `/robinhood|coinbase|binance|kraken|
okx|bybit|bitget|kucoin|upbit|crypto\.com|revolut|etoro|paypal|venmo|cashapp/i`
→ `appvenue`; tak dikenal → `dex` (fail-open: salah-split lebih aman daripada
menyembunyikan pool on-chain).

## Konstanta baru (dikalibrasi dari fixture, dipin di test)

```js
const FAMILY_MIN_CHAINS = 3;          // ≥3 chain distinct exact-symbol
const FAMILY_LIQ_USD    = 100_000;    // tiap chain harus punya pool "nyata"
const FARMING_TRADERS_PER_100K = 40;  // ut24h / (liq/1e5) > ini → possible-farming
const YOUNG_POOL_DAYS   = 30;         // firstPoolMs < now−30d → young-pool flag
const AGE_BONUS         = 1.5;        // skor × ini kalau umur > median lineup
```

## Algoritma pick (3 sinyal, tetap deterministik)

```text
score = liqUsd × uniqueTraders24h            (basis, tidak berubah)
effective = score × (age > median ? AGE_BONUS : 1)
            × (possible-farming ? FARM_PENALTY=0.5 : 1)
```

- Eligibility & clustering tidak berubah (same-contract cross-chain tetap cluster).
- `possible-farming` TIDAK mendiskualifikasi — hanya penalti + flag merah di UI
  (bukti: PI clone ut24h 8.255 / liq $83.7K = ~9.860 per $100k → tertangkap;
  PEPE asli 557 / $34.16M = ~1.6 → aman).
- **Family mode**: jika ≥`FAMILY_MIN_CHAINS` platform distinct punya kandidat
  exact `liqUsd ≥ FAMILY_LIQ_USD` → `result.mode = "family"`, payload
  `family: [{platform, bestRow}]` per chain diurutkan score; `pick = null`.
- Venue `appvenue` → `bucket: "elsewhere"`, dieksklusi dari `pickPool`,
  tetap dirender di section bawah dengan label "listed elsewhere".
- `pick.label` bertambah `"family"`; copy "SAFEST PICK" → "BEST-SUPPORTED
  CANDIDATE — heuristic, not proof" (resolver `pick.headline`, bukan hanya UI).

## Response shape (additive — UI lama masih baca field lama)

```js
{
  mode: "pick" | "family",
  pick: {...} | null,             // null saat family
  family: [{platform, name, symbol, address, liqUsd, uniqueTraders24h, score}] | null,
  candidates: [...],              // bucket: "exact"|"related"|"elsewhere"
  stats: {..., farmingFlagged: n, venueFiltered: n},
  evidence: {...}                 // receipts tidak berubah
}
```

## Fixture corpus (capture sebelum key mati — URGENT)

Target minimal 15 ticker: yang sudah ada (PEPE, TRUMP, WIF, W, CAT, BONK,
MOODENG) + capture baru: **USDT, WBTC, PI, APE, LINK** (edge cases audit) +
**SOL, USDC, DOGE, SHIB, WLFI, FARTCOIN** (ticker umum demo). ~11 call live.

## Test plan (`tools/test-resolve.mjs`)

- USDT → `mode:"family"`, ≥3 family rows, pick null
- WBTC → family ATAU pick dengan margin kecil ter-render jujur (assert perilaku aktual)
- APE → Robinhood row `bucket:"elsewhere"`, pick dari DEX pool
- PI → row farming `flags` mengandung `possible-farming`, dan tidak jadi pick tanpa note
- WIF → `$WIF` canonical tetap menang (regresi)
- PEPE → Ethereum menang + age signal menaikkan jarak vs clone
- Unknown → 404; fixture korup → 404 (bukan 500)

## Risiko teknis

- `fpct`/`fpt` absen di sebagian row → `firstPoolMs:null`, age-signal skip (no penalty).
- `cid` shared bukan jaminan canonical — dipakai hanya sebagai tiebreak, tidak standalone.
- Threshold farming perlu kalibrasi dari fixture real — angka final dipin oleh test,
  tidak di-hardcode buta.
