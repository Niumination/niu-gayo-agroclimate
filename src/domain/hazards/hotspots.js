/**
 * H-API — hotspot NASA FIRMS (FR-API-1/2): parser CSV Area API, saringan keyakinan, haversine ke 15 sentra,
 * ringkasan per sentra (≤ 10/25/50 km, jendela 24/48 jam) dan level UI. Fungsi murni, tanpa fetch.
 *
 * Kolom VIIRS (375 m): latitude,longitude,bright_ti4,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_ti5,frp,daynight
 * Kolom MODIS (1 km):  latitude,longitude,brightness,scan,track,acq_date,acq_time,satellite,instrument,confidence,version,bright_t31,frp,daynight
 * `confidence` VIIRS = l/n/h (low/nominal/high), MODIS = 0–100 %. acq_time = HHMM UTC.
 */
import { HOTSPOT } from '../thresholds.js'

export const SOURCE_NOTE = 'Hotspot = indikasi anomali panas dari satelit, belum tentu kebakaran (verifikasi lapangan — SiPongi/KLHK).'
const SATELLITE_LABEL = { N: 'Suomi NPP', N20: 'NOAA-20', N21: 'NOAA-21', 1: 'NOAA-21', T: 'Terra', A: 'Aqua' }
const EARTH_RADIUS_KM = 6371.0088

/** Jarak lingkaran besar (km). */
export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)))
}

/** Parse CSV FIRMS (header dinamis, nilai numerik dikonversi). Baris kosong/`No data`/error diabaikan. */
export function parseFirmsCsv(text, { source = null } = {}) {
  if (typeof text !== 'string') return []
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length)
  if (lines.length < 2) return []
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase())
  if (!header.includes('latitude') || !header.includes('longitude')) return []
  const out = []
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',')
    if (cols.length < header.length) continue
    const row = {}
    header.forEach((h, j) => {
      const raw = (cols[j] ?? '').trim()
      row[h] = raw === '' ? null : raw
    })
    const lat = Number(row.latitude)
    const lon = Number(row.longitude)
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const instrument = String(row.instrument ?? (header.includes('bright_ti4') ? 'VIIRS' : 'MODIS')).toUpperCase()
    const confRaw = row.confidence
    const confidence = instrument === 'MODIS' ? Number(confRaw) : String(confRaw ?? '').toLowerCase()
    out.push({
      lat,
      lon,
      acqDate: row.acq_date ?? null,
      acqTime: row.acq_time ?? null,
      acqAt: toIsoUtc(row.acq_date, row.acq_time),
      satellite: row.satellite ?? null,
      satelliteLabel: SATELLITE_LABEL[row.satellite] ?? row.satellite ?? null,
      instrument,
      confidence,
      brightness: numOrNull(row.bright_ti4 ?? row.brightness),
      frp: numOrNull(row.frp),
      daynight: row.daynight ?? null,
      version: row.version ?? null,
      source,
    })
  }
  return out
}

function numOrNull(v) {
  const n = Number(v)
  return v == null || v === '' || !Number.isFinite(n) ? null : n
}

