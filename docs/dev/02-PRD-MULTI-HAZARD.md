# PRD — Niu Gayo Agro-Climate v2 "Multi-Hazard"

| Field | Nilai |
|---|---|
| Versi dokumen | 1.0 (final — 10 iterasi riset) |
| Status | Draft untuk review pemilik produk |
| Pemilik | Niumination (Afrizal Munthe) |
| Produk terkait | `niu-gayo-agroclimate` v1.2.0 (baseline F1–F8) |
| Tanggal | 2026-10-14 |

---

## 1. Latar Belakang & Masalah

Dashboard saat ini hanya meliputi bahaya **hidrometeorologi basah** (longsor, luapan DAS, angin) dan agro-kopi. Pada **14 Oktober 2026**, BMKG memperingatkan sebaran asap karhutla memasuki Aceh Tengah & Bener Meriah; pengguna (petani, warga, BPBD) **tidak mendapat informasi apa pun** dari aplikasi tentang kualitas udara, jarak pandang, hotspot, maupun anjuran kesehatan. Hal yang sama berlaku untuk gempa (zona Sesar Sumatra, Ketol M6,1 2013), kekeringan, embun beku, petir, dan abu vulkanik (Burni Telong).

**Pernyataan masalah:** *Petani kopi dan warga Aceh Tengah membutuhkan satu kanal ringan, offline-tolerant, berbahasa Indonesia/Gayo, yang menerjemahkan data bahaya multi-sumber menjadi tindakan konkret per sentra — termasuk bahaya yang sedang berlangsung (asap) dan bahaya majemuk (asap + hujan lebat + longsor dalam hari yang sama).*

## 2. Tujuan & Non-Tujuan

### Tujuan (v2)
| ID | Tujuan | Metrik keberhasilan |
|---|---|---|
| G1 | Menyediakan status **kabut asap & kualitas udara** per 15 sentra dalam ≤ 2 minggu pengembangan (kebutuhan mendesak) | Modul tayang; ISPU estimasi + jarak pandang + anjuran kesehatan; ≥ 1 cron Telegram |
| G2 | Mengubah arsitektur menjadi **hazard registry** sehingga menambah bahaya baru = 1 modul domain + 1 fetcher + 1 kartu | Longsor/DAS/angin bermigrasi tanpa regresi (91 test tetap hijau) |
| G3 | Menutup **semua kelas bahaya relevan** Aceh Tengah (lihat §4) dalam 2 fase berikutnya | Minimal "status + anjuran" untuk 9 hazard |
| G4 | Menjaga prinsip **jujur-data**: setiap angka punya sumber, waktu, dan label estimasi/pengukuran/resmi | Audit UI: 100 % kartu memiliki atribusi |
| G5 | Tetap **ringan**: bundle JS < 400 kB gzip tanpa peta, < 600 kB dengan peta lazy-load; server tetap tanpa dependensi wajib | Pengukuran build di CI |

### Non-tujuan
- Bukan pengganti peringatan resmi BMKG/BNPB/BPBD/PVMBG — aplikasi **mengagregasi & menerjemahkan**, atribusi wajib.
- Tidak membangun jaringan sensor fisik pada v2 (dicatat sebagai peluang kemitraan).
- Tidak memproses data pribadi pelapor (laporan tetap anonim).

## 3. Pengguna & Persona

| Persona | Kebutuhan utama | Konteks penggunaan |
|---|---|---|
| **Petani kopi** (Pegasing, Atu Lintang, Jagong Jeget) | "Aman tidak kerja di kebun hari ini? Jemur kopi atau tutup? Perlu masker?" | HP Android menengah, sinyal 3G/4G putus-nyambung, baca cepat pagi hari |
| **Pengumpul/prosesor** (Bebesan, Takengon) | Jendela jemur, risiko hujan, logistik jalan (longsor/jarak pandang) | Desktop/HP, cek beberapa kali sehari |
| **Operator BPBD / Pusdalops** | Ringkasan 15 sentra, sinyal degradasi data, tren 72 jam, laporan warga | Desktop; butuh ekspor/salin teks ke WhatsApp |
| **Kepala kampung / relawan Destana** | Pesan siap-sebar, kontak darurat, ambang tindakan sederhana | HP; bahasa Gayo membantu |
| **Sekolah / Puskesmas** | Ambang ISPU untuk kegiatan luar ruang & kelompok rentan | Pagi hari, keputusan cepat |

