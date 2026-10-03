#!/usr/bin/env node
// Niu Gayo Agroclimate — API proxy kecil (http murni, tanpa dependensi).
// Port 7455 (default). Endpoint:
//   /healthz           — status layanan + statistik cache
//   /api/weather       — proxy Open-Meteo (TTL 10 menit, PROXY_TTL_MIN)
//   /api/ensemble      — proxy ensemble 50 member (TTL 30 menit)
//   /api/alerts        — agregat skor 15 lokasi + indeks hujan DAS + ARI
//   /api/consensus     — F1 konsensus multi-model per lokasi (ADR-8)
//   /api/bmkg-nowcast  — F5 peringatan dini resmi BMKG (ADR-10, TTL 10 menit)
import http from 'node:http'
import { PORT, PROXY_TTL_MIN, ENSEMBLE_TTL_MIN, ALERTS_TTL_MIN, WN2_TTL_MIN, BMKG_TTL_MIN } from './config.js'
import { cached, clearCache, cacheStats } from './cache.js'
import { getWeatherForLocation, fetchEnsemble, fetchAllAlerts, computeConsensus } from './openMeteo.js'
import { fetchBmkgNowcast } from './bmkg.js'
import { seasonalInfo } from '../src/domain/seasonal.js'
import disasterHistory from '../src/data/disasterHistory.json' with { type: 'json' }
import { validateReport, rateLimited, submitReport, recentReports } from './reports.js'

const VALID_LOCATIONS = new Set([
  'bebesan', 'takengon', 'pegasing', 'kutepanang', 'atulintang',
  'jagongjeget', 'luttawar', 'bintang', 'kebayakan', 'bies',
  'silihnara', 'ketol', 'celala', 'rusipantara', 'linge',
])

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  })
  res.end(data)
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

const weatherGet = (id) => cached(`weather:${id}`, PROXY_TTL_MIN * 60_000, () => getWeatherForLocation(id))
const ensembleGet = (id) => cached(`ensemble:${id}`, ENSEMBLE_TTL_MIN * 60_000, () => fetchEnsemble(id))
const alertsGet = () => cached('alerts:all', ALERTS_TTL_MIN * 60_000, () => fetchAllAlerts(weatherGet))
const bmkgGet = () => cached('bmkg:nowcast', BMKG_TTL_MIN * 60_000, () => fetchBmkgNowcast())
// F1: consensus per lokasi — cache 30 menit (termasuk WN2 yang kuotanya ketat).
const consensusGet = (id) =>
  cached(`consensus:${id}`, WN2_TTL_MIN * 60_000, async () => {
    const bmkg = await bmkgGet()
    return computeConsensus(id, { bmkgAlertActive: bmkg.active })
  })

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
  const path = url.pathname
  try {
    if (path === '/healthz') {
      return json(res, 200, { ok: true, uptime: process.uptime(), cache: cacheStats() })
    }
    if (path === '/api/weather') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      const data = await weatherGet(id)
      return json(res, 200, data)
    }
    if (path === '/api/ensemble') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      const data = await ensembleGet(id)
      return json(res, 200, data)
    }
    if (path === '/api/alerts') {
      const data = await alertsGet()
      return json(res, 200, data)
    }
    if (path === '/api/consensus') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      const data = await consensusGet(id)
      return json(res, 200, data)
    }
    if (path === '/api/bmkg-nowcast') {
      const data = await bmkgGet()
      return json(res, 200, data)
    }
    // F7 — kalender musiman (bulan WIB saat ini)
    if (path === '/api/seasonal') {
      const month = Number(url.searchParams.get('month')) || Number(
        new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', month: 'numeric' }).format(new Date())
      )
      if (!(month >= 1 && month <= 12)) return json(res, 400, { error: "parameter 'month' harus 1–12" })
      return json(res, 200, seasonalInfo(month))
    }
    // F4 — riwayat bencana per sentra (statis terkurasi; upgrade DIBI API menunggu endpoint)
    if (path === '/api/disaster-history') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      const events = disasterHistory.events
        .filter((e) => e.locations.includes(id))
        .sort((a, b) => b.date.localeCompare(a.date))
      return json(res, 200, {
        count: events.length,
        lastEvents: events.slice(0, 5).map((e) => ({ type: e.type, date: e.date, year: e.year, title: e.title, source: e.source })),
        source: 'curated-public-reports',
      })
    }
    // F8 — laporan warga (POST simpan + relay Telegram #55; GET riwayat 7 hari)
    if (path === '/api/reports') {
      if (req.method === 'POST') {
        const ip = (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '?').split(',')[0].trim()
        if (rateLimited(ip)) return json(res, 429, { error: 'batas 5 laporan/jam terlampaui' })
        let body = ''
        for await (const chunk of req) {
          body += chunk
          if (body.length > 10_000) return json(res, 413, { error: 'payload terlalu besar' })
        }
        const parsed = validateReport(safeJson(body))
        if (parsed.error) return json(res, 400, { error: parsed.error })
        const result = await submitReport(parsed.report)
        return json(res, 201, result)
      }
      const location = url.searchParams.get('location')
      if (location && !VALID_LOCATIONS.has(location)) {
        return json(res, 400, { error: "parameter 'location' harus id lokasi yang valid" })
      }
      const reports = recentReports(location)
      return json(res, 200, { count: reports.length, reports })
    }
    if (path === '/api/cache/flush' && req.method === 'POST') {
      clearCache()
      return json(res, 200, { ok: true })
    }
    return json(res, 404, { error: 'not found' })
  } catch (err) {
    console.error(`[api] ${path}:`, err.message)
    return json(res, 502, { error: err.message })
  }
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] agroclimate-api listening on 127.0.0.1:${PORT} (ttl weather=${PROXY_TTL_MIN}m ensemble=${ENSEMBLE_TTL_MIN}m wn2=${WN2_TTL_MIN}m bmkg=${BMKG_TTL_MIN}m)`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
