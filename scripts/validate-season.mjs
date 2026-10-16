#!/usr/bin/env node
/**
 * 1.10b / FR-X-10 / 4.2 — validasi musiman: bandingkan arsip level harian (server/data/hazard-archive/YYYY-MM-DD.json)
 * dengan "kejadian" (laporan warga server/data/reports.json dan/atau berkas kejadian terkurasi --events <json>)
 * → hit rate (POD), false alarm ratio (FAR), rasio hari aktif, per bahaya & per sentra. Keluaran Markdown (stdout) + JSON (--out).
 *
 *   node scripts/validate-season.mjs [--days 120] [--min waspada|bahaya] [--events docs/validation/events-2026.json] [--out server/data/validation-<tgl>.json]
 *
 * Definisi (docs/reference/VALIDATION.md):
 *  - Hari-sentra "aktif" = ada snapshot dengan level bahaya ≥ --min (default waspada) pada tanggal itu.
 *  - Kejadian = laporan warga tipe = id bahaya (atau pemetaan: abu/gas → vulkanik; badai → badai) ATAU kejadian terkurasi
 *    { date:'YYYY-MM-DD', location:'<id>'|'*', hazard:'<id>', source:'BPBD|BMKG|media', note }.
 *  - HIT: kejadian pada hari H dengan status aktif pada H atau H−1 (lead ≤ 1 hari). MISS: kejadian tanpa status aktif.
 *  - FALSE ALARM: hari-sentra aktif tanpa kejadian pada H, H+1 (toleransi laporan terlambat 1 hari).
 *  - Catatan: laporan warga jarang → FAR cenderung tinggi; gunakan kejadian terkurasi BPBD untuk evaluasi resmi (08-STAKEHOLDERS KPI).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readArchive, DEFAULT_ARCHIVE_DIR } from '../server/hazards.js'
import { HAZARD_IDS } from '../src/domain/hazards/index.js'
import { LOCATIONS } from '../src/data/locations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true] : null)).filter(Boolean))
const days = Number(args.days || 120)
const minLevel = args.min || 'waspada'
const RANK = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const REPORT_TO_HAZARD = { abu: 'vulkanik', gas: 'vulkanik' }

const shift = (d, n) => new Date(new Date(`${d}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10)

export function collectActive(archiveDocs, min = 'waspada') {
  const active = new Map() // key `${date}|${loc}|${hazard}` → maxLevel
  for (const doc of archiveDocs) {
    for (const s of doc.snapshots ?? []) {
      for (const [hz, lvl] of Object.entries(s.levels ?? {})) {
        if (RANK[lvl] >= RANK[min]) {
          const k = `${doc.date}|${s.location}|${hz}`
          if (RANK[lvl] > RANK[active.get(k) ?? 'n/a']) active.set(k, lvl)
        }
      }
    }
  }
  return active
}

export function collectEvents({ reports = [], curated = [] }) {
  const ev = []
  for (const r of reports) {
    const hz = REPORT_TO_HAZARD[r.type] ?? r.type
    if (!HAZARD_IDS.includes(hz) || !r.timestamp) continue
    ev.push({ date: new Date(r.timestamp).toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' }), location: r.location, hazard: hz, source: 'warga', note: r.note ?? '' })
  }
  for (const c of curated) if (c.date && c.hazard) ev.push({ date: c.date, location: c.location ?? '*', hazard: c.hazard, source: c.source ?? 'kurasi', note: c.note ?? '' })
  return ev
}

/** Hitung metrik per bahaya (dan per sentra). */
export function score({ active, events, dates, locations = LOCATIONS.map((l) => l.id), hazards = HAZARD_IDS }) {
  const perHazard = {}
  for (const hz of hazards) {
    const evs = events.filter((e) => e.hazard === hz)
    let hits = 0
    let misses = 0
    const matchedActive = new Set()
    for (const e of evs) {
      const locs = e.location === '*' ? locations : [e.location]
      let hit = false
      for (const loc of locs) for (const d of [e.date, shift(e.date, -1)]) {
        const k = `${d}|${loc}|${hz}`
        if (active.has(k)) { hit = true; matchedActive.add(k); matchedActive.add(`${shift(d, 1)}|${loc}|${hz}`) }
      }
      hit ? hits++ : misses++
    }
    let activeDays = 0
    let falseAlarms = 0
    for (const [k] of active) {
      if (!k.endsWith(`|${hz}`)) continue
      activeDays++
      const [d, loc] = k.split('|')
      const near = [d, shift(d, 1)].some((dd) => events.some((e) => e.hazard === hz && e.date === dd && (e.location === '*' || e.location === loc)))
      if (!near) falseAlarms++
    }
    const possible = dates.length * locations.length
    perHazard[hz] = {
      events: evs.length,
      hits,
      misses,
      pod: evs.length ? Math.round((hits / evs.length) * 100) : null,
      activeDays,
      falseAlarms,
      far: activeDays ? Math.round((falseAlarms / activeDays) * 100) : null,
      activeRatio: possible ? Math.round((activeDays / possible) * 1000) / 10 : null,
    }
  }
  return perHazard
}

