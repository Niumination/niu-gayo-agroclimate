/**
 * H-KERING / H-API — deret harian & jam-an per sentra (FR-KER-1): Open-Meteo Archive (ERA5-Land/ERA5, tertinggal ~1–5 hari)
 * digabung prakiraan ECMWF `past_days=7` (mengisi celah arsip + proyeksi 3 hari). Tanpa dependensi; fetchImpl bisa disuntik.
 *
 * - getArchiveForLocation(id) tidak pernah throw: gagal → payload degraded (memakai salinan file terakhir bila ada).
 * - Salinan persisten `server/data/archive-<id>.json` (gitignored) agar restart server tidak memulai dari kosong.
 * - Satu panggilan arsip per lokasi per TTL (ARCHIVE_TTL_MIN, default 720 menit) + satu panggilan prakiraan (PROXY_TTL_MIN).
 * - Jam-an (temperature_2m, relative_humidity_2m, wind_speed_10m, precipitation) dipakai server/fireWeather.js untuk
 *   pengamatan siang FWI; harian (precipitation_sum, et0, Tmax/Tmin, RH mean, angin maks) untuk HTH & neraca air.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { OPEN_METEO, OPEN_METEO_ARCHIVE, ARCHIVE_DAYS, ARCHIVE_MAX_LAG_DAYS } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DATA_DIR = path.join(__dirname, 'data')

export const DAILY_VARS = 'precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,et0_fao_evapotranspiration'
export const HOURLY_VARS = 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation'
export const ARCHIVE_SOURCE = {
  name: 'Open-Meteo Historical Weather (ERA5-Land/ERA5, Copernicus) + ECMWF IFS 0.25°',
  url: 'https://open-meteo.com/en/docs/historical-weather-api',
  license: 'CC BY 4.0',
}

export function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id) ?? null
}

/** Tanggal WIB 'YYYY-MM-DD' untuk `date` (default sekarang). */
export function todayWib(date = new Date()) {
  return new Date(date.getTime() + 7 * 3600_000).toISOString().slice(0, 10)
}

/** Geser tanggal ISO n hari. */
export function shiftDate(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Selisih hari kalender b − a. */
export function diffDays(a, b) {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

export function buildArchiveUrl(loc, { now = new Date(), days = ARCHIVE_DAYS } = {}) {
  const end = shiftDate(todayWib(now), -1)
  const start = shiftDate(end, -(days - 1))
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    start_date: start,
    end_date: end,
    daily: DAILY_VARS,
    hourly: HOURLY_VARS,
    timezone: 'Asia/Jakarta',
  })
  return `${OPEN_METEO_ARCHIVE}?${params}`
}

/** Prakiraan ECMWF dengan 7 hari ke belakang (menutup lag arsip) + 3 hari ke depan (proyeksi HTH/FWI). */
export function buildRecentUrl(loc) {
  const params = new URLSearchParams({
    latitude: String(loc.lat),
    longitude: String(loc.lon),
    elevation: String(loc.elevation ?? ''),
    daily: DAILY_VARS,
    hourly: HOURLY_VARS,
    past_days: '7',
    forecast_days: '3',
    models: 'ecmwf_ifs025',
    cell_selection: 'nearest',
    timezone: 'Asia/Jakarta',
  })
  return `${OPEN_METEO}?${params}`
}

async function getJson(url, fetchImpl, label) {
  const resp = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'niu-gayo-agroclimate/2 (+https://cuaca.abstract.biz.id)' } })
  if (!resp.ok) throw new Error(`${label} HTTP ${resp.status}`)
  return resp.json()
}

export async function fetchArchiveRaw(loc, { fetchImpl = fetch, now = new Date() } = {}) {
  return getJson(buildArchiveUrl(loc, { now }), fetchImpl, 'Open-Meteo archive')
}
export async function fetchRecentRaw(loc, { fetchImpl = fetch } = {}) {
  return getJson(buildRecentUrl(loc), fetchImpl, 'Open-Meteo forecast (past_days)')
}

const DAILY_KEYS = DAILY_VARS.split(',')
const HOURLY_KEYS = HOURLY_VARS.split(',')

/** Indeks terakhir yang bernilai angka pada deret kunci utama (hujan harian / suhu jam-an); -1 bila tidak ada. */
function lastValidIndex(block, key) {
  const arr = block?.[key] ?? []
  for (let i = arr.length - 1; i >= 0; i--) if (typeof arr[i] === 'number' && Number.isFinite(arr[i])) return i
  return -1
}

/**
 * Gabungkan deret harian: arsip berlaku untuk tanggal ≤ tanggal arsip terakhir yang berdata;
 * prakiraan mengisi tanggal setelahnya ('model' untuk ≤ kemarin/hari ini, 'forecast' untuk > hari ini).
 * Keluaran: { time[], <var>[], source[] } terurut naik, tanpa duplikat.
 */
export function mergeDaily(archiveDaily, recentDaily, { today }) {
  const out = { time: [], source: [] }
  for (const k of DAILY_KEYS) out[k] = []
  const push = (block, i, source) => {
    out.time.push(block.time[i])
    out.source.push(source)
    for (const k of DAILY_KEYS) out[k].push(block[k]?.[i] ?? null)
  }
  const aLast = lastValidIndex(archiveDaily, 'precipitation_sum')
  const archiveEnd = aLast >= 0 ? archiveDaily.time[aLast] : null
  if (archiveDaily?.time) for (let i = 0; i <= aLast; i++) push(archiveDaily, i, 'archive')
  if (recentDaily?.time) {
    for (let i = 0; i < recentDaily.time.length; i++) {
      const t = recentDaily.time[i]
      if (archiveEnd && t <= archiveEnd) continue
      push(recentDaily, i, t > today ? 'forecast' : 'model')
    }
  }
  return { daily: out, archiveEnd }
}

