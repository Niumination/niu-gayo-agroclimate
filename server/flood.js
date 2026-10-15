// Fase 2.4 H-BANJIR+ (FR-BJR-1/2/3) — debit GloFAS v4 (Open-Meteo Flood API) untuk 4 sel DAS Peusangan hulu:
// past 7 + forecast 7 hari, statistik ensemble (mean/median/min/max/p25/p75), klimatologi per hari-dalam-tahun
// (server/clim/flood-clim.json, dibangun scripts/build-flood-clim.mjs), anomali = debit / median klimatologi.
// Pola "tidak pernah throw": degraded + nilai terakhir per sel (server/data/flood-<cell>.json). Label: model hidrologi global — bukan muka air terukur.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOOD_CELLS, OPEN_METEO_FLOOD } from './config.js'
import { dischargeAnomaly, FLOOD_LABEL } from '../src/domain/hazards/flood.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const CLIM_FILE = path.join(__dirname, 'clim', 'flood-clim.json')
export const DATA_DIR = path.join(__dirname, 'data')
const DAILY_VARS = 'river_discharge,river_discharge_mean,river_discharge_median,river_discharge_max,river_discharge_min,river_discharge_p25,river_discharge_p75'

/** Hari-dalam-tahun 1..366 (29 Feb = 60; tahun non-kabisat melompati 60 agar konsisten). */
export function dayOfYear(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`)
  const m = d.getUTCMonth()
  const day = d.getUTCDate()
  const cum = [0, 31, 60, 91, 121, 152, 182, 213, 244, 274, 305, 335] // kumulatif tahun kabisat
  return cum[m] + day
}

function quantile(sorted, q) {
  if (!sorted.length) return null
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

/**
 * Klimatologi per hari-dalam-tahun dari deret harian: median & p95 dengan jendela ±window hari (melingkar).
 * @returns {{ median:number[], p95:number[], n:number, years:number, annualMedian:number }} indeks 0 = DOY 1
 */
export function buildClimatology(times, values, { window = 15 } = {}) {
  const byDoy = Array.from({ length: 366 }, () => [])
  let n = 0
  const years = new Set()
  times.forEach((t, i) => {
    const v = values[i]
    if (v == null || !Number.isFinite(v)) return
    byDoy[dayOfYear(t) - 1].push(v)
    years.add(t.slice(0, 4))
    n++
  })
  const median = []
  const p95 = []
  for (let d = 0; d < 366; d++) {
    const pool = []
    for (let k = -window; k <= window; k++) pool.push(...byDoy[(d + k + 366) % 366])
    pool.sort((a, b) => a - b)
    median.push(pool.length ? Math.round(quantile(pool, 0.5) * 100) / 100 : null)
    p95.push(pool.length ? Math.round(quantile(pool, 0.95) * 100) / 100 : null)
  }
  const allSorted = values.filter((v) => v != null && Number.isFinite(v)).sort((a, b) => a - b)
  return { median, p95, n, years: years.size, annualMedian: Math.round((quantile(allSorted, 0.5) ?? 0) * 100) / 100 }
}

export function loadClimatology(file = CLIM_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function lastFile(cellId, dir) { return path.join(dir, `flood-${cellId}.json`) }
function readLast(cellId, dir) {
  try { return JSON.parse(fs.readFileSync(lastFile(cellId, dir), 'utf8')) } catch { return null }
}
function writeLast(cellId, dir, doc) {
  try {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(lastFile(cellId, dir), JSON.stringify(doc))
  } catch { /* best-effort */ }
}

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Normalisasi respons Open-Meteo Flood → deret per sel + anomali harian (bila klimatologi ada). */
export function normalizeCell(cell, data, clim, { today } = {}) {
  const d = data?.daily ?? {}
  const time = d.time ?? []
  const pick = (k) => time.map((_, i) => (Array.isArray(d[k]) ? d[k][i] ?? null : null))
  const discharge = pick('river_discharge')
  const climMedian = time.map((t) => clim?.median?.[dayOfYear(t) - 1] ?? null)
  const climP95 = time.map((t) => clim?.p95?.[dayOfYear(t) - 1] ?? null)
  const anomalies = time.map((t, i) => dischargeAnomaly({ forecast: discharge[i], median: climMedian[i], p95: climP95[i] }))
  const todayStr = today ?? new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
  const todayIdx = Math.max(0, time.indexOf(todayStr))
  const rank = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  let peakIdx = todayIdx
  for (let i = todayIdx; i < time.length; i++) if ((anomalies[i]?.ratio ?? -1) > (anomalies[peakIdx]?.ratio ?? -1)) peakIdx = i
  const levelNext7 = anomalies.slice(todayIdx).reduce((best, a) => (rank[a.level] > rank[best] ? a.level : best), 'n/a')
  return {
    id: cell.id,
    name: cell.name,
    lat: cell.lat,
    lon: cell.lon,
    unit: d && data?.daily_units?.river_discharge ? data.daily_units.river_discharge : 'm³/s',
    daily: { time, discharge, mean: pick('river_discharge_mean'), median: pick('river_discharge_median'), max: pick('river_discharge_max'), min: pick('river_discharge_min'), p25: pick('river_discharge_p25'), p75: pick('river_discharge_p75'), climMedian, climP95, ratio: anomalies.map((a) => a.ratio), level: anomalies.map((a) => a.level) },
    todayIdx,
    today: { date: time[todayIdx] ?? null, discharge: discharge[todayIdx] ?? null, ...anomalies[todayIdx] },
    peak: { date: time[peakIdx] ?? null, discharge: discharge[peakIdx] ?? null, ...anomalies[peakIdx] },
    levelNext7,
    hasClimatology: !!clim?.median,
  }
}

/**
 * Debit 4 sel + anomali. `fetchJson` disuntikkan untuk test.
 * @returns {{ retrievedAt, source, degraded, degradedCells, cells[], worst:{cellId,level,ratio,date}|null, label }}
 */
export async function getFlood({ fetchJson = defaultFetchJson, cells = FLOOD_CELLS, climDoc = loadClimatology(), dataDir = DATA_DIR, now = new Date().toISOString(), today } = {}) {
  const out = []
  const degradedCells = []
  await Promise.all(
    cells.map(async (cell) => {
      const url = `${OPEN_METEO_FLOOD}?latitude=${cell.lat}&longitude=${cell.lon}&daily=${DAILY_VARS}&past_days=7&forecast_days=7&timezone=Asia%2FJakarta`
      let data = null
      let stale = false
      try {
        data = await fetchJson(url)
        writeLast(cell.id, dataDir, { savedAt: now, data })
      } catch (err) {
        const last = readLast(cell.id, dataDir)
        if (last?.data) {
          data = last.data
          stale = true
        }
        degradedCells.push(`${cell.id}: ${err.message}${stale ? ' (nilai terakhir)' : ''}`)
      }
      if (!data) return
      out.push({ ...normalizeCell(cell, data, climDoc?.cells?.[cell.id], { today }), stale })
    })
  )
  const order = new Map(cells.map((c, i) => [c.id, i]))
  out.sort((a, b) => order.get(a.id) - order.get(b.id))
  const rank = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  let worst = null
  for (const c of out) {
    const cand = rank[c.peak.level] >= rank[c.today.level] ? { cellId: c.id, name: c.name, ...c.peak } : { cellId: c.id, name: c.name, ...c.today }
    if (!worst || rank[cand.level] > rank[worst.level] || (rank[cand.level] === rank[worst.level] && (cand.ratio ?? 0) > (worst.ratio ?? 0))) worst = cand
  }
  return {
    retrievedAt: now,
    source: 'GloFAS v4 (Copernicus EMS) via Open-Meteo Flood API',
    label: FLOOD_LABEL,
    climatology: climDoc ? { period: climDoc.period, builtAt: climDoc.builtAt } : null,
    degraded: out.length === 0 || degradedCells.length > 0 || !climDoc,
    degradedCells,
    cells: out,
    worst,
  }
}
