// A-2 — gerbang ambang cakupan uji: pengurai tabel cakupan, penilaian ambang, tren baseline, CLI.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import {
  BASELINE_FILE,
  METRICS,
  THRESHOLDS,
  compareToBaseline,
  childEnv,
  coverageTable,
  evaluate,
  listTestFiles,
  parseCoverage,
  runTests,
} from '../scripts/check-coverage.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(HERE, '..', 'scripts', 'check-coverage.mjs')

/** Keluaran `--experimental-test-coverage` yang dipadatkan (bentuk Node 20/22). */
const SAMPLE = [
  '# start of coverage report',
  '# ------------------------------------------------------------------',
  '# file                 | line % | branch % | funcs % | uncovered lines',
  '# ------------------------------------------------------------------',
  '# server/alerts.js     | 100.00 |   100.00 |  100.00 | ',
  '# src/domain/alert.js  |  91.30 |    77.78 |   90.00 | 12-16',
  '# ------------------------------------------------------------------',
  '# all files            |  96.59 |    83.78 |   95.99 |',
  '# ------------------------------------------------------------------',
  '# end of coverage report',
].join('\n')

test('parseCoverage: membaca baris ringkasan all files (baris/cabang/fungsi)', () => {
  assert.deepEqual(parseCoverage(SAMPLE), { lines: 96.59, branches: 83.78, functions: 95.99 })
})

test('parseCoverage: null bila ringkasan tidak ada (bukan angka karangan)', () => {
  assert.equal(parseCoverage('# tests 12\n# pass 12'), null)
  assert.equal(parseCoverage(''), null)
})

test('coverageTable: hanya mengembalikan tabel cakupan, bukan seluruh TAP', () => {
  const table = coverageTable(`not ok 1 - sesuatu\n${SAMPLE}\n# tests 3`)
  assert.equal(table[0], '# start of coverage report')
  assert.equal(table.at(-1), '# end of coverage report')
  assert.equal(table.some((l) => l.includes('not ok')), false)
  assert.equal(table.some((l) => l.includes('server/alerts.js')), true)
})

test('evaluate: lolos bila semua metrik ≥ ambang', () => {
  const res = evaluate({ lines: 95, branches: 80, functions: 92 }, THRESHOLDS)
  assert.equal(res.ok, true)
  assert.deepEqual(res.failures, [])
})

test('evaluate: menandai setiap metrik di bawah ambang beserta besaran kurangnya', () => {
  const res = evaluate({ lines: 94.99, branches: 79, functions: 95 }, THRESHOLDS)
  assert.equal(res.ok, false)
  assert.deepEqual(
    res.failures.map((f) => [f.metric, f.actual, f.min]),
    [
      ['lines', 94.99, 95],
      ['branches', 79, 80],
    ],
  )
})

test('evaluate: ambang yang tidak diberikan untuk suatu metrik diabaikan', () => {
  const res = evaluate({ lines: 10, branches: 83.78, functions: 95.99 }, { lines: 95 })
  assert.equal(res.ok, false)
  assert.equal(res.failures.length, 1)
})

test('compareToBaseline: selisih per metrik dibulatkan 2 desimal; baseline kosong → []', () => {
  const rows = compareToBaseline({ lines: 97, branches: 83.78, functions: 94.5 }, { updated: '2026-10-16', lines: 96.59, branches: 83.78, functions: 95.99 })
  assert.deepEqual(rows, [
    { metric: 'lines', label: 'baris', baseline: 96.59, actual: 97, delta: 0.41 },
    { metric: 'branches', label: 'cabang', baseline: 83.78, actual: 83.78, delta: 0 },
    { metric: 'functions', label: 'fungsi', baseline: 95.99, actual: 94.5, delta: -1.49 },
  ])
  assert.deepEqual(compareToBaseline({ lines: 1, branches: 1, functions: 1 }, null), [])
})

test('listTestFiles: berkas uji nyata di tests/ ditemukan & terurut', () => {
  const files = listTestFiles()
  assert.ok(files.length > 30, `jumlah berkas uji wajar (${files.length})`)
  assert.ok(files.every((f) => f.endsWith('.test.js')))
  assert.deepEqual(files, [...files].sort())
})

