# Arsitektur Multi-Hazard & ADR

Versi 1.0 (final — 10 iterasi riset) · 2026-10-14. Melanjutkan ADR-1…11 (repo docs privat). ADR baru dimulai dari **ADR-12**.

## 1. Arsitektur saat ini (v1.2.0) — ringkas

```
Browser (React PWA)                       Server Node (http murni, :7455)
┌──────────────────────────┐              ┌──────────────────────────────────┐
│ App.jsx                  │  /api/*      │ index.js (router)                │
│  └ weatherService.js ────┼─────────────▶│  ├ cache.js (SWR)                │
│      ├ api/openMeteo.js ─┼──Open-Meteo─▶│  ├ openMeteo.js (15 lokasi)      │
│      ├ domain/coffee.js  │              │  ├ ensemble/consensus (ECMWF,WN2)│
│      ├ domain/disaster.js│              │  ├ antecedent/imerg (NASA)       │
│      └ domain/ensemble.js│              │  ├ bmkg.js (RSS CAP)             │
│  └ components/*          │              │  └ reports.js (JSON + Telegram)  │
└──────────────────────────┘              └──────────────────────────────────┘
```
Masalah: `weatherService` dan `DisasterWarning` mengetahui **secara eksplisit** tiga hazard; menambah hazard = menyentuh 4–5 file.

## 2. Arsitektur target (v2)

```
                    ┌──────────────── HAZARD REGISTRY (src/domain/hazards) ────────────────┐
                    │ landslide │ watershed │ wind │ airQuality │ fireWeather │ hotspots │ … │
                    └───────────────┬──────────────────────────────────────────────────────┘
                                    │ evaluate(ctx) → HazardResult
   ctx = { location, weather(hourly/daily), airQuality, hotspots, quakes, fwiState, reports, now }
                                    │
   Klien: hazardService.js ─────────┼──────────▶ HazardPanel (render daftar, urut level)
   Server: /api/hazards?location= ──┘          CompoundBanner (bahaya majemuk)
```

### 2.1 Kontrak modul hazard
```js
// src/domain/hazards/<id>.js — fungsi murni, tanpa fetch, tanpa className
export default {
  id: 'airQuality',               // = tipe laporan warga, = kunci i18n, = feature flag
  group: 'atmosfer',              // hidromet | atmosfer | geologi | agro
  label: { id: 'Kabut Asap & Udara', gayo: '…' },
  requires: ['airQuality', 'visibility'],   // kunci ctx yang wajib; jika tak ada → result {level:'n/a', degraded:true}
  evaluate(ctx) {
    return {
      level: 'rendah' | 'waspada' | 'bahaya' | 'ekstrem' | 'n/a',  // skala seragam 4 tingkat
      score: 0..100 | null,
      headline: 'ISPU 118 — Tidak Sehat',
      detail: '…',
      metrics: [{ key:'pm25_24h', value: 61.2, unit:'µg/m³' }, …],
      advice: { umum:[…], rentan:[…], kebun:[…], sekolah:[…] },
      sources: [{ name:'CAMS global via Open-Meteo', retrievedAt, kind:'model' }],
      validUntil: ISOString,
      degraded: false,
    }
  },
}
```
Skala level seragam memetakan skala domain (ISPU 5 kelas, FDRS 4 kelas, MMI, dll.) → 4 tingkat UI + warna token (`leaf`/`husk`/`cherry`/`ink`). Label domain asli tetap ditampilkan di `headline`.

### 2.2 Konteks (`ctx`) dibangun di dua tempat
- **Klien** (`hazardService.js`): memanggil `/api/*` secara `allSettled`, merakit ctx, menjalankan `evaluate` untuk 1 lokasi → UI tetap bekerja offline dengan cache SW.
- **Server** (`/api/hazards` & `/api/alerts`): ctx untuk 15 lokasi → cron Telegram, ekspor BPBD.
Kedua jalur memakai **modul domain yang sama** (ESM dibagi, seperti `seasonal.js` saat ini).

