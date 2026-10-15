// Fase 2.2b (FR-VULK-1/2) — tingkat aktivitas gunung api dari halaman publik MAGMA Indonesia (PVMBG/Badan Geologi)
// + arah angin di puncak Burni Telong (Open-Meteo) untuk sektor "di bawah angin". Cache 60 menit; fallback nilai terakhir
// (server/data/volcano-last.json) + degraded bila struktur HTML berubah / fetch gagal. Tidak pernah throw.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { MAGMA_URL, OPEN_METEO } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'
import { BURNI_TELONG } from '../src/domain/geo.js'
import { downwindSentra } from '../src/domain/hazards/volcano.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const LAST_GOOD_FILE = path.join(__dirname, 'data', 'volcano-last.json')
export const LEVEL_LABEL = { 1: 'Normal', 2: 'Waspada', 3: 'Siaga', 4: 'Awas' }
const ROMAN_TO_NUM = { I: 1, II: 2, III: 3, IV: 4 }
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

/**
 * Parser halaman `tingkat-aktivitas`: tabel berisi seksi "Level IV (Awas)" … "Level I (Normal)"; tiap baris
 * "Nama Gunung - Provinsi <a href=…laporan/ID…>Lihat laporan</a>".
 * @returns {{ volcanoes: Record<string,{name,region,level,label,reportUrl}>, counts: Record<number,number>, ok: boolean }}
 */
export function parseMagmaLevels(html) {
  const out = { volcanoes: {}, counts: { 1: 0, 2: 0, 3: 0, 4: 0 }, ok: false }
  if (!html || typeof html !== 'string') return out
  const headRe = /Level\s+(IV|III|II|I)\s*\((Awas|Siaga|Waspada|Normal)\)/g
  const heads = []
  let m
  while ((m = headRe.exec(html))) heads.push({ idx: m.index, level: ROMAN_TO_NUM[m[1]], label: m[2] })
  if (!heads.length) return out
  // Seksi tabel = kemunculan yang diikuti baris gunung; ambil kemunculan terakhir per level (legenda muncul lebih dulu).
  const lastByLevel = new Map()
  for (const h of heads) lastByLevel.set(h.level, h)
  const sections = [...lastByLevel.values()].sort((a, b) => a.idx - b.idx)
  const rowRe = /<td>\s*([^<]+?)\s*-\s*([^<]+?)\s*<a href="([^"]*gunung-api\/laporan\/[^"]*)"/g
  sections.forEach((sec, i) => {
    const end = i + 1 < sections.length ? sections[i + 1].idx : html.length
    const chunk = html.slice(sec.idx, end)
    const countM = chunk.match(/rowspan="\d+">\s*(\d+)\s*<\/td>/)
    if (countM) out.counts[sec.level] = Number(countM[1])
    let r
    rowRe.lastIndex = 0
    while ((r = rowRe.exec(chunk))) {
      const name = stripTags(r[1])
      const region = stripTags(r[2])
      out.volcanoes[name.toLowerCase()] = { name, region, level: sec.level, label: sec.label, reportUrl: r[3].replace(/&amp;/g, '&') }
    }
  })
  out.ok = Object.keys(out.volcanoes).length > 0
  return out
}

/** Cari gunung tertentu (default Bur Ni Telong; cocokkan "telong"). */
export function findVolcano(parsed, needle = 'telong') {
  const key = Object.keys(parsed?.volcanoes ?? {}).find((k) => k.includes(needle.toLowerCase()))
  return key ? parsed.volcanoes[key] : null
}

function readLast(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
function writeLast(file, doc) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(doc))
  } catch { /* best-effort */ }
}

