import test from 'node:test'
import assert from 'node:assert/strict'
import { WEATHER_GLYPHS, weatherGlyphForCode, weatherLabelKey } from '../src/domain/weather/wmo.js'

test('WMO → glyph: enam kelompok, nilai batas benar', () => {
  const cases = [
    [0, 'cerah'], [1, 'berawan'], [2, 'berawan'], [3, 'mendung'],
    [45, 'kabut'], [48, 'kabut'],
    [51, 'hujan'], [57, 'hujan'], [61, 'hujan'], [67, 'hujan'],
    [71, 'hujan'], [77, 'hujan'], [80, 'hujan'], [82, 'hujan'], [85, 'hujan'], [86, 'hujan'],
    [95, 'petir'], [96, 'petir'], [99, 'petir'],
    [4, 'mendung'], [100, 'mendung'], [null, 'mendung'], [undefined, 'mendung'], ['abc', 'mendung'],
  ]
  for (const [code, name] of cases) {
    assert.equal(weatherGlyphForCode(code), name, `kode ${code}`)
  }
  assert.deepEqual(Object.keys(WEATHER_GLYPHS), ['cerah', 'berawan', 'mendung', 'hujan', 'petir', 'kabut'])
})

test('WMO → label: setiap glyph punya kunci i18n sendiri', () => {
  const keys = Object.values(WEATHER_GLYPHS).map((item) => item.labelKey)
  assert.equal(new Set(keys).size, keys.length, 'tidak ada label kembar')
  for (const name of Object.keys(WEATHER_GLYPHS)) {
    assert.equal(weatherLabelKey(name), WEATHER_GLYPHS[name].labelKey)
  }
  assert.equal(weatherLabelKey('tidak-ada'), 'wcCloudy', 'fallback ke mendung')
})
