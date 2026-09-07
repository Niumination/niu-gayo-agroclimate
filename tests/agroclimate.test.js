import test from 'node:test'
import assert from 'node:assert'
import { LOCATIONS } from '../src/data/locations.js'

test('LOCATIONS list has 15 subdistricts in Aceh Tengah', () => {
  assert.strictEqual(LOCATIONS.length, 15)
  const bebesan = LOCATIONS.find(l => l.id === 'bebesan')
  assert.ok(bebesan)
  assert.strictEqual(bebesan.elevation, 1250)
})

test('All locations have valid coordinates and elevations', () => {
  for (const loc of LOCATIONS) {
    assert.ok(loc.lat >= 4.0 && loc.lat <= 5.0, `Lat out of range for ${loc.id}`)
    assert.ok(loc.lon >= 96.0 && loc.lon <= 97.5, `Lon out of range for ${loc.id}`)
    assert.ok(loc.elevation > 500, `Elevation suspiciously low for highland: ${loc.id}`)
  }
})