### 2.3 Server: fetcher baru mengikuti pola `bmkg.js`
`server/airQuality.js`, `server/firms.js`, `server/bmkgQuake.js`, `server/fwiState.js` — masing-masing: `fetchX({ fetchImpl })` murni-diuji, `parseX(raw)` dengan fixture, hasil selalu objek (tidak throw), dibungkus `cached()`.

### 2.4 State persisten ringan
`server/data/` (gitignored) sudah dipakai untuk laporan; ditambah `fwi-state.json` (kode kelembapan harian per lokasi) dan `quota.json`. Tetap file JSON — tidak perlu DB.

## 3. ADR

> **Status implementasi (Sprint 3, 15 Okt 2026):** ADR-12 ✅ (`src/domain/hazards/index.js`, 7 modul, `evaluateAll`), ADR-13 ✅, ADR-14 ✅, ADR-15 ✅ (degraded tanpa MAP_KEY), ADR-16 ✅ (`levels.js`), ADR-22 ✅ (lihat catatan), ADR-24 tahap 1 ✅ (`SchematicMap.jsx`), ADR-25 sebagian (`scripts/check-bundle.mjs`; CI belum), ADR-26 sebagian (atribusi & privasi di `AboutData.jsx`; arsip harian `server/data/hazard-archive/` ✅; skrip validasi musiman belum).

### ADR-12 — Hazard Registry sebagai titik ekstensi tunggal
- **Konteks:** 9 hazard baru akan masuk bertahap; UI & service saat ini hard-coded.
- **Keputusan:** registry array terurut + kontrak §2.1; `HazardPanel` generik; `/api/hazards` di server.
- **Konsekuensi:** migrasi 3 hazard lama (tanpa mengubah ambang) sebelum fitur baru; test kontrak (`tests/hazards.contract.test.js`) memastikan setiap modul memenuhi skema.

### ADR-13 — Kualitas udara dari model CAMS, bukan "pengukuran"
- **Konteks:** tidak ada stasiun ISPU/AQMS di Aceh Tengah; CAMS global 45 km.
- **Keputusan:** tampilkan **ISPU estimasi** dari PM2.5 CAMS (rata-rata 24 jam bergerak), dengan AOD + CO + `visibility` + laporan warga sebagai sinyal pendamping; label wajib "estimasi model".
- **Alternatif ditolak:** AQI US sebagai indeks utama (tidak sesuai regulasi lokal); scraping IQAir (ToS, tidak stabil).

### ADR-14 — FWI System dihitung in-house (bukan unduh GEFF)
- **Konteks:** server tanpa dependensi; GEFF butuh CDS + NetCDF.
- **Keputusan:** implementasi persamaan Van Wagner 1987 sebagai fungsi murni; state harian JSON; kelas FDRS Indonesia; spin-up 60 hari ERA5.
- **Konsekuensi:** perlu validasi silang dengan SPBK BMKG (Fase 4); label "kalibrasi nasional".

### ADR-15 — Hotspot via NASA FIRMS, SiPongi sebagai rujukan
- **Keputusan:** FIRMS Area API (kunci gratis) karena terdokumentasi & CSV stabil; tautan SiPongi ditampilkan untuk pengguna yang butuh status lahan resmi.
- **Konsekuensi:** hotspot ≠ titik api; UI harus menjelaskan (confidence, FRP, siang/malam).

### ADR-16 — Skala level seragam 4 tingkat lintas hazard
- **Keputusan:** `rendah / waspada / bahaya / ekstrem` + `n/a`; pemetaan per domain terdokumentasi di `06-THRESHOLDS-MULTI-HAZARD.md`.
- **Konsekuensi:** indeks majemuk = maksimum level + jumlah hazard ≥ waspada; aturan interaksi eksplisit.

