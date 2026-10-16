# Changelog

## [Belum dirilis] — Fase design/frontend/UX (P1 ✅ · P2–P6 menyusul)

### P1 — Token semantik & kontras (2026-10-16) ✅
- **Nol teks di bawah 4,5:1.** 417 utilitas teks beropasitas (`text-ink/45`, `dark:text-mist/40`, …) di **66 berkas** diganti token peran; pindai ulang menemukan **0** sisa. Sebelumnya 262 pemakaian gagal ambang WCAG AA di 21 berkas.
- **Token semantik baru di `src/index.css`** (29 token): permukaan (`surface-raised`, `surface-sunken`, `soil-raised`, `soil-sunken`), teks berjenjang (`ink-soft/body/muted/subtle` + padanan `mist-*`), garis (`line-strong/subtle` + varian gelap), aksen (`on-accent`), dan **ramp level bahaya** (`level-rendah/waspada/bahaya/ekstrem` + tint + varian gelap). Nilai & kontras terukur: `docs/reference/DESIGN-TOKENS.md`.
- **Ramp level dipakai lencana:** `HazardPanel`, `HazardFocusCards`, `DroughtCard`, `FireDangerCard`, `AirQualityCard`, `DisasterWarning` memakai token level, dan `HazardPanel` menampilkan **glyph bentuk berbeda per tingkat** (centang · segitiga · bel · segi-delapan) — makna tidak lagi bergantung warna (WCAG 1.4.1).
- **Warna di luar palet dihapus:** `ErrorBoundary` (dulu `slate-*`/`rose-*`) kini memakai palet tema + target 44 px + `role="alert"`; `SchematicMap` dan `HazardFocusCards` tidak lagi menyimpan heks mentah (memakai `var(--color-level-*)`).
- **Fokus keyboard tidak lagi dihapus:** `AppBar` (pemilih wilayah) melepas `focus-visible:outline-none` sehingga penanda fokus kembali terlihat.
- **Gerbang kontras jadi penjaga build:** CI menjalankan `npm run check:contrast -- --strict` — **34/34 pasangan token lulus** (teks 4,5:1 · non-teks 3:1) dan 0 utilitas teks beropasitas; regresi kontras kini **menggagalkan build**. Skrip juga mengabaikan komentar blok supaya contoh anti-pola di dokumentasi tidak dihitung.
- Uji: **340** (338 → +2: pemetaan pita opasitas & pengabaian komentar). Cakupan 95,70 / 84,06 / 95,89 %. Bundel 131,6 → **132,0 kB** gzip (tanpa dependensi baru).

### Tahap audit & rencana (commit `bfa8315`) — belum mengubah UI

Pembukaan fase penyempurnaan tampilan setelah v2.1.0 sinkron di upstream (`main` = `f9f8058`): audit, rencana, dan pengaman agar perbaikan berikutnya terukur. Komponen React belum disentuh pada tahap ini.

#### Dokumen rencana (audit 26 komponen + riset 12 klaster + log 50 putaran)
- **`docs/dev/11-RENCANA-DESIGN-UX.md`**: temuan A-1…A-9 (262 pemakaian teks < 4,5:1, tipografi 10–13 px, target sentuh, fokus, semantik tab, `aria-live`, motion, area aman, keadaan menunggu/basi), riset R-1…R-12 dengan implikasi, serta **paket kerja P1–P6** lengkap dengan berkas sasaran dan kriteria terima: P1 token & kontras · P2 aksesibilitas interaksi · P3 tipografi & font · P4 keadaan menunggu/kosong/basi/gagal · P5 gerak & area aman · P6 pengaman & tata kelola.
- **`docs/reference/DESIGN-TOKENS.md`**: spesifikasi token siap-terap — 8 token teks (4 terang/4 gelap) yang lulus 4,5:1 **di tiga permukaan**, ramp level bahaya + tint + garis aksen, 5 seri grafik untuk dua tema, skala tipografi `caption/label/body-sm/body`, tabel durasi motion, aturan target sentuh/fokus/area aman, serta tabel pemetaan 12 opasitas lama → token baru.
- Angka kontras dihitung dengan rumus WCAG 2.2 dan **disimulasikan terhadap buta warna (protanopia/deuteranopia)**; tiga pasangan seri grafik berjarak ΔE < 15 sehingga wajib dibedakan pola/penanda/label, bukan warna saja.

#### Gerbang kontras otomatis (tanpa browser)
- **`scripts/check-contrast.mjs`** (`npm run check:contrast`): membaca token `@theme` dari `src/index.css`, menilai 23 pasangan peran terhadap ambang WCAG 2.2 AA (teks 4,5:1 · non-teks 3:1), memindai utilitas teks beropasitas di `src/` (kini **262 temuan di 21 berkas**), dan menghitung pemakaian teks < 16 px. Opsi `--strict`, `--json`, `--all`, `--css`, `--dir`.
- **11 uji baru** (`tests/checkContrast.test.js`) → suite **338 uji**; cakupan 95,68 / 84,05 / 95,88 % (ambang 95/80/92).
- CI: langkah *Gerbang kontras desain* ditambahkan dalam mode **informatif** (setara `check:i18n`) agar build tetap hijau sampai P1–P4 diterapkan; setelahnya diubah menjadi `--strict`.
- Dokumen diperbarui: `docs/README.md`, `docs/dev/README.md`, `docs/reference/SKRIP-NPM.md`, `AGENTS.md`.

## [2.1.0] — 2026-10-16 · Migrasi toolchain mayor (A-1, menutup advisori `braces`) + gerbang cakupan uji (A-2)

Hasil akhir butir **A-1** pada `docs/dev/10-ROADMAP-V3.md`: seluruh lompatan mayor yang ditunda saat audit 2.0.1 dikerjakan sekaligus, dan `npm audit` kini **0 kerentanan** (sebelumnya 5 high dev-only).

