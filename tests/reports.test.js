import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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
  assert.match(validateReport({ location: 'linge', type: 'gempa' }).error, /kekeringan, badai/)
})
