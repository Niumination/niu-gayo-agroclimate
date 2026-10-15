/**
 * Fase 1.8b — struktur peringatan ala CAP 1.2 (OASIS) untuk hasil registry bahaya + aturan anti-bising + renderer.
 * Fungsi murni (tanpa fetch/FS) — dipakai server/alerts.js (cron Telegram, /api/alerts/feed) dan dapat diuji.
 *
 * Pemetaan (docs/dev/06-THRESHOLDS-MULTI-HAZARD.md §9, ADR-22):
 *   level waspada → severity Moderate · bahaya → Severe · ekstrem → Extreme · rendah → Minor
 *   certainty: pengamatan (hotspot/laporan warga/nowcast resmi) → Observed, selain itu model → Likely
 *   anti-bising: maks. 1 pesan per bahaya per sentra per 6 jam; naik level → Update segera; turun di bawah waspada → Cancel.
 *   sender tetap: "Niu Gayo Agro-Climate (informasi pendukung)" — BUKAN peringatan resmi BMKG/BPBD.
 */
import { LEVEL_ORDER, LEVEL_LABEL, normalizeLevel } from './hazards/levels.js'

export const SENDER = 'Niu Gayo Agro-Climate (informasi pendukung)'
export const SENDER_ID = 'agroclimate@cuaca.abstract.biz.id'
export const MIN_INTERVAL_H = 6
export const DEFAULT_EXPIRES_H = { longsor: 6, banjir: 6, angin: 6, asap: 6, kebakaran: 12, kekeringan: 24, karat: 24 }

/**
 * Kebijakan push (anti-bising, docs/dev/06 §9): level minimum agar suatu bahaya dikirim ke kanal (Telegram/SMS).
 * null = tidak pernah di-push (hanya tampil di UI & feed) — karat daun adalah anjuran agronomi, bukan bencana.
 */
export const PUSH_POLICY = { longsor: 'waspada', banjir: 'waspada', angin: 'waspada', asap: 'waspada', kebakaran: 'waspada', kekeringan: 'bahaya', karat: null }
export function shouldPush(hazardId, level) {
  const min = PUSH_POLICY[hazardId]
  if (!min) return false
  return LEVEL_ORDER[normalizeLevel(level)] >= LEVEL_ORDER[min]
}
/** Jika ≥ GROUP_MIN sentra memicu bahaya & level & msgType yang sama dalam satu siklus → satu pesan gabungan. */
export const GROUP_MIN = 3

export const SEVERITY = { rendah: 'Minor', waspada: 'Moderate', bahaya: 'Severe', ekstrem: 'Extreme', 'n/a': 'Unknown' }
export const CATEGORY = { longsor: 'Geo', banjir: 'Met', angin: 'Met', asap: 'Env', kebakaran: 'Fire', kekeringan: 'Met', karat: 'Env' }
export const URGENCY = { longsor: 'Expected', banjir: 'Expected', angin: 'Immediate', asap: 'Expected', kebakaran: 'Expected', kekeringan: 'Future', karat: 'Future' }
export const EVENT = {
  longsor: 'Potensi tanah longsor',
  banjir: 'Potensi luapan DAS Peusangan',
  angin: 'Angin kencang',
  asap: 'Kabut asap / kualitas udara',
  kebakaran: 'Bahaya kebakaran lahan',
  kekeringan: 'Kekeringan (HTH)',
  karat: 'Risiko karat daun kopi',
}
const EMOJI = { longsor: '⛰️', banjir: '🌊', angin: '🌬️', asap: '🌫️', kebakaran: '🔥', kekeringan: '☀️', karat: '🍂' }
const LEVEL_EMOJI = { waspada: '🟡', bahaya: '🟠', ekstrem: '🔴', rendah: '🟢' }

const pad = (n) => String(n).padStart(2, '0')
/** Stempel waktu CAP (ISO dengan offset +07:00). */
export function capTime(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const wib = new Date(d.getTime() + 7 * 3_600_000)
  return `${wib.getUTCFullYear()}-${pad(wib.getUTCMonth() + 1)}-${pad(wib.getUTCDate())}T${pad(wib.getUTCHours())}:${pad(wib.getUTCMinutes())}:${pad(wib.getUTCSeconds())}+07:00`
}
const wibClock = (iso) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).replace('.', ':')
}

