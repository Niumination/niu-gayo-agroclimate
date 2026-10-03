/**
 * F1 — Fetcher ensemble multi-model dari ensemble-api.open-meteo.com.
 * - ECMWF IFS 0.25° (ecmwf_ifs025): 50 member, hourly.
 * - WeatherNext 2 (google_weathernext2_ensemble): 64 member, 6-hourly, 15 hari.
 * Cache 30 menit (kuota ensemble lebih ketat).
 */
import { OPEN_METEO_ENSEMBLE } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'

export const MODELS = {
  ecmwf: 'ecmwf_ifs025',
  wn2: 'google_weathernext2_ensemble',
}

function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id)
}

async function fetchModelEnsemble(loc, model, forecastDays) {
  const location = typeof loc === 'string' ? findLocation(loc) : loc
  if (!location) throw new Error(`Lokasi tidak dikenal: ${loc}`)
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    hourly: 'precipitation',
    forecast_days: String(forecastDays),
    models: model,
  })
  const url = `${OPEN_METEO_ENSEMBLE}?${params}`
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(20_000),
  })
  if (!resp.ok) throw new Error(`Open-Meteo ensemble HTTP ${resp.status} (${model})`)
  return resp.json()
}

/** ECMWF 50 member hourly — 3 hari cukup untuk konsensus window pertama. */
export function fetchEcmwfEnsemble(loc) {
  return fetchModelEnsemble(loc, MODELS.ecmwf, 3)
}

/** WN2 64 member 6-hourly — 15 hari maksimal sesuai spesifikasi model. */
export function fetchWn2Ensemble(loc) {
  return fetchModelEnsemble(loc, MODELS.wn2, 15)
}
