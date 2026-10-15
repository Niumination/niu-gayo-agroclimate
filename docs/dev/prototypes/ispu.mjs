// Prototipe fungsi murni ISPU (Permen LHK P.14/MENLHK/SETJEN/KUM.1/7/2020).
// Interpolasi linier: I = ((Ib - Ia) / (Xb - Xa)) * (X - Xa) + Ia
// Catatan: batas atas segmen "Berbahaya" (>300) memakai asumsi titik 500 (PM2.5 500 µg/m³ → ISPU 500)
// — perlu dikonfirmasi terhadap lampiran Permen saat implementasi produksi.

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
  co: [ // µg/m³, 8 jam
    [0, 4000, 0, 50],
    [4001, 8000, 51, 100],
    [8001, 15000, 101, 200],
    [15001, 30000, 201, 300],
    [30001, 45000, 301, 500],
  ],
}

export const ISPU_CATEGORIES = [
  { max: 50, key: 'baik', label: 'Baik', color: '#2E7D32', level: 'rendah' },
  { max: 100, key: 'sedang', label: 'Sedang', color: '#1565C0', level: 'rendah' },
  { max: 200, key: 'tidak_sehat', label: 'Tidak Sehat', color: '#F9A825', level: 'waspada' },
  { max: 300, key: 'sangat_tidak_sehat', label: 'Sangat Tidak Sehat', color: '#C62828', level: 'bahaya' },
  { max: Infinity, key: 'berbahaya', label: 'Berbahaya', color: '#212121', level: 'ekstrem' },
]

export function ispuSubIndex(param, x) {
  if (x == null || Number.isNaN(x) || x < 0) return null
  const table = ISPU_BREAKPOINTS[param]
  if (!table) throw new Error(`parameter tidak dikenal: ${param}`)
  for (const [xa, xb, ia, ib] of table) {
    if (x <= xb || xb === table[table.length - 1][1]) {
      const lo = Math.max(x, xa)
      return Math.round(((ib - ia) / (xb - xa)) * (lo - xa) + ia)
    }
  }
  return null
}

export function ispuCategory(index) {
  if (index == null) return null
  return ISPU_CATEGORIES.find((c) => index <= c.max)
}

/** Rata-rata bergerak 24 jam dari deret jam-an (null diabaikan; partial bila < minHours). */
export function rolling24h(values, endIdx, minHours = 18) {
  const slice = values.slice(Math.max(0, endIdx - 23), endIdx + 1).filter((v) => v != null)
  if (!slice.length) return { mean: null, hours: 0, partial: true }
  const mean = slice.reduce((a, b) => a + b, 0) / slice.length
  return { mean: Math.round(mean * 10) / 10, hours: slice.length, partial: slice.length < minHours }
}

/** ISPU gabungan = maksimum sub-indeks; kembalikan parameter kritis. */
export function ispuComposite({ pm25, pm10, co }) {
  const subs = [
    ['pm25', ispuSubIndex('pm25', pm25)],
    ['pm10', ispuSubIndex('pm10', pm10)],
    ['co', ispuSubIndex('co', co)],
  ].filter(([, v]) => v != null)
  if (!subs.length) return null
  const [param, index] = subs.reduce((a, b) => (b[1] > a[1] ? b : a))
  return { index, param, category: ispuCategory(index), sub: Object.fromEntries(subs) }
}
