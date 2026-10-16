#!/usr/bin/env node
/**
 * check-typography — gerbang tipografi (paket P3, tanpa browser).
 *
 * Aturan yang dijaga:
 *   1. Tidak ada ukuran teks arbitrer di bawah 16 px (`text-[11px]`, …).
 *   2. Tidak ada ukuran bawaan Tailwind yang kecil (`text-xs`, `text-sm`) —
 *      wajib memakai token skala: `text-caption` 12 · `text-body-sm`/`text-label` 14 · `text-body` 16.
 *   3. Kontrol formulir (`select`/`input`/`textarea`) tidak boleh memakai kelas < 16 px
 *      (input < 16 px memicu zoom otomatis di iOS dan menyusutkan sasaran sentuh).
 *   4. Tidak ada `truncate` pada teks — label Gayo/Indonesia 20–35 % lebih panjang,
 *      jadi teks harus membungkus, bukan dipotong (uji pemuaian 320 px).
 *   5. Font data ter-self-host: `public/fonts/*.woff2` wajib ada; bila `dist/` ada,
 *      `dist/fonts/*.woff2` juga wajib ada (bukti ikut terbangun).
 *
 * Pakai:
 *   node scripts/check-typography.mjs              # laporan + keluar 1 bila ada temuan
 *   node scripts/check-typography.mjs --json       # keluaran mesin
 *   node scripts/check-typography.mjs --dir src    # direktori sumber lain
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_SRC = path.join(__dirname, '..', 'src')
export const DEFAULT_FONT_DIR = path.join(__dirname, '..', 'public', 'fonts')
export const DEFAULT_DIST = path.join(__dirname, '..', 'dist')

/** Minimum ukuran teks arbitrer (px). */
export const MIN_ARBITRARY_PX = 16
/** Kelas ukuran bawaan Tailwind yang dianggap terlalu kecil. */
export const BANNED_BUILTINS = ['text-xs', 'text-sm']
/** Kelas yang tidak boleh dipakai kontrol formulir (harus >= 16 px). */
export const SMALL_CLASSES = ['text-caption', 'text-body-sm', 'text-label']
/** Nama token skala resmi (dipakai untuk laporan distribusi). */
export const SCALE = ['text-caption', 'text-label', 'text-body-sm', 'text-body']

/** Buang komentar blok & baris komentar penuh (tanpa mengganggu URL `https://`). */
export function stripComments(text) {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('{/*')
    })
    .join('\n')
}

/** Telusuri direktori sumber → [{ file, text }] untuk .js/.jsx. */
export function readSources(dir = DEFAULT_SRC) {
  const out = []
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(js|jsx)$/.test(e.name)) out.push({ file: path.relative(process.cwd(), p), text: fs.readFileSync(p, 'utf8') })
    }
  }
  walk(dir)
  return out
}

/** Ukuran teks arbitrer yang terlalu kecil + distribusi seluruh ukuran arbitrer. */
export function scanArbitrarySizes(sources) {
  const violations = []
  const all = []
  for (const { file, text } of sources) {
    const clean = stripComments(text)
    clean.split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/text-\[(\d+(?:\.\d+)?)(px|rem)\]/g)) {
        const value = Number(m[1])
        const px = m[2] === 'rem' ? value * 16 : value
        all.push({ file, line: i + 1, px, raw: m[0] })
        if (px < MIN_ARBITRARY_PX) violations.push({ file, line: i + 1, px, raw: m[0] })
      }
    })
  }
  return { violations, all }
}

/** Ukuran bawaan Tailwind yang terlalu kecil (`text-xs`, `text-sm`). */
export function scanBuiltinSizes(sources) {
  const violations = []
  for (const { file, text } of sources) {
    const clean = stripComments(text)
    clean.split('\n').forEach((line, i) => {
      for (const name of BANNED_BUILTINS) {
        const re = new RegExp(`\\b${name}\\b`, 'g')
        if (re.test(line)) violations.push({ file, line: i + 1, raw: name })
      }
    })
  }
  return violations
}

/** Kelas ukuran kecil pada kontrol formulir. */
export function scanFormControls(sources) {
  const violations = []
  for (const { file, text } of sources) {
    const clean = stripComments(text)
    for (const m of clean.matchAll(/<(select|input|textarea)\b[^>]*>/g)) {
      const tag = m[0]
      const small = SMALL_CLASSES.filter((c) => new RegExp(`\\b${c}\\b`).test(tag))
      if (small.length) {
        violations.push({
          file,
          line: clean.slice(0, m.index).split('\n').length,
          tag: m[1],
          classes: small,
        })
      }
    }
  }
  return violations
}

