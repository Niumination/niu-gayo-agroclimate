// Fase 2.5 (FR-X-2) — aturan interaksi lintas-bahaya di evaluateAll: bump longsor (gempa × tanah jenuh), catatan asap × hujan, kekeringan × FFMC.
import test from 'node:test'
import assert from 'node:assert/strict'
import { applyInteractions, INTERACTION_RULES } from '../src/domain/hazards/interactions.js'
import { evaluateAll, summarize } from '../src/domain/hazards/index.js'

const res = (id, level, extra = {}) => ({ id, level, headline: `${id} ${level}`, metrics: [], flags: {}, score: null, ...extra })

test('gempa × tanah jenuh: longsor waspada → bahaya (maks bahaya), flags.bumpedBy & baseLevel; tanpa tanah jenuh tidak bump', () => {
  const results = [res('longsor', 'waspada', { metrics: [{ key: 'ari72', value: 130 }] }), res('gempa', 'waspada', { flags: { triggerQuake: { id: 'q1', mag: 5.4, distKm: 60 }, landslideAfterQuake: true } })]
  const { results: out, interactions } = applyInteractions(results, { ari: { ari72: 130 } })
  const l = out.find((r) => r.id === 'longsor')
  assert.equal(l.level, 'bahaya')
  assert.equal(l.flags.baseLevel, 'waspada')
  assert.equal(l.flags.bumpedBy, 'gempa_tanah_jenuh')
  assert.match(l.headline, /dinaikkan/)
  assert.equal(interactions.length, 1)
  assert.deepEqual(interactions[0].bumped, { id: 'longsor', from: 'waspada', to: 'bahaya' })
  assert.ok(out.find((r) => r.id === 'gempa').flags.interactions.includes('gempa_tanah_jenuh'))
  // sudah bahaya → tetap bahaya (cap), tetap tercatat
  const r2 = applyInteractions([res('longsor', 'bahaya'), res('gempa', 'waspada', { flags: { triggerQuake: { mag: 5.1, distKm: 40 }, landslideAfterQuake: true } })], { ari: { ari72: 130 } })
  assert.equal(r2.results[0].level, 'bahaya')
  assert.equal(r2.interactions[0].bumped, null)
  // gempa tanpa flag & tanah kering → tidak ada interaksi
  const r3 = applyInteractions([res('longsor', 'rendah', { score: 10 }), res('gempa', 'waspada', { flags: { triggerQuake: null, landslideAfterQuake: false } })], { ari: { ari72: 5 } })
  assert.equal(r3.interactions.length, 0)
  // hasil asli tidak dimutasi
  assert.equal(results[0].level, 'waspada')
})

test('asap × hujan lebat & kekeringan × FFMC: catatan tanpa/with bump, tidak throw bila modul tidak ada', () => {
  const a = applyInteractions([res('asap', 'bahaya', { metrics: [{ key: 'ispu', value: 160 }] })], { weather: { rainNext24: 35, peakHourly: 2 } })
  assert.equal(a.interactions.length, 1)
  assert.equal(a.interactions[0].id, 'asap_hujan_lebat')
  assert.match(a.interactions[0].note, /ISPU 160/)
  assert.equal(applyInteractions([res('asap', 'bahaya')], { weather: { rainNext24: 3, peakHourly: 1 } }).interactions.length, 0)
  const k = applyInteractions([res('kekeringan', 'waspada', { metrics: [{ key: 'hthDays', value: 15 }] }), res('kebakaran', 'rendah', { metrics: [{ key: 'ffmc', value: 84 }] })], {})
  assert.equal(k.interactions[0].id, 'kekeringan_ffmc')
  assert.equal(k.results.find((r) => r.id === 'kebakaran').level, 'waspada')
  assert.equal(k.results.find((r) => r.id === 'kebakaran').flags.bumpedBy, 'kekeringan_ffmc')
  const k2 = applyInteractions([res('kekeringan', 'waspada', { metrics: [{ key: 'hthDays', value: 15 }] }), res('kebakaran', 'bahaya', { metrics: [{ key: 'ffmc', value: 90 }] })], {})
  assert.equal(k2.interactions[0].bumped, null)
  assert.equal(applyInteractions([res('kekeringan', 'waspada'), res('kebakaran', 'rendah', { metrics: [{ key: 'ffmc', value: 70 }] })], {}).interactions.length, 0)
  assert.equal(applyInteractions([], {}).interactions.length, 0)
  assert.ok(INTERACTION_RULES.length >= 3)
})

test('badai × longsor dan vulkanik × hujan (lahar): catatan saja', () => {
  const b = applyInteractions([res('badai', 'bahaya'), res('longsor', 'waspada', { metrics: [{ key: 'ari72', value: 80 }] })], { ari: { ari72: 80 } })
  assert.equal(b.interactions[0].id, 'badai_longsor')
  assert.equal(b.results.find((r) => r.id === 'longsor').level, 'waspada')
  const v = applyInteractions([res('vulkanik', 'bahaya')], { weather: { rainNext24: 25 } })
  assert.equal(v.interactions[0].id, 'vulkanik_hujan_lahar')
  assert.equal(applyInteractions([res('vulkanik', 'waspada')], { weather: { rainNext24: 25 } }).interactions.length, 0)
})

test('evaluateAll: interactions[] ikut keluar, summarize memuat id interaksi, opsi interactions:false mematikan', () => {
  const all = evaluateAll({})
  assert.deepEqual(all.interactions, [])
  assert.deepEqual(summarize(all).interactions, [])
  assert.equal(all.counts.interactions, 0)
  const off = evaluateAll({}, { interactions: false })
  assert.deepEqual(off.interactions, [])
})
