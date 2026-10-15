/**
 * H-API — FWI harian operasional per sentra (FR-API-3 "state harian persisten", roadmap 1.5) untuk GET /api/fire-danger.
 * Pengamatan siang (jam FWI_OPS.obsHourWib WIB): suhu, RH, angin 10 m dari deret jam-an gabungan arsip ERA5 + ECMWF
 * (server/archive.js); hujan = akumulasi 24 jam hingga jam itu. Spin-up ≈ 90 hari dari arsip; proyeksi D+1..D+2 dari prakiraan.
 * State terakhir disimpan di server/data/fwi-state.json (gitignored) sebagai titik awal cadangan bila arsip gagal.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCATIONS } from '../src/data/locations.js'
import { FWI, FWI_OPS, HOTSPOT } from '../src/domain/thresholds.js'
import { runFwiSeries, assessFireDanger, ffmcClass, fwiClass, dcClass, isiClass } from '../src/domain/hazards/fireWeather.js'
import { assessDrought } from '../src/domain/hazards/drought.js'
import { haversineKm } from '../src/domain/hazards/hotspots.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DATA_DIR = path.join(__dirname, 'data')
export const FWI_SOURCE = {
  name: 'FWI System (Van Wagner 1987) dihitung dari ERA5-Land/ERA5 + ECMWF IFS via Open-Meteo',
  url: 'https://cwfis.cfs.nrcan.gc.ca/background/summary/fwi',
  classes: 'FDRS Indonesia (de Groot dkk. 2007; BMKG SPBK)',
}

const isNum = (v) => typeof v === 'number' && Number.isFinite(v)

/**
 * Pengamatan harian "siang" dari deret jam-an { time[], temperature_2m[], relative_humidity_2m[], wind_speed_10m[], precipitation[], source[] }.
 * Hujan = Σ precipitation 24 jam yang berakhir pada jam pengamatan (nilai Open-Meteo = hujan jam sebelumnya).
 * Hari pertama tanpa 24 jam penuh memakai jumlah yang tersedia (ditandai partialRain).
 */
export function dailyNoonObservations(hourly, { hour = FWI_OPS.obsHourWib } = {}) {
  const times = hourly?.time ?? []
  const hh = String(hour).padStart(2, '0')
  const out = []
  for (let i = 0; i < times.length; i++) {
    const t = times[i]
    if (t.slice(11, 13) !== hh) continue
    const temp = hourly.temperature_2m?.[i]
    const rh = hourly.relative_humidity_2m?.[i]
    const wind = hourly.wind_speed_10m?.[i]
    if (![temp, rh, wind].every(isNum)) continue
    const from = Math.max(0, i - 23)
    let rain = 0
    let n = 0
    for (let j = from; j <= i; j++) {
      const p = hourly.precipitation?.[j]
      if (isNum(p)) {
        rain += p
        n++
      }
    }
    out.push({
      date: t.slice(0, 10),
      temp,
      rh: Math.min(100, Math.max(0, rh)),
      wind,
      rain: Math.round(rain * 100) / 100,
      partialRain: n < 24,
      basis: hourly.source?.[i] ?? 'archive',
    })
  }
  return out
}

/** Bagi pengamatan menjadi observasi (≤ hari ini bila jam pengamatan sudah lewat) dan proyeksi. */
export function splitObsForecast(days, { today, nowHourWib, obsHour = FWI_OPS.obsHourWib }) {
  const obs = []
  const fc = []
  for (const d of days) {
    const isToday = d.date === today
    if (d.date < today || (isToday && nowHourWib >= obsHour)) obs.push(d)
    else fc.push(d)
  }
  return { obs, forecast: fc.slice(0, FWI_OPS.forecastDays + 1) }
}

const round1 = (v) => (v == null ? null : Math.round(v * 10) / 10)
const codesOf = (s) => ({ ffmc: round1(s.ffmc), dmc: round1(s.dmc), dc: round1(s.dc), isi: round1(s.isi), bui: round1(s.bui), fwi: round1(s.fwi) })
const classesOf = (s) => ({ ffmc: ffmcClass(s.ffmc), fwi: fwiClass(s.fwi), isi: isiClass(s.isi), dc: dcClass(s.dc) })

/**
 * Hitung deret FWI lengkap dari payload arsip. Murni (tanpa I/O).
 * @returns {{ today, latest, history, forecast, spinUpDays, firstDate, warnings, start }}
 */
