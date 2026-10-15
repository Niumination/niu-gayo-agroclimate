// Fase 2.1 (FR-GEMPA-1) — gempa BMKG: gabung gempadirasakan.json + autogempa.json + gempaterkini.json (data terbuka BMKG TEWS),
// normalisasi field, saring relevansi (≤ 300 km dari Takengon ATAU teks dirasakan/wilayah menyebut Aceh), cache 2 menit,
// pola "tidak pernah throw" (degraded:true) + nilai terakhir yang baik disimpan di server/data/quakes-last.json.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { haversineKm } from '../src/domain/geo.js'
import { BMKG_QUAKE_BASE, QUAKE_RADIUS_KM } from './config.js'
import quakeHistory from '../src/data/hazards/quakeHistory.json' with { type: 'json' }

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const LAST_GOOD_FILE = path.join(__dirname, 'data', 'quakes-last.json')
/** Pusat rujukan: Takengon (ibu kota Aceh Tengah). */
export const CENTER = { lat: 4.63, lon: 96.845 }
export const FEEDS = ['gempadirasakan.json', 'autogempa.json', 'gempaterkini.json']
const ACEH_RE = /\b(aceh|takengon|bener meriah|gayo|bireuen|lhokseumawe|meulaboh|banda aceh|sabang|pidie|langsa|nagan raya|subulussalam|kutacane|blangkejeren|calang|sigli|tapaktuan|singkil|simeulue|sinabang|redelong|lhoksukon|idi|kuala simpang|jantho|suka makmue|blangpidie)\b/i
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9, X: 10, XI: 11, XII: 12 }

/** "IV Pamijahan, II-III Takengon" → [{ mmi:'IV', mmiNum:4, place:'Pamijahan' }, { mmi:'II-III', mmiNum:3, place:'Takengon' }] */
export function parseFelt(text) {
  if (!text || typeof text !== 'string') return []
  return text
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^((?:[IVX]+)(?:\s*-\s*[IVX]+)?)\s+(.+)$/)
      if (!m) return { mmi: null, mmiNum: null, place: s }
      const parts = m[1].split(/\s*-\s*/)
      const nums = parts.map((p) => ROMAN[p.toUpperCase()]).filter(Boolean)
      return { mmi: m[1].replace(/\s+/g, ''), mmiNum: nums.length ? Math.max(...nums) : null, place: m[2].trim() }
    })
}

/** Satu entri BMKG (gempa) → bentuk ternormalisasi. Mengembalikan null bila koordinat/waktu tidak terbaca. */
export function normalizeQuake(raw, feed = 'bmkg') {
  if (!raw || typeof raw !== 'object') return null
  const time = raw.DateTime ? new Date(raw.DateTime) : null
  if (!time || Number.isNaN(time.getTime())) return null
  const [latS, lonS] = String(raw.Coordinates ?? '').split(',')
  const lat = Number(latS)
  const lon = Number(lonS)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  const mag = Number(raw.Magnitude)
  const depthKm = Number(String(raw.Kedalaman ?? '').replace(/[^\d.]/g, ''))
  const iso = time.toISOString()
  return {
    id: `bmkg-${iso.replace(/[-:]/g, '').slice(0, 15)}Z`,
    time: iso,
    lat,
    lon,
    mag: Number.isFinite(mag) ? mag : null,
    depthKm: Number.isFinite(depthKm) ? depthKm : null,
    region: String(raw.Wilayah ?? '').trim(),
    potential: raw.Potensi ? String(raw.Potensi).trim() : null,
    felt: parseFelt(raw.Dirasakan),
    feltText: raw.Dirasakan ? String(raw.Dirasakan).trim() : null,
    shakemapUrl: raw.Shakemap ? `${BMKG_QUAKE_BASE}${raw.Shakemap}` : null,
    feed,
    source: 'BMKG',
  }
}

/** Relevan untuk Gayo: jarak ≤ radiusKm dari Takengon ATAU teks menyebut Aceh/kota di Aceh. */
export function isRelevant(q, { center = CENTER, radiusKm = QUAKE_RADIUS_KM } = {}) {
  if (!q) return false
  const dist = haversineKm(center.lat, center.lon, q.lat, q.lon)
  if (dist <= radiusKm) return true
  return ACEH_RE.test(`${q.region} ${q.feltText ?? ''}`)
}

