/**
 * Fetch ensemble API Open-Meteo (50 member ecmwf_ifs025) — M3.
 * Cache agresif 30 menit (kuota ensemble terpisah & lebih ketat).
 */
import { fetchWithRetry } from './openMeteo.js'

const ENSEMBLE_TTL_MS = 30 * 60 * 1000
const memoryCache = new Map()
const inflight = new Map()

export function buildEnsembleUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    hourly: 'precipitation',
    forecast_days: '3',
    timezone: 'Asia/Jakarta',
    models: 'ecmwf_ifs025',
  })
  return `https://ensemble-api.open-meteo.com/v1/ensemble?${params.toString()}`
}

/**
 * @param {object} location
 * @param {{ fetchImpl?: Function, ttlMs?: number }} opts
 * @returns {Promise<object>} raw JSON ensemble (hourly.precipitation_member01..50)
 */
export async function fetchEnsemblePrecip(location, { fetchImpl = fetch, ttlMs = ENSEMBLE_TTL_MS } = {}) {
  const key = location.id ?? `${location.lat},${location.lon}`
  const entry = memoryCache.get(key)
  if (entry && Date.now() - entry.fetchedAt < ttlMs) return entry.data
  if (inflight.has(key)) return inflight.get(key)

  const p = (async () => {
    const data = await fetchWithRetry(buildEnsembleUrl(location), { fetchImpl })
    memoryCache.set(key, { data, fetchedAt: Date.now() })
    return data
  })()
  inflight.set(key, p)
  try {
    return await p
  } finally {
    inflight.delete(key)
  }
}

export function clearEnsembleCache() {
  memoryCache.clear()
}

/** Konversi raw ensemble JSON → array of member arrays (mm/jam). */
export function memberArrays(ensembleData) {
  const h = ensembleData?.hourly
  if (!h) return []
  const members = []
  for (const k of Object.keys(h)) {
    if (k.startsWith('precipitation_member')) members.push(h[k])
  }
  return members
}
