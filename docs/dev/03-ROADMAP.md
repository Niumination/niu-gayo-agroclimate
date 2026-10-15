# Roadmap Pengembangan Multi-Hazard — Niu Gayo Agro-Climate

Versi 1.0 (final — 10 iterasi riset) · 2026-10-14 · Horizon: 6 bulan (Okt 2026 – Apr 2027)
Prinsip urutan: **(1) kebutuhan nyata hari ini (asap) → (2) fondasi arsitektur → (3) bahaya berdampak tinggi (gempa/banjir) → (4) bahaya musiman (kekeringan/embun beku) → (5) kualitas & kemitraan.**

```
Okt 2026        Nov 2026        Des 2026        Jan 2027        Feb 2027        Mar–Apr 2027
|-- Fase 0 --|------ Fase 1 ------|------ Fase 2 ------|------ Fase 3 ------|--- Fase 4 ---|
 Persiapan     Asap + Kebakaran     Gempa, Petir,        Kekeringan, Suhu,    Peta, validasi,
 & registry    (v2.0)               Banjir+, Angin+      Vulkanik (v2.2)      kemitraan (v2.3)
                                    + Vulkanik (v2.1)
```

---

## Fase 0 — Persiapan & Fondasi (minggu 1–2, Okt 2026)
**Tujuan:** baseline bersih + hazard registry tanpa perubahan perilaku.

| # | Pekerjaan | Keluaran | Estimasi |
|---|---|---|---|
| 0.1 | Tag `v1.2.0`, samakan `package.json` | Rilis baseline | 0,5 h |
| 0.2 ✅ | Derivasi `VALID_LOCATIONS` dari `LOCATIONS`; `data/contacts.js`; perbaiki typo `KECEMATAN_MAP` — **selesai Sprint 3** (`src/data/contacts.js` + `contactsFor()`) | Refactor kecil, test hijau | 2 h |
| 0.3 ✅ | **Hazard registry** `src/domain/hazards/{index,levels,features,landslide,watershed,wind,rust,airQuality,fireWeather,drought}.js` + adaptor `weatherService` (`hazards`, `hazardsAll`) — **selesai Sprint 3** | ADR-12 | 1 hari |
| 0.4 ✅ | `HazardPanel` merender daftar dari registry (urut level, akordeon detail/anjuran/sumber, tombol Bagikan & Tentang data) — **selesai Sprint 3**; `DisasterWarning` lama tetap sebagai ringkasan | UI generik | 1 hari |
| 0.5 ✅ | Feature flag `HAZARDS_ENABLED` (server) + `VITE_HAZARDS_ENABLED`/`src/lib/prefs.js` (klien) — **selesai Sprint 3** | ADR-13 | 2 h |
| 0.6 | Dokumen dev ini masuk repo (`docs/dev/`), tautkan dari README | Dokumentasi | 1 h |

**Gate G0:** semua test lama hijau; UI identik secara fungsi; CHANGELOG 1.3.0-dev.

## Fase 1 — v2.0 "Asap & Kebakaran" (minggu 3–6, Okt–Nov 2026)
**Tujuan:** respons terhadap episode asap aktif; fondasi karhutla untuk musim kering 2027.

