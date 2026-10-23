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
//   /api/hazards       — v2 registry bahaya (ADR-12): 11 bahaya per lokasi terurut level + interaksi / ?location=all ringkasan 15 sentra (TTL HAZARDS_TTL_MIN)
//   /api/alerts/feed   — 1.8b feed peringatan CAP-JSON 24 jam terakhir (?hours, ?location, ?hazard; ?format=cap&id=<identifier> → CAP 1.2 XML)
//   /api/alerts/run    — 1.8 POST siklus peringatan (anti-bising 6 jam, Telegram topik cron); ?dryRun=1 tanpa kirim/simpan; header x-cron-token bila ALERTS_CRON_TOKEN diset
//   /api/drought       — H-KERING HTH kelas BMKG + neraca air 30 hari + SPI-1/3 (baseline 1991–2020) per lokasi (arsip ERA5 TTL 12 jam)
//   /api/quakes        — H-GEMPA gempa BMKG relevan (?location= → jarak/MMI indikatif per sentra)
//   /api/volcano       — H-VULKANIK tingkat aktivitas Burni Telong (MAGMA) + sektor bawah angin
//   /api/convective    — H-PETIR indeks konvektif ECMWF+GFS per lokasi (TTL 30 menit)
//   /api/flood         — H-BANJIR+ debit GloFAS 4 sel DAS Peusangan + anomali klimatologi (TTL 6 jam)
//   /api/external-reports — laporan warga PetaBencana.id untuk Gayo (CC BY-NC, TTL 10 menit)
import http from 'node:http'
import { PORT, PROXY_TTL_MIN, ENSEMBLE_TTL_MIN, ALERTS_TTL_MIN, WN2_TTL_MIN, BMKG_TTL_MIN, AQ_TTL_MIN, ARCHIVE_TTL_MIN, FIRMS_TTL_MIN, FIRMS_MAP_KEY, HAZARDS_TTL_MIN, HAZARDS_ENABLED, QUAKE_TTL_MIN, VOLCANO_TTL_MIN, CONVECTIVE_TTL_MIN, FLOOD_TTL_MIN, PETABENCANA_TTL_MIN } from './config.js'
import { BUILD_INFO } from './buildInfo.js'
import { cached, clearCache, cacheStats, peek } from './cache.js'
import { getWeatherForLocation, fetchEnsemble, fetchAllAlerts, computeConsensus } from './openMeteo.js'
import { fetchBmkgNowcast } from './bmkg.js'
import { getAirQualityForLocation, getAirQualitySummary } from './airQuality.js'
import { getArchiveForLocation } from './archive.js'
import { getHotspots, hotspotsForLocation } from './firms.js'
import { getFireDanger, getFireDangerSummary } from './fireWeather.js'
import { assessDrought } from '../src/domain/hazards/drought.js'
import { seasonalInfoExtended } from '../src/domain/seasonal.js'
import climateOutlook from '../src/data/hazards/climateOutlook.json' with { type: 'json' }
import disasterHistory from '../src/data/disasterHistory.json' with { type: 'json' }
import { validateReport, rateLimited, submitReport, recentReports, readToken, clientIp } from './reports.js'
import { getHazardsForLocation, getHazardsAll, archiveSnapshot } from './hazards.js'
import { runAlertCycle, readFeed } from './alerts.js'
import { getQuakes, quakesForLocation } from './bmkgQuake.js'
import { getVolcanoStatus } from './magma.js'
import { getConvective } from './convective.js'
import { getFlood } from './flood.js'
import { getExternalReports } from './petabencana.js'
import { computeSpi, loadSpiBaseline } from './spi.js'
import { toCapXml } from '../src/domain/alert.js'
import { parseEnabled } from '../src/domain/hazards/index.js'
import { LOCATIONS } from '../src/data/locations.js'
import { createHandler } from './routes.js'

