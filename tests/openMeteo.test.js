import test from 'node:test'
import assert from 'node:assert'
import { fetchForecast, fetchWithRetry, clearForecastCache } from '../src/api/openMeteo.js'
import { LOCATIONS } from '../src/data/locations.js'

const LOC = LOCATIONS[0]

function makeFetch(seqs) {
  let i = 0
  return async () => {
    const item = seqs[Math.min(i, seqs.length - 1)]
    i++
    if (item instanceof Error) throw item
    return { ok: true, status: 200, json: async () => item }
  }
}

test('fetchWithRetry: retry eksponensial lalu sukses', async () => {
  let calls = 0
  const f = async () => { calls++; if (calls < 3) throw new Error('fail'); return { ok: true, json: async () => ({ v: 1 }) } }
  const d = await fetchWithRetry('http://x', { fetchImpl: f, retries: 3 })
  assert.deepStrictEqual(d, { v: 1 })
  assert.strictEqual(calls, 3)
})

test('fetchWithRetry: habis retry -> throw error terakhir', async () => {
  const f = async () => { throw new Error('boom') }
  await assert.rejects(() => fetchWithRetry('http://x', { fetchImpl: f, retries: 1 }), /boom/)
})

test('cache 10 menit: fetch sekali untuk panggilan berulang', async () => {
  clearForecastCache()
  let calls = 0
  const f = async () => { calls++; return { ok: true, json: async () => ({ n: 1 }) } }
  const a = await fetchForecast(LOC, { fetchImpl: f })
  const b = await fetchForecast(LOC, { fetchImpl: f })
  assert.strictEqual(calls, 1)
  assert.deepStrictEqual(a, b)
  clearForecastCache()
})

test('dedupe: request in-flight dipakai bersama', async () => {
  clearForecastCache()
  let calls = 0
  const f = async () => { calls++; await new Promise((r) => setTimeout(r, 30)); return { ok: true, json: async () => ({ n: 2 }) } }
  const [a, b] = await Promise.all([fetchForecast(LOC, { fetchImpl: f }), fetchForecast(LOC, { fetchImpl: f })])
  assert.strictEqual(calls, 1)
  assert.deepStrictEqual(a, b)
  clearForecastCache()
})
