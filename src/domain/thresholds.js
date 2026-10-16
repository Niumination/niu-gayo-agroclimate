/**
 * Threshold & bobot model risiko — satu modul konfigurasi terdokumentasi (M3).
 * Tabel referensi lengkap + justifikasi literatur: docs/reference/THRESHOLDS.md.
 * Perubahan di sini HARUS disinkronkan dengan docs/reference/THRESHOLDS.md.
 */

export const TEMP = {
  optimalMin: 15.0,
  optimalMax: 24.0,
}

/** Karat daun — threshold RH/suhu sederhana (model lama, dipertahankan). */
export const RUST = {
  rhHigh: 85,
  rhMedium: 75,
  tempMin: 18,
  tempMax: 25,
}

/** Karat daun — model leaf wetness rolling 48 jam (M3), skor 0-100. */
export const RUST_LW = {
  wetnessThreshold: 70,  // % leaf_wetness_probability dianggap "daun basah"
  windowHours: 48,       // jendela rolling (jam)
  tempMin: 18,           // °C — jendela suhu infeksi optimal (FAO/BMKG Hemileia)
  tempMax: 25,
  // Bobot skor (total maksimum 100)
  streakLongHours: 6,    // basah beruntun >= 6 jam → 40 poin
  streakShortHours: 3,   // >= 3 jam → 20 poin
  streakLongPoints: 40,
  streakShortPoints: 20,
  wetLongHours: 24,      // total basah >= 24 jam dari 48 → 25 poin
  wetShortHours: 12,     // >= 12 jam → 15 poin
  wetLongPoints: 25,
  wetShortPoints: 15,
  tempLongHours: 6,      // basah & suhu optimal >= 6 jam → 35 poin
  tempShortHours: 3,
  tempLongPoints: 35,
  tempShortPoints: 20,
  levelSedang: 40,       // skor >= 40 → Sedang
  levelTinggi: 70,       // skor >= 70 → Tinggi
}

export const DRYING = {
  rainStop: 0.1,   // mm/jam — hujan di atas ini → tutup terpal
  solarLow: 150,   // W/m² DNI — di bawah ini kurang optimal
  rhHigh: 80,
}

/**
 * Longsor (M3) — skor 0-100 gabungan:
 * akumulasi hujan 24/72 jam + soil moisture antecedent + intensitas jam + faktor lereng.
 */
export const LANDSLIDE = {
  // Threshold lama (kompatibilitas peringatan harian)
  dailyRainWaspada: 25.0, // mm/hari
  dailyRainBahaya: 50.0,
  hourlyRainWaspada: 5.0, // mm/jam
  hourlyRainBahaya: 15.0,
  // Bobot skor M3 (total maksimum 100) — F2/ADR-9: antecedent 72 jam dinaikkan ke 35
  rain24Max: 75,   // mm — normalisasi kontribusi hujan 24 jam (bobot weightRain24)
  rain72Max: 150,  // mm — normalisasi antecedent hujan 72 jam (bobot weightAntecedent72)
  weightRain24: 25,        // F2: 35 → 25 (bobot dipindah ke antecedent)
  weightAntecedent72: 35,  // F2: 25 → 35 (antecedent 3 hari = prediktor terkuat)
  soilSaturation: 0.45, // m³/m³ soil_moisture_0_to_7cm dianggap jenuh (bobot 20, proporsional)
  soilDry: 0.15,        // di bawah ini tanah relatif kering (kontribusi ~0)
  intensityMax: 15,     // mm/jam puncak — normalisasi intensitas (bobot 10)
  // slopeClass (locations.js): 'landai' | 'berbukit' | 'curam'
  slopeFactor: { landai: 0, berbukit: 5, curam: 10 }, // poin tambahan (bobot 10)
  levelWaspada: 40,
  levelTinggi: 70,
}

/**
 * DAS Peusangan (M3) — indeks hujan hulu berbobot.
 * RENAME: ini INDEKS HUJAN, bukan status muka air (tidak ada telemetri publik).
 */
export const WATERSHED = {
  weights: {
    bintang: 0.35,     // hulu utama DAS Peusangan
    luttawar: 0.30,    // danau + daerah tangkapan
    kebayakan: 0.20,
    silihnara: 0.15,   // lembah sungai Angkup
  },
  indexWaspada: 30.0,  // indeks (mm ekuivalen berbobot, 24 jam)
  indexBahaya: 50.0,
}

