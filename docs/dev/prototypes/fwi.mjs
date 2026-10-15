// Prototipe Canadian Forest Fire Weather Index System (Van Wagner 1987; Van Wagner & Pickett 1985).
// Fungsi murni, tanpa dependensi. Input harian (pengamatan siang ~12–13 LST):
//   temp (°C), rh (%), wind (km/jam), rain (mm/24 jam), month (1–12), kode hari sebelumnya.
// Kelas FDRS Indonesia (de Groot et al. 2007 / BMKG SPBK) disertakan di bawah.

const DAY_LENGTH_DMC = [6.5, 7.5, 9.0, 12.8, 13.9, 13.9, 12.4, 10.9, 9.4, 8.0, 7.0, 6.0] // lintang utara 46° (standar)
const DAY_LENGTH_DMC_EQUATOR = Array(12).fill(9.0) // Lawson & Armitage 2008: ekuator (±10°) pakai 9 jam konstan
const DRYING_DC = [-1.6, -1.6, -1.6, 0.9, 3.8, 5.8, 6.4, 5.0, 2.4, 0.4, -1.6, -1.6]
const DRYING_DC_EQUATOR = Array(12).fill(1.4) // Lawson & Armitage 2008: ekuator pakai 1.4 konstan
// Konstanta konversi FFMC↔kadar air: 147.2 (Van Wagner & Pickett 1985 asli) atau 147.27723 (cffdrs R/Py, Wang et al. 2015).
export const FFMC_CONST = { original: 147.2, cffdrs: 147.27723 }
let K = FFMC_CONST.original
export function setFfmcConstant(v) { K = v }

export function ffmc(temp, rh, wind, rain, ffmcPrev) {
  let mo = (K * (101 - ffmcPrev)) / (59.5 + ffmcPrev)
  if (rain > 0.5) {
    const rf = rain - 0.5
    let mr
    if (mo > 150) {
      mr = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf))
        + 0.0015 * (mo - 150) ** 2 * Math.sqrt(rf)
    } else {
      mr = mo + 42.5 * rf * Math.exp(-100 / (251 - mo)) * (1 - Math.exp(-6.93 / rf))
    }
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

export function dmc(temp, rh, rain, dmcPrev, month, { equator = false } = {}) {
  const t = Math.max(temp, -1.1)
  const le = (equator ? DAY_LENGTH_DMC_EQUATOR : DAY_LENGTH_DMC)[month - 1]
  const rk = 1.894 * (t + 1.1) * (100 - rh) * le * 1e-4
  let pr = dmcPrev
  if (rain > 1.5) {
    const ra = rain
    const rw = 0.92 * ra - 1.27
    const wmi = 20 + 280 / Math.exp(0.023 * dmcPrev)
    let b
    if (dmcPrev <= 33) b = 100 / (0.5 + 0.3 * dmcPrev)
    else if (dmcPrev <= 65) b = 14 - 1.3 * Math.log(dmcPrev)
    else b = 6.2 * Math.log(dmcPrev) - 17.2
    const wmr = wmi + (1000 * rw) / (48.77 + b * rw)
    pr = 43.43 * (5.6348 - Math.log(wmr - 20))
  }
  pr = Math.max(pr, 0)
  return pr + rk
}

export function dc(temp, rain, dcPrev, month, { equator = false } = {}) {
  const t = Math.max(temp, -2.8)
  const lf = (equator ? DRYING_DC_EQUATOR : DRYING_DC)[month - 1]
  let pe = (0.36 * (t + 2.8) + lf) / 2
  pe = Math.max(pe, 0)
  let dr = dcPrev
  if (rain > 2.8) {
    const rw = 0.83 * rain - 1.27
    const smi = 800 * Math.exp(-dcPrev / 400)
    dr = dcPrev - 400 * Math.log(1 + (3.937 * rw) / smi)
    dr = Math.max(dr, 0)
  }
  return dr + pe
}

export function isi(ffmcVal, wind) {
  const m = (K * (101 - ffmcVal)) / (59.5 + ffmcVal)
  const fW = Math.exp(0.05039 * wind)
  const fF = 91.9 * Math.exp(-0.1386 * m) * (1 + m ** 5.31 / 4.93e7)
  return 0.208 * fW * fF
}

export function bui(dmcVal, dcVal) {
  if (dmcVal <= 0.4 * dcVal) {
    return (0.8 * dmcVal * dcVal) / (dmcVal + 0.4 * dcVal || 1)
  }
  return dmcVal - (1 - (0.8 * dcVal) / (dmcVal + 0.4 * dcVal)) * (0.92 + (0.0114 * dmcVal) ** 1.7)
}

export function fwi(isiVal, buiVal) {
  const fD = buiVal <= 80 ? 0.626 * buiVal ** 0.809 + 2 : 1000 / (25 + 108.64 * Math.exp(-0.023 * buiVal))
  const b = 0.1 * isiVal * fD
  if (b <= 1) return b
  return Math.exp(2.72 * (0.434 * Math.log(b)) ** 0.647)
}

/** Satu langkah harian lengkap. */
export function stepFwi({ temp, rh, wind, rain, month, prev = { ffmc: 85, dmc: 6, dc: 15 }, equator = false }) {
  const f = ffmc(temp, rh, wind, rain, prev.ffmc)
  const d = dmc(temp, rh, rain, prev.dmc, month, { equator })
  const c = dc(temp, rain, prev.dc, month, { equator })
  const i = isi(f, wind)
  const b = bui(d, c)
  const w = fwi(i, b)
  return { ffmc: f, dmc: d, dc: c, isi: i, bui: b, fwi: w }
}

// ---- Kelas FDRS Indonesia (de Groot et al. 2007; BMKG SPBK) ----
export function ffmcClass(v) {
  if (v >= 83) return 'ekstrem'
  if (v >= 78) return 'tinggi'
  if (v >= 73) return 'sedang'
  return 'rendah'
}
export function fwiClass(v) {
  if (v > 13) return 'ekstrem'
  if (v > 6) return 'tinggi'
  if (v > 1) return 'sedang'
  return 'rendah'
}
export function isiClass(v) {
  if (v >= 6) return 'ekstrem'
  if (v >= 5) return 'tinggi'
  if (v >= 2) return 'sedang'
  return 'rendah'
}
