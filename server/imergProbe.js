/**
 * F-05 — probe IMERG sekali per 6 jam.
 *
 * Semula status IMERG hanya dibaca dari `alerts:all` (hasil `/api/alerts`). Ternyata
 * UI tidak pernah memanggil `/api/alerts` dan cron memakai `/api/alerts/run` (yang
 * mengevaluasi bahaya, bukan agregat alerts). Akibatnya `peek('alerts:all')` selalu
 * kosong: `/healthz` melaporkan `sources.imerg = belum-dimuat` selamanya, dan alarm
 * F-05 tidak akan berbunyi walaupun GES DISC mati total — kebalikan dari maksud
 * temuannya.
 *
 * Probe memeriksa **satu** sentra (bukan 15) paling sering sekali per `intervalMs`,
 * dijalankan di latar oleh `/healthz` sehingga respons tetap cepat. Hasilnya disimpan
 * di memori proses dan dipakai `srcImerg()` bila `alerts:all` belum ada.
 *
 * Murni terhadap I/O: `fetchAri` dan `now` disuntikkan, jadi bisa diuji tanpa jaringan.
 */

export const IMERG_PROBE_INTERVAL_MS = 6 * 3_600_000

/**
 * @param {object} opsi
 * @param {(location: {lat: number, lon: number, id?: string}) => Promise<{ari7d?: number}>} opsi.fetchAri
 * @param {{lat: number, lon: number, id?: string}} opsi.location sentra yang diperiksa
 * @param {number} [opsi.intervalMs]
 * @param {() => number} [opsi.now]
 */
export function createImergProbe({ fetchAri, location, intervalMs = IMERG_PROBE_INTERVAL_MS, now = () => Date.now() } = {}) {
  let lastAttempt = 0
  let result = null
  let running = false

  return {
    /** Hasil terakhir, atau `null` bila belum pernah selesai. */
    peek: () => result,

    /**
     * Jalankan probe bila interval sudah lewat. Tidak pernah menunggu: pemanggil
     * (`/healthz`) langsung lanjut, hasil muncul pada permintaan berikutnya.
     */
    tick() {
      const t = now()
      if (running || !fetchAri || !location) return result
      if (lastAttempt && t - lastAttempt < intervalMs) return result
      lastAttempt = t
      running = true
      Promise.resolve()
        .then(() => fetchAri(location))
        .then(
          (ari) => {
            result = {
              state: 'ok',
              source: 'probe',
              retrievedAt: new Date(now()).toISOString(),
              ari7d: typeof ari?.ari7d === 'number' ? Math.round(ari.ari7d * 10) / 10 : null,
            }
          },
          (err) => {
            result = {
              state: 'degraded',
              source: 'probe',
              retrievedAt: new Date(now()).toISOString(),
              error: err?.message || 'IMERG tidak bisa dihubungi',
            }
          },
        )
        .finally(() => { running = false })
      return result
    },
  }
}
