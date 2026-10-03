import test from 'node:test'
import assert from 'node:assert'
import { tempStatus, rustRisk, dryingStatus } from '../src/domain/coffee.js'
import { landslideRisk, watershedRainIndex, windRisk } from '../src/domain/disaster.js'
import { sliceHourlyFromCurrent, currentSolarRad, apiTimestamp } from '../src/domain/format.js'
import { buildForecastUrl } from '../src/api/openMeteo.js'
import { LOCATIONS } from '../src/data/locations.js'

// Threshold lama dipertahankan sebagai kasus
test('tempStatus: 20°C optimal, 12°C dingin, 27°C panas', () => {
  assert.strictEqual(tempStatus(20).level, 'Optimal')
  assert.strictEqual(tempStatus(12).level, 'Dingin')
  assert.strictEqual(tempStatus(27).level, 'Panas')
})

test('rustRisk: RH 90 & 22°C -> Tinggi (threshold lama)', () => {
  assert.strictEqual(rustRisk(90, 22).level, 'Tinggi')
  assert.strictEqual(rustRisk(80, 22).level, 'Sedang')
  assert.strictEqual(rustRisk(60, 22).level, 'Rendah')
  assert.strictEqual(rustRisk(90, 27).level, 'Sedang') // suhu di luar jendela
})

test('dryingStatus: hujan 0.5 -> tutup terpal; DNI 100 -> kurang optimal; else sangat baik', () => {
  assert.strictEqual(dryingStatus(0.5, 500, 60).level, 'Hujan - Tutup Terpal')
  assert.strictEqual(dryingStatus(0, 100, 60).level, 'Kurang Optimal')
  assert.strictEqual(dryingStatus(0, 500, 60).level, 'Sangat Baik')
})

test('landslideRisk: threshold lama 25/50 mm & hujan jam 5/15', () => {
  assert.strictEqual(landslideRisk(50, 0), 'Bahaya Tinggi')
  assert.strictEqual(landslideRisk(25, 0), 'Waspada')
  assert.strictEqual(landslideRisk(10, 0), 'Rendah')
  assert.strictEqual(landslideRisk(10, 15), 'Bahaya Tinggi')
})

test('watershedRainIndex: hanya lokasi DAS, 40mm -> waspada', () => {
  assert.strictEqual(watershedRainIndex('bintang', 40), 'Waspada Luapan DAS Peusangan')
  assert.strictEqual(watershedRainIndex('bintang', 10), 'Normal')
  assert.strictEqual(watershedRainIndex('linge', 100), 'Normal') // bukan DAS
})

test('windRisk: threshold lama 20/35 km/j + gusts', () => {
  assert.strictEqual(windRisk(35, 0), 'Bahaya Angin Kencang (Pohon Peneduh Roboh)')
  assert.strictEqual(windRisk(20, 0), 'Waspada Angin Kencang')
  assert.strictEqual(windRisk(10, 0), 'Normal')
  assert.strictEqual(windRisk(10, 65), 'Bahaya Angin Kencang (Pohon Peneduh Roboh)')
})

// BUG-01/02/03
const fixture = {
  current: { time: '2026-10-03T14:00', temperature_2m: 20 },
  hourly: {
    time: ['2026-10-03T00:00', '2026-10-03T01:00', '2026-10-03T02:00', '2026-10-03T03:00',
           '2026-10-03T04:00', '2026-10-03T05:00', '2026-10-03T06:00', '2026-10-03T07:00',
           '2026-10-03T08:00', '2026-10-03T09:00', '2026-10-03T10:00', '2026-10-03T11:00',
           '2026-10-03T12:00', '2026-10-03T13:00', '2026-10-03T14:00', '2026-10-03T15:00'],
    temperature_2m: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 20, 20],
    precipitation: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0],
    direct_normal_irradiance: [0, 0, 0, 0, 0, 0, 50, 100, 200, 400, 500, 600, 500, 400, 750, 700],
  },
}

test('BUG-01 fix: slice mulai jam berjalan (14:00), bukan 00:00', () => {
  const h = sliceHourlyFromCurrent(fixture, 12)
  assert.strictEqual(h[0].time, '14:00')
  assert.strictEqual(h.length, 2) // hanya sisa data (14:00 & 15:00)
  assert.strictEqual(h[h.length - 1].time, '15:00')
})

test('BUG-02 fix: solarRad dari jam berjalan (14:00 -> 750), bukan 0', () => {
  assert.strictEqual(currentSolarRad(fixture), 750)
})

test('BUG-03 fix: timestamp dari current.time API', () => {
  assert.strictEqual(apiTimestamp(fixture), '14:00')
  assert.strictEqual(apiTimestamp({ current: {} }), null)
})

test('BUG-04 fix: URL forecast memakai models=ecmwf_ifs025 & elevation per lokasi', () => {
  const url = buildForecastUrl(LOCATIONS[0])
  assert.ok(url.includes('models=ecmwf_ifs025'))
  assert.ok(url.includes('elevation=1250'))
  assert.ok(url.includes('leaf_wetness_probability'))
  assert.ok(url.includes('wind_gusts_10m'))
})
