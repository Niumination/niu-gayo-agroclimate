import test from 'node:test'
import assert from 'node:assert'
import { landslideScore, watershedIndex, watershedRainIndex, landslideRisk } from '../src/domain/disaster.js'
import { leafWetnessRustRisk } from '../src/domain/coffee.js'
import { computeRainProbability, rainProbabilities } from '../src/domain/ensemble.js'
import { LANDSLIDE, WATERSHED, RUST_LW } from '../src/domain/thresholds.js'

// ---------- Longsor: skor gabungan ----------
test('landslideScore: kondisi kering & landai -> rendah', () => {
  const r = landslideScore({ rain24: 0, rain72: 0, soilMoisture: 0.1, peakHourly: 0, slopeClass: 'landai' })
  assert.strictEqual(r.level, 'Rendah')
  assert.strictEqual(r.score, 0)
})

test('landslideScore: hujan lebat + tanah jenuh + lereng curam -> tinggi', () => {
  const r = landslideScore({
    rain24: 80, rain72: 160, soilMoisture: 0.5, peakHourly: 20, slopeClass: 'curam',
  })
  assert.strictEqual(r.level, 'Bahaya Tinggi')
  assert.ok(r.score >= LANDSLIDE.levelTinggi)
})

test('landslideScore: skor maksimum 100', () => {
  const r = landslideScore({ rain24: 999, rain72: 999, soilMoisture: 0.9, peakHourly: 99, slopeClass: 'curam' })
  assert.ok(r.score <= 100)
  // 35+25+20+10+10 = 100
  assert.strictEqual(r.score, 100)
})

test('landslideScore: slopeClass memengaruhi skor', () => {
  const base = { rain24: 30, rain72: 60, soilMoisture: 0.3, peakHourly: 5 }
  const landai = landslideScore({ ...base, slopeClass: 'landai' })
  const curam = landslideScore({ ...base, slopeClass: 'curam' })
  assert.strictEqual(curam.score - landai.score, LANDSLIDE.slopeFactor.curam - LANDSLIDE.slopeFactor.landai)
})

test('landslideRisk (lama): tetap kompatibel', () => {
  assert.strictEqual(landslideRisk(60, 0), 'Bahaya Tinggi')
  assert.strictEqual(landslideRisk(10, 0), 'Rendah')
})

// ---------- DAS: indeks hujan hulu berbobot ----------
test('watershedIndex: rata-rata berbobot 4 lokasi hulu', () => {
  const r = watershedIndex([
    { id: 'bintang', rain24: 100 },
    { id: 'luttawar', rain24: 0 },
    { id: 'kebayakan', rain24: 0 },
    { id: 'silihnara', rain24: 0 },
  ])
  assert.strictEqual(r.index, 35) // 100 * 0.35
  assert.strictEqual(r.level, 'Waspada Luapan DAS Peusangan') // 35 >= 30
})

test('watershedIndex: bahaya di atas 50', () => {
  const r = watershedIndex([
    { id: 'bintang', rain24: 100 },
    { id: 'luttawar', rain24: 100 },
    { id: 'kebayakan', rain24: 100 },
    { id: 'silihnara', rain24: 100 },
  ])
  assert.strictEqual(r.index, 100)
  assert.strictEqual(r.level, 'Bahaya Luapan DAS Peusangan')
})

test('watershedIndex: lokasi non-hulu diabaikan', () => {
  const r = watershedIndex([{ id: 'takengon', rain24: 500 }, { id: 'linge', rain24: 500 }])
  assert.strictEqual(r.index, 0)
  assert.strictEqual(r.level, 'Normal')
})

test('watershedRainIndex (lama): kompatibel dengan bobot baru', () => {
  assert.strictEqual(watershedRainIndex('bintang', 35), 'Waspada Luapan DAS Peusangan')
  assert.strictEqual(watershedRainIndex('bintang', 10), 'Normal')
})

// ---------- Karat daun: leaf wetness 48 jam ----------
function makeWindow(hoursWet, tempWet = 22) {
  return Array.from({ length: 48 }, (_, i) => ({
    leafWetness: i < hoursWet ? 90 : 20,
    temp: i < hoursWet ? tempWet : 28, // di luar jendela suhu bila kering
  }))
}

test('leafWetnessRustRisk: 8 jam basah beruntun 22°C -> skor 100 (tinggi)', () => {
  const r = leafWetnessRustRisk(makeWindow(8))
  assert.strictEqual(r.longestWetStreak, 8)
  assert.strictEqual(r.score, RUST_LW.streakLongPoints + RUST_LW.tempLongPoints)
  assert.ok(r.score >= RUST_LW.levelTinggi)
  assert.strictEqual(r.level, 'Tinggi')
})

test('leafWetnessRustRisk: kering -> rendah', () => {
  const r = leafWetnessRustRisk(makeWindow(0))
  assert.strictEqual(r.level, 'Rendah')
  assert.strictEqual(r.score, 0)
})

test('leafWetnessRustRisk: basah tapi suhu di luar 18-25°C -> skor lebih rendah', () => {
  const hangat = leafWetnessRustRisk(makeWindow(8, 22))
  const dingin = leafWetnessRustRisk(makeWindow(8, 12))
  assert.ok(dingin.score < hangat.score)
})

// ---------- Ensemble: P(hujan>X) ----------
function makeMembers(nWet, total = 50, mmPerHour = 2) {
  return Array.from({ length: total }, (_, m) =>
    Array.from({ length: 24 }, () => (m < nWet ? mmPerHour : 0))
  )
}

test('computeRainProbability: 25 dari 50 member >25mm/24j -> 50%', () => {
  const members = makeMembers(25, 50, 2) // 2mm x 24 = 48mm > 25mm
  const r = computeRainProbability(members, 25)
  assert.strictEqual(r.probability, 50)
  assert.strictEqual(r.members, 50)
})

test('rainProbabilities: p25 >= p50', () => {
  const members = makeMembers(40, 50, 2) // 48mm/24j semua member basah
  const p = rainProbabilities(members)
  assert.strictEqual(p.p25, 80)
  assert.ok(p.p50 <= p.p25)
})
