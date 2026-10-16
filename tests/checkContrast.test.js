/**
 * Uji untuk scripts/check-contrast.mjs (gerbang kontras WCAG fase design/UX).
 * Fokus pada rumus murni + perilaku pindai berkas, memakai fixture di direntri sementara
 * supaya tidak bergantung pada isi `src/` yang akan berubah saat paket P1–P4 diterapkan.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  MIN,
  blend,
  contrast,
  countSmallText,
  evaluatePairs,
  luminance,
  parseHex,
  parseThemeTokens,
  scanOpacityText,
  stripBlockComments,
  walkSource,
} from '../scripts/check-contrast.mjs'

/** Buat direktori sementara berisi berkas { nama: isi }. */
function tmpDir(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nga-kontras-'))
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), content)
  }
  return dir
}

const TOKENS = { surface: '#FAF7F2', soil: '#1A1512', ink: '#221C18', mist: '#E8E3DA' }

test('parseHex menerima heks 6 digit dengan/tanpa # dan menolak bentuk lain', () => {
  assert.deepEqual(parseHex('#ffffff'), [255, 255, 255])
  assert.deepEqual(parseHex('1a1512'), [26, 21, 18])
  assert.equal(parseHex('#abc'), null)
  assert.equal(parseHex('rgb(1,2,3)'), null)
  assert.equal(parseHex(null), null)
  assert.equal(parseHex(undefined), null)
})

test('luminance & contrast sesuai nilai rujukan WCAG', () => {
  assert.equal(luminance('#000000'), 0)
  assert.equal(luminance('#FFFFFF'), 1)
  assert.equal(contrast('#000000', '#FFFFFF'), 21)
  assert.equal(contrast('#FFFFFF', '#FFFFFF'), 1)
  // simetri: urutan argumen tidak mengubah hasil
  assert.equal(contrast('#221C18', '#FAF7F2'), contrast('#FAF7F2', '#221C18'))
  // angka audit design: ink di surface = 15,75:1
  assert.equal(contrast('#221C18', '#FAF7F2'), 15.75)
  // angka audit design: ink/45 (komposit) di surface = 2,81:1 → gagal AA
  assert.ok(contrast(blend('#221C18', 0.45, '#FAF7F2'), '#FAF7F2') < MIN.text)
})

test('luminance melempar galat untuk warna tak dikenal', () => {
  assert.throws(() => luminance('bukan-warna'), /tidak dikenal/)
})

test('blend memadankan color-mix Tailwind pada opasitas 0 / 1 / 50 %', () => {
  assert.equal(blend('#221C18', 0, '#FAF7F2'), '#FAF7F2')
  assert.equal(blend('#221C18', 1, '#FAF7F2'), '#221C18')
  const half = blend('#000000', 0.5, '#FFFFFF')
  assert.equal(half, '#808080')
  assert.equal(blend('bukan-warna', 0.5, '#FFFFFF'), null)
})

test('parseThemeTokens mengambil hanya --color-* heks 6 digit', () => {
  const css = `@theme {
    --color-soil: #1A1512;
    --color-leaf-soft: #8FBE93;
    --color-rusak: rgba(1,2,3,.5);
    --font-data: "JetBrains Mono", monospace;
  }`
  assert.deepEqual(parseThemeTokens(css), { soil: '#1A1512', 'leaf-soft': '#8FBE93' })
  assert.deepEqual(parseThemeTokens(''), {})
})

test('evaluatePairs: lulus, gagal, dan token yang belum ada', () => {
  const tokens = { ...TOKENS, 'ink-muted': '#F0EEE9' /* sengaja terlalu terang */ }
  const pairs = [
    { fg: 'ink', bg: 'surface', min: MIN.text, why: 'kontrol lulus' },
    { fg: 'ink-muted', bg: 'surface', min: MIN.text, why: 'kontrol gagal' },
    { fg: 'ink-subtle', bg: 'surface', min: MIN.text, why: 'token belum ada' },
  ]
  const { rows, failures, missing } = evaluatePairs(tokens, pairs)
  assert.equal(rows.length, 2)
  assert.equal(failures.length, 1)
  assert.equal(failures[0].why, 'kontrol gagal')
  assert.equal(missing.length, 1)
  assert.deepEqual(missing[0].absen, ['ink-subtle'])
})

