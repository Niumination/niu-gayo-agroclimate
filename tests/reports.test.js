import test from 'node:test'
import assert from 'node:assert'
import { validateReport, rateLimited, recentReports } from '../server/reports.js'

test('validateReport: tipe & lokasi valid', () => {
  assert.ok(validateReport({ location: 'takengon', type: 'longsor', note: 'tes' }).report)
  assert.ok(validateReport({ location: 'celala', type: 'karat' }).report)
  assert.ok(validateReport({ location: 'x', type: 'longsor' }).error)
  assert.ok(validateReport({ location: 'takengon', type: 'gempa' }).error)
  assert.ok(validateReport(null).error)
})
test('validateReport: note dibatasi 500 char', () => {
  const r = validateReport({ location: 'bies', type: 'banjir', note: 'a'.repeat(900) }).report
  assert.strictEqual(r.note.length, 500)
})
test('rateLimited: 5/jam per ip', () => {
  const ip = `10.0.0.${Math.floor(Math.random() * 200)}`
  for (let i = 0; i < 5; i++) assert.strictEqual(rateLimited(ip), false)
  assert.strictEqual(rateLimited(ip), true)
})
test('recentReports: filter lokasi', () => {
  assert.ok(Array.isArray(recentReports('takengon')))
  assert.ok(Array.isArray(recentReports()))
})

// v2 Fase 1 (FR-ASAP-6) — tipe laporan asap & kebakaran
import { reportDetail, VISIBILITY_SCALE } from '../server/reports.js'
test('validateReport: asap wajib skala jarak pandang; smell boolean', () => {
  assert.ok(validateReport({ location: 'takengon', type: 'asap' }).error)
  assert.ok(validateReport({ location: 'takengon', type: 'asap', visibility: '10km' }).error)
  const r = validateReport({ location: 'takengon', type: 'asap', visibility: '<1km', smell: 'ya', note: 'pekat' }).report
  assert.deepStrictEqual(r, { location: 'takengon', type: 'asap', note: 'pekat', visibility: '<1km', smell: true })
  assert.strictEqual(VISIBILITY_SCALE.size, 3)
})
test('validateReport: kebakaran dengan flag api aktif opsional; tipe lama tanpa field tambahan', () => {
  assert.deepStrictEqual(validateReport({ location: 'ketol', type: 'kebakaran', active: true }).report, { location: 'ketol', type: 'kebakaran', note: '', active: true })
  assert.strictEqual(validateReport({ location: 'ketol', type: 'kebakaran' }).report.active, null)
  const old = validateReport({ location: 'ketol', type: 'longsor', visibility: '<1km' }).report
  assert.strictEqual(old.visibility, undefined)
})
test('reportDetail: baris relay untuk asap/kebakaran', () => {
  assert.match(reportDetail({ type: 'asap', visibility: '<1km', smell: true }), /< 1 km.*bau asap/)
  assert.match(reportDetail({ type: 'kebakaran', active: false }), /padam/)
  assert.strictEqual(reportDetail({ type: 'longsor' }), '')
})

// Sprint 3 (FR-X-5) — tipe `badai` (wajib sub-jenis) & `kekeringan` (tanda opsional)
test('validateReport: badai wajib kind; kekeringan menyaring tanda tak dikenal; detail relay', () => {
  assert.ok(validateReport({ location: 'bintang', type: 'badai' }).error)
  assert.ok(validateReport({ location: 'bintang', type: 'badai', kind: 'tornado' }).error)
  const b = validateReport({ location: 'bintang', type: 'badai', kind: 'hujan_es', note: 'sebesar kelereng' })
  assert.equal(b.report.kind, 'hujan_es')
  assert.match(reportDetail(b.report), /hujan es/)
  const k = validateReport({ location: 'linge', type: 'kekeringan', signs: ['sumur_kering', 'xyz', 'daun_layu'] })
  assert.deepEqual(k.report.signs, ['sumur_kering', 'daun_layu'])
  assert.match(reportDetail(k.report), /sumur\/mata air mengering, daun kopi layu/)
  const k2 = validateReport({ location: 'linge', type: 'kekeringan' })
  assert.deepEqual(k2.report.signs, [])
  assert.equal(reportDetail(k2.report), '')
  assert.match(validateReport({ location: 'linge', type: 'tsunami' }).error, /kekeringan, badai/)
  // Fase 2.1 FR-GEMPA-5: laporan gempa dirasakan wajib kind lemah|sedang|kuat
  assert.match(validateReport({ location: 'linge', type: 'gempa' }).error, /lemah \| sedang \| kuat/)
  assert.equal(validateReport({ location: 'linge', type: 'gempa', kind: 'sedang' }).report.kind, 'sedang')
  assert.match(reportDetail({ type: 'gempa', kind: 'kuat' }), /Dirasakan: getaran kuat/)
})

