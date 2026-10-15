// Fase 2.4b (FR-BJR-6) — laporan warga PetaBencana.id (CC BY-NC 4.0) untuk Aceh, disaring ke Dataran Tinggi Gayo:
// kode kabupaten BPS 1104 Aceh Tengah, 1117 Bener Meriah, 1113 Gayo Lues, ATAU ≤ 60 km dari Takengon. Cache 10 menit, degraded bila gagal.
// API: https://data.petabencana.id/reports?admin=ID-AC (TopoJSON; result.objects.output.geometries[] Point + properties).
import { PETABENCANA_API } from './config.js'
import { haversineKm } from '../src/domain/geo.js'

export const GAYO_CENTER = { lat: 4.63, lon: 96.85 } // Takengon
export const GAYO_RADIUS_KM = 60
export const GAYO_REGION_CODES = new Set(['1104', '1117', '1113'])
export const ATTRIBUTION = 'Laporan warga © PetaBencana.id (Yayasan Peta Bencana) — CC BY-NC 4.0, data komunitas belum terverifikasi'

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15_000), headers: { accept: 'application/json' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Dekode TopoJSON ringan: dukung koordinat terkuantisasi (transform) maupun mentah. */
function decodePoint(geom, transform) {
  const c = geom?.coordinates
  if (!Array.isArray(c) || c.length < 2) return null
  if (transform?.scale && transform?.translate) {
    return { lon: c[0] * transform.scale[0] + transform.translate[0], lat: c[1] * transform.scale[1] + transform.translate[1] }
  }
  return { lon: Number(c[0]), lat: Number(c[1]) }
}

/** Saring & normalisasi fitur PetaBencana → laporan ringkas untuk Dataran Tinggi Gayo. */
export function normalizeReports(doc, { center = GAYO_CENTER, radiusKm = GAYO_RADIUS_KM, regionCodes = GAYO_REGION_CODES } = {}) {
  const output = doc?.result?.objects?.output ?? doc?.objects?.output
  const geoms = output?.geometries ?? []
  const transform = doc?.result?.transform ?? doc?.transform
  const out = []
  for (const g of geoms) {
    const pt = decodePoint(g, transform)
    const p = g?.properties ?? {}
    if (!pt) continue
    const region = String(p.tags?.region_code ?? p.tags?.district_id ?? p.region_code ?? '')
    const dist = Math.round(haversineKm(center.lat, center.lon, pt.lat, pt.lon))
    const inRegion = regionCodes.has(region.slice(0, 4))
    if (!inRegion && dist > radiusKm) continue
    out.push({
      id: String(p.pkey ?? g.id ?? `${pt.lat},${pt.lon}`),
      type: p.disaster_type ?? p.report_type ?? 'lainnya',
      createdAt: p.created_at ?? null,
      text: typeof p.text === 'string' ? p.text.slice(0, 280) : '',
      lat: Math.round(pt.lat * 1e4) / 1e4,
      lon: Math.round(pt.lon * 1e4) / 1e4,
      distanceKm: dist,
      region: region || null,
      inRegion,
      depthCm: p.report_data?.flood_depth ?? null,
      imageUrl: p.image_url ?? null,
      url: p.url ? `https://petabencana.id/map/aceh/${p.url}` : null,
    })
  }
  out.sort((a, b) => String(b.createdAt ?? '').localeCompare(String(a.createdAt ?? '')))
  return out
}

/**
 * @returns {{ retrievedAt, source, attribution, license, degraded, error?, total, reports[], byType }}
 */
export async function getExternalReports({ fetchJson = defaultFetchJson, admin = 'ID-AC', timeperiod = 604800, now = new Date().toISOString() } = {}) {
  const url = `${PETABENCANA_API}?admin=${encodeURIComponent(admin)}&timeperiod=${timeperiod}`
  try {
    const doc = await fetchJson(url)
    const reports = normalizeReports(doc)
    const byType = {}
    for (const r of reports) byType[r.type] = (byType[r.type] ?? 0) + 1
    return { retrievedAt: now, source: 'PetaBencana.id', attribution: ATTRIBUTION, license: 'CC BY-NC 4.0', url: 'https://petabencana.id/map/aceh', admin, timeperiodS: timeperiod, degraded: false, total: reports.length, reports, byType }
  } catch (err) {
    return { retrievedAt: now, source: 'PetaBencana.id', attribution: ATTRIBUTION, license: 'CC BY-NC 4.0', url: 'https://petabencana.id/map/aceh', admin, timeperiodS: timeperiod, degraded: true, error: err.message, total: 0, reports: [], byType: {} }
  }
}
