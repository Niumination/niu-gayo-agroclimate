#!/usr/bin/env node
/**
 * check-coverage — gerbang cakupan uji (temuan audit F-10 → roadmap A-2).
 *
 * **Aturan sejak 2.3.4.** Gerbang ini dulu memakai satu angka global (baris ≥ 95 %).
 * Angka itu ditetapkan 2026-10-16 ketika aplikasi hanya punya logika domain; sejak
 * Living Map dan komponen NIU masuk, angka global bertahan ~90 % dan gerbangnya
 * **selalu merah** — dan karena berjalan sebelum build, langkah CI sesudahnya
 * (build, a11y, smoke, bundle) ikut terlewat. Gerbang yang selalu merah tidak menjaga
 * apa pun; ia hanya menyembunyikan kegagalan nyata.
 *
 * Sekarang yang dinilai adalah **modul yang menanggung risiko** — `server/` dan
 * `src/domain/` — dengan dua aturan yang bisa dipertanggungjawabkan:
 *
 *  1. **Lantai per berkas** di lingkup kritis (`SCOPE_FLOOR`). Daftar pengecualian
 *     (`SCOPE_ALLOW`) sengaja kecil, bertanggal, dan wajib menyusut: uji memastikan
 *     berkas yang cakupannya sudah naik harus dikeluarkan dari daftar.
 *  2. **Ratchet global** (`GLOBAL_DRIFT_MAX`): rata-rata seluruh berkas tidak boleh
 *     turun lebih dari 0,5 poin dari baseline terversi. Jadi cakupan boleh tersebar
 *     berbeda antar lapisan, tetapi tidak boleh menyusut diam-diam.
 *
 * Angka global tetap dicetak sebagai tren. Ambang global lama masih bisa dipakai
 * lewat `--min-lines/--min-branches/--min-functions` bila memang diinginkan.
 *
 * Pakai:
 *   node scripts/check-coverage.mjs                     # jalankan tes + nilai ambang
 *   node scripts/check-coverage.mjs --min-lines 96      # ambang kustom (persen)
 *   node scripts/check-coverage.mjs --from hasil.txt    # nilai laporan tersimpan (tanpa menjalankan tes)
 *   node scripts/check-coverage.mjs --update-baseline   # geser baseline tren (hanya bila lingkup kritis bersih)
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

/** Ambang global opsional (persen). Bukan gerbang bawaan sejak 2.3.4 — lihat kepala berkas. */
export const THRESHOLDS = { lines: 95, branches: 80, functions: 92 }

/**
 * Lingkup yang menanggung risiko: logika non-tampilan — server produksi, aturan
 * domain, dan utilitas `src/lib` — bukan komponen JSX (lapisan tampilan diuji
 * lewat uji DOM + audit a11y, bukan lantai cakupan baris).
 */
export const SCOPE_PREFIXES = ['server/', 'src/domain/', 'src/lib/']

/** Lantai cakupan baris per berkas di lingkup kritis (persen). */
export const SCOPE_FLOOR = 80

/** Toleransi penurunan rata-rata global terhadap baseline (poin persen). */
export const GLOBAL_DRIFT_MAX = 0.5

/**
 * Pengecualian lantai per berkas — harus bertanggal dan wajib menyusut.
 * Menambah entri ke sini adalah keputusan sadar, bukan cara cepat membuat CI hijau.
 */
export const SCOPE_ALLOW = {
  'server/routes.js':
    '2026-10-24 · router HTTP: 40+ cabang 4xx/5xx per rute; sisanya jalur galat yang hanya bisa ' +
    'dicapai dengan server rusak. Diuji lewat smoke + uji rute; target: naikkan, lalu hapus entri ini.',
}

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

/**
 * Baris per berkas dari tabel cakupan → `{ 'server/routes.js': { lines, branches, functions } }`.
 * Hanya metrik **baris** yang dipakai lantai lingkup: ia paling langsung dibaca manusia
 * ("berapa persen berkas ini dijalankan uji"), sedangkan cabang/fungsi tetap dilacak global.
 */
export function parseFileRows(stdout) {
  const rows = {}
  for (const line of String(stdout).split('\n')) {
    const m = /^#\s+(\S.*?)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|\s*([\d.]+)\s*\|/.exec(line)
    if (!m) continue
    const file = m[1].trim()
    if (file === 'all files' || file === 'file' || !file.includes('.')) continue
    const [lines, branches, functions] = [m[2], m[3], m[4]].map(Number)
    if (![lines, branches, functions].every(Number.isFinite)) continue
    rows[file] = { lines, branches, functions }
  }
  return rows
}

/** Berkas di lingkup kritis saja. */
export function scopeRows(rows, prefixes = SCOPE_PREFIXES) {
  return Object.entries(rows).filter(([file]) => prefixes.some((p) => file.startsWith(p)))
}

/**
 * Nilai lantai per berkas di lingkup kritis.
 * @returns {{ok: boolean, checked: number, failures: Array, allowed: Array, stale: string[]}}
 *   `stale` = berkas di daftar pengecualian yang cakupannya sudah ≥ lantai (harus dihapus).
 */
