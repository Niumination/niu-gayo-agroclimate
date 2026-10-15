import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { parseFirmsCsv, haversineKm, passesConfidence, toIsoUtc, ageHours, mapHotspots, hotspotLevel } from '../src/domain/hazards/hotspots.js'
import { LOCATIONS } from '../src/data/locations.js'
import { HOTSPOT } from '../src/domain/thresholds.js'

const viirsCsv = fs.readFileSync(new URL('./fixtures/hazards/firms-viirs-sample-SYNTHETIC.csv', import.meta.url), 'utf8')
const modisCsv = [
  'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight',
  '4.6400,96.8600,312.5,1.1,1.0,2026-10-14,0355,Terra,MODIS,82,6.1NRT,290.2,25.3,D',
  '4.9000,96.3000,305.1,1.2,1.1,2026-10-14,0355,Aqua,MODIS,31,6.1NRT,288.0,4.0,D',
  '',
].join('\n')

test('parseFirmsCsv: VIIRS fixture → 4 baris dengan kolom ternormalisasi', () => {
  const rows = parseFirmsCsv(viirsCsv, { source: 'VIIRS_SNPP_NRT' })
  assert.equal(rows.length, 4)
  const r = rows[0]
  assert.equal(r.lat, 4.7612)
  assert.equal(r.lon, 96.6234)
  assert.equal(r.instrument, 'VIIRS')
  assert.equal(r.confidence, 'n')
  assert.equal(r.frp, 3.4)
  assert.equal(r.brightness, 331.2)
  assert.equal(r.acqAt, '2026-10-13T06:45:00.000Z')
  assert.equal(r.satelliteLabel, 'Suomi NPP')
  assert.equal(r.source, 'VIIRS_SNPP_NRT')
})

test('parseFirmsCsv: MODIS (brightness, confidence numerik) & input tak valid', () => {
  const rows = parseFirmsCsv(modisCsv)
  assert.equal(rows.length, 2)
  assert.equal(rows[0].instrument, 'MODIS')
  assert.equal(rows[0].confidence, 82)
  assert.equal(rows[0].brightness, 312.5)
  assert.equal(rows[0].satelliteLabel, 'Terra')
  assert.deepEqual(parseFirmsCsv('No data found'), [])
  assert.deepEqual(parseFirmsCsv('Invalid MAP_KEY.'), [])
  assert.deepEqual(parseFirmsCsv(''), [])
  assert.deepEqual(parseFirmsCsv(null), [])
  assert.deepEqual(parseFirmsCsv('latitude,longitude,frp\nabc,def,1'), [])
})

test('passesConfidence: VIIRS n/h lolos, l tidak; MODIS ≥ 50', () => {
  const v = parseFirmsCsv(viirsCsv)
  assert.deepEqual(v.map(passesConfidence), [true, true, false, true])
  const m = parseFirmsCsv(modisCsv)
  assert.deepEqual(m.map(passesConfidence), [true, false])
  assert.equal(passesConfidence(null), false)
})

test('haversineKm: Takengon → Linge ≈ 30 km; Takengon → Bebesan < 1 km; jarak nol', () => {
  const tk = LOCATIONS.find((l) => l.id === 'takengon')
  const lg = LOCATIONS.find((l) => l.id === 'linge')
  const bb = LOCATIONS.find((l) => l.id === 'bebesan')
  const d = haversineKm(tk.lat, tk.lon, lg.lat, lg.lon)
  assert.ok(d > 29 && d < 33, `jarak ${d}`)
  assert.ok(haversineKm(tk.lat, tk.lon, bb.lat, bb.lon) < 1)
  assert.equal(haversineKm(4.63, 96.85, 4.63, 96.85), 0)
  // 1° lintang ≈ 111,2 km
  assert.ok(Math.abs(haversineKm(0, 96, 1, 96) - 111.2) < 0.2)
})

test('toIsoUtc & ageHours', () => {
  assert.equal(toIsoUtc('2026-10-14', '627'), '2026-10-14T06:27:00.000Z') // HHMM tanpa nol di depan
  assert.equal(toIsoUtc('2026-10-14', '1832'), '2026-10-14T18:32:00.000Z')
  assert.equal(toIsoUtc(null, '1200'), null)
  assert.equal(toIsoUtc('bukan-tanggal', '1200'), null)
  const now = new Date('2026-10-14T12:27:00Z')
  assert.equal(ageHours({ acqAt: '2026-10-14T06:27:00.000Z' }, now), 6)
  assert.equal(ageHours({ acqAt: null }, now), null)
})

