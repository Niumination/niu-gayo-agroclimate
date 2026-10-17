/**
 * H-ASAP — penilaian kualitas udara & kabut asap (Fase 1, item 1.2–1.3).
 * Fungsi murni; dipakai server (server/airQuality.js) dan bisa dipakai klien.
 *
 * Masukan sudah dinormalkan (lihat server/airQuality.js#normalizeAirQuality):
 *   current    : { time, pm2_5, pm10, carbon_monoxide, aerosol_optical_depth, dust, us_aqi }
 *   hourly     : { time[], pm2_5[], pm10[], carbon_monoxide[], aerosol_optical_depth[] }  (past_days=1 + prakiraan)
 *   visibility : { time[], visibility[] (meter), relative_humidity_2m[]?, direct_normal_irradiance[]? } (best_match, opsional)
 *   nowIso     : 'YYYY-MM-DDTHH:00' waktu lokal (Asia/Jakarta); default current.time
 *
 * Prinsip: ISPU resmi = rata-rata 24 jam (PM) / 8 jam (CO) → dihitung dari deret jam-an, bukan nilai sesaat.
 * Jarak pandang hanya dievaluasi pada jendela siang (10–17 WIB), jam ber-RH ≥ 90 % diabaikan (kabut),
 * dan wajib didukung PM2,5/AOD (kabut radiasi lembah 120–1.200 m pukul 05–09 WIB bukan asap).
 * Semua angka berlabel "estimasi model CAMS global (~40 km), bukan ISPU resmi".
 */
import healthAdvice from '../../data/hazards/healthAdvice.json' with { type: 'json' }
import { ispuComposite, ispuCategory, rollingMean } from './ispu.js'
import { ISPU, HAZE } from '../thresholds.js'
import { bumpLevel } from './levels.js'

