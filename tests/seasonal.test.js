import test from 'node:test'
import assert from 'node:assert'
import { seasonalPhase, monthsToPeak, seasonalNote, seasonalInfo } from '../src/domain/seasonal.js'
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
    assert.ok(ev.type === 'longsor' || ev.type === 'banjir')
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
