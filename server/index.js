#!/usr/bin/env node
// Niu Gayo Agroclimate — API proxy kecil (http murni, tanpa dependensi).
// Port 7455 (default). Endpoint:
//   /healthz           — status layanan + statistik cache
//   /api/weather       — proxy Open-Meteo (TTL 10 menit, PROXY_TTL_MIN)
//   /api/ensemble      — proxy ensemble 50 member (TTL 30 menit)
//   /api/alerts        — agregat skor 15 lokasi + indeks hujan DAS + ARI
//   /api/consensus     — F1 konsensus multi-model per lokasi (ADR-8)
//   /api/bmkg-nowcast  — F5 peringatan dini resmi BMKG (ADR-10, TTL 10 menit)
//   /api/air-quality   — H-ASAP ISPU estimasi (CAMS) + proksi kabut asap per lokasi / ?location=all (TTL 60 menit)
//   /api/hotspots      — H-API hotspot NASA FIRMS 48 jam (bbox Aceh Tengah+50 km) + ringkasan per sentra / ?location=<id> (TTL 30 menit)
//   /api/fire-danger   — H-API FWI harian (spin-up arsip ERA5) + hotspot + HTH per lokasi / ?location=all
//   /api/hazards       — v2 registry bahaya (ADR-12): 7 bahaya per lokasi terurut level / ?location=all ringkasan 15 sentra (TTL HAZARDS_TTL_MIN)
//   /api/alerts/feed   — 1.8b feed peringatan CAP-JSON 24 jam terakhir (?hours, ?location, ?hazard; ?format=cap&id=<identifier> → CAP 1.2 XML)
//   /api/alerts/run    — 1.8 POST siklus peringatan (anti-bising 6 jam, Telegram topik cron); ?dryRun=1 tanpa kirim/simpan; header x-cron-token bila ALERTS_CRON_TOKEN diset
//   /api/drought       — H-KERING HTH kelas BMKG + neraca air 30 hari per lokasi (arsip ERA5 TTL 12 jam)
import http from 'node:http'
import fs from 'node:fs'
import { PORT, PROXY_TTL_MIN, ENSEMBLE_TTL_MIN, ALERTS_TTL_MIN, WN2_TTL_MIN, BMKG_TTL_MIN, AQ_TTL_MIN, ARCHIVE_TTL_MIN, FIRMS_TTL_MIN, FIRMS_MAP_KEY, HAZARDS_TTL_MIN, HAZARDS_ENABLED } from './config.js'
import { cached, clearCache, cacheStats, peek } from './cache.js'
import { getWeatherForLocation, fetchEnsemble, fetchAllAlerts, computeConsensus } from './openMeteo.js'
import { fetchBmkgNowcast } from './bmkg.js'
import { getAirQualityForLocation, getAirQualitySummary } from './airQuality.js'
import { getArchiveForLocation } from './archive.js'
import { getHotspots, hotspotsForLocation } from './firms.js'
import { getFireDanger, getFireDangerSummary } from './fireWeather.js'
import { assessDrought } from '../src/domain/hazards/drought.js'
import { seasonalInfo } from '../src/domain/seasonal.js'
import disasterHistory from '../src/data/disasterHistory.json' with { type: 'json' }
import { validateReport, rateLimited, submitReport, recentReports, readToken } from './reports.js'
import { getHazardsForLocation, getHazardsAll, archiveSnapshot } from './hazards.js'
import { runAlertCycle, readFeed } from './alerts.js'
import { toCapXml } from '../src/domain/alert.js'
import { parseEnabled } from '../src/domain/hazards/index.js'
import { LOCATIONS } from '../src/data/locations.js'

const VALID_LOCATIONS = new Set(LOCATIONS.map((l) => l.id)) // Fase 0.2: satu sumber kebenaran (src/data/locations.js)

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
// H-ASAP — payload degraded (fetch gagal) tidak di-cache lama agar pulih cepat.
const aqGet = (id) =>
  cached(`aq:${id}`, AQ_TTL_MIN * 60_000, async () => {
    const data = await getAirQualityForLocation(id)
    if (data.degraded) throw new Error(data.error || 'air-quality degraded')
    return data
  }).catch((err) => ({ location: { id }, retrievedAt: new Date().toISOString(), degraded: true, error: err.message, assessment: null }))
const aqSummaryGet = () => cached('aq:all', AQ_TTL_MIN * 60_000, () => getAirQualitySummary(aqGet))
// H-KERING/H-API — arsip ERA5 + prakiraan past_days per lokasi (TTL 12 jam; payload degraded tidak di-cache lama).
const archiveGet = (id) =>
  cached(`archive:${id}`, ARCHIVE_TTL_MIN * 60_000, async () => {
    const data = await getArchiveForLocation(id)
    if (!data.daily) throw new Error(data.error || 'archive degraded')
    return data
  })
