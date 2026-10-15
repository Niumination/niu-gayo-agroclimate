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

## 2. Longsor — skor gabungan (M3, diupgrade F2/ADR-9)

Parameter: hujan 24 jam (mm), **antecedent** hujan 72 jam — ARI bila tersedia (mm), `soil_moisture_0_to_7cm` antecedent (m³/m³), intensitas puncak per jam, `slopeClass` per lokasi.

| Komponen | Normalisasi | Bobot maks |
|---|---|---|
| Hujan 24 jam | `/ 75 mm` | **25** (F2: 35→25) |
| Antecedent 72 jam (ARI) | `/ 150 mm` | **35** (F2: 25→35 — antecedent 3 hari = prediktor terkuat di literatur I-D curve) |
| Kejenuhan tanah | linier 0.15–0.45 m³/m³ | 20 |
| Intensitas puncak | `/ 15 mm/jam` | 10 |
| Lereng (`slopeClass`) | landai 0 / berbukit 5 / curam 10 | 10 |

Sumber antecedent (`source`): **`imerg`** (satelit NASA GPM IMERG Late daily, primer sejak 2026-10-04 — ARI 24j = hari terakhir, 72j = sum 3 hari, 7d = sum 7 hari; granule D-1, recency ≤ 48 jam) dengan **fallback otomatis** ke `model-ecmwf` (akumulasi hourly ECMWF) bila IMERG gagal (token Earthdata 401/expired, network, data < 3 hari) — field `fallbackReason` disertakan saat fallback. `modelAri24`/`modelAri72` tetap dihitung sebagai cross-check saat IMERG sukses.

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

| Sumber | Waspada | Bahaya | Ekstrem (Sprint 3) |
|---|---|---|---|
| `wind_speed_10m` (km/jam) | ≥ 20 | ≥ 35 | — |
| `wind_gusts_10m` (km/jam) | ≥ 40 | ≥ 60 | ≥ 75 (`WIND_GUST.ekstrem`, ≈ Beaufort 9 *strong gale*, kerusakan struktur ringan) |

Gusts lebih relevan untuk risiko pohon peneduh roboh. Tambahan Sprint 3: hembusan **≥ 45 km/jam (≥ 25 knot)** = kriteria cuaca ekstrem BMKG (Perka KEP.009/2010) → **penanda** `flags.bmkgExtreme` pada modul `angin` (ditampilkan di detail kartu/pesan), **bukan** pemicu level — level tetap 40/60/75 agar tidak menaikkan frekuensi "ekstrem" di dataran tinggi yang sering berangin.

## 5. Keyakinan Ensemble (S3/M3)

ECMWF `ecmwf_ifs025`, 50 member. Ditampilkan di kartu peringatan:
**P(hujan > 25 mm/24 jam)** dan **P(hujan > 50 mm/24 jam)** — persentase member yang melampaui ambang pada window pertama.

## 6. Threshold agro-kopi (tidak berubah dari M1/M2)

| Parameter | Nilai |
|---|---|
| Suhu optimal | 15–24°C |
| Penjemuran: hujan | > 0.1 mm/jam → tutup terpal |
| Penjemuran: radiasi | < 150 W/m² DNI atau RH > 80% → kurang optimal |

## 7. Kualitas udara — ISPU (v2 Fase 1, H-ASAP)

Sumber angka: **Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020**; implementasi `src/domain/hazards/ispu.js`, konstanta `thresholds.ISPU`.
Data: Open-Meteo Air Quality (**CAMS global, ~40 km**) → **estimasi model, bukan ISPU resmi** (tidak ada stasiun ISPU di Aceh Tengah). Selalu tampilkan label ini + tautan ISPUNet.

| Kategori | ISPU | PM2,5 24 jam (µg/m³) | PM10 24 jam | CO 8 jam | Level internal | Warna resmi |
|---|---|---|---|---|---|---|
| Baik | 0–50 | 0–15,4 | 0–50 | 0–4.000 | rendah | hijau |
| Sedang | 51–100 | 15,5–55,4 | 51–150 | 4.001–8.000 | rendah | biru |
| Tidak Sehat | 101–200 | 55,5–150,4 | 151–350 | 8.001–15.000 | waspada | kuning |
| Sangat Tidak Sehat | 201–300 | 150,5–250,4 | 351–420 | 15.001–30.000 | bahaya | merah |
| Berbahaya | > 300 | ≥ 250,5 (titik atas 500 = asumsi, H-9) | ≥ 421 | ≥ 30.001 | ekstrem | hitam |

