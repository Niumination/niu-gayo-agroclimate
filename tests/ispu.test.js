// H-ASAP — ISPU Permen LHK P.14/2020 (src/domain/hazards/ispu.js). Kasus dari docs/dev/prototypes/check.mjs.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ispuSubIndex, ispuComposite, ispuCategory, rolling24h, rollingMean, ISPU_BREAKPOINTS, ISPU_CATEGORIES } from '../src/domain/hazards/ispu.js'
import { ISPU } from '../src/domain/thresholds.js'

test('ispuSubIndex PM2,5: semua titik batas resmi P.14/2020 tepat', () => {
  const cases = [[0, 0], [15.4, 50], [15.5, 51], [55.4, 100], [55.5, 101], [150.4, 200], [150.5, 201], [250.4, 300], [250.5, 301]]
  for (const [x, exp] of cases) assert.equal(ispuSubIndex('pm25', x), exp, `PM2,5 ${x}`)
})

test('ispuSubIndex PM10 & CO: titik batas resmi', () => {
  assert.equal(ispuSubIndex('pm10', 50), 50)
  assert.equal(ispuSubIndex('pm10', 51), 51)
  assert.equal(ispuSubIndex('pm10', 150), 100)
  assert.equal(ispuSubIndex('pm10', 350), 200)
  assert.equal(ispuSubIndex('pm10', 420), 300)
  assert.equal(ispuSubIndex('co', 4000), 50)
  assert.equal(ispuSubIndex('co', 8000), 100)
  assert.equal(ispuSubIndex('co', 15000), 200)
  assert.equal(ispuSubIndex('co', 30000), 300)
})

test('ispuSubIndex: interpolasi linier di dalam segmen & nilai tidak valid → null', () => {
  // PM2,5 17,1 µg/m³ (Takengon 14 Okt 2026) → segmen 15,5–55,4 ↔ 51–100
  const exp = Math.round(((100 - 51) / (55.4 - 15.5)) * (17.1 - 15.5) + 51)
  assert.equal(ispuSubIndex('pm25', 17.1), exp)
  assert.equal(ispuSubIndex('pm25', null), null)
  assert.equal(ispuSubIndex('pm25', -1), null)
  assert.equal(ispuSubIndex('pm25', NaN), null)
  assert.throws(() => ispuSubIndex('so2', 10), /tidak dikenal/)
})

test('ispuSubIndex: di atas 500 µg/m³ diekstrapolasi (tidak null, > 500)', () => {
  assert.ok(ispuSubIndex('pm25', 600) > 500)
})

test('ispuComposite: maksimum sub-indeks + parameter kritis', () => {
  const r = ispuComposite({ pm25: 61.2, pm10: 70, co: 900 })
  assert.equal(r.param, 'pm25')
  assert.equal(r.category.key, 'tidak_sehat')
  assert.equal(r.category.label, 'Tidak Sehat')
  assert.equal(r.category.level, 'waspada')
  assert.deepEqual(Object.keys(r.sub), ['pm25', 'pm10', 'co'])
  assert.equal(ispuComposite({}), null)
  assert.equal(ispuComposite({ pm25: null, pm10: 20 }).param, 'pm10')
})

test('ispuCategory: batas kategori sinkron dengan thresholds.ISPU', () => {
  assert.equal(ispuCategory(ISPU.baik).key, 'baik')
  assert.equal(ispuCategory(ISPU.baik + 1).key, 'sedang')
  assert.equal(ispuCategory(ISPU.sedang + 1).key, 'tidak_sehat')
  assert.equal(ispuCategory(ISPU.tidakSehat + 1).key, 'sangat_tidak_sehat')
  assert.equal(ispuCategory(ISPU.sangatTidakSehat + 1).key, 'berbahaya')
  assert.equal(ispuCategory(ISPU.sangatTidakSehat + 1).level, 'ekstrem')
  assert.equal(ispuCategory(null), null)
  assert.equal(ISPU_CATEGORIES.length, 5)
})

test('tabel breakpoint: segmen kontinu & menaik (sanity)', () => {
  for (const [param, table] of Object.entries(ISPU_BREAKPOINTS)) {
    for (let i = 1; i < table.length; i++) {
      assert.ok(table[i][0] > table[i - 1][1], `${param} segmen ${i} Xa > Xb sebelumnya`)
      assert.equal(table[i][2], table[i - 1][3] + 1, `${param} segmen ${i} Ia = Ib sebelumnya + 1`)
    }
  }
})

test('rolling24h: rata-rata 24 jam, abaikan null, tandai parsial', () => {
  const r = rolling24h([10, 20, null, 30], 3)
  assert.equal(r.mean, 20)
  assert.equal(r.hours, 3)
  assert.equal(r.partial, true)
  const full = rolling24h(Array(30).fill(12), 29)
  assert.equal(full.hours, 24)
  assert.equal(full.partial, false)
  assert.equal(rolling24h([], 0).mean, null)
  assert.equal(rolling24h([1, 2, 3], 10).hours, 3) // endIdx di luar deret → dipotong
})

test('rollingMean: jendela 8 jam untuk CO', () => {
  const vals = [...Array(10).fill(100), ...Array(8).fill(900)]
  const r = rollingMean(vals, 17, { hours: 8, minHours: 6 })
  assert.equal(r.mean, 900)
  assert.equal(r.hours, 8)
  assert.equal(r.partial, false)
})