export const WIND = {
  waspada: 20.0,  // km/jam (kecepatan rata-rata)
  bahaya: 35.0,
}

/** Angin M3: gusts lebih relevan untuk pohon roboh. */
export const WIND_GUST = {
  waspada: 40.0,  // km/jam
  bahaya: 60.0,
  ekstrem: 75.0,      // skala seragam registry: ≈ Beaufort 9 (strong gale 75–88 km/jam, kerusakan struktur ringan) — docs/reference/THRESHOLDS.md §13
  bmkgEkstrem: 45.0,  // FR-KONV-4: hembusan ≥ 45 km/jam (≥ 25 knot) = kriteria cuaca ekstrem BMKG → penanda `flags.bmkgExtreme`, bukan level
}

/** Ensemble (S3/M3): keyakinan probabilistik pada kartu peringatan. */
export const ENSEMBLE = {
  members: 50,
  thresholds: [25, 50], // mm/24 jam → P(hujan>X)
}

/* ======================= v2 Multi-bahaya (docs/dev/06-THRESHOLDS-MULTI-HAZARD.md) ======================= */

/**
 * H-ASAP — ISPU (Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020).
 * Batas atas indeks per kategori; tabel breakpoint konsentrasi ada di domain/hazards/ispu.js.
 * ISPU resmi memakai rata-rata 24 jam (PM2,5/PM10) — di sini dari CAMS (estimasi model, ~40 km).
 */
export const ISPU = {
  baik: 50,
  sedang: 100,
  tidakSehat: 200,
  sangatTidakSehat: 300,
  minHours24h: 18,      // jam data minimal agar rata-rata 24 jam dianggap lengkap (selain itu: partial)
  whoPm25Daily: 15,     // µg/m³ — pedoman WHO AQG 2021 rata-rata 24 jam
}

/**
 * H-ASAP — proksi kabut asap dari jarak pandang (Open-Meteo best_match `visibility`).
 * Hanya dievaluasi pada jendela siang agar kabut radiasi lembah tidak terbaca sebagai asap
 * (Takengon 15 Okt 2026: kabut 220–1.200 m pukul 05–09 WIB dengan RH 85–99 %, hilang pukul 10),
 * jam dengan RH ≥ fogRhMax dikecualikan (kabut/mist = tetes air, bukan partikel asap),
 * dan wajib didukung PM2,5/AOD (lihat 09-DATA-PREP §3). Eskalasi ke "bahaya" butuh persistensi ≥ 2 jam.
 */
export const HAZE = {
  dayStartHour: 10,     // WIB
  dayEndHour: 17,       // WIB (inklusif)
  fogRhMax: 90,         // % — jam dengan RH ≥ ini diabaikan (kabut radiasi/mist)
  visRinganKm: 5,       // < 5 km → kabut asap ringan
  visTebalKm: 2,        // < 2 km → tebal
  visSangatTebalKm: 1,  // < 1 km → sangat tebal (kriteria ekstrem BMKG KEP.009/2010)
  persistHours: 2,      // jam < visTebalKm yang dibutuhkan agar "sangat tebal" mengeskalasi ke bahaya
  pm25Support: 35,      // µg/m³ — jarak pandang rendah dianggap "asap" bila PM2,5 ≥ ini ...
  aodSupport: 0.5,      // ... atau AOD ≥ ini (selain itu dilabeli kabut/awan)
}

/**
 * H-API — Fire Weather Index System (Van Wagner 1987) & kelas FDRS Indonesia (de Groot et al. 2007 / BMKG SPBK).
 * ffmcConstant 147.27723 = cffdrs/Wang et al. 2015 (menyamai dataset uji resmi hingga 0,005); asli VW&P 1985 = 147.2.
 * Tampilan "ekstrem" FFMC wajib dikombinasikan dengan hotspot ≤ 10 km atau HTH ≥ 21 hari (kalibrasi lokal, iterasi 9).
 */
export const FWI = {
  ffmcConstant: 147.27723,
  defaultStart: { ffmc: 85, dmc: 6, dc: 15 },
  ffmc: { sedang: 73, tinggi: 78, ekstrem: 83 },   // ≥
  fwi: { sedang: 1, tinggi: 6, ekstrem: 13 },       // >
  isi: { sedang: 2, tinggi: 5, ekstrem: 6 },        // ≥
  dc: { sedang: 140, tinggi: 260, ekstrem: 350 },   // > — potensi asap bahan organik dalam (BMKG karhutla/dc; de Groot dkk. 2007)
  equator: true,                                    // Gayo 4–5° LU → panjang hari DMC 9 jam, faktor DC 1,4 (Lawson & Armitage 2008)
}

