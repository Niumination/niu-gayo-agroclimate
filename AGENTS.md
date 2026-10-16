# Niu-Gayo-Agroclimate — Project AGENTS.md

**Lokasi:** `apps/niu-gayo-agroclimate/`  
**Stack:** React 19, Vite 6, Tailwind CSS, Open-Meteo & WeatherNext 3 Pipeline, Node Native Test  
**Remote:** `github.com/Niumination/niu-gayo-agroclimate`  
**Kategori:** Apps — Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi  

## Overview

Niu Gayo Agro-Climate adalah dashboard web presisi tinggi untuk memantau mikroklimat perkebunan kopi Arabika Gayo dan sistem peringatan dini bencana hidrometeorologi (longsor lereng terjal, banjir luapan Danau Lut Tawar & DAS Peusangan) di 15 wilayah sentra agro-ekologi Kabupaten Aceh Tengah.

## Fitur Utama

1. **Pemantauan Mikroklimat Kopi Arabika:**
   - Evaluasi suhu optimal (15°C – 24°C).
   - Deteksi risiko jamur karat daun (*Hemileia vastatrix*) berbasis kelembapan relatif tinggi (>85%) dan temperatur hangat.
   - Analisis jendela penjemuran (*post-harvest drying window*) berbasis radiasi surya normal langsung (*direct normal irradiance*) dan curah hujan.
2. **Sistem Peringatan Dini Bencana Alam:**
   - Deteksi potensi tanah longsor lereng perkebunan berbasis akumulasi presipitasi harian (>25mm waspada, >50mm bahaya).
   - Status muka air & luapan Daerah Tangkapan Air Danau Lut Tawar dan DAS Peusangan.
   - Peringatan kecepatan angin kencang (>35 km/jam) untuk keselamatan pohon pelindung kopi.
   - **v2.0.0 (multi-bahaya):** hazard registry **11 bahaya** — `longsor, banjir (DAS Peusangan + GloFAS), angin, badai (konvektif ECMWF×GFS), asap (ISPU/CAMS), kebakaran (FWI × hotspot FIRMS × HTH), kekeringan (HTH, neraca air, SPI-1/3, VPD), gempa (BMKG TEWS, MMI indikatif), vulkanik (MAGMA Burni Telong, sektor bawah angin), suhu (embun upas / stres panas kopi), karat` — dengan level seragam + interaksi lintas-bahaya, panel bahaya + kartu fokus, peringatan CAP → Telegram (cron 30' + jalur cepat 5'), banner iklim & musiman, riwayat kejadian, kontak darurat, laporan warga 11 tipe, laporan eksternal PetaBencana, peta skematik SVG, arsip harian untuk validasi. Rencana & status: `docs/dev/03-ROADMAP.md`; arah v3: `docs/dev/10-ROADMAP-V3.md`.
3. **Cakupan Wilayah:**
   - 15 Sentra di Kabupaten Aceh Tengah (Bebesan, Takengon, Pegasing, Kute Panang, Atu Lintang, Jagong Jeget, Lut Tawar, Bintang, Kebayakan, Bies, Silih Nara, Ketol, Celala, Rusip Antara, Linge).

## Dokumentasi (Diátaxis — sejak v2.1.0 / A-5)

Peta dokumentasi ada di **`docs/README.md`**. Aturan penempatan: **tutorial** (`docs/tutorials/`) = belajar dari nol · **how-to** (`docs/how-to/`) = resep tugas · **reference** (`docs/reference/`) = tabel/spesifikasi (termasuk `THRESHOLDS.md` & `VALIDATION.md`) · **explanation** (`docs/explanation/`) = alasan & prinsip · **arsip riset** tetap di `docs/dev/` (bernomor, jangan ditulis ulang sebagai dokumentasi hidup). Jangan menaruh berkas baru langsung di `docs/` (kecuali peta `README.md`).

## Verification Commands

