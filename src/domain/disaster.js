/**
 * Fungsi murni analisis risiko hidrometeorologi (M3).
 * Semua threshold & bobot di thresholds.js (dokumentasi: docs/THRESHOLDS.md).
 * Fungsi threshold lama dipertahankan (kompatibilitas test M1/M2).
 */
import { LANDSLIDE, WATERSHED, WIND, WIND_GUST } from './thresholds.js'

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v))
}

// ---------- Threshold lama (M1/M2, dipertahankan) ----------

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
  if (!Object.keys(WATERSHED.weights).includes(locationId)) return 'Normal'
  if (dailyRainSum >= WATERSHED.indexWaspada) return 'Waspada Luapan DAS Peusangan'
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

// ---------- M3: longsor — skor gabungan 0-100 ----------

/**
 * Skor longsor = hujan 24 jam (35) + hujan 72 jam (25) + kejenuhan tanah
 * antecedent (20) + intensitas jam puncak (10) + faktor lereng (10).
 * @param {object} p
 * @param {number} p.rain24   akumulasi hujan 24 jam (mm)
 * @param {number} p.rain72   akumulasi hujan 72 jam (mm)
 * @param {number} p.soilMoisture antecedent soil_moisture_0_to_7cm (m³/m³)
 * @param {number} p.peakHourly intensitas hujan maksimum per jam (mm)
 * @param {'landai'|'berbukit'|'curam'} [p.slopeClass]
 * @returns {{ level: string, score: number, detail: string }}
 */
export function landslideScore({ rain24 = 0, rain72 = 0, soilMoisture = 0, peakHourly = 0, slopeClass = 'berbukit' }) {
  const rain24Pts = clamp(rain24 / LANDSLIDE.rain24Max, 0, 1) * 35
  const rain72Pts = clamp(rain72 / LANDSLIDE.rain72Max, 0, 1) * 25
  const soilPts =
    soilMoisture <= LANDSLIDE.soilDry
      ? 0
      : clamp((soilMoisture - LANDSLIDE.soilDry) / (LANDSLIDE.soilSaturation - LANDSLIDE.soilDry), 0, 1) * 20
  const intensityPts = clamp(peakHourly / LANDSLIDE.intensityMax, 0, 1) * 10
  const slopePts = LANDSLIDE.slopeFactor[slopeClass] ?? LANDSLIDE.slopeFactor.berbukit
  const score = Math.round(rain24Pts + rain72Pts + soilPts + intensityPts + slopePts)

  let level = 'Rendah'
  let detail = `Hujan 24/72 jam: ${rain24}/${rain72} mm, tanah ${soilMoisture.toFixed(2)} m³/m³, lereng ${slopeClass}.`
  if (score >= LANDSLIDE.levelTinggi) level = 'Bahaya Tinggi'
  else if (score >= LANDSLIDE.levelWaspada) level = 'Waspada'
  return { level, score, detail }
}

// ---------- M3: DAS — indeks hujan hulu berbobot ----------

/**
 * Indeks hujan DAS Peusangan: rata-rata berbobot lokasi hulu.
 * RENAME klaim: ini INDEKS HUJAN, bukan status muka air (tidak ada telemetri publik).
 * @param {Array<{ id: string, rain24: number }>} upstream — hujan 24 jam lokasi hulu
 * @returns {{ level: string, index: number, detail: string }}
 */
export function watershedIndex(upstream) {
  let index = 0
  for (const u of upstream) {
    const w = WATERSHED.weights[u.id]
    if (w) index += (u.rain24 ?? 0) * w
  }
  index = Math.round(index * 10) / 10
  let level = 'Normal'
  let detail = `Indeks hujan hulu (Bintang, Lut Tawar, Kebayakan, Silih Nara) 24 jam: ${index} mm`
  if (index >= WATERSHED.indexBahaya) level = 'Bahaya Luapan DAS Peusangan'
  else if (index >= WATERSHED.indexWaspada) level = 'Waspada Luapan DAS Peusangan'
  return { level, index, detail }
}
