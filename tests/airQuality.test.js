// H-ASAP — penilaian kualitas udara & kabut asap (src/domain/hazards/airQuality.js) dengan fixture nyata Takengon.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import aqFixture from './fixtures/hazards/openmeteo-airquality-takengon.json' with { type: 'json' }
import visFixture from './fixtures/hazards/openmeteo-forecast-bestmatch-visibility.json' with { type: 'json' }
import {
  assessAirQuality, assessHaze, hazeLevel, compute24hIspu, computeOutlook, adviceFor, coffeeHazeRule, indexAt, summarizeAirQuality,
} from '../src/domain/hazards/airQuality.js'
import { HAZE, ISPU } from '../src/domain/thresholds.js'

const NOW = '2026-10-14T14:00'
const base = () => ({ current: aqFixture.current, hourly: aqFixture.hourly, visibility: visFixture.hourly, nowIso: NOW })

/** Deret jam-an sintetis `hours` jam mulai 2026-10-13T00:00 dengan nilai konstan/fungsi. */
function synthHourly(hours, pm25, pm10 = pm25, co = 500, aod = 0.2) {
  const t0 = Date.UTC(2026, 9, 13, 0, 0)
  const time = Array.from({ length: hours }, (_, i) => new Date(t0 + i * 3600_000).toISOString().slice(0, 16))
  const f = (v, i) => (typeof v === 'function' ? v(i) : v)
  return {
    time,
    pm2_5: time.map((_, i) => f(pm25, i)),
    pm10: time.map((_, i) => f(pm10, i)),
    carbon_monoxide: time.map((_, i) => f(co, i)),
    aerosol_optical_depth: time.map((_, i) => f(aod, i)),
  }
}
function synthVisibility(date, byHour, rhByHour = null) {
  const time = Array.from({ length: 24 }, (_, h) => `${date}T${String(h).padStart(2, '0')}:00`)
  const out = { time, visibility: time.map((_, h) => byHour(h)) }
  if (rhByHour) out.relative_humidity_2m = time.map((_, h) => rhByHour(h))
  return out
}

test('fixture Takengon 14 Okt 2026 14:00: ISPU 24 jam "Baik" (PM2,5), kabut asap ringan didukung AOD 1,16', () => {
  const r = assessAirQuality(base())
  assert.equal(r.time, NOW)
  assert.equal(r.ispu.basis, '24h')
  assert.equal(r.ispu.hours, 24)
  assert.equal(r.ispu.partial, false)
  assert.equal(r.ispu.param, 'pm25')
  assert.equal(r.ispu.paramLabel, 'PM2,5')
  assert.equal(r.ispu.category.key, 'baik')
  assert.ok(r.ispu.index > 0 && r.ispu.index <= ISPU.baik, `indeks ${r.ispu.index}`)
  assert.equal(r.ispu.means.pm25, 13.7)
  // jarak pandang minimum jendela 10–17 WIB = 4,1 km (17:00); dini hari 860 m (06:00) diabaikan
  assert.equal(r.haze.visibilityKm, 4.1)
  assert.equal(r.haze.time, '2026-10-14T17:00')
  assert.equal(r.haze.level, 'ringan')
  assert.equal(r.haze.supported, true)
  assert.match(r.haze.supportReason, /AOD/)
  assert.equal(r.haze.windowLabel, '10–17 WIB')
  assert.equal(r.haze.hours, 8)
  assert.equal(r.haze.fogHours, 0) // fixture lama tanpa RH → tidak ada penyaringan
  assert.equal(r.level, 'rendah')
  assert.equal(r.instant.category.key, 'sedang') // nilai sesaat 23:00 (PM2,5 20,2) lebih tinggi dari rata-rata 24 jam
  assert.equal(r.measurements.aod, 1.16)
  assert.equal(r.advice.key, 'baik')
  assert.deepEqual(Object.keys(r.advice.groups), ['umum', 'rentan', 'kebun', 'sekolah'])
  assert.equal(r.advice.crossCutting.length, 0)
  assert.equal(r.coffee.dryingHold, false)
  assert.equal(r.who.exceeded, false)
  assert.equal(r.flags.estimate, true)
  assert.match(r.flags.model, /CAMS/)
  assert.ok(r.outlook && ['naik', 'turun', 'stabil'].includes(r.outlook.trend))
})