- Test: `npm test` (node test runner; 321 test, semua fetch upstream di-mock)
- Cakupan: `npm run check:coverage` — **gerbang ambang** (baris ≥ 95 %, cabang ≥ 80 %, fungsi ≥ 92 %; ambang di `scripts/check-coverage.mjs`) + tren vs `scripts/coverage-baseline.json`; `npm run test:coverage` tetap ada sebagai laporan mentah
- Kesegaran outlook: `npm run check:outlook` (gagal bila `climateOutlook.json` kedaluwarsa; perbarui dari BMKG/NOAA CPC)
- Inventaris Gayo: `npm run check:i18n` (daftar label `[?]` yang menunggu tinjauan penutur asli — tugas manusia H-4)
- Kontras & tipografi desain: `npm run check:contrast` — menilai pasangan token di `src/index.css` terhadap WCAG 2.2 AA (teks 4,5:1 · non-teks 3:1) dan memindai utilitas teks beropasitas di `src/`; saat ini **informatif** (262 temuan), ubah CI menjadi `--strict` setelah paket P1–P4 di `docs/dev/11-RENCANA-DESIGN-UX.md` selesai. Nilai token & aturan keras ada di `docs/reference/DESIGN-TOKENS.md`.
- Build: `npm run build` (Vite 8/Rolldown; bundle production di `dist/`; ~0,4 dtk)
- Toolchain v2.1.0: Vite 8 + `@vitejs/plugin-react` 6 (Oxc) + **Tailwind 4 CSS-first** — konfigurasi tema/varian ada di `src/index.css` (`@theme`, `@custom-variant dark`), BUKAN lagi di `tailwind.config.js` (dihapus). Node ≥ 20.19 (lihat `engines`).
- Pemisahan chunk vendor memakai `build.rollupOptions.output.advancedChunks` (Rolldown); bentuk objek `manualChunks` v3 tidak didukung lagi.
- Pemasangan: `npm ci` normal. Bila menaikkan dependensi dari lockfile lama dan npm 10.x gagal `edgesOut`, jalankan sekali `npm install --legacy-peer-deps`, lalu lanjut normal.
- Dev Server: `npm run dev` (berjalan di port 5188)
- Production: `npm run build` → `dist/` di-serve `scripts/serve.py` (:7444); API `server/index.js` (:7455)
- Akses publik: `https://cuaca.abstract.biz.id` (Cloudflare Tunnel) — `/api/*` + `/healthz` forward ke :7455
- Dev: `npm run dev` mem-proxy `/api` ke `127.0.0.1:7455` — jalankan `node server/index.js` bersamaan agar kartu konsensus/BMKG/kualitas udara tampil
- Cek cepat H-ASAP: `curl -s 'http://127.0.0.1:7455/api/air-quality?location=takengon' | head -c 600` (lihat `docs/reference/THRESHOLDS.md` §7–9)
- Cek cepat H-API/H-KERING (Sprint 2): `curl -s 'http://127.0.0.1:7455/api/fire-danger?location=takengon'`, `.../api/hotspots?location=takengon`, `.../api/drought?location=takengon` (`docs/reference/THRESHOLDS.md` §10–12). Panggilan pertama ±5–10 detik (arsip 90 hari × 15 sentra diambil per lokasi, TTL 12 jam); file runtime `server/data/archive-<id>.json` & `fwi-state.json` (gitignored) boleh dihapus kapan saja.
- Hotspot: `FIRMS_MAP_KEY` sudah tersedia & terverifikasi (H-1 selesai 16 Okt 2026; panduan `docs/how-to/08-aktifkan-hotspot-firms.md`). Isi hanya di `.env` server — **jangan commit**, jangan masukkan ke paket. Rentang hari API FIRMS **1–5**; di luar itu dijepit otomatis (`clampFirmsDays` di `server/firms.js`) karena API menjawab HTTP 400. **0 hotspot = `degraded:false`** (bukan error) — jangan "perbaiki" jadi seolah gagal.
- Ambang (`src/domain/thresholds.js`) dan `docs/reference/THRESHOLDS.md` harus diubah bersamaan; test server memakai `fetchImpl` mock + `dataDir` sementara — jangan menulis ke `server/data/` dari test.
- Hazard registry (Sprint 3): modul baru = satu file murni di `src/domain/hazards/<id>.js` yang mengikuti kontrak `docs/dev/05-ARCHITECTURE.md` §2.1 dan didaftarkan di `src/domain/hazards/index.js` (id = tipe laporan warga = kunci i18n = feature flag); `tests/hazards.contract.test.js` memverifikasi bentuk hasil setiap modul secara otomatis. Cek cepat: `curl -s 'http://127.0.0.1:7455/api/hazards?location=takengon'`, `.../api/hazards?location=all`, `.../healthz`.
- Diseminasi: `node scripts/alerts-cron.mjs --dry-run` (tidak mengirim, tidak mengubah `server/data/alert-state.json`); aturan anti-kebisingan dan pemetaan CAP di `docs/reference/THRESHOLDS.md` §13–14 — ubah `src/domain/alert.js` dan dokumen bersamaan. Jangan mengirim pesan Telegram nyata dari test (`send` di-inject).
- Anggaran kinerja: `npm run check:bundle` setelah `npm run build` (JS utama ≤ 150 kB gzip; saat ini ≈ 132 kB). Peta skematik memakai `src/data/geo/kecamatan.json` (GADM 4.1, 21 kB) — jangan ganti dengan tile/Leaflet tanpa lazy-load (ADR-24).
- Smoke (Sprint 4, dipakai CI): `npm run smoke` — menjalankan `server/index.js` di port acak 7600–7899 dengan `ALERTS_CRON_TOKEN=smoke`, memeriksa 15 endpoint GET + `POST /api/alerts/run?dryRun=1`; gagal hanya pada 5xx/non-JSON (upstream *degraded* diterima). Urutan CI: `npm ci → test → build → check:bundle → smoke`.
- Geologi/konvektif/banjir+ (Sprint 4): cek cepat `curl -s 'http://127.0.0.1:7455/api/quakes?location=takengon'`, `.../api/volcano`, `.../api/convective?location=takengon`, `.../api/flood`, `.../api/external-reports` (`docs/reference/THRESHOLDS.md` §15–19). MAGMA diparse dari HTML — bila struktur berubah, server memakai nilai terakhir (`server/data/volcano-last.json`) atau `VOLCANO_OVERRIDE_PATH` (JSON manual, `force:true` menimpa parser). Jalur cepat gempa/vulkanik: `node scripts/alerts-cron.mjs --dry-run --only gempa,vulkanik` (timer `agroclimate-alerts-fast`).
- Klimatologi tersimpan di repo (`server/clim/flood-clim.json`, `server/clim/spi-baseline.json`) — **jangan** jalankan `npm run clim:flood` / `clim:spi` kecuali memperbarui baseline (Open-Meteo membatasi laju, HTTP 429; GloFAS mulai 1997, SPI baseline 1991–2020 `best_match`, bukan `era5_land`).
- Validasi musiman: `npm run validate:season -- --days 120 --min waspada --events <kejadian.json> --out <hasil.json>` (protokol `docs/reference/VALIDATION.md`, format `docs/validation/events-template.json`); arsip harian `server/data/hazard-archive/` terisi hanya bila `/api/hazards?location=all` dipanggil (cron). Perubahan ambang hasil validasi → `src/domain/thresholds.js` + `docs/reference/THRESHOLDS.md` + test, bersamaan.
- Modul `suhu` memakai `ctx.weather.thermal` (dari `features.thermalSummary`, butuh hourly `cloud_cover, dew_point_2m, vapour_pressure_deficit` + daily Tmin/Tmax) — jangan hapus variabel itu dari `openMeteo.js` klien/server. Interaksi lintas-bahaya hanya di `src/domain/hazards/interactions.js` (`docs/reference/THRESHOLDS.md` §19); label hazard (id + Gayo `[?]`) ada di masing-masing modul, bukan di `src/i18n/messages.js`.
- Tugas manusia terbuka: H-1 `FIRMS_MAP_KEY`, H-2 koordinat Rusip Antara, H-4 Gayo, H-5 nomor kecamatan, H-6 tag `v2.0.0`, H-7 aktivasi timer + token Telegram, H-8 surat BPBD (`docs/templates/surat-pengantar-BPBD.md`), H-9 VAPID (Web Push, ditunda), pembaruan `src/data/hazards/climateOutlook.json` sebelum `validUntil`.
