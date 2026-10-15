// 1.10b — skrip validasi musiman: hit/miss/false alarm dari arsip level + kejadian (laporan warga / kurasi).
import test from 'node:test'
import assert from 'node:assert/strict'
import { collectActive, collectEvents, score, toMarkdown } from '../scripts/validate-season.mjs'

const docs = [
  { date: '2026-10-10', snapshots: [{ location: 'ketol', levels: { longsor: 'bahaya', asap: 'rendah' } }, { location: 'bintang', levels: { banjir: 'waspada' } }] },
  { date: '2026-10-11', snapshots: [{ location: 'ketol', levels: { longsor: 'waspada' } }] },
  { date: '2026-10-12', snapshots: [], missing: true },
]

test('collectActive: ambang level, maks per hari-sentra-bahaya', () => {
  const a = collectActive(docs, 'waspada')
  assert.equal(a.get('2026-10-10|ketol|longsor'), 'bahaya')
  assert.equal(a.get('2026-10-11|ketol|longsor'), 'waspada')
  assert.equal(a.has('2026-10-10|ketol|asap'), false)
  assert.equal(collectActive(docs, 'bahaya').size, 1)
})

test('collectEvents: laporan warga (abu → vulkanik, WIB) + kurasi; tipe tak dikenal dibuang', () => {
  const ev = collectEvents({ reports: [{ type: 'longsor', location: 'ketol', timestamp: '2026-10-11T16:30:00Z' }, { type: 'abu', location: 'ketol', timestamp: '2026-10-11T00:00:00Z' }, { type: 'xyz', location: 'ketol', timestamp: '2026-10-11T00:00:00Z' }], curated: [{ date: '2026-10-13', location: '*', hazard: 'banjir', source: 'BPBD' }] })
  assert.equal(ev.length, 3)
  assert.equal(ev[0].date, '2026-10-11') // 23:30 WIB
  assert.equal(ev[1].hazard, 'vulkanik')
  assert.equal(ev[2].source, 'BPBD')
})

test('score: hit dengan lead 1 hari, miss, false alarm & toleransi +1 hari, markdown', () => {
  const active = collectActive(docs, 'waspada')
  const dates = ['2026-10-12', '2026-10-11', '2026-10-10']
  const events = [
    { date: '2026-10-11', location: 'ketol', hazard: 'longsor', source: 'warga' }, // hit (aktif 10 & 11)
    { date: '2026-10-12', location: 'bebesan', hazard: 'longsor', source: 'warga' }, // miss
    { date: '2026-10-11', location: 'bintang', hazard: 'banjir', source: 'BPBD' }, // hit via H−1 (aktif 10)
  ]
  const m = score({ active, events, dates, locations: ['ketol', 'bintang', 'bebesan'] })
  assert.equal(m.longsor.events, 2)
  assert.equal(m.longsor.hits, 1)
  assert.equal(m.longsor.misses, 1)
  assert.equal(m.longsor.pod, 50)
  assert.equal(m.longsor.activeDays, 2)
  assert.equal(m.longsor.falseAlarms, 0) // 10 → kejadian 11 (+1 hari), 11 → kejadian 11
  assert.equal(m.banjir.hits, 1)
  assert.equal(m.banjir.falseAlarms, 0)
  assert.equal(m.asap.events, 0)
  assert.equal(m.asap.pod, null)
  const md = toMarkdown({ from: '2026-10-10', to: '2026-10-12', days: 3, minLevel: 'waspada', archiveDays: 2, snapshots: 3, events: 3, eventsBysource: { warga: 2, BPBD: 1 }, perHazard: m })
  assert.match(md, /\| longsor \| 2 \| 1 \| 1 \| 50 \|/)
})
