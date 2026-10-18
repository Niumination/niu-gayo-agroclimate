// Fase 2.3 H-PETIR — FR-KONV-2/3/4: konsensus ECMWF×GFS, ketidaksepakatan, hujan es, puting beliung, modul registry `badai`.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { convectiveRisk, levelEcmwfHour, levelGfsHour } from '../src/domain/hazards/convective.js'
import convective from '../src/domain/hazards/convective.js'
import { mergeConvective, getConvective, ecmwfUrl, gfsUrl } from '../server/convective.js'
import { CONVECTIVE } from '../src/domain/thresholds.js'

const ecmwfFx = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-ecmwf-convective.json', import.meta.url), 'utf8'))
const gfsFx = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-gfs-cape-li.json', import.meta.url), 'utf8'))

const hours = (n) => Array.from({ length: n }, (_, i) => `2026-10-15T${String(6 + i).padStart(2, '0')}:00`)

test('ambang per jam: ECMWF (CAPE/kode) & GFS (LI/CAPE) sesuai PRD', () => {
  assert.equal(levelEcmwfHour(500, 3), 'rendah')
  assert.equal(levelEcmwfHour(1000, 3), 'waspada')
  assert.equal(levelEcmwfHour(2000, 3), 'bahaya')
  assert.equal(levelEcmwfHour(300, 95), 'bahaya') // kode badai petir mengalahkan CAPE rendah
  assert.equal(levelEcmwfHour(null, null), 'n/a')
  assert.equal(levelGfsHour(-2.9, 200), 'rendah')
  assert.equal(levelGfsHour(-3, 200), 'waspada')
  assert.equal(levelGfsHour(-6, 200), 'bahaya')
  assert.equal(levelGfsHour(0, 2100), 'bahaya')
})

test('convectiveRisk: model sepakat bahaya → agreement:true, jam puncak = CAPE tertinggi', () => {
  const time = hours(12)
  const capeEcmwf = time.map((_, i) => (i === 8 ? 2600 : 800))
  const liGfs = time.map((_, i) => (i === 8 ? -6.5 : -1))
  const r = convectiveRisk({ time, capeEcmwf, capeGfs: time.map(() => 500), liGfs, weatherCode: time.map(() => 3), rain: time.map(() => 0), gusts: time.map(() => 20) })
  assert.equal(r.level, 'bahaya')
  assert.equal(r.agreement, true)
  assert.equal(r.peakTime, time[8])
  assert.deepEqual(r.signals, { ecmwf: 'bahaya', gfs: 'bahaya' })
  assert.equal(r.tornado, false)
  assert.equal(r.hail, true) // CAPE 2600 ≥ 2500 & LI −6,5 ≤ −6
})

test('convectiveRisk: hujan es hanya bila kode 96/99 atau CAPE ≥ 2500 & LI ≤ −6', () => {
  const time = hours(6)
  const base = { time, capeGfs: time.map(() => 0), rain: time.map(() => 0), gusts: time.map(() => 10) }
  const a = convectiveRisk({ ...base, capeEcmwf: time.map(() => 2300), liGfs: time.map(() => -6.5), weatherCode: time.map(() => 3) })
  assert.equal(a.hail, false)
  const b = convectiveRisk({ ...base, capeEcmwf: time.map(() => 2600), liGfs: time.map(() => -6.5), weatherCode: time.map(() => 3) })
  assert.equal(b.hail, true)
  const c = convectiveRisk({ ...base, capeEcmwf: time.map(() => 900), liGfs: time.map(() => 0), weatherCode: time.map((_, i) => (i === 2 ? 96 : 3)) })
  assert.equal(c.hail, true)
  assert.equal(c.level, 'bahaya')
})

test('convectiveRisk: model tidak sepakat → ikut sinyal terkuat, agreement:false', () => {
  const time = hours(12)
  const r = convectiveRisk({ time, capeEcmwf: time.map(() => 400), capeGfs: time.map(() => 300), liGfs: time.map(() => -6.2), weatherCode: time.map(() => 2), rain: time.map(() => 0), gusts: time.map(() => 15) })
  assert.equal(r.level, 'bahaya')
  assert.equal(r.agreement, false)
  assert.equal(r.signals.ecmwf, 'rendah')
  assert.equal(r.signals.gfs, 'bahaya')
})

test('convectiveRisk: ekstrem = bahaya + (hembusan ≥ 45 | hujan ≥ 20 | BMKG aktif); puting beliung = bahaya + gusts ≥ 45', () => {
  const time = hours(6)
  const base = { time, capeEcmwf: time.map(() => 2100), capeGfs: time.map(() => 0), liGfs: time.map(() => 0), weatherCode: time.map(() => 3), rain: time.map(() => 0), gusts: time.map(() => 30) }
  assert.equal(convectiveRisk(base).level, 'bahaya')
  const gust = convectiveRisk({ ...base, gusts: time.map((_, i) => (i === 3 ? 46 : 30)) })
  assert.equal(gust.level, 'ekstrem')
  assert.equal(gust.tornado, true)
  assert.equal(convectiveRisk({ ...base, rain: time.map((_, i) => (i === 1 ? 22 : 0)) }).level, 'ekstrem')
  assert.equal(convectiveRisk({ ...base, bmkgActive: true }).level, 'ekstrem')
  assert.equal(convectiveRisk({ ...base, bmkgActive: true }).tornado, false)
  // waspada + hembusan 50 → bukan puting beliung (butuh bahaya)
  const w = convectiveRisk({ ...base, capeEcmwf: time.map(() => 1200), gusts: time.map(() => 50) })
  assert.equal(w.level, 'waspada')
  assert.equal(w.tornado, false)
})

