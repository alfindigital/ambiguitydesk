# AmbiguityDesk — Deep Validation Audit (pasca-build)

**Tanggal:** 2026-09-30 · **Frame:** audit pasca-build — cari semua celah sebelum tool ini diekspos/dipromosikan publik.
**Metode:** 3× ensemble crawl (6 engine: Tavily, Parallel, Exa, Firecrawl, TinyFish, Bright Data; persisted ke `Crawl/research/*-20260930/`) + **6 probe live CMC** lewat resolver produksi (`audit/probe-*.json`, 6 kredit terpakai) + 26 unit test + verifikasi prod manual.

---

## Verdict dulu

**Berguna: YA. Data valid: YA, dengan 3 caveat besar. Build cepat: SUDAH TERBUKTI (live). Ultimate advantage: ADA tapi RAPUH — moat-nya bukan data, bukan heuristik; cuma kejujuran presentasi + breadth 50-row/1-kredit. Dan audit menemukan 2 failure mode nyata yang harus di-fix sebelum promosi besar: venue-mixing (ut24h antar-venue tidak comparable) dan multi-legit degenerate (USDT/WBTC).**

---

## 1. Apa yang benar-benar terjadi di data live (bukan fixture)

6 query live baru, lewat resolver asli:

| Query | rows | exact | chains | Pick | Label | Temuan |
|---|---|---|---|---|---|---|
| USDT | 50 | **50** | **48** | BSC Tether USD | clear-lead 5.4× | Kasus multi-legit ekstrem — lihat W1 |
| WBTC | 50 | 47 | 42 | Ethereum Wrapped BTC | close-call 1.6× | Cluster benar; tapi "pick" semantiknya lemah — lihat W1 |
| APE | 50 | 43 | 9 | **Robinhood "Agentic Prompt Enhancer"** | close-call 2.4× | ApeCoin asli kalah — lihat W2 |
| LINK | 50 | 21 | 20 | Ethereum ChainLink | clear-lead 20.9× | Benar |
| PI | 50 | 16 | 8 | **Solana "Pump Inu"** | clear-lead 4.0× | Clone menang — lihat W3 |
| QZXCVBNM | 0 | 0 | 0 | — | empty | Path kosong live terverifikasi (200, `candidates:[]`) |

Fixture regression tetap benar: PEPE→ETH 21.5×, WIF→dogwifhat `$WIF` 1740×, TRUMP→OFFICIAL 110×, MOODENG→Solana 28.4×.

---

## 2. SWOT

### Strength (bukti, bukan klaim)

1. **Breadth murah**: 1 query = 1 kredit = sampai 50 kandidat multi-chain. whichone.edycu.dev depth-capped ~8 kandidat dengan ≤26 kredit Nansen per analisis.
2. **`ut24h` (unique traders) tidak ada di schema DexScreener maupun GeckoTerminal** — diverifikasi langsung di `docs.dexscreener.com/api/reference` (field mereka: `txns.buys/sells`, `liquidity`, `fdv`, `marketCap`, `pairCreatedAt`). Ini differentiator data yang asli.
3. **Kejujuran struktural**: pick dilabeli heuristic + margin + caveat; kandidat tanpa data render `unknown`/`no score`, bukan 0; bucket related tidak pernah dilabeli scam.
4. **Clustering cross-chain bekerja** — termasuk bridge-ref `eth-0x….omft.near` (WBTC pick reason: "Same contract also listed on Near, EthereumPoW").
5. **Replay-first**: prod tetap berguna tanpa key; receipts `capturedAt`/`sha256`/`credits` per resolve.
6. **Sudah live + terverifikasi**: ambiguitydesk.pages.dev, 0 console error, security headers aktif, responsive 360–1280.

### Opportunity

1. **"resolver" positioning**: semua kompetitor menampilkan *deteksi*; output kita *keputusan* ("pakai alamat ini"). Itu actionable untuk integrasi wallet/bot — calon API-ori product.
2. **AI pattern-class narrator** (opsional, constrained — lihat §4).
3. **Same-name-same-chain collision** (3× kontrak beda sama-sama "Pump Inu PI" di Solana) — layer deteksi baru yang belum ada di tool mana pun yang kami temukan.
4. Jalur upgrade data: `pairCreatedAt`-equivalent (umur pool) via endpoint `dex/pairs` — discriminator clone paling kuat (canonical hampir selalu lebih tua).

