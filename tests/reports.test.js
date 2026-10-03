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
