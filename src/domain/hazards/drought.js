/**
 * H-KERING — Hari Tanpa Hujan berturut-turut (HTH) kelas BMKG + neraca air 30 hari (FR-KER-2/3).
 * Fungsi murni, tanpa fetch. Input deret harian (arsip ERA5-Land + prakiraan ECMWF) dari server/archive.js.
 *
 * Definisi BMKG (Monitoring HTH): hari tanpa hujan = curah hujan harian < 1 mm; HTH dihitung mundur dari hari terakhir
 * berdata; bila hari terakhir ≥ 1 mm → "HH" (hari hujan, HTH = 0). Kelas: Sangat Pendek 1–5 · Pendek 6–10 ·
 * Menengah 11–20 · Panjang 21–30 · Sangat Panjang 31–60 · Kekeringan Ekstrem > 60 hari.
 */
import { HTH, WATER_BALANCE, VPD } from '../thresholds.js'

export const HTH_CLASSES = [
  { key: 'hh', label: 'Hari Hujan', short: 'HH', max: 0 },
  { key: 'sangat_pendek', label: 'Sangat Pendek', short: '1–5 hari', max: HTH.classes.sangatPendek },
  { key: 'pendek', label: 'Pendek', short: '6–10 hari', max: HTH.classes.pendek },
  { key: 'menengah', label: 'Menengah', short: '11–20 hari', max: HTH.classes.menengah },
  { key: 'panjang', label: 'Panjang', short: '21–30 hari', max: HTH.classes.panjang },
  { key: 'sangat_panjang', label: 'Sangat Panjang', short: '31–60 hari', max: HTH.classes.sangatPanjang },
  { key: 'ekstrem', label: 'Kekeringan Ekstrem', short: '> 60 hari', max: Infinity },
]

