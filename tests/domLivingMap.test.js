/**
 * F-38 — tes DOM untuk peta & lapisan Living Map (lanjutan bundel IV).
 *
 * `SchematicMap` dirender sungguhan (JSX diubah di memori lewat
 * `tests/helpers/jsx-hooks.mjs`, impor JSON juga ditangani di sana), jadi yang
 * diperiksa adalah **keluaran**: peran grup legenda, keadaan `aria-pressed`,
 * label Sembunyikan/Tampilkan, dan catatan data yang muncul/hilang sesuai
 * keadaan lapisan.
 *
 * Tes ini menggantikan blok regex sumber di `tests/livingMapDesktop.test.js`
 * untuk U3 (chip legenda = tombol lapisan) dan U4 (catatan sentra tanpa data).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { register } from 'node:module'
import { createElement as h } from 'react'
import { renderToStaticMarkup as render } from 'react-dom/server'

register('./helpers/jsx-hooks.mjs', import.meta.url)

const { default: SchematicMap } = await import('../src/components/SchematicMap.jsx')
const { LOCATIONS } = await import('../src/data/locations.js')

const tanpaLevel = { locations: LOCATIONS.slice(0, 3).map((l) => ({ id: l.id, worst: 'n/a', worstAcute: 'n/a', active: [] })) }
const lapisan = (ubah = {}) => ({ risk: true, hotspots: true, ...ubah })
const peta = (props) => render(h(SchematicMap, { hazardsAll: { locations: [] }, bare: true, ...props }))

const ada = (html, pola, pesan) => assert.match(html, pola, pesan)
const tidakAda = (html, pola, pesan) => assert.doesNotMatch(html, pola, pesan)

// ── U3 · chip legenda = tombol lapisan ───────────────────────────────────────
test('DOM · peta: legenda adalah grup kontrol bernama, bukan catatan pasif', () => {
  const html = peta({ layers: lapisan(), onLayerChange: () => {} })
  ada(html, /role="group" aria-label="Legenda peta: warna risiko dan titik panas"/, 'legenda harus grup bernama')
})

test('DOM · peta: chip legenda melaporkan keadaan lewat aria-pressed', () => {
  const nyala = peta({ layers: lapisan(), onLayerChange: () => {} })
  const chipNyala = [...nyala.matchAll(/class="niu-map-legend-toggle[^"]*"[^>]*aria-pressed="(true|false)"/g)].map((m) => m[1])
  assert.deepEqual(chipNyala, ['true', 'true'], 'kedua lapisan menyala harus aria-pressed=true')

  const risikoMati = peta({ layers: lapisan({ risk: false }), onLayerChange: () => {} })
  const chipMati = [...risikoMati.matchAll(/class="niu-map-legend-toggle[^"]*"[^>]*aria-pressed="(true|false)"/g)].map((m) => m[1])
  assert.deepEqual(chipMati, ['false', 'true'], 'lapisan risiko mati harus aria-pressed=false')
})

test('DOM · peta: judul chip berubah Sembunyikan ↔ Tampilkan mengikuti keadaan', () => {
  const nyala = peta({ layers: lapisan(), onLayerChange: () => {} })
  ada(nyala, /class="niu-map-legend-toggle[^"]*"[^>]*title="Sembunyikan warna risiko"/, 'chip aktif harus menawarkan Sembunyikan')
  const mati = peta({ layers: lapisan({ risk: false }), onLayerChange: () => {} })
  ada(mati, /class="niu-map-legend-toggle[^"]*"[^>]*title="Tampilkan warna risiko"/, 'chip mati harus menawarkan Tampilkan')
})

test('DOM · peta: tanpa handler lapisan, legenda jatuh ke tampilan statis', () => {
  const statis = peta({ layers: lapisan() })
  tidakAda(statis, /niu-map-legend-toggle/, 'tanpa onLayerChange tidak boleh ada tombol legenda')
  ada(statis, /role="group" aria-label="Legenda peta/, 'grup legenda tetap ada sebagai informasi')
})

// ── U4 · catatan sentra tanpa data ──────────────────────────────────────────
test('DOM · peta: tiga sentra tanpa data memunculkan catatan yang menghitung', () => {
  const html = peta({ hazardsAll: tanpaLevel, layers: lapisan(), onLayerChange: () => {}, levelsPending: false })
  ada(html, /class="niu-map-data-note" role="status"/, 'catatan harus diumumkan sebagai status')
  ada(html, /15 dari 15 sentra belum punya data · coba muat ulang/, 'hitungan sentra tanpa data tidak sesuai')
})

test('DOM · peta: tanpa sentra tanpa data, catatan tidak muncul', () => {
  const satu = LOCATIONS.map((l) => ({ id: l.id, worst: 'rendah', worstAcute: 'rendah', active: [] }))
  const html = peta({ hazardsAll: { locations: satu }, layers: lapisan(), onLayerChange: () => {}, levelsPending: false })
  tidakAda(html, /belum punya data/, 'data yang dimuat tidak boleh dituduh hilang')
})

test('DOM · peta: saat level masih dimuat, catatan memakai teks memuat', () => {
  const html = peta({ hazardsAll: tanpaLevel, layers: lapisan(), onLayerChange: () => {}, levelsPending: true })
  ada(html, /Memuat level 15 sentra/, 'keadaan memuat harus jelas, bukan "tidak punya data"')
  tidakAda(html, /belum punya data/, 'memuat ≠ hilang')
})

test('DOM · peta: tombol lapisan di baris alat memakai label aksi yang sama', () => {
  const mati = peta({ layers: lapisan({ sentra: false }), onLayerChange: () => {} })
  ada(mati, /aria-label="Tampilkan layer sentra"/, 'lapisan sentra mati harus menawarkan Tampilkan')
  const nyala = peta({ layers: lapisan({ sentra: true }), onLayerChange: () => {} })
  ada(nyala, /aria-label="Sembunyikan layer sentra"/, 'lapisan sentra menyala harus menawarkan Sembunyikan')
})
