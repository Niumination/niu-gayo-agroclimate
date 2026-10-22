/**
 * U2 — status kesegaran data untuk chip header.
 *
 * `dataAge` (lib/dataAge.js) memberi label umur mentah dan satu ambang basi.
 * Chip Living Map butuh tiga tingkat yang bisa dibedakan tanpa membaca angka:
 *   fresh  < 10 menit  → data baru, denyut boleh hidup
 *   aging  10–30 menit → masih dipakai, tetapi tidak lagi "baru"
 *   stale  ≥ 30 menit  → di luar TTL cache proxy, sebutkan "mungkin tertunda"
 *
 * Angka menit dipakai apa adanya supaya chip tetap jujur; teks tingkat hanya
 * ditambahkan saat data benar-benar melewati ambang.
 */
export const FRESH_LIMIT_MIN = 10
export const STALE_LIMIT_MIN = 30

export function dataFreshness(minutes) {
  if (minutes == null || !Number.isFinite(minutes)) {
    return { tier: 'unknown', label: '-', note: null }
  }
  const value = Math.max(0, Math.floor(minutes))
  const tier = value < FRESH_LIMIT_MIN ? 'fresh' : value < STALE_LIMIT_MIN ? 'aging' : 'stale'
  const label = value < 1
    ? 'baru saja'
    : value < 60
      ? `${value} menit lalu`
      : `${Math.floor(value / 60)} jam lalu`
  return { tier, label, note: tier === 'stale' ? 'mungkin tertunda' : null }
}
