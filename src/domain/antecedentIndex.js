/**
 * ARI (Antecedent Rainfall Index) — **satu implementasi** untuk klien & server.
 *
 * Audit F-30: nilai ARI dulu dihitung dua kali dengan rumus yang ditulis terpisah —
 * sekali di `server/openMeteo.js` (dipakai `/api/alerts` dan `/api/hazards`) dan sekali
 * lagi di `src/services/weatherService.js` (dipakai kartu-kartu di peramban). Dua salinan
 * berarti dua tempat yang bisa menyimpang tanpa ketahuan.
 *
 * Fungsi di sini murni (tanpa jaringan/IO) sehingga mudah diuji dan dipakai di kedua sisi.
 * **Tidak ada ambang atau bobot yang diubah** — hanya satu sumber perhitungan.
 */

/** Jumlahkan hujan `nHours` jam terakhir yang berakhir di indeks `idx` (inklusif). */
export function accumulatedRain(hourlyPrecip, idx, nHours) {
  if (!Array.isArray(hourlyPrecip) || nHours <= 0) return 0
  const end = Math.min(Math.max(0, (idx ?? hourlyPrecip.length - 1) + 1), hourlyPrecip.length)
  const start = Math.max(0, end - nHours)
  let total = 0
  for (let i = start; i < end; i++) total += hourlyPrecip[i] ?? 0
  return total
}

const round1 = (v) => Math.round(v * 10) / 10

/**
 * ARI dari deret hujan hourly (mm).
 * @param {number[]} hourlyPrecip
 * @param {number} [idx] indeks "sekarang"; bawaan = jam terakhir
 * @returns {{ ari24: number, ari72: number, source: 'model-ecmwf' }}
 */
export function antecedentIndex(hourlyPrecip, idx) {
  const i = typeof idx === 'number' && idx >= 0 ? idx : (hourlyPrecip?.length ?? 1) - 1
  return {
    ari24: round1(accumulatedRain(hourlyPrecip, i, 24)),
    ari72: round1(accumulatedRain(hourlyPrecip, i, 72)),
    source: 'model-ecmwf',
  }
}