## 4. Taksonomi Bahaya (ruang lingkup v2)

| Kode | Bahaya | Prioritas | Fase | Sumber data utama (lihat `04-DATA-SOURCES.md`) |
|---|---|---|---|---|
| H-ASAP | Kabut asap & kualitas udara (PM2.5/ISPU, AOD, CO, jarak pandang) | **P0** | 1 | Open-Meteo AQ (CAMS), Open-Meteo `visibility`, BMKG citra asap (atribusi), laporan warga |
| H-API | Kebakaran hutan/lahan: hotspot + peringkat bahaya kebakaran (FWI/SPBK) | **P0** | 1 | NASA FIRMS VIIRS/MODIS, FWI in-house (Open-Meteo ECMWF), SiPongi (rujukan) |
| H-LONGSOR | Longsor (migrasi ke registry) | P0 | 1 (migrasi) | Ada |
| H-BANJIR | Luapan DAS Peusangan & banjir bandang (indeks hujan lama + **anomali debit GloFAS** + laporan) | P1 | 2 | Ada + Open-Meteo Flood API (GloFAS v4, 0,05°) **[diuji]**; PetaBencana.id **[diuji]**; SIHKA PUPR (verifikasi) |
| H-ANGIN | Angin kencang / puting beliung (migrasi; tambah titik 45 km/jam = kriteria ekstrem BMKG) | P1 | 2 | Ada (`wind_gusts_10m`) + modul konvektif |
| H-GEMPA | Gempa bumi (Sesar Sumatra segmen Aceh–Tripa; Gayo 2013 M6,1 MMI VII) — info resmi + panduan + pemicu longsor susulan | P1 | 2 | BMKG `autogempa.json` / `gempadirasakan.json` / `gempaterkini.json` **[diuji, publik]**; USGS FDSN **[diuji]** pelengkap |
| H-PETIR | Petir, hujan es, puting beliung (konvektif) — konsensus CAPE ECMWF + LI GFS + `weather_code` + nowcast BMKG | P2 | 2 | Open-Meteo ECMWF (`cape`, `weather_code`, gusts) **[diuji]** + GFS (`lifted_index`) **[diuji]** + F5 BMKG |
| H-KERING | Kekeringan meteorologis (HTH BMKG), neraca air, VPD/stres air kopi — **El Niño sangat kuat + IOD positif 2026** | P1 (HTH+banner iklim di Fase 1) / P2 (SPI) | 1 & 3 | Open-Meteo Archive (ERA5) **[diuji]**, ET0, VPD; rilis BMKG (kurasi) |
| H-SUHU | Suhu ekstrem kopi: stres dingin/embun upas (Tmin, Td, awan, angin) & panas/aborsi bunga (Tmax ≥ 30 °C, VPD) | P2 | 3 | Open-Meteo `temperature_2m_min/max`, `dew_point_2m`, `cloud_cover`, `vapour_pressure_deficit` |
| H-VULKANIK | Abu & gas vulkanik Burni Telong (Bener Meriah; **Level II Waspada sejak Jan 2026**, 8–25 km dari 10 sentra) | **P1** | 2 | MAGMA Indonesia (halaman publik tingkat aktivitas, parser HTML) + arah angin Open-Meteo; iterasi 3 |

## 5. Kebutuhan Fungsional

Format: **FR-{hazard}-{n}** · prioritas MoSCoW · kriteria penerimaan (AC).

