import test from 'node:test'
import assert from 'node:assert/strict'
import outlook from '../src/data/hazards/climateOutlook.json' with { type: 'json' }
import { climateBannerModel } from '../src/domain/climate.js'

test('climateBannerModel: valid sebelum validUntil, "perlu pembaruan" sesudahnya', () => {
  const ok = climateBannerModel(outlook, { now: new Date('2026-10-15T10:00:00Z') })
  assert.equal(ok.valid, true)
  assert.match(ok.title, /iklim musiman/)
  assert.match(ok.summary, /Kemarau dapat berlangsung lebih panjang/)
  assert.doesNotMatch(ok.summary, /Niño|IOD|°C|indeks/)
  assert.match(ok.technicalSummary, /Niño-3\.4 \+3\.33 °C/)
  assert.match(ok.technicalSummary, /\+3\.08 °C/)
  assert.match(ok.technicalSummary, /NOAA CPC Niño-3\.4 \+2\.1 °C/)
  assert.equal(ok.tone, 'tinggi')
  assert.equal(ok.local, null)
  assert.equal(ok.staleNote, null)
  const stale = climateBannerModel(outlook, { now: new Date('2026-12-01T00:00:00Z') })
  assert.equal(stale.valid, false)
  assert.match(stale.title, /perlu pembaruan/)
  assert.match(stale.staleNote, /climateOutlook.json/)
  assert.equal(climateBannerModel(null), null)
})

test('climateBannerModel: verifikasi lokal dari /api/drought (basah vs kering vs sedang)', () => {
  const now = new Date('2026-10-15T10:00:00Z')
  const wet = climateBannerModel(outlook, { now, drought: { assessment: { balance30: { rain: 443 }, hth: { days: 0 } } } })
  assert.match(wet.local, /basah \(hujan 30 hari 443 mm, HTH 0 hari\)/)
  assert.match(wet.local, /wilayah lain/)
  assert.match(wet.localSummary, /masih basah/)
  assert.doesNotMatch(wet.localSummary, /HTH|mm|hujan 30 hari/)
  assert.equal(wet.localTone, 'rendah')
  const dry = climateBannerModel(outlook, { now, drought: { assessment: { balance30: { rain: 12 }, hth: { days: 25 } } } })
  assert.match(dry.local, /kering/)
  assert.match(dry.localSummary, /hemat air/)
  assert.equal(dry.localTone, 'tinggi')
  const mid = climateBannerModel(outlook, { now, drought: { assessment: { balance30: { rain: 100 }, hth: { days: 8 } } } })
  assert.equal(mid.localTone, 'sedang')
})
