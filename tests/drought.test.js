import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { hthDays, hthClass, hthLevel, projectHth, waterBalance, assessDrought, HTH_CLASSES } from '../src/domain/hazards/drought.js'
import { HTH, WATER_BALANCE } from '../src/domain/thresholds.js'

const archive = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-archive-90d.json', import.meta.url), 'utf8'))

test('hthDays: hitung mundur hari < 1 mm dari hari terakhir berdata', () => {
  assert.equal(hthDays([5, 0, 0.2, 0.9]).days, 3)
  assert.equal(hthDays([5, 0, 0.2, 1.0]).days, 0) // hari terakhir hujan ≥ 1 mm → HH
  assert.equal(hthDays([0, 0, 0]).days, 3)
  assert.equal(hthDays([0, 0, 0]).truncated, true) // seluruh deret kering → HTH sebenarnya ≥ 3
  assert.equal(hthDays([2, 0, 0, null, null]).days, 2) // null di ujung = belum berdata
  assert.equal(hthDays([2, 0, null, 0]).days, 2) // celah di tengah dilewati
  assert.equal(hthDays([]).days, 0)
  assert.equal(hthDays(null).lastDataIndex, -1)
})

test('hthDays: ambang hujan dapat diubah & indeks hujan terakhir benar', () => {
  const r = hthDays([3, 0.5, 0.4, 0.3], { threshold: 0.5 })
  assert.equal(r.days, 2)
  assert.equal(r.lastRainIndex, 1)
})

test('hthClass: tabel kelas BMKG 0/5/10/20/30/60', () => {
  assert.equal(hthClass(0).key, 'hh')
  assert.equal(hthClass(1).key, 'sangat_pendek')
  assert.equal(hthClass(5).key, 'sangat_pendek')
  assert.equal(hthClass(6).key, 'pendek')
  assert.equal(hthClass(10).key, 'pendek')
  assert.equal(hthClass(11).key, 'menengah')
  assert.equal(hthClass(20).key, 'menengah')
  assert.equal(hthClass(21).key, 'panjang')
  assert.equal(hthClass(30).key, 'panjang')
  assert.equal(hthClass(31).key, 'sangat_panjang')
  assert.equal(hthClass(60).key, 'sangat_panjang')
  assert.equal(hthClass(61).key, 'ekstrem')
  assert.equal(HTH_CLASSES.length, 7)
})

test('hthLevel: 0–10 rendah · 11–20 waspada · 21–60 bahaya · > 60 ekstrem', () => {
  assert.equal(hthLevel(0), 'rendah')
  assert.equal(hthLevel(10), 'rendah')
  assert.equal(hthLevel(HTH.waspada), 'waspada')
  assert.equal(hthLevel(20), 'waspada')
  assert.equal(hthLevel(HTH.bahaya), 'bahaya')
  assert.equal(hthLevel(60), 'bahaya')
  assert.equal(hthLevel(HTH.ekstrem), 'ekstrem')
})

test('projectHth: lanjutkan hitungan selama prakiraan kering, berhenti di hari hujan', () => {
  assert.deepEqual(projectHth(12, [0, 0.4, 0]), { days: 15, breaksOnIndex: null })
  assert.deepEqual(projectHth(12, [0, 3.2, 0]), { days: 13, breaksOnIndex: 1 })
  assert.deepEqual(projectHth(12, [5]), { days: 12, breaksOnIndex: 0 })
  assert.deepEqual(projectHth(12, []), { days: 12, breaksOnIndex: null })
  assert.equal(projectHth(0, [0, 0, 0, 0, 0]).days, HTH.projectionDays) // dibatasi horizon
  assert.equal(projectHth(4, [0, null, 0]).days, 5) // null menghentikan proyeksi
})

test('waterBalance: Σ(P − ET0) 30 hari & level', () => {
  const p = Array(40).fill(1)
  const e = Array(40).fill(4)
  const wb = waterBalance(p, e)
  assert.equal(wb.days, WATER_BALANCE.days)
  assert.equal(wb.balance, -90)
  assert.equal(wb.level, 'waspada')
  assert.equal(waterBalance(Array(30).fill(0), Array(30).fill(4.5)).level, 'bahaya')
  assert.equal(waterBalance(Array(30).fill(10), Array(30).fill(3)).level, 'rendah')
  const partial = waterBalance([1, 2, null, 3], [1, 1, 1, null])
  assert.equal(partial.days, 2) // hanya pasangan lengkap
  assert.equal(waterBalance([], []).level, 'rendah')
})

test('assessDrought: fixture arsip Takengon 90 hari (14 Jul–12 Okt 2026)', () => {
  const a = assessDrought(archive.daily)
  assert.ok(a)
  assert.equal(a.hth.lastDataDate, '2026-10-12')
  assert.equal(a.hth.days, 0) // 12 Okt hujan 9,8 mm → HH
  assert.equal(a.hth.classKey, 'hh')
  assert.equal(a.hth.lastRainDate, '2026-10-12')
  assert.equal(a.hth.lastRainMm, 9.8)
  assert.equal(a.balance30.days, 30)
  assert.ok(a.balance30.rain > 200, `hujan 30 hari ${a.balance30.rain}`)
  assert.equal(a.level, 'rendah')
  assert.equal(a.series.length, 30)
  assert.ok(a.advice.length >= 2)
})

test('assessDrought: deret sintetis kering 25 hari + prakiraan → kelas Panjang, bahaya, proyeksi', () => {
  const time = []
  const precipitation_sum = []
  const et0 = []
  const source = []
  for (let i = 0; i < 40; i++) {
    const d = new Date(Date.UTC(2026, 6, 1 + i)).toISOString().slice(0, 10)
    time.push(d)
    precipitation_sum.push(i < 15 ? 8 : 0.3)
    et0.push(4)
    source.push('archive')
  }
  // 3 hari prakiraan: kering, kering, hujan 6 mm
  for (const [d, p] of [['2026-08-10', 0], ['2026-08-11', 0.2], ['2026-08-12', 6]]) {
    time.push(d)
    precipitation_sum.push(p)
    et0.push(4)
    source.push('forecast')
  }
  const a = assessDrought({ time, precipitation_sum, et0_fao_evapotranspiration: et0, source })
  assert.equal(a.hth.days, 25)
  assert.equal(a.hth.classKey, 'panjang')
  assert.equal(a.hth.level, 'bahaya')
  assert.equal(a.hth.lastRainDate, '2026-07-15')
  assert.deepEqual(a.hth.projected, { days: 27, breaksOn: '2026-08-12', horizonDays: 3 })
  assert.equal(a.balance30.balance, Math.round((5 * 8 + 25 * 0.3 - 30 * 4) * 10) / 10)
  assert.equal(a.balance30.level, 'waspada')
  assert.equal(a.level, 'bahaya')
})

test('assessDrought: hari ini diperlakukan sebagai proyeksi bila `today` diberikan', () => {
  const daily = {
    time: ['2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16'],
    precipitation_sum: [0, 0, 12, 0],
    et0_fao_evapotranspiration: [3, 3, 3, 3],
    source: ['archive', 'model', 'model', 'forecast'],
  }
  const a = assessDrought(daily, { today: '2026-10-15' })
  assert.equal(a.hth.lastDataDate, '2026-10-14')
  assert.equal(a.hth.days, 2)
  assert.deepEqual(a.hth.projected, { days: 2, breaksOn: '2026-10-15', horizonDays: 2 })
  assert.equal(assessDrought({ time: [], precipitation_sum: [] }), null)
  assert.equal(assessDrought(daily, { today: '2026-10-13' }), null) // tidak ada hari observasi
})
