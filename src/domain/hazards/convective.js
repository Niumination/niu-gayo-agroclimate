/**
 * H-PETIR / H-ANGIN+ (Fase 2.3, FR-KONV-2/3/4) — modul registry `badai` (petir, hujan es, puting beliung).
 * Input ctx.convective = payload /api/convective?location= ({ hourly:{ time[], capeEcmwf[], capeGfs[], liGfs[], weatherCode[], rain[], gusts[] }, degraded }).
 * Konsensus: level = sinyal TERKUAT di antara ECMWF (CAPE/kode cuaca) dan GFS (LI/CAPE) dalam horizon 12 jam; `agreement:false`
 * bila kedua model berbeda ≥ 1 tingkat (ditampilkan transparan di kartu). Lihat docs/reference/THRESHOLDS.md §17.
 */
import { CONVECTIVE, WIND_GUST } from '../thresholds.js'

const RANK = { 'n/a': -1, rendah: 0, waspada: 1, bahaya: 2, ekstrem: 3 }
const LEVELS = ['rendah', 'waspada', 'bahaya', 'ekstrem']
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
const isTs = (code) => code != null && code >= 95 && code <= 99
const isHailCode = (code) => code === 96 || code === 99

/** Level dari satu jam berdasarkan CAPE ECMWF + kode cuaca. */
export function levelEcmwfHour(cape, code) {
  if (cape == null && code == null) return 'n/a'
  if (isTs(code) || (cape ?? 0) >= CONVECTIVE.cape.bahaya) return 'bahaya'
  if ((cape ?? 0) >= CONVECTIVE.cape.waspada) return 'waspada'
  return 'rendah'
}
/** Level dari satu jam berdasarkan LI & CAPE GFS. */
export function levelGfsHour(li, cape) {
  if (li == null && cape == null) return 'n/a'
  if ((li != null && li <= CONVECTIVE.li.bahaya) || (cape ?? 0) >= CONVECTIVE.cape.bahaya) return 'bahaya'
  if ((li != null && li <= CONVECTIVE.li.waspada) || (cape ?? 0) >= CONVECTIVE.cape.waspada) return 'waspada'
  return 'rendah'
}

/**
 * Risiko konvektif 6–12 jam ke depan.
 * @returns {{ level, peakIdx, peakTime, signals:{ecmwf,gfs}, agreement, maxCape, maxCapeGfs, minLi, maxGust, maxRain, tsCode, hail, tornado, hours }}
 */
