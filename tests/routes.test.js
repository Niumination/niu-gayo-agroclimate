/**
 * routes — uji lapisan HTTP yang dipisah (audit F-09/F-12/F-13):
 * token constant-time, header keamanan pada respons JSON & CAP, dan jalur 404.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SECURITY_HEADERS, CAP_HEADERS, tokenMatches, createHandler } from '../server/routes.js'
import { clientIp } from '../server/reports.js'

function fakeRes() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(data) { this.body = data ?? ''; return this },
  }
}

test('tokenMatches: sama → true; beda panjang/isi/tipe → false', () => {
  assert.equal(tokenMatches('rahasia-uji', 'rahasia-uji'), true)
  assert.equal(tokenMatches('rahasia-uji', 'rahasia-uja'), false)
  assert.equal(tokenMatches('pendek', 'panjang-sekali'), false)
  assert.equal(tokenMatches('', 'rahasia-uji'), false)
  assert.equal(tokenMatches(null, 'rahasia-uji'), false)
  assert.equal(tokenMatches(12345, 12345), false)
})

test('SECURITY_HEADERS & CAP_HEADERS memuat header wajib', () => {
  assert.equal(SECURITY_HEADERS['X-Content-Type-Options'], 'nosniff')
  assert.equal(SECURITY_HEADERS['X-Frame-Options'], 'DENY')
  assert.equal(SECURITY_HEADERS['Referrer-Policy'], 'no-referrer')
  assert.match(CAP_HEADERS['Content-Type'], /cap\+xml/)
  assert.equal(CAP_HEADERS['X-Content-Type-Options'], 'nosniff')
})

test('createHandler: jalur tak dikenal → 404 JSON dengan header keamanan', async () => {
  const handler = createHandler({ VALID_LOCATIONS: new Set(), LOCATIONS: [] })
  const res = fakeRes()
  await handler({ url: '/api/entah', method: 'GET', headers: {} }, res)
  assert.equal(res.status, 404)
  assert.match(res.headers['Content-Type'], /application\/json/)
  assert.equal(res.headers['X-Content-Type-Options'], 'nosniff')
  assert.equal(res.headers['X-Frame-Options'], 'DENY')
  assert.equal(res.headers['Cache-Control'], 'no-store')
  assert.deepEqual(JSON.parse(res.body), { error: 'not found' })
})

test('createHandler: /api/alerts/run tanpa token cocok → 403 (token di-set)', async () => {
  process.env.ALERTS_CRON_TOKEN = 'uji-token'
  try {
    const handler = createHandler({ VALID_LOCATIONS: new Set(), LOCATIONS: [] })
    const res = fakeRes()
    await handler({ url: '/api/alerts/run', method: 'POST', headers: { 'x-cron-token': 'salah' } }, res)
    assert.equal(res.status, 403)
    assert.match(res.body, /token cron tidak cocok/)
  } finally {
    delete process.env.ALERTS_CRON_TOKEN
  }
})

test('createHandler: /api/alerts/run bukan POST → 405', async () => {
  const handler = createHandler({ VALID_LOCATIONS: new Set(), LOCATIONS: [] })
  const res = fakeRes()
  await handler({ url: '/api/alerts/run', method: 'GET', headers: {} }, res)
  assert.equal(res.status, 405)
})

test('createHandler: /healthz membedakan revisi API dan frontend', async () => {
  const handler = createHandler({
    PKG_VERSION: '2.2.1',
    BUILD_INFO: { revision: 'a'.repeat(40), dirty: false, frontendRevision: 'b'.repeat(40), frontendVersion: '2.2.1', frontendBuiltAt: '2026-10-18T00:00:00.000Z' },
    cacheStats: () => ({ entries: 0, fresh: 0 }),
    peek: () => null,
    HAZARDS_ON: [],
    FIRMS_MAP_KEY: '',
    readToken: () => null,
  })
  const res = fakeRes()
  await handler({ url: '/healthz', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.version, '2.2.1')
  assert.equal(body.build.revision, 'a'.repeat(40))
  assert.equal(body.build.frontendRevision, 'b'.repeat(40))
  assert.equal(body.build.dirty, false)
})

test('createHandler: /api/weather saat upstream gagal → JSON degraded 200 dengan deret kosong', async () => {
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    LOCATIONS: [{ id: 'takengon', name: 'Takengon Kota' }],
    weatherGet: async () => { throw new Error('Open-Meteo timeout') },
  })
  const res = fakeRes()
  await handler({ url: '/api/weather?location=takengon', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.location.name, 'Takengon Kota')
  assert.equal(body.degraded, true)
  assert.equal(body.error, 'Open-Meteo timeout')
  assert.deepEqual(body.times, [])
  assert.deepEqual(body.precipitation, [])
})

test('createHandler: /api/alerts saat sumber cuaca gagal → JSON parsial degraded 200, bukan 502', async () => {
  const handler = createHandler({
    alertsGet: async () => { throw new Error('Open-Meteo timeout') },
    aqSummaryGet: async () => ({ retrievedAt: '2026-10-18T00:00:00.000Z', worst: null, degradedCount: 15, locations: [] }),
    hazardsAllGet: async () => ({ retrievedAt: '2026-10-18T00:00:00.000Z', worst: 'n/a', activeByHazard: {}, locations: [] }),
  })
  const res = fakeRes()
  await handler({ url: '/api/alerts', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.degraded, true)
  assert.deepEqual(body.locations, [])
  assert.equal(body.watershedRainIndex24h, null)
  assert.equal(body.sourceErrors.alerts, 'Open-Meteo timeout')
  assert.deepEqual(body.degradedSources, ['alerts', 'airQuality'])
  assert.deepEqual(body.airQuality.locations, [])
  assert.deepEqual(body.hazards.locations, [])
})

test('createHandler: /api/hotspots saat FIRMS gagal → JSON degraded 200, bukan 502', async () => {
  const handler = createHandler({ hotspotsGet: async () => { throw new Error('FIRMS HTTP 503') } })
  const res = fakeRes()
  await handler({ url: '/api/hotspots', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.degraded, true)
  assert.equal(body.reason, 'FIRMS HTTP 503')
  assert.deepEqual(body.hotspots, [])
})

test('createHandler: /api/ensemble upstream gagal → JSON degraded 200, bukan 502', async () => {
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    LOCATIONS: [{ id: 'takengon', name: 'Takengon Kota' }],
    ensembleGet: async () => { throw new Error('fetch failed') },
  })
  const res = fakeRes()
  await handler({ url: '/api/ensemble?location=takengon', method: 'GET', headers: {} }, res)
  assert.equal(res.status, 200)
  assert.deepEqual(JSON.parse(res.body), {
    location: { id: 'takengon', name: 'Takengon Kota' },
    retrievedAt: JSON.parse(res.body).retrievedAt,
    degraded: true,
    error: 'fetch failed',
    data: null,
  })
  assert.ok(Number.isFinite(Date.parse(JSON.parse(res.body).retrievedAt)))
})

// Sprint B · F-36 (audit 23 Okt 2026) — jalur HTTP laporan warga memakai clientIp().
test('createHandler: POST /api/reports mengabaikan x-forwarded-for buatan klien', async () => {
  const kunci = []
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    clientIp,
    rateLimited: (ip) => { kunci.push(ip); return false },
    validateReport: () => ({ report: { location: 'takengon', type: 'longsor', note: '' } }),
    submitReport: async () => ({ saved: { ok: true }, relayed: false }),
  })
  const kirim = async (xff) => {
    const res = fakeRes()
    const body = JSON.stringify({ location: 'takengon', type: 'longsor' })
    const req = {
      url: '/api/reports',
      method: 'POST',
      headers: { 'x-forwarded-for': xff, 'content-type': 'application/json' },
      socket: { remoteAddress: '10.0.0.9' },
      async *[Symbol.asyncIterator]() { yield Buffer.from(body) },
    }
    await handler(req, res)
    return res.status
  }
  assert.equal(await kirim('1.1.1.1'), 201)
  assert.equal(await kirim('2.2.2.2'), 201)
  assert.deepEqual(kunci, ['10.0.0.9', '10.0.0.9'], 'dua header berbeda harus memakai kunci yang sama')
})

// Sprint B · F-05 — /healthz harus menyebut IMERG, bukan hanya "semua normal".
test('createHandler: /healthz melaporkan sumber imerg turunan dari /api/alerts', async () => {
  const handler = createHandler({
    VALID_LOCATIONS: new Set(),
    LOCATIONS: [],
    readToken: () => '',
    cacheStats: () => ({}),
    PKG_VERSION: '2.2.5',
    BUILD_INFO: {},
    peek: () => ({
      fresh: true,
      value: {
        generatedAt: '2026-10-23T16:00:00.000Z',
        staleness: { imergCount: 0, fallbackCount: 15, maxAgeDays: null, total: 15 },
        locations: [{ antecedent: { source: 'model-ecmwf', fallbackReason: 'IMERG tidak dapat dijangkau dari host ini (fetch failed)' } }],
      },
    }),
  })
  const res = fakeRes()
  await handler({ url: '/healthz', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.sources.imerg.state, 'degraded')
  assert.equal(body.sources.imerg.imergCount, 0)
  assert.equal(body.sources.imerg.fallbackCount, 15)
  assert.match(body.sources.imerg.error, /tidak dapat dijangkau/)
})

// Sprint B · F-04 — /api/hazards membawa worstAcute & chronic tanpa mengubah worst.
test('createHandler: /api/hazards?location=all meneruskan worstAcute dan chronic (aditif)', async () => {
  const row = { id: 'takengon', name: 'Takengon', worst: 'bahaya', worstAcute: 'waspada', active: ['karat'], chronic: ['karat'], levels: { karat: 'bahaya' }, degraded: false, counts: null, evaluatedAt: null }
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    LOCATIONS: [{ id: 'takengon', name: 'Takengon' }],
    HAZARDS_ON: true,
    readToken: () => '',
    hazardsAllGet: async () => ({
      retrievedAt: '2026-10-24T10:00:00.000Z',
      total: 1,
      degradedCount: 0,
      worst: { id: 'takengon', name: 'Takengon', level: 'bahaya', active: ['karat'] },
      worstAcute: { id: 'takengon', name: 'Takengon', level: 'waspada', active: ['karat'] },
      activeByHazard: { karat: ['takengon'] },
      locations: [row],
      _full: [],
    }),
    hazardsGet: async () => ({}),
  })
  const res = fakeRes()
  await handler({ url: '/api/hazards?location=all', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(body.worst.level, 'bahaya', 'worst lama tidak boleh berubah')
  assert.equal(body.worstAcute.level, 'waspada')
  assert.deepEqual(body.locations[0].chronic, ['karat'])
})