export function computeFwi(archivePayload, { now = new Date(), start = FWI.defaultStart } = {}) {
  const warnings = []
  const hourly = archivePayload?.hourly
  if (!hourly?.time?.length) return { today: archivePayload?.today ?? null, latest: null, history: [], forecast: [], spinUpDays: 0, firstDate: null, warnings: ['deret jam-an kosong'], start }
  const today = archivePayload.today
  const nowHourWib = Number(new Date(now.getTime() + 7 * 3600_000).toISOString().slice(11, 13))
  const days = dailyNoonObservations(hourly)
  const { obs, forecast } = splitObsForecast(days, { today, nowHourWib })
  const run = runFwiSeries(obs, { start, keepHistory: true })
  const spinUpDays = run.computedDays
  if (spinUpDays === 0) return { today, latest: null, history: [], forecast: [], spinUpDays: 0, firstDate: null, warnings: ['tidak ada hari pengamatan valid'], start }
  if (spinUpDays < FWI_OPS.minSpinUpDays) warnings.push(`spin-up pendek (${spinUpDays} hari < ${FWI_OPS.minSpinUpDays}); DMC/DC masih dipengaruhi nilai awal`)
  const latestState = run.history[run.history.length - 1]
  const latest = {
    date: latestState.date,
    isToday: latestState.date === today,
    basis: latestState.basis,
    obs: latestState.obs,
    codes: codesOf(latestState),
    classes: classesOf(latestState),
  }
  if (!latest.isToday) warnings.push(`kode terakhir untuk ${latest.date} (pengamatan ${String(FWI_OPS.obsHourWib).padStart(2, '0')}.00 WIB hari ini belum tersedia)`)
  const history = run.history.slice(-FWI_OPS.historyDays).map((h) => ({ date: h.date, basis: h.basis, codes: codesOf(h), classes: classesOf(h), rain: h.obs.rain }))
  // Proyeksi: lanjutkan state dari hari terakhir dengan pengamatan prakiraan.
  const fcRun = runFwiSeries(forecast, { start: { ffmc: latestState.ffmc, dmc: latestState.dmc, dc: latestState.dc }, keepHistory: true })
  const fc = fcRun.history.map((h) => ({ date: h.date, basis: 'forecast', codes: codesOf(h), classes: classesOf(h), obs: h.obs }))
  return { today, latest, history, forecast: fc, spinUpDays, firstDate: run.history[0]?.date ?? null, warnings, start }
}

// ---- state persisten ----
export function stateFilePath(dataDir = DEFAULT_DATA_DIR) {
  return path.join(dataDir, 'fwi-state.json')
}
export function loadState(dataDir = DEFAULT_DATA_DIR) {
  try {
    return JSON.parse(fs.readFileSync(stateFilePath(dataDir), 'utf8'))
  } catch {
    return {}
  }
}
export function saveState(id, entry, dataDir = DEFAULT_DATA_DIR) {
  try {
    fs.mkdirSync(dataDir, { recursive: true })
    const all = loadState(dataDir)
    all[id] = entry
    fs.writeFileSync(stateFilePath(dataDir), JSON.stringify(all, null, 1))
    return true
  } catch {
    return false
  }
}

