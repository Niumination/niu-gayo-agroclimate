import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { dailyNoonObservations, splitObsForecast, computeFwi, getFireDanger, getFireDangerSummary, loadState, saveState } from '../server/fireWeather.js'
import { getArchiveForLocation } from '../server/archive.js'
import { mapHotspots } from '../src/domain/hazards/hotspots.js'
import { LOCATIONS } from '../src/data/locations.js'
import { FWI, FWI_OPS } from '../src/domain/thresholds.js'
import { synthOpenMeteo, fetchFor } from './archive.test.js'

const NOW = new Date('2026-10-15T09:00:00Z') // 16.00 WIB → pengamatan 12.00 hari ini sudah lewat
const EARLY = new Date('2026-10-15T01:00:00Z') // 08.00 WIB → pengamatan hari ini belum ada

/** Hourly sintetis 3 hari dengan nilai siang yang diketahui. */
function hourly3() {
  const h = { time: [], temperature_2m: [], relative_humidity_2m: [], wind_speed_10m: [], precipitation: [], source: [] }
  for (const d of ['2026-10-13', '2026-10-14', '2026-10-15']) {
    for (let i = 0; i < 24; i++) {
      h.time.push(`${d}T${String(i).padStart(2, '0')}:00`)
      h.temperature_2m.push(i === 12 ? 24 : 20)
      h.relative_humidity_2m.push(i === 12 ? 60 : 90)
      h.wind_speed_10m.push(i === 12 ? 8 : 4)
      h.precipitation.push(d === '2026-10-14' && i === 13 ? 6 : 0) // 6 mm pukul 13.00 tgl 14 → masuk hujan 24 j tgl 15
      h.source.push(d === '2026-10-15' ? 'model' : 'archive')
    }
  }
  return h
}

test('dailyNoonObservations: ambil jam 12 WIB, hujan = akumulasi 24 jam sampai jam itu', () => {
  const obs = dailyNoonObservations(hourly3())
  assert.equal(obs.length, 3)
  assert.deepEqual(obs.map((o) => o.date), ['2026-10-13', '2026-10-14', '2026-10-15'])
  assert.equal(obs[0].temp, 24)
  assert.equal(obs[0].rh, 60)
  assert.equal(obs[0].wind, 8)
  assert.equal(obs[0].partialRain, true) // hanya 13 jam tersedia sebelum pukul 12 hari pertama
  assert.equal(obs[1].rain, 0) // hujan pukul 13.00 tgl 14 belum termasuk
  assert.equal(obs[2].rain, 6)
  assert.equal(obs[2].basis, 'model')
  // jam pengamatan lain + nilai null dilewati
  const h = hourly3()
  h.temperature_2m[12] = null
  assert.equal(dailyNoonObservations(h).length, 2)
  assert.equal(dailyNoonObservations(h, { hour: 13 }).length, 3)
  assert.deepEqual(dailyNoonObservations(null), [])
})

test('splitObsForecast: hari ini observasi hanya bila jam pengamatan sudah lewat', () => {
  const days = [{ date: '2026-10-14' }, { date: '2026-10-15' }, { date: '2026-10-16' }, { date: '2026-10-17' }, { date: '2026-10-18' }]
  const a = splitObsForecast(days, { today: '2026-10-15', nowHourWib: 16 })
  assert.deepEqual(a.obs.map((d) => d.date), ['2026-10-14', '2026-10-15'])
  assert.deepEqual(a.forecast.map((d) => d.date), ['2026-10-16', '2026-10-17', '2026-10-18'])
  const b = splitObsForecast(days, { today: '2026-10-15', nowHourWib: 8 })
  assert.deepEqual(b.obs.map((d) => d.date), ['2026-10-14'])
  assert.equal(b.forecast[0].date, '2026-10-15')
  assert.equal(b.forecast.length, FWI_OPS.forecastDays + 1)
})

