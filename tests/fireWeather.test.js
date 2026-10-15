// H-API — FWI System (src/domain/hazards/fireWeather.js) vs dataset uji resmi 48 hari (cffdrs test_fwi / fwi_01).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stepFwi, runFwiSeries, setFfmcConstant, getFfmcConstant, FFMC_CONST, ffmcClass, fwiClass, isiClass, fireDangerClass } from '../src/domain/hazards/fireWeather.js'
import { FWI } from '../src/domain/thresholds.js'

const rows = (await readFile(new URL('./fixtures/hazards/fwi-cffdrs-test_fwi-expected.csv', import.meta.url), 'utf8'))
  .trim().split(/\r?\n/).slice(1).map((l) => l.split(',').map(Number))

test('dataset uji cffdrs: 48 baris, kolom TEMP..FWI', () => {
  assert.equal(rows.length, 48) // 13 Apr–30 Mei 1985 (file: 49 baris termasuk header)
  assert.equal(rows[0].length, 16)
})

test('FWI 48 hari (lintang 40°, konstanta cffdrs 147.27723): selisih ≤ 0,005 di 6 indeks', () => {
  assert.equal(getFfmcConstant(), FWI.ffmcConstant)
  let prev = { ...FWI.defaultStart }
  const maxDiff = { ffmc: 0, dmc: 0, dc: 0, isi: 0, bui: 0, fwi: 0 }
  for (const r of rows) {
    const [, , , mon, , temp, rh, ws, prec, FFMC, DMC, DC, ISI, BUI, FWIv] = r
    const out = stepFwi({ temp, rh, wind: ws, rain: prec, month: mon, prev, equator: false })
    const exp = { ffmc: FFMC, dmc: DMC, dc: DC, isi: ISI, bui: BUI, fwi: FWIv }
    for (const k of Object.keys(exp)) maxDiff[k] = Math.max(maxDiff[k], Math.abs(out[k] - exp[k]))
    prev = out
  }
  for (const [k, v] of Object.entries(maxDiff)) assert.ok(v <= 0.005, `${k}: selisih maks ${v}`)
})

test('hari-1 Van Wagner & Pickett 1985 (T17 RH42 W25 R0, April): FFMC 87.65 DMC 8.545 DC 19.01 ISI 10.78 BUI 8.49 FWI 10.04', () => {
  const r = stepFwi({ temp: 17, rh: 42, wind: 25, rain: 0, month: 4, equator: false })
  const ref = { ffmc: 87.65, dmc: 8.545, dc: 19.01, isi: 10.78, bui: 8.49, fwi: 10.04 }
  for (const k of Object.keys(ref)) assert.ok(Math.abs(r[k] - ref[k]) < 0.01, `${k} ${r[k]} vs ${ref[k]}`)
})

test('konstanta FFMC asli 147.2 memberi selisih kecil tapi terukur (0,1–0,3) → bukan default', () => {
  setFfmcConstant(FFMC_CONST.original)
  try {
    let prev = { ...FWI.defaultStart }
    let maxFfmc = 0
    for (const r of rows) {
      const [, , , mon, , temp, rh, ws, prec, FFMC] = r
      const out = stepFwi({ temp, rh, wind: ws, rain: prec, month: mon, prev, equator: false })
      maxFfmc = Math.max(maxFfmc, Math.abs(out.ffmc - FFMC))
      prev = out
    }
    assert.ok(maxFfmc > 0.005 && maxFfmc < 0.5, `selisih FFMC ${maxFfmc}`)
  } finally {
    setFfmcConstant(FFMC_CONST.cffdrs)
  }
})