| # | Pekerjaan | Keluaran | Dependensi |
|---|---|---|---|
| 1.1 ✅ | `server/airQuality.js` (Open-Meteo AQ, CAMS global) + `GET /api/air-quality` (+ `?location=all`) — **selesai Sprint 1 (15 Okt 2026)** | FR-ASAP-1 | — |
| 1.2 ✅ | `domain/hazards/airQuality.js`: ISPU P.14/2020, kategori, rata-rata bergerak 24 jam, anjuran 4 kelompok — **selesai Sprint 1** | FR-ASAP-2/4 | 1.1 |
| 1.3 ✅ | Fetch `visibility` (best_match) → proksi kabut (jendela 10–17 WIB, saring RH ≥ 90 %, persistensi 2 jam); gabung ke kartu — **selesai Sprint 1** | FR-ASAP-3 | 1.1 |
| 1.4 ◐ | `server/firms.js` (FIRMS Area API CSV → JSON, 4 sumber NRT) + `GET /api/hotspots` + haversine ke sentra — **kode selesai Sprint 2**; berjalan *degraded* sampai `FIRMS_MAP_KEY` diisi (H-1) | FR-API-1/2 | MAP_KEY |
| 1.5 ✅ | `domain/hazards/fireWeather.js`: FWI System + kelas FDRS (Sprint 1) + `server/fireWeather.js` state harian, pengamatan 12.00 WIB, spin-up ERA5 90 hari, proyeksi D+1–2, `GET /api/fire-danger` — **selesai Sprint 2** | FR-API-3 | — |
| 1.6 ✅ | Kartu "Kabut Asap & Udara" (Sprint 1) + kartu "Bahaya Kebakaran" `FireDangerCard.jsx` (FWI/FDRS, siaga lokal, hotspot, HTH, proyeksi) — **selesai Sprint 2** | FR-ASAP-3, FR-API-4/5 | 1.2–1.5 |
| 1.6b ✅ | `SchematicMap.jsx` SVG (batas kecamatan GADM, 15 sentra berwarna level tertinggi, hotspot, radius 3 km Burni Telong, klik → pilih sentra) — **selesai Sprint 3**; lapisan angin & Leaflet lazy-load (ADR-24 tahap 2) menyusul | FR-API-6 | 1.4 |
| 1.5b ✅ | Pindahkan prototipe `docs/dev/prototypes/{ispu,fwi}.mjs` → `src/domain/hazards/` + test dari `check.mjs` + dataset `cffdrs` — **selesai Sprint 1** (`tests/ispu.test.js`, `tests/fireWeather.test.js`; prototipe tetap ada sebagai referensi) | FR-ASAP-2, FR-API-3 | — |
| 1.7 ✅ | Laporan warga: tipe `asap` (skala jarak pandang + bau) & `kebakaran` (api aktif) — **selesai Sprint 2** | FR-ASAP-6 | 0.2 |
| 1.8 ✅ | `/api/hazards` (per sentra & `all`), `/api/alerts/feed`, `POST /api/alerts/run` + `scripts/alerts-cron.mjs` + unit systemd `agroclimate-alerts.{service,timer}` (30 menit) → Telegram — **selesai Sprint 3** (aktif setelah `TELEGRAM_*` + `ALERTS_CRON_TOKEN` diisi, tugas H-7) | FR-ASAP-7/8 | 1.2 |
| 1.8b ✅ | Skema `Alert` CAP 1.2 (`src/domain/alert.js`) + renderer Telegram/WhatsApp-teks/SMS/CAP XML + anti-kebisingan (jeda 6 h, grup ≥ 3, maks 12/siklus, `PUSH_POLICY`) + `ShareButton` WhatsApp/SMS/salin — **selesai Sprint 3** | FR-DIS-1/2/3/6, FR-X-7 | 1.2 |
| 1.9 ◐ | Integrasi dampak asap ke `dryingStatus` kopi (**selesai Sprint 2**: status "Tunda (asap)") + konten "Ruang bersih" (Sprint 1) · faskes per kecamatan (Sprint 3) | FR-ASAP-5/9 | 1.2 |
| 1.9b ✅ | `server/archive.js` (Open-Meteo Archive 90 hari + celah ECMWF) + `hthDays()` kelas BMKG + neraca air + `GET /api/drought` + kartu `DroughtCard.jsx` — **selesai Sprint 2** | FR-KER-1/2/3/4 | — |
| 1.9c ✅ | Banner konteks iklim `ClimateBanner.jsx` (`climateOutlook.json` + verifikasi lokal dari `/api/drought`; peringatan bila `validUntil` lewat) — **selesai Sprint 3** | FR-KER-5 | — |
| 1.9d ✅ | Riwayat diperluas (12 kejadian 2013–2026, `GET /api/disaster-history?location=&hazard=`, `DisasterHistoryCard`) + modal "Tentang data & batasan" (`AboutData.jsx`: sumber & lisensi, estimasi vs pengukuran, batasan, privasi) + `EmergencyContacts` — **selesai Sprint 3** | FR-X-8/9, FR-X-4 | — |
| 1.10b ✅ | Arsip harian hazard (Sprint 3) · `scripts/validate-season.mjs` (POD/FAR/rasio aktif dari arsip + laporan warga/kejadian terkurasi, `npm run validate:season`) + `docs/VALIDATION.md` + draf surat pengantar `docs/templates/surat-pengantar-BPBD.md` — **selesai Sprint 4** (pengiriman surat = tugas manusia H-8) | FR-X-10, ADR-26 | 1.8 |
| 1.10 ✅ | Dokumen: THRESHOLDS §1–21 (ISPU, FWI, visibility, FWI ops, hotspot, HTH, level seragam & CAP, gempa, vulkanik, konvektif, banjir+, interaksi, SPI/VPD, suhu), CHANGELOG 2.0.0 — **selesai Sprint 4**; tag git `v2.0.0` = tugas H-6 | — | — |

