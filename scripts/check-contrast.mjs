#!/usr/bin/env node
/**
 * check-contrast — gerbang kontras warna & tipografi minimum untuk UI (fase design/UX).
 *
 * Latar: audit statis 26 komponen (docs/dev/11-RENCANA-DESIGN-UX.md) menemukan 11 pasangan
 * teks/latar di bawah 4,5:1 — hampir semuanya berasal dari utilitas opasitas (`text-ink/45`,
 * `dark:text-mist/40`) yang nilainya tidak pernah divalidasi. Sandbox CI tidak punya browser
 * (axe/Lighthouse tidak bisa jalan), jadi gerbang ini menghitung rasio kontras WCAG 2.2
 * langsung dari angka token — deterministik, cepat, tanpa dependensi.
 *
 * Tiga lapis pemeriksaan:
 *   1. KEBERADAAN token — memastikan token semantik wajib ada di `src/index.css` (@theme).
 *   2. PASANGAN PERAN — rasio terukur tiap pasangan (teks di permukaan, garis, lencana level,
 *      tombol, seri grafik) dinilai terhadap ambang WCAG (teks 4,5:1; non-teks 3:1).
 *   3. PINDAI SUMBER — menaksir warna efektif dari utilitas opasitas di `src/**` dan menandai
 *      pasangan yang gagal; sekaligus menghitung penggunaan teks < 16 px (kandidat P3).
 *
 * Mode bawaan bersifat INFORMATIF (selalu keluar 0) supaya CI tetap hijau selama paket P1–P4
 * belum diterapkan. Setelah perbaikan selesai, ubah langkah CI menjadi `--strict` agar
 * regresi kontras menggagalkan build (pola "ratchet" bertahap).
 *
 * Pakai:
 *   node scripts/check-contrast.mjs                 # ringkas: ringkasan + temuan
 *   node scripts/check-contrast.mjs --all           # cetak seluruh pasangan yang diuji
 *   node scripts/check-contrast.mjs --json          # keluaran mesin
 *   node scripts/check-contrast.mjs --strict        # keluar 1 bila ada temuan (untuk CI ketat)
 *   node scripts/check-contrast.mjs --css path.css  # uji CSS lain (mis. hasil eksperimen)
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.join(__dirname, '..')
export const DEFAULT_CSS = path.join(REPO, 'src', 'index.css')
export const DEFAULT_SRC = path.join(REPO, 'src')

/** Ambang WCAG 2.2 AA. */
export const MIN = { text: 4.5, textLarge: 3, nonText: 3 }

/* ------------------------------------------------------------------ warna */

/** Kanal 0–255 → linier (WCAG 2.x). */
export function lin(c) {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
}

