/**
 * Audit F-10 — setiap permintaan jaringan punya batas waktu.
 *
 * Sebelum ini 16 `fetch()` di klien berjalan tanpa timeout. Bila satu sumber (BMKG, MAGMA,
 * Open-Meteo) menerima koneksi tetapi tidak pernah menjawab, `Promise.allSettled` menunggu
 * selamanya dan halaman berhenti di kerangka — tanpa pesan galat.
 *
 * `AbortSignal.timeout` belum ada di Safari 14 (target build es2020), jadi dipakai
 * `AbortController` + `setTimeout` yang bekerja di semua peramban yang didukung.
 */
export const API_TIMEOUT_MS = 8000

export function fetchWithTimeout(url, options = {}, ms = API_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return fetch(url, { ...options, signal: options.signal || controller.signal }).finally(() =>
    clearTimeout(timer),
  )
}