test('scanOpacityText menandai utilitas gagal dan menerima yang lulus', () => {
  const dir = tmpDir({
    'A.jsx': `<span className="text-ink/45 dark:text-mist/40" />`,
    'B.jsx': `<span className="text-ink/75 dark:text-mist/85" />`,
  })
  const hits = scanOpacityText(walkSource(dir), TOKENS)
  assert.equal(hits.length, 2, 'ink/45 dan mist/40 harus tertangkap, yang terang tidak')
  const utils = hits.map((h) => h.util).sort()
  assert.deepEqual(utils, ['dark:text-mist/40', 'text-ink/45'])
  const terang = hits.find((h) => h.util === 'text-ink/45')
  assert.equal(terang.tema, 'terang')
  assert.equal(terang.ratio, 2.81)
  const gelap = hits.find((h) => h.util === 'dark:text-mist/40')
  assert.equal(gelap.tema, 'gelap')
  assert.ok(gelap.ratio < MIN.text)
})

test('scanOpacityText mengabaikan token yang tidak ada di @theme', () => {
  const dir = tmpDir({ 'C.jsx': `<span className="text-ink/30 dark:text-mist/30" />` })
  assert.equal(scanOpacityText(walkSource(dir), { ink: '#221C18', mist: '#E8E3DA' }).length, 0)
})

test('walkSource melewati direktori tak terbaca dan hanya mengambil jsx/js/css', () => {
  const dir = tmpDir({ 'x.jsx': '', 'y.css': '', 'z.md': '# bukan', 'w.txt': '' })
  fs.mkdirSync(path.join(dir, 'nested'))
  fs.writeFileSync(path.join(dir, 'nested', 'deep.js'), '')
  const files = walkSource(dir).map((f) => path.relative(dir, f)).sort()
  assert.deepEqual(files, ['nested/deep.js', 'x.jsx', 'y.css'])
  assert.deepEqual(walkSource(path.join(dir, 'tidak-ada')), [])
})

test('countSmallText menghitung ukuran px arbitrer di bawah basis 16 px', () => {
  const dir = tmpDir({ 'D.jsx': '<p className="text-[11px]" /><p className="text-[13px]" /><p className="text-[11px]" />' })
  assert.deepEqual(countSmallText(walkSource(dir)), { 11: 2, 13: 1 })
})

test('scanOpacityText & countSmallText tahan berkas tak terbaca', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nga-kontras-'))
  assert.deepEqual(scanOpacityText([path.join(dir, 'hilang.jsx')], TOKENS), [])
  assert.deepEqual(countSmallText([path.join(dir, 'hilang.jsx')]), {})
})

test('stripBlockComments membuang contoh anti-pola di komentar CSS/JSX dan tetap utuh di kode', () => {
  const css = `/* jangan pakai text-ink/45 untuk teks */\n.x { color: var(--color-ink-muted); }`
  assert.equal(stripBlockComments(css).includes('text-ink/45'), false)
  const jsx = `<div>{/* contoh text-mist/40 */}<span className="text-ink-muted" /></div>`
  assert.equal(stripBlockComments(jsx).includes('text-mist/40'), false)
  assert.ok(stripBlockComments(jsx).includes('text-ink-muted'))
  assert.equal(stripBlockComments('tanpa komentar').trim(), 'tanpa komentar')
})

test('scanOpacityText melewati komentar (temuan hanya dari kode nyata)', () => {
  const dir = tmpDir({
    'K.jsx': `/* contoh text-ink/45 */\n<span className="text-ink/45" />`,
  })
  const hits = scanOpacityText(walkSource(dir), TOKENS)
  assert.equal(hits.length, 1, 'hanya pemakaian nyata yang dihitung')
  assert.equal(hits[0].line, 2)
})
