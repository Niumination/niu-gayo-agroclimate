/**
 * H-API — hotspot NASA FIRMS Area API (FR-API-1/2) untuk GET /api/hotspots.
 * 4 sumber (VIIRS S-NPP/NOAA-20/NOAA-21 NRT 375 m + MODIS NRT 1 km), bbox Aceh Tengah + buffer 50 km, 2 hari terakhir.
 * Tanpa dependensi; fetchImpl bisa disuntik. Tidak pernah throw:
 *   - FIRMS_MAP_KEY kosong → { degraded:true, reason:'FIRMS_MAP_KEY belum diatur' } (hotspots kosong)
 *   - sebagian sumber gagal → warnings[], sisanya tetap dipakai; semua gagal → degraded.
 * Kuota FIRMS: 5.000 transaksi / 10 menit per kunci → TTL 30 menit (FIRMS_TTL_MIN) sudah sangat longgar.
 */
import { FIRMS_API, FIRMS_MAP_KEY, FIRMS_BBOX, FIRMS_SOURCES, FIRMS_DAYS } from './config.js'
import { LOCATIONS } from '../src/data/locations.js'
import { parseFirmsCsv, mapHotspots, haversineKm, SOURCE_NOTE } from '../src/domain/hazards/hotspots.js'
import { HOTSPOT } from '../src/domain/thresholds.js'

export const FIRMS_SOURCE = {
  name: 'NASA FIRMS (LANCE) — VIIRS 375 m & MODIS 1 km, NRT',
  url: 'https://firms.modaps.eosdis.nasa.gov/',
  license: 'NASA Earthdata — bebas, sebutkan sumber',
  note: SOURCE_NOTE,
}

export function buildFirmsUrl(source, { mapKey = FIRMS_MAP_KEY, bbox = FIRMS_BBOX, days = FIRMS_DAYS, api = FIRMS_API } = {}) {
  return `${api}/${mapKey}/${source}/${bbox}/${days}`
}

async function getText(url, fetchImpl, label) {
  const resp = await fetchImpl(url, { signal: AbortSignal.timeout(20_000), headers: { 'User-Agent': 'niu-gayo-agroclimate/2 (+https://cuaca.abstract.biz.id)' } })
  if (!resp.ok) throw new Error(`${label} HTTP ${resp.status}`)
  const text = await resp.text()
  // FIRMS mengembalikan HTTP 200 berisi pesan untuk kunci salah / kuota habis.
  if (/invalid map_key|exceeded/i.test(text.slice(0, 200))) throw new Error(`${label}: ${text.trim().slice(0, 80)}`)
  return text
}

/**
 * Ambil + gabungkan hotspot semua sumber. Mengembalikan payload lengkap /api/hotspots.
 */
export async function getHotspots({ fetchImpl = fetch, now = new Date(), mapKey = FIRMS_MAP_KEY, sources = FIRMS_SOURCES, bbox = FIRMS_BBOX, days = FIRMS_DAYS, locations = LOCATIONS } = {}) {
  const retrievedAt = new Date().toISOString()
  const base = {
    retrievedAt,
    source: FIRMS_SOURCE,
    bbox,
    days,
    window: { mainHours: HOTSPOT.windowHours, trendHours: HOTSPOT.trendHours },
    thresholds: { bahayaKm: HOTSPOT.radiusBahayaKm, waspadaKm: HOTSPOT.radiusWaspadaKm, infoKm: HOTSPOT.radiusInfoKm, frpIntenseMw: HOTSPOT.frpIntenseMw },
  }
  if (!mapKey) {
    const empty = mapHotspots([], locations, { now })
    return { ...base, degraded: true, reason: 'FIRMS_MAP_KEY belum diatur (tugas manusia H-1, docs/dev/09-DATA-PREP.md §2)', sources: [], warnings: [], counts: empty.counts, hotspots: [], perLocation: empty.perLocation }
  }
  const settled = await Promise.allSettled(sources.map((src) => getText(buildFirmsUrl(src, { mapKey, bbox, days }), fetchImpl, `FIRMS ${src}`)))
  const warnings = []
  const okSources = []
  let rows = []
  settled.forEach((s, i) => {
    const src = sources[i]
    if (s.status === 'fulfilled') {
      const parsed = parseFirmsCsv(s.value, { source: src })
      okSources.push({ source: src, rows: parsed.length })
      rows = rows.concat(parsed)
    } else {
      warnings.push(s.reason?.message ?? String(s.reason))
    }
  })
  if (!okSources.length) {
    const empty = mapHotspots([], locations, { now })
    return { ...base, degraded: true, reason: warnings.join('; ') || 'semua sumber FIRMS gagal', sources: [], warnings, counts: empty.counts, hotspots: [], perLocation: empty.perLocation }
  }
  const mapped = mapHotspots(rows, locations, { now })
  return {
    ...base,
    degraded: false,
    reason: null,
    sources: okSources,
    warnings,
    counts: mapped.counts,
    hotspots: mapped.hotspots.map(slimHotspot),
    perLocation: mapped.perLocation,
  }
}

function slimHotspot(h) {
  return {
    lat: h.lat,
    lon: h.lon,
    acqAt: h.acqAt,
    ageHours: h.ageHours,
    satellite: h.satelliteLabel ?? h.satellite,
    instrument: h.instrument,
    confidence: h.confidence,
    frp: h.frp,
    intense: h.intense,
    daynight: h.daynight,
    nearest: h.nearest,
  }
}

/** Potongan payload untuk satu sentra (?location=id): ringkasan + hotspot ≤ 50 km terurut jarak. */
export function hotspotsForLocation(all, id, { limit = 20 } = {}) {
  const loc = LOCATIONS.find((l) => l.id === id)
  if (!loc) return null
  const summary = all.perLocation?.[id] ?? null
  const list = (all.hotspots ?? [])
    .map((h) => ({ ...h, distanceKm: Math.round(haversineKm(h.lat, h.lon, loc.lat, loc.lon) * 10) / 10 }))
    .filter((h) => h.distanceKm <= HOTSPOT.radiusInfoKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
    .slice(0, limit)
  return {
    retrievedAt: all.retrievedAt,
    source: all.source,
    degraded: all.degraded,
    reason: all.reason,
    warnings: all.warnings,
    window: all.window,
    thresholds: all.thresholds,
    location: { id: loc.id, name: loc.name },
    summary,
    hotspots: list,
  }
}

