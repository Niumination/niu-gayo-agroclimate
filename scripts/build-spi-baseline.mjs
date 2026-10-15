#!/usr/bin/env node
/**
 * FR-KER-6 — baseline SPI: total hujan bulanan ERA5 (best_match Open-Meteo Archive — sama dengan server/archive.js) 1991–2020 untuk 15 sentra, 1 call/lokasi.
 *   node scripts/build-spi-baseline.mjs [--start 1991-01-01] [--end 2020-12-31] [--out server/clim/spi-baseline.json] [--only id1,id2]
 * Dijalankan sekali (≈ 15 permintaan 30 tahun; tier gratis bisa 429 → skrip menunggu & mengulang). Keluaran dipakai server/spi.js.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCATIONS } from '../src/data/locations.js'
import { OPEN_METEO_ARCHIVE } from '../server/config.js'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean))
const start = args.start || '1991-01-01'
const end = args.end || '2020-12-31'
const out = args.out || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'clim', 'spi-baseline.json')
const only = args.only ? new Set(args.only.split(',')) : null

async function fetchWithRetry(url, label, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
    if (res.ok) return res.json()
    if (res.status !== 429 && res.status < 500) throw new Error(`${label}: HTTP ${res.status}`)
    const wait = 20_000 * (i + 1)
    process.stdout.write(`HTTP ${res.status}, tunggu ${wait / 1000} s … `)
    await new Promise((r) => setTimeout(r, wait))
  }
  throw new Error(`${label}: gagal setelah ${attempts} percobaan`)
}

const existing = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf8')) : null
const locations = existing?.locations ?? {}
for (const loc of LOCATIONS) {
  if (only && !only.has(loc.id)) continue
  if (!only && locations[loc.id]?.monthly && existing?.period === `${start} → ${end}`) { console.log(`${loc.id}: sudah ada, lewati`); continue }
  const url = `${OPEN_METEO_ARCHIVE}?latitude=${loc.lat}&longitude=${loc.lon}&daily=precipitation_sum&start_date=${start}&end_date=${end}&timezone=Asia%2FJakarta`  // model sama dengan server/archive.js (best_match ERA5/ERA5-Land, tanpa elevation agar sel identik)
  process.stdout.write(`${loc.id} … `)
  const data = await fetchWithRetry(url, loc.id)
  const monthly = {}
  const counts = {}
  data.daily.time.forEach((t, i) => {
    const v = data.daily.precipitation_sum[i]
    if (v == null) return
    const k = t.slice(0, 7)
    monthly[k] = Math.round(((monthly[k] ?? 0) + v) * 10) / 10
    counts[k] = (counts[k] ?? 0) + 1
  })
  for (const k of Object.keys(monthly)) if (counts[k] < 25) delete monthly[k] // bulan tidak lengkap
  const years = new Set(Object.keys(monthly).map((k) => k.slice(0, 4))).size
  const annual = Object.values(monthly).reduce((a, b) => a + b, 0) / Math.max(1, years)
  locations[loc.id] = { id: loc.id, name: loc.name, lat: loc.lat, lon: loc.lon, period: `${start} → ${end}`, years, annualMeanMm: Math.round(annual), monthly }
  console.log(`${Object.keys(monthly).length} bulan, ${years} tahun, rata-rata tahunan ${Math.round(annual)} mm`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ source: 'ERA5 (best_match) via Open-Meteo Historical Weather API (CC BY 4.0) — sel sama dengan /api/drought', method: 'total hujan bulanan per lokasi; SPI gamma per bulan kalender (Thom 1958) dihitung server/spi.js', period: `${start} → ${end}`, builtAt: new Date().toISOString(), locations }))
  await new Promise((r) => setTimeout(r, 3000))
}
console.log(`tersimpan: ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} kB)`)
