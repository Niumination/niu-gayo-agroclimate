// F8 — laporan warga: simpan JSON + relay Telegram topic #55.
// Tanpa auth (data non-PII), rate limit sederhana per IP 5/jam.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCATIONS } from '../src/data/locations.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, 'data')
const REPORTS_FILE = path.join(DATA_DIR, 'reports.json')
const RATE_LIMIT = 5 // per jam per IP
const HOUR_MS = 60 * 60 * 1000

// Baca token dari env / ~/.hermes/.env (pattern sama seperti office-bridge).
export function readToken(name) {
  if (process.env[name]) return process.env[name]
  try {
    const envPath = path.join(process.env.HOME || '/home/agentuser', '.hermes', '.env')
    const line = fs.readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith(`${name}=`))
    return line ? line.slice(name.length + 1).trim() : ''
  } catch {
    return ''
  }
}

// v2 Fase 1 (FR-ASAP-6): tipe `asap` (wajib skala jarak pandang) & `kebakaran`. Sprint 3 (FR-X-5): `kekeringan`, `badai` (sub-jenis konvektif).
// Fase 2.2b (FR-VULK-4): `abu` (hujan abu tipis/tebal) & `gas` (bau belerang).
// Fase 2.1 (FR-GEMPA-5 / FR-X-5): `gempa` = laporan "dirasakan" dengan `kind` skala MMI awam (lemah | sedang | kuat).
const VALID_TYPES = new Set(['longsor', 'banjir', 'angin', 'karat', 'asap', 'kebakaran', 'kekeringan', 'badai', 'abu', 'gas', 'gempa'])
const QUAKE_KINDS = new Set(['lemah', 'sedang', 'kuat'])
export const QUAKE_LABEL = { lemah: 'getaran lemah (II–III MMI: terasa oleh sebagian orang, benda gantung bergoyang)', sedang: 'getaran sedang (IV–V MMI: banyak orang terbangun, barang jatuh)', kuat: 'getaran kuat (≥ VI MMI: orang berlarian keluar, dinding retak)' }
export const ASH_KINDS = new Set(['tipis', 'tebal'])
export const ASH_LABEL = { tipis: 'hujan abu tipis (debu di daun/kendaraan)', tebal: 'hujan abu tebal (jarak pandang turun, atap tertutup)' }
export const GAS_KINDS = new Set(['ringan', 'menyengat'])
export const GAS_LABEL = { ringan: 'bau belerang ringan', menyengat: 'bau belerang menyengat / perih mata-tenggorokan' }
export const STORM_KINDS = new Set(['petir', 'hujan_es', 'puting_beliung'])
export const STORM_LABEL = { petir: 'petir/kilat dekat', hujan_es: 'hujan es', puting_beliung: 'puting beliung / angin puyuh' }
export const DROUGHT_SIGNS = new Set(['sumur_kering', 'daun_layu', 'sungai_surut'])
export const DROUGHT_LABEL = { sumur_kering: 'sumur/mata air mengering', daun_layu: 'daun kopi layu/gugur', sungai_surut: 'sungai/irigasi surut' }
export const VISIBILITY_SCALE = new Set(['>5km', '1-5km', '<1km'])
export const VISIBILITY_LABEL = { '>5km': 'jarak pandang > 5 km', '1-5km': 'jarak pandang 1–5 km', '<1km': 'jarak pandang < 1 km' }
const VALID_LOCATIONS = new Set(LOCATIONS.map((l) => l.id)) // Fase 0.2: satu sumber kebenaran (src/data/locations.js)

function ensureStore() {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  if (!fs.existsSync(REPORTS_FILE)) fs.writeFileSync(REPORTS_FILE, '[]')
}

export function loadReports() {
  try {
    return JSON.parse(fs.readFileSync(REPORTS_FILE, 'utf8'))
  } catch {
    return []
  }
}

function saveReports(list) {
  ensureStore()
  fs.writeFileSync(REPORTS_FILE, JSON.stringify(list, null, 2))
}

// --- Rate limit per IP (in-memory) ---
const hits = new Map() // ip -> [timestamps]
export function rateLimited(ip) {
  const now = Date.now()
  const arr = (hits.get(ip) || []).filter((t) => now - t < HOUR_MS)
  if (arr.length >= RATE_LIMIT) {
    hits.set(ip, arr)
    return true
  }
  arr.push(now)
  hits.set(ip, arr)
  return false
}

