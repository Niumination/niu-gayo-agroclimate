import test from 'node:test'
import assert from 'node:assert'
import { t, messages, LANGS } from '../src/i18n/messages.js'

test('i18n: kunci utama tersedia di kedua bahasa', () => {
  const keys = Object.keys(messages.id)
  assert.ok(keys.length > 20)
  for (const key of keys) {
    assert.ok(messages.gayo[key], `kunci ${key} hilang di gayo`)
  }
})

test('i18n: istilah kunci Gayo sesuai glosarium', () => {
  assert.strictEqual(messages.gayo.rain, 'Ren')
  assert.strictEqual(messages.gayo.high, 'Beh')
  assert.strictEqual(messages.gayo.safe, 'Aman')
})

test('i18n: fallback ke id-ID lalu ke kunci', () => {
  assert.strictEqual(t('gayo', 'rain'), 'Ren')
  assert.strictEqual(t('gayo', 'kunci_aneh'), 'kunci_aneh')
  assert.strictEqual(t('xx', 'airTemp'), 'Suhu Udara')
})

test('i18n: daftar bahasa berisi id dan gayo', () => {
  assert.deepStrictEqual(LANGS.map((l) => l.id).sort(), ['gayo', 'id'])
})
