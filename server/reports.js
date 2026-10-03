// F8 — laporan warga: simpan JSON + relay Telegram topic #55.
// Tanpa auth (data non-PII), rate limit sederhana per IP 5/jam.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

const VALID_TYPES = new Set(['longsor', 'banjir', 'angin', 'karat'])
const VALID_LOCATIONS = new Set([
  'bebesan', 'takengon', 'pegasing', 'kutepanang', 'atulintang',
  'jagongjeget', 'luttawar', 'bintang', 'kebayakan', 'bies',
  'silihnara', 'ketol', 'celala', 'rusipantara', 'linge',
])

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
  const { location, type, note } = body || {}
  if (!VALID_LOCATIONS.has(location)) return { error: "field 'location' harus id sentra yang valid" }
  if (!VALID_TYPES.has(type)) return { error: "field 'type' harus salah satu: longsor, banjir, angin, karat" }
  const cleanNote = String(note || '').slice(0, 500) // bukan PII, batasi panjang
  return { report: { location, type, note: cleanNote } }
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
  const text = `📍 *Laporan warga* — ${report.location}\nJenis: ${report.type}${report.note ? `\nCatatan: ${report.note}` : ''}\nWaktu: ${report.timestamp}`
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

/** Laporan 7 hari terakhir untuk satu lokasi (atau semua bila location kosong). */
export function recentReports(location) {
  const since = Date.now() - 7 * 24 * HOUR_MS
  return loadReports()
    .filter((r) => (!location || r.location === location) && new Date(r.timestamp).getTime() >= since)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