### ⚠️ Weakness — dalam, dengan bukti live

**W1 — Model "satu pick" rusak untuk aset multi-legit (USDT, WBTC).**
Bukti: `probe-USDT` → 50/50 rows exact `USDT` di 48 chain; semua USDT BSC/Tron/Ethereum itu *sama-sama asli* (issuer sama, kontrak beda per chain — bukan mirror, bukan clone). Stempel "SAFEST PICK: BSC" secara implisit membingkai Ethereum USDT sebagai kurang aman — salah secara semantik dan berbahaya kalau dikutip. WBTC juga: pick ETH hanya 1.6× — label `close-call` menyelamatkan, tapi framenya masih "ada yang kalah".
**Solusi:** deteksi kelas *issuer-multi-chain*: bila >5 exact-match di >4 chain dengan banyak skor comparable → ganti stamp jadi **"LEGIT MULTI-CHAIN — pilih per target chain"**, tampilkan top-3 per chain-group, bukan satu pick. Biaya: ~30 baris di resolver + copy baru. **Wajib sebelum promosi.**

**W2 — Venue-mixing: `ut24h` antar platform tidak comparable.**
Bukti: `probe-APE` → pick = "Agentic Prompt Enhancer" di platform **Robinhood** (ut24h 1503, liq $130K) mengalahkan ApeCoin Ethereum ($779K liq). "Robinhood" di data CMC adalah chain/venue retail-app — trader count-nya mencerminkan flow aplikasi, bukan perilaku open-market DEX. Membandingkan ut24h Robinhood vs Ethereum = membandingkan apel dan antrean drive-thru.
**Solusi:** pisahkan venue ke tier dalam scoring — `venueTier` map (native DEX chains vs retail-app venues vs unknown); tampilkan tier sebagai kolom/chip, dan pick hanya dari tier DEX, dengan venue lain tetap tampil di tabel berlabel venue-nya. Minimal: flag `retail-venue` + exclude dari pick pool. **Wajib.**

**W3 — `liq × ut24h` bisa dibeli: wash-trading + pool-seeding.**
Bukti: `probe-PI` → pemenangnya **"Pump Inu" Solana, ut24h 8.255 di pool $84K** — 8255 trader untuk likuiditas $84K adalah signature farming textbook (rasio trader:liq ≈ 98/$1K vs PEPE asli ≈ 16/$1M). Pi Network asli ada di posisi 6. Clone Solana PEPE kemarin juga punya ut24h 5.5× canonical. Heuristik kita *diminati persis oleh aktor yang hendak kita tangkap*.
**Solusi:** (a) tambah sinyal rasio — `ut24h / liqUsd` di atas ambang anomali → flag `farm-suspect` (gampang, deterministik); (b) umur pool sebagai tiebreak via `dex/pairs` top-k (biaya 1 kredit/kandidat — lakukan hanya untuk 3 teratas saat margin <3×); (c) honest copy sudah ada ("can be bought") — perkuat dengan menampilkan rasio farm di kolom flags. Tanpa (a), promosi publik berisiko: screenshot pertama yang viral bisa jadi tool kita menobatkan clone.

**W4 — Coverage hole pada aset CEX-native.**
Bukti: PI — aset yang dimaksud user (Pi Network) tidak punya pool DEX bermakna, jadi tabel kandidat seluruhnya clone/wrapped. Tool menjawab pertanyaan yang salah ("PI terbaik di DEX") bukan yang ditanya ("PI yang asli").
**Solusi:** copy satu baris di atas pick saat top-cluster ber-mcap kecil vs query terkenal, atau saat semua kandidat relatif muda/tipis: "Aset yang kamu maksud mungkin tidak diperdagangkan di DEX — semua di bawah ini adalah token DEX bernama PI." Deteksi: heuristik sederhana (semua exact rows punya liq <$1M) → tampilkan notice. Murah.

**W5 — `mcap` berguna tapi kotor.**
Bukti: row Arbitrum PEPE dengan `mc≈1e23` (sudah di-flag `mcap-inflated`, dirender `$1.0e23`). Benar tidak dipakai sebagai sort key — tapi masih ditampilkan, dan beberapa row punya mc absurd tanpa flag kalau liq-nya juga null (edge: mc/liq ratio butuh liq>0).
**Solusi:** clamp tampilan (done via `toExponential`); tambah `mcap-inflated` juga saat `mc > 1e12` tanpa syarat liq — sudah ada. Cukup; tinggal pastikan flag konsisten di semua row anomali.