test('opsi ekuator (default Gayo): DMC/DC lebih tinggi di bulan dingin lintang utara karena Le=9 jam & Lf=1,4', () => {
  const north = stepFwi({ temp: 24, rh: 60, wind: 8, rain: 0, month: 1, equator: false })
  const eq = stepFwi({ temp: 24, rh: 60, wind: 8, rain: 0, month: 1, equator: true })
  const dflt = stepFwi({ temp: 24, rh: 60, wind: 8, rain: 0, month: 1 })
  assert.ok(eq.dmc > north.dmc)
  assert.ok(eq.dc > north.dc)
  assert.equal(dflt.dmc, eq.dmc) // default = ekuator (thresholds.FWI.equator)
  assert.equal(eq.ffmc, north.ffmc) // FFMC tidak bergantung lintang
})

test('simulasi Gayo 10 hari kering dari kondisi basah: FFMC naik ke kelas tinggi/ekstrem', () => {
  let st = { ffmc: 70, dmc: 5, dc: 30 }
  for (let d = 1; d <= 10; d++) st = stepFwi({ temp: 24, rh: 60, wind: 8, rain: 0, month: 8, prev: st })
  assert.ok(st.ffmc > FWI.ffmc.tinggi, `FFMC ${st.ffmc}`)
  assert.ok(['tinggi', 'ekstrem'].includes(ffmcClass(st.ffmc)))
})

test('runFwiSeries: lewati hari dengan input null, hitung bulan dari tanggal', () => {
  const days = [
    { date: '2026-08-01', temp: 24, rh: 60, wind: 8, rain: 0 },
    { date: '2026-08-02', temp: null, rh: 60, wind: 8, rain: 0 },
    { date: '2026-08-03', temp: 25, rh: 55, wind: 10, rain: 0 },
  ]
  const r = runFwiSeries(days)
  assert.equal(r.computedDays, 2)
  assert.equal(r.lastDate, '2026-08-03')
  assert.ok(r.ffmc > 85)
})

test('kelas FDRS: batas sinkron dengan thresholds.FWI', () => {
  assert.equal(ffmcClass(FWI.ffmc.sedang - 0.1), 'rendah')
  assert.equal(ffmcClass(FWI.ffmc.sedang), 'sedang')
  assert.equal(ffmcClass(FWI.ffmc.tinggi), 'tinggi')
  assert.equal(ffmcClass(FWI.ffmc.ekstrem), 'ekstrem')
  assert.equal(fwiClass(FWI.fwi.sedang), 'rendah') // FWI memakai ">"
  assert.equal(fwiClass(FWI.fwi.ekstrem + 0.1), 'ekstrem')
  assert.equal(isiClass(FWI.isi.tinggi), 'tinggi')
  assert.equal(ffmcClass(null), null)
})

test('fireDangerClass: "ekstrem" FFMC diturunkan ke "tinggi" tanpa hotspot ≤10 km / HTH ≥21 hari', () => {
  assert.equal(fireDangerClass({ ffmc: 90, fwi: 3 }), 'tinggi')
  assert.equal(fireDangerClass({ ffmc: 90, fwi: 3, hotspotWithin10km: 1 }), 'ekstrem')
  assert.equal(fireDangerClass({ ffmc: 90, fwi: 3, hthDays: 21 }), 'ekstrem')
  assert.equal(fireDangerClass({ ffmc: 60, fwi: 0.5 }), 'rendah')
})

// ---- Sprint 2: riwayat deret, kelas DC, penilaian bahaya kebakaran ----
import { dcClass, fdrsClassToLevel, assessFireDanger } from '../src/domain/hazards/fireWeather.js'
import { FWI_OPS } from '../src/domain/thresholds.js'

test('runFwiSeries keepHistory: satu entri per hari valid, state akhir = entri terakhir', () => {
  const days = [
    { date: '2026-10-01', temp: 24, rh: 60, wind: 8, rain: 0 },
    { date: '2026-10-02', temp: null, rh: 60, wind: 8, rain: 0 }, // dilewati
    { date: '2026-10-03', temp: 25, rh: 55, wind: 10, rain: 0, basis: 'model' },
  ]
  const r = runFwiSeries(days, { keepHistory: true })
  assert.equal(r.history.length, 2)
  assert.equal(r.computedDays, 2)
  assert.equal(r.history[1].date, '2026-10-03')
  assert.equal(r.history[1].basis, 'model')
  assert.equal(r.history[1].fwi, r.fwi)
  assert.deepEqual(r.history[0].obs, { temp: 24, rh: 60, wind: 8, rain: 0 })
  assert.equal(runFwiSeries(days).history, undefined)
})

