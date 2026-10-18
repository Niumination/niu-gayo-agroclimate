/**
 * H-GEMPA (Fase 2.1, FR-GEMPA-2/3/4) — modul registry `gempa`.
 * Input ctx.quakes = payload /api/quakes?location=<id> ({ quakes:[{ time, lat, lon, mag, depthKm, distKm, felt[], region, shakemapUrl }], latest, degraded }).
 * - `quakeImpact()` : MMI indikatif per sentra dari relasi atenuasi sederhana Bakun & Wentworth (1997):
 *     MMI = 3,67 + 1,17·M − 3,19·log10(R_hipo)   (R_hipo = √(jarak² + kedalaman²) km; kalibrasi California → label "indikatif").
 * - Level dari MMI indikatif di sentra (jendela 24 jam penuh; 24–72 jam dibatasi 'waspada'; > 72 jam = rendah/informasi).
 * - FR-GEMPA-4: M ≥ 5 & ≤ 100 km & ≤ 72 jam & (ARI72 ≥ 100 mm) → flags.landslideAfterQuake (banner longsor susulan).
 * Rujukan resmi: BMKG (gempadirasakan/shakemap). Tidak pernah memakai istilah status tanggap darurat.
 */
import { haversineKm } from '../geo.js'
import { QUAKE } from '../thresholds.js'

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
const MMI_LABEL = {
  1: 'tidak terasa',
  2: 'terasa sangat lemah',
  3: 'terasa lemah (getaran seperti truk lewat)',
  4: 'terasa jelas, jendela/pintu bergetar',
  5: 'terasa kuat, barang bergoyang/jatuh',
  6: 'semua orang merasakan; kerusakan ringan',
  7: 'kerusakan ringan–sedang pada bangunan lemah',
  8: 'kerusakan sedang–berat',
  9: 'kerusakan berat',
  10: 'kerusakan sangat berat',
  11: 'kerusakan hampir total',
  12: 'kehancuran total',
}

export function mmiRoman(mmi) {
  const n = Math.max(1, Math.min(12, Math.round(mmi)))
  return ROMAN[n]
}

/**
 * MMI indikatif (angka kontinu 1–12) di titik berjarak `distKm` (episentral) dari gempa M `mag` kedalaman `depthKm`.
 * @returns {{ mmi:number, roman:string, label:string, hypoKm:number }}
 */
export function quakeImpact({ mag, depthKm = 10, distKm = 0 }) {
  const m = Number(mag)
  if (!Number.isFinite(m)) return { mmi: null, roman: null, label: null, hypoKm: null }
  const d = Math.max(0, Number(distKm) || 0)
  const h = Math.max(1, Number(depthKm) || 10)
  const hypo = Math.max(QUAKE.minHypoKm, Math.sqrt(d * d + h * h))
  const raw = QUAKE.ipe.c0 + QUAKE.ipe.c1 * m - QUAKE.ipe.c2 * Math.log10(hypo)
  const mmi = Math.max(1, Math.min(12, Math.round(raw * 10) / 10))
  const n = Math.max(1, Math.min(12, Math.round(mmi)))
  return { mmi, roman: ROMAN[n], label: MMI_LABEL[n], hypoKm: Math.round(hypo) }
}

/** Level seragam dari MMI indikatif (docs/reference/THRESHOLDS.md §15). */
export function levelFromMmi(mmi) {
  if (mmi == null) return 'n/a'
  if (mmi >= QUAKE.mmi.ekstrem) return 'ekstrem'
  if (mmi >= QUAKE.mmi.bahaya) return 'bahaya'
  if (mmi >= QUAKE.mmi.waspada) return 'waspada'
  return 'rendah'
}

const LEVEL_RANK = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const capLevel = (level, cap) => (LEVEL_RANK[level] > LEVEL_RANK[cap] ? cap : level)

