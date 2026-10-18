/**
 * H-KARAT (agro) — modul registry membungkus `leafWetnessRustRisk` (S5/M3) agar laporan warga tipe `karat`
 * dan panel risiko memakai skala yang sama. Tinggi → bahaya, Sedang → waspada.
 */
import { leafWetnessRustRisk } from '../coffee.js'
import { LEVEL_LABEL, normalizeLevel } from './levels.js'

export default {
  id: 'karat',
  group: 'agro',
  label: { id: 'Karat Daun Kopi' },
  requires: ['weather'],
  evaluate(ctx) {
    const w = ctx.weather
    if (!w) return { level: 'n/a', degraded: true, headline: 'Data cuaca belum tersedia' }
    const r = leafWetnessRustRisk(w.rolling48h)
    const level = normalizeLevel(r.level)
    return {
      level,
      score: r.score,
      headline: `Risiko karat daun kopi ${LEVEL_LABEL[level].toLowerCase()}`,
      detail: r.description,
      metrics: [
        { key: 'wetHours48', label: 'Jam basah daun 48 jam', value: r.wetHoursInWindow, unit: 'jam' },
        { key: 'wetStreak', label: 'Basah berturut terpanjang', value: r.longestWetStreak, unit: 'jam' },
        { key: 'optimalTempHours', label: 'Jam basah pada 18–25 °C', value: r.optimalTempHours, unit: 'jam' },
      ],
      advice: level === 'rendah' ? {} : { kebun: [r.description, 'Perbaiki aerasi kanopi & sanitasi daun gugur; cek daun bawah tiap 3 hari.'] },
      sources: [{ name: 'Open-Meteo ECMWF IFS (leaf_wetness_probability)', kind: 'model', retrievedAt: ctx.now }],
      degraded: false,
    }
  },
}
