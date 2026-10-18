/**
 * H-API — Canadian Forest Fire Weather Index System (Van Wagner 1987; Van Wagner & Pickett 1985)
 * + kelas FDRS Indonesia (de Groot et al. 2007 / BMKG SPBK).
 * Fungsi murni, tanpa dependensi. Input harian (pengamatan siang ~12–13 WIB):
 *   temp (°C), rh (%), wind (km/jam), rain (mm/24 jam), month (1–12), kode hari sebelumnya.
 * Diverifikasi terhadap dataset uji resmi 48 hari (cffdrs): selisih ≤ 0,005 pada 6 indeks
 * dengan konstanta FFMC 147.27723 (tests/fixtures/hazards/fwi-cffdrs-test_fwi-expected.csv).
 * Dipindahkan dari docs/dev/prototypes/fwi.mjs (iterasi 9).
 */
import { FWI as T, FWI_OPS } from '../thresholds.js'

// Panjang hari efektif DMC (Le) & faktor pengeringan DC (Lf) — tabel standar 46° LU.
const DAY_LENGTH_DMC = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0]
const DRYING_DC = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6]
// Ekuator (±10°, Lawson & Armitage 2008): Le = 9 jam, Lf = 1,4 sepanjang tahun.
const DAY_LENGTH_DMC_EQUATOR = Array(12).fill(9.0)
const DRYING_DC_EQUATOR = Array(12).fill(1.4)

/** Konstanta konversi FFMC ↔ kadar air: 147.2 (asli 1985) atau 147.27723 (cffdrs / Wang et al. 2015). */
export const FFMC_CONST = { original: 147.2, cffdrs: 147.27723 }
let K = T.ffmcConstant
export function setFfmcConstant(v) {
  K = v
}
export function getFfmcConstant() {
  return K
}

function monthIndex(month) {
  const m = Number(month)
  return m >= 1 && m <= 12 ? m - 1 : 0
}

/** Fine Fuel Moisture Code (0–101). */
export function ffmc(temp, rh, wind, rain, ffmcPrev) {
  let mo = (K * (101 - ffmcPrev)) / (59.5 + ffmcPrev)
  if (rain > 0.5) {
    const rf = rain - 0.5
    let mr = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf))
    if (mo > 150) mr += 0.0015 * (mo - 150) ** 2 * Math.sqrt(rf)
    mo = Math.min(mr, 250)
  }
  const ed = 0.942 * rh ** 0.679 + 11 * Math.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - Math.exp(-0.115 * rh))
  let m
  if (mo > ed) {
    const ko = 0.424 * (1 - (rh / 100) ** 1.7) + 0.0694 * Math.sqrt(wind) * (1 - (rh / 100) ** 8)
    const kd = ko * 0.581 * Math.exp(0.0365 * temp)
    m = ed + (mo - ed) * 10 ** -kd
  } else {
    const ew = 0.618 * rh ** 0.753 + 10 * Math.exp((rh - 100) / 10) + 0.18 * (21.1 - temp) * (1 - Math.exp(-0.115 * rh))
    if (mo < ew) {
      const k1 = 0.424 * (1 - ((100 - rh) / 100) ** 1.7) + 0.0694 * Math.sqrt(wind) * (1 - ((100 - rh) / 100) ** 8)
      const kw = k1 * 0.581 * Math.exp(0.0365 * temp)
      m = ew - (ew - mo) * 10 ** -kw
    } else {
      m = mo
    }
  }
  const f = (59.5 * (250 - m)) / (K + m)
  return Math.max(0, Math.min(101, f))
}

