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
  GLOBAL_DRIFT_MAX,
  METRICS,
  SCOPE_ALLOW,
  SCOPE_FLOOR,
  THRESHOLDS,
  compareToBaseline,
  childEnv,
  coverageTable,
  evaluate,
  evaluateDrift,
  evaluateScope,
  listTestFiles,
  parseCoverage,
  parseFileRows,
  scopeRows,
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

// ── 2.3.4: lingkup kritis menggantikan satu angka global ────────────────────
test('parseFileRows: memisahkan berkas dari baris "all files" dan baris TAP', () => {
  const rows = parseFileRows(`not ok 1 - sesuatu\n${SAMPLE}\nok 2 - lain`)
  assert.deepEqual(Object.keys(rows).sort(), ['server/alerts.js', 'src/domain/alert.js'])
  assert.deepEqual(rows['src/domain/alert.js'], { lines: 91.3, branches: 77.78, functions: 90 })
})

test('scopeRows: hanya server/ dan src/domain/ yang dinilai lantainya', () => {
  const rows = {
    'server/routes.js': { lines: 70 },
    'src/domain/alert.js': { lines: 95 },
    'src/components/ShareButton.jsx': { lines: 15 },
    'tests/x.test.js': { lines: 100 },
  }
  assert.deepEqual(scopeRows(rows).map(([f]) => f), ['server/routes.js', 'src/domain/alert.js'])
})

test('evaluateScope: lantai per berkas, pengecualian bertanggal, dan pengecualian basi', () => {
  assert.equal(SCOPE_FLOOR, 80)
  const sehat = evaluateScope({ 'server/a.js': { lines: 90 }, 'src/domain/b.js': { lines: 81 } })
  assert.equal(sehat.ok, true)
  assert.equal(sehat.checked, 2)

  const gagal = evaluateScope({ 'server/a.js': { lines: 79.9 } })
  assert.equal(gagal.ok, false)
  assert.equal(gagal.failures[0].file, 'server/a.js')

  const dibebaskan = evaluateScope({ 'server/routes.js': { lines: 75.85 } })
  assert.equal(dibebaskan.ok, true, 'pengecualian bertanggal tidak menggagalkan gerbang')
  assert.deepEqual(dibebaskan.allowed.map((a) => a.file), ['server/routes.js'])

  // Bila cakupannya sudah naik, entri pengecualian harus dihapus — selain itu gerbang longgar.
  const basi = evaluateScope({ 'server/routes.js': { lines: 88 } })
  assert.deepEqual(basi.stale, ['server/routes.js'])
  assert.equal(Object.keys(SCOPE_ALLOW).length <= 2, true, 'pengecualian dijaga tetap sedikit')
})

test('evaluateDrift: ratchet global 0,5 poin dari baseline', () => {
  assert.equal(GLOBAL_DRIFT_MAX, 0.5)
  const baseline = { updated: '2026-10-24', lines: 90, branches: 84, functions: 90 }
  assert.equal(evaluateDrift({ lines: 89.6, branches: 84, functions: 90 }, baseline).ok, true, 'turun 0,4 pp masih boleh')
  const turun = evaluateDrift({ lines: 89.4, branches: 84, functions: 90 }, baseline)
  assert.equal(turun.ok, false)
  assert.equal(turun.failures[0].metric, 'lines')
  assert.equal(evaluateDrift({ lines: 10, branches: 10, functions: 10 }, null).ok, true, 'tanpa baseline bukan alasan gagal')
})