test('mapHotspots: ringkasan per sentra, jendela 24/48 jam, radius 10/25/50 km, FRP intens', () => {
  const tk = LOCATIONS.find((l) => l.id === 'takengon')
  const now = new Date('2026-10-15T08:00:00Z')
  const hotspots = [
    // 5 km utara Takengon, 2 jam lalu, intens
    { lat: tk.lat + 0.045, lon: tk.lon, acqAt: '2026-10-15T06:00:00.000Z', instrument: 'VIIRS', confidence: 'h', frp: 25 },
    // ~20 km barat, 30 jam lalu (hanya 48 jam)
    { lat: tk.lat, lon: tk.lon - 0.18, acqAt: '2026-10-14T02:00:00.000Z', instrument: 'VIIRS', confidence: 'n', frp: 3 },
    // ~40 km selatan, 10 jam lalu
    { lat: tk.lat - 0.36, lon: tk.lon, acqAt: '2026-10-14T22:00:00.000Z', instrument: 'MODIS', confidence: 70, frp: 8 },
    // keyakinan rendah → disaring
    { lat: tk.lat + 0.01, lon: tk.lon, acqAt: '2026-10-15T06:00:00.000Z', instrument: 'VIIRS', confidence: 'l', frp: 50 },
    // terlalu lama (> 48 jam) → di luar jendela
    { lat: tk.lat + 0.01, lon: tk.lon, acqAt: '2026-10-12T06:00:00.000Z', instrument: 'VIIRS', confidence: 'h', frp: 50 },
  ]
  const m = mapHotspots(hotspots, LOCATIONS, { now })
  assert.equal(m.counts.total, 5)
  assert.equal(m.counts.accepted, 4)
  assert.equal(m.counts.inWindow, 3)
  assert.equal(m.counts.last24h, 2)
  const s = m.perLocation.takengon
  assert.equal(s.within10km24h, 1)
  assert.equal(s.within10km48h, 1)
  assert.equal(s.within25km24h, 1)
  assert.equal(s.within25km48h, 2)
  assert.equal(s.within50km24h, 2)
  assert.equal(s.within50km48h, 3)
  assert.equal(s.intense24h, 1)
  assert.equal(s.frpMax24h, 25)
  assert.ok(s.nearestKm > 4 && s.nearestKm < 6, `terdekat ${s.nearestKm}`)
  assert.equal(s.level, 'bahaya')
  // hotspot diurutkan dari yang terdekat ke sentra mana pun; 5 km utara Takengon paling dekat ke Kebayakan (≈ 2,8 km)
  assert.equal(m.hotspots[0].nearest.id, 'kebayakan')
  assert.ok(m.hotspots[0].nearest.km < 3)
  assert.equal(m.hotspots[0].intense, true)
  assert.equal(m.hotspots[0].ageHours, 2)
  // Linge (≈ 30 km dari Takengon): hotspot 5 km utara Takengon masuk ≤ 50 km tetapi tidak ≤ 25 km
  const lg = m.perLocation.linge
  assert.equal(lg.within25km24h, 0)
  assert.ok(lg.within50km48h >= 1)
})

test('mapHotspots: tanpa hotspot → semua sentra rendah; filterConfidence dapat dimatikan', () => {
  const m = mapHotspots([], LOCATIONS)
  assert.equal(Object.keys(m.perLocation).length, 15)
  assert.ok(Object.values(m.perLocation).every((s) => s.level === 'rendah' && s.nearestKm == null))
  const low = [{ lat: 4.63, lon: 96.85, acqAt: new Date().toISOString(), instrument: 'VIIRS', confidence: 'l', frp: 1 }]
  assert.equal(mapHotspots(low, LOCATIONS).counts.accepted, 0)
  assert.equal(mapHotspots(low, LOCATIONS, { filterConfidence: false }).counts.accepted, 1)
})

test('hotspotLevel: ≤ 10 km bahaya · ≤ 25 km waspada · lainnya rendah', () => {
  assert.equal(hotspotLevel({ within10km24h: 1, within25km24h: 1 }), 'bahaya')
  assert.equal(hotspotLevel({ within10km24h: 0, within25km24h: 2 }), 'waspada')
  assert.equal(hotspotLevel({ within10km24h: 0, within25km24h: 0, within50km24h: 9 }), 'rendah')
  assert.equal(hotspotLevel(null), 'rendah')
  assert.equal(HOTSPOT.radiusBahayaKm, 10)
})