**W6 — Reputasi-by-screenshot.**
Stempel "SAFEST PICK" adalah undangan screenshot. Sekali tool menobatkan clone (W2/W3), itu jadi konten viral melawan kita — jauh lebih mahal daripada salah rank.
**Solusi:** (sudah sebagian) label `close-call` ambigu saat margin <3× + caveat line. Tambahan murah: pick-strip tidak tampil saat top-cluster ber-flag `farm-suspect`/`retail-venue`; fallback ke "NO CONFIDENT PICK — here's the full table". Lebih mahal di kejujuran, lebih murah di reputasi.

### 🔥 Threat — dalam

**T1 — DexScreener bisa membangun ini gratis dalam semalam.**
Fakta: API DS free, tanpa key, 60–300 req/min, 60+ chain, punya `pairCreatedAt` (umur pool — discriminator clone yang kita TIDAK punya dari `/v1/dex/search`). Satu-satunya yang tidak mereka punya: `ut24h`. Versi DS-nya: `liq × txns.h24 + umur` — arguably *lebih baik* dari heuristik kita karena umur mematikan clone baru.
**Mitigasi:** (a) positioning hackathon = "built on CMC" — nilai jualnya ke juri adalah penggunaan API CMC, bukan superiority absolut; (b) `ut24h` + bukti receipts + evidence-discipline adalah cerita yang tidak bisa di-clone oleh "tabel DS cepat"; (c) kalau serius: hybrid later (DS untuk age, CMC untuk ut24h). **Terima saja: moat bukan data. Moat = disiplin presentasi.**

**T2 — CMC bisa mengubah/membatasi endpoint.**
`/v1/dex/search` adalah surface vendor: field `ut24h` bisa hilang/di-rename/berbayar; plan berubah; rate limit mengetat. Single-vendor data plane untuk produk identitas adalah risiko struktural.
**Mitigasi:** replay fixtures (sudah), isolasi di `functions/api/resolve.js` (swap provider = 1 file), dokumentasikan field-contract di README. Diterima, tidak diperbaiki berlebih.

**T3 — `ut24h` sendiri bisa di-game oleh provider-level inflation.**
Kalau ut24h dihitung CMC dari event on-chain tanpa filter sybil, angkanya rentan oleh wallet farming — dan kita tidak bisa memverifikasi metodologinya (black-box). Heuristik kita mewarisi bias provider.
**Mitigasi:** jangan pernah sebut ut24h "unique real users" di copy — tulis "unique traders reported". Tambahkan flag rasio (W3a) sebagai kontrol internal.

**T4 — Kompetitor incumbent punya trust yang tidak bisa kita bangun cepat.**
Token Sniffer/GoPlus/RugCheck punya brand + integrasi wallet; whichone punya depth Nansen. Kalau pasar memilih "collision resolution = fitur scanner security yang sudah ada", standalone tool kita jadi fitur, bukan produk.
**Mitigasi:** positioning sengaja berbeda — *resolver yang actionable* (output = alamat untuk dipakai), bukan *scanner* (output = skor risiko). Juga: ko-eksisensi — link out ke explorer/scanner per row (sudah ada). Bila di-copy incumbent, itu validasi pasar; ekosistem Verdex tetap punya integrasi.

**T5 — Timing key/kredit.**
Key expire ~1 Okt; tanpa live key, demo cuma 7 ticker. Reviewer yang ketik ticker lain dapat 404 — bisa terbaca "tool-nya broken" padahal itu honesty-by-design.
**Mitigasi:** copy 404 sudah menjelaskan fixture-scope; tambah CTA "coverage replay terbatas pada fixture" sudah ada. Untuk demo hackathon: siapkan 10–15 fixture ticker populer sebelum key mati (murah, 1 kredit per ticker) — **tindakan tersisa paling penting hari ini**.

**T6 — Legal/penamaan.**
"SAFEST PICK" mendekati klaim keamanan; istilah "impostor"/"scam" di beberapa copy bisa menimbulkan argumen defamasi token. Screenshot verifikasi menunjukkan headline "Thirty-two impostors" — edgy tapi aman karena itu angka, bukan tuduhan per-proyek.
**Mitigasi:** pertahankan copy numerik ("N exact-symbol matches"), hindari kata scam/fake per-kandidat; flag label netral (`thin-pool`, `data-gap`, `farm-suspect` = deskriptif, bukan tuduhan). Sudah dipraktikkan; tulis konvensi ini di AGENTS.md (sudah ada poin 3).

