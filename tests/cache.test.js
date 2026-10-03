import test from 'node:test'
import assert from 'node:assert'
import { cached, clearCache, cacheStats } from '../server/cache.js'

test('cached: menghitung sekali dan mengembalikan nilai yang sama selama TTL', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => { calls++; return { v: calls } }
  const a = await cached('k', 60_000, fetcher)
  const b = await cached('k', 60_000, fetcher)
  const c = await cached('k', 60_000, fetcher)
  assert.strictEqual(calls, 1)
  assert.deepStrictEqual(a, b)
  assert.deepStrictEqual(a, c)
})

test('cached: refetch setelah TTL kadaluarsa', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => { calls++; return calls }
  await cached('t', 1, fetcher) // TTL 1 ms
  await new Promise((r) => setTimeout(r, 20))
  const v = await cached('t', 1, fetcher)
  assert.strictEqual(v, 2)
  assert.strictEqual(calls, 2)
})

test('cached: dedupe request in-flight', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise((r) => setTimeout(r, 30))
    return 'x'
  }
  const [p1, p2, p3] = [
    cached('d', 60_000, fetcher),
    cached('d', 60_000, fetcher),
    cached('d', 60_000, fetcher),
  ]
  const results = await Promise.all([p1, p2, p3])
  assert.strictEqual(calls, 1)
  assert.deepStrictEqual(results, ['x', 'x', 'x'])
})

test('cacheStats: menghitung entry fresh', async () => {
  clearCache()
  await cached('s1', 60_000, async () => 1)
  const stats = cacheStats()
  assert.strictEqual(stats.entries, 1)
  assert.strictEqual(stats.fresh, 1)
})
