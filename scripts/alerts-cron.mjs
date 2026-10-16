#!/usr/bin/env node
/**
 * Fase 1.8 — pemicu siklus peringatan multi-bahaya (dipanggil systemd timer tiap 30 menit atau manual).
 * Memanggil POST /api/alerts/run pada server API lokal (agar cache & arsip dipakai bersama), lalu mencetak ringkasan.
 *
 *   node scripts/alerts-cron.mjs            # kirim (bila TELEGRAM_* tersedia di env server)
 *   node scripts/alerts-cron.mjs --dry-run  # evaluasi + keputusan tanpa kirim/simpan
 *   node scripts/alerts-cron.mjs --only gempa,vulkanik   # siklus cepat 5 menit (server/agroclimate-alerts-fast.timer)
 *   API_BASE=http://127.0.0.1:7455 ALERTS_CRON_TOKEN=... node scripts/alerts-cron.mjs
 * Keluar dengan kode 0 bila siklus berjalan (meski 0 pesan), 1 bila server tidak dapat dihubungi, 2 bila ada kegagalan kirim.
 */
const base = (process.env.API_BASE || 'http://127.0.0.1:7455').replace(/\/$/, '')
const dryRun = process.argv.includes('--dry-run')
const onlyIdx = process.argv.indexOf('--only')
const only = onlyIdx > -1 ? process.argv[onlyIdx + 1] : ''
const token = process.env.ALERTS_CRON_TOKEN || ''

const qs = new URLSearchParams()
if (dryRun) qs.set('dryRun', '1')
if (only) qs.set('only', only)
const url = `${base}/api/alerts/run${qs.toString() ? `?${qs}` : ''}`
let res
try {
  res = await fetch(url, { method: 'POST', headers: token ? { 'x-cron-token': token } : {}, signal: AbortSignal.timeout(120_000) })
} catch (err) {
  console.error(`[alerts-cron] server tidak dapat dihubungi (${url}): ${err.message}`)
  process.exit(1)
}
const body = await res.json().catch(() => ({}))
if (!res.ok) {
  console.error(`[alerts-cron] HTTP ${res.status}: ${body.error ?? JSON.stringify(body)}`)
  process.exit(1)
}
const stamp = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })
console.log(`[alerts-cron] ${stamp} WIB${dryRun ? ' (dry-run)' : ''}: keputusan=${body.decided?.length ?? 0} pesan=${body.messages ?? 0} terkirim=${body.summary?.sent ?? 0} (Alert ${body.summary?.Alert ?? 0} / Update ${body.summary?.Update ?? 0} / Cancel ${body.summary?.Cancel ?? 0}) dilewati=${body.skipped ?? 0}`)
for (const a of body.sent ?? []) console.log(`  - ${a.msgType} ${a.level} ${a.hazard} @ ${a.location?.name}: ${a.info?.headline}`)
if (body.errors?.length) {
  for (const e of body.errors) console.error(`  ! ${e}`)
  process.exit(2)
}