/** Cari MMI resmi BMKG untuk tempat di Aceh Tengah/Bener Meriah dalam daftar `felt`. */
export function officialFeltGayo(felt = []) {
  const re = /takengon|aceh tengah|bener meriah|redelong|gayo|bebesen|bebesan|pegasing|kebayakan|silih nara|bintang|lut tawar|pondok baru|simpang tiga/i
  return felt.filter((f) => f.place && re.test(f.place)).sort((a, b) => (b.mmiNum ?? 0) - (a.mmiNum ?? 0))[0] ?? null
}

const ADVICE_BASE = {
  umum: ['Saat guncangan: MERUNDUK, BERLINDUNG di bawah meja kokoh, BERTAHAN sampai guncangan berhenti; jauhi kaca & lemari.', 'Setelah guncangan: keluar dengan tenang, jauhi tebing jalan, tiang & dinding retak; waspada gempa susulan.'],
  rentan: ['Dampingi lansia/anak/difabel menuju tempat terbuka; siapkan obat rutin & senter.'],
  kebun: ['Periksa retakan baru di lereng kebun, teras & saluran air; tunda kerja di lereng curam 72 jam setelah gempa kuat.'],
  sekolah: ['Latihan evakuasi; periksa retakan struktur, atap & tandon air sebelum kelas dipakai kembali.'],
}