test('CLI: berkas lingkup kritis di bawah lantai → keluar 1', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'))
  const file = path.join(dir, 'laporan.txt')
  // routes.js di bawah lantai DAN tidak ada di daftar pengecualian → gerbang menolak.
  fs.writeFileSync(file, SAMPLE.replace(
    '# src/domain/alert.js  |  91.30 |    77.78 |   90.00 | 12-16',
    '# server/tidak-dikecualikan.js | 41.00 | 30.00 | 50.00 | 1-90',
  ))
  const res = spawnSync(process.execPath, [SCRIPT, '--from', file], { encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /server\/tidak-dikecualikan\.js: 41\.00 % < lantai 80 %/)
  assert.match(res.stderr, /SCOPE_ALLOW/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('CLI: laporan healthy → keluar 0, mencetak lingkup kritis dan tren', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'))
  const file = path.join(dir, 'laporan.txt')
  // Global sengaja jauh di atas baseline agar ratchet tidak ikut menilai tes ini.
  fs.writeFileSync(file, SAMPLE.replace('|  96.59 |    83.78 |   95.99 |', '|  97.00 |    90.00 |   96.00 |'))
  const res = spawnSync(process.execPath, [SCRIPT, '--from', file], { encoding: 'utf8' })
  assert.equal(res.status, 0, res.stderr)
  assert.match(res.stdout, /lingkup kritis: 2 berkas/)
  assert.match(res.stdout, /global baris: 97\.00 %/)
  assert.match(res.stdout, /tren vs baseline/)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('CLI: --min-lines tetap bisa menuntut ambang global yang lebih ketat', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'coverage-'))
  const file = path.join(dir, 'laporan.txt')
  fs.writeFileSync(file, SAMPLE.replace('|  96.59 |    83.78 |   95.99 |', '|  97.00 |    90.00 |   96.00 |'))
  const res = spawnSync(process.execPath, [SCRIPT, '--from', file, '--min-lines', '99'], { encoding: 'utf8' })
  assert.equal(res.status, 1)
  assert.match(res.stderr, /baris 97\.00 % < ambang 99 %/)
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

// ── 2.3.4 — resiprositas pengecualian: skrip ↔ dokumen ──────────────────────
test('resiprositas: daftar pengecualian di SKRIP-NPM.md sama persis dengan SCOPE_ALLOW', () => {
  const dokumen = fs.readFileSync(path.join(HERE, '..', 'docs', 'reference', 'SKRIP-NPM.md'), 'utf8')
  const bagian = dokumen.split('**Pengecualian bertanggal.**')[1]
  assert.ok(bagian, 'dokumen referensi wajib punya bagian "Pengecualian bertanggal"')
  const blok = bagian.match(/```teks\n([\s\S]*?)```/)
  assert.ok(blok, 'bagian pengecualian memuat blok ```teks yang bisa dibaca mesin')

  const baris = blok[1].trim().split('\n').filter(Boolean).map((l) => {
    const m = l.match(/^(server\/\S+|src\/\S+) — (\d{4}-\d{2}-\d{2})$/)
    assert.ok(m, `baris pengecualian tidak terbaca (pakai "berkas — YYYY-MM-DD"): ${l}`)
    return { file: m[1], date: m[2] }
  })

  assert.deepEqual(
    baris.map((b) => b.file).sort(),
    Object.keys(SCOPE_ALLOW).sort(),
    'berkas yang dikecualikan di skrip dan di dokumen harus sama — dua arah, tanpa sisa',
  )
  for (const { file, date } of baris) {
    assert.equal(
      SCOPE_ALLOW[file].startsWith(`${date} · `),
      true,
      `alasan ${file} harus diawali tanggal ${date} yang sama dengan dokumen`,
    )
  }
})

test('resiprositas: setiap pengecualian menunjuk berkas nyata, bertanggal, dan beralasan', () => {
  for (const [file, alasan] of Object.entries(SCOPE_ALLOW)) {
    assert.ok(fs.existsSync(path.join(HERE, '..', file)), `berkas pengecualian tidak ada: ${file}`)
    assert.match(alasan, /^\d{4}-\d{2}-\d{2} · \S/, 'alasan diawali tanggal + keterangan')
    assert.ok(alasan.length >= 60, `alasan ${file} terlalu pendek untuk berguna saat ditinjau`)
    const tanggal = new Date(`${alasan.slice(0, 10)}T00:00:00Z`).getTime()
    assert.ok(Number.isFinite(tanggal), `tanggal pengecualian ${file} tidak valid`)
    assert.ok(tanggal <= Date.now(), `tanggal pengecualian ${file} di masa depan`)
  }
})

test('resiprositas: angka di dokumen = konstanta di skrip (lantai & toleransi ratchet)', () => {
  const dokumen = fs.readFileSync(path.join(HERE, '..', 'docs', 'reference', 'SKRIP-NPM.md'), 'utf8')
  assert.match(dokumen, new RegExp(`lantai per berkas — ${SCOPE_FLOOR} % baris|Lantai per berkas — ${SCOPE_FLOOR} % baris`), 'lantai di dokumen harus ' + SCOPE_FLOOR)
  assert.match(dokumen, new RegExp(`turun lebih dari ${String(GLOBAL_DRIFT_MAX).replace('.', ',')} poin`), 'toleransi ratchet di dokumen harus ' + GLOBAL_DRIFT_MAX)
  const baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'))
  assert.ok(
    dokumen.includes(baseline.updated),
    `dokumen harus menyebut tanggal baseline terbaru (${baseline.updated}) agar reset tidak diam-diam`,
  )
})
