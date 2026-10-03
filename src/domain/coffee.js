/**
 * S5 — Model risiko karat daun berbasis leaf wetness (fungsi murni).
 * rolling48h: array { hour, leafWetness (%), temp (°C) } terurut, maks 48 entri.
 */
export function leafWetnessRustRisk(rolling48h) {
  if (!Array.isArray(rolling48h) || rolling48h.length === 0) {
    return { level: 'Rendah', score: 0, wetHoursInWindow: 0, description: 'Data tidak tersedia.' }
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
