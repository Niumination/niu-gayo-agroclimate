# Penyiapan Sumber Data & Aset — Status per 14 Okt 2026

> Melengkapi `04-DATA-SOURCES.md`. Membedakan **"sudah disiapkan di repo"** (bisa langsung dipakai pengembang) dari **"harus dilakukan manusia"** (kredensial, verifikasi lapangan, bahasa).

## 1. Aset yang sudah disiapkan (tersedia di repo)

| Aset | Lokasi | Isi | Validasi |
|---|---|---|---|
| **Fixture respons nyata** (13 sumber) | `tests/fixtures/hazards/*` + `MANIFEST.json` | CAMS AQ Takengon (PM2,5 20,2 · AOD 1,16), `best_match` visibility/CAPE/DNI, GFS `cape`/`lifted_index`/CIN/freezing level (LI min −4,5), ECMWF konvektif (CAPE maks 2.250, kode 51–81), Archive 91 hari, GloFAS 4 sel Peusangan, BMKG autogempa/dirasakan/terkini, USGS 67 kejadian, MAGMA HTML (Bur Ni Telong Level II), PetaBencana Aceh 7 hari (5 laporan), BMKG nowcast CAP RSS | Diunduh & divalidasi JSON oleh `scripts/fetch-hazard-fixtures.mjs`; test `tests/hazardData.test.js` |
| Skrip pembaru fixture | `scripts/fetch-hazard-fixtures.mjs` | Tanpa dependensi; unduh ulang semua; FIRMS ikut bila `FIRMS_MAP_KEY` di-set | Dijalankan 14 Okt 2026, 13/13 ✅ |
| **Dataset uji FWI resmi** | `tests/fixtures/hazards/fwi-cffdrs-test_fwi-expected.csv` | 48 hari Van Wagner & Pickett 1985 + hasil harapan paket R `cffdrs` (FFMC, DMC, DC, ISI, BUI, FWI, DSR) | `node docs/dev/prototypes/check-cffdrs.mjs` → **selisih maks 0,005** pada 6 indeks (konstanta cffdrs 147,27723); 0,25 bila memakai konstanta asli 147,2 |
| Prototipe FWI & ISPU | `docs/dev/prototypes/{fwi,ispu,check,check-cffdrs}.mjs` | Siap dipindah ke `src/domain/hazards/`; konstanta FFMC dapat dipilih (`setFfmcConstant`) | `check.mjs` lulus; `check-cffdrs.mjs` lulus |
| **Batas kecamatan GeoJSON** | `src/data/geo/kecamatan.json` (21 kB; 5,6 kB gzip) | GADM 4.1 level 3: 14 kecamatan Aceh Tengah + poligon Danau Lut Tawar (`kind: lake`) + 7 kecamatan Bener Meriah; disederhanakan mapshaper 60 %, presisi 1e-4; properti `{id, name, kab, kind, gid}` | Dirender & diperiksa visual; test batas koordinat & ukuran ≤ 50 kB |
| Pemetaan sentra → kecamatan | `src/data/hazards/sentraKecamatan.json` | Point-in-polygon 15 sentra; flag `ok=false` + centroid GADM sebagai kandidat koreksi | Lihat §3 temuan koordinat |
| **Tabel anjuran kesehatan** | `src/data/hazards/healthAdvice.json` | 5 kategori ISPU × 4 kelompok, kebijakan sekolah 101/201/300, catatan WHO, checklist ruang bersih, aturan penjemuran kopi; field `gay` kosong | Test struktur |
| Konteks iklim musiman | `src/data/hazards/climateOutlook.json` | El Niño sangat kuat (+3,44 dasarian; JAS +2,70), IOD +0,935, kemarau diperpanjang; `validUntil` 2026-11-10 | Test struktur; **perlu pembaruan tiap dasarian** |
| Riwayat kejadian tambahan | `src/data/hazards/disasterHistory.additions.json` | 3 karhutla 2026 (Ketol, Celala, Wih Pesam), status tanggap darurat banjir Des 2025, Burni Telong Level III→II (3 Jan 2026), gempa Gayo 2013 M6,1; skema `hazard`, `emergencyStatus`, `areaHa`, `volcanoLevel`, `magnitude` | Test skema & lokasi; **belum digabung** ke file utama (langkah di `_meta.mergeSteps`) |
| Kerangka kontak | `src/data/hazards/contacts.hazards.js` | Kontak nasional/kabupaten terverifikasi (BPBD 112/(0643) 21113, 112, BMKG 196, Halo Kemenkes 1500567) + slot Puskesmas/posko per kecamatan (kosong) + `contactsFor()` yang hanya menampilkan entri terverifikasi | Test |
| Contoh FIRMS **sintetis** | `tests/fixtures/hazards/firms-viirs-sample-SYNTHETIC.csv` | Header resmi Area API (14 kolom) + 4 baris rekaan untuk test parser — **bukan data nyata** | — |
| Template env | `.env.example` | Semua variabel lama + baru (`FIRMS_MAP_KEY`, TTL per sumber, VAPID, `SENSOR_TOKENS`, `HAZARD_ARCHIVE_DIR`) | — |

Hasil `npm test`: **98 lulus** (91 lama + 7 test aset baru). Tidak ada kode produksi yang berubah; file baru belum di-*import* oleh aplikasi.

