// F7 (ADR-11): kalender risiko musiman hidrometeorologi dataran tinggi Gayo.
// Zona ekuator: Aceh tidak punya 2 musim ekstrem — puncak hujan BMKG Okt–Des + Mar–Jun;
// longsor/banjir mengikuti akumulasi kelembaban tanah (puncak Nov–Feb).
// Murni fungsi bulan (1–12), tanpa dependensi.

export const PHASES = {
  tinggi: { phase: 'tinggi', label: 'PUNCAK', months: 'Nov–Feb' },
  sedang: { phase: 'sedang', label: 'WASPADA', months: 'Mar–Apr, Okt' },
  rendah: { phase: 'rendah', label: 'RENDAH', months: 'Mei–Sep' },
}

// Puncak risiko longsor: November (bulan tertinggi akumulasi).
const PEAK_MONTH = 11

/** Fase risiko longsor per bulan (1–12). */
export function seasonalPhase(month) {
  if (![1, 2, 11, 12].includes(month)) {
    if (month === 3 || month === 4 || month === 10) return 'sedang'
    if (month >= 5 && month <= 9) return 'rendah'
  }
  return 'tinggi'
}

/** Jarak bulan (1–12) ke puncak risiko (Nov). */
export function monthsToPeak(month) {
  return ((PEAK_MONTH - month) + 12) % 12
}

/** Catatan kontekstual per fase. */
export function seasonalNote(month) {
  const phase = seasonalPhase(month)
  const toPeak = monthsToPeak(month)
  if (phase === 'tinggi') return 'Puncak musim hujan — akumulasi air tanah tinggi, waspadai longsor & banjir bandang.'
  if (phase === 'sedang') return `Transisi musim hujan — mulai meningkat, ${toPeak === 0 ? 'puncak bulan ini' : `${toPeak} bulan ke puncak (Nov)`}.`
  return `Musim relatif kering (antara puncak hujan ekuator) — ${toPeak} bulan ke puncak (Nov).`
}

/** Objek seasonal lengkap untuk UI / server. */
export function seasonalInfo(month = new Date().getMonth() + 1) {
  const phase = seasonalPhase(month)
  return {
    month,
    phase,
    label: PHASES[phase].label,
    peakMonths: PHASES[phase].months,
    monthsToPeak: monthsToPeak(month),
    note: seasonalNote(month),
  }
}

// ---------------------------------------------------------------------------
// Fase 3.4 (F7+) — kalender musiman diperluas: fase kering (karhutla/kekeringan/embun upas) + penyesuaian tahunan
// dari prediksi musim BMKG (ENSO/IOD) yang dikurasi di src/data/hazards/climateOutlook.json.
// Klimatologi Gayo (ekuatorial bimodal): kering relatif Jun–Sep (puncak Jul–Agu; karhutla & HTH), transisi Mei & Okt,
// hujan Okt–Des & Mar–Mei. Embun upas: malam cerah-tenang musim kering (Jul–Sep) di plato > 1.400 m.
// ---------------------------------------------------------------------------

export const DRY_PHASES = {
  tinggi: { phase: 'tinggi', label: 'PUNCAK KERING', months: 'Jul–Agu' },
  sedang: { phase: 'sedang', label: 'KERING', months: 'Jun, Sep' },
  rendah: { phase: 'rendah', label: 'BASAH', months: 'Okt–Mei' },
}

/** Fase kering (karhutla/kekeringan) per bulan 1–12. */
export function dryPhase(month) {
  if (month === 7 || month === 8) return 'tinggi'
  if (month === 6 || month === 9) return 'sedang'
  return 'rendah'
}

/** Bulan rawan embun upas di plato (> 1.400 m): musim kering, malam cerah-tenang. */
export function frostWindow(month) {
  return month >= 6 && month <= 9
}

/**
 * Penyesuaian tahunan dari outlook iklim terkurasi (El Niño/IOD+ → kemarau diperpanjang & onset hujan terlambat;
 * La Niña/IOD− → hujan di atas normal, puncak longsor/banjir lebih awal & lebih basah).
 * @param outlook isi climateOutlook.json (opsional) — hanya dipakai bila `validUntil` belum lewat.
 * @returns {{ active:boolean, stale:boolean, shift:'drier'|'wetter'|'neutral', dryBoost:number, wetBoost:number, note:string|null }}
 */