export function evaluateScope(rows, { floor = SCOPE_FLOOR, allow = SCOPE_ALLOW, prefixes = SCOPE_PREFIXES } = {}) {
  const failures = []
  const allowed = []
  const stale = []
  const dalam = scopeRows(rows, prefixes)
  for (const [file, nilai] of dalam) {
    const dibebaskan = Boolean(allow[file])
    if (nilai.lines < floor) {
      if (dibebaskan) allowed.push({ file, lines: nilai.lines })
      else failures.push({ file, lines: nilai.lines, min: floor })
    } else if (dibebaskan) {
      stale.push(file)
    }
  }
  return { ok: failures.length === 0, checked: dalam.length, failures, allowed, stale }
}

/**
 * Ratchet global: rata-rata seluruh berkas tidak boleh turun lebih dari `maxDrift`
 * poin dari baseline terversi. Baseline yang hilang bukan alasan gagal.
 */
export function evaluateDrift(actual, baseline, { maxDrift = GLOBAL_DRIFT_MAX } = {}) {
  if (!baseline) return { ok: true, rows: [], maxDrift }
  const rows = compareToBaseline(actual, baseline)
  const failures = rows.filter((r) => r.delta < -Math.abs(maxDrift))
  return { ok: failures.length === 0, rows, failures, maxDrift }
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

  // ── 1. Lingkup kritis: lantai per berkas ────────────────────────────────
  const rows = parseFileRows(stdout)
  const scope = evaluateScope(rows)
  console.log(
    `ℹ [coverage] lingkup kritis: ${scope.checked} berkas (${SCOPE_PREFIXES.join(', ')}) · lantai baris ${SCOPE_FLOOR} %`,
  )
  for (const a of scope.allowed) {
    console.log(`ℹ [coverage] dikecualikan (${a.file}): ${a.lines.toFixed(2)} % — ${SCOPE_ALLOW[a.file]}`)
  }
  for (const f of scope.failures) {
    console.error(`✗ [coverage] ${f.file}: ${f.lines.toFixed(2)} % < lantai ${f.min} % — tambah uji, atau daftarkan pengecualian bertanggal di SCOPE_ALLOW`)
  }
  for (const file of scope.stale) {
    console.error(`✗ [coverage] ${file} sudah ≥ lantai (${SCOPE_FLOOR} %) — hapus dari SCOPE_ALLOW agar gerbang benar-benar mengunci`)
  }
  if (scope.checked === 0) {
    console.error('✗ [coverage] tidak ada berkas lingkup kritis yang terbaca — tabel cakupan berubah format?')
  }

  // ── 2. Global: tren + ratchet terhadap baseline ─────────────────────────
  for (const { key, label } of METRICS) {
    console.log(`ℹ [coverage] global ${label}: ${actual[key].toFixed(2)} %`)
  }
  const baseline = readBaseline()
  const drift = evaluateDrift(actual, baseline)
  for (const row of drift.rows) {
    const sign = row.delta > 0 ? '+' : ''
    console.log(`ℹ [coverage] tren vs baseline ${baseline?.updated ?? '—'}: ${row.label} ${sign}${row.delta} pp`)
  }
  for (const f of drift.failures) {
    console.error(`✗ [coverage] global ${f.label} turun ${f.delta} pp dari baseline ${baseline.updated} (toleransi ${drift.maxDrift} pp)`)
  }

  // ── 3. Ambang global eksplisit (opsional, lewat --min-*) ────────────────
  const pakaiAmbangGlobal = process.argv.slice(2).some((a) => a.startsWith('--min-'))
  let ambangGlobal = { ok: true, failures: [] }
  if (pakaiAmbangGlobal) {
    ambangGlobal = evaluate(actual, opts.thresholds)
    for (const { key, label } of METRICS) {
      const min = opts.thresholds[key]
      const pass = actual[key] >= (min ?? 0)
      console.log(`${pass ? '✓' : '✗'} [coverage] ${label}: ${actual[key].toFixed(2)} % (ambang eksplisit ${min} %)`)
    }
  }

  const ok = scope.ok && drift.ok && ambangGlobal.ok && scope.stale.length === 0 && scope.checked > 0 && scope.failures.length === 0
  if (opts.updateBaseline) {
    // Baseline hanya boleh digeser saat lingkup kritis sudah bersih: `--update-baseline`
    // mereset ratchet, bukan izin menutupi berkas yang jatuh di bawah lantai.
    if (scope.ok && scope.stale.length === 0 && scope.checked > 0) {
      const doc = writeBaseline({
        lines: actual.lines,
        branches: actual.branches,
        functions: actual.functions,
      })
      console.log(`✓ [coverage] baseline diperbarui (${doc.updated}) → ${path.relative(REPO, BASELINE_FILE)}`)
    } else {
      console.error('✗ [coverage] baseline TIDAK diperbarui — bereskan lingkup kritis dulu (baris ✗ di atas)')
    }
  }

  if (!ok) {
    for (const f of ambangGlobal.failures) console.error(`✗ [coverage] ${f.label} ${f.actual.toFixed(2)} % < ambang ${f.min} %`)
    console.error('✗ [coverage] gerbang cakupan gagal — lihat baris ✗ di atas; menurunkan ambang bukan jalan keluar')
    process.exit(1)
  }
  console.log(
    `✓ [coverage] lingkup kritis bersih (${scope.checked} berkas, ${scope.allowed.length} pengecualian) · ` +
      `global dalam ratchet (${os.platform()} · node ${process.version})`,
  )
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