### 5.1 H-ASAP — Kabut asap & kualitas udara (Fase 1)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-ASAP-1 | Server menyediakan `GET /api/air-quality?location=` berisi PM2.5/PM10/CO/AOD jam-an 48 jam + *current* dari Open-Meteo AQ (CAMS global), cache 30 menit, pola "tidak pernah throw" (`degraded:true`) | Must | Respons < 1 s dari cache; field `source`, `retrievedAt`, `model:'cams_global'` |
| FR-ASAP-2 | Fungsi murni `ispuFromPm25(conc24h)` & `ispuFromPm10()` sesuai Permen LHK P.14/2020 (interpolasi linier) + kategori 5 warna | Must | Unit test tabel batas (15,4 → 50; 55,4 → 100; 150,4 → 200; 250,4 → 300) |
| FR-ASAP-3 | Kartu "Kabut Asap & Udara" per sentra: ISPU estimasi (angka + kategori + warna resmi), PM2.5 rata-rata 24 jam, tren 24 jam ke depan, **jarak pandang** (best_match), AOD sebagai "ketebalan asap lapisan atas", label **"Estimasi model CAMS 45 km — bukan pengukuran"** | Must | Snapshot test; atribusi tampil |
| FR-ASAP-4 | **Anjuran bertingkat** per kategori ISPU untuk 4 kelompok: umum, kelompok rentan (anak/lansia/ibu hamil/asma/PPOK/komorbid), **pekerja kebun**, **sekolah & kampung** — teks id-ID + Gayo, rujukan Kemenkes 2026/WHO AQG; ambang kebijakan ≥ 101 tiadakan kegiatan luar ruang, ≥ 201 pertimbangkan PJJ, > 300 tetap di dalam | Must | Teks sesuai `06-THRESHOLDS-MULTI-HAZARD.md` §1.3 (final) |
| FR-ASAP-5 | Dampak agro: `dryingStatus` menerima `ispu` & `aod` → "Tunda (asap)" bila ISPU ≥ 101 atau (AOD ≥ 1,0 & DNI < 300 W/m²); anjuran pengering tertutup | Should | Test `dryingStatus` |
| FR-ASAP-9 | Konten statis "Ruang bersih" (checklist) + tautan faskes per kecamatan (`contacts.js`) | Should | Tampil saat ISPU ≥ 101 |
| FR-ASAP-10 | `POST /api/sensors` untuk sensor PM2,5 murah mitra (token per perangkat; skema `{deviceId, pm25, pm10, temp, rh, ts}`); bila ada sensor ≤ 10 km, kartu menampilkan "terukur" di samping "estimasi" | Could | Fase 4 |
| FR-ASAP-6 | Tipe laporan warga baru `asap` dengan skala jarak pandang (> 5 km / 1–5 km / < 1 km) & bau asap, serta `kebakaran` | Must | Validasi server; relay Telegram |
| FR-ASAP-7 | Cron Telegram "Status Asap Gayo" 2×/hari saat ISPU ≥ 51 di ≥ 1 sentra; termasuk hotspot 24 jam radius 50 km | Should | Format pesan ≤ 1.000 karakter |
| FR-ASAP-8 | Ringkasan 15 sentra di `/api/alerts` memuat `airQuality:{ispu, category, pm25_24h, visibilityMin}` | Must | Test agregat |

### 5.2 H-API — Hotspot & peringkat bahaya kebakaran (Fase 1)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-API-1 | Server `GET /api/hotspots` — FIRMS Area API (VIIRS S-NPP/NOAA-20/NOAA-21 + MODIS) bbox Aceh Tengah + buffer 50 km, 48 jam terakhir, cache 30 menit, `FIRMS_MAP_KEY` dari env; filter `confidence` (VIIRS: nominal/high; MODIS ≥ 50 %) | Must | Degraded saat kunci kosong; test parser CSV dengan fixture |
| FR-API-2 | Pemetaan hotspot → sentra terdekat (haversine) + jarak km; `hotspotsWithin{10,25,50}km` per sentra | Must | Unit test |
| FR-API-3 | Fungsi murni **FWI System** (FFMC, DMC, DC, ISI, BUI, FWI) + kelas FDRS Indonesia; *state* harian persisten | Must | Test terhadap nilai referensi Van Wagner (tabel standar) |
| FR-API-4 | Kartu "Bahaya Kebakaran": kelas FFMC (penyalaan), DC (potensi asap lokal), FWI (kesulitan kendali), hotspot 24/48 jam & jarak terdekat, anjuran (larangan bakar lahan, pembersihan serasah, jalur evakuasi) | Must | Snapshot |
| FR-API-5 | Peringatan majemuk: **FFMC ≥ 78 DAN hotspot ≤ 25 km** → status "Siaga Kebakaran Lokal" | Should | Test logika |
| FR-API-6 | **Peta skematik SVG** (tanpa tile, offline): batas kecamatan GADM tersederhana, 15 sentra berwarna level, hotspot 24/48 jam, panah angin, radius Burni Telong | Should | Tambahan ≤ 15 kB gzip; render < 50 ms |
| FR-API-7 | Peta detail Leaflet lazy-load (Fase 4, hanya saat online & diminta) | Could | ≤ 45 kB gzip tambahan saat dibuka |

