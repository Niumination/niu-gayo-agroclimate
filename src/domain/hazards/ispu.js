/**
 * H-ASAP — ISPU (Indeks Standar Pencemar Udara), Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020.
 * Fungsi murni, tanpa dependensi. Interpolasi linier per segmen:
 *   I = ((Ib − Ia) / (Xb − Xa)) × (X − Xa) + Ia
 * Catatan: segmen "Berbahaya" (> 300) memakai titik atas 500 (asumsi; konfirmasi lampiran Permen — tugas H-9).
 * Dipindahkan dari docs/dev/prototypes/ispu.mjs (iterasi 9) — lulus semua titik batas resmi.
 */
import { ISPU } from '../thresholds.js'

/** [Xa, Xb, Ia, Ib] per segmen; konsentrasi µg/m³ (PM rata-rata 24 jam, CO rata-rata 8 jam). */
export const ISPU_BREAKPOINTS = {
  pm25: [
    [0, 15.4, 0, 50],
    [15.5, 55.4, 51, 100],
    [55.5, 150.4, 101, 200],
    [150.5, 250.4, 201, 300],
    [250.5, 500, 301, 500],
  ],
  pm10: [
    [0, 50, 0, 50],
    [51, 150, 51, 100],
    [151, 350, 101, 200],
    [351, 420, 201, 300],
    [421, 500, 301, 500],
  ],
  co: [
    [0, 4000, 0, 50],
    [4001, 8000, 51, 100],
    [8001, 15000, 101, 200],
    [15001, 30000, 201, 300],
    [30001, 45000, 301, 500],
  ],
}

/** Kategori ISPU → level internal (rendah/waspada/bahaya/ekstrem) & warna resmi (hijau/biru/kuning/merah/hitam). */
export const ISPU_CATEGORIES = [
  { max: ISPU.baik, key: 'baik', label: 'Baik', color: '#2E7D32', level: 'rendah' },
  { max: ISPU.sedang, key: 'sedang', label: 'Sedang', color: '#1565C0', level: 'rendah' },
  { max: ISPU.tidakSehat, key: 'tidak_sehat', label: 'Tidak Sehat', color: '#F9A825', level: 'waspada' },
  { max: ISPU.sangatTidakSehat, key: 'sangat_tidak_sehat', label: 'Sangat Tidak Sehat', color: '#C62828', level: 'bahaya' },
  { max: Infinity, key: 'berbahaya', label: 'Berbahaya', color: '#212121', level: 'ekstrem' },
]

/** Sub-indeks satu parameter; null bila konsentrasi tidak valid. Di atas 500 µg/m³ diekstrapolasi linier segmen terakhir. */
export function ispuSubIndex(param, x) {
  if (x == null || Number.isNaN(Number(x)) || x < 0) return null
  const table = ISPU_BREAKPOINTS[param]
  if (!table) throw new Error(`parameter ISPU tidak dikenal: ${param}`)
  const last = table[table.length - 1]
  for (const seg of table) {
    const [xa, xb, ia, ib] = seg
    if (x <= xb || seg === last) {
      const lo = Math.max(x, xa)
      return Math.round(((ib - ia) / (xb - xa)) * (lo - xa) + ia)
    }
  }
  return null
}

export function ispuCategory(index) {
  if (index == null || Number.isNaN(index)) return null
  return ISPU_CATEGORIES.find((c) => index <= c.max) ?? ISPU_CATEGORIES[ISPU_CATEGORIES.length - 1]
}

/**
 * Rata-rata bergerak `hours` jam dari deret jam-an yang berakhir di endIdx (null diabaikan).
 * partial = jumlah jam valid < minHours.
 */
export function rollingMean(values, endIdx, { hours = 24, minHours = ISPU.minHours24h } = {}) {
  const arr = Array.isArray(values) ? values : []
  const end = Math.min(endIdx, arr.length - 1)
  if (end < 0) return { mean: null, hours: 0, partial: true }
  const slice = arr.slice(Math.max(0, end - (hours - 1)), end + 1).filter((v) => v != null && !Number.isNaN(v))
  if (!slice.length) return { mean: null, hours: 0, partial: true }
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  return { mean: Math.round(mean * 10) / 10, hours: slice.length, partial: slice.length < minHours }
}

/** Rata-rata bergerak 24 jam (PM2,5/PM10 sesuai Permen LHK P.14/2020). */
export function rolling24h(values, endIdx, minHours = ISPU.minHours24h) {
  return rollingMean(values, endIdx, { hours: 24, minHours })
}

/** ISPU gabungan = maksimum sub-indeks; menyertakan parameter kritis & sub-indeks per parameter. */
export function ispuComposite({ pm25, pm10, co } = {}) {
  const subs = [
    ['pm25', ispuSubIndex('pm25', pm25)],
    ['pm10', ispuSubIndex('pm10', pm10)],
    ['co', ispuSubIndex('co', co)],
  ].filter(([, v]) => v != null)
  if (!subs.length) return null
  const [param, index] = subs.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { index, param, category: ispuCategory(index), sub: Object.fromEntries(subs) }
}
