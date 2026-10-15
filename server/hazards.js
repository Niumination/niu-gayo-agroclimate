// Fase 0/1.10b — evaluasi registry bahaya di sisi server (ADR-12) + arsip harian level per sentra (FR-X-10).
// Semua fetcher disuntikkan (dependency injection) agar dapat diuji tanpa jaringan; tidak pernah throw per lokasi.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCATIONS } from '../src/data/locations.js'
import { weatherFeatures } from '../src/domain/hazards/features.js'
import { evaluateAll, summarize, parseEnabled, HAZARD_IDS } from '../src/domain/hazards/index.js'
import { assessDrought } from '../src/domain/hazards/drought.js'
import { HAZARDS_ENABLED } from './config.js'
import { computeSpi } from './spi.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_ARCHIVE_DIR = path.join(__dirname, 'data', 'hazard-archive')

const settle = (p) => Promise.resolve(p).then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }))

/**
 * Evaluasi semua bahaya untuk satu sentra.
 * @param {string} id lokasi
 * @param {object} deps { weatherGet, aqGet, fireGet, archiveGet, reportsGet, quakesGet, volcanoGet, convectiveGet, floodGet, nowcastGet, spiBaseline, now, enabled }
 */
export async function getHazardsForLocation(id, deps = {}) {
  const { weatherGet, aqGet, fireGet, archiveGet, reportsGet, quakesGet, volcanoGet, convectiveGet, floodGet, nowcastGet, spiBaseline = null, now = new Date().toISOString(), enabled = parseEnabled(HAZARDS_ENABLED) } = deps
  const location = LOCATIONS.find((l) => l.id === id)
  const retrievedAt = new Date().toISOString()
  if (!location) return { location: null, retrievedAt, degraded: true, error: `Lokasi tidak dikenal: ${id}` }

  const [w, aq, fire, arch, rep, qk, vol, conv, fld, nc] = await Promise.all([
    weatherGet ? settle(weatherGet(id)) : { ok: false, error: new Error('weatherGet tidak tersedia') },
    aqGet ? settle(aqGet(id)) : { ok: false },
    fireGet ? settle(fireGet(id)) : { ok: false },
    archiveGet ? settle(archiveGet(id)) : { ok: false },
    reportsGet ? settle(reportsGet(id)) : { ok: false },
    quakesGet ? settle(quakesGet(id)) : { ok: false },       // Fase 2.1 H-GEMPA
    volcanoGet ? settle(volcanoGet()) : { ok: false },       // Fase 2.2b H-VULKANIK
    convectiveGet ? settle(convectiveGet(id)) : { ok: false }, // Fase 2.3 H-PETIR
    floodGet ? settle(floodGet()) : { ok: false },           // Fase 2.4 H-BANJIR+ (GloFAS)
    nowcastGet ? settle(nowcastGet()) : { ok: false },       // F5 BMKG nowcast (pengubah ekstrem badai/longsor)
  ])
  const warnings = []
  const raw = w.ok ? w.value?.raw ?? w.value : null
  const weather = raw ? weatherFeatures(raw) : null
  if (!weather) warnings.push(`cuaca: ${w.error?.message ?? 'deret kosong'}`)
  let drought = null
  if (arch.ok && arch.value?.daily) {
    const assessment = assessDrought(arch.value.daily, { today: arch.value.today, hourly: arch.value.hourly })
    const spi = computeSpi(arch.value.daily, spiBaseline?.locations?.[id], { today: arch.value.today })
    drought = { location, retrievedAt, source: arch.value.source, degraded: !assessment || arch.value.degraded, archive: { archiveEnd: arch.value.archiveEnd, lagDays: arch.value.lagDays }, assessment, spi }
  } else warnings.push(`arsip: ${arch.error?.message ?? 'tidak tersedia'}`)
  if (!aq.ok) warnings.push(`udara: ${aq.error?.message ?? 'tidak tersedia'}`)
  if (!fire.ok) warnings.push(`kebakaran: ${fire.error?.message ?? 'tidak tersedia'}`)
  if (quakesGet && !qk.ok) warnings.push(`gempa: ${qk.error?.message ?? 'tidak tersedia'}`)
  if (volcanoGet && !vol.ok) warnings.push(`vulkanik: ${vol.error?.message ?? 'tidak tersedia'}`)
  if (convectiveGet && !conv.ok) warnings.push(`konvektif: ${conv.error?.message ?? 'tidak tersedia'}`)
  if (floodGet && !fld.ok) warnings.push(`debit: ${fld.error?.message ?? 'tidak tersedia'}`)

  const nowIso = weather?.nowTime ? toIsoWib(weather.nowTime) : now
  const ctx = {
    location,
    now: nowIso,
    weather,
    ari: weather ? { ari24: weather.rain24, ari72: weather.rain72, source: 'model-ecmwf' } : null,
    airQuality: aq.ok ? aq.value : null,
    fireDanger: fire.ok ? fire.value : null,
    drought,
    reports: rep.ok ? rep.value?.reports ?? rep.value ?? [] : [],
    quakes: qk.ok ? qk.value : null,
    volcano: vol.ok ? vol.value : null,
    convective: conv.ok ? conv.value : null,
    flood: fld.ok ? fld.value : null,
    bmkgNowcast: nc.ok ? nc.value : null,
  }
  const evaluated = evaluateAll(ctx, { enabled })
  return {
    location: { id: location.id, name: location.name, lat: location.lat, lon: location.lon, kecamatan: location.kecamatan ?? null },
    retrievedAt,
    evaluatedAt: nowIso,
    enabled,
    degraded: evaluated.counts.degraded === evaluated.counts.total,
    warnings,
    worst: evaluated.worst,
    counts: evaluated.counts,
    active: evaluated.active.map((r) => r.id),
    hazards: evaluated.results,
    summary: summarize(evaluated),
  }
}

