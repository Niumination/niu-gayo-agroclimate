/**
 * Fungsi murni analisis risiko hidrometeorologi (tanpa warna).
 */
import { LANDSLIDE, WATERSHED, WIND, WIND_GUST } from './thresholds.js'

export function landslideRisk(dailyRainSum, hourlyRain = 0) {
  if (dailyRainSum >= LANDSLIDE.dailyRainBahaya || hourlyRain >= LANDSLIDE.hourlyRainBahaya) {
    return 'Bahaya Tinggi'
  }
  if (dailyRainSum >= LANDSLIDE.dailyRainWaspada || hourlyRain >= LANDSLIDE.hourlyRainWaspada) {
    return 'Waspada'
  }
  return 'Rendah'
}

/** Indeks hujan DAS (bukan status muka air nyata — tidak ada telemetri publik). */
export function watershedRainIndex(locationId, dailyRainSum) {
  if (!WATERSHED.ids.includes(locationId)) return 'Normal'
  if (dailyRainSum >= WATERSHED.dailyRainWaspada) return 'Waspada Luapan DAS Peusangan'
  return 'Normal'
}

export function windRisk(windSpeed, windGust = 0) {
  if (windGust >= WIND_GUST.bahaya || windSpeed >= WIND.bahaya) {
    return 'Bahaya Angin Kencang (Pohon Peneduh Roboh)'
  }
  if (windGust >= WIND_GUST.waspada || windSpeed >= WIND.waspada) {
    return 'Waspada Angin Kencang'
  }
  return 'Normal'
}

/**
 * S3 — Probabilitas hujan ensemble per window 24 jam.
 * memberPrecip: array of member arrays (curah hujan per jam, mm).
 */
export function sumPrecipPerWindow(memberPrecip, hours = 24) {
  if (!Array.isArray(memberPrecip) || memberPrecip.length === 0) return []
  const windows = []
  for (let i = 0; i + hours <= memberPrecip[0].length; i += hours) {
    windows.push(memberPrecip.map((m) => m.slice(i, i + hours).reduce((a, b) => a + (b ?? 0), 0)))
  }
  return windows
}

export function computeRainProbability(memberPrecip, thresholdMm = 25, hours = 24) {
  const windows = sumPrecipPerWindow(memberPrecip, hours)
  if (windows.length === 0) return { probability: 0, perWindow: [], exceedances: 0, members: 0 }
  const perWindow = windows.map((w) => Math.round((w.filter((v) => v > thresholdMm).length * 100) / w.length))
  return {
    probability: perWindow[0] ?? 0,
    perWindow,
    exceedances: windows[0].filter((v) => v > thresholdMm).length,
    members: windows[0].length,
  }
}

export function rainProbabilities(memberPrecip, hours = 24) {
  return {
    p25: computeRainProbability(memberPrecip, 25, hours).probability,
    p50: computeRainProbability(memberPrecip, 50, hours).probability,
  }
}
