// Test F2/ADR-9 — sumber antecedent IMERG (server/imerg.js) + fallback (server/antecedent.js).
import test from 'node:test'
import assert from 'node:assert'
import {
  gridIndices,
  parseImergAsciiValue,
  fetchImergDailyPoint,
  readEarthdataToken,
} from '../server/imerg.js'
import { antecedentIndex, antecedentIndexWithFallback } from '../server/antecedent.js'
import { clearCache } from '../server/cache.js'

const ASCII_OK = [
  'Dataset: 3B-DAY-L.MS.MRG.3IMERG.20261002-S000000-E235959.V07C.nc4',
  'precipitation.lat, 4.65',
  'precipitation.precipitation[precipitation.time=17071][precipitation.lon=96.85], 9.56',
  '',
].join('\n')

const ASCII_ERR = 'Error { code = 400; message = "Invalid constraint..." }'
const ASCII_MISSING = [
  'precipitation.lat, 4.65',
  'precipitation.precipitation[precipitation.time=17071][precipitation.lon=96.85], -9999.9',
].join('\n')

test('gridIndices: Takengon → xi 2768, yi 946', () => {
  assert.deepStrictEqual(gridIndices(4.63, 96.845), { xi: 2768, yi: 946 })
})

test('gridIndices: batas grid', () => {
  assert.deepStrictEqual(gridIndices(-89.95, -179.95), { xi: 0, yi: 0 })
  assert.deepStrictEqual(gridIndices(89.95, 179.95), { xi: 3599, yi: 1799 })
})

test('parseImergAsciiValue: baris data valid → 9.56', () => {
  assert.strictEqual(parseImergAsciiValue(ASCII_OK), 9.56)
})

test('parseImergAsciiValue: missing -9999 → null', () => {
  assert.strictEqual(parseImergAsciiValue(ASCII_MISSING), null)
})

test('parseImergAsciiValue: error Hyrax / tanpa baris data → null', () => {
  assert.strictEqual(parseImergAsciiValue(ASCII_ERR), null)
  assert.strictEqual(parseImergAsciiValue('precipitation.lat, 4.65\n'), null)
})

const TOKEN_LINE = 'machine urs.earthdata.nasa.gov login uid-xxx password SECRET-TOKEN'
test('readEarthdataToken: field ke-6 baris machine', async () => {
  const { readFile } = await import('node:fs/promises')
  // tulis netrc sementara
  const os = await import('node:os')
  const path = await import('node:path')
  const fs = await import('node:fs/promises')
  const tmp = path.join(os.tmpdir(), `netrc-test-${Date.now()}`)
  await fs.writeFile(tmp, `machine github.com login a password b\n${TOKEN_LINE}\n`)
  const tok = await readEarthdataToken(tmp)
  assert.strictEqual(tok, 'SECRET-TOKEN')
  await fs.unlink(tmp)
})

function fakeResp(status, text) {
  return { ok: status < 400, status, text: async () => text }
}

test('fetchImergDailyPoint: granule belum ada (HTTP 404) → null, TIDAK throw', async () => {
  const v = await fetchImergDailyPoint(new Date(Date.UTC(2026, 9, 2)), 4.63, 96.845, 'tok', {
    fetchImpl: async () => fakeResp(404, 'Resource Not Found'),
  })
  assert.strictEqual(v, null)
})

test('fetchImergDailyPoint: body error Hyrax dengan HTTP 200 → null', async () => {
  const v = await fetchImergDailyPoint(new Date(Date.UTC(2026, 9, 2)), 4.63, 96.845, 'tok', {
    fetchImpl: async () => fakeResp(200, ASCII_ERR),
  })
  assert.strictEqual(v, null)
})

test('fetchImergDailyPoint: 401 → throw (pemicu fallback model)', async () => {
  await assert.rejects(
    () =>
      fetchImergDailyPoint(new Date(Date.UTC(2026, 9, 2)), 4.63, 96.845, 'tok', {
        fetchImpl: async () => fakeResp(401, 'unauthorized'),
      }),
    /auth gagal/
  )
})

test('fetchImergDailyPoint: retry 2x lalu sukses', async () => {
  let calls = 0
  const v = await fetchImergDailyPoint(new Date(Date.UTC(2026, 9, 2)), 4.63, 96.845, 'tok', {
    fetchImpl: async () => {
      calls++
      if (calls < 3) throw new Error('ETIMEDOUT')
      return fakeResp(200, ASCII_OK)
    },
  })
  assert.strictEqual(v, 9.56)
  assert.strictEqual(calls, 3)
})

// ---------- fallback logic ----------



test('antecedentIndex: akumulasi model 24/72 jam (fallback, tidak berubah)', () => {
  const hourly = Array.from({ length: 72 }, (_, i) => i + 1)
  const r = antecedentIndex(hourly, hourly.length - 1)
  assert.strictEqual(r.ari24, 1452) // 49..72
  assert.strictEqual(r.ari72, 2628)
  assert.strictEqual(r.source, 'model-ecmwf')
})

test('antecedentIndexWithFallback: IMERG sukses → source imerg + ari7d', async () => {
  clearCache()
  const seq = [3, 2, 1] // hari: kemarin, D-2, D-3 (terbaru dulu)
  let call = 0
  const r = await antecedentIndexWithFallback(Array(72).fill(1), 71, { id: 'x', lat: 4.63, lon: 96.845 }, {
    token: 'tok',
    now: new Date(Date.UTC(2026, 9, 3)),
    fetchImpl: async () => fakeResp(200, ASCII_OK.replace('9.56', String(seq[call++ % seq.length]))),
  })
  assert.strictEqual(r.source, 'imerg')
  assert.strictEqual(r.ari24, 3)
  assert.strictEqual(r.ari72, 6)
  assert.strictEqual(r.ari7d, 15) // 3+2+1 berulang selama 7 hari
  assert.strictEqual(r.days, 7)
  assert.strictEqual(r.modelAri24, 24) // cross-check model tetap disertakan
})

test('antecedentIndexWithFallback: IMERG 401 → fallback model-ecmwf + fallbackReason', async () => {
  clearCache()
  const r = await antecedentIndexWithFallback(Array(72).fill(1), 71, { id: 'x', lat: 4.63, lon: 96.845 }, {
    token: 'tok',
    now: new Date(Date.UTC(2026, 9, 3)),
    fetchImpl: async () => fakeResp(401, 'unauthorized'),
  })
  assert.strictEqual(r.source, 'model-ecmwf')
  assert.strictEqual(r.ari24, 24) // mm deret flat 1 mm/jam
  assert.strictEqual(r.ari72, 72)
  assert.match(r.fallbackReason, /auth gagal/)
})

test('antecedentIndexWithFallback: data < 3 hari → fallback model-ecmwf', async () => {
  clearCache()
  let call = 0
  const r = await antecedentIndexWithFallback(Array(72).fill(1), 71, { id: 'x', lat: 4.63, lon: 96.845 }, {
    token: 'tok',
    now: new Date(Date.UTC(2026, 9, 3)),
    fetchImpl: async () => (call++ < 2 ? fakeResp(404, 'not found') : fakeResp(404, 'not found')), // semua 404
  })
  assert.strictEqual(r.source, 'model-ecmwf')
  assert.match(r.fallbackReason, /< 3/)
})
