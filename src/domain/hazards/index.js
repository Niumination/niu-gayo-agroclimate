/**
 * HAZARD REGISTRY (ADR-12, docs/dev/05-ARCHITECTURE.md §2) — titik ekstensi tunggal.
 * Setiap modul: { id, group, label, requires[], evaluate(ctx) → HazardResult } (fungsi murni, tanpa fetch, tanpa className).
 * id modul = tipe laporan warga = kunci i18n = feature flag (`HAZARDS_ENABLED`).
 *
 * ctx = { location, now, weather (weatherFeatures: current/next24/next72 + thermal per hari untuk modul `suhu`), ari,
 *         airQuality (/api/air-quality), fireDanger (/api/fire-danger), drought (/api/drought: HTH, neraca, SPI, VPD),
 *         reports, bmkgNowcast, quakes (/api/quakes?location=), volcano (/api/volcano),
 *         convective (/api/convective?location=), flood (/api/flood — sel GloFAS per sentra), externalReports (konteks saja) }
 * evaluateAll(ctx) → { results[] (terurut level), worst, active[], counts, interactions[] } — interaksi antar-bahaya
 * (gempa×tanah jenuh, kekeringan×FFMC, badai×longsor, vulkanik×hujan, asap×hujan) diterapkan setelah evaluasi modul (interactions.js).
 */
import landslide from './landslide.js'
import watershed from './watershed.js'
import wind from './wind.js'
import rust from './rust.js'
import airQuality from './airQuality.js'
import fireWeather from './fireWeather.js'
import drought from './drought.js'
import quake from './quake.js'
import volcano from './volcano.js'
import convective from './convective.js'
import temperature from './temperature.js'
import { LEVEL_ORDER, LEVEL_LABEL, normalizeLevel, maxLevel } from './levels.js'
import { applyInteractions } from './interactions.js'

/** Urutan default (dipakai saat level sama). */
export const HAZARDS = [landslide, watershed, wind, convective, airQuality, fireWeather, drought, quake, volcano, temperature, rust]
export const HAZARD_IDS = HAZARDS.map((h) => h.id)
export const GROUP_LABEL = { hidromet: 'Hidrometeorologi', atmosfer: 'Atmosfer & kebakaran', geologi: 'Geologi', agro: 'Agro-kopi' }

export function getHazard(id) {
  return HAZARDS.find((h) => h.id === id) ?? null
}

/** Daftar id aktif dari string env/pref ("" atau "*" = semua). */
export function parseEnabled(value, all = HAZARD_IDS) {
  if (value == null) return [...all]
  const s = String(value).trim()
  if (!s || s === '*' || s === 'all') return [...all]
  const set = new Set(s.split(',').map((x) => x.trim()).filter(Boolean))
  return all.filter((id) => set.has(id))
}

/** Normalisasi hasil evaluate agar selalu memenuhi kontrak §2.1. */
export function normalizeResult(mod, raw, ctx) {
  const r = raw ?? {}
  const level = normalizeLevel(r.level)
  const advice = r.advice ?? {}
  return {
    id: mod.id,
    group: mod.group,
    label: mod.label,
    level,
    levelLabel: LEVEL_LABEL[level],
    score: typeof r.score === 'number' && Number.isFinite(r.score) ? r.score : null,
    headline: r.headline ?? LEVEL_LABEL[level],
    detail: r.detail ?? '',
    metrics: Array.isArray(r.metrics) ? r.metrics.filter((m) => m && m.key) : [],
    advice: Array.isArray(advice) ? { umum: advice } : advice,
    sources: Array.isArray(r.sources) ? r.sources : [],
    validUntil: r.validUntil ?? null,
    flags: r.flags ?? {},
    degraded: !!r.degraded || level === 'n/a',
    evaluatedAt: ctx?.now ?? null,
  }
}

/**
 * Jalankan semua modul aktif untuk satu lokasi. Tidak pernah throw: modul yang gagal → n/a + degraded.
 * @returns {{ results: object[], worst: string, active: object[], counts: object }} terurut: level tertinggi dulu, lalu urutan registry.
 */
export function evaluateAll(ctx, { enabled = null, hidden = [], interactions: withInteractions = true } = {}) {
  const allowed = new Set(enabled ?? HAZARD_IDS)
  const hide = new Set(hidden ?? [])
  let results = []
  HAZARDS.forEach((mod, order) => {
    if (!allowed.has(mod.id) || hide.has(mod.id)) return
    let raw
    try {
      const missing = (mod.requires ?? []).filter((k) => ctx?.[k] == null)
      raw = missing.length ? { level: 'n/a', degraded: true, headline: `Data belum tersedia (${missing.join(', ')})` } : mod.evaluate(ctx)
    } catch (err) {
      raw = { level: 'n/a', degraded: true, headline: `Gagal mengevaluasi: ${err.message}` }
    }
    results.push({ ...normalizeResult(mod, raw, ctx), order })
  })
  // Fase 2.5 — aturan interaksi lintas-bahaya (gempa × tanah jenuh, asap × hujan lebat, kekeringan × FFMC, …)
  let interactions = []
  if (withInteractions) {
    const applied = applyInteractions(results, ctx)
    results = applied.results.map((r) => ({ ...r, levelLabel: LEVEL_LABEL[r.level] }))
    interactions = applied.interactions
  }
  results.sort((a, b) => (LEVEL_ORDER[b.level] - LEVEL_ORDER[a.level]) || (a.order - b.order))
  const active = results.filter((r) => LEVEL_ORDER[r.level] >= LEVEL_ORDER.waspada)
  const counts = { total: results.length, active: active.length, degraded: results.filter((r) => r.degraded).length, interactions: interactions.length }
  return { results, worst: maxLevel(results.map((r) => r.level)), active, counts, interactions }
}

/** Ringkasan sangat ringkas (untuk daftar 15 sentra / peta / arsip harian). */
export function summarize(evaluated) {
  return {
    worst: evaluated.worst,
    levels: Object.fromEntries(evaluated.results.map((r) => [r.id, r.level])),
    active: evaluated.active.map((r) => ({ id: r.id, level: r.level, headline: r.headline })),
    degraded: evaluated.counts.degraded,
    interactions: (evaluated.interactions ?? []).map((i) => i.id),
  }
}

export { LEVEL_ORDER, LEVEL_LABEL, normalizeLevel, maxLevel }
