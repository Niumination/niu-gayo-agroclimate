# Threshold & Pemetaan Level — Hazard Baru

Versi 1.0 (final — 10 iterasi riset) · 2026-10-14. Melengkapi `docs/THRESHOLDS.md` (hazard lama). Setelah implementasi, sumber kebenaran pindah ke `src/domain/thresholds.js` dan tabel ini wajib disinkronkan.

Skala UI seragam (ADR-16): **rendah · waspada · bahaya · ekstrem** (+ `n/a`).

## 1. H-ASAP — ISPU (Permen LHK P.14/2020) dari PM2.5 & PM10

### 1.1 Batas konsentrasi → indeks (interpolasi linier `I = ((Ib−Ia)/(Xb−Xa))·(X−Xa)+Ia`)
| Kategori ISPU | Rentang indeks | Warna resmi | PM2.5 24 jam (µg/m³) | PM10 24 jam (µg/m³) | CO 8 jam (µg/m³) | Level UI |
|---|---|---|---|---|---|---|
| Baik | 0–50 | Hijau | 0–15,4 | 0–50 | 0–4.000 | rendah |
| Sedang | 51–100 | Biru | 15,5–55,4 | 51–150 | 4.001–8.000 | rendah (catatan rentan) |
| Tidak Sehat | 101–200 | Kuning | 55,5–150,4 | 151–350 | 8.001–15.000 | waspada |
| Sangat Tidak Sehat | 201–300 | Merah | 150,5–250,4 | 351–420 | 15.001–30.000 | bahaya |
| Berbahaya | > 300 | Hitam | > 250,5 | > 420 | > 30.000 | ekstrem |

Sumber: Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020 (tabel via ispu.kemenlh.go.id & kalkulator DLH Singkawang). Konsentrasi masukan = **rata-rata bergerak 24 jam** dari deret jam-an CAMS (jika < 18 jam data → tandai `partial`). ISPU akhir = maksimum sub-indeks parameter.

### 1.2 Sinyal pendamping (bukan penentu kategori, menaikkan "keyakinan")
| Sinyal | Sumber | Ambang indikatif |
|---|---|---|
| AOD 550 nm | CAMS | ≥ 0,5 asap signifikan di kolom; ≥ 1,0 tebal (14 Okt 2026 Takengon = 1,06) |
| CO permukaan | CAMS | > 1.000 µg/m³ bersama PM2.5 naik → tanda pembakaran biomassa |
| Jarak pandang | Open-Meteo `best_match` | < 5 km waspada · < 2 km bahaya · < 1 km ekstrem (praktik BMKG kabut asap) |
| Laporan warga `asap` | F8 | ≥ 3 laporan "< 1 km" dalam 6 jam di satu sentra → naikkan 1 level (maks. bahaya) |

### 1.3 Anjuran bertingkat (final — rujukan Kemenkes 2026, Permen LHK P.14/2020, WHO AQG 2021)
| Kategori ISPU | Umum | Kelompok rentan (anak, lansia, ibu hamil, asma/PPOK, komorbid) | Pekerja kebun / luar ruang | Sekolah & kampung |
|---|---|---|---|---|
| Baik (0–50) | Aktivitas normal | Normal | Normal | Normal |
| Sedang (51–100) | Normal; peka asap kurangi aktivitas berat lama | **Catatan WHO**: PM2,5 sudah > pedoman 24 jam (15 µg/m³) → kurangi aktivitas berat lama, siapkan masker | Normal; istirahat cukup | Normal; pantau ISPU pagi |
| Tidak Sehat (101–200) | Kurangi aktivitas luar ruang lama; masker (N95/KN95 dianjurkan) saat keluar; tutup pintu/jendela | Hindari aktivitas luar ruang; masker N95; perhatikan gejala batuk/sesak | Batasi kerja berat ≤ 4 jam, masker N95, jeda di ruang tertutup; **tutup jemuran / pakai pengering tertutup** | **Tiadakan olahraga, upacara, kegiatan luar ruang**; siapkan ruang kelas tertutup |
| Sangat Tidak Sehat (201–300) | Hindari aktivitas luar ruang; AC resirkulasi/pembersih udara; cek ISPU sebelum keluar | Tetap di dalam ruangan/ruang bersih; ke faskes bila sesak | **Tunda kerja kebun non-mendesak & penjemuran terbuka**; bila terpaksa: N95, < 2 jam | **Pertimbangkan PJJ/libur** (preseden Kota Jambi & Maluku Tengah 2026; keputusan pemda); buka ruang bersih kampung |
| Berbahaya (> 300) | Tetap di dalam ruangan; ruang bersih; hindari bakar apa pun di dalam rumah | Prioritas evakuasi ke ruang berudara bersih/faskes bila bergejala | **Hentikan kerja luar ruang** | **Libur/PJJ**; posko kesehatan; distribusi masker |