## 2. Yang harus dilakukan manusia (tidak bisa disiapkan dari sandbox)

| # | Tugas | Siapa | Kapan | Catatan |
|---|---|---|---|---|
| H-1 | **Daftar FIRMS MAP_KEY** (gratis, email) → isi `FIRMS_MAP_KEY` di env server; jalankan `node scripts/fetch-hazard-fixtures.mjs` untuk fixture hotspot nyata | Maintainer | **Sekarang** — modul hotspot sudah terpasang (Sprint 2) dan berjalan *degraded* | Tanpa ini: FWI/HTH tetap jalan, blok hotspot di kartu "Bahaya Kebakaran" menampilkan catatan "kunci belum diatur"; verifikasi setelah diisi: `curl -s 'http://127.0.0.1:7455/api/hotspots?location=takengon' \| head -c 400` harus `"degraded":false` |
| H-2 | **Verifikasi 4 koordinat sentra** yang jatuh di luar kecamatan nominal (§3) → perbarui `src/data/locations.js` | Maintainer + warga lokal | Sebelum peta & radius FIRMS | Pakai lokasi kampung/ibu kota kecamatan, bukan centroid |
| H-3 | **Isi & verifikasi nomor Puskesmas/posko per kecamatan** dan IGD RSUD Datu Beru, Damkar, Manggala Agni, Pos PGA | Maintainer (telepon/situs Dinkes) | Fase 1 (kartu asap) | UI sudah dirancang hanya menampilkan `verified: true` |
| H-4 | **Terjemahan Gayo** untuk `healthAdvice.json`, `climateOutlook.json` (`gay: null`) | Penutur asli | Sebelum rilis Fase 1 | R-06 di risk register |
| H-5 | Gabungkan `disasterHistory.additions.json` ke file utama + perluas assert `type` di `tests/seasonal.test.js` + ikon/filter UI | Pengembang | Fase 1 item 1.9d | — |
| H-6 | `npx web-push generate-vapid-keys` → env | Maintainer | Fase 2 | Opsional |
| H-7 | Perbarui `climateOutlook.json` tiap dasarian dari rilis BMKG | Maintainer | Rutin | Banner menampilkan "perlu pembaruan" bila `validUntil` lewat |
| H-8 | Surat pengantar/kemitraan ke BPBD Aceh Tengah (+ Staklim Aceh untuk SPBK, Q1) | Pemilik produk | Sebelum Fase 2 | `08-STAKEHOLDERS-GOVERNANCE.md` |
| H-9 | Konfirmasi batas atas segmen ISPU > 300 (asumsi titik 500) terhadap lampiran Permen LHK P.14/2020 | Pengembang | Fase 1 | Catatan di `ispu.mjs` |

## 3. Temuan saat penyiapan (perlu tindak lanjut)

1. **Koordinat sentra di `locations.js` berpresisi 2 desimal dan 4 di antaranya jatuh di luar kecamatan nominal** (point-in-polygon terhadap GADM):
   - `jagongjeget` (4,38 · 96,80) → jatuh di **Linge**; centroid Jagong Jeget ≈ 4,381 · 96,732
   - `bies` (4,59 · 96,78) → jatuh di **Pegasing**; centroid Bies ≈ 4,612 · 96,791
   - `ketol` (4,75 · 96,75) → jatuh di **Timang Gajah (Bener Meriah)**; centroid Ketol ≈ 4,822 · 96,611
   - `rusipantara` (4,40 · 96,55) → **di luar semua poligon** (di luar kabupaten); centroid Rusip Antara ≈ 4,717 · 96,476
   Dampak: kecil untuk model 0,25°, tetapi **signifikan** untuk radius hotspot FIRMS 10 km, sel GloFAS 5 km, jarak ke Burni Telong, dan penempatan marker di peta. Dicatat sebagai utang teknis **T13** di `00-REPO-AUDIT.md`.
2. GADM Bener Meriah masih 7 kecamatan (belum ada Bener Kelipah, Gajah Putih, Mesidah) — cukup untuk peta skematik; ganti dengan batas BIG bila butuh akurasi administratif.
3. Fixture `best_match` menunjukkan **jarak pandang minimum 120 m** pada jam dini hari (kabut radiasi lembah) → ambang jarak pandang asap harus **dibatasi pada jam siang** dan dikombinasikan dengan PM2,5/AOD agar kabut pagi tidak terbaca sebagai asap (tambahan untuk `06-THRESHOLDS` §2.3). *Implementasi Sprint 1:* jendela **10–17 WIB** + penyaring RH ≥ 90 % + persistensi 2 jam (`src/domain/hazards/airQuality.js#assessHaze`); fixture berikutnya menyertakan `relative_humidity_2m` (skrip sudah diperbarui).
4. Konstanta FFMC: gunakan **147,27723** (cffdrs/Wang et al. 2015) sebagai default produksi karena menyamai dataset uji resmi hingga 0,005; dokumentasikan di `docs/THRESHOLDS.md`.

## 4. Perintah cepat

```bash
node scripts/fetch-hazard-fixtures.mjs        # perbarui fixture (FIRMS bila FIRMS_MAP_KEY di-set)
node docs/dev/prototypes/check.mjs            # uji ISPU + FWI contoh
node docs/dev/prototypes/check-cffdrs.mjs     # uji FWI vs dataset resmi 48 hari
npm test                                      # 98 test termasuk aset data
```