**Gate G1:** episode asap berikutnya tampil di dashboard dalam ≤ 30 menit; cron berjalan; ≥ 25 test baru.
**Rilis cepat (hotfix opsional, minggu 3):** kartu ISPU + jarak pandang saja (1.1–1.3) agar warga segera terbantu. → **Dikerjakan di Sprint 1 (15 Okt 2026): 1.5b, 1.1, 1.2, 1.3 + kartu; +46 test (144 total).**
**Sprint 2 (15 Okt 2026, selesai):** 1.5 server FWI + arsip 90 hari, 1.9b HTH/neraca air + kartu, 1.4 FIRMS (kode siap; degraded sampai MAP_KEY H-1), 1.6 kartu "Bahaya Kebakaran", 1.7 laporan asap/kebakaran, 1.9 `dryingStatus` × asap; +54 test (**198 total**). Gate G1 "≥ 25 test baru" terpenuhi; "cron berjalan" & "episode ≤ 30 menit" menunggu Sprint 3.
**Sprint 3 (15 Okt 2026, selesai):** 0.2–0.5 hazard registry + `HazardPanel` + flag; 1.8b `Alert` CAP + renderer + anti-kebisingan + `ShareButton`; 1.8 `/api/hazards`, `/api/alerts/{feed,run}`, `/healthz` per sumber, cron systemd → Telegram; 1.9c banner iklim; 1.9d riwayat 12 kejadian + "Tentang data & batasan" + kontak darurat; 1.7 laporan `kekeringan`/`badai`; 1.6b peta skematik SVG; `scripts/check-bundle.mjs`; +38 test (**236 total**). **Gate G1:** "≥ 25 test baru" ✅, "cron berjalan" ✅ secara kode (`timer` 30 menit; aktivasi produksi = tugas H-7 isi `TELEGRAM_*` + `ALERTS_CRON_TOKEN`), "episode asap ≤ 30 menit" ✅ secara desain (TTL AQ 60 menit → turunkan `AQ_TTL_MIN=20` bila episode berlangsung).
**Sprint 4 (15 Okt 2026, selesai):** seluruh butir yang tidak memerlukan masukan manusia — 1.10b `validate-season.mjs` + `docs/VALIDATION.md` + draf surat BPBD, 1.10 dokumen, **Fase 2 lengkap** (2.1–2.5), **Fase 3 lengkap** (3.1, 3.2, 3.4), **Fase 4.2/4.4/4.5** (dokumen validasi, CI bundle + smoke, roadmap v3); +49 test (**285 total**). Ditunda dengan alasan: ADR-24 tahap 2 Leaflet lazy-load & lapisan angin (anggaran bundel; peta SVG sudah memenuhi FR-API-6), 2.6 Web Push (butuh VAPID key — H-9; `/api/alerts/feed` sudah ada), 1.9 faskes (H-5). Tag `v2.0.0` = H-6.