test('computeFwi: spin-up 93 hari kering → kode naik, kelas, riwayat 7 hari, proyeksi 2 hari', () => {
  const archive = synthOpenMeteo('2026-07-15', '2026-10-14')
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const merged = { today: '2026-10-15', hourly: mergeFromSynth(archive, recent) }
  const r = computeFwi(merged, { now: NOW })
  assert.equal(r.spinUpDays, 93)
  assert.equal(r.firstDate, '2026-07-15')
  assert.equal(r.latest.date, '2026-10-15')
  assert.equal(r.latest.isToday, true)
  assert.equal(r.latest.basis, 'model')
  assert.ok(r.latest.codes.dc > 100, `DC ${r.latest.codes.dc}`) // 93 hari tanpa hujan → DC tinggi
  assert.ok(r.latest.codes.ffmc > 80)
  assert.equal(r.latest.classes.ffmc, 'ekstrem')
  assert.equal(r.history.length, FWI_OPS.historyDays)
  assert.equal(r.history.at(-1).date, '2026-10-15')
  assert.deepEqual(r.forecast.map((f) => f.date), ['2026-10-16', '2026-10-17'])
  assert.equal(r.forecast[0].basis, 'forecast')
  assert.ok(r.forecast[1].codes.dc > r.latest.codes.dc) // terus mengering
  assert.deepEqual(r.warnings, [])
})

test('computeFwi: pagi hari → kode terakhir kemarin + proyeksi mulai hari ini; spin-up pendek diberi peringatan', () => {
  const archive = synthOpenMeteo('2026-10-01', '2026-10-14')
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const r = computeFwi({ today: '2026-10-15', hourly: mergeFromSynth(archive, recent) }, { now: EARLY })
  assert.equal(r.latest.date, '2026-10-14')
  assert.equal(r.latest.isToday, false)
  assert.equal(r.forecast[0].date, '2026-10-15')
  assert.equal(r.forecast.length, FWI_OPS.forecastDays + 1)
  assert.ok(r.warnings.some((w) => w.includes('spin-up pendek')))
  assert.ok(r.warnings.some((w) => w.includes('belum tersedia')))
  const empty = computeFwi({ today: '2026-10-15', hourly: { time: [] } })
  assert.equal(empty.latest, null)
  assert.equal(empty.spinUpDays, 0)
})

test('computeFwi: hujan lebat harian menekan FFMC ke kelas rendah', () => {
  const archive = synthOpenMeteo('2026-07-15', '2026-10-14', { rainFn: () => 30 })
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17', { rainFn: () => 30 })
  const r = computeFwi({ today: '2026-10-15', hourly: mergeFromSynth(archive, recent) }, { now: NOW })
  assert.equal(r.latest.classes.ffmc, 'rendah')
  assert.equal(r.latest.classes.fwi, 'rendah')
  assert.ok(r.latest.codes.dc < 30)
})

test('getFireDanger: gabungan arsip + hotspot → level, siaga lokal, HTH, state tersimpan', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-fwi-'))
  const archive = synthOpenMeteo('2026-07-15', '2026-10-14')
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const archiveGet = (id) => getArchiveForLocation(id, { fetchImpl: fetchFor(archive, recent), now: NOW, dataDir: dir })
  const tk = LOCATIONS.find((l) => l.id === 'takengon')
  const hs = mapHotspots(
    [{ lat: tk.lat + 0.1, lon: tk.lon, acqAt: '2026-10-15T06:00:00.000Z', instrument: 'VIIRS', confidence: 'h', frp: 12 }],
    LOCATIONS,
    { now: NOW },
  )
  const hotspotsGet = async () => ({ degraded: false, reason: null, retrievedAt: NOW.toISOString(), source: { name: 'FIRMS' }, perLocation: hs.perLocation, hotspots: hs.hotspots })
  const p = await getFireDanger('takengon', { archiveGet, hotspotsGet, now: NOW, dataDir: dir })
  assert.equal(p.degraded, false)
  assert.equal(p.location.id, 'takengon')
  assert.equal(p.fwi.spinUpDays, 93)
  assert.equal(p.fwi.startFrom, 'default')
  assert.equal(p.hotspots.summary.within25km24h, 1)
  assert.equal(p.hotspots.summary.within10km24h, 0)
  assert.equal(p.assessment.siagaLokal, true) // FFMC ≥ 78 & hotspot ≤ 25 km
  assert.equal(p.assessment.extreme, p.fwi.latest.codes.fwi > FWI.fwi.ekstrem) // konsisten dengan aturan ekstrem
  assert.ok(['waspada', 'bahaya', 'ekstrem'].includes(p.level))
  assert.equal(p.hth.days, 92) // seluruh arsip kering (hari ini tidak dihitung)
  assert.equal(p.hth.classKey, 'ekstrem')
  assert.equal(p.hotspots.nearest.length, 1) // 11 km dari Takengon walau sentra terdekatnya Kute Panang
  assert.ok(p.hotspots.nearest[0].distanceKm > 10 && p.hotspots.nearest[0].distanceKm < 12)
  const st = loadState(dir)
  assert.equal(st.takengon.date, '2026-10-15')
  assert.equal(st.takengon.codes.ffmc, p.fwi.latest.codes.ffmc)
})