test('assessAirQuality: default nowIso = current.time; tanpa data → null; hanya current → basis sesaat', () => {
  const r = assessAirQuality({ current: aqFixture.current, hourly: aqFixture.hourly })
  assert.equal(r.time, aqFixture.current.time)
  assert.equal(assessAirQuality({}), null)
  assert.equal(assessAirQuality(), null)
  const only = assessAirQuality({ current: { time: NOW, pm2_5: 70, pm10: 60, carbon_monoxide: 900, aerosol_optical_depth: 0.3 } })
  assert.equal(only.ispu.basis, 'sesaat')
  assert.equal(only.ispu.partial, true)
  assert.equal(only.ispu.category.key, 'tidak_sehat')
  assert.equal(only.haze.level, 'tidak_diketahui')
  assert.equal(only.flags.visibilityAvailable, false)
})

test('assessHaze: kabut radiasi pagi (120 m pukul 05:00, 940 m pukul 09:00) tidak dianggap asap', () => {
  // Takengon 15 Okt 2026: kabut 220–1.200 m pukul 05–09 WIB, RH 85–99 % → di luar jendela 10–17
  const vis = synthVisibility('2026-10-14', (h) => (h === 5 ? 120 : h === 9 ? 940 : 20000))
  const r = assessHaze({ visibility: vis, pm25: 60, aod: 1.0, nowIso: NOW })
  assert.equal(r.level, 'tidak_ada')
  assert.equal(r.visibilityKm, 20)
  assert.equal(r.hours, HAZE.dayEndHour - HAZE.dayStartHour + 1)
})

test('assessHaze: jam dengan RH ≥ 90 % (kabut/mist) dikecualikan dari jendela siang', () => {
  const vis = synthVisibility('2026-10-14', (h) => (h === 10 || h === 11 ? 500 : 15000), (h) => (h <= 11 ? 97 : 70))
  const r = assessHaze({ visibility: vis, pm25: 60, aod: 1.0, nowIso: NOW })
  assert.equal(r.level, 'tidak_ada')
  assert.equal(r.fogHours, 2)
  assert.equal(r.hours, 6)
  // RH rendah (asap kering) → jam tetap dihitung
  const dry = assessHaze({ visibility: synthVisibility('2026-10-14', (h) => (h === 10 || h === 11 ? 500 : 15000), () => 60), pm25: 60, aod: 1.0, nowIso: NOW })
  assert.equal(dry.level, 'sangat_tebal')
  assert.equal(dry.persistentHours, 2)
  assert.equal(dry.fogHours, 0)
})

test('assessHaze: jarak pandang 800 m pukul 12:00 + PM2,5 60 → sangat tebal; tanpa dukungan PM/AOD → bukan asap', () => {
  const vis = synthVisibility('2026-10-14', (h) => (h === 12 ? 800 : 15000))
  const smoke = assessHaze({ visibility: vis, pm25: 60, aod: 0.2, nowIso: NOW })
  assert.equal(smoke.level, 'sangat_tebal')
  assert.equal(smoke.visibilityKm, 0.8)
  assert.match(smoke.supportReason, /PM2,5 60/)
  const fog = assessHaze({ visibility: vis, pm25: 10, aod: 0.1, nowIso: NOW })
  assert.equal(fog.level, 'tidak_ada')
  assert.equal(fog.rawLevel, 'sangat_tebal')
  assert.equal(fog.lowVisibilityNonSmoke, true)
  const tebal = assessHaze({ visibility: synthVisibility('2026-10-14', (h) => (h === 10 ? 1500 : 15000)), pm25: 10, aod: 0.6, nowIso: NOW })
  assert.equal(tebal.level, 'tebal')
})

