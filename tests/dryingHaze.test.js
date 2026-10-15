import test from 'node:test'
import assert from 'node:assert/strict'
import { dryingStatus } from '../src/domain/coffee.js'

// FR-ASAP-5 — dampak kabut asap ke jendela penjemuran (v2 Fase 1, Sprint 2)
test('dryingStatus: ISPU ≥ 101 → Tunda (asap); ISPU 100 tidak', () => {
  const hold = dryingStatus(0, 700, 60, { ispu: 101, aod: 0.2, dni: 700 })
  assert.equal(hold.level, 'Tunda (asap)')
  assert.equal(hold.haze, true)
  assert.match(hold.desc, /pengering tertutup/)
  assert.equal(dryingStatus(0, 700, 60, { ispu: 100, aod: 0.2, dni: 700 }).level, 'Sangat Baik')
})
test('dryingStatus: AOD ≥ 1,0 dan DNI < 300 → Tunda (asap); salah satu saja tidak', () => {
  assert.equal(dryingStatus(0, 250, 60, { ispu: 60, aod: 1.2, dni: 250 }).level, 'Tunda (asap)')
  assert.equal(dryingStatus(0, 100, 60, { ispu: 60, aod: 0.8, dni: 100 }).level, 'Kurang Optimal') // AOD < 1 → aturan lama (radiasi rendah)
  assert.equal(dryingStatus(0, 250, 60, { ispu: 60, aod: 0.8, dni: 250 }).level, 'Sangat Baik')
  assert.equal(dryingStatus(0, 700, 60, { ispu: 60, aod: 1.2, dni: 700 }).level, 'Sangat Baik')
})
test('dryingStatus: hujan tetap diprioritaskan; tanpa parameter asap perilaku lama', () => {
  assert.equal(dryingStatus(2, 700, 60, { ispu: 300 }).level, 'Hujan - Tutup Terpal')
  assert.equal(dryingStatus(0, 700, 60).level, 'Sangat Baik')
  assert.equal(dryingStatus(0, 700, 60, null).level, 'Sangat Baik')
  assert.equal(dryingStatus(0, 700, 60, {}).level, 'Sangat Baik')
  assert.equal(dryingStatus(0, 100, 60, { ispu: 40 }).level, 'Kurang Optimal')
})