export function convectiveRisk({ time = [], capeEcmwf = [], capeGfs = [], liGfs = [], weatherCode = [], rain = [], gusts = [], bmkgActive = false, nowIdx = 0, horizonH = CONVECTIVE.horizonH } = {}) {
  const start = Math.max(0, nowIdx)
  const end = Math.min(time.length, start + horizonH)
  if (end <= start) return { level: 'n/a', peakIdx: null, peakTime: null, signals: { ecmwf: 'n/a', gfs: 'n/a' }, agreement: true, hours: [] }
  const hours = []
  let peak = null
  for (let i = start; i < end; i++) {
    const ce = num(capeEcmwf[i])
    const cg = num(capeGfs[i])
    const li = num(liGfs[i])
    const code = num(weatherCode[i])
    const g = num(gusts[i]) ?? 0
    const r = num(rain[i]) ?? 0
    const le = levelEcmwfHour(ce, code)
    const lg = levelGfsHour(li, cg)
    const base = RANK[le] >= RANK[lg] ? le : lg
    let level = base
    if (base === 'bahaya' && (g >= CONVECTIVE.gustEkstrem || r >= CONVECTIVE.rainEkstrem || bmkgActive)) level = 'ekstrem'
    const h = { i, time: time[i], capeEcmwf: ce, capeGfs: cg, li, code, gust: g, rain: r, ecmwf: le, gfs: lg, level }
    hours.push(h)
    const score = RANK[level] * 10_000 + (ce ?? 0) + (cg ?? 0) - (li ?? 0) * 100
    if (!peak || score > peak.score) peak = { ...h, score }
  }
  const worstOf = (k) => hours.reduce((b, h) => (RANK[h[k]] > RANK[b] ? h[k] : b), 'n/a')
  const signals = { ecmwf: worstOf('ecmwf'), gfs: worstOf('gfs') }
  const agreement = signals.gfs === 'n/a' || signals.ecmwf === 'n/a' ? null : Math.abs(RANK[signals.ecmwf] - RANK[signals.gfs]) <= 0
  const level = hours.reduce((b, h) => (RANK[h.level] > RANK[b] ? h.level : b), 'rendah')
  const maxCape = Math.max(-1, ...hours.map((h) => h.capeEcmwf ?? -1))
  const maxCapeGfs = Math.max(-1, ...hours.map((h) => h.capeGfs ?? -1))
  const lis = hours.map((h) => h.li).filter((v) => v != null)
  const minLi = lis.length ? Math.min(...lis) : null
  const maxGust = Math.max(0, ...hours.map((h) => h.gust))
  const maxRain = Math.max(0, ...hours.map((h) => h.rain))
  const tsCode = hours.some((h) => isTs(h.code))
  const hail = hours.some((h) => isHailCode(h.code)) || (maxCape >= CONVECTIVE.hail.cape && minLi != null && minLi <= CONVECTIVE.hail.li)
  const tornado = RANK[level] >= RANK.bahaya && maxGust >= WIND_GUST.bmkgEkstrem // FR-KONV-4: puting beliung = konvektif bahaya + hembusan ≥ 45
  return { level, peakIdx: peak?.i ?? null, peakTime: peak?.time ?? null, signals, agreement, maxCape: maxCape < 0 ? null : maxCape, maxCapeGfs: maxCapeGfs < 0 ? null : maxCapeGfs, minLi, maxGust, maxRain, tsCode, hail, tornado, hours }
}

const ADVICE = {
  waspada: {
    umum: ['Atmosfer labil siang–sore: pantau awan menjulang gelap (kumulonimbus); bila guntur terdengar, hentikan kegiatan di tempat terbuka.'],
    kebun: ['Aturan 30-30: kilat → guntur < 30 detik = berlindung di bangunan tertutup; tunggu 30 menit setelah guntur terakhir.', 'Jauhi pohon pelindung tinggi, pagar kawat & tiang besi; tunda penyemprotan sore.'],
  },
  bahaya: {
    umum: ['Badai petir diperkirakan: tunda perjalanan sepeda motor melewati punggung bukit; cabut peralatan listrik saat petir dekat.'],
    rentan: ['Anak-anak jangan bermain di lapangan/tepi danau saat mendung gelap & guntur.'],
    kebun: ['Tunda panen/semprot/pemupukan sore; turun dari lereng terbuka & pohon pelindung sebelum hujan; amankan terpal jemur.', 'Potensi hujan es: lindungi pembibitan dengan paranet/terpal; buka saluran air agar es/limpasan tidak menggenang.'],
    sekolah: ['Pulangkan siswa sebelum jam puncak atau tahan di dalam gedung sampai badai lewat; jauhi tiang bendera & pohon.'],
  },
  ekstrem: {
    umum: ['Badai kuat dengan hembusan ≥ 45 km/jam (kriteria cuaca ekstrem BMKG) — tetap di bangunan kokoh; waspada puting beliung, pohon tumbang & atap seng beterbangan.'],
    rentan: ['Siapkan senter & obat; hindari ruangan dengan jendela kaca besar.'],
    kebun: ['Hentikan semua kegiatan kebun; ikat para-para & rumah pengering plastik; jauhi lereng (hujan intens → longsor dangkal).'],
    sekolah: ['Tunda kegiatan luar ruang & perjalanan pulang sampai badai lewat.'],
  },
}

const fmtHour = (t) => (t ? `${String(t).slice(11, 16)} WIB` : '–')

