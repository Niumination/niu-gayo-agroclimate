/**
 * Fungsi murni analisis agro-klimat kopi (tanpa className/warna — mapping warna di komponen).
 */
import { TEMP, RUST, DRYING } from './thresholds.js'

export function tempStatus(temp) {
  if (temp < TEMP.optimalMin) return { level: 'Dingin', desc: 'Pertumbuhan vegetative melambat' }
  if (temp > TEMP.optimalMax) return { level: 'Panas', desc: 'Waspada kematangan ceri prematur & hama PBKo' }
  return { level: 'Optimal', desc: 'Suhu optimal (15-24°C)' }
}

export function rustRisk(rh, temp) {
  if (rh >= RUST.rhHigh && temp >= RUST.tempMin && temp <= RUST.tempMax) {
    return { level: 'Tinggi', desc: 'Kombinasi RH >85% dan suhu hangat sangat kondusif untuk spora karat daun. Periksa naungan dan sanitasi kebun.' }
  }
  if (rh >= RUST.rhMedium) {
    return { level: 'Sedang', desc: 'Kelembapan cukup tinggi, pantau tanaman rentan di area cekungan.' }
  }
  return { level: 'Rendah', desc: 'Kelembapan udara aman, sirkulasi angin memadai.' }
}

export function dryingStatus(rain, solarRad, rh) {
  if (rain > DRYING.rainStop) {
    return { level: 'Hujan - Tutup Terpal', desc: 'Hujan sedang turun. Segera amankan kopi ke dalam solar dryer atau tutup kubah plastik.' }
  }
  if (solarRad < DRYING.solarLow || rh > DRYING.rhHigh) {
    return { level: 'Kurang Optimal', desc: 'Matahari tertutup awan tebal. Balik gabah lebih sering untuk mencegah fermentasi berlebih.' }
  }
  return { level: 'Sangat Baik', desc: 'Radiasi matahari kuat, tidak ada curah hujan. Penjemuran optimal di para-para.' }
}

/**
 * S5 — Model risiko karat daun berbasis leaf wetness rolling 48 jam.
 * rolling48h: array { leafWetness (%), temp (°C) } terurut.
 */
export function leafWetnessRustRisk(rolling48h) {
  if (!Array.isArray(rolling48h) || rolling48h.length === 0) {
    return { level: 'Rendah', score: 0, wetHoursInWindow: 0, longestWetStreak: 0, optimalTempHours: 0, description: 'Data tidak tersedia.' }
  }
  const window = rolling48h.slice(-48)
  let wetHoursInWindow = 0
  let longestWetStreak = 0
  let streak = 0
  let optimalTempHours = 0
  for (const h of window) {
    const wet = (h.leafWetness ?? 0) >= 70
    if (wet) {
      wetHoursInWindow += 1
      streak += 1
      longestWetStreak = Math.max(longestWetStreak, streak)
      if (h.temp >= 18 && h.temp <= 25) optimalTempHours += 1
    } else {
      streak = 0
    }
  }

  let score = 0
  if (longestWetStreak >= 6) score += 40
  else if (longestWetStreak >= 3) score += 20
  if (wetHoursInWindow >= 24) score += 25
  else if (wetHoursInWindow >= 12) score += 15
  if (optimalTempHours >= 6) score += 35
  else if (optimalTempHours >= 3) score += 20

  let level = 'Rendah'
  let description = 'Daun relatif kering, risiko infeksi spora karat rendah.'
  if (score >= 70) {
    level = 'Tinggi'
    description = 'Durasi basah daun panjang & suhu hangat 18-25°C sangat kondusif untuk Hemileia vastatrix. Pertimbangkan fungisida & perbaiki aerasi kanopi.'
  } else if (score >= 40) {
    level = 'Sedang'
    description = 'Basah daun cukup lama; pantau kebun dan siapkan sanitasi kanopi.'
  }
  return { level, score, wetHoursInWindow, longestWetStreak, optimalTempHours, description }
}
