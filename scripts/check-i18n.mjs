#!/usr/bin/env node
/**
 * check-i18n — gerbang Round L: Bahasa Gayo dihapus total dari src/.
 *
 * Memeriksa dua hal:
 *   1. tidak ada penanda placeholder lama "[?]" (sisa kebiasaan terjemahan Gayo),
 *   2. tidak ada kunci/data bahasa Gayo: `gayo:`, `gay:`, atau `"gay":`.
 *
 * Keluar 1 bila ada temuan — gerbang ini harus tetap hijau.
 *
 * Pakai: node scripts/check-i18n.mjs [--dir src]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DIR = path.join(__dirname, '..', 'src')
export const PLACEHOLDER = '[?]'
export const GAYO_PATTERNS = [/\bgayo\s*:/, /\bgay\s*:/, /"gay"\s*:/]

/** Hitung placeholder pada satu isi berkas. */
export function countPlaceholders(text, marker = PLACEHOLDER) {
  let n = 0
  for (const line of text.split('\n')) {
    let i = line.indexOf(marker)
    while (i !== -1) {
      n++
      i = line.indexOf(marker, i + marker.length)
    }
  }
  return n
}

/** Telusuri direktori, kembalikan [{ file, line, text, kind }] untuk tiap temuan. Aman bila direktori tidak ada. */
export function scanDir(dir = DEFAULT_DIR, marker = PLACEHOLDER) {
  const hits = []
  const walk = (d) => {
    let entries
    try {
      entries = fs.readdirSync(d, { withFileTypes: true })
    } catch {
      return // direktori tidak ada / tidak terbaca → anggap kosong
    }
    for (const entry of entries) {
      const p = path.join(d, entry.name)
      if (entry.isDirectory()) walk(p)
      else if (/\.(js|jsx|json|mjs)$/.test(entry.name)) {
        const rel = path.relative(process.cwd(), p)
        let text
        try {
          text = fs.readFileSync(p, 'utf8')
        } catch {
          continue
        }
        text.split('\n').forEach((line, idx) => {
          if (line.includes(marker)) hits.push({ file: rel, line: idx + 1, text: line.trim(), kind: 'placeholder' })
          else if (GAYO_PATTERNS.some((re) => re.test(line)))
            hits.push({ file: rel, line: idx + 1, text: line.trim(), kind: 'kunci-gayo' })
        })
      }
    }
  }
  walk(dir)
  return hits
}

function main() {
  const args = process.argv.slice(2)
  const dirIdx = args.indexOf('--dir')
  const dir = dirIdx >= 0 ? args[dirIdx + 1] : DEFAULT_DIR
  const hits = scanDir(dir)
  if (!hits.length) {
    console.log('✓ [i18n] tidak ada sisa Bahasa Gayo (placeholder maupun kunci data)')
    process.exit(0)
  }
  console.error(`✗ [i18n] ${hits.length} baris masih memuat sisa Bahasa Gayo:`)
  for (const h of hits) console.error(`   ${h.file}:${h.line}  [${h.kind}]  ${h.text.slice(0, 100)}`)
  process.exit(1)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
