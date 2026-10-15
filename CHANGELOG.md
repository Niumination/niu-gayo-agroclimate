# Changelog

## [Unreleased] — v2.0-dev "Asap & Kebakaran" Sprint 3 (Fase 0: 0.2–0.5 · Fase 1: 1.6b, 1.8, 1.8b, 1.9c, 1.9d, FR-X-4/5/8/9)

### Fitur
- **Hazard registry (ADR-12/16)** `src/domain/hazards/{index,levels,features,landslide,watershed,wind,rust,airQuality,fireWeather,drought}.js`: 7 modul murni (`longsor, banjir, angin, karat, asap, kebakaran, kekeringan`) dengan kontrak seragam `{id,label{id,gayo},group,level,score,headline,detail,metrics[],advice{umum,rentan,kebun,sekolah},sources[],flags,degraded,validUntil,evaluatedAt}`; `evaluateAll(ctx)` → `{results[] terurut level, worst, active[], counts}`; skala level seragam `n/a < rendah < waspada < bahaya < ekstrem` (docs/THRESHOLDS.md §13). Logika kartu lama tidak diubah — registry memakai fungsi domain yang sama.
- **`HazardPanel.jsx`** (menggantikan tempat `DisasterWarning` sebagai panel utama; ringkasan lama tetap): daftar hazard terurut level, kelompok hidromet/atmosfer-kebakaran/agro, akordeon detail + metrik + anjuran 4 kelompok + sumber & waktu, tombol **Bagikan** (`ShareButton.jsx`: WhatsApp / SMS ≤ 160 karakter / salin — `src/domain/share.js`, selalu dengan disclaimer & nomor darurat) dan **Tentang data & batasan**. Feature flag: server `HAZARDS_ENABLED` (`'*'` atau daftar id), klien `VITE_HAZARDS_ENABLED` + `localStorage nga.hiddenHazards` (`src/lib/prefs.js`).
- **Diseminasi (ADR-22)** `src/domain/alert.js`: objek `Alert` CAP 1.2 per hazard × sentra (identifier, msgType Alert/Update/Cancel, severity Moderate/Severe/Extreme, urgency, certainty Observed/Likely/Possible, expires, area lingkaran 5 km, `official[]` = peringatan BMKG aktif), renderer **Telegram / WhatsApp-teks / SMS / CAP XML**, anti-kebisingan (`PUSH_POLICY` per hazard, jeda 6 jam kecuali naik level, `Cancel` saat turun, penggabungan ≥ 3 sentra, maks 12 pesan/siklus — docs/THRESHOLDS.md §14).
- **Arsip harian hazard (1.10b, ADR-26)**: setiap evaluasi `/api/hazards?location=all` menulis snapshot level per sentra (maks. 1 per jam) ke `server/data/hazard-archive/YYYY-MM-DD.json` (gitignored) — bahan validasi musiman & KPI; `readArchive({ days })` untuk skrip Sprint 4.
- **Server** `server/hazards.js` + `server/alerts.js`: `GET /api/hazards?location=<id>|all` (ctx 15 sentra dari cuaca, AQ, FWI, arsip, laporan; TTL `HAZARDS_TTL_MIN`), `GET /api/alerts/feed[?format=cap&id=]`, `POST /api/alerts/run[?dryRun=1]` (header `x-cron-token` = `ALERTS_CRON_TOKEN`; state `server/data/alert-state.json`; kirim Telegram `TELEGRAM_*`), `GET /healthz` (versi, fitur, status per sumber cache: umur, degraded). Cron: `scripts/alerts-cron.mjs` + unit systemd `server/agroclimate-alerts.{service,timer}` (tiap 30 menit).
- **Banner konteks iklim** `ClimateBanner.jsx` (`src/domain/climate.js`): El Niño/IOD/status musim dari `climateOutlook.json` + verifikasi lokal dari `/api/drought` (basah/sedang/kering); peringatan "perlu pembaruan" setelah `validUntil`.
- **Riwayat kejadian** `src/data/disasterHistory.json` digabung dengan tambahan 2013–2026 (12 kejadian, skema `hazard`, `emergencyStatus`, `sources[]`); `GET /api/disaster-history?location=<id>&hazard=<id>` → `{count, hazard, byHazard, lastEvents}`; kartu `DisasterHistoryCard.jsx`.
- **Kontak darurat** `src/data/contacts.js` (`contactsFor(hazard, kecamatan)`; hanya nomor terverifikasi: 112, BPBD Aceh Tengah (0643) 21113, Damkar 113, Halo Kemenkes 1500567; nomor kecamatan menunggu verifikasi H-5) + kartu `EmergencyContacts.jsx` (tautan `tel:`).
- **"Tentang data & batasan"** `AboutData.jsx` (modal dari HazardPanel & footer): 8 sumber + lisensi (Open-Meteo CC BY 4.0, CAMS/ERA5 Copernicus, FIRMS, BMKG, FWI/cffdrs, BNPB/BPBD, GADM non-komersial), estimasi vs pengukuran, arti level, batasan, privasi (tanpa PII; IP hanya untuk rate-limit laporan), kontak koreksi.
- **Laporan warga** tipe baru `kekeringan` (tanda: sumur kering / daun layu / sungai surut) dan `badai` (jenis: petir / hujan es / puting beliung) — validasi `server/reports.js`, isian `ReportButton.jsx`.
- **Peta skematik** `SchematicMap.jsx` (`src/domain/geo.js`, ADR-24 tahap 1): batas 22 kecamatan Aceh Tengah + Bener Meriah (GADM, 21 kB), 15 sentra berwarna level tertinggi (`weatherService.hazardsAll` ← `/api/hazards?location=all`), hotspot FIRMS ≤ 25 km, segitiga + radius 3 km Burni Telong (PVMBG Level II), label anti-tumpang-tindih, klik → pilih sentra. Mobile: tab Lokasi; desktop: baris bawah.
- **Angin**: `WIND_GUST.ekstrem = 75 km/jam` (≈ Beaufort 9) untuk skala seragam; `WIND_GUST.bmkgEkstrem = 45` → penanda `flags.bmkgExtreme` (docs/THRESHOLDS.md §4).
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
- Konstanta baru `thresholds.HOTSPOT / FWI_OPS / HTH / WATER_BALANCE / FWI.dc` (docs/THRESHOLDS.md §10–12); i18n `fireDanger*`, `drought*` (Gayo `[?]`); `.env.example` + `FIRMS_SOURCES`, `FIRMS_DAYS`, `ARCHIVE_DAYS`.

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