test('assessHaze: tanpa deret jendela siang (tanggal lain / kosong) → tidak_diketahui', () => {
  const vis = synthVisibility('2026-10-13', () => 500)
  assert.equal(assessHaze({ visibility: vis, pm25: 60, aod: 1, nowIso: NOW }).level, 'tidak_diketahui')
  assert.equal(assessHaze({ visibility: null, pm25: 60, aod: 1, nowIso: NOW }).level, 'tidak_diketahui')
})

test('hazeLevel: sangat tebal persisten (≥ 2 jam) → bahaya; sesaat → waspada; tebal → waspada; selain itu rendah', () => {
  assert.equal(hazeLevel({ level: 'sangat_tebal', persistentHours: HAZE.persistHours }), 'bahaya')
  assert.equal(hazeLevel({ level: 'sangat_tebal', persistentHours: 1 }), 'waspada')
  assert.equal(hazeLevel({ level: 'tebal', persistentHours: 1 }), 'waspada')
  assert.equal(hazeLevel({ level: 'ringan' }), 'rendah')
  assert.equal(hazeLevel(null), 'rendah')
})

test('level gabungan: ISPU "Sedang" tetapi kabut asap sangat tebal 2 jam (didukung AOD) → bahaya; 1 jam → waspada', () => {
  const hourly = synthHourly(72, 30, 30, 500, 0.9)
  const two = assessAirQuality({ hourly, visibility: synthVisibility('2026-10-14', (h) => (h === 11 || h === 12 ? 700 : 12000)), nowIso: NOW })
  assert.equal(two.ispu.category.key, 'sedang')
  assert.equal(two.haze.level, 'sangat_tebal')
  assert.equal(two.haze.persistentHours, 2)
  assert.equal(two.level, 'bahaya')
  const one = assessAirQuality({ hourly, visibility: synthVisibility('2026-10-14', (h) => (h === 11 ? 700 : 12000)), nowIso: NOW })
  assert.equal(one.haze.level, 'sangat_tebal')
  assert.equal(one.level, 'waspada')
})

test('episode asap berat (PM2,5 180 µg/m³ 48 jam): Sangat Tidak Sehat, anjuran PJJ, ruang bersih, tunda jemur & kerja kebun', () => {
  const hourly = synthHourly(72, 180, 190, 6000, 1.5)
  const r = assessAirQuality({ hourly, visibility: synthVisibility('2026-10-14', () => 1500), nowIso: NOW })
  assert.equal(r.ispu.category.key, 'sangat_tidak_sehat')
  assert.ok(r.ispu.index >= ISPU.tidakSehat + 1 && r.ispu.index <= ISPU.sangatTidakSehat)
  assert.equal(r.ispu.category.level, 'bahaya')
  assert.equal(r.level, 'bahaya')
  assert.match(r.advice.policy, /PJJ/)
  assert.equal(r.advice.crossCutting.length, 4)
  assert.equal(r.advice.cleanRoom, true)
  assert.ok(r.advice.cleanRoomItems.length >= 5)
  assert.equal(r.coffee.dryingHold, true)
  assert.equal(r.coffee.fieldWorkHold, true)
  assert.equal(r.who.exceeded, true)
  assert.equal(r.haze.level, 'tebal')
})

test('episode ekstrem (PM2,5 320): Berbahaya → level ekstrem', () => {
  const r = assessAirQuality({ hourly: synthHourly(48, 320), nowIso: NOW })
  assert.equal(r.ispu.category.key, 'berbahaya')
  assert.equal(r.level, 'ekstrem')
  assert.ok(r.ispu.index > ISPU.sangatTidakSehat)
})