- Sub-indeks: interpolasi linier per segmen `I = ((Ib−Ia)/(Xb−Xa))·(X−Xa)+Ia`, dibulatkan; **ISPU = maksimum** sub-indeks, parameter kritis dilaporkan.
- Rata-rata bergerak **24 jam** (PM2,5/PM10) dan **8 jam** (CO) yang berakhir pada jam berjalan; `partial` bila data valid < **18 jam** (`ISPU.minHours24h`). Nilai sesaat ditampilkan sebagai pembanding ("sesaat N").
- Catatan WHO AQG 2021: PM2,5 24 jam **15 µg/m³** (`ISPU.whoPm25Daily`) — ditandai bila terlampaui.
- Anjuran 4 kelompok (umum, rentan, pekerja kebun, sekolah & kampung) + kebijakan (PJJ, ruang bersih) dari `src/data/hazards/healthAdvice.json` (Kemenkes 2026, WHO).
- Kopi: **tunda penjemuran terbuka** bila ISPU ≥ 101 ATAU (AOD ≥ 1,0 DAN DNI siang maks < 300 W/m²); **tunda kerja kebun non-mendesak** bila ISPU ≥ 201.

## 8. Kabut asap — proksi jarak pandang (v2 Fase 1, H-ASAP)

`visibility` Open-Meteo `best_match` (ECMWF IFS tidak menyediakannya), konstanta `thresholds.HAZE`, fungsi `assessHaze()`.

| Parameter | Nilai | Alasan |
|---|---|---|
| Jendela evaluasi | **10–17 WIB** (`dayStartHour/dayEndHour`) | Kabut radiasi lembah Takengon 05–09 WIB (15 Okt 2026: 220–1.200 m, RH 85–99 %, hilang pukul 10) |
| Penyaring kabut/mist | jam dengan **RH ≥ 90 %** diabaikan (`fogRhMax`) | kabut = tetes air, asap = partikel kering |
| Dukungan wajib | **PM2,5 ≥ 35 µg/m³** ATAU **AOD ≥ 0,5** | tanpa dukungan → "jarak pandang rendah, kemungkinan kabut/awan", bukan asap |
| Ringan | jarak pandang minimum < **5 km** | — |
| Tebal | < **2 km** | level **waspada** |
| Sangat tebal | < **1 km** (kriteria ekstrem BMKG KEP.009/2010) | level **bahaya** bila **≥ 2 jam** < 2 km (`persistHours`), selain itu waspada |

Level kartu = maksimum(level kategori ISPU, level kabut asap).

## 9. Bahaya kebakaran — FWI System (v2 Fase 1, H-API)

`src/domain/hazards/fireWeather.js` (Van Wagner 1987), konstanta `thresholds.FWI`. Diverifikasi terhadap dataset uji resmi 48 hari (`cffdrs`): selisih ≤ 0,005 pada 6 indeks dengan konstanta FFMC **147,27723**.

| Kelas FDRS | FFMC (≥) | FWI (>) | ISI (≥) |
|---|---|---|---|
| Sedang | 73 | 1 | 2 |
| Tinggi | 78 | 6 | 5 |
| Ekstrem | 83 | 13 | 6 |

- Opsi ekuator (default Gayo, 4–5° LU): panjang hari DMC 9 jam, faktor DC 1,4 sepanjang tahun (Lawson & Armitage 2008).
- Kalibrasi lokal: kelas **"ekstrem" FFMC hanya ditampilkan bila hotspot ≤ 10 km atau HTH ≥ 21 hari**; selain itu diturunkan ke "tinggi" (`fireDangerClass`).
- Nilai awal spin-up: FFMC 85 / DMC 6 / DC 15 (standar), dijalankan dari arsip 90 hari (§10).
- **Drought Code (DC)** — kelas operasional BMKG (`FWI.dc`, halaman bmkg.go.id/cuaca/karhutla/dc; sama dengan FDRS Indonesia–Malaysia, de Groot dkk. 2007): **0–140 Rendah/basah · 141–260 Sedang/lembap · 261–350 Tinggi/kering** (pengawasan pembakaran diperketat) · **> 350 Ekstrem/sangat kering** (larangan pembakaran; episode kabut asap parah historis berada di rentang ini).