### 5.3 H-GEMPA — Gempa bumi (Fase 2)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-GEMPA-1 | `GET /api/quakes` — gabung BMKG `gempadirasakan.json` + `autogempa.json` (+ `gempaterkini.json`), normalisasi field (`Coordinates` → lat/lon, `DateTime` ISO, `Dirasakan` → daftar {kota, MMI}), filter: jarak ≤ 300 km dari Takengon **atau** teks dirasakan memuat kabupaten Aceh; cache 2 menit; degraded flag | Must | Parser dengan fixture JSON BMKG; test filter radius |
| FR-GEMPA-2 | Fungsi murni `quakeImpact({mag, depthKm, distKm})` → estimasi MMI indikatif per sentra (relasi atenuasi sederhana) + level UI; label "indikatif — rujuk shakemap BMKG" | Must | Test monotonik (jarak naik → MMI turun) |
| FR-GEMPA-3 | Kartu: gempa terasa terakhir (M, kedalaman, jarak ke sentra, MMI BMKG & indikatif, waktu), tautan shakemap BMKG, panduan **Drop-Cover-Hold**, daftar periksa pasca-gempa (retakan lereng, tebing jalan, bangunan), kontak | Must | Snapshot |
| FR-GEMPA-4 | Aturan majemuk **gempa × longsor**: M≥5 ≤ 100 km **dan** (ARI72 ≥ 100 mm **atau** skor longsor ≥ 40) → banner "risiko longsor susulan" 72 jam | Should | Test aturan |
| FR-GEMPA-5 | Riwayat: gempa **2013-07-02 M6,1** (Ketol/Kute Panang/Kebayakan/Takengon/Bebesan/Silih Nara/Bies) + USGS M≥4,5 ≤ 150 km 10 tahun → `disasterHistory.json` (skema `hazard`) | Should | Test skema |
| FR-GEMPA-6 | Cron Telegram segera (bukan terjadwal) saat gempa M≥4,5 ≤ 150 km atau dirasakan di Aceh Tengah/Bener Meriah | Should | Dedupe per id gempa |

### 5.4 H-VULKANIK — Burni Telong (Fase 2)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-VULK-1 | `GET /api/volcano` — parser halaman publik MAGMA `tingkat-aktivitas` → `{ name:'Bur Ni Telong', level:1..4, label, reportUrl, retrievedAt }`; cache 60 menit; fallback nilai terakhir (persisten) + `degraded` bila struktur HTML berubah | Must | Fixture HTML 14 Okt 2026; test deteksi seksi Level II |
| FR-VULK-2 | Sektor "di bawah angin": arah angin 10 m & (bila tersedia) 850 hPa dari Open-Meteo di koordinat puncak → sentra dalam sektor ±30° dan ≤ 30 km ditandai "potensi hujan abu bila erupsi" | Should | Test geometri sektor |
| FR-VULK-3 | Kartu: tingkat aktivitas resmi + tanggal, radius rekomendasi, jarak sentra ke puncak, sentra di bawah angin, anjuran per level (gas fumarola saat hujan/mendung; abu: masker, tutup penampung air, lindungi bunga/buah kopi, bersihkan atap), tautan laporan PVMBG | Must | Snapshot; atribusi PVMBG/Badan Geologi |
| FR-VULK-4 | Laporan warga tipe `abu` (hujan abu tipis/tebal) & `gas` (bau belerang) | Should | Validasi |
| FR-VULK-5 | Eskalasi: Level III/IV → banner global di semua sentra ≤ 30 km + cron segera | Should | Test |

