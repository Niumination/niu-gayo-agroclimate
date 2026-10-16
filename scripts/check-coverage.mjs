#!/usr/bin/env node
/**
 * check-coverage — gerbang ambang cakupan uji (temuan audit F-10 → roadmap A-2).
 *
 * Menjalankan suite uji dengan cakupan bawaan Node (`--experimental-test-coverage`),
 * lalu membandingkan metrik baris/cabang/fungsi dengan ambang gagal. Skrip keluar 1
 * bila suite uji gagal atau salah satu metrik di bawah ambang, sehingga regresi
 * cakupan pada modul kritis (hazards, alert, thresholds, routes) tertangkap di CI.
 *
 * Ambang bawaan sengaja ditetapkan 1,5–4 poin di bawah baseline 2026-10-16
 * (baris 96,59 % · cabang 83,78 % · fungsi 95,99 %) agar refactor kecil tidak
 * membuat CI rapuh, tetapi penurunan yang berarti tetap menggagalkan build.
 *
 * Pakai:
 *   node scripts/check-coverage.mjs                     # jalankan tes + nilai ambang
 *   node scripts/check-coverage.mjs --min-lines 96      # ambang kustom (persen)
 *   node scripts/check-coverage.mjs --from hasil.txt    # nilai laporan tersimpan (tanpa menjalankan tes)
 *   node scripts/check-coverage.mjs --update-baseline   # catat angka kini sebagai baseline tren
 *
 * Catatan portabilitas: hanya memakai flag cakupan yang ada sejak Node 20
 * (`--experimental-test-coverage`), bukan flag ambang `--test-coverage-*` yang
 * baru ada di Node 22 — dengan begitu gerbang ini tetap jalan di lantai `engines`
 * yang dideklarasikan repo (>= 20.19).
 */
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.join(__dirname, '..')
export const TESTS_DIR = path.join(REPO, 'tests')
export const BASELINE_FILE = path.join(__dirname, 'coverage-baseline.json')

/** Ambang gagal bawaan (persen). Dasar pemilihan ada di komentar atas berkas ini. */
export const THRESHOLDS = { lines: 95, branches: 80, functions: 92 }

/** Urutan & label metrik yang dinilai (sesuai kolom tabel cakupan Node). */
export const METRICS = [
  { key: 'lines', label: 'baris' },
  { key: 'branches', label: 'cabang' },
  { key: 'functions', label: 'fungsi' },
]

/** Daftar berkas uji `tests/*.test.js` (urut, tanpa shell-glob agar lintas platform). */
export function listTestFiles(dir = TESTS_DIR) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join(dir, f))
}

/**
 * Ambil baris ringkasan `all files` dari keluaran `--experimental-test-coverage`.
 * Kembalikan `{ lines, branches, functions }` (persen) atau `null` bila tak ada.
 */
export function parseCoverage(stdout) {
  const m = /^#\s*all files\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/m.exec(String(stdout))
  if (!m) return null
  const [lines, branches, functions] = [m[1], m[2], m[3]].map(Number)
  if ([lines, branches, functions].some((n) => !Number.isFinite(n))) return null
  return { lines, branches, functions }
}

/** Nilai ambang vs hasil ukur → daftar kegagalan (kosong = lolos). */
export function evaluate(actual, thresholds = THRESHOLDS) {
  const failures = []
  for (const { key, label } of METRICS) {
    const min = thresholds[key]
    if (min === undefined || min === null) continue
    if (actual[key] < min) failures.push({ metric: key, label, actual: actual[key], min })
  }
  return { ok: failures.length === 0, failures }
}

/** Selisih hasil kini terhadap baseline tren (informasional, bukan gerbang). */
export function compareToBaseline(actual, baseline) {
  if (!baseline) return []
  return METRICS.filter(({ key }) => Number.isFinite(baseline[key])).map(({ key, label }) => ({
    metric: key,
    label,
    baseline: baseline[key],
    actual: actual[key],
    delta: Number((actual[key] - baseline[key]).toFixed(2)),
  }))
}