## 10. Operasional FWI harian — arsip, pengamatan siang, proyeksi (Sprint 2, item 1.5/1.9b)

`server/archive.js` + `server/fireWeather.js`, konstanta `thresholds.FWI_OPS`, dataset uji `tests/fireWeatherServer.test.js`.

| Parameter | Nilai | Alasan |
|---|---|---|
| Jam pengamatan | **12.00 WIB** (`obsHourWib`) | standar FWI = 12.00 waktu setempat; matahari tertinggi Takengon ≈ 12.32 WIB |
| Hujan harian | Σ presipitasi jam-an **24 jam hingga pukul 12.00** | definisi Van Wagner (hujan sejak pengamatan kemarin), bukan hujan kalender |
| Spin-up | **90 hari** arsip ERA5/Open-Meteo (`spinUpDays`); < 20 hari ditandai *spin-up pendek* (`minSpinUpDays`) | DC punya "memori" ±52 hari; tanpa spin-up kode bergantung nilai awal |
| Hari ini | dihitung sebagai **observasi hanya bila jam server ≥ 12.00 WIB** (basis "model" = prakiraan ECMWF jam berjalan) | sebelum itu kode terakhir = kemarin, hari ini masuk proyeksi |
| Proyeksi | **D+1, D+2** dari prakiraan ECMWF (`forecastDays`), dilanjutkan dari kode terakhir | horizon sama dengan proyeksi HTH; ditandai basis "forecast" |
| Riwayat kartu | 7 hari (`historyDays`) | tren mingguan |
| Celah arsip | arsip tertinggal **≤ 7 hari** diisi prakiraan `past_days=7`; lag > 7 hari → payload *degraded* | arsip Open-Meteo biasanya tertinggal 1–2 hari |
| Titik awal cadangan | file `server/data/fwi-state.json` (kode terakhir per sentra) bila arsip tidak tersedia; terakhir: nilai standar | server dapat restart tanpa kehilangan DC |

**Level kartu "Bahaya Kebakaran"** (`assessFireDanger`): kelas FDRS tampilan → rendah/sedang = **rendah**, tinggi = **waspada**, ekstrem = **bahaya**; hotspot ≤ 10 km (24 jam) → minimal **bahaya**; hotspot ≤ 25 km → minimal **waspada**; **ekstrem** bila FWI > 13 DAN hotspot ≤ 25 km. Gerbang FFMC "ekstrem" (§9) tetap berlaku.
**Siaga Kebakaran Lokal** (FR-API-5): FFMC ≥ **78** (`siagaFfmc`) DAN ≥ 1 hotspot ≤ 25 km dalam 24 jam.

## 11. Hotspot FIRMS (Sprint 2, item 1.4)

`server/firms.js` + `src/domain/hazards/hotspots.js`, konstanta `thresholds.HOTSPOT`. Sumber NRT: VIIRS S-NPP/NOAA-20/NOAA-21 (375 m) dan MODIS (1 km); bbox Aceh Tengah–Bener Meriah `96.1,3.9,97.5,5.2`; 2 hari; TTL 30 menit. Tanpa `FIRMS_MAP_KEY` layanan berjalan *degraded* (kartu tetap tampil dengan catatan).

