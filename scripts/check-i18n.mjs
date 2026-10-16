#!/usr/bin/env node
/**
 * check-i18n — inventaris placeholder terjemahan Gayo (temuan audit F-16 / tugas manusia H-4).
 *
 * Label Gayo yang belum ditinjau penutur asli ditandai literal "[?]". Skrip ini:
 *   - menghitung & menampilkan seluruh placeholder (berkas:baris),
 *   - keluar 0 secara bawaan (informatif; menjaga CI tetap hijau sampai H-4 selesai),
 *   - dengan --strict: keluar 1 bila masih ada placeholder (untuk dipakai setelah H-4).
 *
 * Pakai: node scripts/check-i18n.mjs [--strict] [--dir src]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DIR = path.join(__dirname, '..', 'src')
export const PLACEHOLDER = '[?]'

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

/** Telusuri direktori secara rekursif, kembalikan [{ file, line, text }] untuk tiap placeholder. Aman bila direktori tidak ada. */
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
          if (line.includes(marker)) hits.push({ file: rel, line: idx + 1, text: line.trim() })
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
  const strict = args.includes('--strict')

  const hits = scanDir(dir)
  const total = hits.reduce((n, h) => n + countPlaceholders(h.text), 0)
  if (!hits.length) {
    console.log('✓ [i18n] tidak ada placeholder Gayo — seluruh label sudah ditinjau')
    process.exit(0)
  }
  console.log(`ℹ [i18n] ${total} placeholder Gayo "[?]" pada ${hits.length} baris (tugas manusia H-4 — tinjau bersama penutur asli):`)
  for (const h of hits) console.log(`   ${h.file}:${h.line}  ${h.text.slice(0, 100)}`)
  if (strict) {
    console.error('✗ [i18n] mode --strict: placeholder masih tersisa')
    process.exit(1)
  }
  process.exit(0)
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
