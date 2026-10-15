// Fase 3.1 (FR-KER-6) — Standardized Precipitation Index (McKee dkk. 1993) SPI-1 & SPI-3 per lokasi.
// Baseline: total curah hujan bulanan ERA5-Land 1991–2020 per lokasi (server/clim/spi-baseline.json, dibangun scripts/build-spi-baseline.mjs).
// Distribusi gamma per bulan kalender (MLE pendekatan Thom 1958) + koreksi nol (H(x) = q + (1−q)·G(x)); SPI = Φ⁻¹(H).
// Nilai saat ini = total 30 hari (SPI-1) / 90 hari (SPI-3) terakhir dari arsip harian, dibandingkan dengan distribusi
// total 1-bulan / 3-bulan berjalan yang berakhir di bulan kalender yang sama. Tanpa baseline → null (degraded).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SPI } from '../src/domain/thresholds.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SPI_BASELINE_FILE = path.join(__dirname, 'clim', 'spi-baseline.json')

export function loadSpiBaseline(file = SPI_BASELINE_FILE) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return null
  }
}

// ---------- fungsi khusus ----------
/** ln Γ(x) — Lanczos. */
export function lnGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let y = x
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (let j = 0; j < 6; j++) ser += c[j] / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

/** Fungsi gamma tidak lengkap ternormalisasi P(a, x) (Numerical Recipes gammp). */
export function gammaP(a, x) {
  if (x <= 0) return 0
  if (x < a + 1) {
    let ap = a
    let sum = 1 / a
    let del = sum
    for (let n = 0; n < 500; n++) {
      ap += 1
      del *= x / ap
      sum += del
      if (Math.abs(del) < Math.abs(sum) * 1e-12) break
    }
    return sum * Math.exp(-x + a * Math.log(x) - lnGamma(a))
  }
  // pecahan berlanjut untuk Q, P = 1 − Q
  let b = x + 1 - a
  let c = 1 / 1e-300
  let d = 1 / b
  let h = d
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a)
    b += 2
    d = an * d + b
    if (Math.abs(d) < 1e-300) d = 1e-300
    c = b + an / c
    if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < 1e-12) break
  }
  return 1 - Math.exp(-x + a * Math.log(x) - lnGamma(a)) * h
}

/** Kuantil normal baku Φ⁻¹(p) (Acklam). */
export function normInv(p) {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239]
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1]
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]
  const pl = 0.02425
  let q
  let r
  if (p < pl) {
    q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p <= 1 - pl) {
    q = p - 0.5
    r = q * q
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
  }
  q = Math.sqrt(-2 * Math.log(1 - p))
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
}

// ---------- SPI ----------
/** Fit gamma (Thom 1958) pada sampel ≥ 0; mengembalikan { alpha, beta, q (fraksi nol), n }. */
export function fitGamma(sample) {
  const xs = sample.filter((v) => v != null && Number.isFinite(v) && v >= 0)
  const n = xs.length
  if (n < 10) return null
  const pos = xs.filter((v) => v > 0)
  const q = (n - pos.length) / n
  if (pos.length < 5) return { alpha: null, beta: null, q, n }
  const mean = pos.reduce((a, b) => a + b, 0) / pos.length
  const lnMean = pos.reduce((a, b) => a + Math.log(b), 0) / pos.length
  const A = Math.log(mean) - lnMean
  const alpha = A > 0 ? (1 / (4 * A)) * (1 + Math.sqrt(1 + (4 * A) / 3)) : 100
  const beta = mean / alpha
  return { alpha, beta, q, n }
}

/** SPI untuk nilai x terhadap fit gamma; dibatasi ±3 (praktik WMO). */
export function spiValue(x, fit) {
  if (!fit || x == null || !Number.isFinite(x)) return null
  let H
  if (fit.alpha == null) H = x > 0 ? 1 - fit.q / 2 : fit.q / 2
  else {
    const G = x > 0 ? gammaP(fit.alpha, x / fit.beta) : 0
    H = fit.q + (1 - fit.q) * G
  }
  H = Math.min(1 - 1e-6, Math.max(1e-6, H))
  return Math.round(Math.max(-3, Math.min(3, normInv(H))) * 100) / 100
}

