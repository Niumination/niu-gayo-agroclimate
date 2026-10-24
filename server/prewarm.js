/**
 * Audit F-17 — pemanasan cache.
 *
 * `/api/hazards?location=all` adalah endpoint terberat: ia menyusun 11 bahaya untuk 15 sentra
 * dan menarik cuaca tiap sentra lebih dulu. Diukur pada mesin ini, permintaan pertama setelah
 * proses hidup butuh ~5 detik; permintaan berikutnya ~2 detik karena seluruh nilai sudah
 * tersimpan. Sebelum perbaikan ini, **pengguna pertama** selalu menanggung biaya itu.
 *
 * Sekarang proses memanaskan sendiri beberapa endpoint kunci sesaat setelah siap (dan lagi
 * sesudah `/api/cache/flush`), berurutan supaya tidak menembak banyak sumber upstream sekaligus.
 *
 * Prioritas sengaja dipilih: yang pertama dihangatkan adalah yang dipakai halaman depan.
 * Kegagalan satu langkah tidak menghentikan langkah lain — endpoint tetap punya jalur
 * `degraded` masing-masing, dan pemanasan tidak boleh membuat proses gagal start.
 */

export const PREWARM_STEPS = [
  ['hazards-all', (d) => d.hazardsAllGet],
  ['bmkg-nowcast', (d) => d.bmkgGet],
  ['quakes', (d) => d.quakesAllGet],
  ['flood', (d) => d.floodGet],
]

/**
 * @param {object} deps getter yang sama dengan yang dipakai router
 * @param {(msg: string) => void} [log]
 * @returns {(reason?: string) => Promise<{ok: string[], failed: string[], skipped?: boolean}>}
 */
export function createPrewarm(deps, { log = (msg) => console.log(msg) } = {}) {
  let running = false
  const steps = PREWARM_STEPS
    .map(([name, pick]) => [name, pick(deps)])
    .filter(([, fn]) => typeof fn === 'function')

  return async function prewarm(reason = 'start') {
    if (running) return { ok: [], failed: [], skipped: true }
    if (!steps.length) return { ok: [], failed: [], skipped: true }
    running = true
    const started = Date.now()
    const ok = []
    const failed = []
    try {
      for (const [name, fn] of steps) {
        try {
          await fn()
          ok.push(name)
        } catch {
          failed.push(name)
        }
      }
    } finally {
      running = false
    }
    const ms = Date.now() - started
    log(
      `[prewarm] ${reason}: ${ok.length}/${steps.length} siap dalam ${ms} ms` +
        (failed.length ? ` · gagal: ${failed.join(', ')}` : ''),
    )
    return { ok, failed, ms }
  }
}

/** Jadwalkan pemanasan sekali; `PREWARM=0` mematikannya (mis. saat menguji jalan lambat). */
export function schedulePrewarm(prewarm, { delayMs = Number(process.env.PREWARM_DELAY_MS || 1500), enabled = process.env.PREWARM !== '0' } = {}) {
  if (!enabled) return null
  const timer = setTimeout(() => {
    prewarm('start').catch(() => {})
  }, delayMs)
  // Jangan menahan proses tetap hidup hanya karena pemanasan belum jalan.
  timer.unref?.()
  return timer
}
