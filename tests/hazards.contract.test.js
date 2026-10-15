/**
 * Kontrak registry hazard (ADR-12, docs/dev/05-ARCHITECTURE.md §2.1):
 * setiap modul punya id/group/label/requires/evaluate; evaluate tidak pernah throw; hasil ternormalisasi.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { HAZARDS, HAZARD_IDS, evaluateAll, summarize, parseEnabled, getHazard, normalizeResult } from '../src/domain/hazards/index.js'
import { LEVELS, LEVEL_ORDER, normalizeLevel, maxLevel, bumpLevel, compareLevel } from '../src/domain/hazards/levels.js'
import { weatherFeatures } from '../src/domain/hazards/features.js'
import { assessAirQuality } from '../src/domain/hazards/airQuality.js'
import { asapReportEscalation } from '../src/domain/hazards/airQuality.js'
import { assessFireDanger } from '../src/domain/hazards/fireWeather.js'
import { assessDrought } from '../src/domain/hazards/drought.js'
import { WIND_GUST } from '../src/domain/thresholds.js'

const aqFixture = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-airquality-takengon.json', import.meta.url), 'utf8'))
const archive = JSON.parse(fs.readFileSync(new URL('./fixtures/hazards/openmeteo-archive-90d.json', import.meta.url), 'utf8'))

const VALID_GROUPS = ['hidromet', 'atmosfer', 'geologi', 'agro']
const LOC = { id: 'bintang', name: 'Bintang', slopeClass: 'curam', lat: 4.6, lon: 96.9 }

/** Deret jam-an sintetis 72 jam (mulai 2026-10-14T00:00) dengan `now` = indeks 36. */
function syntheticRaw({ rainPerHour = 0, gust = 10, wind = 5, soil = 0.3, leafWet = 0, temp = 21, nextRain = 0, daily = null } = {}) {
  const time = []
  const start = Date.UTC(2026, 9, 14, 0)
  for (let i = 0; i < 72; i++) time.push(new Date(start + i * 3_600_000).toISOString().slice(0, 16))
  const nowIdx = 36
  const fill = (v) => Array.from({ length: 72 }, () => v)
  const precipitation = time.map((_, i) => (i <= nowIdx ? rainPerHour : nextRain))
  return {
    current: { time: time[nowIdx], precipitation: rainPerHour, wind_speed_10m: wind, wind_gusts_10m: gust, wind_direction_10m: 90, temperature_2m: temp, relative_humidity_2m: 80 },
    hourly: { time, precipitation, soil_moisture_0_to_7cm: fill(soil), wind_speed_10m: fill(wind), wind_gusts_10m: fill(gust), leaf_wetness_probability: fill(leafWet), temperature_2m: fill(temp) },
    daily: { precipitation_sum: [daily ?? rainPerHour * 24] },
  }
}

test('levels: urutan, normalisasi label lama, max/bump/compare', () => {
  assert.deepEqual(LEVELS, ['rendah', 'waspada', 'bahaya', 'ekstrem'])
  assert.equal(LEVEL_ORDER['n/a'], -1)
  assert.equal(normalizeLevel('Bahaya Tinggi'), 'bahaya')
  assert.equal(normalizeLevel('Tinggi'), 'bahaya')
  assert.equal(normalizeLevel('Sedang'), 'waspada')
  assert.equal(normalizeLevel('Waspada'), 'waspada')
  assert.equal(normalizeLevel('Rendah'), 'rendah')
  assert.equal(normalizeLevel(undefined), 'n/a')
  assert.equal(normalizeLevel('apa-ini'), 'n/a')
  assert.equal(maxLevel('rendah', 'bahaya', 'n/a'), 'bahaya')
  assert.equal(maxLevel(['n/a', 'waspada']), 'waspada')
  assert.equal(maxLevel(), 'n/a')
  assert.equal(bumpLevel('waspada'), 'bahaya')
  assert.equal(bumpLevel('ekstrem'), 'ekstrem')
  assert.equal(bumpLevel('rendah', 2, 'bahaya'), 'bahaya')
  assert.ok(compareLevel('ekstrem', 'bahaya') > 0)
  assert.ok(compareLevel('n/a', 'rendah') < 0)
})

