/**
 * H-LONGSOR — modul registry (ADR-12) membungkus `landslideScore` M3/F2 tanpa mengubah ambang.
 * ctx.weather: fitur dari `weatherFeatures()`; ctx.ari: ARI IMERG/model (opsional).
 */
import { landslideScore } from '../disaster.js'
import { normalizeLevel } from './levels.js'

const ADVICE = {
  waspada: {
    umum: ['Pantau retakan tanah, mata air keruh, dan pohon miring di lereng dekat rumah.', 'Siapkan jalur evakuasi ke tempat datar; hindari lereng terjal saat hujan > 2 jam.'],
    kebun: ['Tunda pekerjaan di lereng curam & tebing jalan kebun selama hujan.', 'Bersihkan saluran air teras agar aliran tidak memotong lereng.'],
  },
  bahaya: {
    umum: ['Jauhi lereng terjal dan bantaran tebing; bila ada suara gemuruh/retakan baru segera menjauh.', 'Hubungi BPBD Aceh Tengah 112 / (0643) 21113 bila melihat tanda longsor.', 'Siapkan tas siaga & titik kumpul kampung.'],
    kebun: ['Hentikan kegiatan di kebun lereng curam sampai hujan reda ≥ 6 jam.', 'Jangan memarkir kendaraan di bawah tebing jalan kebun.'],
    sekolah: ['Sekolah di bawah lereng: periksa jalur evakuasi; pertimbangkan pulang lebih awal bila hujan lebat berlanjut.'],
  },
}

export default {
  id: 'longsor',
  group: 'hidromet',
  label: { id: 'Tanah Longsor' },
  requires: ['weather'],
  evaluate(ctx) {
    const w = ctx.weather
    if (!w) return { level: 'n/a', degraded: true, headline: 'Data cuaca belum tersedia' }
    const slopeClass = ctx.location?.slopeClass || 'berbukit'
    const ari = ctx.ari ?? { ari24: w.rain24, ari72: w.rain72, source: 'model-ecmwf' }
    const r = landslideScore({ rain24: w.rain24, rain72: w.rain72, ari, soilMoisture: w.soilMoisture, peakHourly: w.peakHourly, slopeClass })
    const level = normalizeLevel(r.level)
    const adv = level === 'ekstrem' ? ADVICE.bahaya : ADVICE[level] ?? {}
    return {
      level,
      score: r.score,
      headline: `Skor longsor ${r.score}/100 — ${r.level}`,
      detail: r.detail,
      metrics: [
        { key: 'rain24', label: 'Hujan 24 jam', value: w.rain24, unit: 'mm' },
        { key: 'ari72', label: 'ARI 72 jam', value: ari.ari72, unit: 'mm' },
        { key: 'soilMoisture', label: 'Kelembapan tanah 0–7 cm', value: Math.round(w.soilMoisture * 100) / 100, unit: 'm³/m³' },
        { key: 'peakHourly', label: 'Intensitas puncak', value: w.peakHourly, unit: 'mm/jam' },
        { key: 'rainNext24', label: 'Prakiraan hujan 24 jam', value: w.rainNext24, unit: 'mm' },
      ],
      advice: adv,
      sources: [{ name: `Open-Meteo ECMWF IFS (ARI: ${ari.source})`, kind: 'model', retrievedAt: ctx.now }],
      flags: { slopeClass, antecedentSource: ari.source },
      degraded: false,
    }
  },
}
