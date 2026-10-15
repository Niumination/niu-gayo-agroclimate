// Fase 1.8 / 1.8b — siklus peringatan multi-bahaya: evaluasi 15 sentra → anti-bising → CAP JSON → Telegram (topik cron).
// Dipicu oleh POST /api/alerts/run (scripts/alerts-cron.mjs via systemd timer) atau dipanggil langsung di test (dryRun).
// Status kiriman terakhir: server/data/alert-state.json; log: server/data/alert-log.jsonl (feed /api/alerts/feed).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { LOCATIONS } from '../src/data/locations.js'
import { buildAlert, buildGroupAlert, decideDispatch, renderTelegram, summarizeCycle, shouldPush, MIN_INTERVAL_H, GROUP_MIN } from '../src/domain/alert.js'
import { readToken } from './reports.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DEFAULT_DATA_DIR = path.join(__dirname, 'data')
export const PUBLIC_URL = process.env.PUBLIC_URL || 'https://niumination.id/agroclimate/'

function stateFile(dir) { return path.join(dir, 'alert-state.json') }
function logFile(dir) { return path.join(dir, 'alert-log.jsonl') }

export function loadState(dir = DEFAULT_DATA_DIR) {
  try {
    return JSON.parse(fs.readFileSync(stateFile(dir), 'utf8'))
  } catch {
    return {}
  }
}
export function saveState(state, dir = DEFAULT_DATA_DIR) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(stateFile(dir), JSON.stringify(state, null, 1))
}
export function appendLog(entries, dir = DEFAULT_DATA_DIR) {
  if (!entries.length) return
  fs.mkdirSync(dir, { recursive: true })
  fs.appendFileSync(logFile(dir), entries.map((e) => JSON.stringify(e)).join('\n') + '\n')
}
/** Feed: peringatan dalam `hours` jam terakhir (terbaru dulu), opsional filter lokasi/bahaya. */
export function readFeed({ hours = 24, now = new Date().toISOString(), location = null, hazard = null, limit = 100, dir = DEFAULT_DATA_DIR } = {}) {
  let lines = []
  try {
    lines = fs.readFileSync(logFile(dir), 'utf8').split('\n').filter(Boolean)
  } catch {
    return []
  }
  const cutoff = new Date(now).getTime() - hours * 3_600_000
  const out = []
  for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
    let a
    try { a = JSON.parse(lines[i]) } catch { continue }
    if (new Date(a.sent).getTime() < cutoff) break
    if (location && a.location?.id !== location) continue
    if (hazard && a.hazard !== hazard) continue
    out.push(a)
  }
  return out
}

/** Kirim teks ke Telegram (topik cron). Tidak throw. */
export async function sendTelegram(text, { fetchImpl = fetch, token = readToken('TELEGRAM_BOT_TOKEN'), chatId = readToken('TELEGRAM_HOME_CHANNEL'), topicId = readToken('TELEGRAM_CRON_THREAD_ID') || '55' } = {}) {
  if (!token || !chatId) return { ok: false, error: 'TELEGRAM_BOT_TOKEN/TELEGRAM_HOME_CHANNEL tidak tersedia' }
  try {
    const res = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, message_thread_id: Number(topicId), text, parse_mode: 'Markdown', disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return { ok: false, error: `telegram ${res.status}` }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

/**
 * Satu siklus: `all` = hasil getHazardsAll (dengan `_full`). Menentukan msgType per (sentra, bahaya), membangun CAP,
 * mengirim (kecuali dryRun), memperbarui state & log.
 * @returns {{ now, decided: object[], sent: object[], skipped: number, summary, errors: string[] }}
 */
export async function runAlertCycle(all, { now = new Date().toISOString(), dryRun = false, dir = DEFAULT_DATA_DIR, send = sendTelegram, minIntervalH = MIN_INTERVAL_H, maxPerCycle = 12, groupMin = GROUP_MIN, url = PUBLIC_URL } = {}) {
  const state = loadState(dir)
  const decided = [] // { key, result, location, last, msgType }
  for (const row of all._full ?? []) {
    const location = LOCATIONS.find((l) => l.id === row.id) ?? { id: row.id, name: row.name }
    for (const result of row.hazards ?? []) {
      if (result.level === 'n/a') continue // data tidak ada / tidak berlaku → tidak pernah memicu Cancel palsu
      const key = `${row.id}:${result.id}`
      const last = state[key] ?? null
      // Kebijakan push: level di bawah ambang kirim diperlakukan seperti "tidak aktif" (dapat memicu Cancel bila sebelumnya terkirim).
      const effectiveLevel = shouldPush(result.id, result.level) ? result.level : 'rendah'
      if (!last && effectiveLevel === 'rendah') continue
      const msgType = decideDispatch({ level: effectiveLevel, last, now, minIntervalH })
      if (!msgType) continue
      decided.push({ key, result, location, last, msgType })
    }
  }

  // Pengelompokan: bahaya + level + msgType sama di ≥ groupMin sentra → satu pesan gabungan (anti-bising).
  const groups = new Map()
  for (const d of decided) {
    const g = `${d.result.id}|${d.result.level}|${d.msgType}`
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g).push(d)
  }
  const refsOf = (items) => items.filter((d) => d.last?.identifier).map((d) => `${d.last.sender ?? 'agroclimate@niumination.id'},${d.last.identifier},${d.last.sentAt}`)
  const messages = []
  for (const items of groups.values()) {
    if (items.length >= groupMin) {
      messages.push({ keys: items.map((d) => d.key), alert: buildGroupAlert({ items, now, msgType: items[0].msgType, references: refsOf(items), url }) })
    } else {
      for (const d of items) messages.push({ keys: [d.key], alert: buildAlert({ result: d.result, location: d.location, now, msgType: d.msgType, references: refsOf([d]), url }) })
    }
  }
  // Prioritas: level tertinggi dulu, lalu Alert > Update > Cancel; batasi per siklus agar tidak membanjiri kanal.
  const rank = { ekstrem: 3, bahaya: 2, waspada: 1, rendah: 0 }
  const typeRank = { Alert: 3, Update: 2, Cancel: 1 }
  messages.sort((a, b) => (rank[b.alert.level] - rank[a.alert.level]) || (typeRank[b.alert.msgType] - typeRank[a.alert.msgType]))
  const batch = messages.slice(0, maxPerCycle)

  const sent = []
  const errors = []
  for (const m of batch) {
    const text = renderTelegram(m.alert)
    let res = { ok: true, dryRun: true }
    if (!dryRun) res = await send(text)
    if (!res.ok) {
      errors.push(`${m.keys.join(',')}: ${res.error}`)
      continue
    }
    for (const key of m.keys) {
      if (m.alert.msgType === 'Cancel') delete state[key]
      else state[key] = { level: m.alert.level, sentAt: now, identifier: m.alert.identifier, sender: m.alert.sender, msgType: m.alert.msgType }
    }
    sent.push({ ...m.alert, keys: m.keys, telegram: res.ok && !res.dryRun, dryRun: !!dryRun })
  }
  if (!dryRun) {
    saveState(state, dir)
    appendLog(sent, dir)
  }
  return {
    now,
    decided: decided.map((d) => ({ key: d.key, msgType: d.msgType, level: d.result.level })),
    messages: messages.length,
    sent,
    skipped: messages.length - batch.length,
    summary: summarizeCycle(sent.map((a) => ({ alert: a }))),
    errors,
    dryRun,
  }
}
