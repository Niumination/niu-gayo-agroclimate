// F2/ADR-9 — Sumber antecedent rainfall satelit: NASA GPM IMERG (GES DISC OPeNDAP).
//
// Dataset: GPM_3IMERGDL.07 (IMERG **Late**, daily) — `precipitation` mm/day,
// grid 0.1° (lon 3600, lat 1800). Late dipilih (bukan Final, latency ~3.5 bulan)
// karena granule D-1 tersedia ~14 jam setelah hari observasi → recency ≤ 48 jam,
// cukup untuk alerting. Tradeoff: Late belum terkalibrasi gauge (Early/Late bias
// terhadap hujan orografik dataran tinggi) — fallback model ECMWF tetap dipertahani.
//
// Akses: OPeNDAP ascii + auth Bearer JWT Earthdata (token di ~/.netrc, chmod 600).
// URL: {BASE}/{YYYY}/{MM}/3B-DAY-L.MS.MRG.3IMERG.{YYYYMMDD}-S000000-E235959.V07C.nc4
//      .ascii?precipitation[0][xi][yi]   ← urutan dim: time, LON, LAT (diverifikasi live)
// (direktori katalog = BULAN, bukan DOY — diverifikasi live 2026-10-03)
//
// ARI: 24j = hari terakhir tersedia; 72j = jumlah 3 hari; 7d = jumlah 7 hari.
// Semua request: timeout + retry 2x + cache 30 menit (server/cache.js).
// 401/403 (token expired 2026-12-03) / network / data kurang → throw → pemanggil
// (server/antecedent.js) fallback ke model-ecmwf.
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { cached } from './cache.js'

export const IMERG_BASE =
  'https://gpm1.gesdisc.eosdis.nasa.gov/opendap/GPM_L3/GPM_3IMERGDL.07'
export const IMERG_CACHE_MS = 30 * 60_000
const REQUEST_TIMEOUT_MS = 15_000
const RETRIES = 2
const MAX_DAYS_BACK = 12 // granule tertua yang dicoba (hari UTC, mulai kemarin)
const NEEDED_DAYS = 7

/** Indeks grid IMERG 0.1°: lon 3600 (idx=(lon+179.95)/0.1), lat 1800 (idx=(lat+89.95)/0.1). */
export function gridIndices(lat, lon) {
  // +1e-6 epsilon: hindari float error (mis. (4.60+89.95)/0.1 = 945.4999999999999
  // yang Math.round-nya menjadi 945 padahal indeks benar 946 → IMERG null/404).
  return {
    xi: Math.round((lon + 179.95 + 1e-6) / 0.1),
    yi: Math.round((lat + 89.95 + 1e-6) / 0.1),
  }
}

/** Baca token Earthdata JWT dari ~/.netrc (baris 'machine urs.earthdata.nasa.gov', field ke-6). */
export async function readEarthdataToken(netrcPath = join(homedir(), '.netrc')) {
  let text
  try {
    text = await readFile(netrcPath, 'utf8')
  } catch {
    throw new Error('netrc tidak tersedia')
  }
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (line.startsWith('machine') && line.includes('urs.earthdata.nasa.gov')) {
      const fields = line.split(/\s+/)
      const token = fields[5]
      if (token) return token
    }
  }
  throw new Error('token earthdata tidak ditemukan di netrc')
}

function imergUrl(dateUtc, xi, yi) {
  const y = dateUtc.getUTCFullYear()
  const mm = String(dateUtc.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dateUtc.getUTCDate()).padStart(2, '0')
  const name = `3B-DAY-L.MS.MRG.3IMERG.${y}${mm}${d}-S000000-E235959.V07C.nc4`
  return `${IMERG_BASE}/${y}/${mm}/${name}.ascii?precipitation%5B0%5D%5B${xi}%5D%5B${yi}%5D`
}

/**
 * Parse respons OPeNDAP ascii: baris terakhir relevan berbentuk
 * `precipitation.precipitation[...], <value>`. Mengembalikan null untuk missing
 * (nilai <= -9999) atau respons tidak terduga.
 */
