import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { buildFirmsUrl, getHotspots, hotspotsForLocation, clampFirmsDays, FIRMS_SOURCE, FIRMS_DAYS_MAX } from '../server/firms.js'
import { LOCATIONS } from '../src/data/locations.js'

const viirsCsv = fs.readFileSync(new URL('./fixtures/hazards/firms-viirs-sample-SYNTHETIC.csv', import.meta.url), 'utf8')
// Dua fixture NYATA (diambil dengan FIRMS_MAP_KEY sungguhan, 16 Okt 2026; lihat docs/how-to/08):
const gayaEmptyCsv = fs.readFileSync(new URL('./fixtures/hazards/firms-viirs-snpp-gayo-2d.csv', import.meta.url), 'utf8')      // bbox Gayo, 2 hari → header saja (nol hotspot)
const acehRealCsv = fs.readFileSync(new URL('./fixtures/hazards/firms-viirs-aceh-5d-REAL.csv', import.meta.url), 'utf8')        // Aceh luas, 5 hari → 2 baris nyata
const NOW = new Date('2026-10-14T12:00:00Z') // fixture: deteksi 13 Okt 06.45/18.32 & 14 Okt 06.27 UTC
const SOURCES = ['VIIRS_SNPP_NRT', 'VIIRS_NOAA20_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT']

function fetchFor(handlers) {
  const calls = []
  const fetchImpl = async (url) => {
    calls.push(url)
    const src = SOURCES.find((s) => url.includes(`/${s}/`))
    const h = handlers[src]
    if (h instanceof Error) throw h
    if (typeof h === 'number') return { ok: false, status: h, text: async () => '' }
    return { ok: true, status: 200, text: async () => h ?? '' }
  }
  fetchImpl.calls = calls
  return fetchImpl
}

