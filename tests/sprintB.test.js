// Uji kontrak Sprint B — temuan audit F-39 (a11y berbasis browser di CI).
// Gagal di sini berarti gerbang aksesibilitas hilang dari rantai build, bukan
// sekadar berubah gaya: setiap uji membaca berkas nyata (package.json, workflow,
// skrip gerbang) seperti a11yContract.test.js membaca sumber komponen.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const pkg = JSON.parse(read('package.json'))
const gate = read('scripts/a11y-gate.mjs')
const ci = read('.github/workflows/ci.yml')

test('F-39: npm run check:a11y tersedia dan memanggil gerbang browser', () => {
  assert.equal(pkg.scripts['check:a11y'], 'node scripts/a11y-gate.mjs')
  assert.ok(fs.existsSync(path.join(ROOT, 'scripts/a11y-gate.mjs')), 'scripts/a11y-gate.mjs harus ada')
})

test('F-39: axe-core dan puppeteer-core adalah dependensi dev (bukan runtime)', () => {
  assert.ok(pkg.devDependencies?.['axe-core'], 'axe-core harus ada di devDependencies')
  assert.ok(pkg.devDependencies?.['puppeteer-core'], 'puppeteer-core harus ada di devDependencies')
  assert.equal(pkg.dependencies?.['axe-core'], undefined, 'axe-core tidak boleh ikut bundel runtime')
  assert.equal(pkg.dependencies?.['puppeteer-core'], undefined, 'puppeteer-core tidak boleh ikut bundel runtime')
})

test('F-39: gerbang memeriksa tiga permukaan yang diaudit Sprint A', () => {
  for (const nama of ['Papan desktop', 'Peta hidup — Tanah', 'Peta hidup — Langit']) {
    assert.ok(gate.includes(nama), `permukaan "${nama}" harus tetap diaudit`)
  }
  // Permukaan Langit harus benar-benar memakai tema gelap, bukan sekadar nama.
  assert.match(gate, /localStorage\.setItem\('nga\.theme',\s*'dark'\)/)
  assert.match(gate, /localStorage\.setItem\('niu\.arah',\s*'langit'\)/)
})

test('F-39: gerbang memakai standar WCAG yang sama dengan audit', () => {
  assert.match(gate, /const AXE_TAGS = \['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'\]/)
  assert.match(gate, /axe\.run\(document/)
})

test('F-39: gerbang tidak boleh lulus diam-diam saat browser tidak ada', () => {
  // CHROME_PATH yang diset tapi tidak valid = gagal keras (jalur CI).
  assert.match(gate, /CHROME_PATH diset tetapi tidak ada[\s\S]{0,120}process\.exit\(1\)/)
  // Tanpa CHROME_PATH barulah boleh dilewati, dan itu harus terlihat di log.
  assert.match(gate, /Gerbang a11y dilewati: browser tidak ditemukan/)
})

test('F-39: gerbang menolak directori dist yang kedaluwarsa', () => {
  assert.match(gate, /function staleDist\(\)/)
  assert.match(gate, /dist\/ kedaluwarsa[\s\S]{0,120}process\.exit\(1\)/)
})

test('F-39: CI menjalankan gerbang a11y setelah build dan memberi CHROME_PATH', () => {
  assert.match(ci, /run: npm run check:a11y/)
  // Versi browser harus diturunkan dari puppeteer-core, bukan dipin tangan: pin manual
  // pernah membuat Chrome 131 dipakai bersama puppeteer-core 25 dan gerbang menggantung.
  assert.match(ci, /@puppeteer\/browsers install "?chrome-headless-shell@\$VERSION"?/)
  assert.match(ci, /PUPPETEER_REVISIONS\['chrome-headless-shell'\]/)
  assert.match(ci, /CHROME_PATH=\$PWD\/\$\(find \.cache\/browsers/)
  // Urutan penting: browser dipakai untuk mengaudit dist hasil build, bukan dev server.
  assert.ok(
    ci.indexOf('Build production bundle') < ci.indexOf('npm run check:a11y'),
    'gerbang a11y harus berjalan setelah "Build production bundle"',
  )
})

test('F-39: browser CI tidak ikut masuk repositori', () => {
  assert.match(read('.gitignore'), /^\.cache\/$/m)
})
