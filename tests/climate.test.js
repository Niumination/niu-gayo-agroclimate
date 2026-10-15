import test from 'node:test'
import assert from 'node:assert/strict'
import outlook from '../src/data/hazards/climateOutlook.json' with { type: 'json' }
import { climateBannerModel } from '../src/domain/climate.js'

test('climateBannerModel: valid sebelum validUntil, "perlu pembaruan" sesudahnya', () => {
  const ok = climateBannerModel(outlook, { now: new Date('2026-10-15T10:00:00Z') })
  assert.equal(ok.valid, true)
  assert.match(ok.title, /BMKG/)
  assert.match(ok.summary, /El Niño sangat kuat \(Niño3.4 \+3.44 °C\) · IOD positif \(\+0.935\) · musim: kemarau diperpanjang/)
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
  assert.match(wet.local, /kiriman dari luar/)
  assert.equal(wet.localTone, 'rendah')
  const dry = climateBannerModel(outlook, { now, drought: { assessment: { balance30: { rain: 12 }, hth: { days: 25 } } } })
  assert.match(dry.local, /kering/)
  assert.equal(dry.localTone, 'tinggi')
  const mid = climateBannerModel(outlook, { now, drought: { assessment: { balance30: { rain: 100 }, hth: { days: 8 } } } })
  assert.equal(mid.localTone, 'sedang')
})