const VALID_LOCATIONS = new Set(LOCATIONS.map((l) => l.id)) // Fase 0.2: satu sumber kebenaran (src/data/locations.js)

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
const PKG_VERSION = BUILD_INFO.version
// Fase 2.1 / 2.2b — gempa BMKG (TTL 2 menit) & Burni Telong MAGMA (TTL 60 menit); payload degraded tidak di-cache lama.
const quakesAllGet = () =>
  cached('quakes:all', QUAKE_TTL_MIN * 60_000, async () => {
    const data = await getQuakes()
    if (data.degraded && !data.quakes?.length) throw new Error(data.error || 'quakes degraded')
    return data
  }).catch((err) => ({ retrievedAt: new Date().toISOString(), degraded: true, error: err.message, quakes: [], latest: null }))
const quakesGet = (id) => quakesAllGet().then((all) => quakesForLocation(all, LOCATIONS.find((l) => l.id === id)))
const volcanoGet = () =>
  cached('volcano:status', VOLCANO_TTL_MIN * 60_000, async () => {
    const data = await getVolcanoStatus()
    if (!data.volcano) throw new Error(data.error || 'volcano degraded')
    return data
  }).catch((err) => ({ retrievedAt: new Date().toISOString(), degraded: true, error: err.message, volcano: null, wind: null, downwind: [] }))
// Fase 2.3 / 2.4 / 2.4b — konvektif per lokasi (TTL 30 menit), GloFAS 4 sel (TTL 6 jam, nilai terakhir bila gagal), PetaBencana (TTL 10 menit).
const convectiveGet = (id) =>
  cached(`convective:${id}`, CONVECTIVE_TTL_MIN * 60_000, async () => {
    const data = await getConvective(id)
    if (!data.hourly) throw new Error(data.error || 'convective degraded')
    return data
  }).catch((err) => ({ location: { id }, retrievedAt: new Date().toISOString(), degraded: true, error: err.message, sources: [], hourly: null }))
const floodGet = () =>
  cached('flood:all', FLOOD_TTL_MIN * 60_000, async () => {
    const data = await getFlood()
    if (!data.cells?.length) throw new Error(data.degradedCells?.join('; ') || 'flood degraded')
    return data
  }).catch((err) => ({ retrievedAt: new Date().toISOString(), degraded: true, error: err.message, cells: [], worst: null }))
const externalReportsGet = () => cached('petabencana:aceh', PETABENCANA_TTL_MIN * 60_000, () => getExternalReports())
const SPI_BASELINE = loadSpiBaseline()
const hazardsGet = (id) =>
  cached(`hazards:${id}`, HAZARDS_TTL_MIN * 60_000, () =>
    getHazardsForLocation(id, { weatherGet, aqGet, fireGet, archiveGet, reportsGet: async (l) => ({ reports: recentReports(l) }), quakesGet, volcanoGet, convectiveGet, floodGet, nowcastGet: bmkgGet, spiBaseline: SPI_BASELINE, enabled: HAZARDS_ON })
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

// F-09: perakitan konteks untuk router (server/routes.js) — dependensi eksplisit, tanpa variabel implisit.
const handler = createHandler({
  VALID_LOCATIONS, LOCATIONS, peek, cacheStats, clearCache,
  weatherGet, ensembleGet, alertsGet, bmkgGet, aqGet, aqSummaryGet, archiveGet,
  hotspotsGet, hotspotsForLocation, fireGet, fireSummaryGet,
  quakesAllGet, quakesForLocation, volcanoGet, convectiveGet, floodGet, externalReportsGet,
  hazardsGet, hazardsAllGet, consensusGet,
  SPI_BASELINE, computeSpi, assessDrought, seasonalInfoExtended, climateOutlook, disasterHistory,
  readFeed, runAlertCycle, toCapXml,
  validateReport, rateLimited, submitReport, recentReports, clientIp,
  PKG_VERSION, BUILD_INFO, HAZARDS_ON, FIRMS_MAP_KEY, readToken,
})

const server = http.createServer(handler)

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] agroclimate-api listening on 127.0.0.1:${PORT} (ttl weather=${PROXY_TTL_MIN}m ensemble=${ENSEMBLE_TTL_MIN}m wn2=${WN2_TTL_MIN}m bmkg=${BMKG_TTL_MIN}m aq=${AQ_TTL_MIN}m archive=${ARCHIVE_TTL_MIN}m firms=${FIRMS_TTL_MIN}m${FIRMS_MAP_KEY ? '' : ' [FIRMS_MAP_KEY kosong → hotspot degraded]'})`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 2000).unref()
  })
}