### ADR-17 — Gempa: BMKG sebagai otoritas, USGS pelengkap, tanpa prediksi
- **Keputusan:** `server/bmkgQuake.js` menormalkan tiga JSON BMKG; USGS hanya untuk riwayat/kalibrasi; MMI indikatif dilabeli; diseminasi segera event-driven (bukan cron 3 jam) dengan dedupe id.
- **Konsekuensi:** polling BMKG tiap 2 menit oleh server (ringan, JSON kecil); perlu penyimpanan `lastQuakeId` di `server/data/`.

### ADR-18 — Vulkanik: parser halaman publik MAGMA + fallback persisten
- **Konteks:** API MAGMA butuh kredensial (401/403); halaman tingkat aktivitas publik dan terstruktur per seksi Level.
- **Keputusan:** parser HTML tanpa dependensi (regex seksi "Level X (…)" → daftar gunung), fixture tanggal 14 Okt 2026, cache 60 menit, simpan nilai terakhir valid; bila parse gagal → tampilkan nilai terakhir + `degraded` + tautan MAGMA.
- **Konsekuensi:** risiko perubahan markup; ajukan akses API resmi; tidak pernah menampilkan "Normal" secara default saat gagal (default = nilai terakhir diketahui).

### ADR-19 — Data historis & klimatologi disimpan sebagai artefak JSON yang dibangun skrip
- **Konteks:** HTH, FWI spin-up, SPI, dan anomali debit butuh deret historis (ERA5 90 hari; GloFAS 1984–kini). Mengunduh ulang tiap start boros kuota.
- **Keputusan:** skrip `scripts/build-*.mjs` membangun artefak (`server/data/*-clim.json`, versi & tanggal di dalam file) → dijalankan manual/cron bulanan; server hanya membaca. Deret harian 90 hari diperbarui inkremental (1 call/lokasi/hari).
- **Konsekuensi:** `server/data/` tetap gitignored; artefak klimatologi (kecil, stabil) **boleh** dikomit di `src/data/clim/` agar deploy baru tidak kosong.

### ADR-20 — Laporan eksternal (PetaBencana) sebagai konteks, bukan masukan skor
- **Keputusan:** umpan PetaBencana ditampilkan terpisah dengan atribusi CC BY-NC; tidak memodifikasi level hazard (berbeda dengan laporan F8 internal yang bisa menaikkan 1 level asap). Alasan: lisensi non-komersial & kendali kualitas.

### ADR-21 — Indeks konvektif multi-model dengan transparansi ketidaksepakatan
- **Konteks:** CAPE ECMWF 2.090 vs GFS 310 J/kg pada jam yang sama (14 Okt 2026) — perbedaan 7×.
- **Keputusan:** modul konvektif menerima array per model, menghitung level per model, lalu `level = max`, `agreement = (level sama)`; UI wajib menampilkan indikator per model saat `agreement=false`. Nowcast BMKG mengunci level minimal "bahaya".
- **Konsekuensi:** satu call GFS tambahan per lokasi (cache 30 menit); dokumentasi ambang per model.

### ADR-22 — Satu skema `Alert` bergaya CAP untuk semua kanal; produk bukan otoritas peringatan
- **Konteks:** pesan saat ini dirakit ad-hoc per cron; akan ada 10 hazard × 4 kanal.
- **Keputusan:** registry → `Alert` (field CAP 1.2: urgency/severity/certainty/headline/instruction/area/references) → renderer kanal. `sender` selalu "Niu Gayo Agro-Climate (informasi pendukung)"; `references.official` wajib terisi bila ada peringatan resmi. Tidak menerbitkan CAP XML publik.
- **Konsekuensi:** test template; state dedupe; kemudahan migrasi bila BPBD ingin menerbitkan CAP resmi dari data yang sama.
- **Catatan implementasi (Sprint 3):** `GET /api/alerts/feed?format=cap&id=` menghasilkan CAP 1.2 XML **per peringatan untuk ekspor/interoperabilitas** (uji BPBD, bukan feed publik yang dipromosikan atau didaftarkan ke agregator); `senderName` + parameter `disclaimer` menegaskan bukan peringatan resmi, dan `info.official[]` memuat peringatan BMKG aktif (judul + URL CAP BMKG) — memenuhi butir "`references.official` wajib". Perubahan field: `references` dipakai untuk peringatan NGA sebelumnya (rantai Update/Cancel), `official` untuk otoritas.