export default {
  id: 'badai',
  group: 'hidromet',
  label: { id: 'Petir & Badai', gayo: 'Petir & Badai [?]' },
  requires: ['convective'],
  evaluate(ctx) {
    const doc = ctx.convective
    const h = doc?.hourly
    const sources = [...(doc?.sources ?? [])].map((s) => ({ ...s, retrievedAt: doc?.retrievedAt ?? ctx.now }))
    if (!h || !h.time?.length) return { level: 'n/a', degraded: true, headline: doc?.error ? `Indeks konvektif tidak tersedia (${doc.error})` : 'Indeks konvektif belum tersedia', sources }
    const nowTime = ctx.weather?.nowTime ?? h.nowTime
    const nowIdx = Math.max(0, nowTime ? h.time.indexOf(String(nowTime).slice(0, 13) + ':00') : 0)
    const bmkgActive = !!(ctx.bmkgNowcast?.active && (ctx.bmkgNowcast?.alerts ?? []).some((a) => a.isAceh !== false))
    const r = convectiveRisk({ ...h, bmkgActive, nowIdx })
    const level = r.level
    const advice = { ...(ADVICE[level] ?? {}) }
    if (r.tornado) advice.umum = ['Kombinasi badai kuat + hembusan ≥ 45 km/jam → potensi puting beliung: segera masuk bangunan permanen, jauhi jendela.', ...(advice.umum ?? [])]
    const modelTxt = r.signals.gfs === 'n/a' ? 'ECMWF saja (GFS tidak tersedia)' : r.agreement ? 'ECMWF & GFS sepakat' : `model tidak sepakat (ECMWF ${r.signals.ecmwf}, GFS ${r.signals.gfs}) → ikut sinyal terkuat`
    const headline =
      level === 'rendah'
        ? `Atmosfer relatif stabil 12 jam ke depan (CAPE maks ${r.maxCape ?? '–'} J/kg${r.minLi != null ? `, LI min ${r.minLi}` : ''})`
        : `${r.tsCode ? 'Badai petir dalam prakiraan' : 'Potensi badai petir'} · puncak ${fmtHour(r.peakTime)} · CAPE ${r.maxCape ?? '–'} J/kg${r.minLi != null ? ` · LI ${r.minLi}` : ''}${r.hail ? ' · potensi hujan es' : ''}${r.tornado ? ' · potensi puting beliung' : ''}`
    return {
      level,
      score: Math.min(100, Math.round(((r.maxCape ?? 0) / 3000) * 100)),
      headline,
      detail: `${modelTxt}. Hembusan maks ${Math.round(r.maxGust)} km/jam, hujan maks ${r.maxRain} mm/jam dalam horizon${bmkgActive ? '; peringatan dini cuaca BMKG aktif untuk Aceh' : ''}. Hujan es hanya indikasi kualitatif (kode cuaca 96/99 atau CAPE ≥ ${CONVECTIVE.hail.cape} & LI ≤ ${CONVECTIVE.hail.li}).`,
      metrics: [
        { key: 'capeEcmwf', label: 'CAPE maks ECMWF', value: r.maxCape, unit: 'J/kg' },
        { key: 'capeGfs', label: 'CAPE maks GFS', value: r.maxCapeGfs, unit: 'J/kg' },
        { key: 'li', label: 'Lifted Index min (GFS)', value: r.minLi, unit: '' },
        { key: 'peak', label: 'Jam puncak', value: r.peakTime ? fmtHour(r.peakTime) : null, unit: '' },
        { key: 'gust', label: 'Hembusan maks', value: Math.round(r.maxGust), unit: 'km/jam' },
      ],
      advice,
      sources,
      flags: { signals: r.signals, agreement: r.agreement, hail: r.hail, tornado: r.tornado, tsCode: r.tsCode, bmkgActive, peakTime: r.peakTime, hours: r.hours.map((x) => ({ time: x.time, level: x.level, capeEcmwf: x.capeEcmwf, li: x.li, code: x.code, gust: x.gust })) },
      validUntil: r.hours.length ? new Date(new Date(ctx.now ?? Date.now()).getTime() + 3 * 3_600_000).toISOString() : null,
      degraded: !!doc.degraded,
    }
  },
}