/** Validasi body laporan. Return {error} atau laporan bersih. */
export function validateReport(body) {
  const { location, type, note, visibility, smell, active, kind, signs } = body || {}
  if (!VALID_LOCATIONS.has(location)) return { error: "field 'location' harus id sentra yang valid" }
  if (!VALID_TYPES.has(type)) return { error: `field 'type' harus salah satu: ${[...VALID_TYPES].join(', ')}` }
  const cleanNote = String(note || '').slice(0, 500) // bukan PII, batasi panjang
  const report = { location, type, note: cleanNote }
  if (type === 'asap') {
    if (!VISIBILITY_SCALE.has(visibility)) return { error: "laporan 'asap' wajib menyertakan 'visibility': >5km | 1-5km | <1km" }
    report.visibility = visibility
    report.smell = Boolean(smell)
  }
  if (type === 'kebakaran') report.active = active == null ? null : Boolean(active)
  if (type === 'badai') {
    if (!STORM_KINDS.has(kind)) return { error: "laporan 'badai' wajib menyertakan 'kind': petir | hujan_es | puting_beliung" }
    report.kind = kind
  }
  if (type === 'kekeringan') {
    const list = Array.isArray(signs) ? signs.filter((x) => DROUGHT_SIGNS.has(x)) : []
    report.signs = list
  }
  if (type === 'abu') {
    if (!ASH_KINDS.has(kind)) return { error: "laporan 'abu' wajib menyertakan 'kind': tipis | tebal" }
    report.kind = kind
  }
  if (type === 'gas') {
    if (!GAS_KINDS.has(kind)) return { error: "laporan 'gas' wajib menyertakan 'kind': ringan | menyengat" }
    report.kind = kind
  }
  if (type === 'gempa') {
    if (!QUAKE_KINDS.has(kind)) return { error: "laporan 'gempa' wajib menyertakan 'kind': lemah | sedang | kuat" }
    report.kind = kind
  }
  return { report }
}

function appendTimestamp(report) {
  return { ...report, timestamp: new Date().toISOString() }
}

/** Simpan laporan + relay Telegram. Return {saved, relayed, relayError?}. */
export async function submitReport(report) {
  const list = loadReports()
  const entry = appendTimestamp(report)
  list.push(entry)
  saveReports(list)
  const relay = await relayTelegram(entry)
  return { saved: entry, relayed: relay.ok, relayError: relay.ok ? undefined : relay.error }
}

async function relayTelegram(report) {
  const token = readToken('TELEGRAM_BOT_TOKEN')
  const chatId = readToken('TELEGRAM_HOME_CHANNEL')
  const topicId = readToken('TELEGRAM_CRON_THREAD_ID') || '55'
  if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_HOME_CHANNEL tidak tersedia' }
  const text = `📍 *Laporan warga* — ${report.location}\nJenis: ${report.type}${reportDetail(report)}${report.note ? `\nCatatan: ${report.note}` : ''}\nWaktu: ${report.timestamp}`
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_thread_id: Number(topicId), text, parse_mode: 'Markdown' }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: `telegram ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/** Baris detail tipe khusus untuk pesan relay. */
export function reportDetail(report) {
  if (report.type === 'asap') return `\nSkala: ${VISIBILITY_LABEL[report.visibility] ?? report.visibility}${report.smell ? ', bau asap menyengat' : ''}`
  if (report.type === 'kebakaran' && report.active != null) return `\nApi: ${report.active ? 'masih menyala' : 'sudah padam/tidak terlihat'}`
  if (report.type === 'badai') return `\nJenis: ${STORM_LABEL[report.kind] ?? report.kind}`
  if (report.type === 'abu') return `\nTebal: ${ASH_LABEL[report.kind] ?? report.kind}`
  if (report.type === 'gas') return `\nBau: ${GAS_LABEL[report.kind] ?? report.kind}`
  if (report.type === 'gempa') return `\nDirasakan: ${QUAKE_LABEL[report.kind] ?? report.kind}`
  if (report.type === 'kekeringan' && report.signs?.length) return `\nTanda: ${report.signs.map((x) => DROUGHT_LABEL[x] ?? x).join(', ')}`
  return ''
}

/** Laporan 7 hari terakhir untuk satu lokasi (atau semua bila location kosong). */
export function recentReports(location) {
  const since = Date.now() - 7 * 24 * HOUR_MS
  return loadReports()
    .filter((r) => (!location || r.location === location) && new Date(r.timestamp).getTime() >= since)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
