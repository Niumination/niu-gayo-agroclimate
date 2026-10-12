// Proxy cache in-memory sederhana untuk server API (M5).
// TTL per-entry, dedupe request in-flight (satu fetch untuk banyak klien).

const store = new Map() // key -> { value, expiresAt }
const inflight = new Map() // key -> Promise

/**
 * Ambil dari cache; jika kadaluarsa/hilang, jalankan fetcher (dedupe per key).
 * @param {string} key
 * @param {number} ttlMs
 * @param {() => Promise<any>} fetcher
 */
export async function cached(key, ttlMs, fetcher) {
  const now = Date.now()
  const hit = store.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const pending = inflight.get(key)
  if (pending) return pending

  // SWR: bila entry ada tapi expired, langsung kembalikan nilai lama dan
  // revalidate di background tanpa memblokir pemanggil. Saat upstream
  // lambat (IMERG down → refresh ~77s) pemanggil masih seketika menerima
  // data; refresh menggantikan cache begitu selesai.
  if (hit) {
    if (!inflight.has(key)) {
      const p = (async () => {
        try {
          const value = await fetcher()
          store.set(key, { value, expiresAt: Date.now() + ttlMs })
          return value
        } catch (err) {
          // Upstream gagal: biarkan cache lama tersimpan (sudah dikembalikan
          // ke pemanggil). Log saja, jangan throw ke background void.
          console.warn(`[cache] ${key}: revalidate background gagal (${err.message}), cache lama dipertahankan`)
          return hit.value
        } finally {
          inflight.delete(key)
        }
      })()
      inflight.set(key, p)
      // Jangan di-await — dedupe pemanggil lain, tapi tetap non-blokir.
      p.catch(() => {})
    }
    return hit.value
  }

  const p = (async () => {
    try {
      const value = await fetcher()
      store.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    } catch (err) {
      // Stale-while-revalidate: jika fetch gagal tapi ada cached value, return stale
      if (hit) {
        console.warn(`[cache] ${key}: fetch gagal (${err.message}), pakai stale cache`)
        return hit.value
      }
      throw err
    } finally {
      inflight.delete(key)
    }
  })()
  inflight.set(key, p)
  return p
}

/** Hapus semua entry (untuk test / FORCE refresh). */
export function clearCache() {
  store.clear()
  inflight.clear()
}

/** Statistik cache kecil untuk /healthz. */
export function cacheStats() {
  const now = Date.now()
  let fresh = 0
  for (const entry of store.values()) if (entry.expiresAt > now) fresh++
  return { entries: store.size, fresh }
}