export function certaintyOf(result) {
  const f = result?.flags ?? {}
  if (f.observed || f.siagaLokal || f.reportEscalation?.escalate || (f.hotspotsDegraded === false && (result.metrics ?? []).some((m) => m.key === 'hotspots25km24h' && m.value > 0))) return 'Observed'
  if (result?.level === 'ekstrem') return 'Likely'
  return result?.degraded ? 'Possible' : 'Likely'
}

export function identifierFor({ locationId, hazardId, now }) {
  const t = new Date(now)
  const stamp = Number.isNaN(t.getTime()) ? 'unknown' : t.toISOString().replace(/[-:]/g, '').slice(0, 15)
  return `nga-${locationId}-${hazardId}-${stamp}`
}

/**
 * Aturan anti-bising. `last` = status kiriman terakhir { level, sentAt, identifier } untuk pasangan (sentra, bahaya).
 * @returns {'Alert'|'Update'|'Cancel'|null} msgType yang harus dikirim sekarang (null = diam)
 */
export function decideDispatch({ level, last, now, minIntervalH = MIN_INTERVAL_H }) {
  const lv = normalizeLevel(level)
  const active = LEVEL_ORDER[lv] >= LEVEL_ORDER.waspada
  const lastLv = last ? normalizeLevel(last.level) : null
  const lastActive = lastLv != null && LEVEL_ORDER[lastLv] >= LEVEL_ORDER.waspada
  const ageH = last?.sentAt ? (new Date(now).getTime() - new Date(last.sentAt).getTime()) / 3_600_000 : Infinity
  if (!active) return lastActive ? 'Cancel' : null
  if (!lastActive) return 'Alert'
  if (LEVEL_ORDER[lv] > LEVEL_ORDER[lastLv]) return 'Update' // naik level → segera
  if (ageH >= minIntervalH) return LEVEL_ORDER[lv] === LEVEL_ORDER[lastLv] ? 'Update' : 'Update' // pengingat berkala / turun tapi masih aktif
  return null
}

/**
 * Bangun objek peringatan (bentuk CAP 1.2 yang dipadatkan ke JSON). `result` = HazardResult ternormalisasi (registry).
 */
export function buildAlert({ result, location, now, msgType = 'Alert', references = [], expiresH, url, official = [] }) {
  const level = normalizeLevel(result.level)
  const hazardId = result.id
  const sent = new Date(now).toISOString()
  const exp = new Date(new Date(now).getTime() + (expiresH ?? DEFAULT_EXPIRES_H[hazardId] ?? 6) * 3_600_000).toISOString()
  const advice = [...(result.advice?.umum ?? []), ...(result.advice?.rentan ?? []), ...(result.advice?.kebun ?? []), ...(result.advice?.sekolah ?? [])]
    .map((a) => (typeof a === 'string' ? a : a?.id ?? String(a)))
    .filter(Boolean)
    .slice(0, 4)
  const label = result.label?.id ?? EVENT[hazardId] ?? hazardId
  const headline =
    msgType === 'Cancel'
      ? `${label} — ${location.name}: kembali ${LEVEL_LABEL[level].toLowerCase()}`
      : `${LEVEL_LABEL[level].toUpperCase()} ${label} — ${location.name}: ${result.headline}`
  return {
    identifier: identifierFor({ locationId: location.id, hazardId, now }),
    sender: SENDER_ID,
    senderName: SENDER,
    sent,
    status: 'Actual',
    msgType,
    scope: 'Public',
    references,
    hazard: hazardId,
    level,
    location: { id: location.id, name: location.name, lat: location.lat ?? null, lon: location.lon ?? null },
    info: {
      language: 'id-ID',
      category: CATEGORY[hazardId] ?? 'Other',
      event: EVENT[hazardId] ?? label,
      urgency: msgType === 'Cancel' ? 'Past' : URGENCY[hazardId] ?? 'Unknown',
      severity: SEVERITY[level] ?? 'Unknown',
      certainty: msgType === 'Cancel' ? 'Observed' : certaintyOf(result),
      headline,
      description: `${result.headline}. ${result.detail ?? ''}`.trim(),
      instruction: advice.join(' '),
      effective: sent,
      expires: exp,
      web: url ?? null,
      parameters: (result.metrics ?? []).filter((m) => m.value != null).map((m) => ({ valueName: m.key, value: `${m.value}${m.unit ? ` ${m.unit}` : ''}` })),
      sources: (result.sources ?? []).map((s) => s.name),
      // ADR-22: rujukan peringatan RESMI yang sedang aktif (BMKG nowcast dsb.) — wajib disertakan bila ada
      official: (official ?? []).map((o) => ({ authority: o.authority ?? 'BMKG', title: o.title, url: o.link ?? o.url ?? null, pubDate: o.pubDate ?? null })),
      area: {
        areaDesc: `Sentra kopi ${location.name}, Kabupaten Aceh Tengah`,
        circle: location.lat != null && location.lon != null ? `${location.lat},${location.lon} 5` : null, // radius 5 km (sentra ≈ kecamatan)
      },
      disclaimer: 'Informasi pendukung berbasis model/satelit — bukan peringatan resmi BMKG/BPBD. Darurat: 112 / BPBD Aceh Tengah (0643) 21113.',
    },
  }
}

