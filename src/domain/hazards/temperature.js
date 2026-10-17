/**
 * H-SUHU (Fase 3.2, FR-SUHU-1/2/3) — modul registry `suhu`: stres dingin/embun upas & stres panas/aborsi bunga kopi Arabika.
 * Input: ctx.weather.thermal (features.thermalSummary — Tmin/Tmax 3 hari + kondisi malam + VPD siang), ctx.location.elevation, ctx.now (bulan → fase bunga).
 * Fungsi murni coldStress()/heatStress() diekspor untuk test (skenario Jagong Jeget/Atu Lintang). Ambang: docs/reference/THRESHOLDS.md §21.
 */
import { TEMP_STRESS } from '../thresholds.js'

const RANK = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const LEVELS = ['rendah', 'waspada', 'bahaya', 'ekstrem']
const bump = (lvl) => LEVELS[Math.min(3, LEVELS.indexOf(lvl) + 1)]

export function isFloweringMonth(month, months = TEMP_STRESS.floweringMonths) {
  return months.includes(Number(month))
}

/**
 * Stres dingin. Tmin ≤ 10 waspada, ≤ 6 bahaya, ≤ 4 + cerah (awan < 30 %) + tenang (angin ≤ 5 km/jam) + Td ≤ 2 °C → ekstrem (embun upas).
 * Elevasi ≥ 1.400 m: Tmin dikoreksi −1 °C (genangan udara dingin), ditandai `elevationAdjusted`.
 * @returns {{ level, tminAdj, frost, reasons[], elevationAdjusted }}
 */
export function coldStress({ tmin, dewPoint = null, cloudCover = null, windSpeed = null, elevation = 0 }) {
  const c = TEMP_STRESS.cold
  if (tmin == null || !Number.isFinite(Number(tmin))) return { level: 'n/a', tminAdj: null, frost: false, reasons: [], elevationAdjusted: false }
  const elevationAdjusted = Number(elevation) >= c.highElevation
  const tminAdj = Math.round((Number(tmin) + (elevationAdjusted ? c.highElevationBias : 0)) * 10) / 10
  const reasons = []
  let level = 'rendah'
  if (tminAdj <= c.waspada) level = 'waspada'
  if (tminAdj <= c.bahaya) level = 'bahaya'
  const clear = cloudCover != null && cloudCover < c.cloudMax
  const calm = windSpeed != null && windSpeed <= c.windMax
  const dryAir = dewPoint != null && dewPoint <= c.dewMax
  const frost = tminAdj <= c.ekstrem && clear && calm && dryAir
  if (frost) level = 'ekstrem'
  if (tminAdj <= c.waspada) reasons.push(`Tmin ${tminAdj} °C${elevationAdjusted ? ' (koreksi −1 °C elevasi ≥ 1.400 m)' : ''}`)
  if (tminAdj <= c.ekstrem) {
    reasons.push(clear ? `langit cerah (awan ${Math.round(cloudCover)} %)` : `awan ${cloudCover != null ? Math.round(cloudCover) + ' %' : '–'} (embun upas butuh < ${c.cloudMax} %)`)
    reasons.push(calm ? `angin tenang ${windSpeed} km/jam` : `angin ${windSpeed ?? '–'} km/jam (butuh ≤ ${c.windMax})`)
    reasons.push(dryAir ? `titik embun ${dewPoint} °C` : `titik embun ${dewPoint ?? '–'} °C (butuh ≤ ${c.dewMax})`)
  }
  return { level, tminAdj, frost, reasons, elevationAdjusted }
}

/**
 * Stres panas. Tmax ≥ 28 waspada, ≥ 30 bahaya, ≥ 32 ekstrem; fase bunga + VPD > 0,82 kPa → +1 tingkat.
 * @returns {{ level, flowering, vpdBump, reasons[] }}
 */
