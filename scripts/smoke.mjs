#!/usr/bin/env node
/**
 * Fase 4.4 — smoke test API: nyalakan server/index.js pada port acak, panggil setiap endpoint publik, pastikan
 * HTTP 200 + JSON valid (payload boleh `degraded:true` bila jaringan/kunci tidak ada — pola "tidak pernah throw").
 *   npm run smoke            (dipakai CI; keluar 1 bila ada endpoint 5xx / bukan JSON / server tidak hidup)
 */
import { spawn } from 'node:child_process'

const port = 7600 + Math.floor(Math.random() * 300)
const base = `http://127.0.0.1:${port}`
const server = spawn(process.execPath, ['server/index.js'], { env: { ...process.env, PORT: String(port), ALERTS_CRON_TOKEN: 'smoke', TELEGRAM_BOT_TOKEN: '' }, stdio: ['ignore', 'pipe', 'pipe'] })
let log = ''
server.stdout.on('data', (d) => (log += d))
server.stderr.on('data', (d) => (log += d))

const wait = async () => {
  for (let i = 0; i < 50; i++) {
    try {
      const r = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(1000) })
      if (r.ok) return true
    } catch { /* belum siap */ }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

const ENDPOINTS = [
  '/healthz',
  '/api/seasonal',
  '/api/disaster-history?location=takengon',
  '/api/reports?location=takengon',
  '/api/weather?location=takengon',
  '/api/air-quality?location=takengon',
  '/api/drought?location=takengon',
  '/api/fire-danger?location=takengon',
  '/api/quakes?location=takengon',
  '/api/volcano',
  '/api/convective?location=takengon',
  '/api/flood',
  '/api/external-reports',
  '/api/hazards?location=takengon',
  '/api/alerts/feed?hours=1',
]

let failed = 0
try {
  if (!(await wait())) throw new Error(`server tidak siap di ${base}\n${log}`)
  for (const ep of ENDPOINTS) {
    const t0 = Date.now()
    let status = 0
    let note = ''
    try {
      const r = await fetch(base + ep, { signal: AbortSignal.timeout(45_000) })
      status = r.status
      const body = await r.json()
      note = body?.degraded ? 'degraded' : 'ok'
      if (status >= 500) failed++
    } catch (err) {
      failed++
      note = `GAGAL: ${err.message}`
    }
    console.log(`${status >= 500 || !status ? '✗' : '✓'} ${String(status).padEnd(3)} ${ep.padEnd(40)} ${note} (${Date.now() - t0} ms)`)
  }
  // POST dry-run siklus peringatan (tanpa Telegram)
  const r = await fetch(`${base}/api/alerts/run?dryRun=1`, { method: 'POST', headers: { 'x-cron-token': 'smoke' }, signal: AbortSignal.timeout(120_000) })
  const b = await r.json()
  console.log(`${r.ok ? '✓' : '✗'} ${r.status} POST /api/alerts/run?dryRun=1 → keputusan=${b.decided?.length ?? '?'} terkirim=${b.summary?.sent ?? '?'}`)
  if (!r.ok) failed++
} catch (err) {
  console.error(err.message)
  failed++
} finally {
  server.kill('SIGTERM')
}
console.log(failed ? `\n✗ smoke gagal: ${failed}` : '\n✓ smoke lolos')
process.exit(failed ? 1 : 0)