/** '#rrggbb' → [r,g,b] (null bila bukan heks 6 digit). */
export function parseHex(hex) {
  if (typeof hex !== 'string') return null
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Luminansi relatif WCAG (0–1). */
export function luminance(hex) {
  const rgb = parseHex(hex)
  if (!rgb) throw new Error(`warna tidak dikenal: ${hex}`)
  const [r, g, b] = rgb.map(lin)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Rasio kontras WCAG (1–21), dibulatkan 2 desimal. */
export function contrast(a, b) {
  const la = luminance(a)
  const lb = luminance(b)
  const hi = Math.max(la, lb)
  const lo = Math.min(la, lb)
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100
}

/** Komposit warna `fg` beropasitas `alpha` (0–1) di atas `bg` — pengganti `color-mix` Tailwind 4. */
export function blend(fg, alpha, bg) {
  const f = parseHex(fg)
  const b = parseHex(bg)
  if (!f || !b) return null
  const mix = (i) => Math.round(f[i] * alpha + b[i] * (1 - alpha))
  return `#${[0, 1, 2].map((i) => mix(i).toString(16).padStart(2, '0')).join('')}`.toUpperCase()
}

/* ------------------------------------------------------------------ token */

/**
 * Ambil token `--color-*` dari CSS (@theme). Mengembalikan objek { namaToken: '#hex' }.
 * Nama Tailwind memakai tanda hubung; kunci di sini memakai tanda hubung juga agar
 * cocok dengan pemakaian di kelas utilitas (`text-ink-muted` → `ink-muted`).
 */
export function parseThemeTokens(cssText) {
  const tokens = {}
  const re = /--color-([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g
  let m
  while ((m = re.exec(cssText)) !== null) tokens[m[1]] = m[2].toUpperCase()
  return tokens
}

/** Token semantik wajib (paket P1). Bila hilang → dilaporkan sebagai "belum ada". */
export const REQUIRED_TOKENS = [
  'surface',
  'surface-raised',
  'surface-sunken',
  'ink',
  'ink-soft',
  'ink-body',
  'ink-muted',
  'ink-subtle',
  'mist',
  'mist-soft',
  'mist-body',
  'mist-muted',
  'mist-subtle',
  'soil-raised',
  'soil-sunken',
  'line-strong',
  'line-subtle',
  'line-strong-dark',
  'line-subtle-dark',
  'level-rendah',
  'level-waspada',
  'level-bahaya',
  'level-ekstrem',
  // Dua tangga arah (P7.1)
  'tanah-permukaan',
  'tanah-kartu',
  'tanah-terbenam',
  'tanah-tinta',
  'tanah-tinta-isi',
  'tanah-tinta-redup',
  'tanah-tinta-halus',
  'tanah-garis',
  'tanah-garis-kuat',
  'tanah-aksen',
  'tanah-aksen-tinta',
  'tanah-level-rendah',
  'tanah-level-waspada',
  'tanah-level-bahaya',
  'tanah-level-ekstrem',
  'tanah-level-rendah-tint',
  'tanah-level-waspada-tint',
  'tanah-level-bahaya-tint',
  'tanah-level-ekstrem-tint',
  'langit-malam',
  'langit-kartu',
  'langit-terbenam',
  'langit-tinta',
  'langit-tinta-isi',
  'langit-tinta-redup',
  'langit-tinta-halus',
  'langit-garis',
  'langit-garis-kuat',
  'langit-aksen',
  'langit-aksen-tinta',
  'langit-level-rendah',
  'langit-level-waspada',
  'langit-level-bahaya',
  'langit-level-ekstrem',
]

/**
 * Pasangan peran yang dinilai. `min` mengikuti WCAG 2.2 AA.
 * `why` hanya dokumentatif; nilai token sudah dipisah lewat penamaan ink- (terang) dan mist- (gelap).
 */
export const PAIRS = [
  // teks utama → permukaan (tema terang)
  { fg: 'ink', bg: 'surface', min: MIN.text, why: 'teks utama di permukaan' },
  { fg: 'ink', bg: 'surface-raised', min: MIN.text, why: 'teks utama di kartu' },
  { fg: 'ink-soft', bg: 'surface', min: MIN.text, why: 'teks isi sekunder' },
  { fg: 'ink-soft', bg: 'surface-raised', min: MIN.text, why: 'teks isi sekunder di kartu' },
  { fg: 'ink-muted', bg: 'surface', min: MIN.text, why: 'metadata / label' },
  { fg: 'ink-muted', bg: 'surface-raised', min: MIN.text, why: 'metadata di kartu' },
  { fg: 'ink-subtle', bg: 'surface-sunken', min: MIN.text, why: 'teks bantuan di area terbenam' },
  // teks utama → permukaan (tema gelap)
  { fg: 'mist', bg: 'soil', min: MIN.text, why: 'teks utama (gelap)' },
  { fg: 'mist-soft', bg: 'soil', min: MIN.text, why: 'teks isi sekunder (gelap)' },
  { fg: 'mist-muted', bg: 'soil', min: MIN.text, why: 'metadata (gelap)' },
  { fg: 'mist-muted', bg: 'soil-raised', min: MIN.text, why: 'metadata di kartu (gelap)' },
  { fg: 'mist-subtle', bg: 'soil-raised', min: MIN.text, why: 'label kecil di kartu (gelap)' },
  // garis & batas kontrol
  { fg: 'line-strong', bg: 'surface', min: MIN.nonText, why: 'garis batas kontrol' },
  { fg: 'line-strong-dark', bg: 'soil', min: MIN.nonText, why: 'garis batas kontrol (gelap)' },
  // lencana level bahaya (teks + tint latar)
  { fg: 'level-rendah', bg: 'level-rendah-tint', min: MIN.text, why: 'lencana rendah' },
  { fg: 'level-waspada', bg: 'level-waspada-tint', min: MIN.text, why: 'lencana waspada' },
  { fg: 'level-bahaya', bg: 'level-bahaya-tint', min: MIN.text, why: 'lencana bahaya' },
  { fg: 'level-ekstrem', bg: 'level-ekstrem-tint', min: MIN.text, why: 'lencana ekstrem' },
  // tombol & aksen
  { fg: 'on-accent', bg: 'leaf-deep', min: MIN.text, why: 'teks di tombol utama' },
  { fg: 'on-accent', bg: 'cherry', min: MIN.text, why: 'teks di tombol bahaya' },
  { fg: 'ink', bg: 'husk', min: MIN.text, why: 'teks di tombol peringatan' },
  // teks isi bertingkat (token jembatan 8:1 agar hierarki tidak rata)
  { fg: 'ink-body', bg: 'surface', min: MIN.text, why: 'teks isi (terang)' },
  { fg: 'ink-body', bg: 'surface-raised', min: MIN.text, why: 'teks isi di kartu (terang)' },
  { fg: 'ink-body', bg: 'surface-sunken', min: MIN.text, why: 'teks isi di area terbenam' },
  { fg: 'mist-body', bg: 'soil', min: MIN.text, why: 'teks isi (gelap)' },
  { fg: 'mist-body', bg: 'soil-raised', min: MIN.text, why: 'teks isi di kartu (gelap)' },
  { fg: 'mist-subtle', bg: 'soil', min: MIN.text, why: 'teks bantuan (gelap)' },
  // ramp level pada tema gelap (lencana di atas permukaan gelap)
  { fg: 'level-rendah-dark', bg: 'soil', min: MIN.text, why: 'lencana rendah (gelap)' },
  { fg: 'level-waspada-dark', bg: 'soil', min: MIN.text, why: 'lencana waspada (gelap)' },
  { fg: 'level-bahaya-dark', bg: 'soil', min: MIN.text, why: 'lencana bahaya (gelap)' },
  { fg: 'level-ekstrem-dark', bg: 'soil', min: MIN.text, why: 'lencana ekstrem (gelap)' },
  { fg: 'level-ekstrem-dark', bg: 'soil-raised', min: MIN.text, why: 'lencana ekstrem di kartu gelap' },
  // fokus terlihat (WCAG 2.4.11/2.4.13)
  { fg: 'leaf-deep', bg: 'surface', min: MIN.nonText, why: 'cincin fokus (terang)' },
  { fg: 'leaf-soft', bg: 'soil', min: MIN.nonText, why: 'cincin fokus (gelap)' },

  // === Dua tangga arah (P7.1, Round L) — Tanah (terang) & Langit (gelap) ===
  // Tangga TANAH: tinta di tiga permukaan
  { fg: 'tanah-tinta', bg: 'tanah-permukaan', min: MIN.text, why: 'tanah: tinta di kertas' },
  { fg: 'tanah-tinta', bg: 'tanah-kartu', min: MIN.text, why: 'tanah: tinta di kartu' },
  { fg: 'tanah-tinta', bg: 'tanah-terbenam', min: MIN.text, why: 'tanah: tinta di area terbenam' },
  { fg: 'tanah-tinta-isi', bg: 'tanah-permukaan', min: MIN.text, why: 'tanah: teks isi di kertas' },
  { fg: 'tanah-tinta-isi', bg: 'tanah-kartu', min: MIN.text, why: 'tanah: teks isi di kartu' },
  { fg: 'tanah-tinta-isi', bg: 'tanah-terbenam', min: MIN.text, why: 'tanah: teks isi di area terbenam' },
  { fg: 'tanah-tinta-redup', bg: 'tanah-permukaan', min: MIN.text, why: 'tanah: metadata di kertas' },
  { fg: 'tanah-tinta-redup', bg: 'tanah-kartu', min: MIN.text, why: 'tanah: metadata di kartu' },
  { fg: 'tanah-tinta-redup', bg: 'tanah-terbenam', min: MIN.text, why: 'tanah: metadata di area terbenam' },
  { fg: 'tanah-tinta-halus', bg: 'tanah-permukaan', min: MIN.text, why: 'tanah: teks bantuan di kertas' },
  { fg: 'tanah-tinta-halus', bg: 'tanah-kartu', min: MIN.text, why: 'tanah: teks bantuan di kartu' },
  { fg: 'tanah-tinta-halus', bg: 'tanah-terbenam', min: MIN.text, why: 'tanah: teks bantuan di area terbenam' },
  // Tangga LANGIT: tinta di tiga permukaan
  { fg: 'langit-tinta', bg: 'langit-malam', min: MIN.text, why: 'langit: tinta di malam' },
  { fg: 'langit-tinta', bg: 'langit-kartu', min: MIN.text, why: 'langit: tinta di kartu' },
  { fg: 'langit-tinta', bg: 'langit-terbenam', min: MIN.text, why: 'langit: tinta di area terbenam' },
  { fg: 'langit-tinta-isi', bg: 'langit-malam', min: MIN.text, why: 'langit: teks isi di malam' },
  { fg: 'langit-tinta-isi', bg: 'langit-kartu', min: MIN.text, why: 'langit: teks isi di kartu' },
  { fg: 'langit-tinta-isi', bg: 'langit-terbenam', min: MIN.text, why: 'langit: teks isi di area terbenam' },
  { fg: 'langit-tinta-redup', bg: 'langit-malam', min: MIN.text, why: 'langit: metadata di malam' },
  { fg: 'langit-tinta-redup', bg: 'langit-kartu', min: MIN.text, why: 'langit: metadata di kartu' },
  { fg: 'langit-tinta-redup', bg: 'langit-terbenam', min: MIN.text, why: 'langit: metadata di area terbenam' },
  { fg: 'langit-tinta-halus', bg: 'langit-malam', min: MIN.text, why: 'langit: teks bantuan di malam' },
  { fg: 'langit-tinta-halus', bg: 'langit-kartu', min: MIN.text, why: 'langit: teks bantuan di kartu' },
  { fg: 'langit-tinta-halus', bg: 'langit-terbenam', min: MIN.text, why: 'langit: teks bantuan di area terbenam' },
  // Garis batas kontrol di tiap tangga
  { fg: 'tanah-garis-kuat', bg: 'tanah-permukaan', min: MIN.nonText, why: 'tanah: batas kontrol di kertas' },
  { fg: 'tanah-garis-kuat', bg: 'tanah-kartu', min: MIN.nonText, why: 'tanah: batas kontrol di kartu' },
  { fg: 'langit-garis-kuat', bg: 'langit-malam', min: MIN.nonText, why: 'langit: batas kontrol di malam' },
  { fg: 'langit-garis-kuat', bg: 'langit-kartu', min: MIN.nonText, why: 'langit: batas kontrol di kartu' },
  // Tombol aksen per tangga
  { fg: 'tanah-aksen-tinta', bg: 'tanah-aksen', min: MIN.text, why: 'tanah: teks di tombol hutan' },
  { fg: 'langit-aksen-tinta', bg: 'langit-aksen', min: MIN.text, why: 'langit: teks di tombol bintang' },
  { fg: 'tanah-aksen', bg: 'tanah-permukaan', min: MIN.nonText, why: 'tanah: cincin fokus / ikon aksen' },
  { fg: 'langit-aksen', bg: 'langit-malam', min: MIN.nonText, why: 'langit: cincin fokus / ikon aksen' },
  // Level bahaya per tangga
  { fg: 'tanah-level-rendah', bg: 'tanah-level-rendah-tint', min: MIN.text, why: 'tanah: lencana rendah' },
  { fg: 'tanah-level-waspada', bg: 'tanah-level-waspada-tint', min: MIN.text, why: 'tanah: lencana waspada' },
  { fg: 'tanah-level-bahaya', bg: 'tanah-level-bahaya-tint', min: MIN.text, why: 'tanah: lencana bahaya' },
  { fg: 'tanah-level-ekstrem', bg: 'tanah-level-ekstrem-tint', min: MIN.text, why: 'tanah: lencana ekstrem' },
  { fg: 'langit-level-rendah', bg: 'langit-kartu', min: MIN.text, why: 'langit: lencana rendah' },
  { fg: 'langit-level-waspada', bg: 'langit-kartu', min: MIN.text, why: 'langit: lencana waspada' },
  { fg: 'langit-level-bahaya', bg: 'langit-kartu', min: MIN.text, why: 'langit: lencana bahaya' },
  { fg: 'langit-level-ekstrem', bg: 'langit-kartu', min: MIN.text, why: 'langit: lencana ekstrem' },
  { fg: 'langit-level-rendah', bg: 'langit-malam', min: MIN.text, why: 'langit: lencana rendah di malam' },
  { fg: 'langit-level-waspada', bg: 'langit-malam', min: MIN.text, why: 'langit: lencana waspada di malam' },
  { fg: 'langit-level-bahaya', bg: 'langit-malam', min: MIN.text, why: 'langit: lencana bahaya di malam' },
  { fg: 'langit-level-ekstrem', bg: 'langit-malam', min: MIN.text, why: 'langit: lencana ekstrem di malam' },
]

/* ------------------------------------------------------------------ pindai sumber */

/** Tangkap rantai modifier (`dark:`, `hover:`, `md:` …) + utilitas teks beropasitas. */
const TEXT_OPACITY_RE = /((?:[a-z0-9-]+:)*)text-(ink|mist)\/(\d{1,3})/g
const SMALL_TEXT_RE = /text-\[(\d{1,2})px\]/g

/** Buang komentar blok (CSS & JSX) supaya contoh anti-pola di dokumentasi tidak dihitung sebagai temuan. */
export function stripBlockComments(text) {
  return text.replace(/\/\*[\s\S]*?\*\//g, ' ')
}

/** Telusuri berkas sumber secara rekursif (lewati berkas uji & aset biner). */
export function walkSource(dir = DEFAULT_SRC) {
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
      else if (/\.(jsx?|css)$/.test(e.name)) out.push(p)
    }
  }
  walk(dir)
  return out.sort()
}

/**
 * Cari pemakaian teks beropasitas yang diperkirakan gagal kontras.
 * Warna efektif = komposit warna teks berapa pun opasitasnya di atas permukaan tema.
 */
export function scanOpacityText(files, tokens, { base = 'surface', baseDark = 'soil' } = {}) {
  const findings = []
  for (const file of files) {
    let text
    try {
      text = stripBlockComments(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    text.split('\n').forEach((line, i) => {
      TEXT_OPACITY_RE.lastIndex = 0
      let m
      while ((m = TEXT_OPACITY_RE.exec(line)) !== null) {
        const [, prefix, token, pct] = m
        const dark = prefix.includes('dark:')
        const fgBase = tokens[token]
        const bg = tokens[dark ? baseDark : base]
        if (!fgBase || !bg) continue
        const eff = blend(fgBase, Number(pct) / 100, bg)
        const ratio = contrast(eff, bg)
        if (ratio < MIN.text) {
          findings.push({
            kind: 'kontras',
            file: path.relative(REPO, file),
            line: i + 1,
            util: m[0],
            tema: dark ? 'gelap' : 'terang',
            effective: eff,
            ratio,
            min: MIN.text,
          })
        }
        // Token 'mist' dipakai tanpa prefix dark: → di tema terang hampir tak terbaca.
        if (!dark && token === 'mist') {
          const effLight = blend(fgBase, Number(pct) / 100, tokens[base])
          findings.push({
            kind: 'pasangan-tema',
            file: path.relative(REPO, file),
            line: i + 1,
            util: m[0],
            tema: 'terang',
            effective: effLight,
            ratio: contrast(effLight, tokens[base]),
            min: MIN.text,
          })
        }
      }
    })
  }
  return findings
}

/** Hitung pemakaian teks di bawah 16 px (tugas paket P3) sebagai informasi. */
export function countSmallText(files) {
  const buckets = {}
  for (const file of files) {
    let text
    try {
      text = stripBlockComments(fs.readFileSync(file, 'utf8'))
    } catch {
      continue
    }
    SMALL_TEXT_RE.lastIndex = 0
    let m
    while ((m = SMALL_TEXT_RE.exec(text)) !== null) {
      const px = Number(m[1])
      buckets[px] = (buckets[px] || 0) + 1
    }
  }
  return buckets
}

/* ------------------------------------------------------------------ penilaian */

/** Nilai daftar pasangan terhadap token yang tersedia. Mengembalikan { rows, missing, failures }. */
export function evaluatePairs(tokens, pairs = PAIRS) {
  const rows = []
  const missing = []
  const failures = []
  for (const pair of pairs) {
    const fg = tokens[pair.fg]
    const bg = tokens[pair.bg]
    if (!fg || !bg) {
      const absen = [!fg && pair.fg, !bg && pair.bg].filter(Boolean)
      missing.push({ ...pair, absen })
      continue
    }
    const ratio = contrast(fg, bg)
    const row = { ...pair, fgHex: fg, bgHex: bg, ratio, ok: ratio >= pair.min }
    rows.push(row)
    if (!row.ok) failures.push(row)
  }
  return { rows, missing, failures }
}

/* ------------------------------------------------------------------ CLI */

function fmtRatio(r) {
  return `${r.toFixed(2)}:1`
}

function main() {
  const args = process.argv.slice(2)
  const cssIdx = args.indexOf('--css')
  const cssPath = cssIdx >= 0 ? args[cssIdx + 1] : DEFAULT_CSS
  const dirIdx = args.indexOf('--dir')
  const srcDir = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_SRC
  const strict = args.includes('--strict')
  const json = args.includes('--json')
  const all = args.includes('--all')

  const cssText = fs.existsSync(cssPath) ? fs.readFileSync(cssPath, 'utf8') : ''
  const tokens = parseThemeTokens(cssText)
  const { rows, missing, failures } = evaluatePairs(tokens)
  const files = walkSource(srcDir)
  const opacityFindings = scanOpacityText(files, tokens)
  const smallText = countSmallText(files)
  const missingRequired = REQUIRED_TOKENS.filter((t) => !tokens[t])

  const report = {
    css: path.relative(REPO, cssPath),
    tokensTotal: Object.keys(tokens).length,
    pairsChecked: rows.length,
    pairsPassed: rows.filter((r) => r.ok).length,
    pairsFailed: failures.length,
    tokensMissing: missing.map((m) => m.absen).flat(),
    requiredMissing: missingRequired,
    opacityFindings: opacityFindings.length,
    smallText,
  }

  if (json) {
    console.log(JSON.stringify({ report, failures, missing: missing.map((m) => ({ pair: `${m.fg} di ${m.bg}`, absen: m.absen })), opacity: opacityFindings }, null, 2))
    process.exit(strict && (failures.length || opacityFindings.length) ? 1 : 0)
  }

  console.log(`ℹ [kontras] ${path.relative(REPO, cssPath)} — ${Object.keys(tokens).length} token warna terbaca`)
  console.log(`   pasangan diuji: ${rows.length} · lulus ${rows.filter((r) => r.ok).length} · gagal ${failures.length}${missing.length ? ` · belum dapat diuji ${missing.length}` : ''}`)

  if (failures.length) {
    console.log('\n✗ Pasangan di bawah ambang WCAG AA:')
    for (const f of failures) {
      console.log(`   ${fmtRatio(f.ratio).padStart(8)}  (min ${f.min})  ${f.fg} ${f.fgHex} di ${f.bg} ${f.bgHex} — ${f.why}`)
    }
  }
  if (missing.length) {
    console.log('\n⚠ Token belum ada (rencana paket P1 — lihat docs/reference/DESIGN-TOKENS.md):')
    for (const m of missing) console.log(`   ${m.fg} di ${m.bg} — kurang: ${m.absen.join(', ')}`)
  }
  if (missingRequired.length) {
    console.log(`\n⚠ ${missingRequired.length} token semantik wajib belum ada: ${missingRequired.join(', ')}`)
  }
  if (opacityFindings.length) {
    const perFile = new Map()
    for (const f of opacityFindings) perFile.set(f.file, (perFile.get(f.file) || 0) + 1)
    console.log(`\n✗ Utilitas teks beropasitas < ${MIN.text}:1 — ${opacityFindings.length} pemakaian di ${perFile.size} berkas:`)
    for (const [file, n] of [...perFile.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)) {
      const contoh = opacityFindings.find((f) => f.file === file)
      console.log(`   ${String(n).padStart(3)}×  ${file}  (mis. ${contoh.util} → ${contoh.effective} = ${fmtRatio(contoh.ratio)})`)
    }
  } else {
    console.log('\n✓ [kontras] tidak ada utilitas teks beropasitas di bawah ambang')
  }

  const small = Object.entries(smallText).sort((a, b) => b[1] - a[1])
  if (small.length) {
    console.log(`\nℹ Teks < 16 px (paket P3): ${small.map(([px, n]) => `${px}px×${n}`).join(' · ')}`)
  }

  if (all) {
    console.log('\nSeluruh pasangan yang diuji:')
    for (const r of rows) console.log(`   ${r.ok ? '✓' : '✗'} ${fmtRatio(r.ratio).padStart(8)} (min ${r.min}) ${r.fg} di ${r.bg} — ${r.why}`)
  }

  if (strict && (failures.length || opacityFindings.length)) {
    console.error('\n✗ [kontras] mode --strict: ada temuan kontras')
    process.exit(1)
  }
  console.log(`\nOK [kontras] selesai (mode ${strict ? 'ketat --strict' : 'informatif'})`)
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