/** 'YYYY-MM-DD' + 'HHMM' (UTC) → ISO string; null bila tidak valid. */
export function toIsoUtc(acqDate, acqTime) {
  if (!acqDate) return null
  const t = String(acqTime ?? '0').padStart(4, '0')
  const hh = t.slice(0, 2)
  const mm = t.slice(2, 4)
  const d = new Date(`${acqDate}T${hh}:${mm}:00Z`)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

/** Saringan keyakinan: VIIRS n/h; MODIS ≥ 50 %. */
export function passesConfidence(h) {
  if (!h) return false
  if (h.instrument === 'MODIS') return typeof h.confidence === 'number' && h.confidence >= HOTSPOT.modisMinConfidence
  return HOTSPOT.viirsConfidence.includes(String(h.confidence ?? '').toLowerCase())
}

/** Umur deteksi dalam jam terhadap `now` (null bila waktu tidak valid). */
export function ageHours(h, now = new Date()) {
  if (!h?.acqAt) return null
  const t = Date.parse(h.acqAt)
  return Number.isFinite(t) ? (now.getTime() - t) / 3_600_000 : null
}

/**
 * Petakan hotspot ke sentra terdekat dan hitung ringkasan per sentra.
 * @param {object[]} hotspots hasil parseFirmsCsv (sudah/akan disaring)
 * @param {{id:string,name:string,lat:number,lon:number}[]} locations
 * @param {{ now?: Date, filterConfidence?: boolean }} opts
 * @returns {{ hotspots: object[], perLocation: Record<string, object>, counts: {total, accepted, last24h, last48h} }}
 */
export function mapHotspots(hotspots, locations, { now = new Date(), filterConfidence = true } = {}) {
  const list = (Array.isArray(hotspots) ? hotspots : []).filter((h) => !filterConfidence || passesConfidence(h))
  const perLocation = {}
  for (const loc of locations) {
    perLocation[loc.id] = {
      id: loc.id,
      name: loc.name,
      within10km24h: 0,
      within25km24h: 0,
      within50km24h: 0,
      within10km48h: 0,
      within25km48h: 0,
      within50km48h: 0,
      nearestKm: null,
      nearestAt: null,
      frpMax24h: null,
      intense24h: 0,
      level: 'rendah',
    }
  }
  const enriched = []
  for (const h of list) {
    const age = ageHours(h, now)
    if (age != null && (age > HOTSPOT.trendHours || age < -3)) continue // di luar jendela tren (toleransi jam satelit +3)
    let nearest = null
    for (const loc of locations) {
      const km = haversineKm(h.lat, h.lon, loc.lat, loc.lon)
      if (!nearest || km < nearest.km) nearest = { id: loc.id, name: loc.name, km }
      const s = perLocation[loc.id]
      if (km <= HOTSPOT.radiusInfoKm) {
        const in24 = age != null && age <= HOTSPOT.windowHours
        s.within50km48h++
        if (in24) s.within50km24h++
        if (km <= HOTSPOT.radiusWaspadaKm) {
          s.within25km48h++
          if (in24) s.within25km24h++
        }
        if (km <= HOTSPOT.radiusBahayaKm) {
          s.within10km48h++
          if (in24) s.within10km24h++
        }
        if (s.nearestKm == null || km < s.nearestKm) {
          s.nearestKm = Math.round(km * 10) / 10
          s.nearestAt = h.acqAt
        }
        if (in24 && h.frp != null) {
          s.frpMax24h = s.frpMax24h == null ? h.frp : Math.max(s.frpMax24h, h.frp)
          if (h.frp >= HOTSPOT.frpIntenseMw) s.intense24h++
        }
      }
    }
    enriched.push({
      ...h,
      ageHours: age == null ? null : Math.round(age * 10) / 10,
      intense: h.frp != null && h.frp >= HOTSPOT.frpIntenseMw,
      nearest: nearest ? { ...nearest, km: Math.round(nearest.km * 10) / 10 } : null,
    })
  }
  for (const s of Object.values(perLocation)) s.level = hotspotLevel(s)
  enriched.sort((a, b) => (a.nearest?.km ?? 1e9) - (b.nearest?.km ?? 1e9))
  const last24h = enriched.filter((h) => h.ageHours != null && h.ageHours <= HOTSPOT.windowHours).length
  return {
    hotspots: enriched,
    perLocation,
    counts: { total: Array.isArray(hotspots) ? hotspots.length : 0, accepted: list.length, inWindow: enriched.length, last24h, last48h: enriched.length },
  }
}

/** Level UI per sentra dari jendela 24 jam: ≤ 10 km bahaya · ≤ 25 km waspada · ≤ 50 km informasi (rendah + catatan). */
export function hotspotLevel(s) {
  if (!s) return 'rendah'
  if (s.within10km24h > 0) return 'bahaya'
  if (s.within25km24h > 0) return 'waspada'
  return 'rendah'
}