/** Duff Moisture Code. */
export function dmc(temp, rh, rain, dmcPrev, month, { equator = T.equator } = {}) {
  const t = Math.max(temp, -1.1)
  const le = (equator ? DAY_LENGTH_DMC_EQUATOR : DAY_LENGTH_DMC)[monthIndex(month)]
  const rk = 1.894 * (t + 1.1) * (100 - rh) * le * 1e-4
  let pr = dmcPrev
  if (rain > 1.5) {
    const rw = 0.92 * rain - 1.27
    const wmi = 20 + 280 / Math.exp(0.023 * dmcPrev)
    let b
    if (dmcPrev <= 33) b = 100 / (0.5 + 0.3 * dmcPrev)
    else if (dmcPrev <= 65) b = 14 - 1.3 * Math.log(dmcPrev)
    else b = 6.2 * Math.log(dmcPrev) - 17.2
    const wmr = wmi + (1000 * rw) / (48.77 + b * rw)
    pr = 43.43 * (5.6348 - Math.log(wmr - 20))
  }
  return Math.max(pr, 0) + rk
}

/** Drought Code. */
export function dc(temp, rain, dcPrev, month, { equator = T.equator } = {}) {
  const t = Math.max(temp, -2.8)
  const lf = (equator ? DRYING_DC_EQUATOR : DRYING_DC)[monthIndex(month)]
  const pe = Math.max((0.36 * (t + 2.8) + lf) / 2, 0)
  let dr = dcPrev
  if (rain > 2.8) {
    const rw = 0.83 * rain - 1.27
    const smi = 800 * Math.exp(-dcPrev / 400)
    dr = Math.max(dcPrev - 400 * Math.log(1 + (3.937 * rw) / smi), 0)
  }
  return dr + pe
}

/** Initial Spread Index. */
export function isi(ffmcVal, wind) {
  const m = (K * (101 - ffmcVal)) / (59.5 + ffmcVal)
  const fW = Math.exp(0.05039 * wind)
  const fF = 91.9 * Math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7)
  return 0.208 * fW * fF
}

/** Buildup Index. */
export function bui(dmcVal, dcVal) {
  if (dmcVal <= 0.4 * dcVal) {
    const denom = dmcVal + 0.4 * dcVal
    return denom === 0 ? 0 : (0.8 * dmcVal * dcVal) / denom
  }
  return dmcVal - (1 - (0.8 * dcVal) / (dmcVal + 0.4 * dcVal)) * (0.92 + (0.0114 * dmcVal) ** 1.7)
}

/** Fire Weather Index. */
export function fwi(isiVal, buiVal) {
  const fD = buiVal <= 80 ? 0.626 * buiVal ** 0.809 + 2 : 1000 / (25 + 108.64 * Math.exp(-0.023 * buiVal))
  const b = 0.1 * isiVal * fD
  if (b <= 1) return b
  return Math.exp(2.72 * (0.434 * Math.log(b)) ** 0.647)
}

/** Satu langkah harian lengkap: { ffmc, dmc, dc, isi, bui, fwi }. */
export function stepFwi({ temp, rh, wind, rain, month, prev = T.defaultStart, equator = T.equator }) {
  const f = ffmc(temp, rh, wind, rain, prev.ffmc)
  const d = dmc(temp, rh, rain, prev.dmc, month, { equator })
  const c = dc(temp, rain, prev.dc, month, { equator })
  const i = isi(f, wind)
  const b = bui(d, c)
  const w = fwi(i, b)
  return { ffmc: f, dmc: d, dc: c, isi: i, bui: b, fwi: w }
}

/**
 * Jalankan deret harian (spin-up dari arsip, lalu hari terbaru).
 * days: [{ date, temp, rh, wind, rain, month? }] terurut naik. Baris dengan input null dilewati (state dipertahankan).
 * Mengembalikan state terakhir + jumlah hari yang dihitung.
 */