test('registry: 7 modul, id unik = tipe laporan, kontrak field lengkap', () => {
  assert.deepEqual(HAZARD_IDS, ['longsor', 'banjir', 'angin', 'asap', 'kebakaran', 'kekeringan', 'karat'])
  assert.equal(new Set(HAZARD_IDS).size, HAZARDS.length)
  for (const mod of HAZARDS) {
    assert.match(mod.id, /^[a-z]+$/)
    assert.ok(VALID_GROUPS.includes(mod.group), `${mod.id}: group ${mod.group}`)
    assert.equal(typeof mod.label.id, 'string')
    assert.ok(Array.isArray(mod.requires) && mod.requires.length > 0, `${mod.id}: requires`)
    assert.equal(typeof mod.evaluate, 'function')
  }
  assert.equal(getHazard('asap').group, 'atmosfer')
  assert.equal(getHazard('xyz'), null)
})

test('evaluate pada ctx kosong → n/a + degraded, tidak throw', () => {
  for (const mod of HAZARDS) {
    const r = mod.evaluate({})
    assert.equal(r.level, 'n/a', mod.id)
    assert.equal(r.degraded, true, mod.id)
  }
  const all = evaluateAll({})
  assert.equal(all.results.length, 7)
  assert.equal(all.worst, 'n/a')
  assert.equal(all.counts.degraded, 7)
  assert.equal(all.active.length, 0)
})

test('evaluateAll: modul yang throw → n/a, modul lain tetap jalan', () => {
  const broken = { id: 'longsor', group: 'hidromet', label: { id: 'x' }, requires: [], evaluate() { throw new Error('boom') } }
  const r = normalizeResult(broken, (() => { try { return broken.evaluate({}) } catch (e) { return { level: 'n/a', degraded: true, headline: e.message } } })(), { now: 't' })
  assert.equal(r.level, 'n/a')
  assert.equal(r.headline, 'boom')
  assert.equal(r.evaluatedAt, 't')
  assert.deepEqual(r.metrics, [])
  assert.deepEqual(r.advice, {})
})

test('normalizeResult: advice array → {umum}, score non-angka → null, label level', () => {
  const r = normalizeResult(HAZARDS[0], { level: 'Tinggi', advice: ['a'], score: 'x', metrics: [null, { key: 'k', value: 1 }] }, {})
  assert.equal(r.level, 'bahaya')
  assert.equal(r.levelLabel, 'Bahaya')
  assert.deepEqual(r.advice, { umum: ['a'] })
  assert.equal(r.score, null)
  assert.equal(r.metrics.length, 1)
  assert.equal(r.degraded, false)
})

test('parseEnabled: "", "*", "all" = semua; daftar koma difilter ke id valid', () => {
  assert.deepEqual(parseEnabled(''), HAZARD_IDS)
  assert.deepEqual(parseEnabled('*'), HAZARD_IDS)
  assert.deepEqual(parseEnabled(undefined), HAZARD_IDS)
  assert.deepEqual(parseEnabled('kebakaran, asap ,zzz'), ['asap', 'kebakaran'])
  assert.deepEqual(parseEnabled('zzz'), [])
})

test('evaluateAll: enabled/hidden menyaring modul', () => {
  const r = evaluateAll({}, { enabled: ['asap', 'kebakaran'], hidden: ['kebakaran'] })
  assert.deepEqual(r.results.map((x) => x.id), ['asap'])
})

test('weatherFeatures: jendela mulai dari jam berjalan (BUG-01), null bila deret kosong', () => {
  assert.equal(weatherFeatures(null), null)
  assert.equal(weatherFeatures({ hourly: { time: [] } }), null)
  const w = weatherFeatures(syntheticRaw({ rainPerHour: 2, nextRain: 5, gust: 42, soil: 0.4, leafWet: 90, temp: 20, daily: 30 }))
  assert.equal(w.nowIdx, 36)
  assert.equal(w.rain24, 48) // 24 jam × 2 mm, termasuk jam berjalan
  assert.equal(w.rain72, 74) // hanya 37 jam tersedia ke belakang
  assert.equal(w.rainNext24, 120)
  assert.equal(w.peakHourly, 2)
  assert.equal(w.peakNext24, 5)
  assert.equal(w.dailyRainSum, 30)
  assert.equal(w.soilMoisture, 0.4)
  assert.equal(w.gust, 42)
  assert.equal(w.gustMaxNext24, 42)
  assert.equal(w.windDirection, 90)
  assert.equal(w.rolling48h.length, 48) // paritas weatherService M3 (slice(start, start+48); T-debt tanpa past_days)
  assert.equal(w.rolling48h[0].leafWetness, 90)
})