Tindakan lintas kategori (≥ 101): pantau ISPU pagi & sore; minum cukup; segera ke Puskesmas/RSUD Datu Beru bila sesak, nyeri dada, batuk memburuk; hindari menambah asap (bakar sampah/lahan). Sumber: Kemenkes Pusat Krisis (Agu–Sep 2026), SE Kemenkes Mei 2026, Permen LHK P.14/2020, WHO AQG 2021.

### 1.4 Dampak kopi (prinsip kehati-hatian)
| Kondisi | Status penjemuran | Alasan |
|---|---|---|
| ISPU ≥ 101 atau (AOD ≥ 1,0 dan DNI < 300 W/m² siang) | **Tunda (asap)** | DNI turun → pengeringan lambat; partikel/bau asap menempel pada gabah terbuka |
| ISPU ≥ 201 | Tunda + tunda kerja kebun non-mendesak | Kesehatan pekerja prioritas |

## 2. H-API — FWI System (FDRS Indonesia) & hotspot

### 2.1 Kelas komponen FWI (kalibrasi nasional de Groot et al. 2007 / BMKG)
| Komponen | Makna | Rendah | Sedang | Tinggi | Ekstrem | Level UI |
|---|---|---|---|---|---|---|
| FFMC | Potensi penyalaan serasah/rumput | 0–72 | 73–77 | 78–82 | ≥ 83 | rendah/rendah/waspada/bahaya |
| DC | Potensi asap (bahan organik dalam) | mengikuti kelas BMKG (akan dikonfirmasi iterasi 10) | | | | |
| ISI | Kesulitan kendali api rumput | < 2 | 2–5 | 5–6 | ≥ 6 | |
| FWI | Intensitas/kesulitan kendali umum | 0–1 | 1–6 | 6–13 | > 13 | rendah/rendah/waspada/bahaya |

Level UI modul = maksimum dari FFMC & FWI; **ekstrem** bila FWI > 13 **dan** hotspot ≤ 25 km dalam 24 jam.

### 2.2 Hotspot (FIRMS)
| Parameter | Nilai |
|---|---|
| Sensor | VIIRS S-NPP/NOAA-20/NOAA-21 (375 m) + MODIS (1 km) |
| Filter keyakinan | VIIRS `confidence ∈ {n, h}`; MODIS `confidence ≥ 50` |
| Jendela | 24 jam (utama), 48 jam (tren) |
| Radius ke sentra | ≤ 10 km → **bahaya** · ≤ 25 km → **waspada** · ≤ 50 km → informasi |
| FRP | tampilkan MW; ≥ 20 MW tandai "intens" |
| Catatan UI | "Hotspot = indikasi anomali panas, belum tentu kebakaran (SiPongi/KLHK)" |

## 3. Pemetaan skala domain lain → level UI (draft)
| Hazard | Skala asal | rendah | waspada | bahaya | ekstrem |
|---|---|---|---|---|---|
| Longsor (lama) | skor 0–100 | < 40 | 40–69 | ≥ 70 | ≥ 70 + BMKG aktif |
| DAS (lama) | indeks mm | < 30 | 30–49 | ≥ 50 | — |
| Debit GloFAS (baru) | rasio debit prakiraan / median klimatologi hari itu | < 2 | ≥ 2 | ≥ 3 atau > p95 | ≥ 5 |
| Angin (lama + BMKG) | gusts km/jam | < 40 | 40–44 | ≥ 45 (kriteria ekstrem BMKG) / ≥ 60 | ≥ 80 atau puting beliung (konvektif bahaya + ≥ 45) |
| Gempa | MMI BMKG di kota terdekat / indikatif | tidak terasa (I) | II–III | IV–V | ≥ VI |
| Vulkanik | Tingkat aktivitas PVMBG | Level I Normal | Level II Waspada | Level III Siaga | Level IV Awas |
| Petir/konvektif | CAPE ECMWF, LI GFS, kode WMO, gusts | CAPE < 1.000 & LI > −3 | CAPE ≥ 1.000 atau LI ≤ −3 | CAPE ≥ 2.000 atau kode 95–99 atau LI ≤ −6 | bahaya + (gusts ≥ 45 atau hujan ≥ 20 mm/jam atau BMKG nowcast aktif) |
| Kekeringan (HTH BMKG) | hari < 1 mm berturut | 0–10 (Sangat Pendek/Pendek) | 11–20 (Menengah) | 21–60 (Panjang/Sangat Panjang) | > 60 (Ekstrem) |
| Stres dingin kopi | Tmin °C 2 m | > 10 | ≤ 10 | ≤ 6 | ≤ 4 + cerah + angin ≤ 5 km/jam + Td ≤ 2 °C (potensi embun upas) |
| Stres panas kopi | Tmax °C | < 28 | ≥ 28 | ≥ 30 (fase bunga; VPD > 0,82 kPa menaikkan 1 level) | ≥ 32 |

