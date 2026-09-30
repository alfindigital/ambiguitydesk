# AmbiguityDesk — Product Spec (v2 brownfield upgrade)

> Tanggal: 2026-09-30. Status: APPROVED scope via interview.
> Konteks: post-audit upgrade sebelum submit DoraHacks "Build with CMC" (deadline 30 Sep 23:59 UTC).
> Track: **Markets and Trading Tools**. Repo: `github.com/alfindigital/ambiguitydesk` (public).

## Why

Trader DEX salah beli token karena ticker bukan identitas — ratusan kontrak berbagi simbol
sama lintas chain. AmbiguityDesk menjawab "PEPE yang mana yang asli?" dengan lineup bukti
transparan + rekomendasi kandidat berlabel heuristik.

## Apa yang berubah di v2 (dari DEEP-VALIDATION.md + probe live)

Audit menemukan 3 failure mode nyata yang harus dibunuh sebelum submit:

1. **W1 — satu-pick semantik rusak untuk aset multi-legit.** USDT/WBTC = banyak deployment
   asli; menjawab "BSC yang asli" itu salah. → **Family mode**: render "canonical
   multi-chain asset — pilih chain-mu" dengan best-pool per chain, bukan satu winner.
2. **W2 — venue mixing.** `dex/search` campur venue non-DEX (Robinhood dsb) dengan pool
   on-chain; `liq × ut24h` antar venue tidak comparable (APE: retail-app menang atas
   ApeCoin). → **Venue split**: kandidat non-DEX turun ke section "listed elsewhere",
   pick hanya dari pool on-chain.
3. **W3 — `ut24h` bisa di-farm.** PI: clone Solana menang dengan 8.255 trader di pool
   $84K. → **Farming flag + pool-age signal**: `ut24h/(liqUsd/1e5)` anomali → flag
   `possible-farming`; umur pool dari `fpt`/`fpct` jadi sinyal ortogonal ketiga
   (clone tidak bisa memalsukan umur).

Plus: relabel "SAFEST PICK" → "BEST-SUPPORTED CANDIDATE (heuristic, not proof)",
dan pick jadi 3-sinyal: `score × pool-age × canonical-cid`.

## Requirement (testable)

- R1: Input ticker → lineup semua kandidat exact-symbol, pick = best-supported candidate.
- R2: ≥3 chain exact-symbol dengan `liqUsd ≥ FAMILY_LIQ_USD` → mode `family`, render
  best-per-chain, tidak ada "winner" tunggal.
- R3: Row dengan `plt` di daftar non-DEX venue → bucket `elsewhere`, tidak eligible pick.
- R4: `ut24h / (liqUsd/1e5) > FARMING_TRADERS_PER_100K` → flag `possible-farming`;
  kandidat ber-flag farming tetap di lineup tapi tidak boleh jadi pick tanpa catatan.
- R5: Tiebreak/penalty deterministik: pool-age (`fpct`) tua & `cid` shared-canonical
  menambah confidence; clone ber-cid asing + pool muda mendapat `young-pool` flag.
- R6: Pick label: `only-candidate` / `clear-lead` / `close-call` / `family` — copy UI
  "best-supported candidate — heuristic, not proof". Tidak ada kata "safest".
- R7: Replay mode tetap jalan penuh dari fixture committed; semua behavior baru punya
  fixture coverage (USDT, WBTC, APE, PI wajib masuk corpus).
- R8: `q` unknown → 404 jujur; fixture hilang/invalid → 404, bukan 500.

## Bukan scope v2

- AI/Jev/narrator: **sengaja tidak ada** (deterministic = selling point).
- Cross-provider corroboration (DexScreener dst): post-hackathon.
- Wallet-level sybil detection: takdir endpoint — mitigasi via flag saja.

## DoD submission

- [ ] Tests offline hijau (termasuk regresi USDT-family, APE-venue, PI-farming, WIF-$)
- [ ] Fixture corpus ≥ 15 ticker populer + edge cases (capture sebelum key mati)
- [ ] Live di https://ambiguitydesk.pages.dev, 0 console error
- [ ] Public repo + README: endpoints named, code+response evidence, API feedback note
- [ ] Demo video Remotion: PEPE lineup → WIF $-fix → USDT family mode
- [ ] Submit DoraHacks track Markets and Trading Tools + X post #BuildwithCMC