export function toMarkdown(result) {
  const lines = [`# Validasi musiman — ${result.from} → ${result.to} (${result.days} hari, ambang ≥ ${result.minLevel})`, '', `Arsip tersedia: ${result.archiveDays} hari · snapshot: ${result.snapshots} · kejadian: ${result.events} (warga ${result.eventsBysource.warga ?? 0}, kurasi ${result.events - (result.eventsBysource.warga ?? 0)})`, '', '| Bahaya | Kejadian | Hit | Miss | POD % | Hari-sentra aktif | False alarm | FAR % | Rasio aktif % |', '|---|---:|---:|---:|---:|---:|---:|---:|---:|']
  for (const [hz, m] of Object.entries(result.perHazard)) lines.push(`| ${hz} | ${m.events} | ${m.hits} | ${m.misses} | ${m.pod ?? '–'} | ${m.activeDays} | ${m.falseAlarms} | ${m.far ?? '–'} | ${m.activeRatio ?? '–'} |`)
  lines.push('', 'Catatan: POD = hit/kejadian (lead ≤ 1 hari); FAR = hari-sentra aktif tanpa kejadian ±1 hari (laporan warga jarang → FAR tinggi bukan berarti model salah). Target KPI docs/dev/08: POD ≥ 70 % untuk longsor/banjir/asap pada kejadian BPBD; rasio aktif ≤ 25 % hari-sentra.')
  return lines.join('\n')
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const now = new Date()
  const docs = readArchive({ days, now: now.toISOString(), dir: args.archive || DEFAULT_ARCHIVE_DIR })
  const dates = docs.map((d) => d.date)
  const archiveDays = docs.filter((d) => !d.missing).length
  let reports = []
  try { reports = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'data', 'reports.json'), 'utf8')) } catch { /* tidak ada laporan */ }
  let curated = []
  if (args.events) curated = JSON.parse(fs.readFileSync(args.events, 'utf8'))
  const events = collectEvents({ reports, curated }).filter((e) => dates.includes(e.date))
  const active = collectActive(docs, minLevel)
  const perHazard = score({ active, events, dates })
  const result = { generatedAt: now.toISOString(), from: dates[dates.length - 1], to: dates[0], days, minLevel, archiveDays, snapshots: docs.reduce((a, d) => a + (d.snapshots?.length ?? 0), 0), events: events.length, eventsBysource: events.reduce((a, e) => ({ ...a, [e.source]: (a[e.source] ?? 0) + 1 }), {}), perHazard }
  console.log(toMarkdown(result))
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true })
    fs.writeFileSync(args.out, JSON.stringify(result, null, 2))
    console.log(`\nJSON: ${args.out}`)
  }
}