### Tailwind CSS 3.4.19 → 4.3.3
- Konfigurasi **CSS-first**: `src/index.css` kini memakai `@import "tailwindcss"` + blok `@theme` (palet Gayo `soil/mist/leaf/cherry/husk/rain`, `font-data`, `max-w-shell`, `rounded-card`) dan `@custom-variant dark (&:where(.dark, .dark *))` untuk dark mode berbasis kelas.
- `tailwind.config.js` dan `postcss.config.js` **dihapus**; plugin baru `@tailwindcss/vite`; `autoprefixer` & `postcss` dilepas (v4 menangani vendor prefix lewat Lightning CSS).
- **Rantai `chokidar → braces` + `postcss-nested → postcss-selector-parser` hilang total** → CVE-2026-93687 (yang belum punya patch di hulu, lihat SECURITY.md 2.0.1) tidak lagi relevan. `npm audit --omit=dev` tetap 0.
- Penyesuaian kecil: `rounded-sm` → `rounded-xs` di 2 komponen peta/grafik agar radius tetap 0,125 rem sesuai skala v3 (v4 menggeser arti `-sm`).
- Verifikasi khusus: 301 token kelas dari `src/` diuji satu per satu terhadap CSS keluaran — **0 utility hilang**; `.bg-soil`, `.text-ink`, `.rounded-card`, `.bg-husk/50`, `.divide-ink/10`, dan varian `dark:` semuanya ter-generate.

### Vite 6.4.4 → 8.3.4 (Rolldown)
- Bundler produksi berganti Rollup → **Rolldown (Rust)**; build 3,6 s → **0,42 s**.
- API `manualChunks` (objek) tidak lagi didukung → diganti `advancedChunks.groups` (pemisahan `vendor-react` & `vendor-icons` tetap).
- `@vitejs/plugin-react` 4.7 → **6.1.2** (Oxc, tanpa Babel — proyek tidak memakai plugin Babel sehingga transparan).
- `engines.node` dinaikkan `>=20.19.0` (syarat Vite 8); CI tetap Node 22.
- `vite-plugin-pwa` 2.0.0 sudah mendukung Vite 8 (tanpa perubahan konfigurasi PWA).

### lucide-react 0.546 → 1.58
- Seluruh ikon yang dipakai (`AlertTriangle`, `CloudRain`, `CloudSun`, `MapPin`, `RefreshCw`) masih tersedia di v1; tidak ada ikon merek (yang dihapus di v1) di proyek.

### Hasil ukur (sebelum → sesudah)
- JS total gzip **133,3 → 131,6 kB**; chunk terbesar **127,4 → 65,8 kB** (anggaran 200/150 tetap lolos dengan margin besar).
- CSS gzip 5,66 → 8,09 kB (konsekuensi wajar v4: `@property`/`color-mix`; total halaman tetap jauh di bawah anggaran 3G).
- 321 uji hijau (306 saat migrasi A-1 + 15 uji gerbang cakupan A-2) · smoke lolos (16 endpoint + 3 penjaga) · render klien terverifikasi (SSR-smoke 5,6 kB HTML, ikon menjadi SVG) · cakupan 96,42 % baris / 83,78 % cabang / 95,96 % fungsi.

### Ambang cakupan uji (roadmap A-2 — audit F-10)
- Skrip baru `scripts/check-coverage.mjs` (`npm run check:coverage`): menjalankan suite dengan cakupan bawaan Node, lalu **menggagalkan build** bila baris < 95 %, cabang < 80 %, atau fungsi < 92 % (ambang 1,5–4 poin di bawah baseline agar refactor kecil tidak rapuh). Hanya memakai flag Node ≥ 20 sehingga tetap sesuai lantai `engines`.
- **Baseline tren terversi** `scripts/coverage-baseline.json` (baris 96,42 % · cabang 83,78 % · fungsi 95,96 %) — setiap jalannya skrip mencetak selisih terhadap baseline; perbarui dengan `--update-baseline`.
- Opsi `--from <berkas>` menilai laporan cakupan tersimpan (mis. artefak CI) tanpa menjalankan ulang suite; salah pakai argumen keluar 2 (bukan 1) agar tidak tertukar dengan kegagalan cakupan.
- 15 uji baru di `tests/checkCoverage.test.js` (pengurai tabel, penilaian ambang, tren, CLI, dan pelarian env `NODE_TEST_CONTEXT` yang membuat proses anak tidak mencetak tabel). CI: langkah `Test coverage report` (informatif) → **`Test coverage gate`**.

### Struktur dokumentasi Diátaxis (roadmap A-5 — catatan audit F-15)
- `docs/` kini diorganisasi menurut **kebutuhan pembaca**: `tutorials/` (belajar), `how-to/` (tugas), `reference/` (tabel), `explanation/` (alasan) — dengan peta & perutean di `docs/README.md`.
- Berkas dipindah: `docs/THRESHOLDS.md` → **`docs/reference/THRESHOLDS.md`**; `docs/VALIDATION.md` → **`docs/reference/VALIDATION.md`** (tabel riwayat tautan ada di `docs/README.md`; seluruh rujukan di repo — termasuk komentar kode dan teks UI “Tentang data” — sudah diperbarui).
- Berkas baru: tutorial menjalankan lokal; 8 panduan how-to (deploy produksi, peringatan Telegram, perawatan outlook musiman, perubahan ambang, penambahan sumber data, pengumpulan data validasi, peninjauan label Gayo); 3 referensi baru (endpoint API, variabel `.env`, perintah npm & gerbang); peta kuadran explanation. `docs/dev/` sengaja dibiarkan sebagai arsip riset bernomor.
- `AGENTS.md` menetapkan aturan penempatan agar kuadran tidak tercampur pada perubahan berikutnya.

### Hotspot NASA FIRMS aktif (tugas manusia H-1 selesai)
- Kunci FIRMS diterima & diverifikasi langsung terhadap API pada 16 Okt 2026: `/healthz` `features.firmsKey: true`, `/api/hotspots?location=takengon` → `degraded:false`, `sources.hotspots.state: ok`. Kartu “Bahaya Kebakaran” tidak lagi menampilkan catatan “kunci belum diatur”.
- **Temuan uji langsung → perbaikan kode:** API FIRMS Area hanya menerima rentang hari **1–5** (`Invalid day range. Expects [1..5]`, HTTP 400). Sebelumnya `.env.example` & dokumen menyebut 1–10, dan nilai di luar rentang akan menggagalkan **semua** sumber sehingga hotspot jatuh *degraded* tanpa sebab yang jelas. Kini `clampFirmsDays()` (`server/firms.js`) menjepit di satu tempat — nilai mustahil → default 2, sebagai ganti kegagalan senyap.
- **Fixture nyata** (bukan sintetis) ditambahkan dan dipakai uji: `firms-viirs-snpp-gayo-2d.csv` (header saja — keadaan nyata “nol hotspot” di bbox Gayo) dan `firms-viirs-aceh-5d-REAL.csv` (2 deteksi VIIRS nyata di Aceh Utara, di luar radius 50 km). +6 uji (321 → **327**).
- Dokumentasi: **`docs/how-to/08-aktifkan-hotspot-firms.md`** (pemasangan kunci, verifikasi 3 tingkat, batas 1–5 hari & kuota, arti “nol hotspot”, penyegaran fixture, troubleshooting); `.env.example`, `reference/KONFIGURASI-ENV.md`, `reference/ENDPOINT-API.md`, `dev/04-DATA-SOURCES.md`, `dev/09-DATA-PREP.md` dikoreksi.

