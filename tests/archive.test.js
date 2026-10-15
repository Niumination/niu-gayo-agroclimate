import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  buildArchiveUrl, buildRecentUrl, todayWib, shiftDate, diffDays, mergeDaily, mergeHourly,
  getArchiveForLocation, saveArchiveFile, loadArchiveFile, archiveFilePath,
} from '../server/archive.js'
import { LOCATIONS } from '../src/data/locations.js'

const takengon = LOCATIONS.find((l) => l.id === 'takengon')
const NOW = new Date('2026-10-15T09:00:00Z') // 16.00 WIB

/** Deret harian + jam-an sintetis gaya Open-Meteo untuk rentang tanggal (inklusif). */
export function synthOpenMeteo(startDate, endDate, { rainFn = () => 0, nullAfter = null } = {}) {
  const daily = { time: [], precipitation_sum: [], temperature_2m_max: [], temperature_2m_min: [], relative_humidity_2m_mean: [], wind_speed_10m_max: [], et0_fao_evapotranspiration: [] }
  const hourly = { time: [], temperature_2m: [], relative_humidity_2m: [], wind_speed_10m: [], precipitation: [] }
  for (let d = startDate; d <= endDate; d = shiftDate(d, 1)) {
    const dead = nullAfter && d > nullAfter
    const rain = rainFn(d)
    daily.time.push(d)
    daily.precipitation_sum.push(dead ? null : rain)
    daily.temperature_2m_max.push(dead ? null : 26)
    daily.temperature_2m_min.push(dead ? null : 15)
    daily.relative_humidity_2m_mean.push(dead ? null : 80)
    daily.wind_speed_10m_max.push(dead ? null : 12)
    daily.et0_fao_evapotranspiration.push(dead ? null : 3.5)
    for (let h = 0; h < 24; h++) {
      hourly.time.push(`${d}T${String(h).padStart(2, '0')}:00`)
      hourly.temperature_2m.push(dead ? null : 18 + 8 * Math.sin((Math.PI * (h - 6)) / 12))
      hourly.relative_humidity_2m.push(dead ? null : 95 - 35 * Math.max(0, Math.sin((Math.PI * (h - 6)) / 12)))
      hourly.wind_speed_10m.push(dead ? null : 6)
      // hujan jatuh pukul 15.00–17.00 (sesudah jam pengamatan 12.00)
      hourly.precipitation.push(dead ? null : h >= 15 && h <= 17 ? rain / 3 : 0)
    }
  }
  return { latitude: 4.6, longitude: 96.9, elevation: 1200, daily, hourly, daily_units: {}, hourly_units: {} }
}

export function fetchFor(archiveJson, recentJson, { archiveStatus = 200, recentStatus = 200 } = {}) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const isArchive = url.startsWith('https://archive-api.open-meteo.com')
    const status = isArchive ? archiveStatus : recentStatus
    const body = isArchive ? archiveJson : recentJson
    if (status !== 200 || !body) return { ok: false, status: status === 200 ? 500 : status, json: async () => ({}) }
    return { ok: true, status: 200, json: async () => body }
  }
  fetchImpl.calls = calls
  return fetchImpl
}

test('todayWib/shiftDate/diffDays', () => {
  assert.equal(todayWib(new Date('2026-10-15T16:59:00Z')), '2026-10-15')
  assert.equal(todayWib(new Date('2026-10-15T17:00:00Z')), '2026-10-16') // 00.00 WIB
  assert.equal(shiftDate('2026-10-01', -1), '2026-09-30')
  assert.equal(diffDays('2026-10-10', '2026-10-15'), 5)
})

test('buildArchiveUrl: 92 hari s.d. kemarin WIB, variabel harian + jam-an; buildRecentUrl: past_days=7 ECMWF', () => {
  const u = new URL(buildArchiveUrl(takengon, { now: NOW }))
  assert.equal(u.searchParams.get('end_date'), '2026-10-14')
  assert.equal(u.searchParams.get('start_date'), '2026-07-15')
  assert.ok(u.searchParams.get('daily').includes('et0_fao_evapotranspiration'))
  assert.ok(u.searchParams.get('hourly').includes('relative_humidity_2m'))
  assert.equal(u.searchParams.get('timezone'), 'Asia/Jakarta')
  const r = new URL(buildRecentUrl(takengon))
  assert.equal(r.searchParams.get('past_days'), '7')
  assert.equal(r.searchParams.get('forecast_days'), '3')
  assert.equal(r.searchParams.get('models'), 'ecmwf_ifs025')
})

