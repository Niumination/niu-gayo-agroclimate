import test from 'node:test'
import assert from 'node:assert/strict'
import { dataFreshness, FRESH_LIMIT_MIN, STALE_LIMIT_MIN } from '../src/lib/dataFreshness.js'

test('kesegaran data: tiga tingkat dengan ambang 10 dan 30 menit', () => {
  assert.equal(FRESH_LIMIT_MIN, 10)
  assert.equal(STALE_LIMIT_MIN, 30)
  assert.deepEqual(dataFreshness(0), { tier: 'fresh', label: 'baru saja', note: null })
  assert.deepEqual(dataFreshness(9), { tier: 'fresh', label: '9 menit lalu', note: null })
  assert.deepEqual(dataFreshness(10), { tier: 'aging', label: '10 menit lalu', note: null })
  assert.deepEqual(dataFreshness(29), { tier: 'aging', label: '29 menit lalu', note: null })
  assert.deepEqual(dataFreshness(30), { tier: 'stale', label: '30 menit lalu', note: 'mungkin tertunda' })
  assert.deepEqual(dataFreshness(95), { tier: 'stale', label: '1 jam lalu', note: 'mungkin tertunda' })
  assert.deepEqual(dataFreshness(null), { tier: 'unknown', label: '-', note: null })
  assert.deepEqual(dataFreshness(Number.NaN), { tier: 'unknown', label: '-', note: null })
})