### Catatan penting
- **Kompatibilitas browser:** Tailwind v4 menargetkan Safari 16.4+ / Chrome 111+ / Firefox 128+ (Maret 2023+). Untuk perangkat kebun yang lebih lama, rilis **v2.0.1** tetap tersedia sebagai tag.
- **Pemasangan dari lockfile lama:** npm 10.8.2 sempat gagal (`Cannot read properties of null (reading 'edgesOut')`) saat resolusi pertama; cukup sekali `npm install --legacy-peer-deps` — setelah `package-lock.json` baru terbentuk, `npm ci` berjalan normal (terverifikasi).


## [2.0.1] — 2026-10-16 · Pengerasan pasca-audit (18 temuan, tanpa perubahan perilaku fitur)

Audit menyeluruh terhadap upstream `fa33bfb` (10 iterasi riset: OpenSSF Scorecard, OWASP API Security Top 10, OASIS CAP 1.2, advisory Vite/esbuild 2025–2026, probing langsung 8 sumber data). Rilis ini menutup seluruh temuan yang dapat diselesaikan di kode; dua temuan bersifat tugas manusia (tag bertanda tangan, terjemahan Gayo) dan satu advisory dev-only belum punya patch hulu.

### Keamanan & rantai pasok
- **F-13** Semua respons API kini memakai header keamanan dasar: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (JSON dan CAP XML).
- **F-12** Perbandingan token cron `x-cron-token` memakai `crypto.timingSafeEqual` (constant-time).
- **F-02** CI: action dipin ke SHA commit (`actions/checkout@11bd7190…` v4.2.2, `actions/setup-node@49933ea5…` v4.4.0) + `permissions: contents: read`.
- **F-01** Gerbang `npm audit --omit=dev --audit-level=high` di CI (pohon produksi 0 kerentanan); override `postcss-selector-parser@^7.1.6` menutup GHSA-rj75-hqrm-r3gf. Sisa advisori `braces` (CVE-2026-93687, dev-only, belum ada patch hulu) didokumentasikan di `SECURITY.md`.
- **F-03** `SECURITY.md` baru (kebijakan pelaporan + status advisori dev-only). **F-04** Dependabot mingguan (`.github/dependabot.yml`, mayor di-ignore untuk evaluasi manual).

### Keandalan & operasional
- **F-14** `climateOutlook.json`: divalidasi silang NOAA CPC 8 Okt 2026 (El Niño kuat–sangat kuat, Niño-3.4 +2,1 °C); `validUntil` → `2026-11-12` (tanggal rilis otoritatif berikutnya); skrip **`npm run check:outlook`** + gerbang CI (gagal bila kedaluwarsa).
- **F-17** Unit systemd: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, proteksi kernel/cgroup, `RestrictSUIDSGID`, `ReadWritePaths=…/server/data`, `EnvironmentFile=-…/.env`.
- **F-18** `MAGMA_STALE_DAYS` kini benar-benar dibaca (fallback hasil tersimpan hanya bila ≤ N hari); `HAZARD_ARCHIVE_DIR` kini dipakai; `.env.example` diselaraskan dengan kode (gaya aman `EnvironmentFile`, variabel v3 ditandai "belum dibaca").
- **F-08** `server/firms.js`: seluruh pemrosesan dibungkus — tidak pernah melempar ke pemanggil.
- **F-11** Code-splitting vendor (`vendor-react`, `vendor-icons`): chunk utama 135,3 → 130,7 kB gzip; total 133,3 kB (anggaran 200/150 tetap lolos).

### Struktur & keterlacakan
- **F-09** Routing dipisah ke `server/routes.js` (handler memakai konteks `ctx` eksplisit); `server/index.js` 405 → 163 baris.
- **F-10** `npm run test:coverage` + langkah CI (cakupan dilaporkan; ambang menyusul). Suite kini **306 uji** (20 uji baru: `check-outlook`, `check-i18n`, lapisan `routes`, `MAGMA_STALE_DAYS`, `HAZARD_ARCHIVE_DIR`); cakupan terukur 96,6% baris.
- **F-16** `npm run check:i18n` — inventaris 52 placeholder label Gayo (tugas manusia H-4; jalankan `--strict` setelah selesai).
- **F-15** `/api/cache/flush` didokumentasikan di README.
- **F-05** `engines.node >= 20`. **F-06** tag rilis bertanda tangan: tugas manusia (butuh kunci GPG). **F-07** hutang mayor (Tailwind 4, Vite 8, plugin-react 6, lucide 1.x) dijadwalkan v2.1; Dependabot sengaja mengabaikan lompatan mayor.


## [2.0.0] — 2026-10-15 · Sprint 4 "Multi-bahaya lengkap" (Fase 2: 2.1–2.5 · Fase 3: 3.1, 3.2, 3.4 · Fase 1: 1.10b · Fase 4: 4.2, 4.4, 4.5)

Rilis v2.0.0 menutup seluruh butir roadmap `docs/dev/03-ROADMAP.md` yang tidak memerlukan masukan manusia. Registry kini **11 bahaya** (`longsor, banjir, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat`) + interaksi lintas-bahaya. Tag git `v2.0.0` dan aktivasi cron/kunci tetap tugas manusia (H-1, H-6, H-7, H-9).

