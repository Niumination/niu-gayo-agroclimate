/**
 * Fase 2.5 (FR-X-2) — aturan interaksi lintas-bahaya di atas hasil registry (fungsi murni, dipanggil evaluateAll).
 * Setiap aturan: { id, when(byId, ctx) → false | { targets[], bump?, note, severity } }.
 *  - `bump`: { id, max } → naikkan level hazard `id` satu tingkat (maks `max`) + flags.bumpedBy = rule id (level asli disimpan di flags.baseLevel).
 *  - Tanpa `bump` → hanya catatan (ditampilkan di HazardPanel & ikut ringkasan).
 * Lihat docs/reference/THRESHOLDS.md §19.
 */
import { LEVEL_ORDER } from './levels.js'
import { FLOOD_DISCHARGE } from '../thresholds.js'

const LEVELS = ['rendah', 'waspada', 'bahaya', 'ekstrem']
const atLeast = (r, lvl) => !!r && LEVEL_ORDER[r.level] >= LEVEL_ORDER[lvl]
const metric = (r, key) => r?.metrics?.find((m) => m.key === key)?.value ?? null

export const INTERACTION_RULES = [
  {
    id: 'gempa_tanah_jenuh',
    label: 'Gempa × tanah jenuh → longsor susulan',
    when(by, ctx) {
      const q = by.gempa
      const l = by.longsor
      if (!q || !l || l.level === 'n/a') return false
      const trig = q.flags?.triggerQuake
      const ari72 = ctx?.ari?.ari72 ?? metric(l, 'ari72') ?? 0
      const saturated = ari72 >= FLOOD_DISCHARGE.ari72Bump || (l.score ?? 0) >= 40
      if (!(q.flags?.landslideAfterQuake || (trig && saturated))) return false
      return {
        targets: ['longsor', 'gempa'],
        bump: { id: 'longsor', max: 'bahaya' },
        severity: 'bahaya',
        note: `Gempa M${trig?.mag ?? '≥5'} ${trig?.distKm != null ? `${trig.distKm} km` : '≤ 100 km'} dalam 72 jam + tanah jenuh (hujan 72 jam ${Math.round(ari72)} mm) → risiko longsor susulan meningkat; hindari lereng & tebing jalan 72 jam ke depan.`,
      }
    },
  },
  {
    id: 'asap_hujan_lebat',
    label: 'Asap × hujan lebat',
    when(by, ctx) {
      const a = by.asap
      if (!atLeast(a, 'waspada')) return false
      const rain24 = ctx?.weather?.rainNext24 ?? 0
      const heavyNow = (ctx?.weather?.peakHourly ?? 0) >= 10
      if (rain24 < 20 && !heavyNow) return false
      return {
        targets: ['asap', 'banjir', 'longsor'],
        severity: 'waspada',
        note: `Kabut asap (ISPU ${metric(a, 'ispu') ?? '–'}) bertemu hujan lebat (${Math.round(rain24)} mm/24 jam): jarak pandang sangat rendah di jalan & limpasan membawa abu — nyalakan lampu, kurangi kecepatan; hujan biasanya membersihkan asap dalam 6–12 jam.`,
      }
    },
  },
  {
    id: 'kekeringan_ffmc',
    label: 'Kekeringan × FFMC tinggi → siaga karhutla',
    when(by) {
      const k = by.kekeringan
      const f = by.kebakaran
      if (!atLeast(k, 'waspada') || !f || f.level === 'n/a') return false
      const ffmc = metric(f, 'ffmc')
      const hth = metric(k, 'hthDays') ?? metric(f, 'hthDays') ?? 0
      if (ffmc == null || ffmc < 78) return false
      return {
        targets: ['kebakaran', 'kekeringan'],
        bump: atLeast(f, 'waspada') ? null : { id: 'kebakaran', max: 'waspada' },
        severity: 'waspada',
        note: `HTH ${hth} hari + FFMC ${ffmc} (bahan bakar halus kering) → siaga karhutla: dilarang bakar lahan/sampah; siapkan sekat bakar & air di gudang; laporkan asap ke 112 / Manggala Agni.`,
      }
    },
  },
  {
    id: 'badai_longsor',
    label: 'Badai konvektif × lereng jenuh',
    when(by, ctx) {
      const b = by.badai
      const l = by.longsor
      if (!atLeast(b, 'bahaya') || !atLeast(l, 'waspada')) return false
      const ari72 = ctx?.ari?.ari72 ?? metric(l, 'ari72') ?? 0
      return {
        targets: ['badai', 'longsor'],
        severity: 'bahaya',
        note: `Badai petir diperkirakan di atas lereng yang sudah basah (hujan 72 jam ${Math.round(ari72)} mm): hujan intens singkat dapat memicu longsor dangkal/banjir bandang — jauhi lembah sempit & tebing jalan saat badai.`,
      }
    },
  },
  {
    id: 'vulkanik_hujan_lahar',
    label: 'Abu vulkanik × hujan → lahar',
    when(by, ctx) {
      const v = by.vulkanik
      if (!atLeast(v, 'bahaya')) return false
      const rain24 = ctx?.weather?.rainNext24 ?? 0
      if (rain24 < 20) return false
      return {
        targets: ['vulkanik', 'banjir'],
        severity: 'bahaya',
        note: `Aktivitas Burni Telong ≥ Siaga + prakiraan hujan ${Math.round(rain24)} mm/24 jam → potensi lahar hujan di alur sungai berhulu ke puncak; jauhi bantaran sungai lereng Burni Telong saat hujan.`,
      }
    },
  },
]

/**
 * Terapkan aturan interaksi ke daftar hasil (mutasi salinan). Mengembalikan { results, interactions }.
 */
export function applyInteractions(results, ctx, rules = INTERACTION_RULES) {
  const out = results.map((r) => ({ ...r, flags: { ...(r.flags ?? {}) } }))
  const byId = Object.fromEntries(out.map((r) => [r.id, r]))
  const interactions = []
  for (const rule of rules) {
    let hit
    try {
      hit = rule.when(byId, ctx)
    } catch {
      hit = false
    }
    if (!hit) continue
    const entry = { id: rule.id, label: rule.label, targets: hit.targets ?? [], severity: hit.severity ?? 'waspada', note: hit.note, bumped: null }
    if (hit.bump && byId[hit.bump.id]) {
      const t = byId[hit.bump.id]
      const cur = LEVEL_ORDER[t.level]
      const cap = LEVEL_ORDER[hit.bump.max ?? 'ekstrem']
      if (cur >= LEVEL_ORDER.rendah && cur < cap) {
        const next = LEVELS[Math.min(LEVELS.indexOf(t.level) + 1, LEVELS.indexOf(hit.bump.max ?? 'ekstrem'))]
        t.flags.baseLevel = t.level
        t.flags.bumpedBy = rule.id
        t.level = next
        t.headline = `${t.headline} · dinaikkan: ${rule.label}`
        entry.bumped = { id: t.id, from: t.flags.baseLevel, to: next }
      }
    }
    for (const id of entry.targets) if (byId[id]) byId[id].flags.interactions = [...(byId[id].flags.interactions ?? []), rule.id]
    interactions.push(entry)
  }
  return { results: out, interactions }
}
