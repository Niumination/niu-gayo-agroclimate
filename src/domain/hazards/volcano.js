/**
 * H-VULKANIK (Fase 2.2b, FR-VULK-2/3/5) — modul registry `vulkanik` untuk Burni Telong (Bener Meriah, ±16 km dari Takengon).
 * Input ctx.volcano = payload /api/volcano ({ volcano:{ level 1..4, label, radiusKm, reportUrl, summit }, wind, downwind[], degraded, stale }).
 * Level MAGMA I/II/III/IV → rendah/waspada/bahaya/ekstrem untuk sentra ≤ 30 km dari puncak; 30–60 km turun satu tingkat;
 * > 60 km = rendah (informasi). Sentra "di bawah angin" (sektor ±30°, ≤ 30 km) ditandai potensi hujan abu bila erupsi (flag, bukan level).
 * FR-VULK-5: Level III/IV → flags.globalBanner untuk semua sentra ≤ 30 km.
 */
import { haversineKm, BURNI_TELONG } from '../geo.js'
import { VOLCANO } from '../thresholds.js'

const LEVELS = ['n/a', 'rendah', 'waspada', 'bahaya', 'ekstrem']
const ROMAN = ['', 'I', 'II', 'III', 'IV']

/** Arah (bearing) awal dari titik 1 ke titik 2, derajat 0–360. */
export function bearingDeg(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lon2 - lon1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
}

/** Selisih sudut terkecil (0–180). */
export function angleDiff(a, b) {
  const d = Math.abs(((a - b) % 360) + 360) % 360
  return d > 180 ? 360 - d : d
}

/**
 * Sentra di bawah angin: angin bertiup DARI `windFromDeg` → kepulan bergerak KE (windFromDeg + 180).
 * @returns {Array<{id,name,distKm,bearing,inSector}>} semua sentra (inSector true bila dalam ±halfAngle & ≤ maxKm)
 */
export function downwindSentra({ summit = BURNI_TELONG, windFromDeg, locations = [], halfAngle = VOLCANO.sectorHalfAngle, maxKm = VOLCANO.sectorMaxKm } = {}) {
  const plumeTo = windFromDeg == null ? null : (Number(windFromDeg) + 180) % 360
  return locations.map((l) => {
    const distKm = haversineKm(summit.lat, summit.lon, l.lat, l.lon)
    const bearing = bearingDeg(summit.lat, summit.lon, l.lat, l.lon)
    const inSector = plumeTo != null && distKm <= maxKm && angleDiff(bearing, plumeTo) <= halfAngle
    return { id: l.id, name: l.name, distKm: Math.round(distKm * 10) / 10, bearing: Math.round(bearing), inSector }
  })
}

/** Level seragam dari tingkat MAGMA + jarak sentra ke puncak. */
export function levelForDistance(magmaLevel, distKm) {
  if (!(magmaLevel >= 1 && magmaLevel <= 4)) return 'n/a'
  let idx = magmaLevel // 1..4 → rendah..ekstrem
  if (distKm > VOLCANO.farKm) idx = 1
  else if (distKm > VOLCANO.nearKm) idx = Math.max(1, idx - 1)
  return LEVELS[idx]
}

const ADVICE = {
  1: { umum: ['Status Normal: tidak ada pembatasan khusus; ikuti rilis PVMBG bila berubah.'] },
  2: {
    umum: [`Status Waspada: jangan mendekati kawah/puncak dalam radius rekomendasi PVMBG; gas fumarola (belerang) dapat terkumpul di cekungan saat hujan/mendung.`, 'Siapkan masker kain/N95 & tutup penampung air hujan bila tercium bau belerang atau tampak abu tipis.'],
    kebun: ['Kenali jalur turun dari kebun di lereng Burni Telong; jangan berkemah/menginap dekat kawah.'],
    sekolah: ['Sosialisasikan tanda bahaya (bau belerang menyengat, hujan abu) dan titik kumpul.'],
  },
  3: {
    umum: ['Status Siaga: ikuti arahan BPBD/PVMBG; siapkan masker, kacamata, air bersih tertutup & tas siaga.', 'Hujan abu: tetap di dalam, tutup ventilasi, lindungi mata & saluran napas; bersihkan atap agar tidak roboh.'],
    rentan: ['Penderita asma/PPOK, balita & lansia: hindari paparan abu; siapkan obat & rencana rujukan.'],
    kebun: ['Lindungi bunga/buah kopi & bibit dari abu (naungan sementara); tutup bak pengolahan & jemuran; cuci daun setelah hujan abu bila air cukup.'],
    sekolah: ['Pertimbangkan belajar dari rumah untuk sekolah di sektor bawah angin ≤ 30 km saat hujan abu.'],
  },
  4: {
    umum: ['Status Awas: patuhi perintah evakuasi BPBD; jauhi radius bahaya & lembah sungai berhulu di gunung (lahar).', 'Gunakan masker N95, tutup penampung air, matikan listrik bila atap sarat abu.'],
    rentan: ['Prioritaskan evakuasi kelompok rentan; bawa obat, dokumen & air.'],
    kebun: ['Tinggalkan kebun di sektor bahaya; amankan hasil panen di gudang tertutup.'],
    sekolah: ['Sekolah di radius/sektor bahaya ditutup sesuai arahan BPBD.'],
  },
}

