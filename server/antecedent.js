/**
 * F2 — Antecedent Rainfall Index (ARI) — ADR-9.
 * Primer: satelit NASA GPM IMERG (Late, daily — server/imerg.js, ARI 24/72/7d).
 * Fallback otomatis: akumulasi ECMWF hourly (Open-Meteo) bila IMERG gagal
 * (token Earthdata 401/expired 2026-12-03, network, data kurang dari 3 hari).
 * Bobot threshold TIDAK diubah di sini (lihat src/domain/thresholds.js).
 */
import { getImergAri } from './imerg.js'

/** Akumulasi hujan dari deret hourly mm sejak indeks idx (inklusif) ke belakang nHours. */
export function accumulatedRain(hourlyPrecip, idx, nHours) {
  if (!Array.isArray(hourlyPrecip) || nHours <= 0) return 0
  const end = Math.min(idx + 1, hourlyPrecip.length)
  const start = Math.max(0, end - nHours)
  return hourlyPrecip.slice(start, end).reduce((a, b) => a + (b ?? 0), 0)
}

/**
 * ARI model (fallback): deret hourly ECMWF, indeks idx = "sekarang".
 * @returns {{ ari24: number, ari72: number, source: 'model-ecmwf' }}
 */
export function antecedentIndex(hourlyPrecip, idx) {
  const i = typeof idx === 'number' && idx >= 0 ? idx : (hourlyPrecip?.length ?? 1) - 1
  const round1 = (v) => Math.round(v * 10) / 10
  return {
    ari24: round1(accumulatedRain(hourlyPrecip, i, 24)),
    ari72: round1(accumulatedRain(hourlyPrecip, i, 72)),
    source: 'model-ecmwf',
  }
}

/**
 * ARI per lokasi: coba IMERG dulu (primer), fallback model ECMWF bila gagal.
 * source: 'imerg' (satelit) | 'model-ecmwf' (fallback) | 'imerg+model'
 * ('imerg+model' = IMERG sukses → gunakan ARI 24/72 IMERG, lengkapi ari7d;
 * ARI 24/72 dari model tetap disertakan sebagai cross-check).
 * @param {number[]} hourlyPrecip deret hujan hourly ECMWF (mm)
 * @param {number} idx indeks "sekarang"
 * @param {{ lat: number, lon: number, id: string }} location
 * @returns {Promise<object>}
 */
export async function antecedentIndexWithFallback(hourlyPrecip, idx, location, opts = {}) {
  const model = antecedentIndex(hourlyPrecip, idx)
  try {
    const imerg = await getImergAri(location.lat, location.lon, opts)
    return {
      ...imerg,
      source: 'imerg',
      modelAri24: model.ari24,
      modelAri72: model.ari72,
    }
  } catch (err) {
    console.warn(`[antecedent] IMERG gagal (${location.id}): ${err.message} → fallback model-ecmwf`)
    return { ...model, source: 'model-ecmwf', fallbackReason: err.message }
  }
}
