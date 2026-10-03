/**
 * Threshold & ambang risiko — satu modul konfigurasi terdokumentasi.
 * Referensi: BMKG/FAO umum, disesuaikan agro-ekologi Arabika Gayo (M3 akan perluas).
 */
export const TEMP = {
  optimalMin: 15.0,
  optimalMax: 24.0,
}

export const RUST = {
  rhHigh: 85,
  rhMedium: 75,
  tempMin: 18,
  tempMax: 25,
}

export const DRYING = {
  rainStop: 0.1,   // mm/jam — hujan di atas ini → tutup terpal
  solarLow: 150,   // W/m² DNI — di bawah ini kurang optimal
  rhHigh: 80,
}

export const LANDSLIDE = {
  dailyRainWaspada: 25.0, // mm/hari
  dailyRainBahaya: 50.0,
  hourlyRainWaspada: 5.0, // mm/jam
  hourlyRainBahaya: 15.0,
}

export const WATERSHED = {
  // Indeks hujan DAS Peusangan (bukan telemetri muka air — tidak ada API publik)
  ids: ['luttawar', 'bintang', 'kebayakan', 'takengon'],
  dailyRainWaspada: 40.0,
}

export const WIND = {
  waspada: 20.0,  // km/jam
  bahaya: 35.0,
}

export const WIND_GUST = {
  waspada: 40.0,
  bahaya: 60.0,
}
