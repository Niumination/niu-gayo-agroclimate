// Konfigurasi lokasi hulu DAS Peusangan + bobot (untuk /api/alerts).
// Bobot berdasarkan kontribusi curah hulu (Bintang = hulu utama, dll).
export const WATERSHED_LOCATIONS = [
  { id: 'bintang', weight: 0.35 },
  { id: 'luttawar', weight: 0.30 },
  { id: 'kebayakan', weight: 0.20 },
  { id: 'silihnara', weight: 0.15 },
]

export const PORT = Number(process.env.PORT || 7455)
export const PROXY_TTL_MIN = Number(process.env.PROXY_TTL_MIN || 10)
export const ENSEMBLE_TTL_MIN = Number(process.env.ENSEMBLE_TTL_MIN || 30)
export const ALERTS_TTL_MIN = Number(process.env.ALERTS_TTL_MIN || 10)

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble'