// H-API — hotspot FIRMS (TTL 30 menit). Tanpa kunci: payload degraded (tidak throw) agar kartu tetap tampil.
const hotspotsGet = () =>
  cached('firms:all', FIRMS_TTL_MIN * 60_000, async () => {
    const data = await getHotspots()
    if (data.degraded && FIRMS_MAP_KEY) throw new Error(data.reason || 'firms degraded')
    return data
  })
const fireGet = (id) => getFireDanger(id, { archiveGet, hotspotsGet })
const fireSummaryGet = () => cached('fire:all', PROXY_TTL_MIN * 60_000, () => getFireDangerSummary(fireGet))
// v2 registry bahaya (ADR-12) — satu evaluasi per sentra (TTL 10 menit), ringkasan 15 sentra + arsip harian (1.10b, best-effort).
const HAZARDS_ON = parseEnabled(HAZARDS_ENABLED)
const PKG_VERSION = (() => {
  try {
    return JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
  } catch {
    return null
  }
})()
const hazardsGet = (id) =>
  cached(`hazards:${id}`, HAZARDS_TTL_MIN * 60_000, () =>
    getHazardsForLocation(id, { weatherGet, aqGet, fireGet, archiveGet, reportsGet: async (l) => ({ reports: recentReports(l) }), enabled: HAZARDS_ON })
  )