test('buildFirmsUrl: {api}/{key}/{source}/{bbox}/{days}', () => {
  assert.equal(buildFirmsUrl('VIIRS_SNPP_NRT', { mapKey: 'abc', bbox: '96.1,3.9,97.5,5.2', days: 2 }), 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/abc/VIIRS_SNPP_NRT/96.1,3.9,97.5,5.2/2')
})

test('getHotspots: tanpa MAP_KEY → degraded, tanpa fetch, perLocation 15 sentra kosong', async () => {
  const fetchImpl = fetchFor({})
  const p = await getHotspots({ fetchImpl, now: NOW, mapKey: '' })
  assert.equal(p.degraded, true)
  assert.match(p.reason, /FIRMS_MAP_KEY/)
  assert.equal(fetchImpl.calls.length, 0)
  assert.equal(Object.keys(p.perLocation).length, 15)
  assert.deepEqual(p.hotspots, [])
  assert.equal(p.source, FIRMS_SOURCE)
})

test('getHotspots: 4 sumber, 1 gagal → warnings, sisanya digabung; saringan keyakinan & jendela 48 jam', async () => {
  const modis = 'latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight\n4.6400,96.8600,312.5,1.1,1.0,2026-10-14,0355,Terra,MODIS,82,6.1NRT,290.2,25.3,D\n'
  const fetchImpl = fetchFor({ VIIRS_SNPP_NRT: viirsCsv, VIIRS_NOAA20_NRT: 503, VIIRS_NOAA21_NRT: 'No data found', MODIS_NRT: modis })
  const p = await getHotspots({ fetchImpl, now: NOW, mapKey: 'k' })
  assert.equal(p.degraded, false)
  assert.equal(fetchImpl.calls.length, 4)
  assert.equal(p.warnings.length, 1)
  assert.match(p.warnings[0], /NOAA20.*503/)
  assert.deepEqual(p.sources.map((s) => s.source), ['VIIRS_SNPP_NRT', 'VIIRS_NOAA21_NRT', 'MODIS_NRT'])
  assert.equal(p.counts.total, 5)
  assert.equal(p.counts.accepted, 4) // 1 VIIRS keyakinan 'l' dibuang
  assert.equal(p.hotspots.length, 4)
  assert.ok(p.hotspots.every((h) => h.nearest && typeof h.ageHours === 'number'))
  // MODIS 14 Okt 03.55 UTC, 1,5 km dari Takengon, FRP 25 → bahaya & intens
  const tk = p.perLocation.takengon
  assert.equal(tk.within10km24h, 1)
  assert.equal(tk.intense24h, 1)
  assert.equal(tk.level, 'bahaya')
  assert.ok(tk.nearestKm < 3)
})

test('getHotspots: semua sumber gagal / kunci ditolak → degraded dengan alasan', async () => {
  const p = await getHotspots({ fetchImpl: fetchFor({ VIIRS_SNPP_NRT: 500, VIIRS_NOAA20_NRT: new Error('timeout'), VIIRS_NOAA21_NRT: 500, MODIS_NRT: 500 }), now: NOW, mapKey: 'k' })
  assert.equal(p.degraded, true)
  assert.match(p.reason, /HTTP 500/)
  assert.match(p.reason, /timeout/)
  const bad = await getHotspots({ fetchImpl: fetchFor({ VIIRS_SNPP_NRT: 'Invalid MAP_KEY.', VIIRS_NOAA20_NRT: 'Invalid MAP_KEY.', VIIRS_NOAA21_NRT: 'Invalid MAP_KEY.', MODIS_NRT: 'Invalid MAP_KEY.' }), now: NOW, mapKey: 'salah' })
  assert.equal(bad.degraded, true)
  assert.match(bad.reason, /Invalid MAP_KEY/)
})

test('hotspotsForLocation: potongan ≤ 50 km terurut jarak + ringkasan sentra', async () => {
  const fetchImpl = fetchFor({ VIIRS_SNPP_NRT: viirsCsv, VIIRS_NOAA20_NRT: '', VIIRS_NOAA21_NRT: '', MODIS_NRT: '' })
  const all = await getHotspots({ fetchImpl, now: NOW, mapKey: 'k' })
  const c = hotspotsForLocation(all, 'celala')
  assert.equal(c.location.id, 'celala')
  assert.equal(c.summary.id, 'celala')
  assert.ok(c.hotspots.length >= 1)
  for (let i = 1; i < c.hotspots.length; i++) assert.ok(c.hotspots[i].distanceKm >= c.hotspots[i - 1].distanceKm)
  assert.ok(c.hotspots.every((h) => h.distanceKm <= 50))
  assert.equal(hotspotsForLocation(all, 'tidak-ada'), null)
  assert.equal(LOCATIONS.length, 15)
})

test('clampFirmsDays: rentang API FIRMS 1..5 (HTTP 400 di luar itu) dijepit & nilai tak sah → default 2', () => {
  assert.equal(FIRMS_DAYS_MAX, 5)
  assert.equal(clampFirmsDays(1), 1)
  assert.equal(clampFirmsDays(2), 2)
  assert.equal(clampFirmsDays(5), 5)
  assert.equal(clampFirmsDays(10), 5) // dulu: HTTP 400 "Invalid day range. Expects [1..5]"
  assert.equal(clampFirmsDays(99), 5)
  assert.equal(clampFirmsDays(0), 1)
  assert.equal(clampFirmsDays(-3), 1)
  assert.equal(clampFirmsDays(3.6), 4) // dibulatkan
  assert.equal(clampFirmsDays('abc'), 2)
  assert.equal(clampFirmsDays(undefined), 2)
  assert.equal(clampFirmsDays(NaN), 2)
})

test('buildFirmsUrl: hari di luar rentang dijepit sebelum dikirim ke API', () => {
  const base = 'https://firms.modaps.eosdis.nasa.gov/api/area/csv/abc/VIIRS_SNPP_NRT/96.1,3.9,97.5,5.2'
  assert.equal(buildFirmsUrl('VIIRS_SNPP_NRT', { mapKey: 'abc', bbox: '96.1,3.9,97.5,5.2', days: 10 }), `${base}/5`)
  assert.equal(buildFirmsUrl('VIIRS_SNPP_NRT', { mapKey: 'abc', bbox: '96.1,3.9,97.5,5.2', days: 0 }), `${base}/1`)
  assert.equal(buildFirmsUrl('VIIRS_SNPP_NRT', { mapKey: 'abc', bbox: '96.1,3.9,97.5,5.2', days: 'abc' }), `${base}/2`)
})

test('getHotspots (fixture NYATA "nol hotspot"): sumber sukses → degraded FALSE, 15 sentra level rendah', () => {
  // Inilah keadaan nyata bbox Gayo pada 16 Okt 2026: kunci sah, tidak ada deteksi panas 2 hari.
  // Penting: kartu tidak boleh berbunyi "kunci belum diatur" hanya karena deteksinya nol.
  const fetchImpl = fetchFor({ VIIRS_SNPP_NRT: gayaEmptyCsv, VIIRS_NOAA20_NRT: gayaEmptyCsv, VIIRS_NOAA21_NRT: gayaEmptyCsv, MODIS_NRT: gayaEmptyCsv })
  return getHotspots({ fetchImpl, now: NOW, mapKey: 'kunci-uji-firms' }).then((p) => {
    assert.equal(p.degraded, false)
    assert.equal(p.reason, null)
    assert.deepEqual(p.warnings, [])
    assert.equal(p.days, 2)
    assert.equal(p.counts.total, 0)
    assert.equal(p.counts.accepted, 0)
    assert.equal(p.hotspots.length, 0)
    assert.equal(Object.keys(p.perLocation).length, 15)
    assert.equal(p.perLocation.takengon.level, 'rendah')
    assert.equal(p.perLocation.takengon.within50km48h, 0)
    assert.equal(p.sources.length, 4)
    assert.ok(p.sources.every((s) => s.rows === 0))
  })
})

test('getHotspots (fixture NYATA Aceh, 2 baris): counts benar; baris di luar 50 km tidak dihitung per sentra', () => {
  const fetchImpl = fetchFor({ VIIRS_SNPP_NRT: acehRealCsv, VIIRS_NOAA20_NRT: acehRealCsv, VIIRS_NOAA21_NRT: acehRealCsv, MODIS_NRT: acehRealCsv })
  return getHotspots({ fetchImpl, now: new Date('2026-10-16T12:00:00Z'), days: 99, mapKey: 'kunci-uji-firms' }).then((p) => {
    assert.equal(p.degraded, false)
    assert.equal(p.days, 5) // hari dijepit dari 99 → 5 pada payload & URL
    assert.equal(fetchImpl.calls.length, 4)
    assert.ok(fetchImpl.calls.every((u) => u.endsWith('/5')), 'URL memakai rentang terjepit')
    assert.equal(p.counts.total, 8, '4 sumber × 2 baris nyata')
    assert.equal(p.counts.accepted, 8)
    const tk = p.perLocation.takengon
    assert.equal(tk.within50km48h, 0, 'deteksi Aceh Utara > 50 km dari Takengon')
    assert.equal(tk.level, 'rendah')
    assert.ok(p.hotspots.every((h) => h.nearest.km > 50))
  })
})