| Parameter | Nilai | Alasan |
|---|---|---|
| Keyakinan | VIIRS **nominal/high** (`n`,`h`); MODIS **≥ 50 %** (`modisMinConfidence`) | keyakinan *low* VIIRS didominasi pantulan matahari/permukaan panas |
| Jendela utama / tren | **24 jam** / **48 jam** | NRT FIRMS tersedia ±3 jam setelah lintasan; 48 jam untuk tren |
| Radius bahaya | **≤ 10 km** dari sentra | asap tiba < 1 jam pada angin 10 km/j; resolusi lokasi FIRMS 375 m–1 km |
| Radius waspada | **≤ 25 km** | setara satu–dua kecamatan |
| Radius informasi | **≤ 50 km** | daftar "titik api terdekat" |
| FRP intens | **≥ 20 MW** (`frpIntenseMw`) | ambang kebakaran lahan intens (bukan pembakaran kecil) |

Level hotspot per sentra: ≤ 10 km → **bahaya**, ≤ 25 km → **waspada**, lainnya **rendah**; digabungkan dengan FWI di §10. Catatan: hotspot = anomali termal, **bukan konfirmasi kebakaran** (validasi SiPongi/Manggala Agni).

## 12. Kekeringan — Hari Tanpa Hujan & neraca air (Sprint 2, item 1.9b)

`src/domain/hazards/drought.js`, konstanta `thresholds.HTH`, `thresholds.WATER_BALANCE`; data dari arsip §10 (harian `precipitation_sum`, `et0_fao_evapotranspiration`).

| Parameter | Nilai | Alasan |
|---|---|---|
| Hari hujan | **≥ 1 mm** (`rainDayMm`) | definisi BMKG (hari < 1 mm dihitung tanpa hujan) |
| Perhitungan | mundur dari **hari terakhir berdata** (hari ini tidak dihitung karena belum lengkap) | konsisten dengan buletin HTH BMKG (dasarian) |
| Kelas BMKG | HH (hari hujan) · Sangat Pendek **1–5** · Pendek **6–10** · Menengah **11–20** · Panjang **21–30** · Sangat Panjang **31–60** · Ekstrem **> 60** | standar monitoring HTH BMKG |
| Level UI | **rendah ≤ 10 · waspada 11–20 · bahaya 21–60 · ekstrem > 60** (`waspada/bahaya/ekstrem`) | kopi arabika Gayo mulai stres air setelah ±3 minggu kering (docs/dev/06 §3) |
| Proyeksi | lanjutkan hitungan dengan prakiraan **hari ini … D+2** (`projectionDays`), berhenti di hari prakiraan ≥ 1 mm | peringatan dini "akan mencapai Panjang" |
| Neraca air 30 hari | Σ(P − ET0): **≤ −60 mm waspada**, **≤ −120 mm bahaya** (`WATER_BALANCE`) | indikatif; ET0 FAO-56 Open-Meteo; kalibrasi lokal menyusul (FR-KER-3) |

Level kartu "Kekeringan" = maksimum(level HTH, level neraca air).

## 13. Skala level seragam, hazard registry & Alert CAP (Sprint 3, item 0.3–0.5, 1.8, 1.8b)

**Registry** `src/domain/hazards/index.js` menjalankan 7 modul murni (`longsor, banjir, angin, karat, asap, kebakaran, kekeringan`) dengan kontrak ADR-12. Pemetaan skala domain → level seragam (`levels.js`: `n/a < rendah < waspada < bahaya < ekstrem`):

| Modul | Skala asal | rendah | waspada | bahaya | ekstrem | `n/a` |
|---|---|---|---|---|---|---|
| longsor | skor 0–100 (§2) | < 40 | 40–69 | ≥ 70 | ≥ 70 **dan** BMKG nowcast aktif | — |
| banjir (DAS Peusangan) | indeks mm (§3) | < 30 | 30–49 | ≥ 50 | — | lokasi tanpa bobot DAS |
| angin | gusts km/jam (§4) | < 40 | 40–59 | 60–74 | ≥ 75 | — |
| karat | risiko 0–100 (§6) | < 40 | 40–69 | ≥ 70 | — | — |
| asap | ISPU (§7) + proksi kabut (§8) + eskalasi laporan | Baik/Sedang | Tidak Sehat | Sangat Tidak Sehat | Berbahaya **atau** jarak pandang < 1 km | AQ gagal |
| kebakaran | FWI/FDRS (§9–11) | Rendah | Sedang | Tinggi | Ekstrem (FWI > 13 & hotspot ≤ 25 km) | — |
| kekeringan | HTH & neraca air (§12) | HTH ≤ 10 | 11–20 atau Σ ≤ −60 | 21–60 atau Σ ≤ −120 | HTH > 60 | arsip gagal |