export default {
  id: 'gempa',
  group: 'geologi',
  label: { id: 'Gempa Bumi' },
  requires: ['quakes'],
  evaluate(ctx) {
    const doc = ctx.quakes
    const loc = ctx.location
    const nowMs = new Date(ctx.now ?? Date.now()).getTime()
    const list = Array.isArray(doc?.quakes) ? doc.quakes : []
    const sources = [{ name: 'BMKG — gempa dirasakan & info gempa (data.bmkg.go.id)', kind: 'official', retrievedAt: doc?.retrievedAt ?? ctx.now, url: 'https://www.bmkg.go.id/gempabumi/' }]
    if (!doc || doc.degraded && !list.length) {
      return { level: 'n/a', degraded: true, headline: doc?.stale ? 'Informasi gempa belum diperbarui; data terakhir tetap ditampilkan.' : 'Informasi gempa belum tersedia.', sources }
    }
    // Hitung dampak indikatif per gempa (≤ 7 hari untuk daftar; level hanya ≤ 72 jam)
    const scored = list
      .map((q) => {
        const distKm = loc && Number.isFinite(q.lat) && Number.isFinite(q.lon) ? haversineKm(loc.lat, loc.lon, q.lat, q.lon) : q.distKm ?? null
        const impact = quakeImpact({ mag: q.mag, depthKm: q.depthKm, distKm: distKm ?? 0 })
        const ageH = (nowMs - new Date(q.time).getTime()) / 3_600_000
        const official = officialFeltGayo(q.felt)
        // MMI resmi BMKG untuk tempat di Gayo menang atas estimasi bila lebih tinggi
        const mmiEff = official?.mmiNum != null ? Math.max(impact.mmi ?? 0, official.mmiNum) : impact.mmi
        let level = levelFromMmi(mmiEff)
        if (ageH > QUAKE.windowH.full && ageH <= QUAKE.windowH.decay) level = capLevel(level, 'waspada')
        if (ageH > QUAKE.windowH.decay || ageH < -1) level = 'rendah'
        return { ...q, distKm: distKm != null ? Math.round(distKm) : null, impact, official, mmiEff, ageH, level }
      })
      .sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || (b.mmiEff ?? 0) - (a.mmiEff ?? 0) || new Date(b.time) - new Date(a.time))
    const top = scored[0] ?? null
    const level = top ? top.level : 'rendah'
    // FR-GEMPA-4 — gempa × tanah jenuh → longsor susulan (72 jam)
    const ari72 = ctx.ari?.ari72 ?? ctx.weather?.rain72 ?? 0
    const trigger = scored.find((q) => q.mag >= QUAKE.landslide.minMag && q.distKm != null && q.distKm <= QUAKE.landslide.maxKm && q.ageH <= QUAKE.windowH.decay && q.ageH >= -1)
    const landslideAfterQuake = !!trigger && ari72 >= QUAKE.landslide.ari72
    const advice = { ...ADVICE_BASE }
    if (landslideAfterQuake) advice.kebun = ['Tanah jenuh + gempa kuat: risiko longsor susulan 72 jam — jauhi lereng curam, tebing jalan & bantaran; amati retakan/rembesan baru.', ...ADVICE_BASE.kebun]
    const metrics = top
      ? [
          { key: 'mag', label: 'Magnitudo', value: top.mag, unit: 'M' },
          { key: 'depth', label: 'Kedalaman', value: top.depthKm, unit: 'km' },
          { key: 'dist', label: 'Jarak ke sentra', value: top.distKm, unit: 'km' },
          { key: 'mmi', label: 'MMI indikatif di sentra', value: top.impact.roman, unit: '' },
          ...(top.official ? [{ key: 'mmiBmkg', label: `MMI BMKG (${top.official.place})`, value: top.official.mmi, unit: '' }] : []),
          { key: 'ari72', label: 'Hujan 72 jam', value: Math.round(ari72), unit: 'mm' },
        ]
      : []
    const hist = doc.history
    const impactSummary = { rendah: 'ringan', waspada: 'perlu diwaspadai', bahaya: 'tinggi', ekstrem: 'sangat kuat' }[top?.level] ?? 'belum diketahui'
    const headline = top
      ? `Dampak gempa diperkirakan ${impactSummary}${top.distKm != null ? `, sekitar ${top.distKm} km dari sentra` : ''}.`
      : 'Belum ada gempa yang perlu perhatian di sekitar sentra.'
    const detail = [
      top ? `${top.impact.label}. Estimasi dari relasi atenuasi sederhana — rujuk shakemap/BMKG untuk intensitas resmi.` : 'Umpan BMKG memuat 15 gempa dirasakan + 15 gempa M ≥ 5 terakhir se-Indonesia; hanya yang relevan untuk Gayo ditampilkan.',
      landslideAfterQuake ? `Hujan 72 jam ${Math.round(ari72)} mm ≥ ${QUAKE.landslide.ari72} mm setelah M${trigger.mag} berjarak ${trigger.distKm} km → risiko longsor susulan.` : '',
      hist ? `Riwayat 10 tahun (USGS, ≤ 150 km): ${hist.count} gempa M ≥ 4,5, ${hist.countM5} di antaranya M ≥ 5; terbesar M${hist.largest?.mag} (${String(hist.largest?.time ?? '').slice(0, 10)}). Gempa Gayo 2 Juli 2013 M6,1 merusak Ketol–Kute Panang–Kebayakan.` : '',
    ].filter(Boolean).join(' ')
    if (top?.shakemapUrl) sources.push({ name: 'Shakemap BMKG', kind: 'official', url: top.shakemapUrl })
    if (hist) sources.push({ name: 'USGS FDSN (riwayat 10 tahun)', kind: 'catalog', url: 'https://earthquake.usgs.gov/' })
    return {
      level,
      score: top?.mmiEff != null ? Math.min(100, Math.round((top.mmiEff / 8) * 100)) : 0,
      headline,
      detail,
      metrics,
      advice,
      sources,
      flags: {
        eventId: top?.id ?? null,
        indicative: true,
        landslideAfterQuake,
        triggerQuake: trigger ? { id: trigger.id, mag: trigger.mag, distKm: trigger.distKm, time: trigger.time } : null,
        recent: scored.filter((q) => q.ageH <= 168).slice(0, 5).map((q) => ({ id: q.id, time: q.time, mag: q.mag, depthKm: q.depthKm, distKm: q.distKm, mmi: q.impact.roman, region: q.region, level: q.level })),
      },
      validUntil: new Date(nowMs + 2 * 3_600_000).toISOString(),
      degraded: !!doc.degraded,
    }
  },
}