### Fitur — geologi (Fase 2.1, 2.2, 2.2b, 2.2c)
- **H-GEMPA** `GET /api/quakes[?location=]` (`server/bmkgQuake.js`): tiga feed BMKG TEWS (`gempadirasakan`, `autogempa`, `gempaterkini`), saringan radius 300 km dari Takengon / menyebut Aceh, cache 2 menit (`QUAKE_TTL_MIN`), kegagalan per sumber tidak menjatuhkan hasil; modul `gempa` (`src/domain/hazards/quake.js`): jarak hiposentral per sentra, **MMI indikatif** IPE Allen dkk. 2012, level `waspada` MMI ≥ 3 / `bahaya` ≥ 5 / `ekstrem` ≥ 7 selama 24 jam (72 jam maks. waspada), penanda **gempa pemicu longsor** (M ≥ 5 ≤ 100 km), tautan shakemap BMKG. Riwayat 10 tahun USGS (82 kejadian M ≥ 4,5 ≤ 150 km, `src/data/hazards/quakeHistory.json`) hanya untuk konteks — tanpa prediksi (ADR-17). `docs/reference/THRESHOLDS.md` §15.
- **H-VULKANIK** `GET /api/volcano` (`server/magma.js`): parser halaman tingkat aktivitas MAGMA Indonesia (Level I–IV) untuk **Burni Telong** + nilai terakhir tersimpan (`server/data/volcano-last.json`) + `VOLCANO_LEVEL_OVERRIDE`; arah angin puncak (Open-Meteo) → daftar sentra **di bawah angin** (± 30°); modul `vulkanik`: Level II → `waspada` (dekat ≤ 30 km) … Level IV → `ekstrem`, radius rekomendasi 3/5/7 km, anjuran abu (masker, atap, air, kopi). §16.
- **Diseminasi geologi**: `gempa`/`vulkanik` di `PUSH_POLICY`/`DEFAULT_EXPIRES`/CAP category; `eventId` baru (`bmkg-<ISO>`, `magma-level-N`) → **Alert segera** melewati jeda 6 jam; `POST /api/alerts/run?only=gempa,vulkanik`, `scripts/alerts-cron.mjs --only`, unit systemd `server/agroclimate-alerts-fast.{service,timer}` (tiap 5 menit).
- Laporan warga tipe baru `abu` (tipis | tebal), `gas` (ringan | menyengat), `gempa` (lemah | sedang | kuat) — validasi server + isian `ReportButton.jsx`.

### Fitur — hidromet & atmosfer (Fase 2.3, 2.4, 2.4b, 2.5)
- **H-PETIR / badai** `GET /api/convective?location=` (`server/convective.js`, TTL 30 menit): ECMWF IFS 0,25° (CAPE, kode cuaca 95–99, hembusan, hujan) × GFS (CAPE, Lifted Index, CIN) 12 jam ke depan; modul `badai`: CAPE 1000/2000, LI −3/−6, hembusan ≥ 45 km/jam (puting beliung), hujan ≥ 20 mm/jam, **potensi hujan es** (CAPE ≥ 2500 & LI ≤ −6 atau kode 96/99), `agreement` ECMWF↔GFS, nowcast BMKG aktif → minimal `bahaya`; aturan 30-30. §17.
- **H-BANJIR+ / Indeks Luapan v2** `GET /api/flood` (`server/flood.js`, TTL 6 jam): debit **GloFAS** (Open-Meteo Flood API) 4 sel DAS Peusangan (outlet Lut Tawar, Takengon, Bintang, Angkup) vs klimatologi DOY ± 15 hari 1997–2025 (`server/clim/flood-clim.json`, `npm run clim:flood`); `watershed.js` v2 = maks(indeks hujan hulu, anomali debit 2×/3×/5× median atau > p95) + pengubah ARI72 ≥ 100 mm; sentra di luar DAS tetap `n/a`. §18.
- **Laporan eksternal** `GET /api/external-reports` (`server/petabencana.js`, TTL 10 menit): laporan warga PetaBencana.id (Aceh) disaring Gayo (kode 1104/1117/1113 atau ≤ 60 km), konteks saja — bukan masukan skor (ADR-20), atribusi CC BY-NC 4.0.
- **Interaksi lintas-bahaya** (`src/domain/hazards/interactions.js`, FR-X-2): `gempa_tanah_jenuh` (longsor +1 ≤ bahaya), `kekeringan_ffmc` (kebakaran +1 ≤ waspada), `badai_longsor`, `vulkanik_hujan_lahar`, `asap_hujan_lebat`; `evaluateAll` → `interactions[]`, hasil yang dinaikkan membawa `flags.baseLevel/bumpedBy`. §19.
- **UI**: `HazardFocusCards.jsx` (StormCard strip 12 jam, FloodCard grafik SVG debit vs median/p95, QuakeCard, VolcanoCard, ExternalReportsCard) + daftar interaksi di `HazardPanel`; peta skematik mewarnai 11 bahaya.

### Fitur — agro-klimat (Fase 3.1, 3.2, 3.4)
- **SPI-1/3** (`server/spi.js`): gamma McKee/Thom 1958 dengan koreksi nol, baseline ERA5 **1991–2020** per sentra (`server/clim/spi-baseline.json`, `npm run clim:spi`); `/api/drought` → `spi`; modul `kekeringan` menaikkan level bila SPI ≤ −1 / −1,5 / −2. **VPD siang** 09–15 WIB rata-rata 7 hari (Tetens) → `vpd7` (> 0,82 kPa waspada bunga, > 1,5 bahaya). §20.
- **H-SUHU** modul `suhu` (`temperature.js`, `features.thermalSummary`): **dingin/embun upas** Tmin 10/6/4 °C dengan syarat awan < 30 %, angin ≤ 5 km/jam, Td ≤ 2 °C, koreksi −1 °C untuk sentra ≥ 1.400 m; **panas/aborsi bunga** Tmax 28/30/32 °C (+1 tingkat saat bulan berbunga [1–4, 8–9] & VPD > 0,82). Open-Meteo klien/server menambah `cloud_cover, dew_point_2m, vapour_pressure_deficit`. §21.
- **Kalender musiman diperluas** (`seasonal.js`: `dryPhase`, `frostWindow`, `climateAdjustment` ENSO/IOD dari `climateOutlook.json`, `seasonalInfoExtended`) → `/api/seasonal` + `SeasonalBanner.jsx`.

