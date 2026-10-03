/**
 * F2 — Antecedent Rainfall Index (ARI) — ADR-9.
 * SPIKE IMERG (2026-10-03): akses GES DISC OPeNDAP/GPM terbukti wajib autentikasi
 * Earthdata (302 → urs.earthdata.nasa.gov). Implementasi memakai ANTENCEDENT MODEL:
 * akumulasi hujan ECMWF hourly (data sudah ada) untuk jendela 24/72 jam.
 * Upgrade ke satelit IMERG menunggu registrasi Earthdata gratis (lihat
 * DISASTER-DATA-RESEARCH.md).
 */

/** Akumulasi hujan dari deret hourly mm sejak indeks idx (inklusif) ke belakang nHours. */
export function accumulatedRain(hourlyPrecip, idx, nHours) {
  if (!Array.isArray(hourlyPrecip) || nHours <= 0) return 0
  const end = Math.min(idx + 1, hourlyPrecip.length)
  const start = Math.max(0, end - nHours)
  return hourlyPrecip.slice(start, end).reduce((a, b) => a + (b ?? 0), 0)
}

/**
 * ARI per lokasi dari deret hujan hourly (indeks idx = "sekarang").
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