/**
 * H-API — hotspot NASA FIRMS (docs/dev/06 §2.2). Radius ke sentra: ≤ 10 km bahaya · ≤ 25 km waspada · ≤ 50 km informasi.
 * Saringan keyakinan: VIIRS `confidence` n/h (nominal/high); MODIS `confidence` ≥ 50 %. FRP ≥ 20 MW ditandai "intens".
 * Hotspot = indikasi anomali panas, belum tentu kebakaran (SiPongi/KLHK).
 */
export const HOTSPOT = {
  radiusBahayaKm: 10,
  radiusWaspadaKm: 25,
  radiusInfoKm: 50,
  frpIntenseMw: 20,
  modisMinConfidence: 50,
  viirsConfidence: ['n', 'h', 'nominal', 'high'],
  windowHours: 24,      // jendela utama
  trendHours: 48,       // jendela tren
}

/**
 * H-API — operasional FWI harian (docs/reference/THRESHOLDS.md §10): pengamatan "siang" diambil dari jam `obsHourWib`
 * (standar FWI: 12.00 waktu setempat; matahari tertinggi Takengon ≈ 12.32 WIB), hujan = akumulasi 24 jam hingga jam itu.
 * Spin-up dari arsip ERA5 (`spinUpDays`) agar DMC/DC tidak bergantung nilai awal; proyeksi `forecastDays` hari dari prakiraan ECMWF.
 * Status "Siaga Kebakaran Lokal" (FR-API-5): FFMC ≥ `siagaFfmc` DAN hotspot ≤ 25 km dalam 24 jam.
 */
export const FWI_OPS = {
  obsHourWib: 12,
  spinUpDays: 90,
  minSpinUpDays: 20,    // di bawah ini hasil ditandai "spin-up pendek"
  forecastDays: 2,
  historyDays: 7,
  siagaFfmc: 78,
}

/**
 * H-KERING — Hari Tanpa Hujan berturut-turut (HTH) kelas BMKG (hari dengan hujan < `rainDayMm` dihitung mundur
 * dari hari terakhir berdata; hari terakhir ≥ 1 mm → "HH", hari hujan). Level UI (docs/dev/06 §3):
 * 0–10 rendah · 11–20 waspada · 21–60 bahaya · > 60 ekstrem.
 */
export const HTH = {
  rainDayMm: 1,
  classes: { sangatPendek: 5, pendek: 10, menengah: 20, panjang: 30, sangatPanjang: 60 }, // batas atas (≤)
  waspada: 11,
  bahaya: 21,
  ekstrem: 61,
  projectionDays: 3,    // prakiraan harian yang digabung untuk "HTH proyeksi"
}

/** H-KERING — neraca air 30 hari Σ(P − ET0) mm (indikatif, kalibrasi lokal menyusul; FR-KER-3). */
export const WATER_BALANCE = {
  days: 30,
  waspada: -60,
  bahaya: -120,
}

/**
 * H-GEMPA (Fase 2.1; docs/reference/THRESHOLDS.md §15) — MMI indikatif di sentra dari relasi atenuasi Bakun & Wentworth (1997):
 * MMI = c0 + c1·M − c2·log10(R_hipo), R_hipo = √(jarak² + kedalaman²) (km), dibatasi ≥ minHypoKm.
 * Level: MMI < 3 rendah · III–IV waspada · V–VI bahaya · ≥ VII ekstrem. MMI resmi BMKG untuk tempat di Gayo menang bila lebih tinggi.
 * Jendela: ≤ 24 jam level penuh; 24–72 jam dibatasi waspada; > 72 jam informasi (rendah).
 * FR-GEMPA-4: M ≥ 5 & ≤ 100 km & ≤ 72 jam & ARI72 ≥ 100 mm → risiko longsor susulan.
 */
export const QUAKE = {
  ipe: { c0: 3.67, c1: 1.17, c2: 3.19 },
  minHypoKm: 5,
  mmi: { waspada: 3, bahaya: 5, ekstrem: 7 },
  windowH: { full: 24, decay: 72 },
  radiusKm: 300,
  landslide: { minMag: 5, maxKm: 100, ari72: 100 },
  pushMinMag: 4.5,     // FR-GEMPA-6 kirim segera bila M ≥ 4,5 ≤ 150 km atau dirasakan di Aceh Tengah/Bener Meriah
  pushMaxKm: 150,
}