/** Baris tabel cakupan (bagian akhir keluaran Node) untuk ditampilkan kembali. */
export function coverageTable(stdout) {
  const lines = String(stdout).split('\n')
  const start = lines.findIndex((l) => /^#\s*start of coverage report/.test(l))
  const end = lines.findIndex((l) => /^#\s*end of coverage report/.test(l))
  if (start === -1) return lines.filter((l) => /^#\s.*\|\s*[\d.]+\s*\|/.test(l))
  return lines.slice(start, end === -1 ? undefined : end + 1)
}

function readBaseline(file = BASELINE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

function writeBaseline(actual, file = BASELINE_FILE, now = new Date()) {
  const doc = {
    note: 'Baseline tren cakupan (roadmap A-2). Perbarui dengan: node scripts/check-coverage.mjs --update-baseline',
    updated: now.toISOString().slice(0, 10),
    ...actual,
  }
  fs.writeFileSync(file, `${JSON.stringify(doc, null, 2)}\n`)
  return doc
}

/**
 * Bersihkan env warisan agar proses anak berperilaku normal: `NODE_TEST_CONTEXT`
 * (di-set node:test saat menjalankan berkas uji) membuat anak mengira dirinya
 * pelari uji bertingkat sehingga tabel cakupan tidak dicetak; `NODE_OPTIONS`
 * & `NODE_V8_COVERAGE` juga bisa mengubah perilaku keluaran.
 */
export function childEnv(env = process.env) {
  const out = {}
  for (const [k, v] of Object.entries(env)) {
    if (k === 'NODE_OPTIONS' || k.startsWith('NODE_TEST_') || k.startsWith('NODE_V8_COVERAGE')) continue
    out[k] = v
  }
  return out
}

/** Jalankan suite uji dengan cakupan; kembalikan { status, stdout, stderr }. */
export function runTests(files = listTestFiles(), { cwd = REPO, env = process.env } = {}) {
  return spawnSync(process.execPath, ['--test', '--experimental-test-coverage', ...files], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 128 * 1024 * 1024,
    env: childEnv(env),
  })
}

function parseArgs(argv) {
  const opts = { thresholds: { ...THRESHOLDS }, from: null, updateBaseline: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    const num = (v) => {
      const n = Number(v)
      if (!Number.isFinite(n)) {
        console.error(`✗ [coverage] nilai ambang tidak valid: ${v}`)
        process.exit(2)
      }
      return n
    }
    if (a.startsWith('--min-lines')) opts.thresholds.lines = num(a.split('=')[1] ?? argv[++i])
    else if (a.startsWith('--min-branches')) opts.thresholds.branches = num(a.split('=')[1] ?? argv[++i])
    else if (a.startsWith('--min-functions')) opts.thresholds.functions = num(a.split('=')[1] ?? argv[++i])
    else if (a.startsWith('--from')) opts.from = a.split('=')[1] ?? argv[++i]
    else if (a === '--update-baseline') opts.updateBaseline = true
    else {
      console.error(`✗ [coverage] argumen tidak dikenal: ${a}`)
      process.exit(2)
    }
  }
  return opts
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  let stdout = ''

  if (opts.from) {
    try {
      stdout = fs.readFileSync(opts.from, 'utf8')
    } catch (err) {
      console.error(`✗ [coverage] tidak bisa membaca ${opts.from}: ${err.message}`)
      process.exit(1)
    }
    console.log(`ℹ [coverage] menilai laporan tersimpan: ${opts.from}`)
  } else {
    const res = runTests()
    stdout = res.stdout ?? ''
    for (const line of coverageTable(stdout)) console.log(line)
    if (res.status !== 0) {
      const tail = String(stdout || res.stderr || '').split('\n').slice(-25).join('\n')
      console.error(`✗ [coverage] suite uji gagal (exit ${res.status}). Ekor keluaran:\n${tail}`)
      process.exit(1)
    }
  }

  const actual = parseCoverage(stdout)
  if (!actual) {
    console.error('✗ [coverage] baris ringkasan "all files" tidak ditemukan di keluaran (format Node berubah?)')
    process.exit(1)
  }

  const { ok, failures } = evaluate(actual, opts.thresholds)
  for (const { key, label } of METRICS) {
    const min = opts.thresholds[key]
    const pass = actual[key] >= (min ?? 0)
    console.log(`${pass ? '✓' : '✗'} [coverage] ${label}: ${actual[key].toFixed(2)} % (ambang ${min} %)`)
  }

  const baseline = readBaseline()
  for (const row of compareToBaseline(actual, baseline)) {
    const sign = row.delta > 0 ? '+' : ''
    console.log(`ℹ [coverage] tren vs baseline ${baseline.updated}: ${row.label} ${sign}${row.delta} pp`)
  }
  if (opts.updateBaseline) {
    const doc = writeBaseline({
      lines: actual.lines,
      branches: actual.branches,
      functions: actual.functions,
    })
    console.log(`✓ [coverage] baseline diperbarui (${doc.updated}) → ${path.relative(REPO, BASELINE_FILE)}`)
  }

  if (!ok) {
    for (const f of failures) console.error(`✗ [coverage] ${f.label} ${f.actual.toFixed(2)} % < ambang ${f.min} %`)
    console.error('✗ [coverage] cakupan di bawah ambang — tambah uji atau, bila penurunan memang disengaja, turunkan ambang di scripts/check-coverage.mjs')
    process.exit(1)
  }
  console.log(`✓ [coverage] semua metrik memenuhi ambang (${os.platform()} · node ${process.version})`)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