### ADR-23 — Web Push sebagai dependensi opsional server
- **Keputusan:** server tetap berjalan tanpa `web-push`; bila paket tersedia & VAPID diset, endpoint `/api/push/subscribe` aktif. Menjaga prinsip "tanpa dependensi wajib".

### ADR-24 — Peta dua tahap: SVG skematik (tanpa tile) dahulu, Leaflet lazy-load kemudian
- **Konteks:** bundle 85 kB gzip; HP kelas menengah; sinyal buruk; MapLibre ≈ 200–250 kB & WebGL; kebijakan tile OSM ketat.
- **Keputusan:** komponen `SchematicMap.jsx` (SVG, proyeksi equirectangular, batas kecamatan GADM tersederhana ≤ 50 kB dikomit di `src/data/geo/`), marker level per sentra, hotspot, panah angin, radius Burni Telong. Fase 4: `import()` dinamis Leaflet (~40 kB) hanya saat pengguna membuka "peta detail" & online.
- **Konsekuensi:** nol dependensi baru di Fase 1; peta offline penuh; detail jalan/sungai menunggu Fase 4.

### ADR-25 — Strategi pengujian & anggaran kinerja di CI
- **Keputusan:** test kontrak registry; fixture per sumber eksternal; test template pesan; smoke test Playwright (3 alur); gagal CI bila bundle > 400 kB gzip (tanpa Leaflet) atau test < 100 % lulus. Dataset uji FWI: contoh Van Wagner & Pickett 1985 (hari-1 tereproduksi persis oleh prototipe) + dataset `cffdrs`.
- **Konsekuensi:** tambah `playwright` sebagai devDependency; skrip `scripts/check-bundle.mjs`.

### ADR-26 — Tata kelola data: atribusi, privasi minimal, arsip harian untuk validasi
- **Konteks:** 8+ sumber eksternal dengan lisensi berbeda (CC BY, NC, hak cipta BMKG); UU PDP; kebutuhan *ground truth* untuk KPI.
- **Keputusan:** (1) setiap payload hazard membawa `source {name, url, license, fetchedAt}` dan UI menampilkannya; (2) tidak ada akun/PII; langganan push & laporan disimpan minimal dengan retensi (90 hari push tak aktif; laporan 2 tahun untuk validasi); (3) server menulis **arsip harian** ringkas `server/data/hazard-archive/YYYY-MM-DD.json` (nilai & level per sentra) untuk menghitung hit rate/FAR; (4) halaman "Tentang data & batasan".
- **Konsekuensi:** ukuran arsip ≈ 15 sentra × 10 bahaya × 365 ≈ < 5 MB/tahun; skrip `scripts/validate-season.mjs` mencocokkan arsip dengan `disasterHistory.json`.

*(ADR berikutnya: ADR-27.)*

## 4. Dampak ke struktur direktori (target)
```
src/domain/hazards/            server/
  index.js   (registry)          airQuality.js   firms.js
  landslide.js watershed.js      bmkgQuake.js    fwiState.js
  wind.js      airQuality.js     hazards.js (ctx 15 lokasi)
  fireWeather.js hotspots.js     data/fwi-state.json (gitignored)
  quake.js (F2)  convective.js   
  drought.js frost.js volcano.js 
src/data/contacts.js  src/data/geo/kecamatan.json  src/services/hazardService.js
src/components/HazardPanel.jsx  src/components/SchematicMap.jsx
docs/dev/prototypes/{ispu,fwi,check}.mjs  (prototipe tervalidasi → dipindah ke src/domain/hazards di Fase 1)
```

