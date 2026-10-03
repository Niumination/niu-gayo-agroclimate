/**
 * Fetch murni Open-Meteo (M2 refactor dari weatherService.js).
 * Dependency injection: fetchImpl (default global fetch) untuk test.
 * Fitur M1: AbortController, retry eksponensial, dedupe in-flight, cache 10 menit.
 */

const CACHE_TTL_MS = 10 * 60 * 1000
const memoryCache = new Map() // key -> { data, fetchedAt }
const inflight = new Map()    // key -> Promise

export function buildForecastUrl(location) {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    elevation: String(location.elevation ?? 0),
    models: 'ecmwf_ifs025',
    current: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m,time',
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,direct_normal_irradiance,leaf_wetness_probability',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max',
    timezone: 'Asia/Jakarta',
    forecast_days: '3',
    cell_selection: 'nearest',
  })
  return `https://api.open-meteo.com/v1/forecast?${params.toString()}`
}

export async function fetchWithRetry(url, { fetchImpl = fetch, retries = 2, signal } = {}) {
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const resp = await fetchImpl(url, { signal })
      if (!resp.ok) throw new Error(`Gagal mengambil data cuaca: HTTP ${resp.status}`)
      return await resp.json()
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      lastErr = err
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 2 ** attempt * 500)) // eksponensial: 500ms, 1s
      }
    }
  }
  throw lastErr
}

export function clearForecastCache() {
  memoryCache.clear()
}

export function cacheAgeMs(location) {
  const entry = memoryCache.get(cacheKey(location))
  return entry ? Date.now() - entry.fetchedAt : null
}

function cacheKey(location) {
  return `${location.id ?? location.lat + ',' + location.lon}`
}

/**
 * Ambil raw forecast: cache memory 10 menit + dedupe request in-flight.
 * fetchImpl bisa di-inject untuk unit test.
 */
export async function fetchForecast(location, { fetchImpl = fetch, signal, ttlMs = CACHE_TTL_MS, force = false } = {}) {
  const key = cacheKey(location)
  if (!force) {
    const entry = memoryCache.get(key)
    if (entry && Date.now() - entry.fetchedAt < ttlMs) return entry.data
    if (inflight.has(key)) return inflight.get(key)
  }
  const p = (async () => {
    const data = await fetchWithRetry(buildForecastUrl(location), { fetchImpl, signal })
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

/** Dedupe-only helper untuk test: fetchForecast tanpa cache hit. */
export async function fetchForecastDedupe(location, opts = {}) {
  const key = cacheKey(location)
  if (inflight.has(key)) return inflight.get(key)
  const p = (async () => {
    const data = await fetchWithRetry(buildForecastUrl(location), opts)
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
