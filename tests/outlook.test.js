/**
 * check-outlook — uji gerbang kesegaran outlook musiman (scripts/check-outlook.mjs).
 * Menutup temuan audit F-14 pada sisi kode: kedaluwarsa harus terdeteksi otomatis.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { validateOutlook, checkFile } from '../scripts/check-outlook.mjs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const NOW = new Date('2026-10-16T00:00:00+07:00')

const dasar = () => ({
  current: {
    issuedAt: '2026-10',
    validUntil: '2026-11-12',
    enso: { phase: 'El Niño' },
    iod: { phase: 'positif' },
    season: { status: 'kemarau diperpanjang' },
    sources: [{ title: 'CPC', url: 'https://www.cpc.ncep.noaa.gov/' }],
  },
})

test('validateOutlook: outlook segar (sisa > warnDays) → ok tanpa peringatan', () => {
  const r = validateOutlook(dasar(), { now: NOW, warnDays: 14 })
  assert.equal(r.ok, true)
  assert.deepEqual(r.errors, [])
  assert.deepEqual(r.warnings, [])
  assert.equal(r.validUntil, '2026-11-12')
  assert.equal(r.daysLeft, 27)
})

test('validateOutlook: hampir kedaluwarsa → peringatan tapi tetap ok', () => {
  const o = dasar()
  o.current.validUntil = '2026-10-25' // sisa 9 hari
  const r = validateOutlook(o, { now: NOW, warnDays: 14 })
  assert.equal(r.ok, true)
  assert.equal(r.warnings.length, 1)
  assert.match(r.warnings[0], /kedaluwarsa dalam 9 hari/)
})

test('validateOutlook: sudah kedaluwarsa → error (gerbang CI gagal)', () => {
  const o = dasar()
  o.current.validUntil = '2026-10-01'
  const r = validateOutlook(o, { now: NOW })
  assert.equal(r.ok, false)
  assert.match(r.errors.join(' '), /KEDALUWARSA/)
})

test('validateOutlook: tanggal tidak sah & bagian hilang → error', () => {
  const o = dasar()
  o.current.validUntil = 'bukan-tanggal'
  delete o.current.iod
  o.current.sources = []
  const r = validateOutlook(o, { now: NOW })
  assert.equal(r.ok, false)
  assert.ok(r.errors.some((e) => e.includes('bukan tanggal ISO')))
  assert.ok(r.errors.some((e) => e.includes('current.iod')))
})

test('checkFile: berkas nyata ikut repositori & valid saat ini', () => {
  const r = checkFile(path.join(__dirname, '..', 'src', 'data', 'hazards', 'climateOutlook.json'))
  assert.equal(r.ok, true, r.errors.join('; '))
  assert.ok(r.daysLeft > 14, `sisa hari terlalu sedikit: ${r.daysLeft}`)
})

test('checkFile: berkas tidak ada → ok=false tanpa lempar', () => {
  const r = checkFile('/tidak/ada/climateOutlook.json')
  assert.equal(r.ok, false)
  assert.match(r.errors[0], /tidak bisa membaca/)
})