const LEVEL_RANK = { rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * HTH dari deret hujan harian (mm) terurut naik; nilai null di ujung diabaikan (hari belum berdata).
 * @returns {{ days:number, lastDataIndex:number, lastRainIndex:number|null, truncated:boolean }}
 * truncated = seluruh deret berdata kering (HTH sebenarnya ≥ days).
 */
export function hthDays(dailyPrecip, { threshold = HTH.rainDayMm } = {}) {
  const arr = Array.isArray(dailyPrecip) ? dailyPrecip : []
  let end = arr.length - 1
  while (end >= 0 && !isNum(arr[end])) end--
  if (end < 0) return { days: 0, lastDataIndex: -1, lastRainIndex: null, truncated: false }
  let days = 0
  let i = end
  for (; i >= 0; i--) {
    const v = arr[i]
    if (!isNum(v)) continue // celah data di tengah: lewati (konservatif)
    if (v >= threshold) break
    days++
  }
  return { days, lastDataIndex: end, lastRainIndex: i >= 0 ? i : null, truncated: i < 0 }
}

/** Kelas BMKG untuk n hari tanpa hujan. */
export function hthClass(days) {
  const n = Math.max(0, Math.floor(days ?? 0))
  return HTH_CLASSES.find((c) => n <= c.max) ?? HTH_CLASSES[HTH_CLASSES.length - 1]
}

/** Level UI 4 tingkat dari HTH (docs/dev/06 §3). */
export function hthLevel(days) {
  const n = days ?? 0
  if (n >= HTH.ekstrem) return 'ekstrem'
  if (n >= HTH.bahaya) return 'bahaya'
  if (n >= HTH.waspada) return 'waspada'
  return 'rendah'
}

/**
 * Proyeksi HTH: tambahkan hari prakiraan selama hujan harian prakiraan < ambang.
 * @returns {{ days:number, breaksOnIndex:number|null }} breaksOnIndex = indeks hari prakiraan pertama yang hujan (≥ ambang)
 */
export function projectHth(currentDays, forecastPrecip, { threshold = HTH.rainDayMm, maxDays = HTH.projectionDays } = {}) {
  let days = currentDays ?? 0
  const fc = (Array.isArray(forecastPrecip) ? forecastPrecip : []).slice(0, maxDays)
  for (let i = 0; i < fc.length; i++) {
    const v = fc[i]
    if (!isNum(v)) break
    if (v >= threshold) return { days, breaksOnIndex: i }
    days++
  }
  return { days, breaksOnIndex: null }
}

/**
 * Neraca air sederhana Σ(P − ET0) selama `days` hari terakhir yang berdata lengkap (P dan ET0 keduanya angka).
 * @returns {{ rain:number, et0:number, balance:number, days:number, level:'rendah'|'waspada'|'bahaya' }}
 */
export function waterBalance(precip, et0, { days = WATER_BALANCE.days } = {}) {
  const p = Array.isArray(precip) ? precip : []
  const e = Array.isArray(et0) ? et0 : []
  let rain = 0
  let evap = 0
  let n = 0
  for (let i = p.length - 1; i >= 0 && n < days; i--) {
    if (!isNum(p[i]) || !isNum(e[i])) continue
    rain += p[i]
    evap += e[i]
    n++
  }
  const balance = rain - evap
  const level = n === 0 ? 'rendah' : balance <= WATER_BALANCE.bahaya ? 'bahaya' : balance <= WATER_BALANCE.waspada ? 'waspada' : 'rendah'
  const r1 = (v) => Math.round(v * 10) / 10
  return { rain: r1(rain), et0: r1(evap), balance: r1(balance), days: n, level }
}

const ADVICE = {
  rendah: [
    'Kondisi air kebun normal; pertahankan mulsa serasah di piringan pohon kopi.',
    'Manfaatkan hari kering untuk pemangkasan ringan dan sanitasi kebun.',
  ],
  waspada: [
    'HTH memasuki kelas Menengah: pasang/tebalkan mulsa, kurangi gulma pesaing air, siapkan embung/tandon.',
    'Jangan membakar serasah atau membuka lahan dengan api — bahan bakar permukaan mulai kering.',
    'Prioritaskan air untuk bibit & tanaman muda (< 2 tahun) dan pembungaan.',
  ],
  bahaya: [
    'HTH Panjang/Sangat Panjang: irigasi tetes/siram manual bergilir untuk tanaman muda; naungan sementara bila memungkinkan.',
    'Larangan membakar lahan dan serasah; siapkan sekat bakar di tepi kebun yang berbatasan dengan semak/ilalang.',
    'Koordinasikan prioritas air baku desa (air minum > ternak > kebun) bersama pemerintah kampung.',
    'Pantau tanda stres: daun menggulung siang hari, gugur bunga, buah mengerut.',
  ],
  ekstrem: [
    'Kekeringan Ekstrem (> 60 hari): fokus menyelamatkan tanaman muda dan sumber air; hentikan penanaman baru.',
    'Patuhi status darurat kekeringan/karhutla daerah; laporkan sumber air yang mengering ke BPBD/BPP.',
    'Hindari aktivitas api sama sekali, termasuk membakar sampah rumah tangga di dekat kebun.',
  ],
}

function maxLevel(a, b) {
  return LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a
}

/**
 * Penilaian kekeringan lengkap dari deret harian { time[], precipitation_sum[], et0_fao_evapotranspiration[], source[] }.
 * `source[i]` ∈ 'archive'|'model'|'forecast' — hari berlabel 'forecast' (dan hari ini bila `today` diberikan) dihitung sebagai proyeksi.
 * Mengembalikan null bila tidak ada hari observasi sama sekali.
 */
/**
 * FR-KER-3 — VPD siang (09–15 WIB) rata-rata N hari observasi terakhir dari deret jam { time[], temperature_2m[], relative_humidity_2m[], source[] }.
 * VPD (kPa) = es(T)·(1 − RH/100), es Tetens. Level: > 0,82 waspada (pembungaan), > 1,5 bahaya.
 */
export function vpdDaytime(hourly, { today, days = VPD.days } = {}) {
  const time = hourly?.time ?? []
  if (!time.length || !hourly.temperature_2m || !hourly.relative_humidity_2m) return null
  const src = hourly.source ?? time.map(() => 'archive')
  const byDay = new Map()
  time.forEach((t, i) => {
    if (src[i] === 'forecast' || (today && t.slice(0, 10) >= today)) return
    const h = Number(t.slice(11, 13))
    if (h < VPD.dayStartH || h > VPD.dayEndH) return
    const T = hourly.temperature_2m[i]
    const rh = hourly.relative_humidity_2m[i]
    if (T == null || rh == null) return
    const es = 0.6108 * Math.exp((17.27 * T) / (T + 237.3))
    const v = es * (1 - rh / 100)
    const d = t.slice(0, 10)
    if (!byDay.has(d)) byDay.set(d, [])
    byDay.get(d).push(v)
  })
  const dayKeys = [...byDay.keys()].sort().slice(-days)
  if (!dayKeys.length) return null
  const dailyMeans = dayKeys.map((d) => byDay.get(d).reduce((a, b) => a + b, 0) / byDay.get(d).length)
  const mean = Math.round((dailyMeans.reduce((a, b) => a + b, 0) / dailyMeans.length) * 100) / 100
  const level = mean > VPD.bahaya ? 'bahaya' : mean > VPD.waspada ? 'waspada' : 'rendah'
  return { mean, days: dayKeys.length, from: dayKeys[0], to: dayKeys[dayKeys.length - 1], level, daily: dayKeys.map((d, i) => ({ date: d, vpd: Math.round(dailyMeans[i] * 100) / 100 })) }
}

export function assessDrought(daily, { today, hourly = null } = {}) {
  const time = daily?.time ?? []
  if (!time.length) return null
  const src = daily.source ?? time.map(() => 'archive')
  const obsIdx = []
  const fcIdx = []
  // Hari ini belum lengkap (nilai harian model = sebagian prakiraan) → dihitung sebagai proyeksi, bukan observasi (praktik BMKG: HTH s.d. hari observasi terakhir).
  time.forEach((t, i) => ((src[i] === 'forecast' || (today && t >= today)) ? fcIdx : obsIdx).push(i))
  if (!obsIdx.length) return null
  const precipObs = obsIdx.map((i) => daily.precipitation_sum?.[i] ?? null)
  const et0Obs = obsIdx.map((i) => daily.et0_fao_evapotranspiration?.[i] ?? null)
  const h = hthDays(precipObs)
  const lastDataDate = h.lastDataIndex >= 0 ? time[obsIdx[h.lastDataIndex]] : null
  const lastRainDate = h.lastRainIndex != null ? time[obsIdx[h.lastRainIndex]] : null
  const lastRainMm = h.lastRainIndex != null ? precipObs[h.lastRainIndex] : null
  const cls = hthClass(h.days)
  const level = hthLevel(h.days)
  const fcPrecip = fcIdx.map((i) => daily.precipitation_sum?.[i] ?? null)
  const proj = projectHth(h.days, fcPrecip)
  const balance = waterBalance(precipObs, et0Obs)
  const vpd7 = hourly ? vpdDaytime(hourly, { today }) : null
  const overall = maxLevel(level, balance.level) // VPD tidak menaikkan level agregat (indikator stres bunga, ditampilkan terpisah)
  const series = obsIdx.slice(-WATER_BALANCE.days).map((i) => ({ date: time[i], rain: daily.precipitation_sum?.[i] ?? null }))
  return {
    hth: {
      days: h.days,
      truncated: h.truncated,
      classKey: cls.key,
      classLabel: cls.label,
      level,
      lastDataDate,
      lastRainDate,
      lastRainMm,
      projected: {
        days: proj.days,
        breaksOn: proj.breaksOnIndex != null ? time[fcIdx[proj.breaksOnIndex]] : null,
        horizonDays: Math.min(fcPrecip.length, HTH.projectionDays),
      },
    },
    balance30: balance,
    vpd7,
    level: overall,
    advice: ADVICE[overall] ?? ADVICE.rendah,
    series,
    thresholds: { rainDayMm: HTH.rainDayMm, balanceWaspada: WATER_BALANCE.waspada, balanceBahaya: WATER_BALANCE.bahaya, vpdWaspada: VPD.waspada, vpdBahaya: VPD.bahaya },
  }
}

// ---------------------------------------------------------------------------
// Modul registry (ADR-12) — adaptor payload /api/drought → HazardResult.
// ---------------------------------------------------------------------------
export default {
  id: 'kekeringan',
  group: 'agro',
  label: { id: 'Kekeringan & Air Kebun' },
  requires: ['drought'],
  evaluate(ctx) {
    const p = ctx.drought
    const a = p?.assessment
    if (!a) return { level: 'n/a', degraded: true, headline: p?.error ? `Kekeringan tidak tersedia (${p.error})` : 'Data kekeringan belum tersedia' }
    const h = a.hth
    const b = a.balance30
    const v = a.vpd7
    const spi = p.spi
    const proj = h.projected?.days > h.days ? ` → proyeksi ${h.projected.days} hari (${h.projected.horizonDays} hari ke depan)` : ''
    // Fase 3.1 — SPI-1/3 (McKee) menaikkan level agregat bila lebih kering dari HTH/neraca; VPD hanya indikator stres bunga.
    const spiLevel = spi?.level ?? 'n/a'
    const level = LEVEL_RANK[spiLevel] > LEVEL_RANK[a.level] ? spiLevel : a.level
    const spiTxt = spi?.spi1 || spi?.spi3 ? ` SPI-1 ${spi.spi1?.value ?? '–'} (${spi.spi1?.classLabel ?? '–'}), SPI-3 ${spi.spi3?.value ?? '–'} (${spi.spi3?.classLabel ?? '–'}) vs baseline ${spi.baseline?.period ?? '1991–2020'}.` : ''
    const vpdTxt = v ? ` VPD siang ${v.days} hari ${v.mean} kPa${v.level !== 'rendah' ? ` (${v.level === 'bahaya' ? 'sangat kering' : 'kering'} untuk pembungaan)` : ''}.` : ''
    const extraAdvice = []
    if (v?.level === 'bahaya') extraAdvice.push('Udara siang sangat kering (VPD > 1,5 kPa): siram/irigasi pagi, naungan sementara untuk kebun berbunga, tunda pemangkasan.')
    else if (v?.level === 'waspada') extraAdvice.push('VPD siang > 0,82 kPa: bunga kopi rentan — jaga kelembapan tanah (mulsa), hindari membuka naungan.')
    if (LEVEL_RANK[spiLevel] >= LEVEL_RANK.waspada) extraAdvice.push(`Hujan ${spi.spi3?.value != null && spi.spi3.value <= (spi.spi1?.value ?? 0) ? '3 bulan' : '1 bulan'} terakhir jauh di bawah normal 30 tahun (SPI ${Math.min(spi.spi1?.value ?? 0, spi.spi3?.value ?? 0)}): rencanakan air baku & kebun untuk kekeringan berkepanjangan.`)
    return {
      level,
      score: h.days != null ? Math.min(100, Math.round((h.days / 60) * 100)) : null,
      headline: `HTH ${h.days} hari — ${h.classLabel}${proj}${LEVEL_RANK[spiLevel] > LEVEL_RANK[a.level] ? ` · SPI ${Math.min(spi.spi1?.value ?? 0, spi.spi3?.value ?? 0)}` : ''}`,
      detail: `Hujan terakhir ${h.lastRainDate ?? '–'}${h.lastRainMm != null ? ` (${h.lastRainMm} mm)` : ''}; neraca air 30 hari ${b?.balance ?? '–'} mm (hujan ${b?.rain ?? '–'} / ET0 ${b?.et0 ?? '–'} mm).${spiTxt}${vpdTxt}${p.archive?.lagDays != null ? ` Arsip tertinggal ${p.archive.lagDays} hari.` : ''}`,
      metrics: [
        { key: 'hthDays', label: 'Hari tanpa hujan', value: h.days, unit: 'hari' },
        { key: 'hthProjected', label: 'Proyeksi HTH', value: h.projected?.days ?? null, unit: 'hari' },
        { key: 'rain30', label: 'Hujan 30 hari', value: b?.rain ?? null, unit: 'mm' },
        { key: 'et0_30', label: 'ET0 30 hari', value: b?.et0 ?? null, unit: 'mm' },
        { key: 'balance30', label: 'Neraca air 30 hari', value: b?.balance ?? null, unit: 'mm' },
        { key: 'spi1', label: 'SPI-1 (30 hari)', value: spi?.spi1?.value ?? null, unit: '' },
        { key: 'spi3', label: 'SPI-3 (90 hari)', value: spi?.spi3?.value ?? null, unit: '' },
        { key: 'vpd7', label: `VPD siang ${v?.days ?? 7} hari`, value: v?.mean ?? null, unit: 'kPa' },
      ],
      advice: { kebun: [...(a.advice ?? []).slice(0, 3), ...extraAdvice] },
      sources: [{ name: p.source?.name ?? 'Open-Meteo Historical (ERA5)', kind: 'reanalysis', retrievedAt: p.retrievedAt, url: p.source?.url }],
      validUntil: p.retrievedAt ? new Date(new Date(p.retrievedAt).getTime() + 12 * 3_600_000).toISOString() : null,
      flags: { classKey: h.classKey, balanceLevel: b?.level ?? null, lagDays: p.archive?.lagDays ?? null, spiLevel, spi1Class: spi?.spi1?.classKey ?? null, spi3Class: spi?.spi3?.classKey ?? null, vpdLevel: v?.level ?? null, spiDegraded: spi ? !!spi.degraded : true },
      degraded: !!p.degraded,
    }
  },
}
