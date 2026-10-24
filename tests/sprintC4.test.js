/**
 * Sprint C · bundel 4 — anggaran CSS & kualitas tes.
 *
 * Tes ini sengaja berbentuk **ratchet**: angkanya boleh turun, tidak boleh naik.
 * Tujuannya menghentikan pertumbuhan diam-diam (hex liar, `!important`, breakpoint baru,
 * tes berbasis regex) tanpa memaksa refactor besar sekaligus.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname
const read = (p) => readFileSync(path.join(ROOT, p), 'utf8')

const hexOf = (css) => (css.match(/#[0-9a-fA-F]{3,8}/g) || []).length

// ── F-27 ────────────────────────────────────────────────────────────────────
test('F-27: literal hex Living Map hanya boleh ada di blok palet', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const total = hexOf(css)
  assert.ok(total <= 14, `literal hex ${total} melebihi anggaran 14 (dulu 54)`)
  // Semua literal itu harus berada di blok token (sebelum aturan pertama).
  const blokToken = css.slice(0, css.indexOf('}', css.indexOf('--lm-warn-bg')))
  assert.equal(hexOf(blokToken), total, 'hex di luar blok palet tidak diperbolehkan')
})

test('F-27: setiap var(--color-*) yang dipakai Living Map benar-benar didefinisikan', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const globals = read('src/index.css') + read('src/styles/theme-directions.css')
  const dipakai = new Set([...css.matchAll(/var\((--color-[a-z0-9-]+)/g)].map((m) => m[1]))
  const hilang = [...dipakai].filter((v) => !new RegExp(`${v}\\s*:`).test(globals))
  assert.deepEqual(hilang, [], `variabel tanpa definisi: ${hilang.join(', ')}`)
})

// ── F-28 ────────────────────────────────────────────────────────────────────
test('F-28: anggaran !important tema tidak boleh naik, pola label tersembunyi bebas !important', () => {
  const css = read('src/styles/theme-directions.css')
  const jumlah = (css.match(/!important/g) || []).length
  assert.ok(jumlah <= 38, `!important ${jumlah} melebihi anggaran 38 (dulu 56)`)
  const blokLabel = css.slice(css.indexOf('.niu-metric-label-full.niu-metric-label-full'), css.indexOf('.niu-metric-label-compact'))
  assert.ok(blokLabel.length > 0, 'pola label tersembunyi harus memakai selector kelas ganda')
  assert.doesNotMatch(blokLabel, /!important/, 'pola sembunyikan label tidak boleh memakai !important')
})

// ── F-29 ────────────────────────────────────────────────────────────────────
test('F-29: breakpoint CSS desktop hanya dari skala yang disepakati', () => {
  const diizinkan = new Set(['760px', '761px', '1100px', '1180px', '1280px', '1440px', '1600px', '1700px'])
  const dipakai = new Set()
  for (const rel of ['src/pages/LivingMapDesktop.css', 'src/styles/desktop-layout.css']) {
    for (const m of read(rel).matchAll(/@media[^{]*\((?:min|max)-width:\s*([0-9.]+px)\)/g)) dipakai.add(m[1])
  }
  const liar = [...dipakai].filter((v) => !diizinkan.has(v))
  assert.deepEqual(liar, [], `breakpoint di luar skala: ${liar.join(', ')}`)
  assert.ok(dipakai.size <= 8, `jumlah breakpoint ${dipakai.size} > 8`)
})

// ── F-38 ────────────────────────────────────────────────────────────────────
test('F-38: uji CSS memakai peta deklarasi, bukan regex teks mentah (ratchet)', () => {
  // Metrik: assert.match/doesNotMatch yang menembak variabel hasil read('*.css').
  // Batas boleh TURUN; naikkan hanya bila regex benar-benar tak terhindarkan.
  const perBerkas = {}
  for (const f of readdirSync(path.join(ROOT, 'tests')).filter((x) => x.endsWith('.test.js'))) {
    const isi = read(`tests/${f}`)
    const vars = new Set(
      [...isi.matchAll(/(?:const|let)\s+(\w+)\s*=\s*read\(['"]([^'"]*\.css)['"]\)/g)].map((m) => m[1]),
    )
    let n = 0
    for (const v of vars) {
      n += (isi.match(new RegExp(`assert\\.(?:match|doesNotMatch)\\(\\s*${v}\\s*,`, 'g')) || []).length
    }
    if (n) perBerkas[f] = n
  }
  const total = Object.values(perBerkas).reduce((a, b) => a + b, 0)
  assert.ok(total <= 13, `regex CSS mentah ${total} melebihi anggaran 13: ${JSON.stringify(perBerkas)}`)
  assert.ok(
    (perBerkas['livingMapDesktop.test.js'] || 0) <= 2,
    'livingMapDesktop: hanya 2 pemeriksaan urutan deklarasi yang boleh berupa regex',
  )
})

test('F-38: uji DOM tidak boleh menyusut (ratchet kedua)', () => {
  const berkas = readdirSync(path.join(ROOT, 'tests')).filter((f) => /^dom[A-Z][\w]*\.test\.js$/.test(f))
  const jumlah = berkas.reduce((n, f) => n + (read(`tests/${f}`).match(/^test\(/gm) ?? []).length, 0)
  assert.ok(jumlah >= 34, `uji DOM ${jumlah} < 34: konversi tes regex ke render nyata, jangan sebaliknya`)
  for (const f of berkas) {
    assert.match(read(`tests/${f}`), /renderToStaticMarkup/, `${f} harus merender komponen, bukan membaca sumber`)
  }
})
