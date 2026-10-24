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
import { createImergProbe } from '../server/imergProbe.js'

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

test('assessSources: sumber lazy yang belum dimuat bukan masalah (alarm palsu 2.3.2)', () => {
  // Di produksi 2.3.2 /healthz menyatakan ok:false dengan lima sumber "belum pernah dimuat"
  // padahal semuanya dimuat saat diminta (alerts, imerg, aq, fire, petabencana).
  const hasil = assessSources(
    { alerts: { state: 'belum-dimuat' }, airQuality: { state: 'belum-dimuat' }, fireDanger: { state: 'belum-dimuat' } },
    { now: NOW, uptimeSec: 7200 },
  )
  assert.equal(hasil.ok, true, 'sumber lazy tidak boleh membuat alarm')
  assert.deepEqual(hasil.problems, [])
  assert.deepEqual(hasil.idle.map((x) => x.id), ['alerts', 'airQuality', 'fireDanger'])
})

test('assessSources: sumber INTI yang belum dimuat jadi masalah sesudah masa pemanasan', () => {
  const sebelum = assessSources({ imerg: { state: 'belum-dimuat' } }, { now: NOW, uptimeSec: 120 })
  assert.equal(sebelum.ok, true, '5 menit setelah start masih memanaskan')
  assert.deepEqual(sebelum.idle.map((x) => x.id), ['imerg'])
  const sesudah = assessSources({ imerg: { state: 'belum-dimuat' } }, { now: NOW, uptimeSec: 15 * 60 })
  assert.equal(sesudah.ok, false)
  assert.match(sesudah.problems[0].reason, /belum pernah dimuat setelah/)
})

test('assessSources: tanggal rusak tidak membuat alarm palsu', () => {
  const rusak = assessSources({ aq: { state: 'ok', retrievedAt: 'bukan-tanggal' } }, { now: NOW })
  assert.equal(rusak.ok, true)
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
  assert.ok(Array.isArray(body.health.idle), 'sumber lazy dicatat terpisah, bukan sebagai masalah')
})

test('/healthz: status IMERG memakai probe bila alerts:all belum pernah diisi (F-05 2.3.3)', async () => {
  // Regresi: UI tidak memanggil /api/alerts dan cron memakai /api/alerts/run, jadi
  // alerts:all selalu kosong di produksi dan F-05 dulu tidak akan pernah berbunyi.
  let tick = 0
  const handler = createHandler({
    PKG_VERSION: '2.3.3',
    BUILD_INFO: {},
    cacheStats: () => ({ entries: 0, fresh: 0 }),
    peek: () => null,
    HAZARDS_ON: [],
    FIRMS_MAP_KEY: '',
    readToken: () => null,
    imergProbe: { tick: () => { tick += 1; return { state: 'degraded', source: 'probe', error: 'GES DISC tidak terjangkau', retrievedAt: new Date().toISOString() } } },
  })
  const res = fakeRes()
  await handler({ url: '/healthz', method: 'GET', headers: { host: 'localhost' } }, res)
  const body = JSON.parse(res.body)
  assert.equal(tick, 1, 'probe dijalankan sekali saat /healthz dibaca')
  assert.equal(body.sources.imerg.state, 'degraded')
  assert.match(body.sources.imerg.error, /GES DISC/)
  assert.ok(body.health.problems.some((p) => p.id === 'imerg'), 'IMERG masuk daftar masalah')
})

test('createImergProbe: hasil disimpan, interval dihormati, kegagalan jadi degraded', async () => {
  let jam = 0
  const probe = createImergProbe({
    location: { id: 'bebesan', lat: 4.62, lon: 96.85 },
    intervalMs: 1000,
    now: () => jam,
    fetchAri: async () => ({ ari7d: 88.44 }),
  })
  assert.equal(probe.peek(), null)
  assert.equal(probe.tick(), null, 'tick pertama langsung jalan di latar')
  await new Promise((r) => setImmediate(r))
  assert.equal(probe.peek().state, 'ok')
  assert.equal(probe.peek().ari7d, 88.4, 'ari7d dibulatkan satu desimal')
  const sebelum = probe.peek()
  jam = 500
  assert.equal(probe.tick(), sebelum, 'belum lewat interval → tidak menyentuh jaringan')
  jam = 2000
  const gagal = createImergProbe({
    location: { id: 'bebesan', lat: 4.62, lon: 96.85 },
    now: () => jam,
    fetchAri: async () => { throw new Error('IMERG dialihkan ke login Earthdata (HTTP 302)') },
  })
  gagal.tick()
  await new Promise((r) => setImmediate(r))
  assert.equal(gagal.peek().state, 'degraded')
  assert.match(gagal.peek().error, /login Earthdata/)
})
