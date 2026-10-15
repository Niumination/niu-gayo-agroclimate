// H-ASAP — server/airQuality.js: URL, normalisasi, degradasi tanpa throw (fetchImpl disuntik).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import aqFixture from './fixtures/hazards/openmeteo-airquality-takengon.json' with { type: 'json' }
import visFixture from './fixtures/hazards/openmeteo-forecast-bestmatch-visibility.json' with { type: 'json' }
import {
  buildAirQualityUrl, buildVisibilityUrl, normalizeAirQuality, normalizeVisibility, getAirQualityForLocation,
  getAirQualitySummary, nowIsoWib, sliceAround, findLocation, AQ_SOURCE,
} from '../server/airQuality.js'
import { LOCATIONS } from '../src/data/locations.js'

const takengon = findLocation('takengon')
// 2026-10-14 14:00 WIB = 07:00 UTC
const NOW = new Date('2026-10-14T07:00:00Z')

const okJson = (body) => ({ ok: true, status: 200, json: async () => body })
const httpErr = (status) => ({ ok: false, status, json: async () => ({}) })
function mockFetch({ aq = okJson(aqFixture), vis = okJson(visFixture) } = {}) {
  const calls = []
  const fn = async (url) => {
    calls.push(url)
    if (url.startsWith('https://air-quality-api.open-meteo.com/')) return typeof aq === 'function' ? aq() : aq
    if (url.startsWith('https://api.open-meteo.com/')) return typeof vis === 'function' ? vis() : vis
    throw new Error(`URL tak terduga: ${url}`)
  }
  fn.calls = calls
  return fn
}

test('buildAirQualityUrl: CAMS global, past_days=1, zona waktu Asia/Jakarta, parameter lengkap', () => {
  const u = new URL(buildAirQualityUrl(takengon))
  assert.equal(u.origin + u.pathname, 'https://air-quality-api.open-meteo.com/v1/air-quality')
  assert.equal(u.searchParams.get('domains'), 'cams_global')
  assert.equal(u.searchParams.get('past_days'), '1')
  assert.equal(u.searchParams.get('timezone'), 'Asia/Jakarta')
  assert.equal(u.searchParams.get('latitude'), String(takengon.lat))
  for (const p of ['pm2_5', 'pm10', 'carbon_monoxide', 'aerosol_optical_depth']) {
    assert.ok(u.searchParams.get('hourly').split(',').includes(p), `hourly ${p}`)
    assert.ok(u.searchParams.get('current').split(',').includes(p), `current ${p}`)
  }
})

test('buildVisibilityUrl: best_match dengan visibility + DNI, 2 hari', () => {
  const u = new URL(buildVisibilityUrl(takengon))
  assert.equal(u.origin + u.pathname, 'https://api.open-meteo.com/v1/forecast')
  assert.equal(u.searchParams.get('models'), 'best_match')
  assert.deepEqual(u.searchParams.get('hourly').split(','), ['visibility', 'relative_humidity_2m', 'direct_normal_irradiance'])
  assert.equal(u.searchParams.get('forecast_days'), '2')
})

test('normalizeAirQuality / normalizeVisibility: hanya kolom yang dipakai, panjang deret utuh', () => {
  const n = normalizeAirQuality(aqFixture)
  assert.equal(n.hourly.time.length, 144)
  assert.equal(n.hourly.pm2_5.length, 144)
  assert.equal(n.current.pm2_5, aqFixture.current.pm2_5)
  assert.equal(n.grid.lat, aqFixture.latitude)
  assert.deepEqual(normalizeAirQuality(null).hourly.time, [])
  const v = normalizeVisibility(visFixture)
  assert.equal(v.visibility.length, 48)
  assert.equal(v.direct_normal_irradiance.length, 48)
  assert.deepEqual(v.relative_humidity_2m, []) // fixture lama tanpa RH → kolom kosong, domain melewati penyaringan kabut
  assert.deepEqual(normalizeVisibility(undefined).time, [])
})

test('nowIsoWib: UTC → jam lokal WIB dibulatkan ke jam', () => {
  assert.equal(nowIsoWib(NOW), '2026-10-14T14:00')
  assert.equal(nowIsoWib(new Date('2026-10-14T17:45:00Z')), '2026-10-15T00:00')
})

test('sliceAround: potong deret di sekitar now (24 sebelum, 24 sesudah)', () => {
  const s = sliceAround(normalizeAirQuality(aqFixture).hourly, '2026-10-14T14:00', 24, 24)
  assert.equal(s.time.length, 49)
  assert.equal(s.time[0], '2026-10-13T14:00')
  assert.equal(s.time[48], '2026-10-15T14:00')
  assert.equal(s.pm2_5.length, 49)
  const edge = sliceAround({ time: ['2026-10-13T00:00', '2026-10-13T01:00'], v: [1, 2] }, '2026-10-13T00:30', 24, 24)
  assert.equal(edge.time.length, 2)
})

