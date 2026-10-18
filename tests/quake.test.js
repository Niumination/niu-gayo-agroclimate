/**
 * Fase 2.1 H-GEMPA — parser BMKG (fixture), filter relevansi, quakeImpact monotonik, level & jendela waktu,
 * aturan majemuk gempa × tanah jenuh (FR-GEMPA-4), kirim segera per id kejadian (FR-GEMPA-6).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseFelt, normalizeQuake, mergeFeeds, isRelevant, getQuakes, quakesForLocation, historySummary, CENTER } from '../server/bmkgQuake.js'
import quakeMod, { quakeImpact, levelFromMmi, officialFeltGayo, mmiRoman } from '../src/domain/hazards/quake.js'
import { evaluateAll } from '../src/domain/hazards/index.js'
import { decideDispatch, buildAlert, PUSH_POLICY, DEFAULT_EXPIRES_H, CATEGORY } from '../src/domain/alert.js'
import { QUAKE } from '../src/domain/thresholds.js'

const FX = (f) => JSON.parse(fs.readFileSync(new URL(`./fixtures/hazards/${f}`, import.meta.url), 'utf8'))
const TAKENGON = { id: 'takengon', name: 'Takengon Kota', lat: 4.63, lon: 96.845 }
const NOW = '2026-10-15T12:00:00Z'

test('parseFelt: roman + rentang + tempat', () => {
  assert.deepEqual(parseFelt('IV Pamijahan, II-III Takengon'), [
    { mmi: 'IV', mmiNum: 4, place: 'Pamijahan' },
    { mmi: 'II-III', mmiNum: 3, place: 'Takengon' },
  ])
  assert.deepEqual(parseFelt(''), [])
  assert.equal(parseFelt('Tidak ada data')[0].mmiNum, null)
})

test('normalizeQuake: field BMKG → bentuk ternormalisasi; koordinat rusak → null', () => {
  const q = normalizeQuake({ DateTime: '2026-10-15T10:58:23+00:00', Coordinates: '-6.73,106.61', Magnitude: '4.1', Kedalaman: '5 km', Wilayah: 'Pusat gempa berada di darat 26 km barat daya kota Bogor', Dirasakan: 'IV Pamijahan', Shakemap: '20261015175823.mmi.jpg' })
  assert.equal(q.id, 'bmkg-20261015T105823Z')
  assert.equal(q.lat, -6.73)
  assert.equal(q.lon, 106.61)
  assert.equal(q.mag, 4.1)
  assert.equal(q.depthKm, 5)
  assert.match(q.shakemapUrl, /20261015175823\.mmi\.jpg$/)
  assert.equal(q.felt[0].mmiNum, 4)
  assert.equal(normalizeQuake({ DateTime: 'x', Coordinates: '1,2' }), null)
  assert.equal(normalizeQuake({ DateTime: '2026-10-15T10:58:23+00:00', Coordinates: 'a,b' }), null)
})

test('mergeFeeds + isRelevant: fixture BMKG → dedupe, jarak, saring ≤ 300 km / teks Aceh', () => {
  const { all, relevant } = mergeFeeds({ dirasakan: FX('bmkg-gempadirasakan.json'), autogempa: FX('bmkg-autogempa.json'), terkini: FX('bmkg-gempaterkini.json') })
  assert.ok(all.length >= 15 && all.length <= 31, `gabungan ${all.length}`)
  assert.equal(new Set(all.map((q) => q.id)).size, all.length, 'id unik')
  for (const q of relevant) assert.ok(q.distKm <= 300 || /aceh/i.test(`${q.region} ${q.feltText}`), `${q.id} relevan`)
  // gempa Bogor (fixture) jauh → tidak relevan; gempa sintetis dekat Takengon → relevan
  assert.equal(isRelevant({ lat: -6.73, lon: 106.61, region: 'Bogor', feltText: 'IV Pamijahan' }), false)
  assert.equal(isRelevant({ lat: 4.9, lon: 96.5, region: 'laut', feltText: '' }), true)
  assert.equal(isRelevant({ lat: -1, lon: 120, region: 'x', feltText: 'III Banda Aceh' }), true)
  // urutan terbaru dulu
  for (let i = 1; i < all.length; i++) assert.ok(new Date(all[i - 1].time) >= new Date(all[i].time))
})

test('getQuakes: semua umpan gagal → degraded + fallback nilai terakhir; sebagian gagal → degraded:true tetap ada data', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quakes-'))
  const file = path.join(dir, 'last.json')
  const ok = async (url) => FX(url.endsWith('gempadirasakan.json') ? 'bmkg-gempadirasakan.json' : url.endsWith('autogempa.json') ? 'bmkg-autogempa.json' : 'bmkg-gempaterkini.json')
  const first = await getQuakes({ fetchJson: ok, lastGoodFile: file, now: NOW })
  assert.equal(first.degraded, false)
  assert.ok(first.latest?.id)
  assert.ok(first.history?.count > 50)
  assert.ok(fs.existsSync(file), 'nilai terakhir tersimpan')
  const dead = await getQuakes({ fetchJson: async () => { throw new Error('HTTP 503') }, lastGoodFile: file, now: NOW })
  assert.equal(dead.degraded, true)
  assert.equal(dead.stale, true)
  assert.equal(dead.quakes.length, first.quakes.length)
  const partial = await getQuakes({ fetchJson: async (u) => (u.endsWith('autogempa.json') ? Promise.reject(new Error('timeout')) : ok(u)), lastGoodFile: file, now: NOW })
  assert.equal(partial.degraded, true)
  assert.match(partial.error, /autogempa/)
  const nothing = await getQuakes({ fetchJson: async () => { throw new Error('x') }, lastGoodFile: path.join(dir, 'none.json'), now: NOW })
  assert.equal(nothing.degraded, true)
  assert.deepEqual(nothing.quakes, [])
  const loc = quakesForLocation(first, TAKENGON)
  assert.equal(loc.location.id, 'takengon')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('quakeImpact: monotonik (jarak naik → MMI turun; magnitudo naik → MMI naik), rentang 1–12', () => {
  const m6 = [5, 10, 25, 50, 100, 200].map((d) => quakeImpact({ mag: 6, depthKm: 10, distKm: d }).mmi)
  for (let i = 1; i < m6.length; i++) assert.ok(m6[i] <= m6[i - 1], `jarak ${i}: ${m6}`)
  assert.ok(quakeImpact({ mag: 7, depthKm: 10, distKm: 50 }).mmi > quakeImpact({ mag: 5, depthKm: 10, distKm: 50 }).mmi)
  assert.ok(quakeImpact({ mag: 9.5, depthKm: 1, distKm: 0 }).mmi <= 12)
  assert.ok(quakeImpact({ mag: 2, depthKm: 600, distKm: 300 }).mmi >= 1)
  // Gempa Gayo 2013: M6,1 kedalaman 10 km, Ketol ±10 km → MMI indikatif ≥ VI (BMKG melaporkan VI–VII)
  const gayo = quakeImpact({ mag: 6.1, depthKm: 10, distKm: 10 })
  assert.ok(gayo.mmi >= 6, `Gayo 2013 → ${gayo.mmi}`)
  assert.equal(quakeImpact({ mag: 'x' }).mmi, null)
  assert.equal(mmiRoman(6.4), 'VI')
})

test('levelFromMmi sesuai THRESHOLDS §15; MMI resmi Gayo terdeteksi', () => {
  assert.equal(levelFromMmi(2.9), 'rendah')
  assert.equal(levelFromMmi(QUAKE.mmi.waspada), 'waspada')
  assert.equal(levelFromMmi(QUAKE.mmi.bahaya), 'bahaya')
  assert.equal(levelFromMmi(QUAKE.mmi.ekstrem), 'ekstrem')
  assert.equal(levelFromMmi(null), 'n/a')
  assert.equal(officialFeltGayo([{ place: 'Pamijahan', mmiNum: 4 }, { place: 'Takengon', mmiNum: 3 }]).place, 'Takengon')
  assert.equal(officialFeltGayo([{ place: 'Bogor', mmiNum: 4 }]), null)
})

function quakeDoc(overrides = {}, { ageH = 1, mag = 5.8, depthKm = 10, lat = 4.7, lon = 96.6, felt = [] } = {}) {
  const time = new Date(new Date(NOW).getTime() - ageH * 3_600_000).toISOString()
  return { retrievedAt: NOW, degraded: false, radiusKm: 300, quakes: [{ id: `bmkg-${time}`, time, lat, lon, mag, depthKm, region: 'Aceh Tengah', felt, shakemapUrl: 'https://data.bmkg.go.id/x.jpg' }], latest: null, history: historySummary(), ...overrides }
}

test('modul gempa: level dari MMI di sentra, jendela 24/72 jam, Cancel-aman, MMI BMKG menang', () => {
  const near = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc() })
  assert.ok(['bahaya', 'ekstrem'].includes(near.level), `dekat/kuat → ${near.level} (${near.headline})`)
  assert.equal(near.flags.indicative, true)
  assert.ok(near.flags.eventId)
  assert.ok(near.metrics.some((m) => m.key === 'mmi'))
  assert.ok(near.sources.some((s) => s.kind === 'official'))
  assert.match(near.detail, /Riwayat 10 tahun/)
  const old = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc({}, { ageH: 40 }) })
  assert.equal(old.level, 'waspada', '24–72 jam dibatasi waspada')
  const veryOld = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc({}, { ageH: 100 }) })
  assert.equal(veryOld.level, 'rendah')
  assert.match(veryOld.headline, /^Dampak gempa diperkirakan/)
  const far = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc({}, { mag: 4.6, lat: 2.9, lon: 96.0 }) })
  assert.equal(far.level, 'rendah')
  const none = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: { retrievedAt: NOW, degraded: false, quakes: [] } })
  assert.equal(none.level, 'rendah')
  assert.match(none.headline, /Belum ada gempa yang perlu perhatian/)
  const weakButFelt = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc({}, { mag: 3.4, lat: 4.2, lon: 97.4, felt: [{ place: 'Takengon', mmi: 'V', mmiNum: 5 }] }) })
  assert.equal(weakButFelt.level, 'bahaya', 'MMI V BMKG di Takengon menang atas estimasi')
  const degraded = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: { degraded: true, quakes: [] } })
  assert.equal(degraded.level, 'n/a')
  assert.equal(quakeMod.evaluate({}).level, 'n/a')
})

test('FR-GEMPA-4: M ≥ 5 ≤ 100 km ≤ 72 jam + ARI72 ≥ 100 mm → flags.landslideAfterQuake + anjuran lereng', () => {
  const wet = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc(), ari: { ari72: 120 } })
  assert.equal(wet.flags.landslideAfterQuake, true)
  assert.match(wet.advice.kebun[0], /longsor susulan/)
  assert.ok(wet.flags.triggerQuake?.mag >= 5)
  const dry = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc(), ari: { ari72: 20 } })
  assert.equal(dry.flags.landslideAfterQuake, false)
  const small = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc({}, { mag: 4.4 }), ari: { ari72: 150 } })
  assert.equal(small.flags.landslideAfterQuake, false)
  // registry: modul gempa ikut dievaluasi dan muncul di hasil
  const all = evaluateAll({ location: TAKENGON, now: NOW, quakes: quakeDoc(), ari: { ari72: 120 } })
  const g = all.results.find((r) => r.id === 'gempa')
  assert.ok(g && g.level !== 'n/a')
  assert.equal(g.group, 'geologi')
})

test('FR-GEMPA-6: kejadian baru → Alert segera meski jeda belum lewat; CAP gempa Immediate/Geo, kedaluwarsa 24 jam', () => {
  const last = { level: 'bahaya', sentAt: '2026-10-15T11:30:00Z', eventId: 'bmkg-A' }
  assert.equal(decideDispatch({ level: 'bahaya', last, now: NOW, eventId: 'bmkg-A' }), null, 'kejadian sama, < 6 jam → diam')
  assert.equal(decideDispatch({ level: 'bahaya', last, now: NOW, eventId: 'bmkg-B' }), 'Alert', 'id gempa baru → Alert')
  assert.equal(decideDispatch({ level: 'bahaya', last: { ...last, eventId: undefined }, now: NOW, eventId: 'bmkg-B' }), null, 'state lama tanpa eventId → aturan jeda biasa')
  assert.equal(PUSH_POLICY.gempa, 'waspada')
  assert.equal(PUSH_POLICY.vulkanik, 'bahaya')
  assert.equal(DEFAULT_EXPIRES_H.gempa, 24)
  assert.equal(CATEGORY.gempa, 'Geo')
  const r = quakeMod.evaluate({ location: TAKENGON, now: NOW, quakes: quakeDoc() })
  const alert = buildAlert({ result: { ...r, id: 'gempa', label: quakeMod.label, group: 'geologi' }, location: TAKENGON, now: NOW })
  assert.equal(alert.info.urgency, 'Immediate')
  assert.equal(alert.info.category, 'Geo')
  assert.match(alert.info.headline, /gempa/i)
  assert.equal(new Date(alert.info.expires).getTime() - new Date(NOW).getTime(), 24 * 3_600_000)
})

test('historySummary: USGS 10 tahun (statis) — jumlah, terbesar, M ≥ 5', () => {
  const h = historySummary()
  assert.ok(h.count >= 80)
  assert.ok(h.largest.mag >= 6)
  assert.ok(h.countM5 >= 10)
  assert.equal(h.recentSignificant.length, 3)
  assert.equal(historySummary({ events: [] }), null)
  assert.equal(CENTER.lat, 4.63)
})
