#!/usr/bin/env node
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
const infoPath = path.join(dist, 'build-info.json')
assert.ok(existsSync(infoPath), 'dist/build-info.json tidak ada; jalankan npm run build')
const info = JSON.parse(readFileSync(infoPath, 'utf8'))
const git = (args) => {
  try { return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim() } catch { return null }
}
const head = process.env.NIU_BUILD_REVISION || git(['rev-parse', 'HEAD'])
const status = spawnSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' })
// Audit F-22b — di salinan tanpa .git (mis. hasil ekstrak ZIP untuk audit), git gagal dan
// skrip dulu berhenti dengan assertion mentah. Sekarang: lewati secara terkontrol + alasan jelas.
// `git status` di luar repo tidak menghasilkan status.error (spawn-nya sendiri berhasil),
// melainkan exit != 0. Dulu syaratnya hanya `status.error`, sehingga salinan ZIP tetap
// berhenti dengan assertion mentah. Sekarang keduanya dianggap "bukan repo Git".
const statusOk = !status.error && status.status === 0
if (!head || !statusOk) {
  console.log('[build-info] dilewati: bukan repo Git dan NIU_BUILD_REVISION tidak diset.')
  console.log('             Jalankan di clone Git, atau set NIU_BUILD_REVISION=<sha40> saat build.')
  process.exit(0)
}

assert.equal(info.app, 'Niu', 'build-info app bukan Niu')
assert.equal(info.version, pkg.version, `versi build ${info.version} tidak sama dengan package.json ${pkg.version}`)
assert.match(info.revision, /^[0-9a-f]{40}$/i, 'revision harus SHA Git lengkap 40 karakter')
assert.ok(!head || info.revision === head, `build dari ${info.revision}, HEAD sekarang ${head}`)
assert.ok(info.assets?.scripts?.length, 'daftar JS assets kosong')
assert.ok(info.assets?.styles?.length, 'daftar CSS assets kosong')
assert.ok(info.assets.scripts.every((p) => p.startsWith('/assets/')), 'asset JS harus berada di /assets/')
assert.ok(info.assets.styles.every((p) => p.startsWith('/assets/')), 'asset CSS harus berada di /assets/')
for (const asset of [...info.assets.scripts, ...info.assets.styles]) {
  assert.ok(existsSync(path.join(dist, asset.slice(1))), `asset build tidak ada: ${asset}`)
}
assert.ok(status.status === 0, 'git status gagal; jalankan dari clone Git')
assert.equal(info.dirty, status.stdout.trim().length > 0, 'status dirty pada build-info tidak cocok dengan working tree')
assert.equal(info.dirty, false, 'build dibuat dari working tree yang belum bersih; commit dulu lalu build ulang')
console.log(`[build-info] OK · ${info.version} · ${info.revision} · ${info.assets.scripts.length} JS + ${info.assets.styles.length} CSS`)