test('rata-rata 24 jam parsial: deret pendek (6 jam) ditandai partial', () => {
  const hourly = synthHourly(6, 40)
  const r = assessAirQuality({ hourly, nowIso: '2026-10-13T05:00' })
  assert.equal(r.ispu.partial, true)
  assert.equal(r.ispu.hours, 6)
  assert.equal(r.flags.partial, true)
})

test('indexAt & compute24hIspu: nowIso di antara jam → pakai jam terakhir ≤ now; di luar deret → null', () => {
  const hourly = synthHourly(48, 20)
  assert.equal(indexAt(hourly.time, '2026-10-13T05:30'), 5)
  assert.equal(indexAt(hourly.time, '2026-10-12T00:00'), -1)
  assert.equal(indexAt(hourly.time, '2030-01-01T00:00'), 47)
  assert.equal(compute24hIspu(hourly, '2026-10-12T00:00'), null)
  assert.equal(compute24hIspu({ time: [] }, NOW), null)
  const c = compute24hIspu(hourly, '2026-10-14T23:00')
  assert.equal(c.basis, '24h')
  assert.equal(c.endTime, '2026-10-14T23:00')
})

test('computeOutlook: deret menaik → tren naik & puncak di masa depan; menurun → turun', () => {
  const rising = synthHourly(96, (i) => (i < 40 ? 10 : 120))
  const o = computeOutlook(rising, '2026-10-14T14:00') // idx 38
  assert.equal(o.trend, 'naik')
  assert.ok(o.peakIndex > 50)
  assert.ok(o.peakTime > '2026-10-14T14:00')
  const falling = synthHourly(96, (i) => (i < 40 ? 120 : 10))
  assert.equal(computeOutlook(falling, '2026-10-14T14:00').trend, 'turun')
  assert.equal(computeOutlook(synthHourly(96, 20), '2026-10-14T14:00').trend, 'stabil')
  assert.equal(computeOutlook({ time: [] }, NOW), null)
})

test('adviceFor: 4 kelompok per kategori; Gayo jatuh ke Indonesia selagi kosong; kunci tak dikenal → baik', () => {
  const a = adviceFor('tidak_sehat')
  assert.deepEqual(Object.keys(a.groups), ['umum', 'rentan', 'kebun', 'sekolah'])
  assert.match(a.groups.kebun, /N95/)
  assert.equal(a.cleanRoom, true)
  assert.equal(adviceFor('sedang').whoNote?.includes('WHO'), true)
  assert.equal(adviceFor('xyz').key, 'baik')
  assert.equal(adviceFor('baik').cleanRoomItems.length, 0)
})

test('coffeeHazeRule: tunda jemur bila ISPU ≥ 101 ATAU (AOD ≥ 1 DAN DNI siang < 300); kerja kebun bila ≥ 201', () => {
  assert.equal(coffeeHazeRule({ ispuIndex: 101 }).dryingHold, true)
  assert.equal(coffeeHazeRule({ ispuIndex: 100 }).dryingHold, false)
  assert.equal(coffeeHazeRule({ ispuIndex: 60, aod: 1.2, dniDayMax: 250 }).dryingHold, true)
  assert.equal(coffeeHazeRule({ ispuIndex: 60, aod: 1.2, dniDayMax: 600 }).dryingHold, false)
  assert.equal(coffeeHazeRule({ ispuIndex: 201 }).fieldWorkHold, true)
  assert.equal(coffeeHazeRule({ ispuIndex: 200 }).fieldWorkHold, false)
})

test('summarizeAirQuality: bentuk ringkas untuk daftar sentra', () => {
  const s = summarizeAirQuality(assessAirQuality(base()))
  assert.deepEqual(Object.keys(s), ['level', 'ispu', 'category', 'categoryKey', 'param', 'haze', 'visibilityKm', 'partial'])
  assert.equal(summarizeAirQuality(null), null)
})
