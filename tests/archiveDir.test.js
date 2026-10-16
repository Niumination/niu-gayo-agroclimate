/**
 * hazards — uji implementasi HAZARD_ARCHIVE_DIR (audit F-18):
 * variabel lingkungan harus benar-benar mengarahkan direktori arsip bahaya.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

function dirWithEnv(env) {
  const out = execFileSync(process.execPath, ['--input-type=module', '-e',
    "import('./server/hazards.js').then((m) => console.log(m.DEFAULT_ARCHIVE_DIR))",
  ], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' })
  return out.trim()
}

test('HAZARD_ARCHIVE_DIR kosong → default server/data/hazard-archive', () => {
  const d = dirWithEnv({ HAZARD_ARCHIVE_DIR: '' })
  assert.equal(d, path.join(root, 'server', 'data', 'hazard-archive'))
})

test('HAZARD_ARCHIVE_DIR relatif → diresolusi dari akar kerja', () => {
  const d = dirWithEnv({ HAZARD_ARCHIVE_DIR: 'data/arsip-uji' })
  assert.equal(d, path.join(root, 'data', 'arsip-uji'))
})

test('HAZARD_ARCHIVE_DIR absolut → dipakai apa adanya', () => {
  const d = dirWithEnv({ HAZARD_ARCHIVE_DIR: '/var/lib/agroclimate-arsip' })
  assert.equal(d, '/var/lib/agroclimate-arsip')
})
