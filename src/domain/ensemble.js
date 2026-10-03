/**
 * S3 — Probabilitas hujan ensemble (fungsi murni).
 * memberPrecip: array of member arrays; tiap member = array curah hujan per jam (mm).
 */
export function sumPrecipPerWindow(memberPrecip, hours = 24) {
  if (!Array.isArray(memberPrecip) || memberPrecip.length === 0) return []
  const windows = []
  for (let i = 0; i + hours <= memberPrecip[0].length; i += hours) {
    windows.push(memberPrecip.map((m) => m.slice(i, i + hours).reduce((a, b) => a + (b ?? 0), 0)))
  }
  return windows
}

export function computeRainProbability(memberPrecip, thresholdMm = 25, hours = 24) {
  const windows = sumPrecipPerWindow(memberPrecip, hours)
  if (windows.length === 0) return { probability: 0, exceedances: 0, members: 0 }
  const exceeds = windows.filter((w) => w.filter((v) => v > thresholdMm).length / w.length > 0)
  // per window: jumlah member yang melampaui threshold
  const result = windows.map((w) => Math.round((w.filter((v) => v > thresholdMm).length * 100) / w.length))
  return {
    // Rata-rata probabilitas lintas window 24 jam (window pertama paling relevan)
    probability: result[0] ?? 0,
    perWindow: result,
    exceedances: windows[0].filter((v) => v > thresholdMm).length,
    members: windows[0].length,
  }
}

export function rainProbabilities(memberPrecip, hours = 24) {
  return {
    p25: computeRainProbability(memberPrecip, 25, hours).probability,
    p50: computeRainProbability(memberPrecip, 50, hours).probability,
  }
}