/**
 * Peringatan gabungan untuk beberapa sentra (bahaya, level, msgType sama). `items` = [{ result, location }].
 * Headline & deskripsi memakai sentra berskor tertinggi; area memuat semua sentra (CAP mengizinkan banyak <area>).
 */
export function buildGroupAlert({ items, now, msgType = 'Alert', references = [], url, official = [] }) {
  const sorted = [...items].sort((a, b) => (b.result.score ?? 0) - (a.result.score ?? 0))
  const lead = sorted[0]
  const names = sorted.map((i) => i.location.name)
  const base = buildAlert({ result: lead.result, location: lead.location, now, msgType, references, url, official })
  const level = base.level
  const label = lead.result.label?.id ?? EVENT[lead.result.id] ?? lead.result.id
  const groupLoc = { id: `multi-${sorted.map((i) => i.location.id).join('+')}`.slice(0, 80), name: `${names.length} sentra`, lat: null, lon: null }
  return {
    ...base,
    identifier: identifierFor({ locationId: `multi${names.length}`, hazardId: lead.result.id, now }),
    location: groupLoc,
    locations: sorted.map((i) => ({ id: i.location.id, name: i.location.name, level: normalizeLevel(i.result.level), headline: i.result.headline })),
    info: {
      ...base.info,
      headline:
        msgType === 'Cancel'
          ? `${label} — ${names.length} sentra: kembali ${LEVEL_LABEL[level].toLowerCase()}`
          : `${LEVEL_LABEL[level].toUpperCase()} ${label} — ${names.length} sentra (tertinggi ${lead.location.name}: ${lead.result.headline})`,
      description: `${names.join(', ')}. ${lead.result.detail ?? ''}`.trim(),
      area: {
        areaDesc: `Sentra kopi ${names.join(', ')} — Kabupaten Aceh Tengah`,
        circles: sorted.filter((i) => i.location.lat != null).map((i) => `${i.location.lat},${i.location.lon} 5`),
        circle: null,
      },
    },
  }
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** Serialisasi ke CAP 1.2 XML (urn:oasis:names:tc:emergency:cap:1.2). */
export function toCapXml(alert) {
  const i = alert.info
  const params = (i.parameters ?? []).map((p) => `    <parameter><valueName>${esc(p.valueName)}</valueName><value>${esc(p.value)}</value></parameter>`).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>
<alert xmlns="urn:oasis:names:tc:emergency:cap:1.2">
  <identifier>${esc(alert.identifier)}</identifier>
  <sender>${esc(alert.sender)}</sender>
  <sent>${capTime(alert.sent)}</sent>
  <status>${alert.status}</status>
  <msgType>${alert.msgType}</msgType>
  <scope>${alert.scope}</scope>${alert.references?.length ? `\n  <references>${esc(alert.references.join(' '))}</references>` : ''}
  <info>
    <language>${i.language}</language>
    <category>${i.category}</category>
    <event>${esc(i.event)}</event>
    <urgency>${i.urgency}</urgency>
    <severity>${i.severity}</severity>
    <certainty>${i.certainty}</certainty>
    <senderName>${esc(alert.senderName)}</senderName>
    <headline>${esc(i.headline)}</headline>
    <description>${esc(i.description)}</description>
    <instruction>${esc(i.instruction)}</instruction>${i.web ? `\n    <web>${esc(i.web)}</web>` : ''}
    <effective>${capTime(i.effective)}</effective>
    <expires>${capTime(i.expires)}</expires>
${params}
    <parameter><valueName>disclaimer</valueName><value>${esc(i.disclaimer)}</value></parameter>${(i.official ?? []).map((o) => `\n    <parameter><valueName>officialReference</valueName><value>${esc(`${o.authority}: ${o.title}${o.url ? ` ${o.url}` : ''}`)}</value></parameter>`).join('')}
    <area>
      <areaDesc>${esc(i.area.areaDesc)}</areaDesc>${i.area.circle ? `\n      <circle>${i.area.circle}</circle>` : ''}${(i.area.circles ?? []).map((c) => `\n      <circle>${c}</circle>`).join('')}
    </area>
  </info>
</alert>
`
}

/** Pesan Telegram (Markdown lama, aman untuk karakter umum). */
export function renderTelegram(alert) {
  const i = alert.info
  const em = `${LEVEL_EMOJI[alert.level] ?? '⚪'}${EMOJI[alert.hazard] ?? ''}`
  const tag = alert.msgType === 'Update' ? ' (pembaruan)' : alert.msgType === 'Cancel' ? ' (dicabut)' : ''
  const lines = [`${em} *${i.headline}*${tag}`, `_${wibClock(alert.sent)} WIB · berlaku s.d. ${wibClock(i.expires)} WIB_`]
  if (alert.msgType !== 'Cancel') {
    if (i.description) lines.push(i.description)
    if (i.instruction) lines.push(`➡️ ${i.instruction}`)
  }
  if (i.sources?.length) lines.push(`Sumber: ${i.sources.join(' · ')}`)
  if (i.official?.length) lines.push(`⚠️ Peringatan resmi aktif: ${i.official.map((o) => `${o.authority} — ${o.title}${o.url ? ` (${o.url})` : ''}`).join('; ')}`)
  lines.push(`_${i.disclaimer}_`)
  if (i.web) lines.push(i.web)
  return lines.join('\n')
}

/** Teks WhatsApp (sama dengan Telegram tanpa sintaks _ miring_ ganda). */
export function renderWhatsApp(alert) {
  return renderTelegram(alert).replace(/^_(.*)_$/gm, '$1')
}

/** SMS ≤ 160 karakter. */
export function renderSms(alert, maxLen = 160) {
  const i = alert.info
  const lvl = alert.msgType === 'Cancel' ? 'DICABUT' : LEVEL_LABEL[alert.level].toUpperCase()
  const name = alert.location.name.replace(/\s+/g, '')
  const head = `NGA ${name} ${wibClock(alert.sent).split(' ').pop()}: ${lvl} ${EVENT[alert.hazard] ?? alert.hazard}.`
  const tail = ' Info model,bkn resmi. Darurat 112'
  let body = alert.msgType === 'Cancel' ? '' : ` ${String(i.instruction ?? '').split(/(?<=[.;])\s/)[0] ?? ''}`
  let text = `${head}${body}${tail}`
  if (text.length > maxLen) {
    const room = maxLen - head.length - tail.length
    body = room > 10 ? `${body.slice(0, room - 1).replace(/\s+\S*$/, '')}…` : ''
    text = `${head}${body}${tail}`
  }
  return text.slice(0, maxLen)
}

/** Ringkasan satu siklus untuk log/feed. */
export function summarizeCycle(dispatched) {
  const by = { Alert: 0, Update: 0, Cancel: 0 }
  for (const d of dispatched) by[d.alert.msgType] = (by[d.alert.msgType] ?? 0) + 1
  return { sent: dispatched.length, ...by }
}