export function climateAdjustment(outlook, { now = new Date() } = {}) {
  const cur = outlook?.current
  if (!cur) return { active: false, stale: false, shift: 'neutral', dryBoost: 0, wetBoost: 0, note: null }
  const stale = cur.validUntil ? new Date(`${cur.validUntil}T23:59:59+07:00`).getTime() < now.getTime() : false
  const enso = String(cur.enso?.phase ?? '').toLowerCase()
  const iod = String(cur.iod?.phase ?? '').toLowerCase()
  const strong = /kuat/.test(String(cur.enso?.strength ?? ''))
  let shift = 'neutral'
  if (enso.includes('el ni') || iod.includes('positif')) shift = 'drier'
  if (enso.includes('la ni') || iod.includes('negatif')) shift = shift === 'drier' ? 'neutral' : 'wetter'
  const dryBoost = shift === 'drier' ? (strong ? 2 : 1) : 0
  const wetBoost = shift === 'wetter' ? (strong ? 2 : 1) : 0
  const note =
    shift === 'drier'
      ? `${cur.enso?.phase ?? ''}${cur.enso?.strength ? ` ${cur.enso.strength}` : ''}${iod.includes('positif') ? ' + IOD positif' : ''}: kemarau diperpanjang, awal musim hujan ${cur.season?.rainyOnset ?? 'berpotensi terlambat'} — fase kering & karhutla dapat meluas hingga Okt–Nov.`
      : shift === 'wetter'
        ? `${cur.enso?.phase ?? ''}${iod.includes('negatif') ? ' + IOD negatif' : ''}: hujan di atas normal — puncak longsor/banjir lebih awal & lebih basah; antisipasi karat daun.`
        : null
  return { active: !stale, stale, shift, dryBoost, wetBoost, note }
}

const PHASE_RANK = { rendah: 0, sedang: 1, tinggi: 2 }
const PHASE_NAME = ['rendah', 'sedang', 'tinggi']
const bumpPhase = (phase, n) => PHASE_NAME[Math.max(0, Math.min(2, PHASE_RANK[phase] + n))]

/**
 * Kalender musiman diperluas untuk UI/server: fase hujan (longsor/banjir), fase kering (karhutla/kekeringan),
 * jendela embun upas, serta penyesuaian ENSO/IOD (hanya bila outlook masih berlaku).
 */
export function seasonalInfoExtended(month = new Date().getMonth() + 1, { outlook = null, now = new Date() } = {}) {
  const base = seasonalInfo(month)
  const adj = climateAdjustment(outlook, { now })
  let dry = dryPhase(month)
  let wet = base.phase
  if (adj.active && adj.shift === 'drier') {
    // kemarau diperpanjang: Sep–Nov naik satu tingkat kering, fase hujan Okt–Nov turun satu tingkat
    if ([9, 10, 11].includes(month)) dry = bumpPhase(dry, 1)
    if ([10, 11].includes(month)) wet = bumpPhase(wet, -1)
  } else if (adj.active && adj.shift === 'wetter') {
    if ([9, 10, 3, 4].includes(month)) wet = bumpPhase(wet, 1)
    if ([6, 7, 8, 9].includes(month)) dry = bumpPhase(dry, -1)
  }
  const dryNote =
    dry === 'tinggi'
      ? 'Puncak musim kering — bahan bakar permukaan kering: dilarang bakar lahan; pantau HTH, FWI & hotspot; hemat air kebun.'
      : dry === 'sedang'
        ? 'Musim kering — HTH mulai memanjang; siapkan mulsa, embung & sekat bakar.'
        : 'Di luar musim kering — risiko karhutla rendah kecuali HTH memanjang.'
  return {
    ...base,
    phase: wet,
    label: PHASES[wet].label,
    peakMonths: PHASES[wet].months,
    dry: { phase: dry, label: DRY_PHASES[dry].label, months: DRY_PHASES[dry].months, note: dryNote },
    frostWindow: frostWindow(month),
    climate: adj,
  }
}