Hasil `evaluateAll(ctx)` → `{results[] (terurut level), worst, active[] (≥ waspada), counts}`; dipakai `HazardPanel` (klien) dan `/api/hazards` (server). Feature flag: server `HAZARDS_ENABLED` (`'*'` atau daftar id), klien `VITE_HAZARDS_ENABLED` + `localStorage nga.hiddenHazards`.

**Alert CAP (`src/domain/alert.js`, ADR-22)** — satu objek per hazard × sentra:

| Field CAP 1.2 | Aturan |
|---|---|
| `identifier` | `nga-<lokasi>-<hazard>-YYYYMMDDTHHMMSS` (gabungan: `nga-multi<N>-…`) |
| `msgType` | `Alert` pertama kali · `Update` bila level naik atau pengingat ≥ 6 jam · `Cancel` saat turun di bawah ambang kirim (`n/a` tidak pernah men-`Cancel`) |
| `severity` | waspada → **Moderate** · bahaya → **Severe** · ekstrem → **Extreme** (rendah → Minor) |
| `urgency` | `Immediate` (Cancel → `Past`) |
| `certainty` | **Observed** bila ada pengamatan (siaga lokal FFMC+hotspot, eskalasi laporan warga, hotspot ≤ 25 km) · **Possible** bila payload *degraded* · selain itu **Likely** (model) |
| `expires` | +6 jam (kebakaran 12 h; kekeringan & karat 24 h) |
| `area` | lingkaran 5 km di koordinat sentra (`circle "lat,lon 5"`) |
| `sender` | `Niu Gayo Agro-Climate (informasi pendukung)` + parameter `disclaimer` |
| `official[]` | rujukan peringatan **resmi** BMKG yang aktif untuk Aceh saat siklus berjalan (judul + URL CAP BMKG) — wajib ikut bila ada |

Renderer: Telegram (Markdown), WhatsApp-teks, SMS ≤ 160 karakter (`NGA <Sentra> HH:MM: <LEVEL> <bahaya>. <anjuran> Info model,bkn resmi. Darurat 112`), CAP XML (`/api/alerts/feed?format=cap&id=`, untuk ekspor/interoperabilitas BPBD — bukan feed publik yang dipromosikan).

## 14. Anti-kebisingan diseminasi (Sprint 3, item 1.8b)

