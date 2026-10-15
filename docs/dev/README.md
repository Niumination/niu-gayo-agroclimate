# docs/dev — Paket Perencanaan Perluasan Multi-Bahaya

Hasil **10 iterasi riset → pembaruan dokumen** (14 Okt 2026) untuk memperluas Niu Gayo Agroclimate dari 3 bahaya hidrometeorologi (longsor, luapan DAS, angin) menjadi sistem informasi **multi-bahaya** untuk Aceh Tengah & sekitarnya, dengan prioritas **kabut asap karhutla** yang sedang berlangsung.

| # | Dokumen | Isi | Pembaca utama |
|---|---|---|---|
| 00 | [`00-REPO-AUDIT.md`](00-REPO-AUDIT.md) | Kondisi repo saat ini: arsitektur, fitur F1–F8, model risiko, utang teknis T1–T12, tabel celah multi-bahaya | Pengembang |
| 01 | [`01-RESEARCH-LOG.md`](01-RESEARCH-LOG.md) | **Log 10 iterasi riset** (pertanyaan → temuan + sumber → keputusan), termasuk endpoint yang diuji langsung & ringkasan keputusan kunci | Semua |
| 02 | [`02-PRD-MULTI-HAZARD.md`](02-PRD-MULTI-HAZARD.md) | **PRD**: visi, persona, taksonomi 11 bahaya, kebutuhan fungsional per bahaya (FR-ASAP, FR-API, FR-GEMPA, FR-VULK, FR-KERING, FR-SUHU, FR-BANJIR, FR-KONV, FR-X lintas-bahaya, FR-DIS diseminasi), NFR, pertanyaan terbuka, rencana rilis | Produk, pengembang, mitra |
| 03 | [`03-ROADMAP.md`](03-ROADMAP.md) | **Roadmap** 4 fase (Okt 2026 – Apr 2027): Fase 1 Asap & Kebakaran (musim ini), Fase 2 Geologi & Konvektif, Fase 3 Iklim & Banjir, Fase 4 Peta, sensor & kemitraan; dependensi, kriteria selesai, risiko per fase | Produk, pengembang |
| 04 | [`04-DATA-SOURCES.md`](04-DATA-SOURCES.md) | Katalog sumber data per bahaya: URL/parameter, status uji langsung, TTL cache, lisensi, fallback | Pengembang |
| 05 | [`05-ARCHITECTURE.md`](05-ARCHITECTURE.md) | Integrasi ke arsitektur eksisting: registry hazard, `/api/hazards`, modul server per sumber, Alert bergaya CAP, peta SVG; **ADR-12 … ADR-26** | Pengembang |
| 06 | [`06-THRESHOLDS-MULTI-HAZARD.md`](06-THRESHOLDS-MULTI-HAZARD.md) | Ambang & rumus per bahaya (ISPU P.14/2020, FWI/FDRS, gempa, vulkanik, HTH/SPI, suhu, GloFAS, konvektif, kriteria BMKG KEP.009/2010) + tabel anjuran kesehatan final | Pengembang, pakar domain |
| 07 | [`07-RISK-REGISTER.md`](07-RISK-REGISTER.md) | Register risiko produk/data/teknis/organisasi dengan skor & mitigasi | Produk, maintainer |
| 08 | [`08-STAKEHOLDERS-GOVERNANCE.md`](08-STAKEHOLDERS-GOVERNANCE.md) | Peta pemangku kepentingan, alur laporan, kerangka hukum, lisensi & atribusi, privasi, **KPI & rencana validasi** | Produk, mitra (BPBD, Dinkes, BMKG) |
| 09 | [`09-DATA-PREP.md`](09-DATA-PREP.md) | **Status penyiapan sumber data & aset**: fixture nyata 13 sumber, dataset uji FWI resmi, GeoJSON kecamatan, tabel anjuran kesehatan, konteks iklim, riwayat tambahan, kontak, `.env.example`; daftar tugas manusia (FIRMS key, verifikasi koordinat/kontak, Gayo) | Pengembang, maintainer |
| — | [`prototypes/`](prototypes/) | Prototipe fungsi murni tervalidasi: `ispu.mjs` (Permen LHK P.14/2020), `fwi.mjs` (Van Wagner 1987, opsi ekuator, konstanta FFMC dapat dipilih), `check.mjs`, `check-cffdrs.mjs` (vs dataset resmi 48 hari, selisih ≤ 0,005). **Sprint 1 (15 Okt 2026): sudah dipindahkan ke produksi** `src/domain/hazards/{ispu,fireWeather,airQuality}.js` + `server/airQuality.js` + `AirQualityCard.jsx` (test `tests/{ispu,fireWeather,airQuality,airQualityServer}.test.js`); prototipe dipertahankan sebagai referensi | Pengembang |

## Urutan baca yang disarankan
1. `00` (kondisi awal) → 2. `01` bagian "Ringkasan 10 Iterasi" → 3. `02` PRD → 4. `03` Roadmap → 5. `04`–`06` + `09` saat implementasi → 6. `07`–`08` sebelum menghubungi mitra.

## Aset siap pakai di repo (lihat `09`)
`tests/fixtures/hazards/` (13 respons nyata + dataset uji FWI) · `scripts/fetch-hazard-fixtures.mjs` · `src/data/geo/kecamatan.json` · `src/data/hazards/{healthAdvice,climateOutlook,disasterHistory.additions,sentraKecamatan}.json` + `contacts.hazards.js` · `.env.example` · `tests/hazardData.test.js`.

**Status Sprint 3 (15 Okt 2026):** semua aset di atas sudah dipakai produksi — `healthAdvice` (kartu udara & registry), `climateOutlook` (`ClimateBanner`), `disasterHistory.additions` (sudah **digabung** ke `src/data/disasterHistory.json`, file tambahan dipertahankan sebagai sumber), `sentraKecamatan` (kontak & peta), `kecamatan.json` (`SchematicMap`), kontak dipindah ke **`src/data/contacts.js`** (`contacts.hazards.js` tinggal shim, hapus pada v2.1). Ringkasan kemajuan per item: `03-ROADMAP.md` (Fase 0 ✅; Fase 1 tersisa 1.9 faskes, 1.10b arsip harian, rilis 2.0.0).

## Bahaya yang dicakup (ID → prioritas)
H-ASAP kabut asap/kualitas udara (P0) · H-API kebakaran hutan & lahan (P0) · H-LONGSOR (ada) · H-BANJIR+ luapan & banjir bandang (P1) · H-ANGIN+ (ada, diperluas) · H-PETIR/konvektif incl. hujan es & puting beliung (P1) · H-VULKANIK Burni Telong (P1) · H-GEMPA Sesar Sumatra (P1) · H-KERING kekeringan/HTH (P2) · H-SUHU stres dingin/embun upas & panas (P2) · H-KESEHATAN anjuran asap (lintas, P0).

## Prinsip tidak-boleh-dilanggar (dari riset)
- Produk adalah **informasi pendukung** yang mengutip BMKG/PVMBG/BPBD/Kemenkes — bukan otoritas peringatan dini.
- Nilai dari model (CAMS, GloFAS, FWI) selalu berlabel **estimasi** + sumber + waktu data.
- Tidak pernah menampilkan "aman" eksplisit saat data parsial; pola *degraded* dipertahankan.
- Nol dependensi baru di server; klien tetap ringan (bundle ≤ 400 kB gzip; peta SVG dahulu).
- Semua ambang terpusat di `src/domain/thresholds.js` + `docs/THRESHOLDS.md` + test.
