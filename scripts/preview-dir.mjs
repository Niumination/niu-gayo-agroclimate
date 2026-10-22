#!/usr/bin/env node
/**
 * Siapkan direktori pratinjau statis dari dist/ tanpa service worker.
 * SW harus dilucuti agar preview tidak menyajikan bundel basi; ini hanya
 * menyentuh salinan di direktori keluaran, bukan dist/ resmi maupun repo.
 */
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const src = process.argv[2] || 'dist'
const out = process.argv[3] || '/tmp/niu-preview'
rmSync(out, { recursive: true, force: true })
cpSync(src, out, { recursive: true })
const index = join(out, 'index.html')
writeFileSync(index, readFileSync(index, 'utf8').replace(/<script[^>]*register-sw[^>]*><\/script>/g, ''))
for (const name of readdirSync(out)) {
  if (name === 'registerSW.js' || name === 'sw.js' || name.startsWith('workbox-')) rmSync(join(out, name), { force: true })
}
console.log(`[preview-dir] ${out} siap (tanpa service worker)`)
