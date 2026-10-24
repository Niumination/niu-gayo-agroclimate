/**
 * Sprint C · bundel 3 — data & jaringan (F-30, chronicByHazard, F-10) dan header (F-11, F-19).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { accumulatedRain, antecedentIndex } from '../src/domain/antecedentIndex.js'
import * as serverAntecedent from '../server/antecedent.js'
import { summarizeChronicByHazard } from '../server/hazards.js'
import { fetchWithTimeout } from '../src/lib/http.js'
import { SECURITY_HEADERS, createHandler } from '../server/routes.js'
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

// ── F-30 ────────────────────────────────────────────────────────────────────
test('F-30: ARI 24/72 jam dihitung satu rumus untuk klien dan server', () => {
  const series = Array.from({ length: 100 }, (_, i) => (i % 7) + 0.5)
  const ari = antecedentIndex(series, 99)
  const manual24 = series.slice(76, 100).reduce((a, b) => a + b, 0)
  const manual72 = series.slice(28, 100).reduce((a, b) => a + b, 0)
  assert.equal(ari.ari24, Math.round(manual24 * 10) / 10)
  assert.equal(ari.ari72, Math.round(manual72 * 10) / 10)
  assert.equal(ari.source, 'model-ecmwf')
  // server/antecedent.js tidak lagi punya salinan rumus: ia meneruskan fungsi yang sama.
  assert.equal(serverAntecedent.antecedentIndex, antecedentIndex)
  assert.equal(serverAntecedent.accumulatedRain, accumulatedRain)
})

test('F-30: deret pendek & indeks di luar batas tidak melempar', () => {
  assert.deepEqual(antecedentIndex([1, 2, 3], 2), { ari24: 6, ari72: 6, source: 'model-ecmwf' })
  assert.equal(accumulatedRain([], 0, 24), 0)
  assert.equal(accumulatedRain(null, 0, 24), 0)
  assert.equal(accumulatedRain([5, 5], 99, 24), 10, 'indeks melewati ujung tetap dihitung dari ujung')
})

// ── chronicByHazard ─────────────────────────────────────────────────────────
test('chronicByHazard menggabungkan bahaya kronis dari SEMUA baris, bukan rows[0]', () => {
  const rows = [
    { id: 'a', chronic: [] },
    { id: 'b', chronic: ['karat'] },
    { id: 'c', chronic: ['karat', 'kabut'] },
  ]
  assert.deepEqual(summarizeChronicByHazard(rows), { karat: ['b', 'c'], kabut: ['c'] })
  assert.deepEqual(summarizeChronicByHazard([]), {})
  assert.deepEqual(summarizeChronicByHazard(undefined), {})
})

// ── F-10 ────────────────────────────────────────────────────────────────────
test('F-10: fetchWithTimeout membatalkan permintaan yang menggantung', async () => {
  const asli = globalThis.fetch
  globalThis.fetch = (url, opts) => new Promise((_, reject) => {
    opts.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })))
  })
  try {
    const mulai = Date.now()
    await assert.rejects(() => fetchWithTimeout('http://contoh.invalid', {}, 30), /abort/i)
    assert.ok(Date.now() - mulai < 2000, 'harus berhenti jauh sebelum batas uji')
  } finally {
    globalThis.fetch = asli
  }
})

test('F-10: fetchWithTimeout meneruskan hasil normal apa adanya', async () => {
  const asli = globalThis.fetch
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ x: 1 }) })
  try {
    const r = await fetchWithTimeout('http://contoh.invalid', {}, 5000)
    assert.equal(r.status, 200)
    assert.deepEqual(await r.json(), { x: 1 })
  } finally {
    globalThis.fetch = asli
  }
})

// ── F-11 & F-19 ─────────────────────────────────────────────────────────────
function fakeRes() {
  return {
    status: null, headers: null, body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(data) { this.body = data ?? ''; return this },
  }
}

test('F-11: header keamanan baru terpasang (HSTS, Permissions-Policy, CSP API)', () => {
  assert.match(SECURITY_HEADERS['Strict-Transport-Security'], /max-age=31536000/)
  assert.match(SECURITY_HEADERS['Permissions-Policy'], /camera=\(\)/)
  assert.match(SECURITY_HEADERS['Content-Security-Policy'], /default-src 'none'/)
  assert.match(SECURITY_HEADERS['Cross-Origin-Resource-Policy'], /same-site/)
})

test('F-19: permintaan baca boleh CORS publik, permintaan tulis tidak', async () => {
  const handler = createHandler({ VALID_LOCATIONS: new Set(), LOCATIONS: [], clearCache: () => {} })

  const baca = fakeRes()
  await handler({ url: '/api/entah', method: 'GET', headers: {} }, baca)
  assert.equal(baca.headers['Access-Control-Allow-Origin'], '*', 'GET tetap bisa dibaca lintas situs')

  const tulis = fakeRes()
  await handler({ url: '/api/cache/flush', method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } }, tulis)
  assert.equal(tulis.status, 200)
  assert.equal(tulis.headers['Access-Control-Allow-Origin'], undefined, 'POST tidak boleh ACAO *')
  assert.equal(tulis.headers.Vary, 'Origin')
  assert.equal(tulis.headers['X-Frame-Options'], 'SAMEORIGIN')
})

// ── F-22 ────────────────────────────────────────────────────────────────────
test('F-22: skrip csp-hash menghasilkan hash SRI untuk skrip inline', () => {
  if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) return console.log('skip: dist/ belum ada')
  const out = execFileSync(process.execPath, ['scripts/csp-hash.mjs'], { cwd: ROOT, encoding: 'utf8' })
  const hashes = out.match(/'sha256-[A-Za-z0-9+/=]{20,}'/g) || []
  assert.ok(hashes.length >= 1, 'harus ada minimal satu hash')
  assert.match(out, /Content-Security-Policy:/)
})