test('mergeDaily: arsip dulu, prakiraan mengisi celah (model) & masa depan (forecast), tanpa duplikat', () => {
  const archive = synthOpenMeteo('2026-10-01', '2026-10-14', { rainFn: () => 2, nullAfter: '2026-10-12' })
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17', { rainFn: () => 9 })
  const { daily, archiveEnd } = mergeDaily(archive.daily, recent.daily, { today: '2026-10-15' })
  assert.equal(archiveEnd, '2026-10-12')
  assert.equal(daily.time.length, 17) // 1–12 arsip + 13–17 prakiraan
  assert.equal(new Set(daily.time).size, 17)
  assert.deepEqual(daily.source.slice(10, 17), ['archive', 'archive', 'model', 'model', 'model', 'forecast', 'forecast'])
  assert.equal(daily.precipitation_sum[11], 2)
  assert.equal(daily.precipitation_sum[12], 9)
  // tanpa arsip: semua dari prakiraan
  const only = mergeDaily(null, recent.daily, { today: '2026-10-15' })
  assert.equal(only.archiveEnd, null)
  assert.equal(only.daily.time.length, 10)
})

test('mergeHourly: batas = jam arsip terakhir berdata', () => {
  const archive = synthOpenMeteo('2026-10-12', '2026-10-14', { nullAfter: '2026-10-13' })
  const recent = synthOpenMeteo('2026-10-13', '2026-10-16')
  const { hourly, archiveEnd } = mergeHourly(archive.hourly, recent.hourly, { today: '2026-10-15' })
  assert.equal(archiveEnd, '2026-10-13T23:00')
  assert.equal(hourly.time.length, 5 * 24)
  assert.equal(hourly.source[2 * 24 - 1], 'archive')
  assert.equal(hourly.source[2 * 24], 'model')
  assert.equal(hourly.source[hourly.time.length - 1], 'forecast')
})

test('getArchiveForLocation: sukses → payload lengkap, lag 1 hari, file tersimpan', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-archive-'))
  const archive = synthOpenMeteo('2026-07-15', '2026-10-14')
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const fetchImpl = fetchFor(archive, recent)
  const p = await getArchiveForLocation('takengon', { fetchImpl, now: NOW, dataDir: dir })
  assert.equal(p.degraded, false)
  assert.equal(p.location.id, 'takengon')
  assert.equal(p.today, '2026-10-15')
  assert.equal(p.archiveEnd, '2026-10-14')
  assert.equal(p.lagDays, 1)
  assert.equal(p.daily.time[0], '2026-07-15')
  assert.equal(p.daily.time.at(-1), '2026-10-17')
  assert.equal(p.hourly.time.length, p.daily.time.length * 24)
  assert.equal(fetchImpl.calls.length, 2)
  assert.ok(fs.existsSync(archiveFilePath('takengon', dir)))
  const saved = loadArchiveFile('takengon', dir)
  assert.equal(saved.rawArchive.daily.time.length, archive.daily.time.length)
})

test('getArchiveForLocation: arsip gagal → pakai salinan file; keduanya gagal → degraded tanpa throw', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-archive-'))
  const archive = synthOpenMeteo('2026-07-15', '2026-10-13')
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  saveArchiveFile('bies', { retrievedAt: '2026-10-14T00:00:00Z', rawArchive: archive }, dir)
  const p = await getArchiveForLocation('bies', { fetchImpl: fetchFor(null, recent, { archiveStatus: 503 }), now: NOW, dataDir: dir })
  assert.equal(p.degraded, false)
  assert.equal(p.fromFile, true)
  assert.equal(p.archiveEnd, '2026-10-13')
  assert.ok(p.warnings.some((w) => w.includes('salinan')))
  const q = await getArchiveForLocation('bies', { fetchImpl: fetchFor(null, null, { archiveStatus: 503, recentStatus: 500 }), now: NOW, dataDir: path.join(dir, 'kosong') })
  assert.equal(q.degraded, true)
  assert.equal(q.daily, null)
  assert.ok(q.error.includes('HTTP'))
})

test('getArchiveForLocation: hanya prakiraan (arsip hilang & tanpa file) → degraded, lag null; lag > 7 hari → degraded', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agro-archive-'))
  const recent = synthOpenMeteo('2026-10-08', '2026-10-17')
  const p = await getArchiveForLocation('ketol', { fetchImpl: fetchFor(null, recent, { archiveStatus: 404 }), now: NOW, dataDir: dir, persist: false })
  assert.equal(p.degraded, true)
  assert.equal(p.lagDays, null)
  assert.equal(p.daily.time.length, 10)
  const stale = synthOpenMeteo('2026-07-01', '2026-10-05')
  const s = await getArchiveForLocation('ketol', { fetchImpl: fetchFor(stale, recent), now: NOW, dataDir: dir, persist: false })
  assert.equal(s.lagDays, 10)
  assert.equal(s.degraded, true)
  assert.ok(s.warnings.some((w) => w.includes('tertinggal')))
  const bad = await getArchiveForLocation('tidak-ada', { fetchImpl: fetchFor(stale, recent), now: NOW, dataDir: dir })
  assert.equal(bad.degraded, true)
})
