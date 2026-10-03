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
