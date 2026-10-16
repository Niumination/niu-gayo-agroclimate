// Uji gerbang tipografi P3 (scripts/check-typography.mjs) — fungsi murni + integrasi repo.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  MIN_ARBITRARY_PX,
  stripComments,
  scanArbitrarySizes,
  scanBuiltinSizes,
  scanFormControls,
  scanTruncate,
  scaleUsage,
  fontFiles,
  evaluate,
  DEFAULT_SRC,
} from '../scripts/check-typography.mjs'

const src = (text, file = 'src/X.jsx') => [{ file, text }]

test('tipografi: stripComments membuang komentar tanpa merusak URL', () => {
  const text = "// text-[9px]\n/* text-xs */\nconst u = 'https://contoh.id/a' // jejak\n<a/>"
  const clean = stripComments(text)
  assert.ok(!clean.includes('text-[9px]'))
  assert.ok(!clean.includes('text-xs'))
  assert.ok(clean.includes('https://contoh.id/a'))
})

test(`tipografi: ukuran arbitrer < ${MIN_ARBITRARY_PX} px ditandai, ≥ batas diloloskan`, () => {
  const sources = src('<p className="text-[11px]">a</p>\n<p className="text-body">b</p>\n<span className="text-[3.5rem]">c</span>\n<i className="text-[0.7rem]">d</i>')
  const { violations, all } = scanArbitrarySizes(sources)
  assert.strictEqual(all.length, 3)
  assert.deepStrictEqual(
    violations.map((v) => v.raw),
    ['text-[11px]', 'text-[0.7rem]'],
  )
  assert.strictEqual(violations[1].px, 11.2)
})

test('tipografi: ukuran bawaan kecil (text-xs/text-sm) ditandai', () => {
  const v = scanBuiltinSizes(src('<h2 className="text-sm font-semibold">judul</h2>\n<b className="text-xs">x</b>\n<p className="text-body">y</p>'))
  assert.deepStrictEqual(v.map((x) => x.raw).sort(), ['text-sm', 'text-xs'])
})

test('tipografi: kontrol formulir tidak boleh < 16 px', () => {
  const bad = scanFormControls(src('<select className="text-caption px-2">…</select>\n<input className="text-body-sm" />\n<textarea className="text-body" />'))
  assert.strictEqual(bad.length, 2)
  assert.deepStrictEqual(bad.map((b) => b.tag), ['select', 'input'])
  assert.ok(scanFormControls(src('<select className="text-body h-11">…</select>')).length === 0)
})

test('tipografi: truncate ditandai (teks wajib membungkus)', () => {
  const v = scanTruncate(src('<h2 className="break-words">a</h2>\n<p className="truncate">b</p>'))
  assert.strictEqual(v.length, 1)
  assert.strictEqual(v[0].line, 2)
})

test('tipografi: distribusi kelas skala dihitung', () => {
  const counts = scaleUsage(src('<p className="text-body text-caption">a</p><span className="text-body">b</span>'))
  assert.strictEqual(counts['text-body'], 2)
  assert.strictEqual(counts['text-caption'], 1)
  assert.strictEqual(counts['text-label'], 0)
})

test('tipografi: fontFiles hanya berkas font & terurut', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tipografi-'))
  fs.writeFileSync(path.join(dir, 'b.woff2'), Buffer.alloc(20))
  fs.writeFileSync(path.join(dir, 'a.woff2'), Buffer.alloc(10))
  fs.writeFileSync(path.join(dir, 'catatan.txt'), 'x')
  const list = fontFiles(dir)
  assert.deepStrictEqual(list.map((f) => f.name), ['a.woff2', 'b.woff2'])
  assert.strictEqual(list[1].bytes, 20)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('tipografi: evaluate menandai font hilang & font belum terbangun', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tipografi-eval-'))
  const srcDir = path.join(base, 'src')
  const fontDir = path.join(base, 'public', 'fonts')
  const distDir = path.join(base, 'dist')
  fs.mkdirSync(srcDir, { recursive: true })
  fs.writeFileSync(path.join(srcDir, 'A.jsx'), '<p className="text-body">ok</p>')
  const noFont = evaluate({ srcDir, fontDir, distDir })
  assert.ok(noFont.failures.some((f) => f.rule === 'font-missing'))
  fs.mkdirSync(fontDir, { recursive: true })
  fs.writeFileSync(path.join(fontDir, 'x.woff2'), Buffer.alloc(4))
  fs.mkdirSync(distDir, { recursive: true })
  const notBuilt = evaluate({ srcDir, fontDir, distDir })
  assert.ok(notBuilt.failures.some((f) => f.rule === 'font-not-built'))
  fs.mkdirSync(path.join(distDir, 'fonts'), { recursive: true })
  fs.writeFileSync(path.join(distDir, 'fonts', 'x.woff2'), Buffer.alloc(4))
  assert.deepStrictEqual(evaluate({ srcDir, fontDir, distDir }).failures, [])
  fs.rmSync(base, { recursive: true, force: true })
})

test('tipografi: pohon src repo bersih dari temuan (ratchet)', () => {
  const { failures, info } = evaluate({ srcDir: DEFAULT_SRC })
  assert.deepStrictEqual(failures.map((f) => f.message), [])
  assert.ok(info.scale['text-caption'] > 0, 'token skala caption harus dipakai')
  assert.ok(info.scale['text-body'] > 0, 'token skala body harus dipakai')
  assert.strictEqual(info.arbitrary, 2, 'hanya ukuran baca besar (rem) yang boleh arbitrer')
})
