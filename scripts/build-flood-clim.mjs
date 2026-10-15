#!/usr/bin/env node
/**
 * FR-BJR-2 — klimatologi debit GloFAS per sel DAS Peusangan: median & p95 per hari-dalam-tahun (jendela ±15 hari)
 * dari deret historis Open-Meteo Flood API (GloFAS v4 konsolidasi, 1984 → tahun lalu). Dijalankan sekali/tahun:
 *   node scripts/build-flood-clim.mjs [--start 1984-01-01] [--end 2025-12-31] [--out server/clim/flood-clim.json]
 * Keluaran dipakai server/flood.js (dischargeAnomaly). Sumber: Copernicus Emergency Management Service / GloFAS via Open-Meteo (CC BY 4.0).
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { FLOOD_CELLS, OPEN_METEO_FLOOD } from '../server/config.js'
import { buildClimatology } from '../server/flood.js'

const args = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => (a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null)).filter(Boolean))
const start = args.start || '1984-01-01'
const end = args.end || `${new Date().getUTCFullYear() - 1}-12-31`
const out = args.out || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'server', 'clim', 'flood-clim.json')

/** Permintaan historis 40 tahun berat untuk tier gratis Open-Meteo → mundur eksponensial bila 429/5xx (maks 6 percobaan). */
async function fetchWithRetry(url, label, attempts = 6) {
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(90_000) })
    if (res.ok) return res.json()
    if (res.status !== 429 && res.status < 500) throw new Error(`${label}: HTTP ${res.status}`)
    const wait = 15_000 * (i + 1)
    process.stdout.write(`HTTP ${res.status}, tunggu ${wait / 1000} s … `)
    await new Promise((r) => setTimeout(r, wait))
  }
  throw new Error(`${label}: gagal setelah ${attempts} percobaan`)
}

const cells = {}
for (const cell of FLOOD_CELLS) {
  const url = `${OPEN_METEO_FLOOD}?latitude=${cell.lat}&longitude=${cell.lon}&daily=river_discharge&start_date=${start}&end_date=${end}&timezone=Asia%2FJakarta`
  process.stdout.write(`${cell.id} … `)
  const data = await fetchWithRetry(url, cell.id)
  const clim = buildClimatology(data.daily.time, data.daily.river_discharge)
  const valid = data.daily.time.filter((_, i) => data.daily.river_discharge[i] != null)
  cells[cell.id] = { ...cell, n: clim.n, years: clim.years, dataFrom: valid[0] ?? null, dataTo: valid[valid.length - 1] ?? null, median: clim.median, p95: clim.p95 }
  console.log(`${clim.n} hari, ${clim.years} tahun, median tahunan ${clim.annualMedian} m³/s`)
}
const doc = { source: 'GloFAS v4 (Copernicus EMS) via Open-Meteo Flood API — https://open-meteo.com/en/docs/flood-api (CC BY 4.0)', method: 'median & persentil-95 per hari-dalam-tahun (1–366), jendela ±15 hari, deret harian river_discharge', period: `${start} → ${end} (diminta)`, dataPeriod: `${Object.values(cells)[0]?.dataFrom} → ${Object.values(cells)[0]?.dataTo} (tersedia)`, builtAt: new Date().toISOString(), cells }
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(doc))
console.log(`tersimpan: ${out} (${(fs.statSync(out).size / 1024).toFixed(1)} kB)`)