### Validasi, operasi & CI (Fase 1.10b, 4.2, 4.4, 4.5)
- `scripts/validate-season.mjs` (`npm run validate:season -- --days 120 --min waspada --events <json> --out <json>`): POD / FAR / rasio aktif per bahaya dari arsip harian × laporan warga × kejadian terkurasi; protokol di **`docs/reference/VALIDATION.md`**, format kejadian `docs/validation/events-template.json`, draf surat **`docs/templates/surat-pengantar-BPBD.md`** (H-8).
- `scripts/smoke.mjs` (`npm run smoke`): menjalankan server pada port acak, memeriksa 15 endpoint + `POST /api/alerts/run?dryRun=1` (gagal pada 5xx/non-JSON; upstream degraded ditoleransi). `.github/workflows/ci.yml`: `npm ci → test → build → check:bundle → smoke`.
- `/healthz` menambah status `quakes`, `volcano`, `flood`, `petabencana`; `.env.example` + `CONVECTIVE_TTL_MIN`, `QUAKE_TTL_MIN`, `VOLCANO_TTL_MIN`, `PETABENCANA_TTL_MIN`, `HAZARDS_ENABLED` (11 id).
- Dokumentasi: `docs/reference/THRESHOLDS.md` §15–21, `docs/dev/03-ROADMAP.md` (status), `05-ARCHITECTURE.md` §5 (realisasi vs rencana), `06-THRESHOLDS-MULTI-HAZARD.md` §11, **`docs/dev/10-ROADMAP-V3.md`** (arah 2027–28: kalibrasi lokal, Web Push/VAPID, sensor PM2,5, AWLR, Leaflet lazy-load, API publik, Gayo).

### Test & kinerja
- +49 test (`quake`, `volcano`, `convective`, `flood`, `interactions`, `temperature`, `validate-season`, tambahan `seasonal`, `reports`, kontrak registry) → total **285** lulus; `npm run build` OK; `check:bundle` ✓ (JS utama ≈ 132 kB gzip, batas 150).

### Ditunda (lihat `10-ROADMAP-V3.md`)
- 2.6 Web Push (butuh VAPID key — H-9); ADR-24 tahap 2 Leaflet lazy-load; 4.1 kalibrasi lokal (butuh ≥ 1 musim arsip + kejadian BPBD); 4.3 sensor PM2,5.

## v2.0-dev Sprint 3 (Fase 0: 0.2–0.5 · Fase 1: 1.6b, 1.8, 1.8b, 1.9c, 1.9d, FR-X-4/5/8/9)

### Fitur
- **Hazard registry (ADR-12/16)** `src/domain/hazards/{index,levels,features,landslide,watershed,wind,rust,airQuality,fireWeather,drought}.js`: 7 modul murni (`longsor, banjir, angin, karat, asap, kebakaran, kekeringan`) dengan kontrak seragam `{id,label{id,gayo},group,level,score,headline,detail,metrics[],advice{umum,rentan,kebun,sekolah},sources[],flags,degraded,validUntil,evaluatedAt}`; `evaluateAll(ctx)` → `{results[] terurut level, worst, active[], counts}`; skala level seragam `n/a < rendah < waspada < bahaya < ekstrem` (docs/reference/THRESHOLDS.md §13). Logika kartu lama tidak diubah — registry memakai fungsi domain yang sama.
- **`HazardPanel.jsx`** (menggantikan tempat `DisasterWarning` sebagai panel utama; ringkasan lama tetap): daftar hazard terurut level, kelompok hidromet/atmosfer-kebakaran/agro, akordeon detail + metrik + anjuran 4 kelompok + sumber & waktu, tombol **Bagikan** (`ShareButton.jsx`: WhatsApp / SMS ≤ 160 karakter / salin — `src/domain/share.js`, selalu dengan disclaimer & nomor darurat) dan **Tentang data & batasan**. Feature flag: server `HAZARDS_ENABLED` (`'*'` atau daftar id), klien `VITE_HAZARDS_ENABLED` + `localStorage nga.hiddenHazards` (`src/lib/prefs.js`).
- **Diseminasi (ADR-22)** `src/domain/alert.js`: objek `Alert` CAP 1.2 per hazard × sentra (identifier, msgType Alert/Update/Cancel, severity Moderate/Severe/Extreme, urgency, certainty Observed/Likely/Possible, expires, area lingkaran 5 km, `official[]` = peringatan BMKG aktif), renderer **Telegram / WhatsApp-teks / SMS / CAP XML**, anti-kebisingan (`PUSH_POLICY` per hazard, jeda 6 jam kecuali naik level, `Cancel` saat turun, penggabungan ≥ 3 sentra, maks 12 pesan/siklus — docs/reference/THRESHOLDS.md §14).
- **Arsip harian hazard (1.10b, ADR-26)**: setiap evaluasi `/api/hazards?location=all` menulis snapshot level per sentra (maks. 1 per jam) ke `server/data/hazard-archive/YYYY-MM-DD.json` (gitignored) — bahan validasi musiman & KPI; `readArchive({ days })` untuk skrip Sprint 4.
- **Server** `server/hazards.js` + `server/alerts.js`: `GET /api/hazards?location=<id>|all` (ctx 15 sentra dari cuaca, AQ, FWI, arsip, laporan; TTL `HAZARDS_TTL_MIN`), `GET /api/alerts/feed[?format=cap&id=]`, `POST /api/alerts/run[?dryRun=1]` (header `x-cron-token` = `ALERTS_CRON_TOKEN`; state `server/data/alert-state.json`; kirim Telegram `TELEGRAM_*`), `GET /healthz` (versi, fitur, status per sumber cache: umur, degraded). Cron: `scripts/alerts-cron.mjs` + unit systemd `server/agroclimate-alerts.{service,timer}` (tiap 30 menit).
- **Banner konteks iklim** `ClimateBanner.jsx` (`src/domain/climate.js`): El Niño/IOD/status musim dari `climateOutlook.json` + verifikasi lokal dari `/api/drought` (basah/sedang/kering); peringatan "perlu pembaruan" setelah `validUntil`.
- **Riwayat kejadian** `src/data/disasterHistory.json` digabung dengan tambahan 2013–2026 (12 kejadian, skema `hazard`, `emergencyStatus`, `sources[]`); `GET /api/disaster-history?location=<id>&hazard=<id>` → `{count, hazard, byHazard, lastEvents}`; kartu `DisasterHistoryCard.jsx`.
- **Kontak darurat** `src/data/contacts.js` (`contactsFor(hazard, kecamatan)`; hanya nomor terverifikasi: 112, BPBD Aceh Tengah (0643) 21113, Damkar 113, Halo Kemenkes 1500567; nomor kecamatan menunggu verifikasi H-5) + kartu `EmergencyContacts.jsx` (tautan `tel:`).
- **"Tentang data & batasan"** `AboutData.jsx` (modal dari HazardPanel & footer): 8 sumber + lisensi (Open-Meteo CC BY 4.0, CAMS/ERA5 Copernicus, FIRMS, BMKG, FWI/cffdrs, BNPB/BPBD, GADM non-komersial), estimasi vs pengukuran, arti level, batasan, privasi (tanpa PII; IP hanya untuk rate-limit laporan), kontak koreksi.
- **Laporan warga** tipe baru `kekeringan` (tanda: sumur kering / daun layu / sungai surut) dan `badai` (jenis: petir / hujan es / puting beliung) — validasi `server/reports.js`, isian `ReportButton.jsx`.
- **Peta skematik** `SchematicMap.jsx` (`src/domain/geo.js`, ADR-24 tahap 1): batas 22 kecamatan Aceh Tengah + Bener Meriah (GADM, 21 kB), 15 sentra berwarna level tertinggi (`weatherService.hazardsAll` ← `/api/hazards?location=all`), hotspot FIRMS ≤ 25 km, segitiga + radius 3 km Burni Telong (PVMBG Level II), label anti-tumpang-tindih, klik → pilih sentra. Mobile: tab Lokasi; desktop: baris bawah.
- **Angin**: `WIND_GUST.ekstrem = 75 km/jam` (≈ Beaufort 9) untuk skala seragam; `WIND_GUST.bmkgEkstrem = 45` → penanda `flags.bmkgExtreme` (docs/reference/THRESHOLDS.md §4).
- Alat: `npm run check:bundle` (`scripts/check-bundle.mjs`, gagal bila JS utama > 150 kB gzip; saat ini ≈ 114 kB); `.env.example` + `HAZARDS_ENABLED`, `HAZARDS_TTL_MIN`, `ALERTS_CRON_TOKEN`, `PUBLIC_URL`, `API_BASE`, `VITE_HAZARDS_ENABLED`.