---

## 3. Apakah data & fakta valid?

- **Pain nyata**: ticker collision punya definisi glossary sendiri (OxaPay), insiden terdokumentasi (FLOKI official warning fake FLOKI di Base/Solana; kasus FTMX; kasus LIT-on-Robinhood salah-aset; kohort dust-attack counterfeit-token di OAK). Bukan problem yang kita karang.
- **Data provider cukup untuk MVP**: `liq`, `ut24h`, `mc`, `pc24h`, `plt`, `addr`, `s`, `n`, `l` populated di row bermakna; hole explicit (null, bukan 0).
- **Anomali provider nyata dan kita tangani**: `mc=1e23`, simbol `$WIF`, bridge-refs, venue retail-app, duplicate name+chain di chain sama. Semua ditemukan *karena* tool dipakai — itu sendiri bukti nilai.
- **Yang tidak valid untuk diklaim**: bahwa pick = "yang asli". Data tidak mendukung klaim itu; copy kita sudah benar ("safest pick … heuristic, not proof").

## 4. AI layer (JEV/deepseek-v4.1-class) di dalam tool?

**Rekomendasi: JANGAN di v1.** Argumen:
- Produk ini menjual *kepercayaan lewat determinisme*. Narator probabilistik menambah risiko halusinasi tepat di permukaan yang paling sensitif (memanggil token "impostor").
- Nilai tambah nyata yang bisa AI berikan — "kandidat #2 punya trader lebih banyak tapi pool 150× lebih dangkal" — adalah *pattern-class commentary* yang bisa ditulis deterministik (kita sudah punya flags + reason string).
- Biaya/latensi/kegagalan eksternal di tool 1-endpoint = risiko tanpa payoff.

**Kalau nanti ditambah:** batasi ke narrator kelas-pola atas flags yang sudah dihitung (template-constrained, boleh LLM untuk merapikan bahasa saja); model setara JEV/deepseek-v4.1 cukup — jangan biarkan model memilih pick. AI memperjelas evidence; evidence yang memilih.

## 5. "Bisa build cepat + ultimate advantage"?

- **Build cepat**: bukan hipotesis lagi — sudah live hari ini, ~5 file inti + 1 Function + replay. Jawaban empiris: YA.
- **Ultimate advantage — jujur**: breadth 50-row/1-kredit + `ut24h` + evidence-discipline adalah **edge tipis, bukan moat**. Moat sebenarnya adalah (a) positioning resolver-actionable vs scanner-detektif, (b) receipts/audit trail yang bisa diverifikasi, (c) integrasi sebagai modul identitas Verdex. Kalau dinilai sebagai *standalone startup*, tipis; sebagai *hackathon entry + komponen Verdex*, kuat.

## 6. Kondisi GO untuk promosi publik

Fix dulu (murah, deterministik, semua di resolver/UI yang sudah ada):

1. **W1** — issuer-multi-chain mode untuk aset dengan >5 exact di >4 chain (stamp "legit multi-chain", top-3 per chain).
2. **W2** — venue tier; retail-app venues (Robinhood dkk.) excluded dari pick pool + chip venue di row.
3. **W3a** — flag `farm-suspect` saat `ut24h/liqUsd` di atas ambang anomali (kalibrasi dari probe data: PEPE asli ≈16/$1M, Pump Inu ≈98/$1K — threshold ~1000× median exact-bucket atau absolut >50 traders per $1K).
4. **W6** — "NO CONFIDENT PICK" state saat top-cluster ber-flag.
5. **T5** — capture 8–10 fixture ticker populer tambahan sebelum key mati (DOGE, SHIB, PEPE2, UNI, FLOKI, BABYDOGE, SOL, USDC) — 8 kredit, sisa budget 4 → minta izin 4 lagi kalau mau semua.

Tanpa kelimanya, verdictku: **HOLD untuk promosi besar; aman untuk submit hackathon + share ke komunitas niche** (audien yang paham caveat). Dengan kelimanya: GO.

---

*Analisa berbasis probe live `audit/probe-*.json` + fixture `fixtures/*.json` + ensemble research `Crawl/research/*-20260930/`. Angka provider = apa adanya dari CMC; heuristik = komputasi kami; penilaian = analis. Bukan saran investasi.*
