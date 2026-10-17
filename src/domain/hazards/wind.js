/**
 * H-ANGIN — modul registry membungkus `windRisk` (M3: hembusan ≥ 40 waspada, ≥ 60 bahaya) + tingkat 'ekstrem' ≥ 75 km/jam
 * (≈ Beaufort 9) + penanda FR-KONV-4: hembusan ≥ 45 km/jam = kriteria cuaca ekstrem BMKG (`flags.bmkgExtreme`, bukan level).
 */
import { windRisk } from '../disaster.js'
import { WIND_GUST } from '../thresholds.js'
import { normalizeLevel } from './levels.js'

const ADVICE = {
  waspada: { umum: ['Jauhi pohon besar & papan reklame saat angin kencang.'], kebun: ['Periksa pohon pelindung (lamtoro/dadap) yang lapuk; tunda pemangkasan tinggi.'] },
  bahaya: { umum: ['Hindari berteduh di bawah pohon pelindung & tebing jalan; amankan atap seng.'], kebun: ['Tunda kerja di bawah pohon pelindung; ikat/pasang penyangga bibit & tanaman muda.'] },
  ekstrem: { umum: ['Hembusan ≥ 75 km/jam: tetap di dalam bangunan kokoh; waspada pohon tumbang, atap terbang & puting beliung.'], kebun: ['Hentikan kegiatan kebun; amankan para-para jemur & rumah pengering plastik.'], sekolah: ['Jauhkan siswa dari pohon besar & bangunan semi-permanen.'] },
}

export default {
  id: 'angin',
  group: 'hidromet',
  label: { id: 'Angin Kencang' },
  requires: ['weather'],
  evaluate(ctx) {
    const w = ctx.weather
    if (!w) return { level: 'n/a', degraded: true, headline: 'Data cuaca belum tersedia' }
    const r = windRisk(w.wind, w.gust)
    let level = normalizeLevel(r === 'Normal' ? 'rendah' : r)
    if (w.gust >= WIND_GUST.ekstrem) level = 'ekstrem'
    const outlook = w.gustMaxNext24 >= WIND_GUST.ekstrem ? 'ekstrem' : normalizeLevel(windRisk(w.windMaxNext24, w.gustMaxNext24).replace('Normal', 'rendah'))
    const bmkgNow = w.gust >= WIND_GUST.bmkgEkstrem
    return {
      level,
      score: Math.min(100, Math.round((w.gust / WIND_GUST.ekstrem) * 100)),
      headline: `Hembusan ${Math.round(w.gust)} km/jam · maks 24 jam ke depan ${Math.round(w.gustMaxNext24)} km/jam${bmkgNow ? ' · kriteria cuaca ekstrem BMKG (≥ 45 km/jam)' : ''}`,
      detail: r === 'Normal' ? 'Angin dalam batas normal untuk pohon pelindung kopi.' : r,
      metrics: [
        { key: 'gust', label: 'Hembusan saat ini', value: Math.round(w.gust), unit: 'km/jam' },
        { key: 'wind', label: 'Angin rata-rata', value: Math.round(w.wind), unit: 'km/jam' },
        { key: 'gustMaxNext24', label: 'Hembusan maks 24 jam ke depan', value: Math.round(w.gustMaxNext24), unit: 'km/jam' },
        { key: 'windDirection', label: 'Arah angin', value: w.windDirection, unit: '°' },
      ],
      advice: ADVICE[level] ?? {},
      sources: [{ name: 'Open-Meteo ECMWF IFS (wind_gusts_10m)', kind: 'model', retrievedAt: ctx.now }],
      flags: { outlook, bmkgExtreme: bmkgNow || w.gustMaxNext24 >= WIND_GUST.bmkgEkstrem },
      degraded: false,
    }
  },
}