## 4. H-GEMPA — detail (iterasi 3)
| Aturan | Nilai |
|---|---|
| Radius tampil | ≤ 300 km dari Takengon (4,63 N 96,85 E) **atau** `Dirasakan` memuat kabupaten/kota Aceh |
| Prioritas tampil | terasa di Aceh Tengah/Bener Meriah > M≥5 ≤ 150 km > lainnya |
| MMI indikatif per sentra | dari M, kedalaman, jarak hiposenter (relasi atenuasi sederhana; dilabeli indikatif); jika BMKG memberi MMI kota terdekat, pakai itu |
| Majemuk gempa × longsor | M≥5 ≤ 100 km **dan** (ARI72 ≥ 100 mm **atau** skor longsor ≥ 40) → banner 72 jam |
| Diseminasi segera | M≥4,5 ≤ 150 km atau terasa di Aceh Tengah/Bener Meriah; dedupe per id |

## 5. H-VULKANIK — detail (iterasi 3)
| Tingkat (PVMBG) | Level UI | Anjuran inti |
|---|---|---|
| I Normal | rendah | Informasi; aktivitas normal |
| II Waspada (**status saat ini**) | waspada | Jauhi kawah sesuai radius rekomendasi (2–3 km); hindari fumarola/solfatara saat hujan/mendung (gas); siapkan masker & penutup bak air |
| III Siaga | bahaya | Sentra ≤ 30 km di bawah angin: siaga abu (masker N95, tutup air, lindungi jemuran & bunga kopi); ikuti arahan BPBD |
| IV Awas | ekstrem | Ikuti evakuasi resmi; banner global |

Sektor di bawah angin: arah **menuju** = arah angin 10 m + 180°; sentra dalam ±30° dan ≤ 30 km ditandai. Jarak sentra ke puncak (km): Ketol 8,1 · Kute Panang 10,5 · Kebayakan 13,6 · Takengon 15,7 · Bebesan 16,0 · Lut Tawar 18,9 · Bies 20,4 · Silih Nara 20,9 · Pegasing 21,0 · Bintang 25,4 · Celala 35,4 · Atu Lintang 35,5 · Jagong Jeget 43,3 · Linge 44,6 · Rusip Antara 50,9.

## 6. H-KERING & H-SUHU — detail (iterasi 4)
| Indikator | Definisi | Sumber | Catatan |
|---|---|---|---|
| HTH | hari berturut hujan < 1 mm, mundur dari hari terakhir berdata; hari terakhir ≥ 1 mm → "HH" | Archive (ERA5-Land) + forecast harian untuk proyeksi | kelas BMKG: 0–5 / 6–10 / 11–20 / 21–30 / 31–60 / > 60 |
| Neraca air 30 hari | Σ(P − ET0) mm | Archive | < −60 mm waspada, < −120 mm bahaya (indikatif, kalibrasi lokal) |
| VPD pembungaan | rata-rata VPD 09–15 WIB 7 hari | Forecast ECMWF `vapour_pressure_deficit` | > 0,82 kPa waspada, > 1,5 kPa bahaya (Yunnan 2025, indikatif) |
| Embun upas | Tmin ≤ 4 °C **dan** awan < 30 % **dan** angin ≤ 5 km/jam **dan** Td ≤ 2 °C | Forecast | suhu permukaan rumput bisa ≤ 0 °C meski udara 2 m > 0 °C |
| Konteks iklim | teks kurasi rilis BMKG (ENSO, IOD, awal/puncak musim) | `climateOutlook.json` | kedaluwarsa 40 hari → tanda "perlu pembaruan" |

