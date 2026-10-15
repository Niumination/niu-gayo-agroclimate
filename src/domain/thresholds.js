/**
 * Threshold & bobot model risiko — satu modul konfigurasi terdokumentasi (M3).
 * Tabel referensi lengkap + justifikasi literatur: docs/THRESHOLDS.md.
 * Perubahan di sini HARUS disinkronkan dengan docs/THRESHOLDS.md.
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
  equator: true,                                    // Gayo 4–5° LU → panjang hari DMC 9 jam, faktor DC 1,4 (Lawson & Armitage 2008)
}
