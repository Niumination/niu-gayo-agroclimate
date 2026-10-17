import test from 'node:test'
import assert from 'node:assert'
import { t, messages, LANGS } from '../src/i18n/messages.js'

test('i18n: hanya Bahasa Indonesia (Round L)', () => {
  assert.deepStrictEqual(Object.keys(messages), ['id'])
  assert.deepStrictEqual(LANGS.map((l) => l.id), ['id'])
})

test('i18n: kunci utama tersedia', () => {
  const keys = Object.keys(messages.id)
  assert.ok(keys.length > 20)
  for (const key of keys) assert.equal(typeof messages.id[key], 'string', `kunci ${key} bukan string`)
})

test('i18n: tak ada sisa istilah Gayo / penanda [?]', () => {
  const all = JSON.stringify(messages)
  assert.equal(/\[\?\]/.test(all), false, 'masih ada placeholder [?]')
  for (const kata of ['Ren', 'Beh', 'Mukim', 'Sinebar']) {
    assert.equal(all.includes(`"${kata}"`), false, `sisa istilah Gayo: ${kata}`)
  }
})

test('i18n: fallback ke id-ID lalu ke kunci', () => {
  assert.strictEqual(t('id', 'rain'), 'Hujan')
  assert.strictEqual(t('xx', 'airTemp'), 'Suhu udara')
  assert.strictEqual(t('id', 'kunci_aneh'), 'kunci_aneh')
})
