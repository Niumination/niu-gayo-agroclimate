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
// F1: WN2 kuota lebih ketat → cache lebih agresif (30 menit).
export const WN2_TTL_MIN = Number(process.env.WN2_TTL_MIN || 30)
// F5: nowcast BMKG diperbarui berkala → cache 10 menit.
export const BMKG_TTL_MIN = Number(process.env.BMKG_TTL_MIN || 10)
// H-ASAP: CAMS global diperbarui ~2×/hari → cache 60 menit (docs/dev/04-DATA-SOURCES.md).
export const AQ_TTL_MIN = Number(process.env.AQ_TTL_MIN || 60)

export const OPEN_METEO = 'https://api.open-meteo.com/v1/forecast'
export const OPEN_METEO_ENSEMBLE = 'https://ensemble-api.open-meteo.com/v1/ensemble'
export const OPEN_METEO_AIR_QUALITY = process.env.OPEN_METEO_AIR_QUALITY || 'https://air-quality-api.open-meteo.com/v1/air-quality'
// H-KERING / H-API: arsip ERA5 (Open-Meteo) diperbarui harian → cache 12 jam; prakiraan past_days memakai PROXY_TTL_MIN.
export const ARCHIVE_TTL_MIN = Number(process.env.ARCHIVE_TTL_MIN || 720)
export const ARCHIVE_DAYS = Number(process.env.ARCHIVE_DAYS || 92)          // ≥ 61 agar kelas HTH "Ekstrem" (> 60 hari) terdeteksi
export const ARCHIVE_MAX_LAG_DAYS = Number(process.env.ARCHIVE_MAX_LAG_DAYS || 7)
export const OPEN_METEO_ARCHIVE = process.env.OPEN_METEO_ARCHIVE || 'https://archive-api.open-meteo.com/v1/archive'
// H-API hotspot NASA FIRMS (kunci gratis: https://firms.modaps.eosdis.nasa.gov/api/map_key/; tugas manusia H-1).
export const FIRMS_MAP_KEY = process.env.FIRMS_MAP_KEY || ''
export const FIRMS_TTL_MIN = Number(process.env.FIRMS_TTL_MIN || 30)
export const FIRMS_BBOX = process.env.FIRMS_BBOX || '96.1,3.9,97.5,5.2'    // Aceh Tengah + buffer ~50 km (W,S,E,N)
export const FIRMS_SOURCES = (process.env.FIRMS_SOURCES || 'VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,MODIS_NRT').split(',').map((s) => s.trim()).filter(Boolean)
export const FIRMS_DAYS = Number(process.env.FIRMS_DAYS || 2)
export const FIRMS_API = process.env.FIRMS_API || 'https://firms.modaps.eosdis.nasa.gov/api/area/csv'
// v2 Fase 0 (ADR-12) — feature flag registry bahaya: daftar id dipisah koma ("" / "*" = semua).
// id valid: longsor, banjir, angin, asap, kebakaran, kekeringan, karat (src/domain/hazards/index.js).
export const HAZARDS_ENABLED = process.env.HAZARDS_ENABLED ?? '*'
// Fase 1.10b — arsip harian level bahaya per sentra (server/data/hazard-archive/YYYY-MM-DD.json), TTL evaluasi gabungan.
export const HAZARDS_TTL_MIN = Number(process.env.HAZARDS_TTL_MIN || 10)