test('convectiveRisk: horizon 12 jam dari nowIdx; GFS kosong → agreement null, ECMWF saja', () => {
  const time = Array.from({ length: 48 }, (_, i) => `2026-10-15T${String(i % 24).padStart(2, '0')}:00`)
  const capeEcmwf = time.map((_, i) => (i === 30 ? 2500 : 100)) // di luar horizon dari nowIdx 10 (10..21)
  const r = convectiveRisk({ time, capeEcmwf, capeGfs: [], liGfs: [], weatherCode: time.map(() => 1), rain: [], gusts: [], nowIdx: 10 })
  assert.equal(r.level, 'rendah')
  assert.equal(r.agreement, null)
  assert.equal(r.hours.length, CONVECTIVE.horizonH)
  const r2 = convectiveRisk({ time, capeEcmwf, capeGfs: [], liGfs: [], weatherCode: time.map(() => 1), rain: [], gusts: [], nowIdx: 20 })
  assert.equal(r2.level, 'bahaya')
  assert.equal(r2.peakTime, time[30])
})

test('server mergeConvective + getConvective dengan fixture nyata: deret ECMWF acuan, GFS dicocokkan per jam', async () => {
  const merged = mergeConvective(ecmwfFx, gfsFx)
  assert.equal(merged.time.length, 72)
  assert.equal(merged.hasGfs, true)
  assert.equal(merged.capeGfs.filter((v) => v != null).length, 48)
  assert.equal(merged.liGfs[0], gfsFx.hourly.lifted_index[0])
  const fetchJson = async (url) => (url.includes('gfs_seamless') ? gfsFx : ecmwfFx)
  const doc = await getConvective('takengon', { fetchJson, now: '2026-10-15T05:00:00.000Z' })
  assert.equal(doc.degraded, false)
  assert.equal(doc.sources.length, 2)
  assert.equal(doc.hourly.time[0], '2026-10-14T00:00')
  // GFS gagal → degraded, tetap ada hourly ECMWF
  const doc2 = await getConvective('takengon', { fetchJson: async (url) => { if (url.includes('gfs_seamless')) throw new Error('HTTP 503'); return ecmwfFx } })
  assert.equal(doc2.degraded, true)
  assert.match(doc2.error, /GFS/)
  assert.equal(doc2.hourly.hasGfs, false)
  assert.match(ecmwfUrl({ lat: 1, lon: 2 }), /models=ecmwf_ifs025/)
  assert.match(gfsUrl({ lat: 1, lon: 2 }), /lifted_index/)
})

test('modul badai: evaluate dari payload /api/convective (fixture) → kontrak + flags transparansi model', async () => {
  const fetchJson = async (url) => (url.includes('gfs_seamless') ? gfsFx : ecmwfFx)
  const doc = await getConvective('takengon', { fetchJson, now: '2026-10-14T06:00:00.000Z' })
  const r = convective.evaluate({ convective: doc, weather: { nowTime: '2026-10-14T13:00' }, now: '2026-10-14T06:00:00.000Z', bmkgNowcast: { active: false } })
  assert.ok(['rendah', 'waspada', 'bahaya', 'ekstrem'].includes(r.level))
  assert.ok(r.metrics.find((m) => m.key === 'capeEcmwf').value >= 0)
  assert.equal(typeof r.flags.agreement === 'boolean' || r.flags.agreement === null, true)
  assert.ok(Array.isArray(r.flags.hours) && r.flags.hours.length <= 12)
  assert.equal(r.degraded, false)
  // BMKG aktif menaikkan bahaya → ekstrem hanya jika sudah bahaya
  const rb = convective.evaluate({ convective: doc, weather: { nowTime: '2026-10-14T13:00' }, now: '2026-10-14T06:00:00.000Z', bmkgNowcast: { active: true, alerts: [{ isAceh: true }] } })
  if (r.level === 'bahaya') assert.equal(rb.level, 'ekstrem')
  // payload kosong → n/a degraded
  const e = convective.evaluate({ convective: { degraded: true, error: 'ECMWF: HTTP 500', hourly: null } })
  assert.equal(e.level, 'n/a')
  assert.equal(e.degraded, true)
  assert.doesNotMatch(e.headline, /ECMWF|HTTP 500/)
  assert.match(e.detail, /ECMWF: HTTP 500/)
})