export function runFwiSeries(days, { start = T.defaultStart, equator = T.equator, keepHistory = false } = {}) {
  let state = { ...start }
  let computed = 0
  let lastDate = null
  const history = keepHistory ? [] : null
  for (const d of days || []) {
    if ([d.temp, d.rh, d.wind, d.rain].some((v) => v == null || Number.isNaN(v))) continue
    const month = d.month ?? (d.date ? Number(String(d.date).slice(5, 7)) : 1)
    state = stepFwi({ temp: d.temp, rh: d.rh, wind: d.wind, rain: d.rain, month, prev: state, equator })
    computed++
    lastDate = d.date ?? lastDate
    if (history) history.push({ date: d.date ?? null, ...state, obs: { temp: d.temp, rh: d.rh, wind: d.wind, rain: d.rain }, basis: d.basis ?? 'archive' })
  }
  return history ? { ...state, computedDays: computed, lastDate, history } : { ...state, computedDays: computed, lastDate }
}

// ---- Kelas FDRS Indonesia ----
export function ffmcClass(v) {
  if (v == null) return null
  if (v >= T.ffmc.ekstrem) return 'ekstrem'
  if (v >= T.ffmc.tinggi) return 'tinggi'
  if (v >= T.ffmc.sedang) return 'sedang'
  return 'rendah'
}
export function fwiClass(v) {
  if (v == null) return null
  if (v > T.fwi.ekstrem) return 'ekstrem'
  if (v > T.fwi.tinggi) return 'tinggi'
  if (v > T.fwi.sedang) return 'sedang'
  return 'rendah'
}
export function isiClass(v) {
  if (v == null) return null
  if (v >= T.isi.ekstrem) return 'ekstrem'
  if (v >= T.isi.tinggi) return 'tinggi'
  if (v >= T.isi.sedang) return 'sedang'
  return 'rendah'
}

/**
 * Kelas tampilan bahaya kebakaran (kalibrasi lokal iterasi 9): FFMC "ekstrem" hanya bila ada
 * dukungan hotspot ≤ 10 km ATAU HTH ≥ 21 hari; selain itu diturunkan ke "tinggi".
 */
export function fireDangerClass({ ffmc: f, fwi: w, hotspotWithin10km = 0, hthDays = 0 }) {
  const cls = [ffmcClass(f), fwiClass(w)]
  const rank = { rendah: 0, sedang: 1, tinggi: 2, ekstrem: 3 }
  let best = cls.filter(Boolean).sort((a, b) => rank[b] - rank[a])[0] ?? 'rendah'
  if (best === 'ekstrem' && !(hotspotWithin10km > 0 || hthDays >= 21)) best = 'tinggi'
  return best
}

/** Kelas FDRS (rendah/sedang/tinggi/ekstrem) → level UI 4 tingkat (docs/dev/06 §2.1: rendah/rendah/waspada/bahaya). */
export function fdrsClassToLevel(cls) {
  if (cls === 'ekstrem') return 'bahaya'
  if (cls === 'tinggi') return 'waspada'
  return 'rendah'
}

/** Kelas DC "potensi asap" bahan organik dalam — BMKG karhutla/dc & de Groot et al. 2007: 0–140 · 141–260 · 261–350 · > 350. */
export function dcClass(v) {
  if (v == null) return null
  if (v > T.dc.ekstrem) return 'ekstrem'
  if (v > T.dc.tinggi) return 'tinggi'
  if (v > T.dc.sedang) return 'sedang'
  return 'rendah'
}

const FIRE_ADVICE = {
  rendah: [
    'Bahan bakar permukaan masih lembap; tetap hindari membakar serasah dekat kebun saat angin kencang.',
    'Saat membersihkan kebun, kumpulkan serasah untuk kompos/mulsa — bukan dibakar.',
  ],
  waspada: [
    'Serasah dan rumput kering mudah menyala: TIDAK membakar lahan/serasah; padamkan puntung dan bara sepenuhnya.',
    'Siapkan sekat bakar (jalur bersih 2–3 m) di tepi kebun yang berbatasan dengan semak/ilalang.',
    'Simpan nomor Damkar/BPBD dan sepakati titik kumpul kampung bila ada kebakaran.',
  ],
  bahaya: [
    'Potensi penyalaan tinggi dan api sulit dikendalikan: larangan total aktivitas api di kebun dan ladang.',
    'Pantau hotspot terdekat; bila melihat asap/api, lapor ke Damkar/BPBD dan tombol "Lapor kejadian" (jenis kebakaran).',
    'Siapkan jalur evakuasi ternak & keluarga, masker, dan cadangan air; jauhkan BBM/gas dari area rawan.',
  ],
  ekstrem: [
    'Siaga kebakaran: hotspot aktif di sekitar sentra dengan cuaca sangat mendukung penjalaran api.',
    'Ikuti arahan BPBD/Manggala Agni; utamakan keselamatan jiwa — jangan memadamkan api besar sendirian.',
    'Lindungi kelompok rentan dari asap (ruang bersih, masker) dan siapkan evakuasi bila api mendekat.',
  ],
}

