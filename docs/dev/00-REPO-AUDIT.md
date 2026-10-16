# Audit Kondisi Repo — `niu-gayo-agroclimate`

**Tanggal audit:** 2026-10-14 (WIB) · **Commit:** `48f1e76` (branch `main`) · **Auditor:** Agent Mode (Arena.ai)
**Tujuan:** memotret kondisi aktual sebelum pengembangan modul *multi-hazard* (karhutla/kabut asap, gempa, kekeringan, dll).

---

## 1. Ringkasan Eksekutif

| Aspek | Status | Catatan |
|---|---|---|
| Build (`npm run build`) | ✅ Lulus | Vite 6, bundle 277 kB JS (85 kB gzip), PWA precache 11 entri |
| Unit test (`npm test`) | ✅ 91/91 lulus | Node native test runner, ~24 detik |
| CI (`.github/workflows/ci.yml`) | ✅ Ada | Node 22, `npm ci` → test → build |
| Lisensi | ✅ MIT | Niumination / Afrizal Munthe |
| Dependensi runtime | ✅ Minimal | `react`, `react-dom`, `lucide-react`; server **tanpa dependensi** (http murni) |
| Dokumentasi | ⚠️ Sebagian | `docs/reference/THRESHOLDS.md` ada; PRD/PLAN/ADR ada di repo **privat** `niu-gayo-agroclimate-docs` (tidak dapat diakses publik) |
| Versi | ⚠️ Tidak sinkron | `package.json` = `1.0.0`, `CHANGELOG.md` = `1.2.0` |
| Cakupan bahaya | ⚠️ Hidrometeorologi saja | Longsor, indeks hujan DAS, angin, karat daun. **Belum ada**: karhutla/asap, kualitas udara, gempa, kekeringan, suhu ekstrem/embun beku, petir, vulkanik |

**Kesimpulan:** fondasi teknis sehat dan terstruktur rapi (pemisahan `api/` – `domain/` – `components/`, fungsi murni ter-test, server proxy ber-cache). Arsitektur saat ini **hard-coded ke satu keluarga bahaya**; untuk multi-hazard dibutuhkan lapisan abstraksi *hazard registry* (lihat `05-ARCHITECTURE.md`).

---

## 2. Struktur Repo

```
.
├── .github/workflows/ci.yml      # CI test + build
├── archive/prototype.html        # prototipe awal (1.264 baris, tidak dipakai)
├── docs/reference/THRESHOLDS.md            # tabel ambang & bobot (sumber kebenaran: src/domain/thresholds.js)
├── public/icons/                 # ikon PWA
├── scripts/serve.py              # static server dist/ (:7444)
├── server/                       # API proxy Node http murni (:7455)
│   ├── index.js                  # router: /healthz, /api/{weather,ensemble,alerts,consensus,bmkg-nowcast,seasonal,disaster-history,reports,cache/flush}
│   ├── config.js                 # port, TTL cache, bobot DAS hulu
│   ├── cache.js                  # cache memori SWR (stale-while-revalidate)
│   ├── openMeteo.js              # fetch ECMWF ifs025 + agregat 15 lokasi + konsensus
│   ├── ensemble.js / consensus.js# ECMWF 50 member + WeatherNext2 64 member
│   ├── antecedent.js / imerg.js  # ARI dari NASA IMERG Late (OPeNDAP, Earthdata token) + fallback model
│   ├── bmkg.js                   # parser RSS CAP nowcast BMKG (filter Aceh, map kecamatan)
│   ├── reports.js                # laporan warga (JSON file + relay Telegram, rate limit 5/jam/IP)
│   └── agroclimate-api.service   # unit systemd
├── src/
│   ├── App.jsx                   # dua layout: mobile 4 tab / desktop grid 12 kolom
│   ├── api/                      # fetch murni Open-Meteo (DI fetch)
│   ├── domain/                   # fungsi murni: coffee, disaster, ensemble, seasonal, thresholds, format
│   ├── components/               # 15 komponen (DisasterWarning, CoffeeAdvisory, ReportButton, dst.)
│   ├── data/locations.js         # 15 sentra (lat/lon/elevasi/slopeClass)
│   ├── data/disasterHistory.json # 6 kejadian terkurasi 2023–2026
│   ├── i18n/messages.js          # id-ID + Bahasa Gayo
│   ├── lib/                      # prefs (localStorage), dataAge, useBreakpoint
│   └── services/weatherService.js# komposisi data → analisis domain → objek UI
└── tests/                        # 13 file test + fixtures (RSS BMKG, leaf wetness)
```