| Parameter | Nilai | Catatan |
|---|---|---|
| Ambang kirim `PUSH_POLICY` | longsor/banjir/angin/asap/kebakaran/**gempa** **≥ waspada** · kekeringan/**vulkanik/badai/suhu** **≥ bahaya** · karat **tidak pernah** (agronomis, bukan darurat) | `shouldPush(hazardId, level)`; gempa/vulkanik: `eventId` baru → Alert segera (Fase 2) |
| Jeda minimum | **6 jam** per (sentra × hazard) kecuali level naik | `MIN_INTERVAL_H`; state `server/data/alert-state.json` |
| Penggabungan | ≥ **3** sentra dengan hazard + level + msgType sama dalam satu siklus → 1 pesan gabungan | `GROUP_MIN` |
| Batas per siklus | **12** pesan (sisanya dicoba siklus berikutnya; state tidak diperbarui bila kirim gagal) | `maxPerCycle` |
| Siklus | timer systemd `agroclimate-alerts.timer` tiap 30 menit → `POST /api/alerts/run` (header `x-cron-token`) | `scripts/alerts-cron.mjs` |

**Banner konteks iklim (1.9c)** — `climateOutlook.json` ditampilkan dengan verifikasi lokal dari `/api/drought`: hujan 30 hari **≥ 150 mm & HTH ≤ 5** → "basah, prospek kemarau regional belum terasa (asap kemungkinan kiriman)"; hujan 30 hari **< 60 mm atau HTH > 20** → "kering, selaras prospek"; selain itu "sedang". Lewat `validUntil` → banner meminta pembaruan manual.

**Peta skematik (1.6b)** — warna sentra = level tertinggi dari `/api/hazards?location=all`; lingkaran radius **3 km** Burni Telong (PVMBG Level II) hanya penanda zona rekomendasi, bukan pemodelan bahaya; hotspot ≤ 25 km dari sentra terpilih diplot bila FIRMS aktif.

## 15. Gempa bumi — H-GEMPA (Fase 2.1/2.2/2.2c)

Sumber: BMKG TEWS (`gempadirasakan`, `autogempa`, `gempaterkini`, cache **2 menit**) + riwayat USGS FDSN 10 tahun (statis, `src/data/hazards/quakeHistory.json`, 82 kejadian M ≥ 4,5 ≤ 150 km). Konstanta: `QUAKE` di `thresholds.js`.

| Aturan | Nilai |
|---|---|
| Gempa relevan | episenter **≤ 300 km** dari Takengon (4,63 N 96,85 E) **atau** kolom *Dirasakan* menyebut kabupaten/kota Aceh |
| MMI indikatif per sentra | IPE sederhana pada jarak hiposenter: `MMI = 3,67 + 1,17·M − 3,19·log10(R_hipo)`, `R_hipo = √(d² + h²)`, min 5 km; dilabeli **indikatif** — bila BMKG memberi MMI kota terdekat, pakai itu |
| Level | MMI < III → rendah · **III–IV** waspada · **V–VI** bahaya · **≥ VII** ekstrem; berlaku **24 jam** penuh, 24–72 jam dibatasi maks waspada (pengingat susulan) |
| Gempa × longsor (FR-GEMPA-4) | M ≥ 5 **dan** ≤ 100 km **dan** ≤ 72 jam **dan** ARI72 ≥ 100 mm → `flags.landslideAfterQuake`; aturan interaksi §19 menaikkan longsor satu tingkat (maks bahaya) |
| Diseminasi | kejadian baru (`eventId = bmkg-<ISO waktu>`) → **Alert segera** tanpa jeda 6 jam; kirim bila M ≥ 4,5 ≤ 150 km atau terasa Aceh Tengah/Bener Meriah; urgency Immediate, expires 24 jam; timer cepat `agroclimate-alerts-fast.timer` (**5 menit**, `--only gempa,vulkanik`) |
| Laporan warga `gempa` | `kind` lemah (II–III) · sedang (IV–V) · kuat (≥ VI) — skala awam → MMI |

Uji konsistensi: Gayo 2 Juli 2013 M6,1 kedalaman 10 km, sentra ≤ 10 km → MMI ≥ VI (bahaya) — sesuai laporan kerusakan Ketol/Kute Panang.

## 16. Gunung api — H-VULKANIK Burni Telong (Fase 2.2b)

Sumber: MAGMA Indonesia (PVMBG) halaman tingkat aktivitas (HTML, cache **60 menit**, nilai terakhir bila gagal + `VOLCANO_OVERRIDE_PATH`). Konstanta `VOLCANO`.

| Tingkat PVMBG | Level UI (≤ 30 km) | 30–60 km | > 60 km | Radius rekomendasi |
|---|---|---|---|---|
| I Normal | rendah | rendah | rendah | — |
| II Waspada (status 2025–2026) | waspada | rendah | rendah | 3 km |
| III Siaga | bahaya (+ banner global) | waspada | rendah | 5 km |
| IV Awas | ekstrem | bahaya | rendah | 7 km |

Sektor **bawah angin**: arah menuju = arah angin 10 m puncak + 180°; sentra dalam ±30° dan ≤ 30 km ditandai (`downwind`). Takengon ≈ 15,7 km, azimut ≈ 170° dari puncak (bawah angin saat angin dari utara). Laporan warga `abu` (tipis|tebal) & `gas` (ringan|menyengat) menaikkan prioritas tampil, tidak mengubah level resmi. `eventId = magma-level-N` → perubahan tingkat dikirim segera (Expected, 24 jam, push ≥ bahaya).

## 17. Petir & badai konvektif — H-PETIR / H-ANGIN+ (Fase 2.3)

Sumber: Open-Meteo ECMWF IFS 0,25° (`cape`, `weather_code`, `precipitation`, `wind_gusts_10m`) + GFS seamless (`cape`, `lifted_index`, `convective_inhibition`), cache **30 menit**; GFS gagal → `degraded`, ECMWF saja. Konstanta `CONVECTIVE`; horizon **12 jam** dari jam sekarang.

| Level | ECMWF (per jam) | GFS (per jam) | Pengubah |
|---|---|---|---|
| waspada | CAPE ≥ **1.000** J/kg | LI ≤ **−3** atau CAPE ≥ 1.000 | — |
| bahaya | CAPE ≥ **2.000** atau kode WMO **95–99** | LI ≤ **−6** atau CAPE ≥ 2.000 | — |
| ekstrem | bahaya **+** (hembusan ≥ **45** km/jam **atau** hujan ≥ **20** mm/jam **atau** peringatan dini BMKG aktif) | | |

Konsensus: level = **sinyal terkuat** dari kedua model; `agreement:false` bila level puncak ECMWF ≠ GFS (ditampilkan di kartu). **Hujan es** (kualitatif): kode 96/99 **atau** CAPE ≥ 2.500 & LI ≤ −6. **Puting beliung** (FR-KONV-4): bahaya + hembusan ≥ 45 km/jam (= kriteria cuaca ekstrem BMKG). Laporan warga `badai` (petir | hujan_es | puting_beliung). CAP: Met, Immediate, expires 6 jam, push ≥ bahaya.

## 18. Banjir & luapan — H-BANJIR+ Indeks Luapan v2 (Fase 2.4)

Sumber: GloFAS v4 (Copernicus EMS) via Open-Meteo Flood API, **4 sel** DAS Peusangan hulu — outlet Lut Tawar 4,625/96,875 · Takengon 4,625/96,825 · Bintang 4,575/96,925 · Angkup 4,625/96,725 — past 7 + forecast 7 hari, statistik ensemble; cache **6 jam**, nilai terakhir per sel bila gagal. Klimatologi per hari-dalam-tahun (median & p95, jendela ±15 hari) dari deret 1997–2025 → `server/clim/flood-clim.json` (`npm run clim:flood`, 1×/tahun). Konstanta `FLOOD_DISCHARGE`.

| Komponen | Aturan |
|---|---|
| Anomali debit | rasio = debit / median klimatologi hari itu: **≥ 2** waspada · **≥ 3** bahaya · **≥ 5** ekstrem · **> p95** → minimal waspada; level sel = terburuk dalam 7 hari ke depan |
| Indeks hujan hulu (lama) | bobot Bintang 0,35 · Lut Tawar 0,30 · Kebayakan 0,20 · Silih Nara 0,15; ≥ 30 waspada · ≥ 50 bahaya |
| Indeks Luapan v2 | **maks(level hujan hulu, level anomali debit)**; bila ≥ waspada **dan ARI72 ≥ 100 mm → +1 tingkat** (maks ekstrem, `flags.bumpedByAri`) |
| Pemetaan sentra → sel | Lut Tawar, Kebayakan → outlet · Takengon, Bebesen, Pegasing, Bies → takengon · Bintang → bintang · Silih Nara, Ketol, Kute Panang → angkup; **Celala, Rusip Antara (Krueng Woyla/Tripa) & Atu Lintang, Jagong Jeget, Linge (Jambo Aye) berada di DAS lain → n/a** |
| Label wajib | "Model hidrologi global (GloFAS ~5 km) — bukan muka air terukur" |

PetaBencana.id (Fase 2.4b, `/api/external-reports`): laporan Aceh 7 hari, disaring kode BPS **1104/1117/1113** atau ≤ **60 km** dari Takengon; atribusi **CC BY-NC 4.0** wajib tampil; data komunitas belum terverifikasi, tidak mengubah level.

## 19. Interaksi lintas-bahaya (Fase 2.5, FR-X-2)

`applyInteractions()` berjalan di akhir `evaluateAll`; hasil `interactions[]` ikut payload `/api/hazards` dan HazardPanel.

| Aturan | Syarat | Efek |
|---|---|---|
| `gempa_tanah_jenuh` | `flags.landslideAfterQuake` atau (gempa pemicu M ≥ 5 ≤ 100 km & (ARI72 ≥ 100 mm atau skor longsor ≥ 40)) | **longsor +1 tingkat (maks bahaya)**, `flags.bumpedBy`, `baseLevel` |
| `asap_hujan_lebat` | asap ≥ waspada & (hujan 24 jam ke depan ≥ 20 mm atau intensitas ≥ 10 mm/jam) | catatan (jarak pandang, limpasan abu, asap tercuci 6–12 jam) |
| `kekeringan_ffmc` | kekeringan ≥ waspada & FFMC ≥ 78 | **kebakaran +1 (maks waspada)** bila masih rendah; catatan siaga karhutla |
| `badai_longsor` | badai ≥ bahaya & longsor ≥ waspada | catatan (hujan intens singkat → longsor dangkal/banjir bandang) |
| `vulkanik_hujan_lahar` | vulkanik ≥ bahaya & hujan 24 jam ≥ 20 mm | catatan lahar hujan |

## 20. Kekeringan lanjutan — SPI & VPD (Fase 3.1)

| Indikator | Definisi | Ambang |
|---|---|---|
| SPI-1 / SPI-3 | McKee dkk. 1993: total 30/90 hari observasi terakhir vs distribusi **gamma** (MLE Thom 1958, koreksi nol `H = q + (1−q)G`) total 1/3-bulan berjalan yang berakhir di bulan kalender sama; baseline **ERA5 1991–2020** per lokasi (`server/clim/spi-baseline.json`, `npm run clim:spi`); nilai dibatasi ±3 | ≤ **−1** agak kering → waspada · ≤ **−1,5** sangat kering → bahaya · ≤ **−2** ekstrem; menaikkan level `kekeringan` bila lebih buruk dari HTH/neraca |
| VPD siang | rata-rata VPD 09–15 WIB **7 hari** observasi (Tetens dari T & RH arsip) | > **0,82** kPa waspada pembungaan · > **1,5** kPa bahaya — indikator, tidak mengubah level agregat |

## 21. Suhu ekstrem kopi — H-SUHU (Fase 3.2)

Konstanta `TEMP_STRESS`; input `weatherFeatures().thermal` (Tmin/Tmax 3 hari, malam 19–07 WIB: awan, angin, titik embun; VPD siang 09–15).

| Sisi | Ambang | Syarat tambahan |
|---|---|---|
| Dingin | Tmin ≤ **10** waspada · ≤ **6** bahaya · ≤ **4** ekstrem = **potensi embun upas** | ekstrem hanya bila **awan < 30 %**, **angin ≤ 5 km/jam**, **Td ≤ 2 °C** pada jam terdingin; elevasi ≥ **1.400 m** → Tmin model **−1 °C** (genangan udara dingin; Jagong Jeget, Atu Lintang, Kute Panang) |
| Panas | Tmax ≥ **28** waspada · ≥ **30** bahaya · ≥ **32** ekstrem | fase bunga **& VPD siang > 0,82 kPa → +1 tingkat**; fase bunga indikatif Gayo **Jan–Apr & Agu–Sep** (`floweringMonths`, sesuaikan per kebun) |

Kalender musiman diperluas (Fase 3.4): fase kering **Jul–Agu puncak**, Jun & Sep sedang; jendela embun upas Jun–Sep; El Niño/IOD+ aktif (`climateOutlook.json` belum kedaluwarsa) → Sep–Nov naik satu tingkat kering & fase hujan Okt–Nov turun satu tingkat; La Niña/IOD− → sebaliknya.

## Disclaimer

Semua ambang merupakan **model prakiraan probabilistik** berbasis Open-Meteo ECMWF (dan CAMS global untuk kualitas udara), belum tervalidasi lapangan secara sistematis. Tampilkan selalu keyakinan ensemble + sumber & waktu data; validasi bersama BPBD Aceh Tengah / penyuluh sebelum dipakai sebagai dasar keputusan mitigasi.