/**
 * Penilaian bahaya kebakaran per sentra (FR-API-4/5) menggabungkan kode FWI hari ini, hotspot, dan HTH.
 * @param {{ fwi?: {ffmc,dmc,dc,isi,bui,fwi}|null, hotspots?: object|null, hthDays?: number|null }} input
 *   hotspots = ringkasan per sentra dari mapHotspots().perLocation[id]
 */
export function assessFireDanger({ fwi: codes = null, hotspots = null, hthDays: hth = null } = {}) {
  const hs10 = hotspots?.within10km24h ?? 0
  const hs25 = hotspots?.within25km24h ?? 0
  const classes = codes
    ? { ffmc: ffmcClass(codes.ffmc), fwi: fwiClass(codes.fwi), isi: isiClass(codes.isi), dc: dcClass(codes.dc) }
    : { ffmc: null, fwi: null, isi: null, dc: null }
  const display = codes ? fireDangerClass({ ffmc: codes.ffmc, fwi: codes.fwi, hotspotWithin10km: hs10, hthDays: hth ?? 0 }) : null
  let level = display ? fdrsClassToLevel(display) : 'rendah'
  // Hotspot aktif menaikkan level (≤ 10 km bahaya, ≤ 25 km waspada).
  const rank = { rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
  const hsLevel = hs10 > 0 ? 'bahaya' : hs25 > 0 ? 'waspada' : 'rendah'
  if (rank[hsLevel] > rank[level]) level = hsLevel
  // Ekstrem: FWI > 13 DAN hotspot ≤ 25 km dalam 24 jam (docs/dev/06 §2.1).
  const extreme = !!codes && codes.fwi > T.fwi.ekstrem && hs25 > 0
  if (extreme) level = 'ekstrem'
  // FR-API-5: Siaga Kebakaran Lokal = FFMC ≥ 78 DAN hotspot ≤ 25 km (24 jam).
  const siagaLokal = !!codes && codes.ffmc >= FWI_OPS.siagaFfmc && hs25 > 0
  const headline = codes
    ? `Api ${capital(classes.fwi)}${siagaLokal ? ' · siaga kebakaran setempat' : ''}`
    : 'Kode bahaya api belum tersedia'
  return {
    level,
    displayClass: display,
    classes,
    extreme,
    siagaLokal,
    headline,
    advice: FIRE_ADVICE[level] ?? FIRE_ADVICE.rendah,
    drivers: {
      ffmcExtremeGated: display === 'tinggi' && classes.ffmc === 'ekstrem', // ekstrem diturunkan karena tanpa hotspot/HTH
      hotspotWithin10km24h: hs10,
      hotspotWithin25km24h: hs25,
      hthDays: hth,
    },
  }
}

function capital(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '—'
}

// ---------------------------------------------------------------------------
// Modul registry (ADR-12) — adaptor payload /api/fire-danger → HazardResult.
// ---------------------------------------------------------------------------
export default {
  id: 'kebakaran',
  group: 'atmosfer',
  label: { id: 'Bahaya Kebakaran' },
  requires: ['fireDanger'],
  evaluate(ctx) {
    const p = ctx.fireDanger
    if (!p || (!p.fwi?.latest && !p.hotspots?.summary)) {
      return { level: 'n/a', degraded: true, headline: 'Data bahaya kebakaran belum tersedia.', detail: p?.error ? `Gangguan sumber: ${p.error}` : 'Data bahaya kebakaran belum tersedia saat ini.' }
    }
    const a = p.assessment ?? {}
    const codes = p.fwi?.latest?.codes ?? null
    const hs = p.hotspots?.degraded ? null : p.hotspots?.summary ?? null
    const level = a.level ?? p.level ?? 'rendah'
    const fdrs = a.displayClass ? ` (${String(a.displayClass).charAt(0).toUpperCase()}${String(a.displayClass).slice(1)})` : ''
    const hsTxt = p.hotspots?.degraded ? 'hotspot: tidak tersedia' : `hotspot 24 jam: ${hs?.within10km24h ?? 0} ≤ 10 km · ${hs?.within25km24h ?? 0} ≤ 25 km`
    const fwiClass = a.displayClass ? `${String(a.displayClass).charAt(0).toUpperCase()}${String(a.displayClass).slice(1)}` : 'Rendah'
    return {
      level,
      score: codes ? Math.round(Math.min(100, (codes.fwi / 20) * 100)) : null,
      headline: codes ? `Risiko kebakaran ${fwiClass.toLowerCase()}${a.siagaLokal ? ' · siaga kebakaran setempat' : ''}` : 'Data risiko kebakaran belum tersedia',
      detail: `Fire Weather Index (FWI) ${codes ? codes.fwi.toFixed(1) : 'belum dihitung'}${fdrs}. ${codes ? `FFMC ${Math.round(codes.ffmc)}, DC ${Math.round(codes.dc)}, ISI ${codes.isi.toFixed(1)}` : ''}; ${hsTxt}; hari tanpa hujan ${p.hth?.days ?? '–'} hari.${p.fwi?.latest?.isToday === false ? ' Kode terakhir = kemarin (pengamatan 12.00 WIB belum lewat).' : ''}`,
      metrics: [
        { key: 'fwi', label: 'FWI', value: codes?.fwi ?? null, unit: '' },
        { key: 'ffmc', label: 'FFMC', value: codes ? Math.round(codes.ffmc) : null, unit: '' },
        { key: 'dc', label: 'DC', value: codes ? Math.round(codes.dc) : null, unit: '' },
        { key: 'hotspots10km24h', label: 'Hotspot ≤ 10 km / 24 jam', value: hs?.within10km24h ?? null, unit: '' },
        { key: 'hotspots25km24h', label: 'Hotspot ≤ 25 km / 24 jam', value: hs?.within25km24h ?? null, unit: '' },
        { key: 'hthDays', label: 'Hari tanpa hujan', value: p.hth?.days ?? null, unit: 'hari' },
      ],
      advice: { umum: (a.advice ?? []).slice(0, 3), kebun: (a.advice ?? []).slice(3, 6) },
      sources: [
        { name: p.source?.fwi?.name ?? 'FWI System (ERA5 + ECMWF via Open-Meteo)', kind: 'model', retrievedAt: p.retrievedAt, url: p.source?.fwi?.url },
        ...(p.hotspots && !p.hotspots.degraded ? [{ name: p.source?.hotspots?.name ?? 'NASA FIRMS', kind: 'satellite', retrievedAt: p.hotspots.retrievedAt, url: p.source?.hotspots?.url }] : []),
      ],
      validUntil: p.retrievedAt ? new Date(new Date(p.retrievedAt).getTime() + 6 * 3_600_000).toISOString() : null,
      flags: { siagaLokal: !!a.siagaLokal, extreme: !!a.extreme, displayClass: a.displayClass ?? null, hotspotsDegraded: !!p.hotspots?.degraded, isToday: p.fwi?.latest?.isToday ?? null },
      degraded: !!p.degraded,
    }
  },
}
