// Fase 2.3 H-PETIR (FR-KONV-1) — indeks konvektif per lokasi: ECMWF IFS (cape, weather_code, precipitation, showers, wind_gusts_10m)
// + GFS seamless (cape, lifted_index, convective_inhibition). Cache 30 menit. GFS gagal → degraded:true, pakai ECMWF saja.
import { OPEN_METEO } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

export function ecmwfUrl(loc, base = OPEN_METEO) {
  const p = new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), hourly: 'cape,weather_code,precipitation,showers,wind_gusts_10m', current: 'weather_code,wind_gusts_10m', forecast_days: '2', timezone: 'Asia/Jakarta', models: 'ecmwf_ifs025', cell_selection: 'nearest' })
  return `${base}?${p}`
}
export function gfsUrl(loc, base = OPEN_METEO) {
  const p = new URLSearchParams({ latitude: String(loc.lat), longitude: String(loc.lon), hourly: 'cape,lifted_index,convective_inhibition', forecast_days: '2', timezone: 'Asia/Jakarta', models: 'gfs_seamless', cell_selection: 'nearest' })
  return `${base}?${p}`
}

/** Gabungkan dua respons (deret jam ECMWF menjadi acuan; GFS dicocokkan per stempel waktu). */
export function mergeConvective(ecmwf, gfs) {
  const h = ecmwf?.hourly ?? {}
  const time = h.time ?? []
  const g = gfs?.hourly ?? {}
  const gIdx = new Map((g.time ?? []).map((t, i) => [t, i]))
  const fromG = (k) => time.map((t) => (gIdx.has(t) && Array.isArray(g[k]) ? g[k][gIdx.get(t)] ?? null : null))
  return {
    time,
    nowTime: ecmwf?.current?.time ?? time[0] ?? null,
    capeEcmwf: time.map((_, i) => h.cape?.[i] ?? null),
    weatherCode: time.map((_, i) => h.weather_code?.[i] ?? null),
    rain: time.map((_, i) => h.precipitation?.[i] ?? null),
    showers: time.map((_, i) => h.showers?.[i] ?? null),
    gusts: time.map((_, i) => h.wind_gusts_10m?.[i] ?? null),
    capeGfs: fromG('cape'),
    liGfs: fromG('lifted_index'),
    cinGfs: fromG('convective_inhibition'),
    hasGfs: (g.time ?? []).length > 0,
  }
}

/**
 * @returns {{ location, retrievedAt, degraded, error?, sources, hourly }}
 */
export async function getConvective(id, { fetchJson = defaultFetchJson, now = new Date().toISOString(), locations = LOCATIONS } = {}) {
  const loc = locations.find((l) => l.id === id)
  if (!loc) throw new Error(`Lokasi tidak dikenal: ${id}`)
  const [e, g] = await Promise.allSettled([fetchJson(ecmwfUrl(loc)), fetchJson(gfsUrl(loc))])
  if (e.status !== 'fulfilled') {
    return { location: { id: loc.id, name: loc.name }, retrievedAt: now, degraded: true, error: `ECMWF: ${e.reason?.message ?? e.reason}`, sources: [], hourly: null }
  }
  const hourly = mergeConvective(e.value, g.status === 'fulfilled' ? g.value : null)
  return {
    location: { id: loc.id, name: loc.name },
    retrievedAt: now,
    degraded: g.status !== 'fulfilled',
    error: g.status !== 'fulfilled' ? `GFS: ${g.reason?.message ?? g.reason} (memakai ECMWF saja)` : undefined,
    sources: [{ name: 'Open-Meteo ECMWF IFS 0.25° (CAPE, kode cuaca, hembusan)', kind: 'model' }, ...(hourly.hasGfs ? [{ name: 'Open-Meteo GFS seamless (CAPE, Lifted Index, CIN)', kind: 'model' }] : [])],
    hourly,
  }
}
