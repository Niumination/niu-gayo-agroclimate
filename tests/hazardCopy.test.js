import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { evaluateAll } from '../src/domain/hazards/index.js'

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')

test('ringkasan bahaya saat data hilang tetap manusiawi; nama komponen teknis tersimpan di rincian', () => {
  const weatherMissing = evaluateAll({}, { enabled: ['angin'], interactions: false }).results[0]
  assert.equal(weatherMissing.headline, 'Informasi untuk bahaya ini belum tersedia.')
  assert.doesNotMatch(weatherMissing.headline, /weather|fetch failed/i)
  assert.match(weatherMissing.detail, /weather/)

  const cases = [
    ['asap', { airQuality: { assessment: null, error: 'CAMS: fetch failed' } }, /Data kualitas udara belum tersedia\./, /CAMS: fetch failed/],
    ['kebakaran', { fireDanger: { fwi: null, hotspots: null, error: 'ERA5: timeout' } }, /Data bahaya kebakaran belum tersedia\./, /ERA5: timeout/],
    ['kekeringan', { drought: { assessment: null, error: 'arsip: fetch failed' } }, /Data kekeringan belum tersedia\./, /arsip: fetch failed/],
    ['badai', { convective: { hourly: null, error: 'ECMWF: HTTP 500' } }, /Perkiraan badai belum tersedia\./, /ECMWF: HTTP 500/],
  ]
  for (const [id, context, headline, detail] of cases) {
    const result = evaluateAll(context, { enabled: [id], interactions: false }).results[0]
    assert.match(result.headline, headline, `${id} headline`)
    assert.doesNotMatch(result.headline, /fetch failed|HTTP 500|timeout|CAMS|ERA5|ECMWF/i)
    assert.match(result.detail, detail, `${id} diagnostic detail`)
  }
})

test('angka skor dan field sumber tidak bocor ke lapisan ringkas; detail teknis tetap tersedia', () => {
  const attention = read('src/components/niu/HazardAttention.jsx')
  assert.match(attention, /aria-label={`\$\{active\.length\} bahaya aktif`}/)
  assert.match(attention, /\(\{active\.length\}\)/)
  assert.doesNotMatch(attention, /meta=\{score|Skor \$\{score\}/)

  const detail = read('src/components/niu/HazardDetail.jsx')
  assert.match(detail, /Sumber dan catatan teknis/)
  assert.match(detail, /r\.detail/)
  assert.match(detail, /Skor model/)

  const app = read('src/App.jsx')
  assert.match(app, /setError\(tr\('errorLoad'\)\)/)
  assert.match(app, /setErrorDetail\(err\?\.message \|\| null\)/)
  assert.match(app, /<summary[^>]*>Rincian teknis<\/summary>/)
  assert.doesNotMatch(app, /setError\(err\.message/)

  const boundary = read('src/components/ErrorBoundary.jsx')
  assert.match(boundary, /Maaf, bagian ini belum dapat ditampilkan/)
  assert.match(boundary, /<summary[^>]*>Rincian teknis<\/summary>/)
  assert.match(boundary, /\{this\.state\.message\}/)
  assert.doesNotMatch(boundary, /⚠️/)

  const warning = read('src/components/DisasterWarning.jsx')
  assert.match(warning, /Angin kencang/)
  assert.doesNotMatch(warning, /wind_gusts_10m/)
  assert.match(warning, /Antecedent Rainfall Index/)
  assert.match(warning, /Detail angka/)
})