test('longsor/banjir/angin/karat: skenario basah-berangin aktif, skenario tenang rendah', () => {
  const calm = evaluateAll({ location: LOC, now: '2026-10-15T12:00:00Z', weather: weatherFeatures(syntheticRaw()) })
  for (const id of ['longsor', 'banjir', 'angin', 'karat']) assert.equal(calm.results.find((r) => r.id === id).level, 'rendah', id)

  const storm = evaluateAll({ location: LOC, now: '2026-10-15T12:00:00Z', weather: weatherFeatures(syntheticRaw({ rainPerHour: 6, nextRain: 8, gust: 80, soil: 0.45, leafWet: 95, temp: 21, daily: 120 })) })
  const by = Object.fromEntries(storm.results.map((r) => [r.id, r]))
  assert.equal(by.angin.level, 'ekstrem') // ≥ 75 km/jam
  assert.ok(LEVEL_ORDER[by.longsor.level] >= LEVEL_ORDER.bahaya, by.longsor.headline)
  assert.ok(LEVEL_ORDER[by.banjir.level] >= LEVEL_ORDER.waspada, by.banjir.headline)
  assert.equal(by.karat.level, 'bahaya')
  assert.equal(storm.results[0].id, 'angin') // terurut level tertinggi dulu
  assert.ok(storm.active.length >= 4)
  const s = summarize(storm)
  assert.equal(s.worst, 'ekstrem')
  assert.equal(s.levels.angin, 'ekstrem')
})

test('angin: tangga 40/60/75 monoton; ≥ 45 hanya penanda cuaca ekstrem BMKG (flags.bmkgExtreme)', () => {
  assert.equal(WIND_GUST.ekstrem, 75)
  assert.equal(WIND_GUST.bmkgEkstrem, 45)
  const at = (gust) => evaluateAll({ location: LOC, now: 'x', weather: weatherFeatures(syntheticRaw({ gust })) }).results.find((r) => r.id === 'angin')
  assert.equal(at(44).level, 'waspada')
  assert.equal(at(44).flags.bmkgExtreme, false)
  assert.equal(at(45).level, 'waspada')
  assert.equal(at(45).flags.bmkgExtreme, true)
  assert.match(at(45).headline, /kriteria cuaca ekstrem BMKG/)
  assert.equal(at(65).level, 'bahaya')
  assert.equal(at(75).level, 'ekstrem')
  assert.equal(at(10).level, 'rendah')
})

test('banjir: n/a untuk sentra di luar DAS terpantau (misal Pegasing)', () => {
  const r = evaluateAll({ location: { id: 'pegasing', slopeClass: 'berbukit' }, now: 'x', weather: weatherFeatures(syntheticRaw({ rainPerHour: 6, daily: 120 })) })
  assert.equal(r.results.find((x) => x.id === 'banjir').level, 'n/a')
})

test('asap: adaptor payload /api/air-quality + eskalasi laporan warga', () => {
  const assessment = assessAirQuality({ current: aqFixture.current, hourly: aqFixture.hourly })
  const payload = { location: LOC, retrievedAt: '2026-10-15T10:00:00Z', source: { name: 'CAMS' }, degraded: false, assessment }
  const base = evaluateAll({ location: LOC, now: '2026-10-15T10:00:00Z', airQuality: payload }, { enabled: ['asap'] }).results[0]
  assert.equal(base.level, assessment.level)
  assert.match(base.headline, /^ISPU \d+/)
  assert.equal(base.metrics.find((m) => m.key === 'ispu').value, assessment.ispu.index)
  assert.equal(base.flags.estimate, true)
  assert.ok(Array.isArray(base.advice.umum) && typeof base.advice.umum[0] === 'string', 'advice.umum dari healthAdvice.groups')
  assert.ok(Array.isArray(base.advice.rentan))

  const mk = (n, ts = '2026-10-15T09:00:00Z') => Array.from({ length: n }, (_, i) => ({ id: i, type: 'asap', location: 'bintang', visibility: '<1km', timestamp: ts }))
  const esc = asapReportEscalation(mk(3), new Date('2026-10-15T10:00:00Z'))
  assert.equal(esc.escalate, true)
  assert.equal(asapReportEscalation(mk(2), new Date('2026-10-15T10:00:00Z')).escalate, false)
  assert.equal(asapReportEscalation(mk(5, '2026-10-15T02:00:00Z'), new Date('2026-10-15T10:00:00Z')).escalate, false) // > 6 jam
  assert.equal(asapReportEscalation({ reports: mk(3) }, new Date('2026-10-15T10:00:00Z')).escalate, true)

  const up = evaluateAll({ location: LOC, now: '2026-10-15T10:00:00Z', airQuality: payload, reports: mk(3) }, { enabled: ['asap'] }).results[0]
  assert.equal(LEVEL_ORDER[up.level], Math.min(LEVEL_ORDER.bahaya, LEVEL_ORDER[base.level] + 1))
  assert.match(up.detail, /laporan warga/)

  const bad = evaluateAll({ location: LOC, now: 'x', airQuality: { degraded: true, error: 'timeout', assessment: null } }, { enabled: ['asap'] }).results[0]
  assert.equal(bad.level, 'n/a')
  assert.match(bad.headline, /timeout/)
})