export function parseImergAsciiValue(text) {
  if (typeof text !== 'string') return null
  const lines = text.split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim()
    if (/^precipitation\.precipitation\[/.test(line)) {
      const idx = line.lastIndexOf(',')
      if (idx < 0) return null
      const v = Number(line.slice(idx + 1).trim())
      if (!Number.isFinite(v) || v <= -9999) return null
      return v
    }
  }
  return null
}

async function fetchText(url, token, { fetchImpl, timeoutMs = REQUEST_TIMEOUT_MS, retries = RETRIES } = {}) {
  const doFetch = fetchImpl || ((u, o) => fetch(u, o))
  let lastErr
  for (let attempt = 0; attempt <= retries; attempt++) {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const resp = await doFetch(url, {
        signal: ctrl.signal,
        headers: { Authorization: `Bearer ${token}` },
      })
      if (resp.status === 401 || resp.status === 403) {
        throw new Error(`IMERG auth gagal (HTTP ${resp.status}) — cek token Earthdata (.netrc)`)
      }
      if (!resp.ok) throw new Error(`IMERG OPeNDAP HTTP ${resp.status}`)
      return await resp.text()
    } catch (err) {
      lastErr = err
      // 401/403 tidak ada gunanya di-retry (token invalid/expired).
      if (err.message.startsWith('IMERG auth gagal')) throw err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 500 * (attempt + 1)))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastErr
}

/** Nilai hujan harian (mm) satu titik untuk satu tanggal UTC; null bila granule belum ada. */
export async function fetchImergDailyPoint(dateUtc, lat, lon, token, opts = {}) {
  const { xi, yi } = gridIndices(lat, lon)
  const url = imergUrl(dateUtc, xi, yi)
  let text
  try {
    text = await fetchText(url, token, opts)
  } catch (err) {
    if (err.message.includes('auth gagal')) throw err
    return null // 404 granule belum terbit / network → anggap belum tersedia
  }
  // HTTP 200 tapi body error Hyrax → granule tidak valid.
  if (text.includes('Error {') || text.includes('Resource Not Found')) return null
  return parseImergAsciiValue(text)
}

function utcDateKey(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

/**
 * ARI IMERG per titik: ambil hingga 7 hari harian terakhir yang tersedia
 * (mulai kemarin UTC, mundur maksimal MAX_DAYS_BACK).
 * @returns {Promise<{ ari24: number, ari72: number, ari7d: number, source: 'imerg', asOf: string, days: number }>}
 * @throws Error bila auth gagal atau data tersedia < 3 hari (tidak cukup untuk ARI 72j).
 */
export async function getImergAri(lat, lon, { token, now = new Date(), fetchImpl } = {}) {
  return cached(`imerg:${lat.toFixed(3)},${lon.toFixed(3)}`, IMERG_CACHE_MS, async () => {
    const t = token || (await readEarthdataToken())
    const values = [] // terbaru dulu
    const dates = []
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    for (let back = 1; back <= MAX_DAYS_BACK && values.length < NEEDED_DAYS; back++) {
      const d = new Date(start)
      d.setUTCDate(d.getUTCDate() - back)
      const v = await fetchImergDailyPoint(d, lat, lon, t, { fetchImpl })
      if (v != null) {
        values.push(v)
        dates.push(utcDateKey(d))
      }
    }
    if (values.length < 3) {
      throw new Error(`IMERG data harian tersedia ${values.length} hari (< 3) — ARI tidak dapat dihitung`)
    }
    const round1 = (v) => Math.round(v * 10) / 10
    const sum = (n) => values.slice(0, n).reduce((a, b) => a + b, 0)
    return {
      ari24: round1(values[0]),
      ari72: round1(sum(3)),
      ari7d: round1(sum(NEEDED_DAYS)),
      source: 'imerg',
      asOf: dates[0], // tanggal data terbaru (biasanya D-1 UTC)
      days: values.length,
    }
  })
}
