// Fetcher Open-Meteo untuk proxy server (M5).
import { OPEN_METEO, OPEN_METEO_ENSEMBLE, WATERSHED_LOCATIONS } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'
import { parseEnsembleMembers, accumulate1hTo24h, accumulate6hTo24h, windowExceedance, consensusLevel } from './consensus.js'
import { fetchEcmwfEnsemble, fetchWn2Ensemble } from './ensemble.js'
import { antecedentIndex, antecedentIndexWithFallback } from './antecedent.js'

const baseParams =
  'timezone=Asia%2FJakarta&models=ecmwf_ifs025&cell_selection=nearest'

export async function fetchWeather(location) {
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    elevation: String(location.elevation),
    current:
      'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
    hourly:
      'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_gusts_10m,leaf_wetness_probability,soil_moisture_0_to_7cm,direct_normal_irradiance',
    daily:
      'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,wind_gusts_10m_max',
    forecast_days: '3',
  })
  const url = `${OPEN_METEO}?${params}&${baseParams}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`)
  return resp.json()
}

export async function fetchEnsemble(loc) {
  const location = typeof loc === 'string' ? findLocation(loc) : loc
  if (!location) throw new Error(`Lokasi tidak dikenal: ${loc}`)
  const params = new URLSearchParams({
    latitude: String(location.lat),
    longitude: String(location.lon),
    hourly: 'precipitation',
    forecast_days: '3',
  })
  const url = `${OPEN_METEO_ENSEMBLE}?${params}&timezone=Asia%2FJakarta&models=ecmwf_ifs025`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`Open-Meteo ensemble HTTP ${resp.status}`)
  return resp.json()
}

function findLocation(id) {
  return LOCATIONS.find((l) => l.id === id)
}

function parseHourly(weather) {
  const h = weather.hourly || {}
  const times = h.time || []
  const pick = (k) => times.map((t, i) => ({ time: t, value: (h[k] || [])[i] ?? null }))
  return {
    times,
    precipitation: pick('precipitation'),
    temperature_2m: pick('temperature_2m'),
    leaf_wetness_probability: pick('leaf_wetness_probability'),
    soil_moisture_0_to_7cm: pick('soil_moisture_0_to_7cm'),
    wind_gusts_10m: pick('wind_gusts_10m'),
  }
}

export async function getWeatherForLocation(id) {
  const loc = findLocation(id)
  if (!loc) throw new Error(`Lokasi tidak dikenal: ${id}`)
  const data = await fetchWeather(loc)
  return { location: loc, ...parseHourly(data), current: data.current }
}

/**
 * Agregat skor peringatan 15 lokasi: fetch semua paralel, hitung ulang
 * skor ringkas (24h rain sum, gusts maksimum, karat sederhana) per lokasi.
 */
export async function fetchAllAlerts(cachedGet) {
  const results = await Promise.all(
    LOCATIONS.map(async (loc) => {
      const w = await cachedGet(loc.id)
      const precip = w.precipitation.map((p) => p.value ?? 0)
      const rain24 = precip.slice(-24).reduce((a, b) => a + b, 0)
      const rain72 = precip.slice(-72).reduce((a, b) => a + b, 0)
      const gusts = w.wind_gusts_10m.map((g) => g.value ?? 0)
      const gustMax = Math.max(...gusts, 0)
      const lw = w.leaf_wetness_probability.map((x) => x.value ?? 0)
      const lwHours = lw.slice(-48).filter((v) => v >= 70).length
      const temp = w.temperature_2m.map((t) => t.value).filter((t) => t != null)
      const rustWindow = lw
        .slice(-48)
        .filter((v, i) => v >= 70 && temp[i] >= 18 && temp[i] <= 25).length
      return {
        id: loc.id,
        name: loc.name,
        rain24: Math.round(rain24 * 10) / 10,
        rain72: Math.round(rain72 * 10) / 10,
        gustMax,
        leafWetnessHours48: lwHours,
        rustHours48: rustWindow,
        landslide: rain24 >= 50 ? 'tinggi' : rain24 >= 25 ? 'waspada' : 'rendah',
        wind: gustMax >= 35 ? 'tinggi' : gustMax >= 20 ? 'waspada' : 'normal',
        rust: rustWindow >= 6 ? 'tinggi' : rustWindow >= 3 ? 'waspada' : 'rendah',
        // F2 (ADR-9): ARI — primer IMERG (satelit), fallback model ECMWF.
        antecedent: await antecedentIndexWithFallback(precip, precip.length - 1, loc),
      }
    })
  )

  // Indeks hujan DAS Peusangan: rata-rata berbobot lokasi hulu.
  let das = 0
  for (const wl of WATERSHED_LOCATIONS) {
    const r = results.find((x) => x.id === wl.id)
    if (r) das += r.rain24 * wl.weight
  }
  das = Math.round(das * 10) / 10

  return {
    generatedAt: new Date().toISOString(),
    watershedRainIndex24h: das,
    locations: results,
  }
}

/**
 * F1 (ADR-8): konsensus multi-model untuk satu lokasi.
 * ECMWF 50 member (hourly) + WN2 64 member (6-hourly) + BMKG nowcast (bila aktif).
 * Fallback: WN2 gagal → lanjut ECMWF saja + degraded:true. Tidak pernah throw.
 */
export async function computeConsensus(loc, { bmkgAlertActive = false } = {}) {
  const ecmwfP = { probability: 0, members: 0 }
  const wn2P = { probability: 0, members: 0 }
  let degraded = false

  const ecmwfTask = fetchEcmwfEnsemble(loc)
    .then((raw) => windowExceedance(accumulate1hTo24h(parseEnsembleMembers(raw)), 25))
    .catch(() => null)
  const wn2Task = fetchWn2Ensemble(loc)
    .then((raw) => windowExceedance(accumulate6hTo24h(parseEnsembleMembers(raw)), 25))
    .catch(() => null)

  const [ec, wn] = await Promise.all([ecmwfTask, wn2Task])
  if (ec) Object.assign(ecmwfP, ec)
  else degraded = true
  if (wn) Object.assign(wn2P, wn)
  else degraded = true

  const consensus = consensusLevel({
    ecmwf: ecmwfP.members > 0 ? ecmwfP : {},
    wn2: wn2P.members > 0 ? wn2P : {},
    bmkgAlertActive,
  })
  return {
    level: consensus.level,
    votes: consensus.votes,
    sources: consensus.sources,
    detail: consensus.detail,
    models: { ecmwf: ecmwfP, wn2: wn2P },
    degraded: degraded || consensus.sources === 0,
  }
}

export { antecedentIndex, antecedentIndexWithFallback, WATERSHED_LOCATIONS }
