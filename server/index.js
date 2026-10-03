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