test('kebakaran: adaptor payload /api/fire-danger (kode + hotspot + siaga lokal)', () => {
  const codes = { ffmc: 88, dmc: 20, dc: 300, isi: 7, bui: 25, fwi: 15 }
  const hotspots = { within10km24h: 0, within25km24h: 1 }
  const assessment = assessFireDanger({ fwi: codes, hotspots, hthDays: 25 })
  const payload = { location: LOC, retrievedAt: '2026-10-15T10:00:00Z', degraded: false, level: assessment.level, assessment, fwi: { latest: { date: '2026-10-15', isToday: true, codes } }, hotspots: { degraded: false, summary: hotspots }, hth: { days: 25 } }
  const r = evaluateAll({ location: LOC, now: 'x', fireDanger: payload }, { enabled: ['kebakaran'] }).results[0]
  assert.equal(r.level, assessment.level)
  assert.equal(r.level, 'ekstrem')
  assert.equal(r.flags.siagaLokal, true)
  assert.match(r.headline, /FWI 15\.0/)
  assert.match(r.headline, /SIAGA/)
  assert.equal(r.metrics.find((m) => m.key === 'hotspots25km24h').value, 1)
  assert.equal(r.sources.length, 2)
  assert.ok(r.advice.umum.length > 0)

  const noHs = evaluateAll({ location: LOC, now: 'x', fireDanger: { ...payload, hotspots: { degraded: true, summary: null } } }, { enabled: ['kebakaran'] }).results[0]
  assert.equal(noHs.sources.length, 1)
  assert.match(noHs.detail, /hotspot: tidak tersedia/)

  const empty = evaluateAll({ location: LOC, now: 'x', fireDanger: { degraded: true, error: 'arsip gagal' } }, { enabled: ['kebakaran'] }).results[0]
  assert.equal(empty.level, 'n/a')
})

test('kekeringan: adaptor payload /api/drought (HTH + neraca air)', () => {
  const assessment = assessDrought(archive.daily, { today: archive.today })
  assert.ok(assessment)
  const payload = { location: LOC, retrievedAt: '2026-10-15T10:00:00Z', source: { name: 'ERA5' }, degraded: false, archive: { lagDays: 5 }, assessment }
  const r = evaluateAll({ location: LOC, now: 'x', drought: payload }, { enabled: ['kekeringan'] }).results[0]
  assert.equal(r.level, assessment.level)
  assert.match(r.headline, new RegExp(`^HTH ${assessment.hth.days} hari`))
  assert.equal(r.metrics.find((m) => m.key === 'hthDays').value, assessment.hth.days)
  assert.equal(r.metrics.find((m) => m.key === 'balance30').value, assessment.balance30.balance)
  assert.equal(r.flags.lagDays, 5)
  assert.match(r.detail, /Arsip tertinggal 5 hari/)
  const empty = evaluateAll({ location: LOC, now: 'x', drought: { degraded: true, assessment: null } }, { enabled: ['kekeringan'] }).results[0]
  assert.equal(empty.level, 'n/a')
})

test('evaluateAll: semua hasil memenuhi kontrak §2.1 (tipe field)', () => {
  const ctx = { location: LOC, now: '2026-10-15T10:00:00Z', weather: weatherFeatures(syntheticRaw({ rainPerHour: 3, gust: 50 })) }
  for (const r of evaluateAll(ctx).results) {
    assert.ok(['rendah', 'waspada', 'bahaya', 'ekstrem', 'n/a'].includes(r.level), r.id)
    assert.equal(typeof r.headline, 'string')
    assert.equal(typeof r.detail, 'string')
    assert.ok(Array.isArray(r.metrics) && Array.isArray(r.sources))
    assert.equal(typeof r.advice, 'object')
    assert.equal(typeof r.degraded, 'boolean')
    assert.equal(typeof r.levelLabel, 'string')
    for (const m of r.metrics) assert.ok(m.key && 'value' in m, `${r.id}: metric ${JSON.stringify(m)}`)
  }
})