test('getFireDanger: arsip gagal total → degraded tanpa throw; hotspot degraded diteruskan; state dipakai bila hanya prakiraan', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-fwi-'))
  const failing = async () => { throw new Error('archive down') }
  const noKey = async () => ({ degraded: true, reason: 'FIRMS_MAP_KEY belum diatur', perLocation: {}, hotspots: [] })
  const p = await getFireDanger('bies', { archiveGet: failing, hotspotsGet: noKey, now: NOW, dataDir: dir })
  assert.equal(p.degraded, true)
  assert.equal(p.fwi.latest, null)
  assert.equal(p.level, 'rendah')
  assert.equal(p.hotspots.degraded, true)
  assert.ok(p.warnings.some((w) => w.includes('archive down')))
  // hanya prakiraan 7 hari (tanpa arsip) + state tersimpan → start dari state
  saveState('bies', { date: '2026-10-07', codes: { ffmc: 90, dmc: 50, dc: 300, isi: 5, bui: 60, fwi: 12 }, updatedAt: 'x' }, dir)
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const archiveGet = (id) => getArchiveForLocation(id, { fetchImpl: fetchFor(null, recent, { archiveStatus: 404 }), now: NOW, dataDir: path.join(dir, 'x'), persist: false })
  const q = await getFireDanger('bies', { archiveGet, hotspotsGet: noKey, now: NOW, dataDir: dir })
  assert.equal(q.fwi.startFrom, 'state 2026-10-07')
  assert.ok(q.fwi.latest.codes.dc > 300) // melanjutkan dari DC 300, bukan default 15
  assert.ok(q.warnings.some((w) => w.includes('state tersimpan')))
  const bad = await getFireDanger('tidak-ada', { archiveGet, hotspotsGet: noKey, now: NOW, dataDir: dir })
  assert.equal(bad.degraded, true)
})

test('getFireDangerSummary: 15 sentra, terburuk, jumlah siaga, degraded dihitung', async () => {
  const getter = async (id) => {
    if (id === 'linge') throw new Error('gagal')
    const fwi = id === 'ketol' ? 20 : 2
    return {
      level: id === 'ketol' ? 'ekstrem' : 'rendah',
      assessment: { siagaLokal: id === 'ketol' },
      fwi: { latest: { date: '2026-10-15', codes: { fwi, ffmc: 85, dc: 200 }, classes: { fwi: 'sedang' } } },
      hotspots: { summary: { within10km24h: 0, within25km24h: id === 'ketol' ? 2 : 0 } },
      hth: { days: 3 },
    }
  }
  const s = await getFireDangerSummary(getter)
  assert.equal(s.count, 15)
  assert.equal(s.degradedCount, 1)
  assert.equal(s.worst.id, 'ketol')
  assert.equal(s.worst.level, 'ekstrem')
  assert.equal(s.siagaLokalCount, 1)
  assert.equal(s.locations.find((l) => l.id === 'linge').degraded, true)
})

/** Gabungkan hourly arsip+prakiraan seperti server/archive.js (uji murni computeFwi). */
function mergeFromSynth(archive, recent) {
  const out = { time: [], temperature_2m: [], relative_humidity_2m: [], wind_speed_10m: [], precipitation: [], source: [] }
  const push = (b, i, src) => {
    out.time.push(b.time[i])
    for (const k of ['temperature_2m', 'relative_humidity_2m', 'wind_speed_10m', 'precipitation']) out[k].push(b[k][i])
    out.source.push(src)
  }
  const aEnd = archive.hourly.time.at(-1)
  archive.hourly.time.forEach((t, i) => push(archive.hourly, i, 'archive'))
  recent.hourly.time.forEach((t, i) => {
    if (t <= aEnd) return
    push(recent.hourly, i, t.slice(0, 10) > '2026-10-15' ? 'forecast' : 'model')
  })
  return out
}
