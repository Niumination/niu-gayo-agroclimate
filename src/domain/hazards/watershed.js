/**
 * H-BANJIR (indeks hujan DAS Peusangan, M3) — modul registry. Hanya berlaku untuk sentra hulu berbobot
 * (`WATERSHED.weights`); sentra lain → 'n/a'. Bukan status muka air terukur (tidak ada telemetri publik).
 */
import { watershedIndex } from '../disaster.js'
import { WATERSHED } from '../thresholds.js'
import { normalizeLevel } from './levels.js'

const ADVICE = {
  waspada: { umum: ['Pantau ketinggian sungai/danau; amankan barang di dataran rendah Takengon–Bebesen–Kebayakan.'], kebun: ['Angkat jemuran & karung gabah dari gudang di bantaran.'] },
  bahaya: { umum: ['Jauhi bantaran Krueng Peusangan dan saluran keluar Danau Lut Tawar.', 'Siapkan evakuasi ke tempat tinggi; ikuti arahan BPBD (112).'], kebun: ['Pindahkan hasil panen & pupuk dari gudang di dataran banjir.'] },
}

export default {
  id: 'banjir',
  group: 'hidromet',
  label: { id: 'Luapan DAS Peusangan', gayo: 'Luapan DAS Peusangan [?]' },
  requires: ['weather'],
  evaluate(ctx) {
    const id = ctx.location?.id
    if (!id) return { level: 'n/a', degraded: true, headline: 'Lokasi tidak diketahui' }
    const weight = WATERSHED.weights[id]
    if (!weight) {
      return { level: 'n/a', degraded: false, headline: 'Bukan sentra hulu DAS Peusangan', detail: 'Indeks agregat hulu (Bintang, Lut Tawar, Kebayakan, Silih Nara) tersedia di /api/alerts.' }
    }
    const w = ctx.weather
    if (!w) return { level: 'n/a', degraded: true, headline: 'Data cuaca belum tersedia' }
    const r = watershedIndex([{ id, rain24: w.dailyRainSum }])
    const level = normalizeLevel(r.level)
    return {
      level,
      score: null,
      headline: r.level,
      detail: r.detail,
      metrics: [
        { key: 'index', label: 'Indeks hujan DAS (sentra ini)', value: r.index, unit: 'mm' },
        { key: 'weight', label: 'Bobot hulu', value: weight, unit: '' },
        { key: 'dailyRainSum', label: 'Hujan harian', value: w.dailyRainSum, unit: 'mm' },
      ],
      advice: level === 'ekstrem' ? ADVICE.bahaya : ADVICE[level] ?? {},
      sources: [{ name: 'Open-Meteo ECMWF IFS (indeks hujan, bukan muka air)', kind: 'model', retrievedAt: ctx.now }],
      degraded: false,
    }
  },
}
