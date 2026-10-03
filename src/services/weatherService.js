/**
 * Service layer (M3): fetch + komposisi analisis domain.
 * Logika risiko murni ada di domain/ — file ini hanya menghubungkan data ke analisis.
 */
import { fetchForecast } from '../api/openMeteo.js'
import { fetchEnsemblePrecip, memberArrays } from '../api/ensemble.js'
import { tempStatus, rustRisk, dryingStatus, leafWetnessRustRisk } from '../domain/coffee.js'
import { landslideScore, watershedIndex, windRisk } from '../domain/disaster.js'
import { rainProbabilities } from '../domain/ensemble.js'
import { sliceHourlyFromCurrent, currentSolarRad, apiTimestamp } from '../domain/format.js'

function colorForLevel(level) {
  const l = String(level)
  if (l.includes('Bahaya') || l === 'Tinggi') return 'text-rose-500 dark:text-rose-400'
  if (l.includes('Waspada') || l === 'Sedang') return 'text-amber-500 dark:text-amber-400'
  return 'text-emerald-500 dark:text-emerald-400'
}

export async function getAgroClimateData(location) {
  const data = await fetchForecast(location)

  const curr = data.current
  const hourly = data.hourly
  const daily = data.daily

  const temp = curr.temperature_2m
  const rh = curr.relative_humidity_2m
  const rain = curr.precipitation
  const wind = curr.wind_speed_10m
  const gust = curr.wind_gusts_10m ?? 0
  const solarRad = currentSolarRad(data)
  const dailyRainSum = daily.precipitation_sum?.[0] || 0

  // --- Agro-kopi (threshold sederhana) ---
  const ts = tempStatus(temp)
  const rr = rustRisk(rh, temp)
  const ds = dryingStatus(rain, solarRad, rh)

  // --- M3: karat daun berbasis leaf wetness rolling 48 jam (skor 0-100) ---
  const nowIdx = hourly.time.indexOf(curr.time)
  const start = nowIdx >= 0 ? nowIdx - 47 : 0
  const rolling48h = hourly.time
    .slice(Math.max(0, start), Math.max(0, start) + 48)
    .map((t, i) => {
      const idx = Math.max(0, start) + i
      return {
        leafWetness: hourly.leaf_wetness_probability?.[idx] ?? 0,
        temp: hourly.temperature_2m?.[idx],
      }
    })
    .filter((h) => h.temp != null)
  const lw = leafWetnessRustRisk(rolling48h)

  // --- M3: longsor — skor gabungan ---
  const times = hourly.time
  const idx0 = nowIdx >= 0 ? nowIdx : 0
  const rain24 = (hourly.precipitation || [])
    .slice(Math.max(0, idx0 - 23), idx0 + 1)
    .reduce((a, b) => a + (b ?? 0), 0)
  const rain72 = (hourly.precipitation || [])
    .slice(Math.max(0, idx0 - 71), idx0 + 1)
    .reduce((a, b) => a + (b ?? 0), 0)
  const peakHourly = Math.max(0, ...(hourly.precipitation || []).slice(Math.max(0, idx0 - 23), idx0 + 1))
  const soilNow = hourly.soil_moisture_0_to_7cm?.[idx0] ?? 0
  const ls = landslideScore({
    rain24,
    rain72,
    soilMoisture: soilNow,
    peakHourly,
    slopeClass: location.slopeClass || 'berbukit',
  })

  // --- M3: indeks hujan DAS (kartu per lokasi; agregat hulu berbobot ada di /api/alerts) ---
  const das = watershedIndex([{ id: location.id, rain24: dailyRainSum }])

  // --- M3: angin — wind_gusts_10m ---
  const wr = windRisk(wind, gust)

  // --- Ensemble P(hujan>X) — keyakinan kartu (best-effort, gagal = null) ---
  let confidence = null
  try {
    const ens = await fetchEnsemblePrecip(location)
    const probs = rainProbabilities(memberArrays(ens))
    if (probs) {
      confidence = [
        { label: 'P(hujan>25mm/24j)', prob: probs.p25 },
        { label: 'P(hujan>50mm/24j)', prob: probs.p50 },
      ]
    }
  } catch {
    confidence = null // jangan blokir dashboard jika ensemble gagal
  }

  return {
    timestamp: apiTimestamp(data) ?? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    current: { temp, rh, rain, wind, gust, solarRad },
    daily: {
      minTemp: daily.temperature_2m_min[0],
      maxTemp: daily.temperature_2m_max[0],
      rainProb: daily.precipitation_probability_max[0],
      rainSum: dailyRainSum,
    },
    hourly: sliceHourlyFromCurrent(data, 12),
    coffee: {
      tempStatus: ts.level,
      tempBadge:
        ts.level === 'Optimal'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : ts.level === 'Dingin'
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      rustRisk: lw.level,
      rustScore: lw.score,
      rustColor: colorForLevel(lw.level),
      rustDesc: lw.description,
      dryingStatus: ds.level,
      dryingColor: colorForLevel(ds.level),
      dryingDesc: ds.desc,
    },
    disaster: {
      landslide: ls,
      das,
      wind: { level: wr, gust },
      confidence,
      // Kompatibilitas tampilan lama
      landslideRisk: ls.level,
      landslideColor: colorForLevel(ls.level),
      lakeRisk: das.level,
      windRisk: wr,
    },
  }
}