## Fase 2 — v2.1 "Gempa, Vulkanik, Konvektif, Banjir+" (Des 2026)
| # | Pekerjaan | Keluaran |
|---|---|---|
| 2.1 ✅ | `server/bmkgQuake.js` (gempadirasakan + autogempa + gempaterkini, radius 300 km, cache 2 menit) + modul `gempa` (MMI indikatif IPE, level 24/72 jam) + `QuakeCard` + `/api/quakes` + Alert segera per `eventId` + timer cepat 5 menit (`agroclimate-alerts-fast.*`) — **selesai Sprint 4** (THRESHOLDS §15) | FR-GEMPA-1/2/3/6 |
| 2.2 ✅ | Riwayat USGS 10 tahun (82 kejadian M ≥ 4,5 ≤ 150 km) → `src/data/hazards/quakeHistory.json`; laporan warga `gempa` (lemah/sedang/kuat) — **selesai Sprint 4** | FR-GEMPA-5 |
| 2.2b ✅ | **Vulkanik**: `server/magma.js` parser tingkat aktivitas MAGMA (fixture Bur Ni Telong Level II) + override/last-good + sektor bawah angin + modul `vulkanik` + `VolcanoCard` + laporan `abu`/`gas` — **selesai Sprint 4** (§16) | FR-VULK-1…5 |
| 2.2c ✅ | Gempa × longsor 72 jam → `flags.landslideAfterQuake` + aturan interaksi `gempa_tanah_jenuh` (longsor +1, maks bahaya) — **selesai Sprint 4** | FR-GEMPA-4 |
| 2.3 ✅ | Modul **`badai`** (`src/domain/hazards/convective.js`, `server/convective.js`): konsensus CAPE ECMWF + LI GFS + kode 95–99 + hembusan + BMKG aktif; `agreement`, jam puncak, hujan es kualitatif, puting beliung (≥ 45 km/jam); `StormCard` strip 12 jam — **selesai Sprint 4** (§17) | FR-KONV-1…5 |
| 2.4 ✅ | **Banjir+**: `server/flood.js` (4 sel GloFAS, cache 6 jam, nilai terakhir) + `scripts/build-flood-clim.mjs` → `server/clim/flood-clim.json` (1997–2025) + `dischargeAnomaly()` + Indeks Luapan v2 (`watershed.js`) + `FloodCard` SVG 14 hari — **selesai Sprint 4** (§18) | FR-BJR-1…5 |
| 2.4b ✅ | `server/petabencana.js` + `/api/external-reports` (Aceh → saring 1104/1117/1113 atau ≤ 60 km, CC BY-NC) + `ExternalReportsCard` — **selesai Sprint 4** | FR-BJR-6 |
| 2.5 ✅ | `src/domain/hazards/interactions.js` (5 aturan) di `evaluateAll` → `interactions[]` + daftar di `HazardPanel` — **selesai Sprint 4** (§19) | FR-X-2 |
| 2.6 ◐ | `GET /api/alerts/feed` ✅ (Sprint 3); Web Push opt-in **ditunda** sampai VAPID key tersedia (H-9) — desain di `05-ARCHITECTURE.md` ADR-19 | FR-DIS-4/5 |

**Gate G2:** gempa terasa (BMKG) tampil ≤ 5 menit ✅ (TTL 2 menit + timer 5 menit); tingkat aktivitas Burni Telong tampil & cocok dengan halaman MAGMA ✅ (Level II Waspada, parser + fixture); indeks majemuk ter-test ✅ (`tests/interactions.test.js`).

