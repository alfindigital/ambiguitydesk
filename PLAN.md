# AmbiguityDesk v2 — PLAN (atomik, deadline 30 Sep 23:59 UTC)

> Urutan diurut berdasarkan criticality waktu: capture dulu (key mati), resolver,
> UI, repo+deploy, video, submit. 1 task = 1 commit.

## Task 1 — Fixture capture sprint [TIME-CRITICAL]
- [x] `node tools/capture-fixtures.mjs USDT WBTC PI APE LINK SOL USDC DOGE SHIB WLFI FARTCOIN`
- [x] Verifikasi tiap file: `body.data.tks` non-empty, `httpStatus:200`
- [x] Commit `test: add edge-case + popular fixtures`

## Task 2 — Resolver: normalizeRow + venue split
- [x] Tambah `firstPoolMs`, `venue` di `normalizeRow` + `classifyVenue()`
- [x] `bucket:"elsewhere"` untuk appvenue; eksklusi dari pickPool
- [x] `stats.venueFiltered` di response
- [x] Test: APE → Robinhood elsewhere, pick on-chain
- [x] Commit `feat: venue-aware candidate split`

## Task 3 — Resolver: 3-sinyal pick (age + farming)
- [x] `farmingDensity`, flag `possible-farming`, `young-pool`
- [x] `effective score` = score × age-bonus × farm-penalty
- [x] `stats.farmingFlagged`
- [x] Test: PI clone ke-flag + turun; PEPE jarak makin lebar
- [x] Commit `feat: pool-age + farming-penalty signals`

## Task 4 — Resolver: family mode
- [x] Deteksi ≥3 chain exact-symbol liq≥$100K → `mode:"family"`, best-per-chain
- [x] `pick:null` + `family[]` payload
- [x] Test: USDT → family; PEPE tetap pick
- [x] Commit `feat: multi-legit family mode`

## Task 5 — Relabel + response copy
- [x] "SAFEST PICK" → "BEST-SUPPORTED CANDIDATE — heuristic, not proof"
- [x] Commit `fix: honest pick label`

## Task 6 — UI render mode baru
- [x] Family card (per-chain table, tanpa winner)
- [x] Farming flag chip merah + elsewhere section terpisah
- [x] Commit `feat: family/elsewhere/farming UI`

## Task 7 — Test + build + deploy
- [x] `node tools/test-resolve.mjs` hijau penuh
- [x] `node tools/build-dist.js` + `wrangler pages deploy dist`
- [x] Verifikasi prod: PEPE/USDT/PI/APE/unknown + console bersih
- [x] Commit `chore: deploy v2`

## Task 8 — Repo public + README update
- [x] `git init` di `ambiguitydesk/`, `.gitignore` (dist opsional, audit/ ikut)
- [x] `gh repo create alfindigital/ambiguitydesk --public --source . --push`
- [x] README: endpoints used, evidence-of-call section, API feedback note
- [x] Commit + push `docs: submission-ready readme`

## Task 9 — Demo video Remotion
- [x] `video/` scaffold (reuse pendekatan verdex/video, zero dep baru)
- [x] Shots: PEPE lineup → WIF before/after → USDT family → PI farming flag
- [x] Render mp4 → `video/out/`
- [x] Commit `docs: demo video`

## Task 10 — Submission text
- [x] Deskripsi + endpoint list + "where API got in the way" (venue mixing, cap-50)
- [x] Serahkan ke user: submit DoraHacks + X post #BuildwithCMC (akun user)