### Test
- +38 test (`tests/hazards.contract.test.js`, `share.test.js`, `alert.test.js`, `climate.test.js`, `geo.test.js`, tambahan di `reports.test.js`, `seasonal.test.js`) → total **236** lulus; `npm run build` OK.

### Utang teknis / catatan (dibawa ke Sprint 4)
- Modul `longsor`: jendela "48 jam terakhir" masih sebagian prakiraan (klien tanpa `past_days`; `rain72 == rain24` pada ctx klien) — sama dengan perilaku kartu lama; perbaikan = ctx dari arsip (1.10b).
- `fetchAllAlerts` memakai `precip.slice(-24)` (= D+2) untuk ringkasan lama; `/api/alerts/run` memakai registry, bukan jalur ini.
- `hazardsAll` di klien best-effort (peta tetap tampil abu-abu bila gagal); `climateOutlook.json` wajib diperbarui manual (`validUntil` 2026-11-30); nomor kontak kecamatan `null` sampai H-5; koordinat sentra Rusip Antara di luar poligon kecamatannya (H-2).
- Tag `v1.2.0` (H-6) dan `FIRMS_MAP_KEY` (H-1) masih menunggu; aktivasi cron produksi (H-7): isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, `ALERTS_CRON_TOKEN`, lalu `systemctl --user enable --now agroclimate-alerts.timer`.

## v2.0-dev Sprint 2 (Fase 1: 1.4, 1.5, 1.6, 1.7, 1.9, 1.9b)

### Fitur
- **Arsip cuaca 90 hari** `server/archive.js`: Open-Meteo Archive (ERA5) harian + jam-an per sentra, 92 hari s.d. kemarin WIB, celah ≤ 7 hari diisi prakiraan ECMWF `past_days=7&forecast_days=3`, deret gabungan diberi `source[]` = `archive | model | forecast`; TTL 12 jam (`ARCHIVE_TTL_MIN`), salinan file `server/data/archive-<id>.json` sebagai cadangan saat upstream gagal; degraded bila lag arsip > 7 hari.
- **H-API** `GET /api/fire-danger?location=<id>|all` (`server/fireWeather.js`): FWI operasional — pengamatan 12.00 WIB, hujan 24 jam hingga jam pengamatan, spin-up 90 hari, hari ini dihitung bila sudah ≥ 12.00 WIB, riwayat 7 hari, proyeksi D+1–D+2 dari ECMWF, titik awal cadangan `server/data/fwi-state.json`; penilaian gabungan FWI × hotspot × HTH (`assessFireDanger`: level, kelas tampilan dengan gerbang FFMC ekstrem, **Siaga Kebakaran Lokal** = FFMC ≥ 78 & hotspot ≤ 25 km, ekstrem = FWI > 13 & hotspot ≤ 25 km), kelas Drought Code BMKG (`FWI.dc` 140/260/350).
- **Hotspot FIRMS** `GET /api/hotspots?location=<id>` (`server/firms.js`, `src/domain/hazards/hotspots.js`): 4 sumber NRT (VIIRS S-NPP/NOAA-20/NOAA-21, MODIS), bbox Aceh Tengah–Bener Meriah, 2 hari, TTL 30 menit; parser CSV, saringan keyakinan (VIIRS n/h, MODIS ≥ 50), jendela 24/48 jam, haversine ke 15 sentra (≤ 10/25/50 km), FRP intens ≥ 20 MW, level per sentra; **degraded tanpa `FIRMS_MAP_KEY`** (kartu tetap tampil dengan catatan) dan bila FIRMS membalas "Invalid MAP_KEY"/kuota.
- **H-KERING** `GET /api/drought?location=<id>|all` (`src/domain/hazards/drought.js`): Hari Tanpa Hujan berturut-turut (kelas BMKG HH/1–5/6–10/11–20/21–30/31–60/> 60, mundur dari hari terakhir berdata), proyeksi HTH hari ini…D+2 dari prakiraan, neraca air 30 hari Σ(P − ET0), deret 30 hari untuk grafik, anjuran kopi.
- Kartu **"Bahaya Kebakaran"** (`FireDangerCard.jsx`): FWI + kelas FDRS, status, peringatan Siaga Kebakaran Lokal, kode FFMC/DC/ISI, baris pengamatan siang, blok hotspot 24/48 jam per radius + titik terdekat/FRP (atau catatan degraded), HTH, proyeksi D+1–D+2, anjuran (tampilkan lebih), tautan BMKG DC & SiPongi. Kartu **"Kekeringan"** (`DroughtCard.jsx`): HTH + kelas, grafik batang hujan 30 hari, hujan terakhir & proyeksi, metrik hujan/ET0/neraca, anjuran, tautan BMKG Iklim. Mobile: tab Risiko; desktop: kolom kanan (kebakaran) & kolom tengah (kekeringan).
- **Laporan warga** tipe `asap` (skala jarak pandang `>5km | 1-5km | <1km` wajib + centang "bau asap") dan `kebakaran` (centang "api masih menyala", pengingat Damkar 113) — validasi server (`server/reports.js`), relay Telegram menyertakan detail; `ReportButton.jsx` menampilkan isian khusus per tipe.
- **Kopi × asap** (FR-ASAP-5): `dryingStatus(rain, solarRad, rh, haze)` mengembalikan **"Tunda (asap)"** bila `coffeeHazeRule` menahan penjemuran (ISPU ≥ 101 atau AOD ≥ 1 & DNI < 300); hujan tetap diprioritaskan; `weatherService` meneruskan ISPU/AOD/DNI dari kartu udara dan menambahkan `fireDanger`, `drought` ke payload.
- Konstanta baru `thresholds.HOTSPOT / FWI_OPS / HTH / WATER_BALANCE / FWI.dc` (docs/reference/THRESHOLDS.md §10–12); i18n `fireDanger*`, `drought*` (Gayo `[?]`); `.env.example` + `FIRMS_SOURCES`, `FIRMS_DAYS`, `ARCHIVE_DAYS`.

