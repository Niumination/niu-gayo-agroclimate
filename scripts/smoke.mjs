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
  '/api/ensemble?location=takengon',
  '/api/alerts',
  '/api/consensus?location=takengon',
  '/api/bmkg-nowcast',
  '/api/air-quality?location=takengon',
  '/api/hotspots?location=takengon',
  '/api/drought?location=takengon',
  '/api/fire-danger?location=takengon',
  '/api/quakes?location=takengon',
  '/api/volcano',
  '/api/convective?location=takengon',
  '/api/flood',
  '/api/external-reports',
  '/api/hazards?location=takengon',
  '/api/hazards?location=all',
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
      if (status !== 200) failed++
    } catch (err) {
      failed++
      note = `GAGAL: ${err.message}`
    }
    console.log(`${status !== 200 || !status ? '✗' : '✓'} ${String(status).padEnd(3)} ${ep.padEnd(40)} ${note} (${Date.now() - t0} ms)`)
  }
  // POST dry-run siklus peringatan (tanpa Telegram)
  const r = await fetch(`${base}/api/alerts/run?dryRun=1`, { method: 'POST', headers: { 'x-cron-token': 'smoke' }, signal: AbortSignal.timeout(120_000) })
  const b = await r.json()
  console.log(`${r.ok ? '✓' : '✗'} ${r.status} POST /api/alerts/run?dryRun=1 → keputusan=${b.decided?.length ?? '?'} draft=${b.summary?.planned ?? '?'} kirim=${b.summary?.sent ?? '?'} (${b.summary?.mode ?? '?'})`)
  if (!r.ok) failed++

  // Audit 2026-10 (F-13): header keamanan wajib ada pada semua respons.
  const hz = await fetch(`${base}/healthz`)
  // Sprint C·III (F-19): XFO berubah DENY → SAMEORIGIN agar iframe dari situs sendiri tetap sah.
  const needHeaders = { 'x-content-type-options': 'nosniff', 'x-frame-options': 'SAMEORIGIN', 'referrer-policy': 'no-referrer' }
  const missing = Object.entries(needHeaders).filter(([k, v]) => hz.headers.get(k) !== v)
  console.log(`${missing.length ? '✗' : '✓'} header keamanan ${missing.length ? `HILANG: ${missing.map(([k]) => k).join(', ')}` : 'nosniff + SAMEORIGIN + no-referrer ada'}`)
  if (missing.length) failed++

  // Operasional: POST /api/cache/flush harus 200 { ok: true }.
  const fl = await fetch(`${base}/api/cache/flush`, { method: 'POST', headers: { 'x-cron-token': 'smoke' } })
  const flb = await fl.json().catch(() => ({}))
  console.log(`${fl.ok && flb.ok ? '✓' : '✗'} ${fl.status} POST /api/cache/flush`)
  if (!(fl.ok && flb.ok)) failed++

  // CAP XML: 404 (feed kosong) atau 200 XML — keduanya sah; bila 200 wajib bertipe cap+xml (F-13).
  const cap = await fetch(`${base}/api/alerts/feed?hours=1&format=cap`)
  const okCap = cap.status === 404 || (cap.status === 200 && (cap.headers.get('content-type') ?? '').includes('cap+xml'))
  console.log(`${okCap ? '✓' : '✗'} ${cap.status} GET /api/alerts/feed?format=cap`)
  if (!okCap) failed++
} catch (err) {
  console.error(err.message)
  failed++
} finally {
  server.kill('SIGTERM')
}
console.log(failed ? `\n✗ smoke gagal: ${failed}` : '\n✓ smoke lolos')
process.exit(failed ? 1 : 0)