test('dcClass: BMKG 0–140 / 141–260 / 261–350 / > 350', () => {
  assert.equal(dcClass(140), 'rendah')
  assert.equal(dcClass(140.5), 'sedang')
  assert.equal(dcClass(260), 'sedang')
  assert.equal(dcClass(261), 'tinggi')
  assert.equal(dcClass(350), 'tinggi')
  assert.equal(dcClass(351), 'ekstrem')
  assert.equal(dcClass(null), null)
})

test('fdrsClassToLevel: rendah/sedang → rendah, tinggi → waspada, ekstrem → bahaya', () => {
  assert.equal(fdrsClassToLevel('rendah'), 'rendah')
  assert.equal(fdrsClassToLevel('sedang'), 'rendah')
  assert.equal(fdrsClassToLevel('tinggi'), 'waspada')
  assert.equal(fdrsClassToLevel('ekstrem'), 'bahaya')
})

test('assessFireDanger: gerbang FFMC ekstrem, hotspot menaikkan level, ekstrem & siaga lokal', () => {
  const dry = { ffmc: 88, dmc: 30, dc: 200, isi: 7, bui: 40, fwi: 9 } // FFMC ekstrem, FWI tinggi
  const a = assessFireDanger({ fwi: dry })
  assert.equal(a.displayClass, 'tinggi') // ekstrem diturunkan: tanpa hotspot/HTH
  assert.equal(a.level, 'waspada')
  assert.equal(a.drivers.ffmcExtremeGated, true)
  assert.equal(a.siagaLokal, false)
  assert.match(a.headline, /FWI 9\.0 — Tinggi · FFMC 88 \(Ekstrem\)/)
  // HTH ≥ 21 membuka gerbang → bahaya
  const b = assessFireDanger({ fwi: dry, hthDays: 25 })
  assert.equal(b.displayClass, 'ekstrem')
  assert.equal(b.level, 'bahaya')
  // hotspot ≤ 25 km → siaga lokal (FFMC ≥ 78), level minimal waspada
  const c = assessFireDanger({ fwi: dry, hotspots: { within10km24h: 0, within25km24h: 1 } })
  assert.equal(c.siagaLokal, true)
  assert.equal(c.level, 'waspada')
  // hotspot ≤ 10 km → bahaya
  const d = assessFireDanger({ fwi: dry, hotspots: { within10km24h: 1, within25km24h: 1 } })
  assert.equal(d.level, 'bahaya')
  // FWI > 13 dan hotspot ≤ 25 km → ekstrem
  const e = assessFireDanger({ fwi: { ...dry, fwi: 15 }, hotspots: { within10km24h: 0, within25km24h: 1 } })
  assert.equal(e.extreme, true)
  assert.equal(e.level, 'ekstrem')
  assert.equal(e.advice.length, 3)
  // FWI > 13 tanpa hotspot → bukan ekstrem
  assert.equal(assessFireDanger({ fwi: { ...dry, fwi: 15 } }).extreme, false)
  // hotspot ≤ 10 km tanpa kode FWI → tetap bahaya (hotspot aktif)
  const f = assessFireDanger({ fwi: null, hotspots: { within10km24h: 2, within25km24h: 2 } })
  assert.equal(f.level, 'bahaya')
  assert.equal(f.displayClass, null)
  assert.equal(f.headline, 'Kode FWI belum tersedia')
  // basah → rendah
  const wet = assessFireDanger({ fwi: { ffmc: 40, dmc: 1, dc: 10, isi: 0.1, bui: 1, fwi: 0 } })
  assert.equal(wet.level, 'rendah')
  assert.equal(FWI_OPS.siagaFfmc, 78)
})