/** Kelas McKee → level UI. */
export function spiClass(v) {
  if (v == null) return { key: 'n/a', label: 'Tidak tersedia', level: 'n/a' }
  if (v <= SPI.ekstrem) return { key: 'extremely_dry', label: 'Sangat kering ekstrem', level: 'ekstrem' }
  if (v <= SPI.bahaya) return { key: 'severely_dry', label: 'Sangat kering', level: 'bahaya' }
  if (v <= SPI.waspada) return { key: 'moderately_dry', label: 'Agak kering', level: 'waspada' }
  if (v < 1) return { key: 'near_normal', label: 'Mendekati normal', level: 'rendah' }
  if (v < 1.5) return { key: 'moderately_wet', label: 'Agak basah', level: 'rendah' }
  if (v < 2) return { key: 'very_wet', label: 'Sangat basah', level: 'rendah' }
  return { key: 'extremely_wet', label: 'Sangat basah ekstrem', level: 'rendah' }
}

/** Total hujan N hari observasi terakhir (abaikan hari prakiraan/hari ini). */
export function recentTotal(daily, days, { today } = {}) {
  const time = daily?.time ?? []
  const src = daily?.source ?? time.map(() => 'archive')
  const idx = []
  time.forEach((t, i) => {
    if (src[i] === 'forecast' || (today && t >= today)) return
    if (daily.precipitation_sum?.[i] != null) idx.push(i)
  })
  const use = idx.slice(-days)
  if (use.length < Math.ceil(days * 0.9)) return null
  const total = use.reduce((a, i) => a + Number(daily.precipitation_sum[i] ?? 0), 0)
  return { total: Math.round(total * 10) / 10, from: time[use[0]], to: time[use[use.length - 1]], days: use.length }
}

/**
 * Hitung SPI-1 & SPI-3 lokasi.
 * @param daily arsip harian { time[], precipitation_sum[], source[] }
 * @param base  baseline lokasi { monthly: { 'YYYY-MM': mm } } atau { months: number[12][] } (lihat skrip)
 */
export function computeSpi(daily, base, { today } = {}) {
  if (!daily?.time?.length) return null
  const out = { baseline: base ? { period: base.period ?? '1991–2020', years: base.years ?? null, source: 'ERA5-Land (Open-Meteo Archive)' } : null, spi1: null, spi3: null, level: 'n/a', degraded: !base }
  if (!base?.monthly) return out
  const entries = Object.entries(base.monthly).sort(([a], [b]) => a.localeCompare(b))
  const vals = entries.map(([, v]) => v)
  const months = entries.map(([k]) => Number(k.slice(5, 7)))
  const build = (scale) => {
    const byMonth = Array.from({ length: 13 }, () => [])
    for (let i = scale - 1; i < vals.length; i++) {
      let s = 0
      let ok = true
      for (let k = 0; k < scale; k++) {
        const v = vals[i - k]
        if (v == null) { ok = false; break }
        s += v
      }
      if (ok) byMonth[months[i]].push(s)
    }
    return byMonth
  }
  for (const [key, scale, days] of [['spi1', 1, 30], ['spi3', 3, 90]]) {
    const recent = recentTotal(daily, days, { today })
    if (!recent) continue
    const endMonth = Number(recent.to.slice(5, 7))
    const fit = fitGamma(build(scale)[endMonth])
    const v = spiValue(recent.total, fit)
    const cls = spiClass(v)
    out[key] = { value: v, total: recent.total, from: recent.from, to: recent.to, days: recent.days, classKey: cls.key, classLabel: cls.label, level: cls.level, n: fit?.n ?? 0 }
  }
  const rank = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  out.level = [out.spi1?.level, out.spi3?.level].filter(Boolean).reduce((b, l) => (rank[l] > rank[b] ? l : b), 'n/a')
  return out
}
