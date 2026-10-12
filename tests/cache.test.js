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
  // SWR non-blokir: nilai lama dikembalikan seketika, revalidate jalan di background.
  assert.strictEqual(v, 1)
  // Beri waktu background revalidate selesai.
  await new Promise((r) => setTimeout(r, 50))
  assert.strictEqual(calls, 2)
})

test('cached: SWR tidak memblokir pemanggil saat upstream lambat', async () => {
  clearCache()
  let calls = 0
  const fetcher = async () => {
    calls++
    await new Promise((r) => setTimeout(r, 200)) // simulasi IMERG down (~77s)
    return 'fresh'
  }
  // Prime cache pertama (lambat, memang harus menunggu).
  await cached('slow', 60_000, fetcher)
  assert.strictEqual(calls, 1)
  // Expire, lalu ambil lagi — harus kembali instan dengan nilai lama.
  await new Promise((r) => setTimeout(r, 10))
  const t0 = Date.now()
  const v = await cached('slow', 1, fetcher)
  const elapsed = Date.now() - t0
  assert.ok(elapsed < 100, `pemanggil terblokir ${elapsed}ms, seharusnya non-blokir`)
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