### 5.5 H-KERING — Kekeringan meteorologis & stres air kopi (HTH Fase 1; SPI Fase 3)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-KER-1 | `server/archive.js`: deret harian 90 hari per lokasi dari Open-Meteo Archive (`precipitation_sum, temperature_2m_max/min, et0_fao_evapotranspiration, relative_humidity_2m_mean`), 1 call/lokasi/hari, cache persisten `server/data/archive-{id}.json` | Must | Uji 15 lokasi; degraded bila arsip tertinggal > 7 hari |
| FR-KER-2 | Fungsi murni `hthDays(dailyPrecip)` (hujan < 1 mm, hitung mundur) + kelas BMKG 6 tingkat → level UI; gabungkan prakiraan 3 hari untuk "HTH proyeksi" | Must | Test tabel kelas (5/10/20/30/60) |
| FR-KER-3 | Neraca air 30 hari `Σ(P − ET0)` + VPD siang rata-rata 7 hari → indikator stres air kopi (fase bunga/buah dari kalender agronomi Gayo) | Should | Test perhitungan |
| FR-KER-4 | Kartu "Kekeringan & Air Kebun": HTH (angka + kelas BMKG), hujan 30 hari vs ET0, VPD, anjuran (mulsa, irigasi tetes/embung, hindari pembakaran, prioritas air baku) | Must | Snapshot |
| FR-KER-5 | **Banner konteks iklim** (perluasan F7): teks kurasi dari rilis BMKG (ENSO/IOD, prediksi awal & puncak musim hujan) + tanggal & tautan; file `src/data/climateOutlook.json` | Must | Tampil di semua sentra; tanggal kedaluwarsa 40 hari → tanda "perlu pembaruan" |
| FR-KER-6 | SPI-1/SPI-3 dari baseline arsip 1991–2020 per lokasi (unduh sekali) | Could | Fase 3 |

### 5.6 H-SUHU — Suhu ekstrem untuk kopi (Fase 3)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-SUHU-1 | Fungsi murni `coldStress({tmin, dewPoint, cloudCover, windSpeed, elevation})`: ≤ 10 °C waspada, ≤ 6 °C bahaya, ≤ 4 °C + cerah (awan < 30 %) + angin ≤ 5 km/jam + Td ≤ 2 °C → "potensi embun upas" (ekstrem); bobot elevasi > 1.400 mdpl | Must | Test skenario Jagong Jeget/Atu Lintang |
| FR-SUHU-2 | Fungsi murni `heatStress({tmax, vpd, phase})`: ≥ 28 waspada, ≥ 30 bahaya (fase bunga), ≥ 32 ekstrem; VPD > 0,82 kPa saat bunga menaikkan 1 level | Must | Test |
| FR-SUHU-3 | Kartu "Suhu & Kopi": Tmin/Tmax 3 hari, risiko dingin/panas, anjuran (naungan, mulsa, penyiraman pagi, tunda pemangkasan, lindungi bibit) | Must | Snapshot |

### 5.7 H-BANJIR+ — Luapan DAS Peusangan & banjir bandang (Fase 2)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-BJR-1 | `server/flood.js`: 4 sel GloFAS (outlet Lut Tawar 4,625/96,875; Takengon 4,625/96,825; Bintang 4,575/96,925; Angkup 4,625/96,725) — `river_discharge, _mean, _p75, _max`, past 7 + forecast 7 hari; 1 call/sel/6 jam; cache persisten | Must | Degraded bila API gagal; fixture JSON |
| FR-BJR-2 | Klimatologi debit per sel: median & p95 per hari-dalam-tahun dari historis GloFAS (1984–kini) — dihitung sekali, disimpan `server/data/flood-clim-{cell}.json` | Must | Skrip `scripts/build-flood-clim.mjs`; test pembacaan |
| FR-BJR-3 | Fungsi murni `dischargeAnomaly({forecast, median, p95})` → rasio & level (≥ 2 waspada, ≥ 3 bahaya, ≥ 5 ekstrem, atau > p95) | Must | Test monotonik |
| FR-BJR-4 | "Indeks Luapan DAS Peusangan v2" = maks(level indeks hujan hulu lama, level anomali debit) + ARI72 sebagai pengubah; label "model hidrologi global — bukan muka air terukur" | Must | Test komposisi |
| FR-BJR-5 | Kartu: grafik debit 14 hari (past 7 + fut 7, pita p75–max), rasio terhadap normal, hujan hulu, anjuran (jauhi bantaran, amankan jemuran/gudang di dataran rendah Takengon–Bebesan–Kebayakan, jalur evakuasi) | Must | Snapshot |
| FR-BJR-6 | Umpan PetaBencana.id (`/reports?admin=ID-AC`, filter region_code 1104/1117/1113 + radius 60 km; semua jenis) ditampilkan terpisah dengan atribusi CC BY-NC 4.0; cache 10 menit; `User-Agent` khusus | Should | Fixture GeoJSON |
| FR-BJR-7 | Validasi retrospektif debit GloFAS vs 6 kejadian riwayat → `docs/dev/validation/flood-2023-2026.md` | Should | Fase 4 |

