# AmbiguityDesk v2 — PLAN (atomik, deadline 30 Sep 23:59 UTC)

> Urutan diurut berdasarkan criticality waktu: capture dulu (key mati), resolver,
> UI, repo+deploy, video, submit. 1 task = 1 commit.

## Task 1 — Fixture capture sprint [TIME-CRITICAL]
- [ ] `node tools/capture-fixtures.mjs USDT WBTC PI APE LINK SOL USDC DOGE SHIB WLFI FARTCOIN`
- [ ] Verifikasi tiap file: `body.data.tks` non-empty, `httpStatus:200`
- [ ] Commit `test: add edge-case + popular fixtures`

## Task 2 — Resolver: normalizeRow + venue split
- [ ] Tambah `firstPoolMs`, `venue` di `normalizeRow` + `classifyVenue()`
- [ ] `bucket:"elsewhere"` untuk appvenue; eksklusi dari pickPool
- [ ] `stats.venueFiltered` di response
- [ ] Test: APE → Robinhood elsewhere, pick on-chain
- [ ] Commit `feat: venue-aware candidate split`

## Task 3 — Resolver: 3-sinyal pick (age + farming)
- [ ] `farmingDensity`, flag `possible-farming`, `young-pool`
- [ ] `effective score` = score × age-bonus × farm-penalty
- [ ] `stats.farmingFlagged`
- [ ] Test: PI clone ke-flag + turun; PEPE jarak makin lebar
- [ ] Commit `feat: pool-age + farming-penalty signals`

## Task 4 — Resolver: family mode
- [ ] Deteksi ≥3 chain exact-symbol liq≥$100K → `mode:"family"`, best-per-chain
- [ ] `pick:null` + `family[]` payload
- [ ] Test: USDT → family; PEPE tetap pick
- [ ] Commit `feat: multi-legit family mode`

## Task 5 — Relabel + response copy
- [ ] "SAFEST PICK" → "BEST-SUPPORTED CANDIDATE — heuristic, not proof"
- [ ] Commit `fix: honest pick label`

## Task 6 — UI render mode baru
- [ ] Family card (per-chain table, tanpa winner)
- [ ] Farming flag chip merah + elsewhere section terpisah
- [ ] Commit `feat: family/elsewhere/farming UI`

## Task 7 — Test + build + deploy
- [ ] `node tools/test-resolve.mjs` hijau penuh
- [ ] `node tools/build-dist.js` + `wrangler pages deploy dist`
- [ ] Verifikasi prod: PEPE/USDT/PI/APE/unknown + console bersih
- [ ] Commit `chore: deploy v2`

## Task 8 — Repo public + README update
- [ ] `git init` di `ambiguitydesk/`, `.gitignore` (dist opsional, audit/ ikut)
- [ ] `gh repo create alfindigital/ambiguitydesk --public --source . --push`
- [ ] README: endpoints used, evidence-of-call section, API feedback note
- [ ] Commit + push `docs: submission-ready readme`

## Task 9 — Demo video Remotion
- [ ] `video/` scaffold (reuse pendekatan verdex/video, zero dep baru)
- [ ] Shots: PEPE lineup → WIF before/after → USDT family → PI farming flag
- [ ] Render mp4 → `video/out/`
- [ ] Commit `docs: demo video`

## Task 10 — Submission text
- [ ] Deskripsi + endpoint list + "where API got in the way" (venue mixing, cap-50)
- [ ] Serahkan ke user: submit DoraHacks + X post #BuildwithCMC (akun user)