export function heatStress({ tmax, vpd = null, flowering = false }) {
  const h = TEMP_STRESS.heat
  if (tmax == null || !Number.isFinite(Number(tmax))) return { level: 'n/a', flowering, vpdBump: false, reasons: [] }
  const t = Number(tmax)
  let level = 'rendah'
  if (t >= h.waspada) level = 'waspada'
  if (t >= h.bahaya) level = 'bahaya'
  if (t >= h.ekstrem) level = 'ekstrem'
  const reasons = []
  if (level !== 'rendah') reasons.push(`Tmax ${t} °C`)
  const vpdBump = flowering && vpd != null && vpd > h.vpdFlowering && level !== 'rendah'
  if (vpdBump) {
    level = bump(level)
    reasons.push(`VPD siang ${vpd} kPa > ${h.vpdFlowering} saat fase bunga → +1 tingkat`)
  } else if (flowering && level !== 'rendah') reasons.push('fase bunga (indikatif)')
  return { level, flowering, vpdBump, reasons }
}

const ADVICE = {
  cold: {
    waspada: { kebun: ['Malam dingin: tunda pemangkasan berat; siram pagi (bukan sore) agar tanah menyimpan panas; pertahankan mulsa & naungan.'], rentan: ['Lansia & balita: jaga kehangatan malam–subuh; awasi batuk/sesak.'] },
    bahaya: { kebun: ['Suhu ≤ 6 °C: lindungi pembibitan dengan sungkup/paranet; jangan buka naungan; tunda penanaman bibit baru.', 'Perhatikan daun muda menguning/nekrosis setelah malam dingin — jangan pangkas sampai pulih.'], rentan: ['Hindari aktivitas subuh di luar bagi penderita asma/jantung.'] },
    ekstrem: { kebun: ['POTENSI EMBUN UPAS (frost permukaan rumput ≤ 0 °C): tutup bibit & tanaman muda dengan sungkup/jerami sebelum tengah malam; siram ringan menjelang subuh bila air tersedia (lapisan es melepaskan panas laten); jangan injak daun berembun beku.', 'Kebun plato (Jagong Jeget, Atu Lintang, Kute Panang) paling rawan: cek lembah & cekungan saat subuh.'], umum: ['Suhu udara model bisa > 0 °C padahal permukaan membeku — waspadai jalan licin & pipa air.'] },
  },
  heat: {
    waspada: { kebun: ['Siang panas: siram pagi hari; pertahankan naungan 30–40 %; tunda penyemprotan siang (fitotoksik & menguap).'] },
    bahaya: { kebun: ['Tmax ≥ 30 °C saat/menjelang bunga: risiko bunga bintang/aborsi — jaga kelembapan tanah (mulsa tebal, irigasi tetes/embung), jangan pangkas naungan, tunda pemupukan N tinggi.'], rentan: ['Pekerja kebun: istirahat tiap jam di tempat teduh, minum ≥ 2 L; hentikan kerja berat 11–15 WIB.'] },
    ekstrem: { kebun: ['Tmax ≥ 32 °C: hentikan kerja lapangan 11–15 WIB; prioritaskan air untuk pembibitan & tanaman muda; naungan sementara (paranet) untuk kebun terbuka.'], umum: ['Waspadai heat exhaustion: pusing, kulit dingin-lembap, mual → pindah ke tempat sejuk & kompres.'], sekolah: ['Tunda olahraga luar ruang siang hari.'] },
  },
}

function mergeAdvice(a, b) {
  const out = {}
  for (const src of [a, b]) for (const [k, v] of Object.entries(src ?? {})) out[k] = [...(out[k] ?? []), ...v]
  return out
}

