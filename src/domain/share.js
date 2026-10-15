/**
 * FR-X-7 — ringkasan teks per sentra untuk dibagikan (WhatsApp) + "versi SMS" ≤ 160 karakter.
 * Fungsi murni (tanpa DOM) agar dapat diuji; dipakai ShareButton.jsx dan renderer alert (server).
 */
import { LEVEL_LABEL, LEVEL_ORDER } from './hazards/levels.js'

const SHORT = { longsor: 'Longsor', banjir: 'Banjir DAS', angin: 'Angin', asap: 'Asap/ISPU', kebakaran: 'Kebakaran', kekeringan: 'Kekeringan', karat: 'Karat daun' }
const SMS_LEVEL = { rendah: 'R', waspada: 'WASPADA', bahaya: 'BAHAYA', ekstrem: 'EKSTREM', 'n/a': '-' }

const fmtTime = (iso) => {
  const d = iso ? new Date(iso) : new Date()
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
}

/** Teks WhatsApp (beberapa baris). */
export function whatsappText(hazards, location, { now, url } = {}) {
  const name = location?.name ?? location?.id ?? 'Aceh Tengah'
  const lines = [`*Niu Gayo Agro-Climate — ${name}* (${fmtTime(now ?? hazards?.results?.[0]?.evaluatedAt)} WIB)`]
  const active = hazards?.active ?? []
  if (!active.length) lines.push('Tidak ada bahaya aktif saat ini.')
  for (const r of active) {
    lines.push(`• ${SHORT[r.id] ?? r.id}: *${LEVEL_LABEL[r.level]}* — ${r.headline}`)
    const tip = r.advice?.umum?.[0] ?? r.advice?.kebun?.[0]
    if (tip) lines.push(`  ↳ ${typeof tip === 'string' ? tip : tip.id}`)
  }
  const quiet = (hazards?.results ?? []).filter((r) => r.level === 'rendah').map((r) => SHORT[r.id] ?? r.id)
  if (quiet.length) lines.push(`Rendah: ${quiet.join(', ')}`)
  lines.push('_Informasi pendukung berbasis model, bukan peringatan resmi. Darurat: 112 / BPBD (0643) 21113._')
  if (url) lines.push(url)
  return lines.join('\n')
}

/** Versi SMS ≤ 160 karakter: hanya bahaya ≥ waspada, dipotong rapi. */
export function smsText(hazards, location, { now, maxLen = 160 } = {}) {
  const name = (location?.name ?? location?.id ?? 'AcehTengah').replace(/\s+/g, '')
  const d = now ? new Date(now) : new Date()
  const hhmm = Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
  const active = (hazards?.active ?? []).slice().sort((a, b) => LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level])
  const head = `NGA ${name} ${hhmm}:`
  const tail = ' Info model,bkn resmi. Darurat 112'
  if (!active.length) return `${head} tdk ada bahaya aktif.${tail}`.slice(0, maxLen)
  const parts = active.map((r) => `${SHORT[r.id] ?? r.id} ${SMS_LEVEL[r.level]}`)
  let body = ''
  for (const p of parts) {
    const next = body ? `${body}; ${p}` : ` ${p}`
    if ((head + next + tail).length > maxLen) break
    body = next
  }
  if (!body) body = ` ${parts[0]}`.slice(0, Math.max(0, maxLen - head.length - tail.length))
  return `${head}${body}.${tail}`.slice(0, maxLen)
}

export function waShareUrl(text) {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}
export function smsShareUrl(text) {
  return `sms:?body=${encodeURIComponent(text)}`
}
