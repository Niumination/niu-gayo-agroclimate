# Tabel Referensi Threshold & Bobot — Niu Gayo Agro-Climate (M3)

Sumber kebenaran: `src/domain/thresholds.js`. Perubahan di modul itu **wajib** disinkronkan ke tabel ini.
Konteks agro-ekologi: kopi Arabika Gayo, dataran tinggi Aceh Tengah (~900–1500 mdpl).

## 1. Karat Daun (Hemileia vastatrix) — model leaf wetness (M3)

Parameter: `leaf_wetness_probability` (jam), `temperature_2m` (°C), rolling **48 jam**. Skor 0–100.

| Komponen | Kondisi | Poin | Level |
|---|---|---|---|
| Basah beruntun | ≥ 6 jam | +40 | |
| | ≥ 3 jam | +20 | |
| Total jam basah (dari 48) | ≥ 24 jam | +25 | |
| | ≥ 12 jam | +15 | |
| Basah + suhu optimal | ≥ 6 jam | +35 | |
| | ≥ 3 jam | +20 | |
| **Level** | skor ≥ 70 | | **Tinggi** |
| | skor ≥ 40 | | **Sedang** |
| | else | | **Rendah** |

Konstanta: `wetnessThreshold = 70%`, `tempMin = 18°C`, `tempMax = 25°C`.
Referensi: jendela infeksi karat daun kopi membutuhkan basah daun berkepanjangan pada suhu hangat 18–25°C (FAO/BMKG, umum; validasi lapangan BPBD/penyuluh masih diperlukan).

Model lama (RH ≥ 85% & suhu 18–25°C → Tinggi; RH ≥ 75% → Sedang) dipertahankan sebagai cross-check.

## 2. Longsor — skor gabungan (M3)

Parameter: hujan 24/72 jam (mm), `soil_moisture_0_to_7cm` antecedent (m³/m³), intensitas puncak per jam, `slopeClass` per lokasi.

| Komponen | Normalisasi | Bobot maks |
|---|---|---|
| Hujan 24 jam | `/ 75 mm` | 35 |
| Hujan 72 jam | `/ 150 mm` | 25 |
| Kejenuhan tanah | linier 0.15–0.45 m³/m³ | 20 |
| Intensitas puncak | `/ 15 mm/jam` | 10 |
| Lereng (`slopeClass`) | landai 0 / berbukit 5 / curam 10 | 10 |

Level: skor ≥ 70 → **Bahaya Tinggi**, ≥ 40 → **Waspada**, else **Rendah**.
Threshold lama dipertahankan: ≥ 50 mm/hari atau ≥ 15 mm/jam → Bahaya Tinggi; ≥ 25 mm/hari atau ≥ 5 mm/jam → Waspada.

`slopeClass` per lokasi (`src/data/locations.js`): **curam** — Kute Panang, Atu Lintang, Jagong Jeget, Bies, Ketol, Celala; **landai** — Takengon, Lut Tawar, Kebayakan, Silih Nara, Linge; **berbukit** — sisanya.

## 3. Indeks Hujan DAS Peusangan (M3) — RENAME

⚠️ **Ini indeks hujan, bukan status muka air.** Tidak ada telemetri muka air publik untuk Danau Lut Tawar / Sungai Peusangan.

Indeks = Σ (hujan 24 jam lokasi × bobot):

| Lokasi hulu | Bobot |
|---|---|
| Bintang | 0.35 |
| Lut Tawar | 0.30 |
| Kebayakan | 0.20 |
| Silih Nara (Angkup) | 0.15 |

Level: indeks ≥ 50 mm → **Bahaya Luapan DAS**, ≥ 30 mm → **Waspada Luapan DAS**, else Normal.

## 4. Angin (M3: memakai gusts)

| Sumber | Waspada | Bahaya |
|---|---|---|
| `wind_speed_10m` (km/jam) | ≥ 20 | ≥ 35 |
| `wind_gusts_10m` (km/jam) | ≥ 40 | ≥ 60 |

Gusts lebih relevan untuk risiko pohon peneduh roboh.

## 5. Keyakinan Ensemble (S3/M3)

ECMWF `ecmwf_ifs025`, 50 member. Ditampilkan di kartu peringatan:
**P(hujan > 25 mm/24 jam)** dan **P(hujan > 50 mm/24 jam)** — persentase member yang melampaui ambang pada window pertama.

## 6. Threshold agro-kopi (tidak berubah dari M1/M2)

| Parameter | Nilai |
|---|---|
| Suhu optimal | 15–24°C |
| Penjemuran: hujan | > 0.1 mm/jam → tutup terpal |
| Penjemuran: radiasi | < 150 W/m² DNI atau RH > 80% → kurang optimal |

## Disclaimer

Semua ambang merupakan **model prakiraan probabilistik** berbasis Open-Meteo ECMWF, belum tervalidasi lapangan secara sistematis. Tampilkan selalu keyakinan ensemble + sumber & waktu data; validasi bersama BPBD Aceh Tengah / penyuluh sebelum dipakai sebagai dasar keputusan mitigasi.