/**
 * H-VULKANIK (Fase 2.2b; docs/reference/THRESHOLDS.md §16) — tingkat aktivitas PVMBG I/II/III/IV → rendah/waspada/bahaya/ekstrem
 * untuk sentra ≤ nearKm dari puncak; nearKm–farKm turun satu tingkat; > farKm informasi. Sektor bawah angin ±sectorHalfAngle°, ≤ sectorMaxKm.
 */
export const VOLCANO = {
  nearKm: 30,
  farKm: 60,
  sectorHalfAngle: 30,
  sectorMaxKm: 30,
}

/**
 * H-PETIR / H-ANGIN+ (Fase 2.3; docs/reference/THRESHOLDS.md §17) — konsensus ECMWF (CAPE, kode cuaca 95–99) × GFS (LI, CAPE), horizon 12 jam:
 * waspada CAPE ≥ 1.000 J/kg atau LI ≤ −3 · bahaya CAPE ≥ 2.000 atau kode 95–99 atau LI ≤ −6 ·
 * ekstrem = bahaya + (hembusan ≥ 45 km/jam atau hujan ≥ 20 mm/jam atau peringatan BMKG aktif).
 * Hujan es (kualitatif): kode 96/99 atau CAPE ≥ 2.500 & LI ≤ −6. Puting beliung (FR-KONV-4): bahaya + hembusan ≥ WIND_GUST.bmkgEkstrem.
 */
export const CONVECTIVE = {
  cape: { waspada: 1000, bahaya: 2000 },
  li: { waspada: -3, bahaya: -6 },
  gustEkstrem: 45,
  rainEkstrem: 20,
  hail: { cape: 2500, li: -6 },
  horizonH: 12,
}

/**
 * H-BANJIR+ (Fase 2.4; docs/reference/THRESHOLDS.md §18) — anomali debit GloFAS = debit / median klimatologi hari-dalam-tahun:
 * ≥ 2 waspada · ≥ 3 bahaya · ≥ 5 ekstrem · > p95 → minimal waspada. Pengubah: ARI72 ≥ 100 mm & level ≥ waspada → +1 tingkat.
 */
export const FLOOD_DISCHARGE = {
  waspada: 2,
  bahaya: 3,
  ekstrem: 5,
  ari72Bump: 100,
}

/**
 * H-KERING lanjutan (Fase 3.1; docs/reference/THRESHOLDS.md §20) — SPI McKee 1993 (baseline 1991–2020 ERA5 per lokasi):
 * ≤ −1 agak kering → waspada · ≤ −1,5 sangat kering → bahaya · ≤ −2 ekstrem. VPD siang (09–15 WIB) rata-rata 7 hari:
 * > 0,82 kPa waspada (pembungaan), > 1,5 kPa bahaya (indikatif, Yunnan 2025).
 */
export const SPI = { waspada: -1, bahaya: -1.5, ekstrem: -2 }
export const VPD = { waspada: 0.82, bahaya: 1.5, dayStartH: 9, dayEndH: 15, days: 7 }

/**
 * H-SUHU (Fase 3.2; docs/reference/THRESHOLDS.md §21) — stres dingin/embun upas & panas/aborsi bunga kopi Arabika:
 * dingin: Tmin ≤ 10 waspada · ≤ 6 bahaya · ≤ 4 + awan < 30 % + angin ≤ 5 km/jam + Td ≤ 2 °C → ekstrem (embun upas);
 *         elevasi ≥ 1.400 m: Tmin model dikoreksi −1 °C (genangan udara dingin lembah/plato, indikatif).
 * panas:  Tmax ≥ 28 waspada · ≥ 30 bahaya · ≥ 32 ekstrem; pada fase bunga VPD > 0,82 kPa → +1 tingkat.
 * Fase bunga indikatif Gayo (panen utama Okt–Jan, kecil Apr–Jun; bunga 7–9 bulan sebelumnya): Jan–Apr & Agu–Sep — sesuaikan per kebun.
 */
export const TEMP_STRESS = {
  cold: { waspada: 10, bahaya: 6, ekstrem: 4, cloudMax: 30, windMax: 5, dewMax: 2, highElevation: 1400, highElevationBias: -1 },
  heat: { waspada: 28, bahaya: 30, ekstrem: 32, vpdFlowering: 0.82 },
  floweringMonths: [1, 2, 3, 4, 8, 9],
}