async function defaultFetchText(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { 'User-Agent': 'niu-gayo-agroclimate/2 (+https://cuaca.abstract.biz.id)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.text()
}

/** Angin di puncak (10 m + 850 hPa) dari Open-Meteo; null bila gagal. */
export async function fetchSummitWind({ fetchJson = defaultFetchJson, summit = BURNI_TELONG } = {}) {
  const params = new URLSearchParams({
    latitude: String(summit.lat),
    longitude: String(summit.lon),
    current: 'wind_speed_10m,wind_direction_10m',
    hourly: 'wind_speed_10m,wind_direction_10m,wind_speed_850hPa,wind_direction_850hPa',
    forecast_days: '1',
    timezone: 'Asia/Jakarta',
    models: 'ecmwf_ifs025',
  })
  const data = await fetchJson(`${OPEN_METEO}?${params}`)
  const h = data?.hourly ?? {}
  const times = h.time ?? []
  const idx = Math.max(0, data?.current?.time ? times.indexOf(data.current.time) : 0)
  const pick = (k) => (Array.isArray(h[k]) ? h[k][idx] ?? null : null)
  return {
    time: data?.current?.time ?? times[idx] ?? null,
    dir10m: data?.current?.wind_direction_10m ?? pick('wind_direction_10m'),
    speed10m: data?.current?.wind_speed_10m ?? pick('wind_speed_10m'),
    dir850: pick('wind_direction_850hPa'),
    speed850: pick('wind_speed_850hPa'),
    source: 'Open-Meteo ECMWF IFS (puncak Burni Telong)',
  }
}
async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/**
 * Status Burni Telong + angin puncak + sentra di bawah angin.
 * @returns {{ volcano:{name,level,label,roman,reportUrl,pageUrl,summit,radiusKm}, wind, downwind[], retrievedAt, source, degraded, stale?, error? }}
 */
export async function getVolcanoStatus({ fetchText = defaultFetchText, fetchJson = defaultFetchJson, url = MAGMA_URL, lastGoodFile = LAST_GOOD_FILE, now = new Date().toISOString(), locations = LOCATIONS, summit = BURNI_TELONG } = {}) {
  let volcano = null
  let error
  let counts = null
  try {
    const html = await fetchText(url)
    const parsed = parseMagmaLevels(html)
    counts = parsed.counts
    const v = findVolcano(parsed)
    if (!parsed.ok) error = 'struktur halaman MAGMA tidak dikenali'
    else if (!v) error = 'Bur Ni Telong tidak ditemukan di halaman MAGMA'
    else volcano = { name: v.name, region: v.region, level: v.level, label: v.label, roman: ['', 'I', 'II', 'III', 'IV'][v.level], reportUrl: v.reportUrl, observedAt: now }
  } catch (err) {
    error = err.message
  }
  let stale = false
  if (!volcano) {
    const last = readLast(lastGoodFile)
    if (last?.volcano) {
      volcano = { ...last.volcano }
      stale = true
    }
  } else writeLast(lastGoodFile, { volcano, savedAt: now })

  let wind = null
  try {
    wind = await fetchSummitWind({ fetchJson, summit })
  } catch (err) {
    error = error ? `${error}; angin: ${err.message}` : `angin: ${err.message}`
  }
  const windFrom = wind?.dir850 ?? wind?.dir10m ?? null
  const downwind = downwindSentra({ summit, windFromDeg: windFrom, locations })
  const radiusKm = volcano ? RADIUS_BY_LEVEL[volcano.level] ?? summit.radiusKm ?? null : null
  return {
    retrievedAt: now,
    source: 'MAGMA Indonesia — PVMBG / Badan Geologi (tingkat aktivitas)',
    pageUrl: url,
    degraded: !volcano || stale || !!error,
    stale: stale || undefined,
    error,
    counts,
    volcano: volcano ? { ...volcano, summit: { lat: summit.lat, lon: summit.lon }, radiusKm } : null,
    wind,
    downwind,
  }
}

/** Radius rekomendasi PVMBG (km) per tingkat — Level II Burni Telong: 3 km (rilis PVMBG; lihat docs/THRESHOLDS.md §16). Level III/IV: nilai umum, rujuk rilis terbaru. */
export const RADIUS_BY_LEVEL = { 1: 0, 2: 3, 3: 5, 4: 7 }