export default {
  id: 'suhu',
  group: 'agro',
  label: { id: 'Suhu Ekstrem Kopi' },
  requires: ['weather'],
  evaluate(ctx) {
    const th = ctx.weather?.thermal
    if (!th?.days?.length) return { level: 'n/a', degraded: true, headline: 'Ringkasan suhu belum tersedia' }
    const elevation = ctx.location?.elevation ?? 0
    const month = ctx.now ? Number(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', month: 'numeric' }).format(new Date(ctx.now))) : new Date().getMonth() + 1
    const flowering = isFloweringMonth(month)
    const days = th.days.map((d) => {
      const n = d.night ?? {}
      const cold = coldStress({ tmin: d.tmin, dewPoint: n.dewAtColdest ?? n.dewMin, cloudCover: n.cloudAtColdest ?? n.cloudMean, windSpeed: n.windAtColdest ?? n.windMean, elevation })
      const heat = heatStress({ tmax: d.tmax, vpd: d.day?.vpdMean ?? null, flowering })
      return { date: d.date, tmin: d.tmin, tmax: d.tmax, vpd: d.day?.vpdMean ?? null, cold, heat, partial: !!d.partial }
    })
    const worstCold = days.reduce((b, d) => (RANK[d.cold.level] > RANK[b.cold.level] ? d : b), days[0])
    const worstHeat = days.reduce((b, d) => (RANK[d.heat.level] > RANK[b.heat.level] ? d : b), days[0])
    const coldLvl = worstCold.cold.level
    const heatLvl = worstHeat.heat.level
    const level = RANK[coldLvl] >= RANK[heatLvl] ? coldLvl : heatLvl
    const dominant = RANK[coldLvl] >= RANK[heatLvl] && coldLvl !== 'rendah' ? 'cold' : heatLvl !== 'rendah' ? 'heat' : null
    const fmtD = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`
    const headline =
      dominant === 'cold'
        ? `${worstCold.cold.frost ? 'Potensi embun upas' : 'Malam dingin'} ${fmtD(worstCold.date)}: Tmin ${worstCold.cold.tminAdj} °C`
        : dominant === 'heat'
          ? `Siang panas ${fmtD(worstHeat.date)}: Tmax ${worstHeat.tmax} °C${worstHeat.heat.vpdBump ? ' + udara kering saat bunga' : ''}`
          : `Suhu dalam kisaran aman kopi (${Math.min(...days.map((d) => d.tmin ?? 99))}–${Math.max(...days.map((d) => d.tmax ?? -99))} °C, 3 hari)`
    const detail = [
      days.map((d) => `${fmtD(d.date)}: ${d.tmin ?? '–'}/${d.tmax ?? '–'} °C${d.vpd != null ? ` VPD ${d.vpd}` : ''}`).join(' · '),
      ...(worstCold.cold.reasons.length ? [`Dingin: ${worstCold.cold.reasons.join(', ')}.`] : []),
      ...(worstHeat.heat.reasons.length ? [`Panas: ${worstHeat.heat.reasons.join(', ')}.`] : []),
      flowering ? `Bulan ${month} = fase bunga indikatif Gayo.` : '',
      !th.hasDew || !th.hasCloud ? 'Titik embun/awan tidak tersedia → kriteria embun upas tidak dapat dipastikan.' : '',
    ].filter(Boolean).join(' ')
    const advice = mergeAdvice(coldLvl !== 'rendah' ? ADVICE.cold[coldLvl] : null, heatLvl !== 'rendah' ? ADVICE.heat[heatLvl] : null)
    return {
      level,
      score: null,
      headline,
      detail,
      metrics: [
        { key: 'tmin', label: `Tmin ${fmtD(worstCold.date)}`, value: worstCold.tmin, unit: '°C' },
        { key: 'tmax', label: `Tmax ${fmtD(worstHeat.date)}`, value: worstHeat.tmax, unit: '°C' },
        { key: 'vpd', label: 'Tekanan uap siang', value: worstHeat.vpd, unit: 'kPa' },
        { key: 'dew', label: 'Titik embun malam terdingin', value: th.days[0]?.night?.dewAtColdest ?? null, unit: '°C' },
        { key: 'elevation', label: 'Elevasi sentra', value: elevation, unit: 'm' },
      ],
      advice,
      sources: [{ name: 'Open-Meteo ECMWF IFS (Tmin/Tmax, titik embun, awan, VPD)', kind: 'model', retrievedAt: ctx.now }],
      flags: { dominant, flowering, frost: worstCold.cold.frost, coldLevel: coldLvl, heatLevel: heatLvl, elevationAdjusted: worstCold.cold.elevationAdjusted, days: days.map((d) => ({ date: d.date, tmin: d.tmin, tmax: d.tmax, vpd: d.vpd, cold: d.cold.level, heat: d.heat.level })) },
      degraded: false,
    }
  },
}
