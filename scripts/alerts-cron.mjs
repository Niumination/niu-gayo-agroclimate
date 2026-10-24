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
import fs from 'node:fs'
import path from 'node:path'
import { assessSources, sourceSignature, shouldNotifySourceHealth, renderSourceHealth, COOLDOWN_H } from '../src/domain/sourceHealth.js'
import { sendTelegram } from '../server/alerts.js'

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
console.log(`[alerts-cron] ${stamp} WIB${dryRun ? ' (dry-run)' : ''}: keputusan=${body.decided?.length ?? 0} pesan=${body.messages ?? 0} draft=${body.summary?.planned ?? 0} kirim=${body.summary?.sent ?? 0} (Alert ${body.summary?.Alert ?? 0} / Update ${body.summary?.Update ?? 0} / Cancel ${body.summary?.Cancel ?? 0}) dilewati=${body.skipped ?? 0}`)
for (const a of body.sent ?? []) console.log(`  - ${a.msgType} ${a.level} ${a.hazard} @ ${a.location?.name}: ${a.info?.headline}`)
if (body.errors?.length) {
  for (const e of body.errors) console.error(`  ! ${e}`)
  process.exit(2)
}

// ── F-05/F-16 — alarm kesehatan sumber ───────────────────────────────────────
// Rencana audit Sprint B: beri tahu saat `imergCount = 0` atau sumber degradasi > 6 jam.
// Dipakai cron yang sama; anti-bising memakai tanda tangan daftar masalah + masa tenang.
const statePath = process.env.SOURCE_ALERT_STATE || path.join(process.cwd(), 'server/data/source-alert-state.json')

function bacaState() {
  try { return JSON.parse(fs.readFileSync(statePath, 'utf8')) } catch { return null }
}
function tulisState(nilai) {
  try {
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    fs.writeFileSync(statePath, JSON.stringify(nilai, null, 1))
  } catch (err) {
    console.error(`[alerts-cron] tidak bisa menyimpan ${statePath}: ${err.message}`)
  }
}

let health = null
try {
  const hr = await fetch(`${base}/healthz`, { signal: AbortSignal.timeout(15_000) })
  const isi = await hr.json()
  health = isi?.health ?? assessSources(isi?.sources ?? {})
} catch (err) {
  console.error(`[alerts-cron] /healthz tidak terbaca: ${err.message}`)
}

if (health) {
  if (health.ok) {
    if (bacaState()) tulisState({ signature: '', at: new Date().toISOString() })
    console.log('[alerts-cron] kesehatan sumber: semua normal')
  } else {
    const signature = sourceSignature(health)
    const kirim = shouldNotifySourceHealth(bacaState(), signature)
    const teks = renderSourceHealth(health, { url: `${base}/healthz` })
    for (const p of health.problems) console.error(`  ! sumber ${p.id} (${p.state}): ${p.reason}`)
    if (!kirim) {
      console.log(`[alerts-cron] alarm sumber ditahan (tanda tangan sama, masa tenang ${COOLDOWN_H} jam)`)
    } else if (dryRun) {
      console.log(`[alerts-cron] (dry-run) alarm sumber tidak dikirim:\n${teks}`)
    } else if (!process.env.TELEGRAM_BOT_TOKEN) {
      console.log('[alerts-cron] TELEGRAM_BOT_TOKEN kosong — alarm sumber hanya dicatat di log')
    } else {
      try {
        await sendTelegram(teks)
        tulisState({ signature, at: new Date().toISOString() })
        console.log(`[alerts-cron] alarm sumber dikirim (${health.problems.length} sumber)`)
      } catch (err) {
        console.error(`[alerts-cron] gagal kirim alarm sumber: ${err.message}`)
        process.exitCode = 2
      }
    }
  }
}
