#!/usr/bin/env node
/**
 * check-outlook — gerbang kesegaran & struktur src/data/hazards/climateOutlook.json (temuan audit F-14).
 *
 * Kenapa: berkas konteks musiman (ENSO/IOD/monsun) dikurasi manual dan punya `validUntil`.
 * Kalau lewat tanggal, penyesuaian musiman mati diam-diam (UI menampilkan "perlu pembaruan").
 * Skrip ini menjadikannya sinyal CI:
 *   - `validUntil` sudah lewat            → keluar kode 1 (WAJIB diperbarui sebelum rilis)
 *   - sisa ≤ --warn-days (default 14)     → peringatan (keluar 0, tetap terlihat di log CI)
 *   - struktur wajib tidak lengkap        → keluar kode 1
 *
 * Pakai: node scripts/check-outlook.mjs [--warn-days 30] [--file path]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_FILE = path.join(__dirname, '..', 'src', 'data', 'hazards', 'climateOutlook.json')

const WAJIB = ['current.enso', 'current.iod', 'current.season', 'current.validUntil', 'current.sources']

/** Ambil nilai bertitik dari objek. */
function dig(obj, dotted) {
  return dotted.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

/**
 * Validasi murni (dapat diuji tanpa berkas).
 * @returns {{ ok:boolean, errors:string[], warnings:string[], validUntil:string|null, daysLeft:number|null }}
 */
export function validateOutlook(outlook, { now = new Date(), warnDays = 14 } = {}) {
  const errors = []
  const warnings = []
  const cur = outlook?.current ?? {}
  for (const key of WAJIB) {
    const v = dig(outlook, key)
    if (v == null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)) {
      errors.push(`bagian wajib hilang/kosong: ${key}`)
    }
  }
  const validUntil = typeof cur.validUntil === 'string' ? cur.validUntil : null
  let daysLeft = null
  if (validUntil) {
    // Berlaku sampai akhir hari (WIB), sama seperti pemakaian di src/domain/seasonal.js
    const until = new Date(`${validUntil}T23:59:59+07:00`)
    if (Number.isNaN(until.getTime())) {
      errors.push(`validUntil bukan tanggal ISO yang sah: ${validUntil}`)
    } else {
      daysLeft = Math.floor((until.getTime() - now.getTime()) / 86_400_000)
      if (daysLeft < 0) errors.push(`outlook KEDALUWARSA ${-daysLeft} hari (validUntil ${validUntil}) — perbarui dari rilis BMKG/CPC sebelum rilis berikutnya`)
      else if (daysLeft <= warnDays) warnings.push(`outlook akan kedaluwarsa dalam ${daysLeft} hari (validUntil ${validUntil}) — jadwalkan pembaruan`)
    }
  }
  if (!Array.isArray(cur.sources) || !cur.sources.length) {
    if (!errors.some((e) => e.includes('sources'))) errors.push('current.sources kosong — sertakan sumber terkutip')
  }
  return { ok: errors.length === 0, errors, warnings, validUntil, daysLeft }
}

/** Baca + validasi berkas; jangan lempar — kembalikan hasil terstruktur. */
export function checkFile(file = DEFAULT_FILE, { now = new Date(), warnDays = 14 } = {}) {
  let outlook
  try {
    outlook = JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch (err) {
    return { ok: false, errors: [`tidak bisa membaca ${file}: ${err.message}`], warnings: [], validUntil: null, daysLeft: null }
  }
  return validateOutlook(outlook, { now, warnDays })
}

function main() {
  const args = process.argv.slice(2)
  const warnIdx = args.indexOf('--warn-days')
  const fileIdx = args.indexOf('--file')
  const warnDays = warnIdx >= 0 ? Number(args[warnIdx + 1]) : 14
  const file = fileIdx >= 0 ? args[fileIdx + 1] : DEFAULT_FILE

  const res = checkFile(file, { warnDays })
  const label = path.relative(process.cwd(), file)
  for (const w of res.warnings) console.warn(`⚠  [outlook] ${w}`)
  for (const e of res.errors) console.error(`✗  [outlook] ${e}`)
  if (res.ok) {
    console.log(`✓ [outlook] ${label} berlaku sampai ${res.validUntil} (sisa ${res.daysLeft} hari)`)
    process.exit(0)
  }
  process.exit(1)
}

// Jalankan hanya sebagai CLI (bukan saat di-import test)
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) main()
