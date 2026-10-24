/**
 * F-05 / F-16 (rencana audit Sprint B) — kesehatan sumber & alarm otomatis.
 *
 * Yang diuji perilakunya: modul murni `src/domain/sourceHealth.js` (tanpa jaringan)
 * dan blok `health` pada `/healthz` yang dipakai cron untuk memutuskan alarm.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assessSources,
  sourceSignature,
  shouldNotifySourceHealth,
  renderSourceHealth,
  STALE_HOURS,
} from '../src/domain/sourceHealth.js'
import { createHandler } from '../server/routes.js'

const NOW = new Date('2026-10-24T10:00:00.000Z')
const jamLalu = (n) => new Date(NOW.getTime() - n * 3_600_000).toISOString()

function fakeRes() {
  return {
    status: null, headers: null, body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(data) { this.body = data ?? ''; return this },
  }
}

test('assessSources: semua sehat → ok tanpa masalah', () => {
  const hasil = assessSources({ alerts: { state: 'ok', retrievedAt: jamLalu(1) }, imerg: { state: 'ok', imergCount: 15 } }, { now: NOW })
  assert.equal(hasil.ok, true)
  assert.deepEqual(hasil.problems, [])
  assert.equal(hasil.checkedAt, NOW.toISOString())
})

test('assessSources: sumber degraded dilaporkan dengan alasannya (kasus MAGMA F-16)', () => {
  const hasil = assessSources(
    { volcano: { state: 'degraded', error: 'HTTP 403 — MAGMA menolak host ini', retrievedAt: jamLalu(1) } },
    { now: NOW },
  )
  assert.equal(hasil.ok, false)
  assert.equal(hasil.problems.length, 1)
  assert.equal(hasil.problems[0].id, 'volcano')
  assert.match(hasil.problems[0].reason, /MAGMA menolak host ini/)
  assert.equal(hasil.problems[0].state, 'degraded')
})

test('assessSources: data lebih tua dari 6 jam dianggap masalah (kasus IMERG F-05)', () => {
  assert.equal(STALE_HOURS, 6)
  const hasil = assessSources({ imerg: { state: 'ok', retrievedAt: jamLalu(7.4) } }, { now: NOW })
  assert.equal(hasil.ok, false)
  assert.equal(hasil.problems[0].ageHours, 7.4)
  assert.match(hasil.problems[0].reason, /berumur 7 jam/)
})

test('assessSources: tepat 6 jam belum basi; 6,1 jam sudah', () => {
  assert.equal(assessSources({ x: { state: 'ok', retrievedAt: jamLalu(6) } }, { now: NOW }).ok, true)
  assert.equal(assessSources({ x: { state: 'ok', retrievedAt: jamLalu(6.1) } }, { now: NOW }).ok, false)
})

test('assessSources: belum dimuat dan tanggal rusak tetap jadi masalah yang bisa dibaca', () => {
  const belum = assessSources({ aq: { state: 'belum-dimuat' } }, { now: NOW })
  assert.equal(belum.ok, false)
  assert.match(belum.problems[0].reason, /belum pernah dimuat/)
  const rusak = assessSources({ aq: { state: 'ok', retrievedAt: 'bukan-tanggal' } }, { now: NOW })
  assert.equal(rusak.ok, true, 'tanggal rusak tidak boleh membuat alarm palsu')
})

test('sourceSignature: urutan kunci tidak mengubah tanda tangan', () => {
  const a = { problems: [{ id: 'b', state: 'degraded' }, { id: 'a', state: 'belum-dimuat' }] }
  const b = { problems: [{ id: 'a', state: 'belum-dimuat' }, { id: 'b', state: 'degraded' }] }
  assert.equal(sourceSignature(a), 'a:belum-dimuat|b:degraded')
  assert.equal(sourceSignature(a), sourceSignature(b))
  assert.equal(sourceSignature({ problems: [] }), '')
})

test('shouldNotifySourceHealth: kirim saat masalah berubah, tahan saat sama', () => {
  const sig = 'imerg:degraded'
  assert.equal(shouldNotifySourceHealth(null, sig, { now: NOW }), true, 'pertama kali harus kirim')
  const baru = { signature: sig, at: jamLalu(1) }
  assert.equal(shouldNotifySourceHealth(baru, sig, { now: NOW }), false, 'masa tenang 6 jam menahan')
  assert.equal(shouldNotifySourceHealth(baru, 'imerg:degraded|volcano:degraded', { now: NOW }), true, 'tanda tangan baru langsung kirim')
  const lama = { signature: sig, at: jamLalu(6) }
  assert.equal(shouldNotifySourceHealth(lama, sig, { now: NOW }), true, 'lewat 6 jam kirim ulang')
  assert.equal(shouldNotifySourceHealth(baru, '', { now: NOW }), false, 'tanpa masalah tidak ada alarm')
})

test('renderSourceHealth: satu paragraf berisi semua sumber bermasalah', () => {
  const health = assessSources(
    {
      imerg: { state: 'degraded', error: 'semua sentra memakai fallback model ECMWF' },
      volcano: { state: 'degraded', error: 'HTTP 403' },
    },
    { now: NOW },
  )
  const teks = renderSourceHealth(health, { url: 'https://contoh/healthz' })
  assert.match(teks, /2 sumber data bermasalah/)
  assert.match(teks, /• imerg \(degraded\)/)
  assert.match(teks, /• volcano \(degraded\)/)
  assert.match(teks, /Status: https:\/\/contoh\/healthz/)
  assert.equal(renderSourceHealth({ ok: true, problems: [] }), '', 'tanpa masalah tidak ada teks')
})

test('/healthz menyertakan blok health yang menghitung masalah sumber', async () => {
  const handler = createHandler({
    PKG_VERSION: '2.3.1',
    BUILD_INFO: {},
    cacheStats: () => ({ entries: 1, fresh: 0 }),
    peek: (key) =>
      key === 'volcano:status'
        ? { fresh: false, value: { degraded: true, error: 'HTTP 403 — MAGMA menolak host ini', retrievedAt: new Date().toISOString() } }
        : null,
    HAZARDS_ON: [],
    FIRMS_MAP_KEY: '',
    readToken: () => null,
  })
  const res = fakeRes()
  await handler({ url: '/healthz', method: 'GET', headers: { host: 'localhost' } }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 200)
  assert.equal(body.health.ok, false)
  const volcano = body.health.problems.find((p) => p.id === 'volcano')
  assert.ok(volcano, 'volcano harus masuk daftar masalah')
  assert.match(volcano.reason, /MAGMA menolak host ini/)
  assert.equal(body.sources.volcano.state, 'degraded', 'blok sources lama tetap ada')
})