## Fase 3 — v2.2 "Musim Kering & Suhu" (Jan–Feb 2027)
| # | Pekerjaan | Keluaran |
|---|---|---|
| 3.1 ✅ | **Kekeringan lanjutan**: neraca air 30 hari (Sprint 2) + VPD siang 7 hari (`vpdDaytime`) + SPI-1/3 gamma McKee (`server/spi.js`, baseline ERA5 1991–2020 `server/clim/spi-baseline.json` via `scripts/build-spi-baseline.mjs`) → `/api/drought.spi`, modul `kekeringan` naik level bila SPI ≤ −1/−1,5/−2 — **selesai Sprint 4** (§20) | FR-KER-3/6 |
| 3.2 ✅ | **Suhu ekstrem kopi** modul `suhu` (`temperature.js`: `coldStress`, `heatStress`; `features.thermalSummary`) + `TemperatureCard` — **selesai Sprint 4** (§21) | FR-SUHU-1…3 |
| 3.3 | *(dipindah ke Fase 2.2b — status Waspada aktif)* | — |
| 3.4 ✅ | Kalender musiman diperluas `seasonalInfoExtended` (fase kering, jendela embun upas, penyesuaian ENSO/IOD dari `climateOutlook.json`) → `/api/seasonal` + `SeasonalBanner` — **selesai Sprint 4** | F7+ |

**Gate G3:** 9 hazard aktif di registry ✅ (**11**: longsor, banjir, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat); dokumentasi threshold lengkap ✅ (§1–21).

## Fase 4 — v2.3 "Peta, Validasi, Kemitraan" (Mar–Apr 2027)
| # | Pekerjaan | Keluaran |
|---|---|---|
| 4.1 | Peta detail Leaflet lazy-load (~40 kB) + tile berizin saat online — **ditunda** (peta SVG 1.6b memenuhi kebutuhan; anggaran bundel) | FR-API-7 |
| 4.2 ◐ | Protokol & alat validasi ✅ (`docs/VALIDATION.md`, `scripts/validate-season.mjs`, format kejadian terkurasi `docs/validation/events-template.json`); **laporan validasi** menunggu data musim (≥ 90 hari arsip) & kejadian BPBD (H-8) | Laporan validasi |
| 4.3 | Kemitraan: BPBD Aceh Tengah, Staklim Aceh, Manggala Agni, Dinkes/Puskesmas & DLH (sensor PM2,5 murah → `POST /api/sensors`), Pos PGA Burni Telong, BWS Sumatera I — tugas manusia (draf surat tersedia) | MoU/komitmen |
| 4.4 ✅ | CI: `npm test` + build + `check:bundle` (gzip ≤ 200 kB) + `npm run smoke` (`scripts/smoke.mjs`: server dinyalakan, 15 endpoint + dry-run cron harus 200/JSON) — **selesai Sprint 4**; Playwright/Lighthouse opsional | ADR-25 |
| 4.5 ✅ | `docs/dev/10-ROADMAP-V3.md` (sensor IoT kebun, WN3, API publik, Web Push, Leaflet, kalibrasi lokal) — **selesai Sprint 4** | Dokumen |

---

## Ketergantungan Eksternal & Risiko Jadwal
| Item | Risiko | Mitigasi |
|---|---|---|
| FIRMS MAP_KEY | Rendah (gratis, instan) | Daftar minggu ini |
| Kuota Open-Meteo non-komersial | Rendah (720 call/hari AQ) | Cache 30 menit; pantau di `/healthz` |
| BMKG endpoint berubah | Sedang | Parser dengan fixture + degraded flag |
| Kalibrasi FWI lokal | Sedang (butuh data BMKG) | Tampilkan label "kalibrasi nasional" |
| Pos AWLR BWS Sumatera I tidak tersedia/publik | Sedang | Tetap label "indeks/model"; ajukan akses SIHKA |
| Struktur HTML MAGMA berubah | Sedang | Fixture + degraded + fallback nilai terakhir; ajukan akses API resmi |
| Waktu pengembang (solo) | Tinggi | Fase 1 dipecah: hotfix ISPU dulu |

*(Roadmap diperbarui setiap iterasi riset; lihat `01-RESEARCH-LOG.md` untuk justifikasi perubahan.)*
