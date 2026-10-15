// Fase 2.4 H-BANJIR+ — FR-BJR-1/2/3/4: klimatologi GloFAS, anomali debit, Indeks Luapan v2, server getFlood (fixture + nilai terakhir), PetaBencana.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dischargeAnomaly, composeFloodLevel, cellForLocation, CELL_FOR_LOCATION } from '../src/domain/hazards/flood.js'
import watershed from '../src/domain/hazards/watershed.js'
import { buildClimatology, dayOfYear, normalizeCell, getFlood, loadClimatology, CLIM_FILE } from '../server/flood.js'
import { normalizeReports, getExternalReports } from '../server/petabencana.js'
import { FLOOD_CELLS } from '../server/config.js'
import { LOCATIONS } from '../src/data/locations.js'

const floodFx = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-flood-peusangan-4cells.json', import.meta.url), 'utf8'))
const pbFx = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/petabencana-ID-AC-synthetic.json', import.meta.url), 'utf8'))

test('dischargeAnomaly: rasio ≥ 2/3/5 → waspada/bahaya/ekstrem; > p95 → minimal waspada; median 0/null → n/a', () => {
  assert.equal(dischargeAnomaly({ forecast: 5, median: 5, p95: 20 }).level, 'rendah')
  assert.equal(dischargeAnomaly({ forecast: 10, median: 5, p95: 20 }).level, 'waspada')
  assert.equal(dischargeAnomaly({ forecast: 15, median: 5, p95: 20 }).level, 'bahaya')
  assert.equal(dischargeAnomaly({ forecast: 25, median: 5, p95: 20 }).level, 'ekstrem')
  const p = dischargeAnomaly({ forecast: 9, median: 5, p95: 8 })
  assert.equal(p.level, 'waspada')
  assert.equal(p.exceedsP95, true)
  assert.equal(p.ratio, 1.8)
  assert.equal(dischargeAnomaly({ forecast: 9, median: 0 }).level, 'n/a')
  assert.equal(dischargeAnomaly({ forecast: null, median: 5 }).ratio, null)
})

test('composeFloodLevel v2: maks(hujan, debit) + ARI72 ≥ 100 menaikkan satu tingkat (maks ekstrem, hanya bila ≥ waspada)', () => {
  assert.equal(composeFloodLevel({ rainLevel: 'rendah', dischargeLevel: 'bahaya', ari72: 10 }).level, 'bahaya')
  assert.equal(composeFloodLevel({ rainLevel: 'waspada', dischargeLevel: 'n/a', ari72: 120 }).level, 'bahaya')
  assert.equal(composeFloodLevel({ rainLevel: 'rendah', dischargeLevel: 'rendah', ari72: 150 }).level, 'rendah')
  assert.equal(composeFloodLevel({ rainLevel: 'ekstrem', dischargeLevel: 'rendah', ari72: 150 }).level, 'ekstrem')
  assert.equal(composeFloodLevel({ rainLevel: 'n/a', dischargeLevel: 'n/a' }).level, 'n/a')
  assert.equal(composeFloodLevel({ rainLevel: 'n/a', dischargeLevel: 'waspada', ari72: 100 }).bumpedByAri, true)
})

