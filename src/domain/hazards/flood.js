/**
 * H-BANJIR+ (Fase 2.4, FR-BJR-3/4) — fungsi murni anomali debit GloFAS & komposisi Indeks Luapan DAS Peusangan v2.
 * Dipakai server/flood.js (per sel) dan modul registry `banjir` (watershed.js) di klien & server.
 */
import { FLOOD_DISCHARGE } from '../thresholds.js'

export const FLOOD_LABEL = 'Model hidrologi global (GloFAS ~5 km) — bukan muka air terukur; pakai sebagai sinyal dini, konfirmasi ke lapangan/BPBD.'
const RANK = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const LEVELS = ['rendah', 'waspada', 'bahaya', 'ekstrem']

/**
 * Rasio debit terhadap median klimatologi hari itu + level (≥ 2 waspada, ≥ 3 bahaya, ≥ 5 ekstrem, atau > p95 → minimal waspada).
 * @returns {{ ratio:number|null, level:string, exceedsP95:boolean }}
 */
export function dischargeAnomaly({ forecast, median, p95 }) {
  const f = forecast == null ? NaN : Number(forecast)
  const m = median == null ? NaN : Number(median)
  if (!Number.isFinite(f) || !Number.isFinite(m) || m <= 0) return { ratio: null, level: 'n/a', exceedsP95: false }
  const ratio = Math.round((f / m) * 100) / 100
  const exceedsP95 = Number.isFinite(Number(p95)) && f > Number(p95)
  let level = 'rendah'
  if (ratio >= FLOOD_DISCHARGE.ekstrem) level = 'ekstrem'
  else if (ratio >= FLOOD_DISCHARGE.bahaya) level = 'bahaya'
  else if (ratio >= FLOOD_DISCHARGE.waspada || exceedsP95) level = 'waspada'
  return { ratio, level, exceedsP95 }
}

/**
 * Indeks Luapan DAS v2 = maks(level indeks hujan hulu, level anomali debit) + pengubah ARI72:
 * ARI72 ≥ FLOOD_DISCHARGE.ari72Bump mm dan level ≥ waspada → naik satu tingkat (maks ekstrem).
 * @returns {{ level:string, components:{ rain:string, discharge:string }, bumpedByAri:boolean }}
 */
export function composeFloodLevel({ rainLevel = 'n/a', dischargeLevel = 'n/a', ari72 = 0 }) {
  const r = RANK[rainLevel] ?? -1
  const d = RANK[dischargeLevel] ?? -1
  let idx = Math.max(r, d)
  if (idx < 0) return { level: 'n/a', components: { rain: rainLevel, discharge: dischargeLevel }, bumpedByAri: false }
  const bump = idx >= 1 && ari72 >= FLOOD_DISCHARGE.ari72Bump
  if (bump) idx = Math.min(3, idx + 1)
  return { level: LEVELS[idx], components: { rain: rainLevel, discharge: dischargeLevel }, bumpedByAri: bump }
}

/**
 * Sel GloFAS yang relevan per sentra — HANYA sentra di DAS Peusangan hulu (danau Lut Tawar + alur Peusangan Takengon → Angkup → Ketol).
 * Sentra lereng barat (Celala, Rusip Antara → Krueng Woyla/Tripa) dan plato selatan (Atu Lintang, Jagong Jeget, Linge → Jambo Aye)
 * berada di DAS lain → tidak dipetakan (modul tetap 'n/a' untuk komponen debit).
 */
export const CELL_FOR_LOCATION = {
  luttawar: 'outlet', kebayakan: 'outlet', bebesan: 'takengon', takengon: 'takengon', pegasing: 'takengon', bies: 'takengon',
  bintang: 'bintang', silihnara: 'angkup', ketol: 'angkup', kutepanang: 'angkup',
}

/** Pilih sel untuk lokasi (pemetaan eksplisit saja; null bila sentra di luar DAS Peusangan atau data kosong). */
export function cellForLocation(flood, locationId) {
  const cells = flood?.cells ?? []
  if (!cells.length) return null
  const want = CELL_FOR_LOCATION[locationId]
  return want ? cells.find((c) => c.id === want) ?? null : null
}
