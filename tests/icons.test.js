// Uji P7.8 — ikonografi: 11 bahaya + 6 cuaca, favicon, dan aturan warna.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HAZARD_IDS } from '../src/domain/hazards/index.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const ICONS = read('src/icons/index.jsx')

const hazardBlock = ICONS.slice(ICONS.indexOf('export const HAZARD_ICONS'), ICONS.indexOf('export const WEATHER_ICONS'))
const weatherBlock = ICONS.slice(ICONS.indexOf('export const WEATHER_ICONS'), ICONS.indexOf('export const HAZARD_ICON_IDS'))

test('setiap bahaya di registry punya ikon (11)', () => {
  assert.equal(HAZARD_IDS.length, 11)
  for (const id of HAZARD_IDS) {
    assert.match(hazardBlock, new RegExp(`\\n  ${id}: \\(`), `ikon ${id} hilang`)
  }
})

test('enam ikon cuaca tersedia', () => {
  for (const name of ['cerah', 'berawan', 'mendung', 'hujan', 'petir', 'kabut']) {
    assert.match(weatherBlock, new RegExp(`\\n  ${name}: \\(|\\n  ${name}: \\(\\n?\\s*<>?`), `ikon cuaca ${name} hilang`)
  }
})

test('ikon memakai currentColor, tanpa isi tetap, dan dekoratif', () => {
  assert.match(ICONS, /stroke: 'currentColor'/)
  assert.match(ICONS, /fill: 'none'/)
  assert.match(ICONS, /'aria-hidden': 'true'/)
  assert.equal(/fill="#/.test(ICONS), false, 'ada warna isi tetap (tidak mengikuti tema)')
  assert.equal(/#[0-9a-fA-F]{6}/.test(ICONS), false, 'ikon tidak boleh menyimpan kode warna')
})

test('pemakaian ikon memakai token kontras tinggi (≥3:1)', () => {
  const card = read('src/components/niu/AttentionCard.jsx')
  assert.match(card, /text-tanah-aksen dark:text-langit-aksen/)
  assert.equal(/text-tanah-tinta-halus|text-ink-subtle/.test(card), false, 'ikon memakai token terlalu pucat')
})

test('favicon & apple-touch-icon terpasang', () => {
  const html = read('index.html')
  assert.match(html, /rel="icon" href="\/favicon.svg" type="image\/svg\+xml"/)
  assert.match(html, /rel="apple-touch-icon" href="\/icons\/pwa-192.png"/)
  assert.ok(fs.existsSync(path.join(ROOT, 'public/favicon.svg')))
  const fav = read('public/favicon.svg')
  assert.match(fav, /viewBox="0 0 512 512"/)
  assert.match(fav, /#2F4A38/)
})

test('judul & tema dokumen sudah Niu (bukan nama lama)', () => {
  const html = read('index.html')
  assert.match(html, /<title>Niu — Cuaca &amp; Peringatan Dini Tanah Gayo<\/title>/)
  assert.match(html, /name="theme-color" content="#F1E7D8"/)
  assert.equal(html.includes('ecmwf_ifs025'), false)
  assert.match(html, /fonts\/bricolage-latin\.woff2/)
  assert.match(html, /fonts\/instrument-sans-latin\.woff2/)
})
