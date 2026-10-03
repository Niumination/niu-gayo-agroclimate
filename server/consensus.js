/**
 * F1 — Konsensus multi-model (ADR-8).
 * Fungsi murni: konversi member ensemble → probabilitas hujan > ambang per window,
 * lalu konsensus antara ECMWF (50 member) + WN2 (64 member) + BMKG nowcast (bila ada).
 */

/** Konversi raw JSON Open-Meteo ensemble → array of member arrays (nilai per langkah waktu). */
export function parseEnsembleMembers(data) {
  const h = data?.hourly
  if (!h) return []
  return Object.keys(h)
    .filter((k) => k.startsWith('precipitation_member'))
    .map((k) => h[k])
}

/**
 * Akumulasi 24 jam dari langkah 6-hourly (WN2): sum 4 langkah per window.
 * memberSteps: array of member arrays (6-hourly mm). Hasil: array of window (array of member sums).
 */
export function accumulate6hTo24h(memberSteps) {
  if (!Array.isArray(memberSteps) || memberSteps.length === 0) return []
  const n = memberSteps[0]?.length ?? 0
  const windows = []
  for (let i = 0; i + 4 <= n; i += 4) {
    windows.push(
      memberSteps.map((m) =>
        m.slice(i, i + 4).reduce((a, b) => a + (b ?? 0), 0)
      )
    )
  }
  return windows
}

/** Akumulasi 24 jam dari langkah hourly (ECMWF): sum 24 langkah per window. */
export function accumulate1hTo24h(memberHours) {
  if (!Array.isArray(memberHours) || memberHours.length === 0) return []
  const n = memberHours[0]?.length ?? 0
  const windows = []
  for (let i = 0; i + 24 <= n; i += 24) {
    windows.push(
      memberHours.map((m) =>
        m.slice(i, i + 24).reduce((a, b) => a + (b ?? 0), 0)
      )
    )
  }
  return windows
}

/** Probabilitas (%) window pertama melampaui threshold mm/24 jam. */
export function windowExceedance(windows, thresholdMm = 25) {
  if (!windows || windows.length === 0) return { probability: 0, members: 0, threshold: thresholdMm }
  const w = windows[0]
  return {
    probability: Math.round((w.filter((v) => v > thresholdMm).length * 100) / w.length),
    members: w.length,
    threshold: thresholdMm,
  }
}

/**
 * Level konsensus (ADR-8): berapa sumber independen setuju hujan > ambang
 * pada window 24 jam pertama.
 * Sumber: ECMWF ensemble, WN2 ensemble, BMKG nowcast (bila peringatan Aceh aktif).
 * @returns {{ level: 'tinggi'|'sedang'|'rendah', votes: number, sources: number, detail: string }}
 */
export function consensusLevel({ ecmwf = {}, wn2 = {}, bmkgAlertActive = false, thresholdMm = 25 }) {
  const sources = []
  if (typeof ecmwf.probability === 'number' && ecmwf.members > 0) {
    sources.push({ name: 'ecmwf', agree: ecmwf.probability >= 40, probability: ecmwf.probability })
  }
  if (typeof wn2.probability === 'number' && wn2.members > 0) {
    sources.push({ name: 'wn2', agree: wn2.probability >= 40, probability: wn2.probability })
  }
  if (bmkgAlertActive) sources.push({ name: 'bmkg', agree: true, probability: null })

  const votes = sources.filter((s) => s.agree).length
  const level = votes >= 2 ? 'tinggi' : votes === 1 ? 'sedang' : 'rendah'
  return {
    level,
    votes,
    sources: sources.length,
    detail: sources.map((s) => `${s.name}:${s.agree ? 'setuju' : 'tidak'}`).join(', '),
    thresholdMm,
  }
}