### 5.8 H-PETIR / H-ANGIN+ — Cuaca ekstrem konvektif (Fase 2)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-KONV-1 | Fetch tambahan GFS (`gfs_seamless`: `cape, lifted_index`) per lokasi, cache 30 menit; ECMWF sudah memuat `cape, weather_code, showers, wind_gusts_10m` | Must | Degraded bila GFS gagal (pakai ECMWF saja) |
| FR-KONV-2 | Fungsi murni `convectiveRisk({capeEcmwf[], liGfs[], weatherCode[], rainHourly[], gusts[], bmkgActive})` → level + jam puncak (6–12 jam ke depan): waspada CAPE ≥ 1.000 atau LI ≤ −3; bahaya CAPE ≥ 2.000 atau kode 95–99 atau LI ≤ −6; ekstrem bahaya + (gusts ≥ 45 atau hujan ≥ 20 mm/jam atau BMKG aktif) | Must | Test skenario (model tidak sepakat → level ikut sinyal terkuat, `agreement:false`) |
| FR-KONV-3 | Kartu "Petir & Badai": level, jam risiko tertinggi, indikator per model (transparansi ketidaksepakatan), anjuran pekerja kebun (aturan 30-30, jauhi pohon pelindung/pagar kawat, tunda semprot/panen), potensi hujan es (hanya kualitatif) | Must | Snapshot |
| FR-KONV-4 | H-ANGIN+: tambah penanda "≥ 45 km/jam = cuaca ekstrem BMKG"; puting beliung = konvektif bahaya + gusts ≥ 45 | Must | Test |
| FR-KONV-5 | Laporan warga tipe `petir`, `hujan_es`, `puting_beliung` (gabung ke `angin`?) — putuskan: `badai` dengan sub-pilihan | Should | Validasi |

### 5.9 Lintas-hazard
| ID | Kebutuhan | MoSCoW |
|---|---|---|
| FR-X-1 | **Hazard registry** `src/domain/hazards/*.js` — tiap modul mengekspor `{ id, label, evaluate(ctx) → {level, score, detail, advice[], sources[]} }` | Must |
| FR-X-2 | **Indeks bahaya majemuk** per sentra: level tertinggi + daftar bahaya aktif; aturan interaksi (asap + hujan lebat; gempa + tanah jenuh → longsor susulan; kekeringan + FFMC tinggi → siaga karhutla) | Should |
| FR-X-3 | Tab "Risiko" dirender dari registry; urutan: aktif/tertinggi dahulu | Must |
| FR-X-4 | Kontak darurat terpusat (`data/contacts.js`): BPBD 112/(0643)21113, Damkar, Manggala Agni Daops Aceh, Puskesmas, RSUD Datu Beru, Pos PGA Burni Telong | Must |
| FR-X-5 | Laporan warga: taksonomi tipe = id hazard registry (`longsor, banjir, angin, karat, asap, kebakaran, gempa, abu, gas, badai, kekeringan`) | Must |
| FR-X-6 | Feature flag per hazard (env `HAZARDS_ENABLED`) | Should |
| FR-X-8 | Riwayat F4 diperluas: skema `hazard` (longsor/banjir/kebakaran/gempa/vulkanik/angin/asap), `emergencyStatus`; tambah karhutla Ketol & Celala 2026, Wih Pesam 2026, gempa 2013, status Burni Telong 2025–2026 | Must | 6 → ≥ 12 kejadian; kartu riwayat memfilter per hazard |
| FR-X-9 | Halaman "Tentang data & batasan": sumber + lisensi + arti "estimasi" + privasi + kontak koreksi | Must | Tautan dari setiap kartu |
| FR-X-10 | Arsip harian hazard di server (`server/data/hazard-archive/`) + skrip validasi musiman (hit rate, FAR) | Should | KPI di `08` terukur |
| FR-X-7 | Ekspor ringkasan teks (salin/bagikan ke WhatsApp) per sentra + "versi SMS" ≤ 160 karakter | Must |

