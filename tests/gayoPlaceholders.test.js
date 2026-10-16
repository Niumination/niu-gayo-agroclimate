/**
 * check-i18n — uji inventaris placeholder Gayo (scripts/check-i18n.mjs).
 * Menutup temuan audit F-16 pada sisi keterlacakan: placeholder harus selalu terhitung.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { countPlaceholders, scanDir } from '../scripts/check-i18n.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test('countPlaceholders: menghitung kemunculan (termasuk ganda dalam satu baris)', () => {
  assert.equal(countPlaceholders("label: { gayo: 'Lindu [?]' }"), 1)
  assert.equal(countPlaceholders('a [?] b [?] c'), 2)
  assert.equal(countPlaceholders('tanpa penanda'), 0)
})

test('scanDir: menemukan placeholder nyata di src/ dan melaporkan berkas+baris', () => {
  const hits = scanDir(path.join(__dirname, '..', 'src'))
  assert.ok(hits.length > 0, 'harus ada placeholder Gayo sampai H-4 selesai')
  for (const h of hits) {
    assert.ok(h.file.startsWith('src'), `berkas di luar src: ${h.file}`)
    assert.ok(h.line >= 1)
  }
})

test('scanDir: direktori kosong → daftar kosong (bukan lempar)', () => {
  const hits = scanDir(path.join(__dirname, 'fixtures', 'tidak-ada'), '[?]')
  assert.deepEqual(hits, [])
})