test('METRICS & ambang bawaan konsisten dengan kolom tabel Node', () => {
  assert.deepEqual(METRICS.map((m) => m.key), ['lines', 'branches', 'functions'])
  assert.ok(THRESHOLDS.lines >= 90 && THRESHOLDS.lines <= 100)
  assert.ok(THRESHOLDS.branches >= 75 && THRESHOLDS.branches <= 100)
  assert.ok(THRESHOLDS.functions >= 90 && THRESHOLDS.functions <= 100)
})

test('baseline terversi: berbentuk angka valid (laporan tren dapat dibaca ulang)', () => {
  const doc = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
  for (const { key } of METRICS) assert.ok(Number.isFinite(doc[key]), `baseline.${key} angka`)
  assert.match(doc.updated, /^\d{4}-\d{2}-\d{2}$/)
})

test('childEnv: buang env warisan pelari uji (NODE_TEST_CONTEXT/NODE_OPTIONS/coverage), sisanya utuh', () => {
  const out = childEnv({ PATH: '/usr/bin', HOME: '/home/u', NODE_TEST_CONTEXT: 'child-v8', NODE_OPTIONS: '--experimental-vm-modules', NODE_V8_COVERAGE: '/tmp/cov' })
  assert.deepEqual(out, { PATH: '/usr/bin', HOME: '/home/u' })
})

test('runTests: menjalankan berkas uji yang diberikan & mengembalikan status + tabel cakupan', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-run-'))
  const file = path.join(dir, 'mini.test.js')
  fs.writeFileSync(file, "import test from 'node:test'\nimport assert from 'node:assert/strict'\ntest('mini', () => assert.equal(1 + 1, 2))\n")
  const res = runTests([file], { cwd: dir })
  assert.equal(res.status, 0, res.stderr)
  assert.ok(coverageTable(res.stdout).join('\n').includes('mini.test.js'), 'berkas uji muncul di tabel cakupan')

  const bad = path.join(dir, 'gagal.test.js')
  fs.writeFileSync(bad, "import test from 'node:test'\nimport assert from 'node:assert/strict'\ntest('gagal', () => assert.equal(1, 2))\n")
  const failed = runTests([bad], { cwd: dir })
  assert.notEqual(failed.status, 0, 'suite uji yang gagal diteruskan sebagai status non-nol')
  fs.rmSync(dir, { recursive: true, force: true })
})

test('CLI: laporan tersimpan di bawah ambang → keluar 1, tanpa menjalankan suite', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'))
  const file = path.join(dir, 'laporan.txt')
  fs.writeFileSync(file, SAMPLE.replace('|  96.59 |    83.78 |   95.99 |', '|  70.00 |    40.00 |   50.00 |'))
  const res = spawnSync(process.execPath, [SCRIPT, '--from', file], { encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /baris 70\.00 % < ambang 95 %/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('CLI: laporan tersimpan di atas ambang → keluar 0 dan mencetak tren', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'))
  const file = path.join(dir, 'laporan.txt')
  fs.writeFileSync(file, SAMPLE)
  const res = spawnSync(process.execPath, [SCRIPT, '--from', file, '--min-lines', '96', '--min-branches', '83.78'], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  assert.match(res.stdout, /✓ \[coverage\] baris: 96\.59 % \(ambang 96 %\)/)
  assert.match(res.stdout, /tren vs baseline/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('CLI: argumen tidak dikenal / ambang bukan angka → keluar 2 (salah pakai, bukan gagal cakupan)', () => {
  const bad = spawnSync(process.execPath, [SCRIPT, '--entah'], { encoding: 'utf8' })
  assert.equal(bad.status, 2)
  assert.match(bad.stderr, /argumen tidak dikenal/)
  const nan = spawnSync(process.execPath, [SCRIPT, '--min-lines', 'tinggi'], { encoding: 'utf8' })
  assert.equal(nan.status, 2)
  assert.match(nan.stderr, /nilai ambang tidak valid/)
})