const hazardsAllGet = () =>
  cached('hazards:all', HAZARDS_TTL_MIN * 60_000, async () => {
    const all = await getHazardsAll(hazardsGet)
    try {
      archiveSnapshot(all)
    } catch (err) {
      console.warn('[api] arsip bahaya gagal:', err.message)
    }
    return all
  })
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
      // NFR: status per sumber dari cache (tanpa memicu fetch) + fitur aktif
      const src = (key) => {
        const p = peek(key)
        if (!p) return { state: 'belum-dimuat' }
        const v = p.value ?? {}
        return { state: v.degraded ? 'degraded' : 'ok', fresh: p.fresh, retrievedAt: v.retrievedAt ?? v.generatedAt ?? null, error: v.error ?? v.reason ?? undefined }
      }
      return json(res, 200, {
        ok: true,
        version: PKG_VERSION,
        uptime: process.uptime(),
        cache: cacheStats(),
        features: { hazardsEnabled: HAZARDS_ON, firmsKey: !!FIRMS_MAP_KEY, telegram: !!readToken('TELEGRAM_BOT_TOKEN'), cronToken: !!process.env.ALERTS_CRON_TOKEN },
        sources: { alerts: src('alerts:all'), bmkgNowcast: src('bmkg:nowcast'), airQuality: src('aq:all'), hotspots: src('firms:all'), fireDanger: src('fire:all'), hazards: src('hazards:all') },
      })
    }
    if (path === '/api/weather') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      const { raw, ...data } = await weatherGet(id)
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
      // 1.8: agregat lama + ringkasan ISPU (H-ASAP) + level registry per sentra (best-effort, tidak memblokir bila gagal)
      const [base, aq, hz] = await Promise.allSettled([alertsGet(), aqSummaryGet(), hazardsAllGet()])
      if (base.status !== 'fulfilled') throw base.reason
      const data = { ...base.value }
      data.airQuality = aq.status === 'fulfilled' ? { retrievedAt: aq.value.retrievedAt, worst: aq.value.worst ?? null, degradedCount: aq.value.degradedCount ?? null, locations: (aq.value.locations ?? []).map((l) => ({ id: l.id, level: l.level, ispu: l.ispu, category: l.category ?? null, haze: l.haze ?? null })) } : { degraded: true, error: aq.reason?.message }
      data.hazards = hz.status === 'fulfilled' ? { retrievedAt: hz.value.retrievedAt, worst: hz.value.worst, activeByHazard: hz.value.activeByHazard, locations: hz.value.locations.map((l) => ({ id: l.id, worst: l.worst, active: l.active, levels: l.levels })) } : { degraded: true, error: hz.reason?.message }
      return json(res, 200, data)
    }
    // v2 — registry bahaya per lokasi / ringkasan semua sentra
    if (path === '/api/hazards') {
      const id = url.searchParams.get('location')
      if (id === 'all') {
        const { _full, ...all } = await hazardsAllGet()
        return json(res, 200, all)
      }
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib: id lokasi yang valid atau 'all'" })
      }
      return json(res, 200, await hazardsGet(id))
    }
    // 1.8b — feed peringatan (JSON) / satu peringatan sebagai CAP 1.2 XML
    if (path === '/api/alerts/feed') {
      const hours = Math.min(24 * 14, Math.max(1, Number(url.searchParams.get('hours')) || 24))
      const location = url.searchParams.get('location')
      const hazard = url.searchParams.get('hazard')
      const feed = readFeed({ hours, location: location && VALID_LOCATIONS.has(location) ? location : null, hazard })
      if (url.searchParams.get('format') === 'cap') {
        const wanted = url.searchParams.get('id')
        const alert = wanted ? feed.find((a) => a.identifier === wanted) : feed[0]
        if (!alert) return json(res, 404, { error: 'peringatan tidak ditemukan dalam jendela feed' })
        res.writeHead(200, { 'Content-Type': 'application/cap+xml; charset=utf-8', 'Access-Control-Allow-Origin': '*' })
        return res.end(toCapXml(alert))
      }
      return json(res, 200, { generatedAt: new Date().toISOString(), hours, count: feed.length, alerts: feed })
    }
    // 1.8 — siklus peringatan (dipanggil scripts/alerts-cron.mjs). Server hanya mendengar 127.0.0.1; token opsional.
    if (path === '/api/alerts/run') {
      if (req.method !== 'POST') return json(res, 405, { error: 'gunakan POST' })
      const token = process.env.ALERTS_CRON_TOKEN
      if (token && req.headers['x-cron-token'] !== token) return json(res, 403, { error: 'token cron tidak cocok' })
      const dryRun = ['1', 'true'].includes(url.searchParams.get('dryRun'))
      const [all, bmkg] = await Promise.all([hazardsAllGet(), bmkgGet().catch(() => null)])
      // ADR-22: rujukan peringatan resmi BMKG yang aktif untuk Aceh disertakan di setiap pesan
      const official = bmkg?.active ? (bmkg.alerts ?? []).filter((a) => a.isAceh !== false).slice(0, 3).map((a) => ({ authority: 'BMKG', title: a.title, link: a.link, pubDate: a.pubDate })) : []
      const result = await runAlertCycle(all, { dryRun, official })
      return json(res, 200, result)
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
    // H-ASAP — ISPU estimasi + proksi kabut asap (Fase 1)
    if (path === '/api/air-quality') {
      const id = url.searchParams.get('location')
      if (id === 'all') return json(res, 200, await aqSummaryGet())
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid (atau 'all')" })
      }
      const data = await aqGet(id)
      return json(res, 200, data)
    }
    // H-API — hotspot FIRMS (semua / per sentra ≤ 50 km)
    if (path === '/api/hotspots') {
      const id = url.searchParams.get('location')
      const all = await hotspotsGet()
      if (!id) return json(res, 200, all)
      if (!VALID_LOCATIONS.has(id)) return json(res, 400, { error: "parameter 'location' harus id lokasi yang valid" })
      return json(res, 200, hotspotsForLocation(all, id))
    }
    // H-API — bahaya kebakaran: FWI harian + hotspot + HTH
    if (path === '/api/fire-danger') {
      const id = url.searchParams.get('location')
      if (id === 'all') return json(res, 200, await fireSummaryGet())
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid (atau 'all')" })
      }
      return json(res, 200, await fireGet(id))
    }
    // H-KERING — HTH kelas BMKG + neraca air 30 hari
    if (path === '/api/drought') {
      const id = url.searchParams.get('location')
      if (!id || !VALID_LOCATIONS.has(id)) {
        return json(res, 400, { error: "parameter 'location' wajib dan harus id lokasi yang valid" })
      }
      let archive
      try {
        archive = await archiveGet(id)
      } catch (err) {
        return json(res, 200, { location: { id }, retrievedAt: new Date().toISOString(), degraded: true, error: err.message, assessment: null })
      }
      const assessment = assessDrought(archive.daily, { today: archive.today })
      return json(res, 200, {
        location: archive.location,
        retrievedAt: new Date().toISOString(),
        source: archive.source,
        degraded: !assessment || archive.degraded,
        warnings: archive.warnings,
        archive: { archiveEnd: archive.archiveEnd, lagDays: archive.lagDays, today: archive.today, fromFile: archive.fromFile },
        assessment,
      })
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
      // 1.9d (FR-X-8): filter opsional ?hazard=<id>; respons memuat `hazard`, `emergencyStatus`, ringkasan per bahaya
      const hazardFilter = url.searchParams.get('hazard')
      const events = disasterHistory.events
        .filter((e) => e.locations.includes(id) && (!hazardFilter || (e.hazard ?? e.type) === hazardFilter))
        .sort((a, b) => b.date.localeCompare(a.date))
      const byHazard = {}
      for (const e of events) byHazard[e.hazard ?? e.type] = (byHazard[e.hazard ?? e.type] ?? 0) + 1
      return json(res, 200, {
        count: events.length,
        hazard: hazardFilter || null,
        byHazard,
        lastEvents: events.slice(0, 8).map((e) => ({ id: e.id, type: e.type, hazard: e.hazard ?? e.type, date: e.date, year: e.year, title: e.title, summary: e.summary ?? null, emergencyStatus: e.emergencyStatus ?? null, district: e.district ?? null, source: e.source })),
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
  console.log(`[api] agroclimate-api listening on 127.0.0.1:${PORT} (ttl weather=${PROXY_TTL_MIN}m ensemble=${ENSEMBLE_TTL_MIN}m wn2=${WN2_TTL_MIN}m bmkg=${BMKG_TTL_MIN}m aq=${AQ_TTL_MIN}m archive=${ARCHIVE_TTL_MIN}m firms=${FIRMS_TTL_MIN}m${FIRMS_MAP_KEY ? '' : ' [FIRMS_MAP_KEY kosong → hotspot degraded]'})`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