### Test
- +54 test (`tests/drought.test.js`, `hotspots.test.js`, `archive.test.js`, `fireWeatherServer.test.js`, `firmsServer.test.js`, `dryingHaze.test.js`, tambahan di `reports.test.js` & `fireWeather.test.js`) → total **198** lulus. Semua fetch upstream di-mock (`fetchImpl`) dan file state ditulis ke direktori sementara.

### Sinkronisasi upstream (575c4d3)
- Dipulihkan dari paket Sprint 1 yang tidak ikut terpasang di upstream d05bd0e: `tests/ispu.test.js`, `tests/hazardData.test.js`, 6 fixture `tests/fixtures/hazards/*` (arsip 90 hari, konvektif, banjir Peusangan, GFS CAPE/LI, PetaBencana, USGS), `magma-tingkat-aktivitas.html` (sebelumnya 0 byte), proxy dev Vite `/api` → `127.0.0.1:7455`.

### Catatan lapangan (15 Okt 2026)
- Takengon berada di musim basah: HTH 0, hujan 30 hari ≈ 380 mm, FWI 0 (FFMC ≈ 35, DC ≈ 5). Kabut asap yang terasa di Aceh Tengah berasal dari karhutla **jauh** (transport regional), bukan kebakaran lokal — konsisten dengan kartu udara (AOD tinggi, PM2,5 sedang) dan kartu kebakaran (rendah).

## v2.0-dev Sprint 1 (Fase 1: 1.1, 1.2, 1.3, 1.5b + rilis cepat kartu)

### Fitur
- **H-ASAP** `GET /api/air-quality?location=<id>` (`server/airQuality.js`): Open-Meteo Air Quality (CAMS global ~40 km, `past_days=1`) + jarak pandang/RH/DNI `best_match`; TTL 60 menit (`AQ_TTL_MIN`); degraded tanpa throw; `?location=all` ringkasan 15 sentra + lokasi terburuk.
- `src/domain/hazards/ispu.js` — ISPU Permen LHK P.14/2020 (PM2,5/PM10/CO, interpolasi linier, kategori, rata-rata bergerak 24 jam/8 jam) dan `src/domain/hazards/airQuality.js` — penilaian lengkap: ISPU 24 jam + nilai sesaat, proksi kabut asap dari jarak pandang siang 10–17 WIB (penyaring RH ≥ 90 %, wajib didukung PM2,5 ≥ 35 atau AOD ≥ 0,5, eskalasi bahaya butuh ≥ 2 jam < 2 km), prospek 24 jam, anjuran 4 kelompok + ruang bersih (`healthAdvice.json`), catatan WHO, aturan tunda jemur/kerja kebun.
- `src/domain/hazards/fireWeather.js` — FWI System (FFMC/DMC/DC/ISI/BUI/FWI, opsi ekuator, kelas FDRS, `fireDangerClass` kalibrasi lokal) dipindahkan dari prototipe; = dataset uji resmi `cffdrs` 48 hari hingga 0,005. Server/kartu kebakaran menyusul (1.4–1.6).
- Kartu **"Kabut Asap & Kualitas Udara"** (`AirQualityCard.jsx`) di tab Kini (mobile) dan kolom kanan (desktop): angka ISPU + kategori, status, jarak pandang siang, PM2,5/PM10/AOD, prospek, anjuran per kelompok, daftar periksa ruang bersih, label "estimasi model CAMS — bukan ISPU resmi" + tautan ISPUNet/BMKG. `weatherService` mengembalikan `airQuality` (best-effort).
- Konstanta baru `thresholds.ISPU / HAZE / FWI` (docs/reference/THRESHOLDS.md §7–9); i18n kunci `airQuality*` (Gayo ditandai `[?]`).
- Dev: proxy Vite `/api` → `127.0.0.1:7455`; `scripts/fetch-hazard-fixtures.mjs` menambah `relative_humidity_2m` pada fixture jarak pandang.

### Test
- +46 test (`tests/ispu.test.js`, `fireWeather.test.js`, `airQuality.test.js`, `airQualityServer.test.js`) → total **144** lulus. Koreksi: dataset `cffdrs` berisi 48 hari (13 Apr–30 Mei 1985), bukan 49.

