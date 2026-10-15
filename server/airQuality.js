/**
 * H-ASAP — fetcher kualitas udara (Open-Meteo Air Quality / CAMS global) + jarak pandang (best_match)
 * untuk GET /api/air-quality (Fase 1, item 1.1). Tanpa dependensi; fetchImpl bisa disuntik untuk uji.
 *
 * Pola degradasi seperti bmkg.js: getAirQualityForLocation() tidak pernah throw —
 * kegagalan menghasilkan { degraded:true, error, assessment:null } (kartu klien menampilkan "data tidak tersedia").
 * Jarak pandang bersifat best-effort: bila gagal, penilaian tetap berjalan tanpa proksi kabut asap.
 *
 * Catatan sumber: CAMS global resolusi ~0,4° (~40 km), diperbarui 2×/hari → TTL 60 menit (AQ_TTL_MIN).
 * Hasil berlabel "estimasi model, bukan ISPU resmi" (ISPU resmi: ispu.menlhk.go.id — tidak ada stasiun di Aceh Tengah).
 */
import { OPEN_METEO, OPEN_METEO_AIR_QUALITY } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'
import { assessAirQuality, summarizeAirQuality, MODEL_LABEL } from '../src/domain/hazards/airQuality.js'

export const AQ_HOURLY = 'pm2_5,pm10,carbon_monoxide,aerosol_optical_depth,dust'
export const AQ_CURRENT = 'pm2_5,pm10,carbon_monoxide,aerosol_optical_depth,dust,us_aqi'
export const VIS_HOURLY = 'visibility,relative_humidity_2m,direct_normal_irradiance'

export const AQ_SOURCE = {
  name: 'Open-Meteo Air Quality (CAMS global, ECMWF/Copernicus)',
  url: 'https://open-meteo.com/en/docs/air-quality-api',
  model: MODEL_LABEL,
  official: { label: 'ISPUNet KLHK', url: 'https://ispu.menlhk.go.id/' },
}

export function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id) ?? null
}

/** URL Open-Meteo Air Quality: 1 hari ke belakang (rata-rata 24 jam) + 3 hari prakiraan. */
export function buildAirQualityUrl(loc) {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    hourly: AQ_HOURLY,
    current: AQ_CURRENT,
    past_days: '1',
    forecast_days: '3',
    domains: 'cams_global',
    timezone: 'Asia/Jakarta',
  })
  return `${OPEN_METEO_AIR_QUALITY}?${params}`
}

/** URL prakiraan best_match untuk jarak pandang + RH (saring kabut) + DNI (ECMWF IFS tidak menyediakan `visibility`). */
export function buildVisibilityUrl(loc) {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    elevation: String(loc.elevation ?? ''),
    hourly: VIS_HOURLY,
    forecast_days: '2',
    models: 'best_match',
    timezone: 'Asia/Jakarta',
  })
  return `${OPEN_METEO}?${params}`
}

/** Bentuk ringkas deret AQ (hanya kolom yang dipakai domain). */
export function normalizeAirQuality(raw) {
  const h = raw?.hourly ?? {}
  const pick = (k) => (Array.isArray(h[k]) ? h[k] : [])
  return {
    current: raw?.current ?? null,
    hourly: {
      time: pick('time'),
      pm2_5: pick('pm2_5'),
      pm10: pick('pm10'),
      carbon_monoxide: pick('carbon_monoxide'),
      aerosol_optical_depth: pick('aerosol_optical_depth'),
      dust: pick('dust'),
    },
    units: raw?.hourly_units ?? null,
    grid: raw ? { lat: raw.latitude, lon: raw.longitude, elevation: raw.elevation } : null,
  }
}

export function normalizeVisibility(raw) {
  const h = raw?.hourly ?? {}
  return {
    time: Array.isArray(h.time) ? h.time : [],
    visibility: Array.isArray(h.visibility) ? h.visibility : [],
    relative_humidity_2m: Array.isArray(h.relative_humidity_2m) ? h.relative_humidity_2m : [],
    direct_normal_irradiance: Array.isArray(h.direct_normal_irradiance) ? h.direct_normal_irradiance : [],
  }
}

async function getJson(url, fetchImpl, label) {
  const resp = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'niu-gayo-agroclimate/2 (+https://cuaca.abstract.biz.id)' } })
  if (!resp.ok) throw new Error(`${label} HTTP ${resp.status}`)
  return resp.json()
}

export async function fetchAirQualityRaw(loc, { fetchImpl = fetch } = {}) {
  return getJson(buildAirQualityUrl(loc), fetchImpl, 'Open-Meteo air-quality')
}

export async function fetchVisibilityRaw(loc, { fetchImpl = fetch } = {}) {
  return getJson(buildVisibilityUrl(loc), fetchImpl, 'Open-Meteo best_match')
}