test('getAirQualityForLocation: payload lengkap dari fixture (2 panggilan upstream)', async () => {
  const fetchImpl = mockFetch()
  const r = await getAirQualityForLocation('takengon', { fetchImpl, now: NOW })
  assert.equal(fetchImpl.calls.length, 2)
  assert.equal(r.degraded, false)
  assert.equal(r.location.id, 'takengon')
  assert.equal(r.location.name, takengon.name)
  assert.equal(r.source, AQ_SOURCE)
  assert.ok(r.retrievedAt)
  assert.equal(r.assessment.time, '2026-10-14T14:00')
  assert.equal(r.assessment.ispu.category.key, 'baik')
  assert.equal(r.assessment.haze.level, 'ringan')
  assert.deepEqual(r.warnings, [])
  assert.equal(r.data.hourly.time.length, 49)
  assert.equal(r.data.visibility.time.length, 37)
  assert.equal(r.data.current.pm2_5, aqFixture.current.pm2_5)
})

test('getAirQualityForLocation: upstream AQ HTTP 500 → degraded, tidak throw', async () => {
  const r = await getAirQualityForLocation('takengon', { fetchImpl: mockFetch({ aq: httpErr(500) }), now: NOW })
  assert.equal(r.degraded, true)
  assert.match(r.error, /HTTP 500/)
  assert.equal(r.assessment, null)
  assert.equal(r.location.id, 'takengon')
})

test('getAirQualityForLocation: fetch melempar (timeout/jaringan) → degraded dengan pesan', async () => {
  const fetchImpl = async () => { throw new Error('fetch failed: ETIMEDOUT') }
  const r = await getAirQualityForLocation('takengon', { fetchImpl, now: NOW })
  assert.equal(r.degraded, true)
  assert.match(r.error, /ETIMEDOUT/)
})

test('getAirQualityForLocation: jarak pandang gagal → penilaian tetap jalan tanpa proksi kabut asap (+warning)', async () => {
  const r = await getAirQualityForLocation('takengon', { fetchImpl: mockFetch({ vis: httpErr(429) }), now: NOW })
  assert.equal(r.degraded, false)
  assert.equal(r.assessment.haze.level, 'tidak_diketahui')
  assert.equal(r.assessment.flags.visibilityAvailable, false)
  assert.equal(r.data.visibility, null)
  assert.ok(r.warnings.some((w) => /jarak pandang/.test(w)))
})

test('getAirQualityForLocation: lokasi tak dikenal → degraded tanpa panggilan upstream', async () => {
  const fetchImpl = mockFetch()
  const r = await getAirQualityForLocation('atlantis', { fetchImpl, now: NOW })
  assert.equal(r.degraded, true)
  assert.match(r.error, /tidak dikenal/)
  assert.equal(fetchImpl.calls.length, 0)
})

test('getAirQualityForLocation: menerima objek lokasi langsung & memakai AbortSignal + User-Agent', async () => {
  let opts
  const fetchImpl = async (url, o) => { opts = o; return url.includes('air-quality') ? okJson(aqFixture) : okJson(visFixture) }
  const r = await getAirQualityForLocation(takengon, { fetchImpl, now: NOW })
  assert.equal(r.degraded, false)
  assert.ok(opts.signal)
  assert.match(opts.headers['User-Agent'], /niu-gayo-agroclimate/)
})

test('getAirQualitySummary: 15 sentra, hitung yang degraded, pilih ISPU terburuk', async () => {
  const good = await getAirQualityForLocation('takengon', { fetchImpl: mockFetch(), now: NOW })
  const getter = async (id) => {
    if (id === 'linge') return { degraded: true, assessment: null }
    if (id === 'bies') return { ...good, assessment: { ...good.assessment, ispu: { ...good.assessment.ispu, index: 150, category: { key: 'tidak_sehat', label: 'Tidak Sehat', level: 'waspada' } }, level: 'waspada' } }
    return good
  }
  const s = await getAirQualitySummary(getter)
  assert.equal(s.count, LOCATIONS.length)
  assert.equal(s.locations.length, 15)
  assert.equal(s.degradedCount, 1)
  assert.equal(s.worst.id, 'bies')
  assert.equal(s.worst.ispu, 150)
  const linge = s.locations.find((l) => l.id === 'linge')
  assert.equal(linge.degraded, true)
  assert.equal(linge.ispu, null)
  assert.equal(s.locations.find((l) => l.id === 'takengon').category, 'Baik')
})
