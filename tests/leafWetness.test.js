import test from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { leafWetnessRustRisk } from '../src/domain/coffee.js'

const fixture = JSON.parse(readFileSync(new URL('./fixtures/leafWetness.fixture.json', import.meta.url), 'utf8'))

test('S5 fixture: high risk case -> Tinggi', () => {
  const r = leafWetnessRustRisk(fixture.high_risk_48h.rolling48h)
  assert.strictEqual(r.level, fixture.high_risk_48h.expectedLevel)
  assert.ok(r.score >= 70)
})

test('S5 fixture: dry case -> Rendah', () => {
  const r = leafWetnessRustRisk(fixture.low_risk_dry.rolling48h)
  assert.strictEqual(r.level, fixture.low_risk_dry.expectedLevel)
})

test('S5 fixture: short wet streak -> Sedang', () => {
  const r = leafWetnessRustRisk(fixture.medium_risk_short_wet.rolling48h)
  assert.strictEqual(r.level, fixture.medium_risk_short_wet.expectedLevel)
})

test('S5: empty input safe', () => {
  assert.strictEqual(leafWetnessRustRisk([]).level, 'Rendah')
  assert.strictEqual(leafWetnessRustRisk(null).level, 'Rendah')
})

test('S5: suhu di luar 18-25°C menekan skor', () => {
  const cold = fixture.high_risk_48h.rolling48h.map((h) => ({ ...h, temp: 12 }))
  const r = leafWetnessRustRisk(cold)
  assert.ok(r.score < 70, `score=${r.score}`)
})