/** Waktu lokal WIB 'YYYY-MM-DDTHH:00' (untuk memilih jam "sekarang" di deret). */
export function nowIsoWib(date = new Date()) {
  const wib = new Date(date.getTime() + 7 * 3600_000)
  return `${wib.toISOString().slice(0, 13)}:00`
}

/**
 * Payload /api/air-quality?location=<id>. Tidak pernah throw.
 * { location, retrievedAt, source, degraded, error?, assessment, data:{current, hourly(visibility)} }
 */
export async function getAirQualityForLocation(id, { fetchImpl = fetch, now = new Date(), lang = 'id' } = {}) {
  const loc = typeof id === 'string' ? findLocation(id) : id
  const retrievedAt = new Date().toISOString()
  if (!loc) {
    return { location: null, retrievedAt, source: AQ_SOURCE, degraded: true, error: `Lokasi tidak dikenal: ${id}`, assessment: null }
  }
  const location = { id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon, elevation: loc.elevation }
  const [aqRes, visRes] = await Promise.allSettled([
    fetchAirQualityRaw(loc, { fetchImpl }),
    fetchVisibilityRaw(loc, { fetchImpl }),
  ])
  if (aqRes.status === 'rejected') {
    return { location, retrievedAt, source: AQ_SOURCE, degraded: true, error: aqRes.reason?.message ?? String(aqRes.reason), assessment: null }
  }
  const aq = normalizeAirQuality(aqRes.value)
  const visibility = visRes.status === 'fulfilled' ? normalizeVisibility(visRes.value) : null
  const nowIso = nowIsoWib(now)
  let assessment = null
  let error = null
  try {
    assessment = assessAirQuality({ current: aq.current, hourly: aq.hourly, visibility, nowIso, lang })
  } catch (err) {
    error = `penilaian gagal: ${err.message}`
  }
  const warnings = []
  if (visRes.status === 'rejected') warnings.push(`jarak pandang tidak tersedia: ${visRes.reason?.message ?? visRes.reason}`)
  if (assessment?.ispu?.partial) warnings.push(`rata-rata 24 jam parsial (${assessment.ispu.hours} jam)`)
  return {
    location,
    retrievedAt,
    source: AQ_SOURCE,
    degraded: !assessment,
    error: error ?? (assessment ? undefined : 'data kualitas udara kosong'),
    warnings,
    assessment,
    data: {
      current: aq.current,
      units: aq.units,
      grid: aq.grid,
      // deret 48 jam di sekitar "sekarang" untuk grafik kartu (hemat payload)
      hourly: sliceAround(aq.hourly, nowIso, 24, 24),
      visibility: visibility ? sliceAround(visibility, nowIso, 12, 24) : null,
    },
  }
}

/** Potong deret jam-an: `before` jam sebelum dan `after` jam sesudah nowIso. */
export function sliceAround(series, nowIso, before = 24, after = 24) {
  const times = series?.time ?? []
  let idx = times.indexOf(nowIso)
  if (idx < 0) idx = Math.max(0, times.findIndex((t) => t > nowIso) - 1)
  const start = Math.max(0, idx - before)
  const end = Math.min(times.length, idx + after + 1)
  const out = {}
  for (const [k, v] of Object.entries(series)) out[k] = Array.isArray(v) ? v.slice(start, end) : v
  return out
}

/**
 * Ringkasan semua sentra (?location=all): memakai getter ber-cache per lokasi agar tidak menembus kuota.
 * Dipanggil berurutan 3-sejajar untuk menghormati rate limit Open-Meteo.
 */
export async function getAirQualitySummary(getter, { concurrency = 3 } = {}) {
  const ids = LOCATIONS.map((l) => l.id)
  const results = []
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map((id) => getter(id)))
    settled.forEach((s, j) => {
      const id = chunk[j]
      const loc = findLocation(id)
      if (s.status === 'fulfilled' && s.value?.assessment) {
        results.push({ id, name: loc?.name ?? id, ...summarizeAirQuality(s.value.assessment), degraded: false })
      } else {
        results.push({ id, name: loc?.name ?? id, level: null, ispu: null, degraded: true })
      }
    })
  }
  const ok = results.filter((r) => !r.degraded)
  const worst = ok.length ? ok.reduce((a, b) => (b.ispu > a.ispu ? b : a)) : null
  return {
    retrievedAt: new Date().toISOString(),
    source: AQ_SOURCE,
    count: results.length,
    degradedCount: results.length - ok.length,
    worst: worst ? { id: worst.id, name: worst.name, ispu: worst.ispu, category: worst.category, level: worst.level } : null,
    locations: results,
  }
}
