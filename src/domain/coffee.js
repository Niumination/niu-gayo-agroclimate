/**
 * Fungsi murni analisis agro-klimat kopi (tanpa className/warna — mapping warna di komponen).
 */
import { TEMP, RUST, DRYING } from './thresholds.js'
import { coffeeHazeRule } from './hazards/airQuality.js'

export function tempStatus(temp) {
  if (temp < TEMP.optimalMin) return { level: 'Dingin', desc: 'Pertumbuhan vegetative melambat' }
  if (temp > TEMP.optimalMax) return { level: 'Panas', desc: 'Waspada kematangan ceri prematur & hama PBKo' }
  return { level: 'Optimal', desc: 'Suhu optimal (15-24°C)' }
}

export function rustRisk(rh, temp) {
  if (rh >= RUST.rhHigh && temp >= RUST.tempMin && temp <= RUST.tempMax) {
    return { level: 'Tinggi', desc: 'Udara lembap di atas 85 % dan hangat. Spora karat mudah tumbuh. Periksa naungan dan bersihkan daun gugur.' }
  }
  if (rh >= RUST.rhMedium) {
    return { level: 'Sedang', desc: 'Kelembapan cukup tinggi, pantau tanaman rentan di area cekungan.' }
  }
  return { level: 'Rendah', desc: 'Kelembapan udara aman, sirkulasi angin memadai.' }
}

/**
 * Jendela penjemuran. Parameter ke-4 (opsional, FR-ASAP-5 / v2 Fase 1): dampak kabut asap —
 * { ispu, aod, dni } → "Tunda (asap)" bila ISPU ≥ 101 atau (AOD ≥ 1,0 dan DNI maks siang < 300 W/m²).
 * Hujan tetap diprioritaskan (tindakan segera); aturan asap ada di domain/hazards/airQuality.js (coffeeHazeRule).
 */
export function dryingStatus(rain, solarRad, rh, haze = null) {
  if (rain > DRYING.rainStop) {
    return { level: 'Hujan - Tutup Terpal', desc: 'Hujan sedang turun. Segera amankan kopi ke dalam solar dryer atau tutup kubah plastik.' }
  }
  if (haze && (haze.ispu != null || haze.aod != null)) {
    const rule = coffeeHazeRule({ ispuIndex: haze.ispu ?? null, aod: haze.aod ?? null, dniDayMax: haze.dni ?? null })
    if (rule.dryingHold) {
      return {
        level: 'Tunda (asap)',
        desc: `${rule.reason ?? 'Kabut asap tebal.'} Gunakan pengering tertutup/solar dryer; bila terpaksa menjemur, tutup para-para dengan plastik UV dan angkat gabah ke ruang tertutup saat asap pekat.`,
        haze: true,
      }
    }
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
    description = 'Daun basah lama dan udara hangat pada 18–25 °C. Jamur karat (Hemileia vastatrix) cepat tumbuh. Semprot pagi bila tidak hujan, dan rapikan tajuk agar udara mengalir.'
  } else if (score >= 40) {
    level = 'Sedang'
    description = 'Basah daun cukup lama; pantau kebun dan siapkan sanitasi kanopi.'
  }
  return { level, score, wetHoursInWindow, longestWetStreak, optimalTempHours, description }
}