/** Gabungkan tiga umpan (dedupe per id), normalisasi, hitung jarak ke pusat, saring relevansi, urutkan terbaru dulu. */
export function mergeFeeds({ dirasakan, autogempa, terkini }, opts = {}) {
  const list = []
  const push = (raw, feed) => {
    const q = normalizeQuake(raw, feed)
    if (q) list.push(q)
  }
  ;(dirasakan?.Infogempa?.gempa ?? []).forEach((r) => push(r, 'gempadirasakan'))
  if (autogempa?.Infogempa?.gempa) push(autogempa.Infogempa.gempa, 'autogempa')
  ;(terkini?.Infogempa?.gempa ?? []).forEach((r) => push(r, 'gempaterkini'))
  const byId = new Map()
  for (const q of list) {
    const prev = byId.get(q.id)
    // gabung informasi: dirasakan membawa daftar MMI, autogempa membawa shakemap/potensi
    byId.set(q.id, prev ? { ...prev, ...Object.fromEntries(Object.entries(q).filter(([, v]) => v != null && !(Array.isArray(v) && !v.length))), felt: prev.felt?.length ? prev.felt : q.felt, feed: `${prev.feed}+${q.feed}` } : q)
  }
  const center = opts.center ?? CENTER
  const all = [...byId.values()].map((q) => ({ ...q, distKm: Math.round(haversineKm(center.lat, center.lon, q.lat, q.lon)) }))
  const relevant = all.filter((q) => isRelevant(q, opts)).sort((a, b) => new Date(b.time) - new Date(a.time))
  return { all: all.sort((a, b) => new Date(b.time) - new Date(a.time)), relevant }
}

function readLastGood(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}
function writeLastGood(file, doc) {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(doc))
  } catch { /* best-effort */ }
}

/** Ringkasan riwayat statis (FR-GEMPA-5; USGS M≥4,5 ≤ 150 km, 10 tahun) untuk kartu. */
export function historySummary(history = quakeHistory, { minMag = 5 } = {}) {
  const ev = history?.events ?? []
  if (!ev.length) return null
  const largest = ev.reduce((a, b) => (b.mag > (a?.mag ?? -1) ? b : a), null)
  const significant = ev.filter((e) => e.mag >= minMag).sort((a, b) => new Date(b.time) - new Date(a.time))
  return {
    source: history.source,
    window: history.window,
    count: ev.length,
    countM5: significant.length,
    largest,
    recentSignificant: significant.slice(0, 3),
  }
}

/**
 * Ambil & gabungkan umpan BMKG. `fetchJson(url)` disuntikkan agar dapat diuji offline.
 * @returns {{ retrievedAt, source, degraded, error?, stale?, quakes: object[], latest: object|null, total }}
 */
export async function getQuakes({ fetchJson = defaultFetchJson, base = BMKG_QUAKE_BASE, lastGoodFile = LAST_GOOD_FILE, now = new Date().toISOString(), center = CENTER, radiusKm = QUAKE_RADIUS_KM } = {}) {
  const settled = await Promise.allSettled(FEEDS.map((f) => fetchJson(`${base}${f}`)))
  const [dirasakan, autogempa, terkini] = settled.map((s) => (s.status === 'fulfilled' ? s.value : null))
  const failures = settled.map((s, i) => (s.status === 'rejected' ? `${FEEDS[i]}: ${s.reason?.message ?? s.reason}` : null)).filter(Boolean)
  if (settled.every((s) => s.status === 'rejected')) {
    const last = readLastGood(lastGoodFile)
    if (last?.quakes) return { ...last, retrievedAt: now, degraded: true, stale: true, error: failures.join('; ') }
    return { retrievedAt: now, source: 'BMKG', degraded: true, error: failures.join('; '), quakes: [], latest: null, total: 0, history: historySummary() }
  }
  const { relevant, all } = mergeFeeds({ dirasakan, autogempa, terkini }, { center, radiusKm })
  const latestRaw = autogempa?.Infogempa?.gempa ? normalizeQuake(autogempa.Infogempa.gempa, 'autogempa') : null
  const doc = {
    retrievedAt: now,
    source: 'BMKG (data.bmkg.go.id/DataMKG/TEWS)',
    degraded: failures.length > 0,
    error: failures.length ? failures.join('; ') : undefined,
    center,
    radiusKm,
    quakes: relevant,
    latest: latestRaw ? { ...latestRaw, distKm: Math.round(haversineKm(center.lat, center.lon, latestRaw.lat, latestRaw.lon)) } : null,
    total: all.length,
    history: historySummary(),
  }
  if (!doc.degraded) writeLastGood(lastGoodFile, { ...doc, history: undefined })
  return doc
}

async function defaultFetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'niu-gayo-agroclimate/2 (+https://cuaca.abstract.biz.id)' } })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

/** Tambahkan jarak per sentra (haversine) untuk /api/quakes?location=. */
export function quakesForLocation(doc, location) {
  if (!doc || !location) return doc
  const withDist = (q) => (q ? { ...q, distKm: Math.round(haversineKm(location.lat, location.lon, q.lat, q.lon)) } : q)
  return { ...doc, location: { id: location.id, name: location.name }, quakes: (doc.quakes ?? []).map(withDist), latest: withDist(doc.latest) }
}