## 5. Status implementasi (Sprint 4 — 15 Okt 2026, v2.0.0)
Struktur nyata (menggantikan target §4; nama berbeda dari rencana dicatat):
```
src/domain/hazards/                      server/
  index.js        registry 11 modul +      hazards.js       ctx 15 sentra + arsip harian + interaksi
                  evaluateAll + interaksi  alerts.js        siklus CAP → Telegram (anti-bising)
  interactions.js 5 aturan silang          airQuality.js    CAMS (TTL 60')     firms.js      FIRMS (TTL 30')
  levels.js       skala seragam            fireWeather.js   FWI ops + state    archive.js    ERA5 90 hari
  features.js     fitur cuaca + thermal    bmkgQuake.js     TEWS 3 feed (TTL 2')  magma.js   MAGMA (TTL 60')
  landslide.js watershed.js (v2: +GloFAS)  convective.js    ECMWF×GFS (TTL 30')  flood.js   GloFAS 4 sel (TTL 6 j)
  wind.js convective.js airQuality.js      petabencana.js   laporan eksternal (TTL 10')  spi.js  SPI Thom gamma
  fireWeather.js drought.js (+SPI/VPD)     clim/flood-clim.json  clim/spi-baseline.json  (artefak skrip, ADR-19)
  quake.js volcano.js temperature.js       data/ (gitignored): archive-*, fwi-state, alert-state, hazard-archive/, reports
  rust.js hotspots.js ispu.js              agroclimate-alerts.{service,timer} (30') + -fast (5', --only gempa,vulkanik)
src/domain/{alert,share,climate,geo,seasonal,thresholds}.js
src/components/{HazardPanel,HazardFocusCards,SchematicMap,ClimateBanner,SeasonalBanner,ShareButton,AboutData,
                DisasterHistoryCard,EmergencyContacts,ReportButton,FireDangerCard,DroughtCard,AirQualityCard}.jsx
scripts/{alerts-cron,smoke,validate-season,check-bundle,build-flood-clim,build-spi-baseline,fetch-hazard-fixtures}.mjs
```
| Rencana | Realisasi | Catatan |
|---|---|---|
| `hazardService.js` klien terpisah | ctx klien dirakit di `weatherService.js` (`allSettled`), evaluasi di `HazardPanel` | file terpisah tidak diperlukan; kontrak sama |
| `server/fwiState.js` | digabung ke `server/fireWeather.js` (`server/data/fwi-state.json`) | — |
| `frost.js` | `temperature.js` (`suhu`: dingin/embun upas **dan** panas/VPD saat berbunga) | satu modul dua arah |
| `hotspots.js` sebagai modul hazard | fitur di dalam `kebakaran` (FWI × hotspot × HTH) | menghindari dua kartu untuk satu bahaya |
| `CompoundBanner` | `interactions[]` ditampilkan di `HazardPanel` + `flags.bumpedBy` pada kartu | ADR-16 tetap |
| `quota.json` | belum perlu (semua upstream tanpa kuota keras kecuali FIRMS) | — |
| Web Push (ADR-23) | ditunda (H-9 VAPID) — lihat `10-ROADMAP-V3.md` V3-2 | — |
| Leaflet lazy-load (ADR-24 tahap 2) | ditunda — SVG skematik mencukupi; bundel gzip ≈ 132 kB | V3-6 |
| ADR-21 konvektif multi-model | ECMWF IFS 0,25° (CAPE, kode cuaca, hembusan) + GFS (CAPE, LI, CIN); level = sinyal terkuat, `agreement` flag | §9 di 06 |
| ADR-25 CI | `.github/workflows/ci.yml`: test → build → check:bundle → smoke (server nyata, upstream degraded ditoleransi) | — |
| ADR-26 arsip | `server/data/hazard-archive/YYYY-MM-DD.json` (1 snapshot/sentra/jam) + `validate-season.mjs` + `docs/VALIDATION.md` | — |

*(ADR berikutnya tetap ADR-27.)*