/** Hotspot ≤ 50 km dari sentra, terurut jarak (bukan sekadar yang "sentra terdekatnya" = sentra ini). */
export function nearestHotspots(list, loc, limit = 5) {
  if (!loc) return []
  return (list ?? [])
    .map((h) => ({ ...h, distanceKm: Math.round(haversineKm(h.lat, h.lon, loc.lat, loc.lon) * 10) / 10 }))
    .filter((h) => h.distanceKm <= HOTSPOT.radiusInfoKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
}

/**
 * Payload /api/fire-danger?location=<id>. Tidak pernah throw.
 * @param {string} id
 * @param {{ archiveGet:(id)=>Promise<object>, hotspotsGet:()=>Promise<object>, now?:Date, dataDir?:string, persist?:boolean }} deps
 */
export async function getFireDanger(id, { archiveGet, hotspotsGet, now = new Date(), dataDir = DEFAULT_DATA_DIR, persist = true }) {
  const loc = LOCATIONS.find((l) => l.id === id) ?? null
  const retrievedAt = new Date().toISOString()
  if (!loc) return { location: null, retrievedAt, degraded: true, error: `Lokasi tidak dikenal: ${id}` }
  const location = { id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon }
  const [aRes, hRes] = await Promise.allSettled([archiveGet(id), hotspotsGet ? hotspotsGet() : Promise.resolve(null)])
  const archive = aRes.status === 'fulfilled' ? aRes.value : null
  const hotspotsAll = hRes.status === 'fulfilled' ? hRes.value : null
  const warnings = []
  if (!archive || archive.degraded) warnings.push(archive?.error ?? archive?.warnings?.join('; ') ?? `arsip gagal: ${aRes.reason?.message ?? aRes.reason}`)
  if (hRes.status === 'rejected') warnings.push(`hotspot gagal: ${hRes.reason?.message ?? hRes.reason}`)

  // Titik awal: state tersimpan bila arsip tidak ada (hanya prakiraan 7 hari) agar DMC/DC tidak mulai dari default.
  const saved = loadState(dataDir)[id] ?? null
  let start = FWI.defaultStart
  let startFrom = 'default'
  if (archive && !archive.archiveEnd && saved?.codes) {
    start = { ffmc: saved.codes.ffmc, dmc: saved.codes.dmc, dc: saved.codes.dc }
    startFrom = `state ${saved.date}`
    warnings.push(`memakai state tersimpan ${saved.date} sebagai titik awal`)
  }
  const fwi = archive?.hourly ? computeFwi(archive, { now, start }) : { today: null, latest: null, history: [], forecast: [], spinUpDays: 0, warnings: ['arsip tidak tersedia'] }
  warnings.push(...(fwi.warnings ?? []))

  const drought = archive?.daily ? assessDrought(archive.daily, { today: archive.today }) : null
  const hs = hotspotsAll?.perLocation?.[id] ?? null
  const assessment = assessFireDanger({ fwi: fwi.latest?.codes ?? null, hotspots: hs, hthDays: drought?.hth?.days ?? null })

  if (persist && fwi.latest) saveState(id, { date: fwi.latest.date, codes: fwi.latest.codes, updatedAt: retrievedAt }, dataDir)

  const hotspots = hotspotsAll
    ? {
        degraded: hotspotsAll.degraded,
        reason: hotspotsAll.reason ?? null,
        retrievedAt: hotspotsAll.retrievedAt,
        summary: hs,
        nearest: nearestHotspots(hotspotsAll.hotspots, loc, 5),
      }
    : { degraded: true, reason: 'layanan hotspot tidak tersedia', summary: null, nearest: [] }

  return {
    location,
    retrievedAt,
    source: { fwi: FWI_SOURCE, archive: archive?.source ?? null, hotspots: hotspotsAll?.source ?? null },
    degraded: !fwi.latest,
    warnings,
    level: assessment.level,
    assessment,
    fwi: {
      obsHourWib: FWI_OPS.obsHourWib,
      equator: FWI.equator,
      spinUpDays: fwi.spinUpDays,
      firstDate: fwi.firstDate ?? null,
      startFrom,
      latest: fwi.latest,
      history: fwi.history,
      forecast: fwi.forecast,
      thresholds: { ffmc: FWI.ffmc, fwi: FWI.fwi, isi: FWI.isi, dc: FWI.dc },
    },
    hotspots,
    hth: drought ? { days: drought.hth.days, classKey: drought.hth.classKey, classLabel: drought.hth.classLabel, level: drought.hth.level, lastRainDate: drought.hth.lastRainDate, projectedDays: drought.hth.projected.days } : null,
    archive: archive ? { archiveEnd: archive.archiveEnd, lagDays: archive.lagDays, degraded: archive.degraded, fromFile: archive.fromFile } : null,
  }
}

/** Ringkasan 15 sentra (?location=all) memakai getter ber-cache; sejajar 3 agar ramah kuota. */
export async function getFireDangerSummary(getter, { concurrency = 3 } = {}) {
  const ids = LOCATIONS.map((l) => l.id)
  const rows = []
  for (let i = 0; i < ids.length; i += concurrency) {
    const chunk = ids.slice(i, i + concurrency)
    const settled = await Promise.allSettled(chunk.map((id) => getter(id)))
    settled.forEach((s, j) => {
      const id = chunk[j]
      const loc = LOCATIONS.find((l) => l.id === id)
      if (s.status === 'fulfilled' && s.value?.fwi?.latest) {
        const v = s.value
        rows.push({
          id,
          name: loc?.name ?? id,
          level: v.level,
          siagaLokal: v.assessment.siagaLokal,
          fwi: v.fwi.latest.codes.fwi,
          ffmc: v.fwi.latest.codes.ffmc,
          dc: v.fwi.latest.codes.dc,
          classes: v.fwi.latest.classes,
          date: v.fwi.latest.date,
          hotspots10km24h: v.hotspots?.summary?.within10km24h ?? null,
          hotspots25km24h: v.hotspots?.summary?.within25km24h ?? null,
          hthDays: v.hth?.days ?? null,
          degraded: false,
        })
      } else {
        rows.push({ id, name: loc?.name ?? id, level: null, degraded: true })
      }
    })
  }
  const ok = rows.filter((r) => !r.degraded)
  const rank = { rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  const worst = ok.length ? ok.reduce((a, b) => (rank[b.level] > rank[a.level] || (rank[b.level] === rank[a.level] && b.fwi > a.fwi) ? b : a)) : null
  return {
    retrievedAt: new Date().toISOString(),
    source: FWI_SOURCE,
    count: rows.length,
    degradedCount: rows.length - ok.length,
    worst: worst ? { id: worst.id, name: worst.name, level: worst.level, fwi: worst.fwi, ffmc: worst.ffmc } : null,
    siagaLokalCount: ok.filter((r) => r.siagaLokal).length,
    locations: rows,
  }
}
