# Changelog

## [Unreleased] — v2.0-dev "Asap & Kebakaran" Sprint 1 (Fase 1: 1.1, 1.2, 1.3, 1.5b + rilis cepat kartu)

### Fitur
- **H-ASAP** `GET /api/air-quality?location=<id>` (`server/airQuality.js`): Open-Meteo Air Quality (CAMS global ~40 km, `past_days=1`) + jarak pandang/RH/DNI `best_match`; TTL 60 menit (`AQ_TTL_MIN`); degraded tanpa throw; `?location=all` ringkasan 15 sentra + lokasi terburuk.
- `src/domain/hazards/ispu.js` — ISPU Permen LHK P.14/2020 (PM2,5/PM10/CO, interpolasi linier, kategori, rata-rata bergerak 24 jam/8 jam) dan `src/domain/hazards/airQuality.js` — penilaian lengkap: ISPU 24 jam + nilai sesaat, proksi kabut asap dari jarak pandang siang 10–17 WIB (penyaring RH ≥ 90 %, wajib didukung PM2,5 ≥ 35 atau AOD ≥ 0,5, eskalasi bahaya butuh ≥ 2 jam < 2 km), prospek 24 jam, anjuran 4 kelompok + ruang bersih (`healthAdvice.json`), catatan WHO, aturan tunda jemur/kerja kebun.
- `src/domain/hazards/fireWeather.js` — FWI System (FFMC/DMC/DC/ISI/BUI/FWI, opsi ekuator, kelas FDRS, `fireDangerClass` kalibrasi lokal) dipindahkan dari prototipe; = dataset uji resmi `cffdrs` 48 hari hingga 0,005. Server/kartu kebakaran menyusul (1.4–1.6).
- Kartu **"Kabut Asap & Kualitas Udara"** (`AirQualityCard.jsx`) di tab Kini (mobile) dan kolom kanan (desktop): angka ISPU + kategori, status, jarak pandang siang, PM2,5/PM10/AOD, prospek, anjuran per kelompok, daftar periksa ruang bersih, label "estimasi model CAMS — bukan ISPU resmi" + tautan ISPUNet/BMKG. `weatherService` mengembalikan `airQuality` (best-effort).
- Konstanta baru `thresholds.ISPU / HAZE / FWI` (docs/THRESHOLDS.md §7–9); i18n kunci `airQuality*` (Gayo ditandai `[?]`).
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
