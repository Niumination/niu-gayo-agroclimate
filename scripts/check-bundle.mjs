#!/usr/bin/env node
/**
 * Anggaran kinerja (ADR-25 / NFR): gagal bila JS utama di dist/ melebihi batas gzip.
 *   node scripts/check-bundle.mjs            # batas default 150 kB gzip untuk berkas JS terbesar, 200 kB total JS
 *   BUNDLE_MAX_KB=160 node scripts/check-bundle.mjs
 */
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'

const dist = path.resolve(process.cwd(), 'dist/assets')
const maxMain = Number(process.env.BUNDLE_MAX_KB || 150)
const maxTotal = Number(process.env.BUNDLE_TOTAL_MAX_KB || 200)
if (!fs.existsSync(dist)) {
  console.error(`check-bundle: ${dist} tidak ada — jalankan \`npm run build\` dulu`)
  process.exit(2)
}
const files = fs.readdirSync(dist).filter((f) => f.endsWith('.js'))
const rows = files.map((f) => {
  const buf = fs.readFileSync(path.join(dist, f))
  return { file: f, rawKb: buf.length / 1024, gzKb: zlib.gzipSync(buf, { level: 9 }).length / 1024 }
}).sort((a, b) => b.gzKb - a.gzKb)
let fail = false
for (const r of rows) console.log(`${r.file.padEnd(32)} ${r.rawKb.toFixed(1).padStart(8)} kB  gzip ${r.gzKb.toFixed(1).padStart(7)} kB`)
const total = rows.reduce((a, r) => a + r.gzKb, 0)
console.log(`total JS gzip ${total.toFixed(1)} kB (batas ${maxTotal} kB) · terbesar ${rows[0]?.gzKb.toFixed(1)} kB (batas ${maxMain} kB)`)
if (rows[0] && rows[0].gzKb > maxMain) { console.error(`✗ ${rows[0].file} melebihi ${maxMain} kB gzip`); fail = true }
if (total > maxTotal) { console.error(`✗ total JS melebihi ${maxTotal} kB gzip`); fail = true }
if (!fail) console.log('✓ anggaran bundle terpenuhi')
process.exit(fail ? 1 : 0)
