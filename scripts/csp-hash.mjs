#!/usr/bin/env node
/**
 * Audit F-22 — begitu CSP dipasang di host statis (F-11), skrip tema inline di `index.html`
 * akan diblokir kecuali hash-nya diizinkan. Skrip ini menghitung hash SRI (`sha256-…`)
 * untuk setiap blok <script> inline di `index.html`/`dist/index.html` dan mencetak header
 * `Content-Security-Policy` yang siap ditempel, tanpa `'unsafe-inline'`.
 *
 * Pemakaian:  node scripts/csp-hash.mjs [berkas.html]
 *             node scripts/csp-hash.mjs | head -3     # hanya daftar hash
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const target = process.argv[2] || (existsSync('dist/index.html') ? 'dist/index.html' : 'index.html')
const html = readFileSync(path.resolve(target), 'utf8')

const blok = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/gi)]
  .filter(([, attrs]) => !/type=["']application\/json["']/i.test(attrs))
  .map(([, , isi]) => isi)

if (!blok.length) {
  console.error(`Tidak ada <script> inline di ${target}`)
  process.exit(1)
}

const hashes = blok.map((isi) => `'sha256-${createHash('sha256').update(isi, 'utf8').digest('base64')}'`)

console.log(`# ${target}: ${blok.length} skrip inline`)
for (const h of hashes) console.log(h)
console.log('')
console.log('Content-Security-Policy:')
console.log(
  [
    "default-src 'self'",
    `script-src 'self' ${hashes.join(' ')}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self' https://api.open-meteo.com https://ensemble-api.open-meteo.com",
    "worker-src 'self'",
    "manifest-src 'self'",
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; '),
)
