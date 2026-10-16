/**
 * magma — uji implementasi MAGMA_STALE_DAYS (audit F-18):
 * fallback hasil tersimpan hanya dipakai bila umurnya ≤ batas hari.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { getVolcanoStatus } from '../server/magma.js'

const NOW = '2026-10-16T00:00:00.000Z'
const VOLCANO = { name: 'Bur Ni Telong', region: 'Aceh', level: 2, label: 'Waspada', roman: 'II', reportUrl: null, observedAt: NOW }

function tempLastFile(savedAt) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'magma-stale-'))
  const file = path.join(dir, 'volcano-last.json')
  fs.writeFileSync(file, JSON.stringify({ volcano: VOLCANO, savedAt }))
  return file
}

const fetchDown = async () => { throw new Error('HTTP 503') }
const windJson = async () => ({ hourly: {} })

test('fallback dipakai bila umur hasil tersimpan ≤ MAGMA_STALE_DAYS', async () => {
  const file = tempLastFile('2026-10-14T00:00:00.000Z') // 2 hari
  const r = await getVolcanoStatus({ fetchText: fetchDown, fetchJson: windJson, lastGoodFile: file, staleDays: 7, now: NOW })
  assert.equal(r.stale, true)
  assert.equal(r.volcano?.level, 2)
  assert.equal(r.degraded, true) // stale tetap ditandai degraded
})

test('fallback DIABAIKAN bila umur > MAGMA_STALE_DAYS → volcano null + alasan jelas', async () => {
  const file = tempLastFile('2026-10-01T00:00:00.000Z') // 15 hari
  const r = await getVolcanoStatus({ fetchText: fetchDown, fetchJson: windJson, lastGoodFile: file, staleDays: 7, now: NOW })
  assert.equal(r.volcano, null)
  assert.equal(r.degraded, true)
  assert.match(r.error ?? '', /MAGMA_STALE_DAYS/)
  assert.match(r.error ?? '', /diabaikan/)
})

test('batas hari dapat dikonfigurasi: 20 hari masih dipakai bila staleDays=30', async () => {
  const file = tempLastFile('2026-09-26T00:00:00.000Z') // 20 hari
  const r = await getVolcanoStatus({ fetchText: fetchDown, fetchJson: windJson, lastGoodFile: file, staleDays: 30, now: NOW })
  assert.equal(r.stale, true)
  assert.equal(r.volcano?.level, 2)
})
