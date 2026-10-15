/**
 * Skala level seragam 4 tingkat untuk semua bahaya (docs/dev/05-ARCHITECTURE.md §2.1):
 *   rendah < waspada < bahaya < ekstrem, plus 'n/a' (data tidak ada / tidak berlaku).
 * Label domain asli (mis. "Bahaya Tinggi", "Tidak Sehat", kelas FDRS) tetap ditampilkan di `headline`.
 */
export const LEVELS = ['rendah', 'waspada', 'bahaya', 'ekstrem']
export const LEVEL_ORDER = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }

/** Pemetaan label lama (M3) / bahasa bebas → skala seragam. */
export function normalizeLevel(level) {
  if (level == null) return 'n/a'
  const l = String(level).trim().toLowerCase()
  if (!l || l === 'n/a' || l === 'tidak diketahui') return 'n/a'
  if (LEVELS.includes(l)) return l
  if (l.includes('ekstrem') || l.includes('extreme')) return 'ekstrem'
  if (l.includes('bahaya') || l.includes('tinggi') || l === 'high' || l === 'severe') return 'bahaya'
  if (l.includes('waspada') || l.includes('sedang') || l === 'moderate' || l === 'medium') return 'waspada'
  if (l.includes('rendah') || l === 'low' || l === 'aman' || l === 'normal' || l === 'baik') return 'rendah'
  return 'n/a'
}

/** Level tertinggi dari daftar/argumen (abaikan n/a). maxLevel('a','b') atau maxLevel(['a','b']). */
export function maxLevel(...args) {
  let best = 'n/a'
  for (const lv of args.flat()) {
    const n = normalizeLevel(lv)
    if (LEVEL_ORDER[n] > LEVEL_ORDER[best]) best = n
  }
  return best
}

export function compareLevel(a, b) {
  return (LEVEL_ORDER[normalizeLevel(a)] ?? -1) - (LEVEL_ORDER[normalizeLevel(b)] ?? -1)
}

/** Naikkan `steps` tingkat, tidak melewati `cap` (level yang sudah di atas cap tidak diturunkan). */
export function bumpLevel(level, steps = 1, cap = 'bahaya') {
  const n = normalizeLevel(level)
  if (n === 'n/a') return n
  const i = Math.min(LEVELS.indexOf(n) + steps, LEVELS.indexOf(cap))
  return LEVELS[Math.max(i, LEVELS.indexOf(n))]
}

export const LEVEL_LABEL = { 'n/a': 'Tidak tersedia', rendah: 'Rendah', waspada: 'Waspada', bahaya: 'Bahaya', ekstrem: 'Ekstrem' }
