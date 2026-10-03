import test from 'node:test'
import assert from 'node:assert'
import { sumPrecipPerWindow, computeRainProbability, rainProbabilities } from '../src/domain/ensemble.js'

const members = []
for (let i = 0; i < 50; i++) {
  // 24 jam: 13 member >25mm total, 2 member >50mm total
  const hourly = new Array(24).fill(0)
  if (i < 13) hourly[0] = 26
  if (i < 2) hourly[1] = 51
  members.push(hourly)
}

test('sumPrecipPerWindow aggregates 24h windows', () => {
  const w = sumPrecipPerWindow(members, 24)
  assert.strictEqual(w.length, 1)
  assert.strictEqual(w[0].length, 50)
  assert.strictEqual(w[0][0], 77) // 26 + 51
  assert.strictEqual(w[0][49], 0)
})

test('computeRainProbability P(>25mm) = 26%', () => {
  const r = computeRainProbability(members, 25, 24)
  assert.strictEqual(r.probability, 26)
  assert.strictEqual(r.members, 50)
})

test('computeRainProbability P(>50mm) = 4%', () => {
  const r = computeRainProbability(members, 50, 24)
  assert.strictEqual(r.probability, 4)
})

test('rainProbabilities returns both thresholds', () => {
  const { p25, p50 } = rainProbabilities(members)
  assert.strictEqual(p25, 26)
  assert.strictEqual(p50, 4)
})

test('handles empty / malformed input', () => {
  assert.strictEqual(computeRainProbability([], 25).probability, 0)
  assert.strictEqual(computeRainProbability(null, 25).probability, 0)
})