export const LEVEL_RANK = { rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
export const PARAM_LABEL = { pm25: 'PM2,5', pm10: 'PM10', co: 'CO' }
export const MODEL_LABEL = 'CAMS global (~40 km)'
export const HAZE_LABEL = {
  tidak_ada: 'Tidak ada',
  ringan: 'Kabut asap ringan',
  tebal: 'Kabut asap tebal',
  sangat_tebal: 'Kabut asap sangat tebal',
  tidak_diketahui: 'Tidak diketahui',
}

const hourOf = (iso) => Number(String(iso).slice(11, 13))
const dateOf = (iso) => String(iso).slice(0, 10)
const maxLevel = (a, b) => (LEVEL_RANK[b] > LEVEL_RANK[a] ? b : a)
const txt = (node) => (node ? node.id ?? null : null)

/** Indeks jam `nowIso` dalam deret; bila tidak persis, ambil jam terakhir ≤ now. -1 jika tidak ada. */
export function indexAt(times, nowIso) {
  if (!Array.isArray(times) || !times.length || !nowIso) return -1
  const exact = times.indexOf(nowIso)
  if (exact >= 0) return exact
  let idx = -1
  for (let i = 0; i < times.length; i++) if (times[i] <= nowIso) idx = i
  return idx
}

/** ISPU rata-rata 24 jam (PM2,5/PM10) & 8 jam (CO) yang berakhir pada `nowIso`. null bila deret kosong. */
export function compute24hIspu(hourly, nowIso) {
  const times = hourly?.time ?? []
  const idx = indexAt(times, nowIso)
  if (idx < 0) return null
  const pm25 = rollingMean(hourly.pm2_5, idx, { hours: 24, minHours: ISPU.minHours24h })
  const pm10 = rollingMean(hourly.pm10, idx, { hours: 24, minHours: ISPU.minHours24h })
  const co = rollingMean(hourly.carbon_monoxide, idx, { hours: 8, minHours: 6 })
  const comp = ispuComposite({ pm25: pm25.mean, pm10: pm10.mean, co: co.mean })
  if (!comp) return null
  return {
    ...comp,
    paramLabel: PARAM_LABEL[comp.param],
    basis: '24h',
    endTime: times[idx],
    hours: pm25.hours,
    partial: pm25.partial,
    means: { pm25: pm25.mean, pm10: pm10.mean, co: co.mean },
  }
}

/**
 * Proksi kabut asap dari jarak pandang minimum pada jendela siang hari `nowIso`.
 * Jam dengan RH ≥ HAZE.fogRhMax dikecualikan (kabut/mist). supported = PM2,5 ≥ HAZE.pm25Support ATAU
 * AOD ≥ HAZE.aodSupport; tanpa dukungan → level tetap 'tidak_ada' dan ditandai lowVisibilityNonSmoke.
 * persistentHours = jumlah jam (tersaring) dengan jarak pandang < HAZE.visTebalKm.
 */
export function assessHaze({ visibility, pm25, aod, nowIso } = {}) {
  const times = visibility?.time ?? []
  const vis = visibility?.visibility ?? []
  const rh = Array.isArray(visibility?.relative_humidity_2m) ? visibility.relative_humidity_2m : null
  const date = dateOf(nowIso)
  const idxs = []
  let fogHours = 0
  times.forEach((t, i) => {
    const h = hourOf(t)
    if (dateOf(t) !== date || h < HAZE.dayStartHour || h > HAZE.dayEndHour || vis[i] == null) return
    if (rh && rh[i] != null && rh[i] >= HAZE.fogRhMax) {
      fogHours++
      return
    }
    idxs.push(i)
  })
  const supported = (pm25 != null && pm25 >= HAZE.pm25Support) || (aod != null && aod >= HAZE.aodSupport)
  const base = {
    windowLabel: `${String(HAZE.dayStartHour).padStart(2, '0')}–${HAZE.dayEndHour} WIB`,
    supported,
    supportReason: supported
      ? pm25 != null && pm25 >= HAZE.pm25Support
        ? `PM2,5 ${Math.round(pm25)} µg/m³ ≥ ${HAZE.pm25Support}`
        : `AOD ${aod} ≥ ${HAZE.aodSupport}`
      : null,
    fogHours,
  }
  if (!idxs.length) {
    return { ...base, level: 'tidak_diketahui', label: HAZE_LABEL.tidak_diketahui, rawLevel: null, visibilityKm: null, time: null, lowVisibilityNonSmoke: false, hours: 0, persistentHours: 0 }
  }
  let minI = idxs[0]
  for (const i of idxs) if (vis[i] < vis[minI]) minI = i
  const minVis = vis[minI]
  let raw = 'tidak_ada'
  if (minVis < HAZE.visSangatTebalKm * 1000) raw = 'sangat_tebal'
  else if (minVis < HAZE.visTebalKm * 1000) raw = 'tebal'
  else if (minVis < HAZE.visRinganKm * 1000) raw = 'ringan'
  const level = raw !== 'tidak_ada' && supported ? raw : 'tidak_ada'
  return {
    ...base,
    level,
    label: HAZE_LABEL[level],
    rawLevel: raw,
    lowVisibilityNonSmoke: raw !== 'tidak_ada' && !supported,
    visibilityKm: Math.round(minVis / 100) / 10,
    time: times[minI],
    hours: idxs.length,
    persistentHours: idxs.filter((i) => vis[i] < HAZE.visTebalKm * 1000).length,
  }
}

/** Eskalasi level dari kabut asap: sangat tebal & persisten (≥ HAZE.persistHours jam < 2 km) → bahaya; tebal / sangat tebal sesaat → waspada. */
export function hazeLevel(haze) {
  if (!haze) return 'rendah'
  if (haze.level === 'sangat_tebal') return (haze.persistentHours ?? 0) >= HAZE.persistHours ? 'bahaya' : 'waspada'
  if (haze.level === 'tebal') return 'waspada'
  return 'rendah'
}

/** Prospek 24 jam ke depan: puncak ISPU (rata-rata bergerak 24 jam PM2,5/PM10) & tren +12 jam. */
export function computeOutlook(hourly, nowIso) {
  const times = hourly?.time ?? []
  const idx = indexAt(times, nowIso)
  if (idx < 0) return null
  let peak = null
  const at = (i) => {
    const pm25 = rollingMean(hourly.pm2_5, i, { hours: 24, minHours: 1 }).mean
    const pm10 = rollingMean(hourly.pm10, i, { hours: 24, minHours: 1 }).mean
    return ispuComposite({ pm25, pm10 })
  }
  const nowComp = at(idx)
  for (let i = idx + 1; i <= Math.min(idx + 24, times.length - 1); i++) {
    const c = at(i)
    if (c && (!peak || c.index > peak.index)) peak = { index: c.index, time: times[i], category: c.category }
  }
  const slim = (cat) => (cat ? { key: cat.key, label: cat.label, color: cat.color, level: cat.level } : null)
  const later = at(Math.min(idx + 12, times.length - 1))
  let trend = 'stabil'
  if (nowComp && later) {
    const d = later.index - nowComp.index
    if (d >= 10) trend = 'naik'
    else if (d <= -10) trend = 'turun'
  }
  return { peakIndex: peak?.index ?? nowComp?.index ?? null, peakTime: peak?.time ?? null, peakCategory: slim(peak?.category ?? nowComp?.category), trend }
}

/** Anjuran 4 kelompok dari src/data/hazards/healthAdvice.json untuk kunci kategori ISPU. */
export function adviceFor(categoryKey, ) {
  const cats = healthAdvice.categories
  const cat = cats.find((c) => c.key === categoryKey) ?? cats[0]
  const rank = cats.findIndex((c) => c.key === cat.key)
  const minCross = cats.findIndex((c) => c.key === healthAdvice.crossCutting.minCategory)
  const showCross = rank >= minCross
  return {
    key: cat.key,
    label: txt(cat.label),
    policy: txt(cat.policy),
    whoNote: txt(cat.whoNote),
    groups: Object.fromEntries(Object.entries(cat.advice).map(([g, node]) => [g, txt(node)])),
    groupLabels: healthAdvice._meta.groups,
    crossCutting: showCross ? healthAdvice.crossCutting.items.map((n) => txt(n)) : [],
    cleanRoom: showCross,
    cleanRoomTitle: txt(healthAdvice.cleanRoomChecklist.title),
    cleanRoomItems: showCross ? healthAdvice.cleanRoomChecklist.items.map((n) => txt(n)) : [],
  }
}

/** Aturan penjemuran/kerja kebun saat asap (healthAdvice.coffeeDrying.rule). */
export function coffeeHazeRule({ ispuIndex, aod, dniDayMax }) {
  const dryingHold = (ispuIndex != null && ispuIndex >= ISPU.sedang + 1) || (aod != null && aod >= 1.0 && dniDayMax != null && dniDayMax < 300)
  const fieldWorkHold = ispuIndex != null && ispuIndex >= ISPU.tidakSehat + 1
  return { dryingHold, fieldWorkHold, reason: dryingHold ? healthAdvice.coffeeDrying.reason.id : null }
}

/** DNI maksimum pada jendela siang hari `nowIso` (dari deret best_match), null bila tak ada. */
function dniDayMax(visibility, nowIso) {
  const times = visibility?.time ?? []
  const dni = visibility?.direct_normal_irradiance
  if (!Array.isArray(dni)) return null
  const date = dateOf(nowIso)
  let max = null
  times.forEach((t, i) => {
    const h = hourOf(t)
    if (dateOf(t) === date && h >= HAZE.dayStartHour && h <= HAZE.dayEndHour && dni[i] != null) max = max == null ? dni[i] : Math.max(max, dni[i])
  })
  return max
}

/** Penilaian lengkap. Mengembalikan null bila tidak ada data sama sekali. */
export function assessAirQuality({ current, hourly, visibility, nowIso,  } = {}) {
  if (!current && !hourly?.time?.length) return null
  const now = nowIso ?? current?.time ?? hourly.time[hourly.time.length - 1]
  const ispu24 = compute24hIspu(hourly, now)
  const instant = current
    ? ispuComposite({ pm25: current.pm2_5, pm10: current.pm10, co: current.carbon_monoxide })
    : null
  const headline = ispu24 ?? (instant ? { ...instant, paramLabel: PARAM_LABEL[instant.param], basis: 'sesaat', partial: true, hours: 1, means: null } : null)
  if (!headline) return null

  const hIdx = indexAt(hourly?.time ?? [], now)
  const aod = current?.aerosol_optical_depth ?? (hIdx >= 0 ? hourly?.aerosol_optical_depth?.[hIdx] : null) ?? null
  const pm25Now = current?.pm2_5 ?? (hIdx >= 0 ? hourly?.pm2_5?.[hIdx] : null) ?? null
  const pm25ForHaze = Math.max(headline.means?.pm25 ?? 0, pm25Now ?? 0) || null

  const haze = assessHaze({ visibility, pm25: pm25ForHaze, aod, nowIso: now })
  const level = maxLevel(headline.category.level, hazeLevel(haze))
  const outlook = computeOutlook(hourly, now)
  const advice = adviceFor(headline.category.key)
  const coffee = coffeeHazeRule({ ispuIndex: headline.index, aod, dniDayMax: dniDayMax(visibility, now) })
  const pm25Daily = headline.means?.pm25 ?? pm25Now

  return {
    time: now,
    level,
    ispu: {
      index: headline.index,
      param: headline.param,
      paramLabel: headline.paramLabel,
      category: { key: headline.category.key, label: headline.category.label, color: headline.category.color, level: headline.category.level },
      basis: headline.basis,
      hours: headline.hours,
      partial: headline.partial,
      means: headline.means,
      sub: headline.sub,
    },
    instant: instant ? { index: instant.index, param: instant.param, category: { key: instant.category.key, label: instant.category.label } } : null,
    measurements: {
      time: current?.time ?? now,
      pm25: pm25Now,
      pm10: current?.pm10 ?? (hIdx >= 0 ? hourly?.pm10?.[hIdx] : null) ?? null,
      co: current?.carbon_monoxide ?? (hIdx >= 0 ? hourly?.carbon_monoxide?.[hIdx] : null) ?? null,
      aod,
      dust: current?.dust ?? null,
      usAqi: current?.us_aqi ?? null,
    },
    haze,
    outlook,
    advice,
    coffee,
    who: { pm25Daily: ISPU.whoPm25Daily, exceeded: pm25Daily != null && pm25Daily > ISPU.whoPm25Daily },
    flags: { estimate: true, model: MODEL_LABEL, partial: !!headline.partial, visibilityAvailable: haze.level !== 'tidak_diketahui' },
  }
}

/** Ringkasan pendek untuk daftar semua sentra / peringatan. */
export function summarizeAirQuality(a) {
  if (!a) return null
  return { level: a.level, ispu: a.ispu.index, category: a.ispu.category.label, categoryKey: a.ispu.category.key, param: a.ispu.paramLabel, haze: a.haze.level, visibilityKm: a.haze.visibilityKm, partial: a.ispu.partial }
}

export { ispuCategory }

// ---------------------------------------------------------------------------
// Modul registry (ADR-12) — adaptor payload /api/air-quality → HazardResult.
// Eskalasi laporan warga (docs/dev/06 §2): ≥ 3 laporan `asap` "< 1 km" dalam 6 jam di sentra → +1 level (maks. bahaya).
// ---------------------------------------------------------------------------
export const ASAP_REPORT_ESCALATION = { minReports: 3, windowHours: 6, visibility: '<1km' }

export function asapReportEscalation(reports, now = new Date()) {
  const list = Array.isArray(reports) ? reports : reports?.reports ?? []
  const cutoff = new Date(now).getTime() - ASAP_REPORT_ESCALATION.windowHours * 3_600_000
  const hits = list.filter((r) => r?.type === 'asap' && r.visibility === ASAP_REPORT_ESCALATION.visibility && new Date(r.timestamp ?? r.ts ?? r.createdAt ?? 0).getTime() >= cutoff)
  return { count: hits.length, escalate: hits.length >= ASAP_REPORT_ESCALATION.minReports }
}

/** healthAdvice {groups:{umum,rentan,kebun,sekolah}: string, crossCutting[], policy, cleanRoomItems[]} → advice {umum[],rentan[],kebun[],sekolah[]} (kontrak §2.1). */
export function adviceGroups(adv) {
  if (!adv) return {}
  const g = adv.groups && !Array.isArray(adv.groups) ? adv.groups : {}
  const out = {}
  for (const k of ['umum', 'rentan', 'kebun', 'sekolah']) {
    const items = []
    if (g[k]) items.push(g[k])
    if (k === 'umum') {
      if (adv.policy) items.push(adv.policy)
      for (const c of adv.crossCutting ?? []) items.push(typeof c === 'string' ? c : c?.id ?? String(c))
    }
    if (k === 'rentan' && adv.cleanRoom && Array.isArray(adv.cleanRoomItems)) items.push(...adv.cleanRoomItems.slice(0, 2))
    if (items.length) out[k] = items
  }
  return out
}

export default {
  id: 'asap',
  group: 'atmosfer',
  label: { id: 'Kabut Asap & Udara' },
  requires: ['airQuality'],
  evaluate(ctx) {
    const p = ctx.airQuality
    const a = p?.assessment
    if (!a) return { level: 'n/a', degraded: true, headline: p?.error ? `Kualitas udara tidak tersedia (${p.error})` : 'Kualitas udara belum tersedia', sources: p?.source ? [{ name: p.source.name, kind: 'model' }] : [] }
    const esc = asapReportEscalation(ctx.reports, ctx.now ?? new Date())
    let level = maxLevel(a.level, hazeLevel(a.haze))
    if (esc.escalate) level = bumpLevel(level, 1, 'bahaya')
    const hazeTxt = a.haze?.level && a.haze.level !== 'tidak_ada' && a.haze.level !== 'tidak_diketahui' ? ` · ${a.haze.label ? a.haze.label.toLowerCase() : `kabut asap ${a.haze.level}`}${a.haze.visibilityKm != null ? ` (${a.haze.visibilityKm} km)` : ''}` : ''
    return {
      level,
      score: a.ispu?.index ?? null,
      headline: `Udara ${a.ispu.category.label.toLowerCase()} · ${a.ispu.paramLabel}${hazeTxt}`,
      detail: `Indeks Standar Pencemar Udara (ISPU) ${a.ispu.index} — ${a.ispu.category.label}. ${a.ispu.basis === 'sesaat' ? 'Nilai sesaat' : `Rata-rata ${a.ispu.hours} jam`}; PM2,5 ${a.measurements?.pm25 ?? '–'} µg/m³, AOD ${a.measurements?.aod ?? '–'}. ${a.outlook?.peakIndex != null ? `Prospek puncak ISPU ${a.outlook.peakIndex} (${a.outlook.trend}).` : ''}${esc.escalate ? ` Dinaikkan 1 tingkat: ${esc.count} laporan warga jarak pandang < 1 km dalam 6 jam.` : ''}`.trim(),
      metrics: [
        { key: 'ispu', label: 'ISPU', value: a.ispu.index, unit: '' },
        { key: 'pm25', label: 'PM2,5', value: a.measurements?.pm25 ?? null, unit: 'µg/m³' },
        { key: 'pm10', label: 'PM10', value: a.measurements?.pm10 ?? null, unit: 'µg/m³' },
        { key: 'aod', label: 'AOD', value: a.measurements?.aod ?? null, unit: '' },
        { key: 'visibilityKm', label: 'Jarak pandang siang min.', value: a.haze?.visibilityKm ?? null, unit: 'km' },
      ],
      advice: adviceGroups(a.advice),
      sources: [{ name: p.source?.name ?? 'CAMS global via Open-Meteo', kind: 'model', retrievedAt: p.retrievedAt, url: p.source?.url }],
      validUntil: p.retrievedAt ? new Date(new Date(p.retrievedAt).getTime() + 3 * 3_600_000).toISOString() : null,
      flags: { estimate: true, hazeLevel: a.haze?.level ?? null, dryingHold: !!a.coffee?.dryingHold, fieldWorkHold: !!a.coffee?.fieldWorkHold, reportEscalation: esc },
      degraded: !!p.degraded,
    }
  },
}