## 7. H-BANJIR+ — detail (iterasi 5)
| Aturan | Nilai |
|---|---|
| Sel GloFAS | outlet Lut Tawar (4,625 N 96,875 E) · Takengon (4,625/96,825) · Bintang hulu (4,575/96,925) · Angkup (4,625/96,725) |
| Horizon | past 7 + forecast 7 hari; nilai harian `river_discharge` (kontrol) + `p75` & `max` (ensemble) |
| Klimatologi | median & p95 per hari-dalam-tahun (jendela ±15 hari) dari 1984–kini, dihitung sekali per sel |
| Level | rasio median ≥ 2 → waspada; ≥ 3 **atau** > p95 → bahaya; ≥ 5 → ekstrem; pakai `p75` untuk level, `max` untuk "skenario terburuk" |
| Komposisi v2 | maks(level indeks hujan hulu lama, level anomali debit); ARI72 ≥ 100 mm menaikkan 1 level (maks bahaya) |
| Label wajib | "Model hidrologi global GloFAS (Copernicus) — bukan tinggi muka air terukur" |

## 8. Kriteria resmi cuaca ekstrem BMKG (Perka KEP.009/2010) — acuan lintas modul
| Parameter | Ambang | Dipakai di |
|---|---|---|
| Hujan | ≥ 50 mm/24 jam (lebat); 100–150 sangat lebat; > 150 ekstrem | Longsor, DAS, konvektif |
| Angin | > 25 knot ≈ 45 km/jam | H-ANGIN+, konvektif |
| Suhu | menyimpang ± 3 °C dari normal setempat | H-SUHU (pembanding terhadap klimatologi ERA5 30 hari) |
| Jarak pandang | < 1.000 m | H-ASAP (ekstrem), kabut |

## 9. H-PETIR — detail (iterasi 6)
| Elemen | Aturan |
|---|---|
| Jendela | 12 jam ke depan, laporkan jam puncak (umumnya 13–18 WIB) |
| Konsensus | `agreement` = ECMWF & GFS sepakat kelas; jika tidak, level ikut sinyal terkuat dan UI menampilkan "model tidak sepakat" |
| Hujan es | hanya "potensi" bila CAPE ≥ 2.000 & kode 95–99; tanpa angka |
| Aturan 30-30 | kilat→guntur < 30 detik → berhenti kerja; tunggu 30 menit setelah guntur terakhir |
| Pembobot resmi | nowcast BMKG aktif untuk kecamatan → minimal **bahaya** |

## 10. Catatan kalibrasi dari prototipe (iterasi 9)
- `docs/dev/prototypes/fwi.mjs`: 10 hari kering khas Gayo (T 24 °C, RH 60 %, angin 8 km/jam) → FFMC 86,6 (kelas "ekstrem") & FWI 7,6 ("tinggi"). **Implikasi:** kelas FFMC "ekstrem" (≥ 83) mudah tercapai di musim kemarau dataran tinggi → tampilkan "ekstrem" hanya bila **FFMC ≥ 83 DAN (hotspot ≤ 10 km ATAU HTH ≥ 21 hari)**; selain itu "tinggi". Tinjau ulang bersama Staklim Aceh setelah 1 musim arsip (ADR-26).
- `docs/dev/prototypes/ispu.mjs`: PM2,5 17,1 µg/m³ (Takengon, 14 Okt 2026) → ISPU 53 "Sedang"; semua titik batas P.14/2020 lulus uji.
- **Verifikasi resmi FWI (pasca-iterasi):** prototipe vs dataset uji 49 hari Van Wagner & Pickett 1985 dengan hasil harapan paket R `cffdrs` → selisih maksimum **0,005** pada FFMC/DMC/DC/ISI/BUI/FWI bila memakai konstanta FFMC **147,27723** (default produksi); 0,25 bila 147,2 asli. Fixture: `tests/fixtures/hazards/fwi-cffdrs-test_fwi-expected.csv`.
- **Jarak pandang & kabut pagi:** fixture `best_match` 14 Okt menunjukkan visibility minimum 120 m pada dini hari (kabut radiasi lembah Takengon) → proksi jarak pandang asap (§2.3) hanya dievaluasi **jam 09–17 WIB** dan wajib dikombinasikan dengan PM2,5 ≥ 35 µg/m³ atau AOD ≥ 0,5; di luar itu dilabeli "kabut" bukan "asap".

*(Dokumen final iterasi 10; perubahan ambang berikutnya lewat PR + `docs/THRESHOLDS.md` + test.)*