/** Pemakaian `truncate` (teks terpotong) — target: 0. */
export function scanTruncate(sources) {
  const violations = []
  for (const { file, text } of sources) {
    const clean = stripComments(text)
    clean.split('\n').forEach((line, i) => {
      if (/\btruncate\b/.test(line)) violations.push({ file, line: i + 1 })
    })
  }
  return violations
}

/** Distribusi kelas skala tipografi (laporan). */
export function scaleUsage(sources) {
  const counts = Object.fromEntries(SCALE.map((c) => [c, 0]))
  for (const { text } of sources) {
    const clean = stripComments(text)
    for (const cls of SCALE) {
      const re = new RegExp(`\\b${cls}\\b`, 'g')
      const m = clean.match(re)
      if (m) counts[cls] += m.length
    }
  }
  return counts
}

/** Berkas font di satu direktori (rekursif). */
export function fontFiles(dir) {
  const out = []
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(woff2|woff|ttf|otf)$/.test(e.name)) out.push({ name: path.relative(dir, p), bytes: fs.statSync(p).size })
    }
  }
  walk(dir)
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

/** Evaluasi lengkap: mengembalikan { failures, info }. */
export function evaluate({ srcDir = DEFAULT_SRC, fontDir = DEFAULT_FONT_DIR, distDir = DEFAULT_DIST } = {}) {
  const sources = readSources(srcDir)
  const arb = scanArbitrarySizes(sources)
  const builtins = scanBuiltinSizes(sources)
  const forms = scanFormControls(sources)
  const truncate = scanTruncate(sources)
  const counts = scaleUsage(sources)
  const fonts = fontFiles(fontDir)
  const distFonts = fontFiles(path.join(distDir, 'fonts'))
  const distExists = fs.existsSync(distDir)

  const failures = []
  for (const v of arb.violations) failures.push({ rule: 'arbitrary-too-small', ...v, message: `${v.file}:${v.line} ${v.raw} < ${MIN_ARBITRARY_PX} px` })
  for (const v of builtins) failures.push({ rule: 'builtin-too-small', ...v, message: `${v.file}:${v.line} ${v.raw} — pakai token skala` })
  for (const v of forms) failures.push({ rule: 'form-control-small', ...v, message: `${v.file}:${v.line} <${v.tag}> memakai ${v.classes.join(', ')}` })
  for (const v of truncate) failures.push({ rule: 'truncate', ...v, message: `${v.file}:${v.line} teks dipotong (truncate) — pakai break-words` })
  if (!fonts.length) failures.push({ rule: 'font-missing', message: `tidak ada berkas font di ${path.relative(process.cwd(), fontDir)}` })
  if (distExists && !distFonts.length) failures.push({ rule: 'font-not-built', message: 'dist/fonts tidak memuat berkas font — jalankan npm run build' })

  const info = {
    files: sources.length,
    arbitrary: arb.all.length,
    scale: counts,
    fonts,
    distFonts,
    fontBytes: fonts.reduce((a, f) => a + f.bytes, 0),
  }
  return { failures, info, sources }
}

function main(argv) {
  const args = argv.slice(2)
  const json = args.includes('--json')
  const dirIdx = args.indexOf('--dir')
  const srcDir = dirIdx !== -1 ? path.resolve(args[dirIdx + 1]) : DEFAULT_SRC
  const { failures, info } = evaluate({ srcDir })

  if (json) {
    console.log(JSON.stringify({ ok: failures.length === 0, failures, info }, null, 2))
    process.exit(failures.length ? 1 : 0)
  }
  console.log(`ℹ [tipografi] ${info.files} berkas sumber · ${info.arbitrary} ukuran arbitrer tersisa (semua >= ${MIN_ARBITRARY_PX} px)`)
  console.log(`   skala: ${SCALE.map((c) => `${c}×${info.scale[c]}`).join(' · ')}`)
  console.log(`   font self-host: ${info.fonts.map((f) => `${f.name} ${(f.bytes / 1024).toFixed(1)} kB`).join(' · ') || '—'} (total ${(info.fontBytes / 1024).toFixed(1)} kB)`)
  if (info.distFonts.length) console.log(`   terbangun di dist: ${info.distFonts.map((f) => f.name).join(', ')}`)
  if (failures.length) {
    console.error(`\n✗ [tipografi] ${failures.length} temuan:`)
    for (const f of failures.slice(0, 40)) console.error(`   · ${f.message}`)
    if (failures.length > 40) console.error(`   … dan ${failures.length - 40} temuan lain`)
    process.exit(1)
  }
  console.log('\nOK [tipografi] seluruh aturan terpenuhi')
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main(process.argv)
