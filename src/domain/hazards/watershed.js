/**
 * H-BANJIR+ — Indeks Luapan DAS Peusangan v2 (Fase 2.4, FR-BJR-4):
 *   level = maks(level indeks hujan hulu M3, level anomali debit GloFAS sel terdekat) + pengubah ARI72 (≥ 100 mm → naik satu tingkat).
 * - Indeks hujan hulu hanya untuk sentra berbobot (`WATERSHED.weights`); sentra lain memakai anomali debit saja (dataran banjir
 *   Takengon–Bebesen–Kebayakan justru di hilir sel "takengon"/"outlet").
 * - Tanpa data GloFAS (ctx.flood kosong) perilaku lama dipertahankan: sentra non-hulu → 'n/a'.
 * Bukan muka air terukur (tidak ada telemetri publik; label FLOOD_LABEL).
 */
import { watershedIndex } from '../disaster.js'
import { WATERSHED } from '../thresholds.js'
import { normalizeLevel } from './levels.js'
import { composeFloodLevel, cellForLocation, FLOOD_LABEL } from './flood.js'

const ADVICE = {
  waspada: { umum: ['Pantau ketinggian sungai/danau; amankan barang di dataran rendah Takengon–Bebesen–Kebayakan.'], kebun: ['Angkat jemuran & karung gabah dari gudang di bantaran.'] },
  bahaya: { umum: ['Jauhi bantaran Krueng Peusangan dan saluran keluar Danau Lut Tawar.', 'Siapkan evakuasi ke tempat tinggi; ikuti arahan BPBD (112).'], kebun: ['Pindahkan hasil panen & pupuk dari gudang di dataran banjir.'], sekolah: ['Sekolah di bantaran: siapkan jalur ke tempat tinggi; tunda kegiatan luar dekat sungai.'] },
}

const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10)

export default {
  id: 'banjir',
  group: 'hidromet',
  label: { id: 'Luapan DAS Peusangan', gayo: 'Luapan DAS Peusangan [?]' },
  requires: ['weather'],
  evaluate(ctx) {
    const id = ctx.location?.id
    if (!id) return { level: 'n/a', degraded: true, headline: 'Lokasi tidak diketahui' }
    const w = ctx.weather
    if (!w) return { level: 'n/a', degraded: true, headline: 'Data cuaca belum tersedia' }
    const weight = WATERSHED.weights[id]
    const rain = weight ? watershedIndex([{ id, rain24: w.dailyRainSum }]) : null
    const rainLevel = rain ? normalizeLevel(rain.level) : 'n/a'
    const cell = cellForLocation(ctx.flood, id)
    const dischargeLevel = cell ? (cell.levelNext7 ?? cell.today?.level ?? 'n/a') : 'n/a'
    if (!weight && !cell) {
      return { level: 'n/a', degraded: false, headline: 'Bukan sentra DAS Peusangan', detail: 'Sentra ini mengalir ke DAS lain (Krueng Woyla/Tripa di lereng barat, Jambo Aye di plato selatan); indeks hujan hulu & debit GloFAS DAS Peusangan tersedia di sentra Takengon, Bebesen, Kebayakan, Lut Tawar, Bintang, Pegasing, Bies, Silih Nara, Ketol, Kute Panang.' }
    }
    const ari72 = ctx.ari?.ari72 ?? w.rain72 ?? 0
    const composed = composeFloodLevel({ rainLevel, dischargeLevel, ari72 })
    const level = composed.level
    const peak = cell?.peak
    const parts = []
    if (rain) parts.push(`Indeks hujan hulu 24 jam ${rain.index} mm (${rain.level}).`)
    if (cell) {
      parts.push(
        cell.hasClimatology
          ? `Debit GloFAS sel ${cell.name}: hari ini ${r1(cell.today?.discharge)} m³/s = ${cell.today?.ratio ?? '–'}× median musiman${cell.today?.exceedsP95 ? ' (> p95)' : ''}; puncak 7 hari ${peak?.date ?? '–'} ${r1(peak?.discharge)} m³/s (${peak?.ratio ?? '–'}×).`
          : `Debit GloFAS sel ${cell.name}: hari ini ${r1(cell.today?.discharge)} m³/s (klimatologi belum dibangun — jalankan scripts/build-flood-clim.mjs).`
      )
    } else parts.push('Anomali debit GloFAS belum tersedia.')
    if (composed.bumpedByAri) parts.push(`Hujan 72 jam ${Math.round(ari72)} mm → tanah jenuh, level dinaikkan satu tingkat.`)
    parts.push(FLOOD_LABEL)
    const headline = cell
      ? `${rain ? `Hujan hulu ${rain.index} mm · ` : ''}debit ${cell.today?.ratio != null ? `${cell.today.ratio}× normal` : 'normal (tanpa klimatologi)'}${peak?.ratio != null && peak.date !== cell.today?.date ? ` · puncak ${peak.ratio}× (${peak.date})` : ''}`
      : rain.level
    return {
      level,
      score: cell?.peak?.ratio != null ? Math.min(100, Math.round((cell.peak.ratio / 5) * 100)) : null,
      headline,
      detail: parts.join(' '),
      metrics: [
        ...(rain ? [{ key: 'index', label: 'Indeks hujan DAS (sentra ini)', value: rain.index, unit: 'mm' }, { key: 'weight', label: 'Bobot hulu', value: weight, unit: '' }] : []),
        { key: 'dailyRainSum', label: 'Hujan harian', value: w.dailyRainSum, unit: 'mm' },
        ...(cell ? [
          { key: 'discharge', label: `Debit hari ini (${cell.name})`, value: r1(cell.today?.discharge), unit: 'm³/s' },
          { key: 'ratio', label: 'Rasio terhadap median musiman', value: cell.today?.ratio, unit: '×' },
          { key: 'peakRatio', label: `Puncak 7 hari (${peak?.date ?? '–'})`, value: peak?.ratio, unit: '×' },
        ] : []),
        { key: 'ari72', label: 'Hujan 72 jam', value: Math.round(ari72), unit: 'mm' },
      ],
      advice: level === 'ekstrem' ? ADVICE.bahaya : ADVICE[level] ?? {},
      sources: [
        { name: 'Open-Meteo ECMWF IFS (indeks hujan, bukan muka air)', kind: 'model', retrievedAt: ctx.now },
        ...(cell ? [{ name: 'GloFAS v4 (Copernicus EMS) via Open-Meteo Flood API — debit model', kind: 'model', retrievedAt: ctx.flood?.retrievedAt ?? ctx.now, url: 'https://global-flood.emergency.copernicus.eu/' }] : []),
      ],
      flags: { components: composed.components, bumpedByAri: composed.bumpedByAri, cell: cell?.id ?? null, estimate: true, exceedsP95: !!cell?.today?.exceedsP95 },
      degraded: !!cell?.stale,
    }
  },
}