/** "2026-10-15T17:00" (WIB, tanpa offset — format Open-Meteo timezone=Asia/Jakarta) → ISO UTC. */
export function toIsoWib(local) {
  if (!local) return null
  if (/Z$|[+-]\d\d:\d\d$/.test(local)) return new Date(local).toISOString()
  const d = new Date(`${local}:00+07:00`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Ringkasan 15 sentra (untuk /api/hazards?location=all, cron alert, peta skematik).
 * @param {(id:string)=>Promise<object>} getter biasanya getHazardsForLocation terbungkus cache
 */
export async function getHazardsAll(getter, { concurrency = 4, locations = LOCATIONS } = {}) {
  const rows = []
  const queue = locations.map((l) => l.id)
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      const id = queue.shift()
      try {
        const v = await getter(id)
        rows.push({ id, name: v.location?.name ?? id, worst: v.worst ?? 'n/a', active: v.active ?? [], levels: v.summary?.levels ?? {}, degraded: !!v.degraded, counts: v.counts ?? null, evaluatedAt: v.evaluatedAt ?? null, hazards: v.hazards ?? [] })
      } catch (err) {
        rows.push({ id, name: locations.find((l) => l.id === id)?.name ?? id, worst: 'n/a', active: [], levels: {}, degraded: true, error: err.message, hazards: [] })
      }
    }
  })
  await Promise.all(workers)
  const order = new Map(locations.map((l, i) => [l.id, i]))
  rows.sort((a, b) => order.get(a.id) - order.get(b.id))
  const rank = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  const worstRow = rows.reduce((best, r) => (!best || rank[r.worst] > rank[best.worst] ? r : best), null)
  const byHazard = Object.fromEntries(HAZARD_IDS.map((h) => [h, rows.filter((r) => rank[r.levels[h]] >= 1).map((r) => r.id)]))
  return {
    retrievedAt: new Date().toISOString(),
    total: rows.length,
    degradedCount: rows.filter((r) => r.degraded).length,
    worst: worstRow ? { id: worstRow.id, name: worstRow.name, level: worstRow.worst, active: worstRow.active } : null,
    activeByHazard: byHazard,
    locations: rows.map(({ hazards, ...r }) => r),
    _full: rows, // dengan hasil lengkap per bahaya (dipakai cron alert; dibuang oleh route publik)
  }
}

/** Nama file arsip untuk tanggal WIB. */
export function archiveFileFor(now, dir = DEFAULT_ARCHIVE_DIR) {
  const date = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(now))
  return { date, file: path.join(dir, `${date}.json`) }
}

/**
 * FR-X-10 / roadmap 1.10b — simpan cuplikan level per sentra ke arsip harian (maks. 1 cuplikan per sentra per jam WIB).
 * Format: { date, snapshots: [{ at, hour, location, worst, levels, active }] }
 */
export function archiveSnapshot(all, { now = new Date().toISOString(), dir = DEFAULT_ARCHIVE_DIR } = {}) {
  const { date, file } = archiveFileFor(now, dir)
  fs.mkdirSync(dir, { recursive: true })
  let doc = { date, snapshots: [] }
  try {
    const prev = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (prev?.snapshots) doc = prev
  } catch { /* file baru */ }
  const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }).format(new Date(now)))
  let added = 0
  for (const r of all.locations ?? []) {
    if (r.degraded && !Object.keys(r.levels ?? {}).length) continue
    if (doc.snapshots.some((s) => s.location === r.id && s.hour === hour)) continue
    doc.snapshots.push({ at: now, hour, location: r.id, worst: r.worst, levels: r.levels, active: r.active })
    added++
  }
  if (added) fs.writeFileSync(file, JSON.stringify(doc))
  return { file, date, added, total: doc.snapshots.length }
}

/** Baca arsip N hari terakhir (untuk validasi musiman / KPI docs/dev/08). */
export function readArchive({ days = 7, now = new Date().toISOString(), dir = DEFAULT_ARCHIVE_DIR } = {}) {
  const out = []
  for (let i = 0; i < days; i++) {
    const t = new Date(new Date(now).getTime() - i * 86_400_000).toISOString()
    const { date, file } = archiveFileFor(t, dir)
    try {
      out.push(JSON.parse(fs.readFileSync(file, 'utf8')))
    } catch {
      out.push({ date, snapshots: [], missing: true })
    }
  }
  return out
}