test('klimatologi: DOY benar (29 Feb = 60), median/p95 per DOY jendela ±15 hari, tahun & n terhitung', () => {
  assert.equal(dayOfYear('2024-02-29'), 60)
  assert.equal(dayOfYear('2025-03-01'), 61)
  assert.equal(dayOfYear('2025-12-31'), 366)
  const times = []
  const values = []
  for (let y = 2000; y < 2010; y++) for (let m = 1; m <= 12; m++) for (let d = 1; d <= 28; d++) {
    times.push(`${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
    values.push(m === 11 ? 20 : 5) // November selalu lebih basah
  }
  const c = buildClimatology(times, values)
  assert.equal(c.median.length, 366)
  assert.equal(c.years, 10)
  assert.equal(c.median[dayOfYear('2001-11-15') - 1], 20)
  assert.equal(c.median[dayOfYear('2001-06-15') - 1], 5)
  assert.ok(c.p95[dayOfYear('2001-06-15') - 1] >= 5)
})

test('normalizeCell + getFlood (fixture 4 sel): anomali, puncak 7 hari, worst, nilai terakhir saat gagal', async () => {
  const clim = { median: Array(366).fill(5), p95: Array(366).fill(12) }
  const cell = normalizeCell(FLOOD_CELLS[0], floodFx[1], clim, { today: '2026-10-14' })
  assert.equal(cell.daily.time.length, 14)
  assert.equal(cell.hasClimatology, true)
  assert.equal(cell.today.date, '2026-10-14')
  assert.ok(cell.today.ratio > 0)
  assert.ok(['rendah', 'waspada', 'bahaya', 'ekstrem'].includes(cell.levelNext7))
  // getFlood dengan fetch per URL berdasarkan koordinat sel; sel "bintang" gagal → nilai terakhir dari dataDir
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'flood-'))
  const byCoord = (url) => {
    const u = new URL(url)
    const lat = Number(u.searchParams.get('latitude'))
    const lon = Number(u.searchParams.get('longitude'))
    return floodFx.find((f) => Math.abs(f.latitude - lat) < 0.03 && Math.abs(f.longitude - lon) < 0.03) ?? floodFx[0]
  }
  const climDoc = { period: 'test', builtAt: 'x', cells: Object.fromEntries(FLOOD_CELLS.map((c) => [c.id, clim])) }
  const first = await getFlood({ fetchJson: async (u) => byCoord(u), climDoc, dataDir: dir, today: '2026-10-14', now: '2026-10-14T00:00:00Z' })
  assert.equal(first.cells.length, 4)
  assert.equal(first.degraded, false)
  assert.ok(first.worst && first.worst.cellId)
  assert.ok(fs.existsSync(path.join(dir, 'flood-bintang.json')))
  const second = await getFlood({ fetchJson: async (u) => { if (u.includes('96.925')) throw new Error('HTTP 429'); return byCoord(u) }, climDoc, dataDir: dir, today: '2026-10-14' })
  assert.equal(second.cells.length, 4)
  assert.equal(second.degraded, true)
  assert.equal(second.cells.find((c) => c.id === 'bintang').stale, true)
  assert.match(second.degradedCells[0], /bintang: HTTP 429 \(nilai terakhir\)/)
  // tanpa klimatologi → degraded:true, rasio null
  const noClim = await getFlood({ fetchJson: async (u) => byCoord(u), climDoc: null, dataDir: dir, today: '2026-10-14' })
  assert.equal(noClim.degraded, true)
  assert.equal(noClim.cells[0].today.ratio, null)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('klimatologi terversi server/clim/flood-clim.json ada & lengkap untuk 4 sel', () => {
  const doc = loadClimatology(CLIM_FILE)
  assert.ok(doc, 'server/clim/flood-clim.json harus ada (scripts/build-flood-clim.mjs)')
  for (const c of FLOOD_CELLS) {
    assert.equal(doc.cells[c.id].median.length, 366, c.id)
    assert.ok(doc.cells[c.id].years >= 20, c.id)
    assert.ok(doc.cells[c.id].median.every((v) => v != null && v > 0), c.id)
  }
})

test('modul banjir v2: sentra non-hulu memakai debit GloFAS; hulu = maks(hujan, debit); tanpa flood → perilaku lama', () => {
  const mkCell = (id, level, ratio) => ({ id, name: id, hasClimatology: true, today: { date: '2026-10-14', discharge: 10, ratio, level, exceedsP95: false }, peak: { date: '2026-10-16', discharge: 12, ratio: ratio + 0.5, level }, levelNext7: level, stale: false })
  const flood = { retrievedAt: 't', cells: [mkCell('outlet', 'rendah', 1.1), mkCell('takengon', 'bahaya', 3.2), mkCell('bintang', 'rendah', 0.9), mkCell('angkup', 'waspada', 2.1)] }
  const takengon = LOCATIONS.find((l) => l.id === 'takengon')
  const r = watershed.evaluate({ location: takengon, weather: { dailyRainSum: 2, rain72: 10 }, ari: { ari72: 10 }, flood, now: 't' })
  assert.equal(r.level, 'bahaya')
  assert.equal(r.flags.cell, 'takengon')
  assert.deepEqual(r.flags.components, { rain: 'n/a', discharge: 'bahaya' })
  assert.ok(r.metrics.find((m) => m.key === 'ratio').value === 3.2)
  // hulu Bintang: hujan harian 55 mm → indeks berbobot 0,35 × 55 = 19 (< 30 → rendah); debit rendah; ARI72 120 → tidak naik (rendah)
  const bintang = LOCATIONS.find((l) => l.id === 'bintang')
  const rb = watershed.evaluate({ location: bintang, weather: { dailyRainSum: 55, rain72: 120 }, ari: { ari72: 120 }, flood, now: 't' })
  assert.equal(rb.level, 'rendah')
  // hulu Bintang hujan 100 mm → indeks 35 → waspada; ARI72 120 → bahaya (bumpedByAri)
  const rb2 = watershed.evaluate({ location: bintang, weather: { dailyRainSum: 100, rain72: 120 }, ari: { ari72: 120 }, flood, now: 't' })
  assert.equal(rb2.level, 'bahaya')
  assert.equal(rb2.flags.bumpedByAri, true)
  // tanpa flood: non-hulu → n/a (lama), hulu → indeks hujan saja
  const old = watershed.evaluate({ location: takengon, weather: { dailyRainSum: 2 }, now: 't' })
  assert.equal(old.level, 'n/a')
  assert.equal(watershed.evaluate({ location: bintang, weather: { dailyRainSum: 100 }, now: 't' }).level, 'waspada')
  // sel stale → degraded
  const stale = { ...flood, cells: flood.cells.map((c) => ({ ...c, stale: true })) }
  assert.equal(watershed.evaluate({ location: takengon, weather: { dailyRainSum: 2 }, flood: stale, now: 't' }).degraded, true)
  assert.equal(cellForLocation(flood, 'linge'), null) // di luar DAS Peusangan → tidak dipetakan (tidak ada fallback)
  assert.equal(cellForLocation(flood, 'celala'), null)
  assert.equal(CELL_FOR_LOCATION.ketol, 'angkup')
  assert.equal(watershed.evaluate({ location: LOCATIONS.find((l) => l.id === 'celala'), weather: { dailyRainSum: 50 }, flood, now: 't' }).level, 'n/a')
})

test('PetaBencana: saring kode wilayah 1104/1117/1113 atau ≤ 60 km, normalisasi, degraded saat gagal', async () => {
  const reports = normalizeReports(pbFx)
  assert.ok(reports.length >= 1)
  for (const r of reports) assert.ok(r.inRegion || r.distanceKm <= 60, `${r.id}: ${r.region} ${r.distanceKm}`)
  assert.ok(reports.every((r) => typeof r.type === 'string' && r.lat && r.lon))
  // fitur jauh (Banda Aceh ~ 150 km, kode 1171) dibuang
  const far = { result: { objects: { output: { geometries: [{ type: 'Point', coordinates: [95.32, 5.55], properties: { pkey: '1', disaster_type: 'flood', tags: { region_code: '1171' } } }] } } } }
  assert.equal(normalizeReports(far).length, 0)
  const doc = await getExternalReports({ fetchJson: async () => pbFx, now: 't' })
  assert.equal(doc.degraded, false)
  assert.equal(doc.license, 'CC BY-NC 4.0')
  assert.equal(doc.total, reports.length)
  const bad = await getExternalReports({ fetchJson: async () => { throw new Error('HTTP 502') } })
  assert.equal(bad.degraded, true)
  assert.deepEqual(bad.reports, [])
  assert.match(bad.attribution, /PetaBencana/)
})