export default {
  id: 'vulkanik',
  group: 'geologi',
  label: { id: 'Gunung Api Burni Telong', gayo: 'Bur ni Telong' },
  requires: ['volcano'],
  evaluate(ctx) {
    const doc = ctx.volcano
    const v = doc?.volcano
    const loc = ctx.location
    const sources = [{ name: 'MAGMA Indonesia — PVMBG/Badan Geologi (tingkat aktivitas)', kind: 'official', retrievedAt: doc?.retrievedAt ?? ctx.now, url: doc?.pageUrl ?? 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas' }]
    if (!v) return { level: 'n/a', degraded: true, headline: 'Tingkat aktivitas PVMBG belum tersedia', sources }
    const summit = v.summit ?? BURNI_TELONG
    const distKm = loc ? haversineKm(summit.lat, summit.lon, loc.lat, loc.lon) : null
    const level = distKm == null ? LEVELS[v.level] ?? 'n/a' : levelForDistance(v.level, distKm)
    const me = (doc.downwind ?? []).find((d) => d.id === loc?.id) ?? null
    const windFrom = doc.wind?.dir850 ?? doc.wind?.dir10m ?? null
    const globalBanner = v.level >= 3 && distKm != null && distKm <= VOLCANO.nearKm
    const advice = { ...(ADVICE[v.level] ?? {}) }
    if (me?.inSector && v.level >= 2) advice.umum = [`Sentra ini berada di sektor bawah angin (angin dari ${Math.round(windFrom)}°): bila terjadi erupsi, hujan abu paling mungkin ke arah sini — siapkan masker & tutup penampung air.`, ...(advice.umum ?? [])]
    if (v.reportUrl) sources.push({ name: 'Laporan aktivitas terakhir (MAGMA)', kind: 'official', url: v.reportUrl })
    if (doc.wind) sources.push({ name: doc.wind.source ?? 'Open-Meteo (angin puncak)', kind: 'model', retrievedAt: doc.retrievedAt })
    const headline = `Level ${ROMAN[v.level]} (${v.label}) — ${v.name ?? 'Bur Ni Telong'}${distKm != null ? ` · ${Math.round(distKm)} km dari sentra` : ''}${v.radiusKm ? ` · radius rekomendasi ${v.radiusKm} km` : ''}${me?.inSector ? ' · di bawah angin' : ''}${doc.stale ? ' · data terakhir (MAGMA tidak terjangkau)' : ''}`
    const detail = [
      v.level === 2 ? 'Peningkatan aktivitas vulkanik teramati (PVMBG); ancaman utama saat ini gas vulkanik di sekitar kawah dan erupsi freatik kecil.' : v.level >= 3 ? 'Aktivitas meningkat nyata/erupsi — ikuti rilis PVMBG & BPBD Bener Meriah/Aceh Tengah.' : 'Aktivitas dalam batas normal menurut PVMBG.',
      windFrom != null ? `Angin ${doc.wind?.dir850 != null ? '850 hPa' : '10 m'} dari ${Math.round(windFrom)}° (${Math.round(doc.wind?.speed850 ?? doc.wind?.speed10m ?? 0)} km/jam); sentra di bawah angin: ${(doc.downwind ?? []).filter((d) => d.inSector).map((d) => d.name).join(', ') || 'tidak ada (≤ 30 km)'}.` : 'Arah angin puncak belum tersedia.',
      'Status tingkat aktivitas hanya ditetapkan PVMBG; aplikasi ini meneruskan, bukan menilai.',
    ].join(' ')
    return {
      level,
      score: Math.min(100, Math.round(((v.level - 1) / 3) * 100)),
      headline,
      detail,
      metrics: [
        { key: 'magmaLevel', label: 'Tingkat aktivitas PVMBG', value: `${ROMAN[v.level]} (${v.label})`, unit: '' },
        { key: 'dist', label: 'Jarak ke puncak', value: distKm != null ? Math.round(distKm * 10) / 10 : null, unit: 'km' },
        { key: 'radius', label: 'Radius rekomendasi', value: v.radiusKm ?? null, unit: 'km' },
        { key: 'windFrom', label: 'Angin puncak dari', value: windFrom != null ? Math.round(windFrom) : null, unit: '°' },
      ],
      advice,
      sources,
      flags: { magmaLevel: v.level, downwind: !!me?.inSector, globalBanner, stale: !!doc.stale, eventId: `magma-level-${v.level}` },
      validUntil: new Date(new Date(ctx.now ?? Date.now()).getTime() + 6 * 3_600_000).toISOString(),
      degraded: !!doc.stale,
    }
  },
}