---

## 3. Fitur yang Sudah Ada (PRD F1–F8)

| Kode | Fitur | Implementasi | Kualitas |
|---|---|---|---|
| F1 | Konsensus multi-model | `/api/consensus` — ECMWF 50 + WN2 64 member, P(hujan>25 mm/24j) | ✅ fallback degraded |
| F2 | Antecedent Rainfall Index | IMERG Late primer → fallback ECMWF; bobot longsor 72j = 35 | ✅ dengan staleness signal |
| F3 | PWA offline + i18n + tema | vite-plugin-pwa (NetworkFirst API 24j), id/gayo, light/dark/auto | ✅ |
| F4 | Riwayat bencana per sentra | JSON statis 6 kejadian; DIBI BNPB tak punya endpoint JSON | ⚠️ manual |
| F5 | Nowcast resmi BMKG | Parser RSS CAP, filter Aceh, map 16 nama kecamatan → id | ✅ |
| F6 | Diseminasi Telegram | 2 cron (3 jam / 6 jam) ke topik #55 | ✅ (di luar repo) |
| F7 | Kalender risiko musiman | `seasonal.js`: PUNCAK Nov–Feb, WASPADA Mar–Apr+Okt, RENDAH Mei–Sep | ✅ |
| F8 | Lapor warga | POST `/api/reports`, tipe terbatas `longsor/banjir/angin/karat` | ⚠️ tipe perlu diperluas |

---

## 4. Model Risiko yang Ada (`src/domain/`)

- **Longsor** (skor 0–100): hujan 24j (25) + antecedent 72j/ARI (35) + kejenuhan tanah (20) + intensitas puncak (10) + lereng (10).
- **DAS Peusangan**: indeks hujan hulu berbobot (Bintang .35, Lut Tawar .30, Kebayakan .20, Silih Nara .15) — bukan muka air nyata.
- **Angin**: `wind_gusts_10m` ≥ 40 waspada / ≥ 60 bahaya km/jam.
- **Karat daun**: leaf wetness rolling 48 jam, skor 0–100.
- **Penjemuran**: hujan > 0,1 mm/jam, DNI < 150 W/m², RH > 80%.

---

## 5. Temuan Teknis & Utang Teknis

### 5.1 Kekuatan
1. **Fungsi domain murni** dan ter-test → mudah ditambah hazard baru tanpa menyentuh UI.
2. **Server tanpa dependensi** + cache SWR + sinyal degradasi (`staleness`) → pola yang bisa direplikasi untuk sumber data baru (FIRMS, CAMS, BMKG gempa).
3. **Pola "tidak pernah throw"** pada fetcher eksternal (BMKG, konsensus) → dashboard tetap hidup saat sumber mati.
4. Parser XML/RSS tanpa dependensi + fixture test → bisa dipakai ulang untuk CAP gempa/vulkanik.
5. Atribusi sumber & waktu data selalu ditampilkan (prinsip yang wajib dipertahankan).

