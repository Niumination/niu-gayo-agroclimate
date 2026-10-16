/**
 * routes — uji lapisan HTTP yang dipisah (audit F-09/F-12/F-13):
 * token constant-time, header keamanan pada respons JSON & CAP, dan jalur 404.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { SECURITY_HEADERS, CAP_HEADERS, tokenMatches, createHandler } from '../server/routes.js'

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