### Dokumen perencanaan multi-bahaya (sebelumnya)
- Paket perencanaan `docs/dev/` (indeks: `docs/dev/README.md`): audit repo, log 10 iterasi riset, PRD multi-bahaya (asap karhutla, kebakaran/FWI, gempa, vulkanik Burni Telong, kekeringan/HTH, suhu ekstrem, banjir/GloFAS, konvektif petir–hujan es–puting beliung, kesehatan, diseminasi CAP), roadmap 4 fase (Okt 2026–Apr 2027), katalog sumber data (diuji langsung), arsitektur + ADR-12…26, ambang multi-bahaya, risk register, tata kelola/KPI.
- Prototipe fungsi murni tervalidasi (`docs/dev/prototypes/`): ISPU Permen LHK P.14/2020 dan FWI System (Van Wagner 1987; = dataset uji resmi `cffdrs` 48 hari hingga 0,005) — `node docs/dev/prototypes/check.mjs`, `check-cffdrs.mjs`.
- Penyiapan aset data (`docs/dev/09-DATA-PREP.md`): fixture nyata 13 sumber (`tests/fixtures/hazards/`, `scripts/fetch-hazard-fixtures.mjs`), `src/data/geo/kecamatan.json` (GADM, 21 kB), data statis `src/data/hazards/*` (anjuran kesehatan, konteks iklim, riwayat tambahan, pemetaan sentra→kecamatan, kerangka kontak), `.env.example`, test `tests/hazardData.test.js` (+7; total 98). `healthAdvice.json` kini dipakai Sprint 1; aset lain belum di-import.

## [1.2.0] - 2026-10-04 — M3-M4 + F1/F2/F4/F5/F7/F8

### Konsolidasi PRD (F1–F8, detail di docs DISASTER-DATA-RESEARCH repo docs)
- F1 konsensus multi-model (ADR-8): `/api/consensus` — ECMWF ifs025 50 member + WeatherNext2 64 member, P(hujan>25mm/24j) per model, level tinggi (≥2 setuju)/sedang/rendah, fallback degraded.
- F2 antecedent rainfall index (ADR-9): `/api/alerts` menyertakan `antecedent` 24/72j; bobot longsor diupgrade antecedent 72j 25→35, hujan 24j 35→25. Sumber primer **NASA IMERG Late daily** (server/imerg.js, OPeNDAP GES DISC + Earthdata Bearer; ARI 24j/72j/7d, cache 30 menit, retry 2x) dengan fallback otomatis `model-ecmwf` bila gagal/401.
- F4 riwayat bencana (ADR-11): DIBI BNPB tak menyediakan endpoint JSON kejadian → data statis terkurasi 6 kejadian 2023–2026 (`src/data/disasterHistory.json`), `/api/disaster-history`, blok "Riwayat kejadian" di panel Risiko.
- F5 nowcast resmi BMKG (ADR-10): `/api/bmkg-nowcast` parse RSS CAP bmkg.go.id, filter Aceh, cache 10 menit, degraded false-error.
- F7 kalender risiko musiman: `src/domain/seasonal.js` (PUNCAK Nov–Feb / WASPADA Mar–Apr+Okt / RENDAH Mei–Sep), `/api/seasonal`, banner musiman.
- F8 lapor warga: `ReportButton` (modal aksesibel) + `POST /api/reports` → `server/data/reports.json` (gitignored), rate limit 5/jam/IP, relay Telegram topik #55; `GET /api/reports` riwayat 7 hari.
- Diseminasi: 2 cron Telegram diarahkan ke topik #55 Cron/Automate (Peringatan Dini Gayo 30m→3h, Status Mitigasi Bencana 3h→6h).
- WN3: form akses WeatherNext 3 terkirim 3 Okt 2026, menunggu approval (~7 hari kerja).

### UI
- Token desain "Stasiun Cuaca Kebun" + refactor komponen; dua layout (mobile tab bar 4 tab + desktop grid editorial 12 kolom).

### Fix
- PWA: workbox skipWaiting+clientsClaim+cleanupOutdatedCaches (SW stale bundle tidak menggantung update).
- API: buang param `time` dari `current` (HTTP 400 Open-Meteo models=ecmwf_ifs025).
- Housekeeping: gitignore `server/data/` (runtime laporan warga).

## [1.1.0] - 2026-10-03 — M0-M2 (Part A)

### M0 — Spikes (semua GO, verdict di docs/SPIKES.md)
- S1: `models=ecmwf_ifs025` terverifikasi hidup untuk 15/15 lokasi (field hourly lengkap, DNI non-null).
- S2: BMKG `api.bmkg.go.id/publik/prakiraan-cuaca` HTTP 200 dari VPS dengan UA browser (adm4 Takengon Timur = 11.04.17.2001; 3-harian per-3-jam). Rate-limit 429 saat burst → wajib cache.
- S3: fungsi pure `src/domain/ensemble.js` — P(hujan >25mm / >50mm per 24 jam) dari 50 member; 5 unit test.
- S4: vite-plugin-pwa terpasang & terkonfigurasi (autoUpdate SW + manifest); build menghasilkan sw.js + precache.
- S5: fungsi pure `leafWetnessRustRisk(rolling48h)` + fixture test (5 unit test).

### M1 — Perbaikan kebenaran data
- BUG-01: slice hourly mulai dari index `current.time` (jam berjalan), bukan 00:00.
- BUG-02: solarRad diambil dari jam berjalan (index current), bukan jam tengah malam.
- BUG-03: timestamp dari `current.time` API, bukan jam browser.
- BUG-04: tambah `models=ecmwf_ifs025` + param `elevation=` per lokasi.
- AbortController + retry eksponensial + dedupe request in-flight; cache memory 10 menit + staleness.

### M2 — Arsitektur & repo hygiene
- Pecah weatherService → `src/api/openMeteo.js` (fetch murni + DI fetch) + `src/domain/{coffee,disaster,format,thresholds}.js` (fungsi murni, tanpa className).
- Error boundary React (`src/components/ErrorBoundary.jsx`).
- Hapus dist/ dari git + .gitignore; LICENSE (MIT, Niumination/Afrizal Munthe); CHANGELOG.md; AGENTS.md dikoreksi (indeks hujan DAS, bukan status muka air nyata).