### 5.10 Diseminasi — skema Alert bergaya CAP & kanal (iterasi 7)
| ID | Kebutuhan | MoSCoW | AC |
|---|---|---|---|
| FR-DIS-1 | `src/domain/alert.js`: `buildAlerts(hazardResults, location)` → objek `Alert` bergaya CAP 1.2 (`id, hazard, sender, sent, expires, status, msgType, urgency, severity, certainty, headline, description, instruction[], area, references.official[]`) hanya untuk level ≥ waspada | Must | Test skema + pemetaan level→severity (waspada=Moderate, bahaya=Severe, ekstrem=Extreme) |
| FR-DIS-2 | Renderer kanal: `renderTelegram(alert)`, `renderWhatsApp(alert)` (teks kampung id/Gayo, 3 tindakan), `renderSms(alert)` (≤ 160), `renderBpbd(alert)` (lengkap + degradasi) | Must | Snapshot per template |
| FR-DIS-3 | Anti-kebisingan: 1 pesan/hazard/sentra/6 jam kecuali eskalasi; `Update` saat berubah; `Cancel` saat turun ke rendah; state `server/data/alert-state.json` | Must | Test dedupe & eskalasi |
| FR-DIS-4 | `GET /api/alerts/feed?location=` mengembalikan daftar `Alert` aktif (JSON) dengan disclaimer "informasi pendukung, bukan peringatan resmi" | Should | — |
| FR-DIS-5 | Web Push opsional (VAPID; paket `web-push` sebagai dependensi opsional server; opt-in per sentra; hanya level ≥ bahaya) | Could | Fase 2 |
| FR-DIS-6 | Setiap pesan menyebut sumber resmi & tautan (BMKG/PVMBG/BNPB/KLHK) dan tidak memakai istilah status tanggap darurat | Must | Lint template |

## 6. Kebutuhan Non-Fungsional
| Kategori | Kebutuhan |
|---|---|
| Kinerja | TTFB API < 300 ms (cache hit); muat pertama mobile 3G < 5 s; Lighthouse PWA ≥ 90; **bundle ≤ 400 kB gzip tanpa Leaflet (gagal CI bila lebih)**; tambahan Fase 1 ≤ 40 kB gzip |
| Ketersediaan data | Setiap fetcher: timeout 15 s, retry 2×, SWR, `degraded` flag; dashboard **tidak pernah kosong** |
| Kuota API | Open-Meteo AQ: 15 lokasi × 48 call/hari = 720 (jauh di bawah 10.000/hari); FIRMS: 1 call/30 menit |
| Keamanan | Rate limit global per IP; kunci API hanya di server; tidak ada PII |
| Aksesibilitas | Kontras AA; warna ISPU disertai teks & ikon (jangan hanya warna) |
| Bahasa | id-ID default, Gayo untuk label & anjuran inti |
| Observabilitas | `/healthz` menampilkan status tiap sumber (ok/degraded/age) |
| Lisensi data | Atribusi Open-Meteo (CC BY 4.0), CAMS/Copernicus, NASA FIRMS, BMKG, KLHK |

## 7. Asumsi & Pertanyaan Terbuka
- A1: CAMS global (45 km) cukup representatif untuk tren asap kiriman; **tidak** untuk kebakaran lokal kecil → wajib dipadukan hotspot + laporan warga.
- Q1: SPBK harian Staklim Aceh — **belum terjawab secara formal**; dimitigasi dengan FWI in-house tervalidasi (prototipe iterasi 9) dan kemitraan P1 di `08` (ajukan bersama surat ke BPBD). Terbuka untuk Fase 2.
- Q2: Sensor PM2,5 murah di Takengon — **tidak ditemukan data publik**; dirancang endpoint `POST /api/sensors` + kemitraan Dinkes/DLH/sekolah (iterasi 8)
- Q3: Peta — **diputuskan**: SVG skematik dahulu (Fase 1), Leaflet lazy-load Fase 4; MapLibre ditolak (iterasi 9, ADR-24)
- Q4: Kemitraan & tata kelola — **dijawab** di `08-STAKEHOLDERS-GOVERNANCE.md` (BPBD P1, alur posko kecamatan, lisensi, privasi, KPI) (iterasi 10)

## 8. Rilis & Ukuran Keberhasilan
- **v2.0 (Fase 1)**: H-ASAP + H-API + HTH & banner iklim (H-KERING ringan) + registry + migrasi 3 hazard lama. Sukses bila: dipakai saat episode asap berikutnya, ≥ 20 laporan warga asap, 0 insiden "dashboard kosong".
- **v2.1 (Fase 2)**: H-GEMPA, **H-VULKANIK**, H-PETIR, H-BANJIR+, H-ANGIN+.
- **v2.2 (Fase 3)**: H-KERING, H-SUHU, peta.

*(Semua hazard telah dirinci; iterasi 7–10 menyempurnakan diseminasi, kesehatan, arsitektur, dan tata kelola.)*