### 5.2 Kelemahan / utang
| # | Temuan | Dampak | Rekomendasi |
|---|---|---|---|
| T1 | `weatherService.js` menghitung ARI sendiri dengan `source:'model-ecmwf'` padahal server sudah punya IMERG | Klien & server bisa tampil beda | Klien konsumsi `/api/alerts` untuk ARI, jangan hitung ulang |
| T2 | `VALID_LOCATIONS` diduplikasi di `server/index.js` dan `server/reports.js` | Drift saat tambah lokasi | Derivasi dari `LOCATIONS` |
| T3 | `VALID_TYPES` laporan warga hanya 4 jenis | Tak bisa lapor asap/kebakaran/gempa | Perluas ke taksonomi hazard (lihat PRD) |
| T4 | `DisasterWarning.jsx` hard-code judul "Hidrometeorologi" & 3 baris risiko | Tidak skalabel | Render dari *hazard registry* |
| T5 | Tidak ada peta — lokasi hanya daftar | Hotspot/asap/gempa butuh konteks spasial | Tambah peta ringan (MapLibre GL / Leaflet) dengan tile cache offline terbatas |
| T6 | `disasterHistory.json` manual; tidak ada kejadian karhutla/gempa (Ketol M6,1 2013 tidak tercatat) | Riwayat tak lengkap | Perluas skema + tambah kejadian non-hidromet |
| T7 | Versi `package.json` 1.0.0 vs CHANGELOG 1.2.0 | Kebingungan rilis | Samakan ke 1.2.0; pakai `npm version` |
| T8 | Server bind `127.0.0.1` (OK untuk tunnel) tetapi tidak ada header keamanan/rate limit global | Risiko abuse saat endpoint bertambah | Tambah rate limit umum + `Cache-Control` publik untuk GET |
| T9 | Tidak ada e2e/UI test, hanya unit | Regresi UI tak terdeteksi | Tambah smoke test Playwright minimal di CI |
| T10 | Kecamatan `KECEMATAN_MAP` (typo) di `bmkg.js`; `Bebesan` vs nama resmi `Bebesen` | Kosmetik/konsistensi | Perbaiki saat refactor |
| T11 | Nomor Posko BPBD hard-code di komponen | Sulit dirawat | Pindah ke `data/contacts.js` (bersama nomor Damkar, Puskesmas, Manggala Agni) |
| T12 | Tidak ada *feature flag* | Rilis hazard baru berisiko | Tambah flag sederhana via env/`prefs` |
| T13 | Koordinat sentra di `locations.js` berpresisi 2 desimal; 4 sentra (jagongjeget, bies, ketol, rusipantara) jatuh di luar poligon kecamatan nominal GADM (`src/data/hazards/sentraKecamatan.json`) | Salah radius hotspot/GloFAS/jarak Burni Telong & marker peta | Verifikasi lokasi kampung, perbarui lat/lon (3–4 desimal) |

---

## 6. Kesenjangan terhadap Kebutuhan Multi-Hazard

| Bahaya | Relevansi Aceh Tengah | Status repo |
|---|---|---|
| Kabut asap karhutla (transboundary + lokal) | **Sedang terjadi** (Okt 2026): BMKG memperkirakan sebaran asap masuk Aceh Tengah & Bener Meriah | ❌ Tidak ada |
| Kebakaran hutan/lahan lokal (hotspot) | Musim kering Mei–Sep, lahan kopi/semak, savana Linge | ❌ Tidak ada |
| Kualitas udara (ISPU/PM2.5) | Dampak kesehatan petani, anak, lansia; penjemuran kopi | ❌ Tidak ada |
| Gempa bumi (Sesar Sumatra segmen Aceh/Tripa; Ketol M6,1 2013) | Tinggi — 15 lokasi di zona sesar | ❌ Tidak ada |
| Vulkanik (Burni Telong, Bener Meriah ~25 km) | Sedang — abu dapat merusak bunga kopi | ❌ Tidak ada |
| Kekeringan / hari tanpa hujan | Sedang — bunga & buah kopi, air baku | ❌ Tidak ada |
| Suhu ekstrem (embun beku/upas di >1.400 mdpl, gelombang panas) | Sedang — kerusakan daun kopi | ❌ Tidak ada |
| Petir / cuaca ekstrem konvektif | Sedang — pekerja kebun di lereng terbuka | ❌ Tidak ada |
| Banjir bandang / luapan danau | Tinggi | ⚠️ Indeks hujan saja |
| Longsor | Tinggi | ✅ Skor gabungan |
| Angin kencang | Sedang | ✅ Gusts |

---

## 7. Rekomendasi Langkah Awal (pra-pengembangan)

1. Sinkronkan versi (`1.2.0`) dan tandai rilis `v1.2.0` sebagai *baseline* sebelum multi-hazard.
2. Refactor kecil **tanpa mengubah perilaku**: derivasi `VALID_LOCATIONS` dari `LOCATIONS`, pindahkan kontak darurat ke data, tambah feature flag.
3. Bangun **hazard registry** (`src/domain/hazards/index.js`) dan migrasikan longsor/DAS/angin ke dalamnya sebagai bukti konsep sebelum menambah asap/kebakaran.
4. Prioritaskan **modul Asap & Kualitas Udara** (kebutuhan nyata saat ini) → lihat `03-ROADMAP.md` Fase 1.