/** Gabungkan deret jam-an dengan aturan yang sama (batas = jam arsip terakhir berdata). */
export function mergeHourly(archiveHourly, recentHourly, { today }) {
  const out = { time: [], source: [] }
  for (const k of HOURLY_KEYS) out[k] = []
  const push = (block, i, source) => {
    out.time.push(block.time[i])
    out.source.push(source)
    for (const k of HOURLY_KEYS) out[k].push(block[k]?.[i] ?? null)
  }
  const aLast = lastValidIndex(archiveHourly, 'temperature_2m')
  const archiveEnd = aLast >= 0 ? archiveHourly.time[aLast] : null
  if (archiveHourly?.time) for (let i = 0; i <= aLast; i++) push(archiveHourly, i, 'archive')
  if (recentHourly?.time) {
    for (let i = 0; i < recentHourly.time.length; i++) {
      const t = recentHourly.time[i]
      if (archiveEnd && t <= archiveEnd) continue
      push(recentHourly, i, t.slice(0, 10) > today ? 'forecast' : 'model')
    }
  }
  return { hourly: out, archiveEnd }
}

// ---- persistensi file ----
export function archiveFilePath(id, dataDir = DEFAULT_DATA_DIR) {
  return path.join(dataDir, `archive-${id}.json`)
}
export function saveArchiveFile(id, payload, dataDir = DEFAULT_DATA_DIR) {
  try {
    fs.mkdirSync(dataDir, { recursive: true })
    fs.writeFileSync(archiveFilePath(id, dataDir), JSON.stringify(payload))
    return true
  } catch {
    return false
  }
}
export function loadArchiveFile(id, dataDir = DEFAULT_DATA_DIR) {
  try {
    return JSON.parse(fs.readFileSync(archiveFilePath(id, dataDir), 'utf8'))
  } catch {
    return null
  }
}

/**
 * Payload arsip per lokasi. Tidak pernah throw.
 * { location, retrievedAt, source, degraded, warnings[], archiveEnd, lagDays, today,
 *   daily:{time,source,…}, hourly:{time,source,…} }
 */
export async function getArchiveForLocation(id, { fetchImpl = fetch, now = new Date(), dataDir = DEFAULT_DATA_DIR, persist = true } = {}) {
  const loc = typeof id === 'string' ? findLocation(id) : id
  const retrievedAt = new Date().toISOString()
  if (!loc) return { location: null, retrievedAt, source: ARCHIVE_SOURCE, degraded: true, error: `Lokasi tidak dikenal: ${id}`, daily: null, hourly: null }
  const location = { id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon, elevation: loc.elevation }
  const today = todayWib(now)
  const [aRes, rRes] = await Promise.allSettled([
    fetchArchiveRaw(loc, { fetchImpl, now }),
    fetchRecentRaw(loc, { fetchImpl }),
  ])
  const warnings = []
  let archive = aRes.status === 'fulfilled' ? aRes.value : null
  const recent = rRes.status === 'fulfilled' ? rRes.value : null
  if (!archive) warnings.push(`arsip ERA5 tidak tersedia: ${aRes.reason?.message ?? aRes.reason}`)
  if (!recent) warnings.push(`prakiraan past_days tidak tersedia: ${rRes.reason?.message ?? rRes.reason}`)

  let fromFile = false
  if (!archive) {
    const saved = loadArchiveFile(loc.id, dataDir)
    if (saved?.rawArchive) {
      archive = saved.rawArchive
      fromFile = true
      warnings.push(`memakai salinan arsip tersimpan ${saved.retrievedAt ?? ''}`.trim())
    }
  }
  if (!archive && !recent) {
    return { location, retrievedAt, source: ARCHIVE_SOURCE, degraded: true, error: warnings.join('; '), warnings, today, daily: null, hourly: null }
  }
  const { daily, archiveEnd } = mergeDaily(archive?.daily ?? null, recent?.daily ?? null, { today })
  const { hourly } = mergeHourly(archive?.hourly ?? null, recent?.hourly ?? null, { today })
  const lagDays = archiveEnd ? diffDays(archiveEnd, today) : null
  let degraded = false
  if (lagDays == null) {
    degraded = true
    warnings.push('tidak ada data arsip; hanya prakiraan 7 hari ke belakang')
  } else if (lagDays > ARCHIVE_MAX_LAG_DAYS) {
    degraded = true
    warnings.push(`arsip tertinggal ${lagDays} hari (> ${ARCHIVE_MAX_LAG_DAYS})`)
  }
  const payload = {
    location,
    retrievedAt,
    source: ARCHIVE_SOURCE,
    degraded,
    warnings,
    today,
    archiveEnd,
    lagDays,
    fromFile,
    grid: archive ? { lat: archive.latitude, lon: archive.longitude, elevation: archive.elevation } : null,
    daily,
    hourly,
  }
  if (persist && archive && !fromFile) saveArchiveFile(loc.id, { retrievedAt, rawArchive: pickRaw(archive) }, dataDir)
  return payload
}

/** Simpan hanya bagian yang dipakai (hemat disk). */
function pickRaw(archive) {
  return {
    latitude: archive.latitude,
    longitude: archive.longitude,
    elevation: archive.elevation,
    daily: archive.daily,
    hourly: archive.hourly,
  }
}
