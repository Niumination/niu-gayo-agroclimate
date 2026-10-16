import test from 'node:test'
import assert from 'node:assert'
import { seasonalPhase, monthsToPeak, seasonalInfo } from '../src/domain/seasonal.js'
import disasterHistory from '../src/data/disasterHistory.json' with { type: 'json' }
import { LOCATIONS } from '../src/data/locations.js'

// F7 — kalender musiman
test('seasonalPhase: puncak Nov–Feb', () => {
  for (const m of [11, 12, 1, 2]) assert.strictEqual(seasonalPhase(m), 'tinggi', `bulan ${m}`)
})
test('seasonalPhase: sedang Mar–Apr & Okt', () => {
  for (const m of [3, 4, 10]) assert.strictEqual(seasonalPhase(m), 'sedang', `bulan ${m}`)
})
test('seasonalPhase: rendah Mei–Sep', () => {
  for (const m of [5, 6, 7, 8, 9]) assert.strictEqual(seasonalPhase(m), 'rendah', `bulan ${m}`)
})
test('monthsToPeak: Des=11, Nov=0, Jan=10', () => {
  assert.strictEqual(monthsToPeak(11), 0)
  assert.strictEqual(monthsToPeak(12), 11)
  assert.strictEqual(monthsToPeak(1), 10)
  assert.strictEqual(monthsToPeak(7), 4)
})
test('seasonalNote & seasonalInfo konsisten', () => {
  const info = seasonalInfo(11)
  assert.strictEqual(info.phase, 'tinggi')
  assert.strictEqual(info.label, 'PUNCAK')
  assert.strictEqual(info.monthsToPeak, 0)
  assert.ok(info.note.length > 10)
  assert.strictEqual(seasonalInfo(6).phase, 'rendah')
})

// F4 — data riwayat bencana terkurasi
test('disasterHistory: struktur valid & lokasi dikenal', () => {
  assert.ok(Array.isArray(disasterHistory.events) && disasterHistory.events.length > 0)
  const ids = new Set(LOCATIONS.map((l) => l.id))
  for (const ev of disasterHistory.events) {
    assert.ok(['longsor', 'banjir', 'kebakaran', 'gempa', 'vulkanik', 'angin', 'asap', 'kekeringan'].includes(ev.type), `type ${ev.type}`)
    assert.equal(ev.hazard, ev.type) // Fase 1.9d: skema `hazard` = id registry
    assert.ok('emergencyStatus' in ev)
    assert.ok(ev.date && ev.year && ev.source?.startsWith('http'), `event ${ev.id}`)
    for (const loc of ev.locations) assert.ok(ids.has(loc), `lokasi ${loc} pada ${ev.id}`)
  }
})
test('disasterHistory: transform per lokasi', () => {
  const evs = disasterHistory.events.filter((e) => e.locations.includes('takengon'))
  assert.ok(evs.length >= 2)
  const last = evs.sort((a, b) => b.date.localeCompare(a.date))[0]
  assert.ok(['2025', '2026'].includes(String(last.year)))
})

// Fase 3.4 — kalender diperluas
import { dryPhase, frostWindow, climateAdjustment, seasonalInfoExtended } from '../src/domain/seasonal.js'

test('dryPhase: puncak Jul–Agu, sedang Jun & Sep, lainnya basah; jendela embun upas Jun–Sep', () => {
  assert.strictEqual(dryPhase(7), 'tinggi')
  assert.strictEqual(dryPhase(9), 'sedang')
  assert.strictEqual(dryPhase(12), 'rendah')
  assert.strictEqual(frostWindow(8), true)
  assert.strictEqual(frostWindow(1), false)
})

test('climateAdjustment: El Niño kuat + IOD positif → drier (boost 2), kedaluwarsa → tidak aktif; La Niña → wetter', () => {
  const outlook = { current: { validUntil: '2099-01-01', enso: { phase: 'El Niño', strength: 'sangat kuat' }, iod: { phase: 'positif' }, season: { rainyOnset: 'terlambat' } } }
  const a = climateAdjustment(outlook, { now: new Date('2026-10-15T00:00:00Z') })
  assert.strictEqual(a.shift, 'drier')
  assert.strictEqual(a.dryBoost, 2)
  assert.strictEqual(a.active, true)
  assert.match(a.note, /terlambat/)
  const stale = climateAdjustment({ current: { ...outlook.current, validUntil: '2026-01-01' } }, { now: new Date('2026-10-15T00:00:00Z') })
  assert.strictEqual(stale.active, false)
  assert.strictEqual(stale.stale, true)
  assert.strictEqual(climateAdjustment({ current: { validUntil: '2099-01-01', enso: { phase: 'La Niña', strength: 'lemah' }, iod: { phase: 'netral' } } }).shift, 'wetter')
  assert.strictEqual(climateAdjustment(null).shift, 'neutral')
})

test('seasonalInfoExtended: Oktober normal = sedang/rendah-kering; dengan El Niño kuat → fase hujan turun, kering naik', () => {
  const normal = seasonalInfoExtended(10, { outlook: null })
  assert.strictEqual(normal.phase, 'sedang')
  assert.strictEqual(normal.dry.phase, 'rendah')
  assert.strictEqual(normal.climate.active, false)
  const outlook = { current: { validUntil: '2099-01-01', enso: { phase: 'El Niño', strength: 'sangat kuat' }, iod: { phase: 'positif' } } }
  const nino = seasonalInfoExtended(10, { outlook, now: new Date('2026-10-15T00:00:00Z') })
  assert.strictEqual(nino.phase, 'rendah')
  assert.strictEqual(nino.dry.phase, 'sedang')
  assert.ok(nino.climate.note)
  const jul = seasonalInfoExtended(7, { outlook, now: new Date('2026-07-15T00:00:00Z') })
  assert.strictEqual(jul.dry.phase, 'tinggi')
  assert.strictEqual(jul.frostWindow, true)
  assert.strictEqual(jul.phase, 'rendah')
})