// ── Sprint B · F-34/F-35/F-36 (audit 23 Okt 2026) ──────────────────────────────────────────
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {
  pruneReports, writeJsonAtomic, clientIp, rateLimitStoreSize,
  MAX_REPORTS, RETENTION_DAYS, MAX_RATE_KEYS,
} from '../server/reports.js'

const HARI = 24 * 60 * 60 * 1000

test('F-35 pruneReports: buang entri > 30 hari & entri tanpa waktu valid', () => {
  const now = Date.parse('2026-10-23T00:00:00.000Z')
  const list = [
    { timestamp: new Date(now - (RETENTION_DAYS + 1) * HARI).toISOString(), note: 'basi' },
    { timestamp: new Date(now - 2 * HARI).toISOString(), note: 'segar' },
    { timestamp: 'bukan-tanggal', note: 'rusak' },
    { note: 'tanpa timestamp' },
  ]
  const kept = pruneReports(list, now)
  assert.deepEqual(kept.map((r) => r.note), ['segar'])
})

test('F-35 pruneReports: jumlah dibatasi, entri terbaru yang bertahan', () => {
  const now = Date.parse('2026-10-23T00:00:00.000Z')
  const list = Array.from({ length: MAX_REPORTS + 7 }, (_, i) => ({ timestamp: new Date(now - i * 60_000).toISOString(), i }))
  const kept = pruneReports(list, now)
  assert.equal(kept.length, MAX_REPORTS)
  assert.equal(kept[kept.length - 1].i, MAX_REPORTS + 6, 'entri terbaru harus ikut tersimpan')
})

test('F-34 writeJsonAtomic: JSON valid, tanpa berkas .tmp tertinggal', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niu-reports-'))
  const file = path.join(dir, 'reports.json')
  try {
    writeJsonAtomic(file, [{ a: 1 }])
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ a: 1 }])
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('F-34 writeJsonAtomic: gagal di tengah jalan tidak merusak berkas lama', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'niu-reports-'))
  const file = path.join(dir, 'reports.json')
  try {
    fs.writeFileSync(file, '[{"lama":true}]')
    const melingkar = {}
    melingkar.self = melingkar // JSON.stringify melempar sebelum I/O apa pun
    assert.throws(() => writeJsonAtomic(file, melingkar))
    assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), [{ lama: true }])
    assert.deepEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.tmp')), [])
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('F-36 clientIp: cf-connecting-ip menang; XFF klien diabaikan', () => {
  const dasar = { socket: { remoteAddress: '10.0.0.9' } }
  assert.equal(clientIp({ ...dasar, headers: { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '9.9.9.9' } }), '203.0.113.7')
  // Nilai header buatan klien tidak boleh menjadi kunci: jatuh ke alamat soket.
  assert.equal(clientIp({ ...dasar, headers: { 'x-forwarded-for': '9.9.9.9' } }), '10.0.0.9')
  assert.equal(clientIp({ ...dasar, headers: {} }), '10.0.0.9')
  assert.equal(clientIp({ headers: {} }), '?')
})

test('F-36 clientIp: TRUST_PROXY_XFF memakai hop terakhir, bukan yang bisa ditulis klien', () => {
  const req = { headers: { 'x-forwarded-for': '9.9.9.9, 10.1.1.1' }, socket: { remoteAddress: '10.0.0.9' } }
  assert.equal(clientIp(req, { trustProxyXff: true }), '10.1.1.1')
  assert.equal(clientIp(req), '10.0.0.9')
})

test('F-36 rate limit: peta kunci tidak tumbuh tanpa batas', () => {
  for (let i = 0; i < MAX_RATE_KEYS + 50; i++) rateLimited(`uji-${i}`)
  assert.ok(rateLimitStoreSize() <= MAX_RATE_KEYS, `ukuran ${rateLimitStoreSize()} harus ≤ ${MAX_RATE_KEYS}`)
})
