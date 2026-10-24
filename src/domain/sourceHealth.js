/**
 * F-05/F-16 (Sprint B, rencana audit) — kesehatan sumber data, satu tempat.
 *
 * Audit 23 Okt 2026 menemukan dua kegagalan yang tidak bersuara: IMERG gagal 15/15
 * (ARI jatuh ke model) dan MAGMA menolak host produksi, tetapi tidak ada yang
 * memberi tahu siapa pun. `/healthz` sudah memuat keadaan per sumber; modul ini
 * mengubahnya menjadi **daftar masalah** yang bisa dipakai alarm.
 *
 * Aturan (disepakati di rencana audit, diperbaiki 2.3.3 setelah pemeriksaan produksi):
 *  - sumber `degraded` → masalah;
 *  - data lebih tua dari `staleHours` (bawaan 6 jam) → masalah;
 *  - `belum-dimuat` → masalah **hanya** untuk sumber inti dan setelah masa pemanasan.
 *
 * Mengapa `belum-dimuat` tidak otomatis masalah: sebagian sumber memang **dimuat saat
 * diminta** (lazy), bukan saat proses hidup — `alerts`, `alerts/imerg` (lewat probe,
 * lihat server/imergProbe.js), `airQuality`, `fireDanger`, `petabencana`. Sebelum
 * perbaikan ini, `/healthz` di produksi menyatakan `ok: false` dengan lima sumber
 * "belum pernah dimuat" padahal tidak ada yang rusak, dan alarm Telegram berbunyi
 * setiap kali server dimulai ulang. Pemanasan (`WARMUP_MIN`) memisahkan "baru hidup"
 * dari "gagal memuat".
 *
 * Murni: tanpa jaringan, tanpa jam global, tanpa tulis berkas.
 */

export const STALE_HOURS = 6
export const COOLDOWN_H = 6

/** Sumber yang WAJIB terisi tanpa perlu ada pengguna; kosong setelah pemanasan = masalah. */
export const CORE_SOURCES = ['hazards', 'bmkgNowcast', 'quakes', 'flood', 'volcano', 'hotspots', 'imerg']

/** Masa tenggang setelah proses hidup sebelum `belum-dimuat` pada sumber inti dianggap masalah. */
export const WARMUP_MIN = 10

const JAM = 3_600_000

function umurJam(retrievedAt, now) {
  if (!retrievedAt) return null
  const t = new Date(retrievedAt).getTime()
  if (!Number.isFinite(t)) return null
  return Math.round(((new Date(now).getTime() - t) / JAM) * 10) / 10
}

/**
 * @param {Record<string, {state?: string, error?: string, retrievedAt?: string|null, imergCount?: number}>} sources
 *   Bentuk `sources` dari `/healthz`.
 * @param {{now?: Date|string, staleHours?: number, coreSources?: string[], uptimeSec?: number, warmupMin?: number}} [opsi]
 * @returns {{ok: boolean, checkedAt: string, staleHours: number,
 *   problems: Array<{id: string, state: string, ageHours: number|null, reason: string}>,
 *   idle: Array<{id: string, reason: string}>}}
 */
export function assessSources(sources = {}, {
  now = new Date(),
  staleHours = STALE_HOURS,
  coreSources = CORE_SOURCES,
  uptimeSec = Infinity,
  warmupMin = WARMUP_MIN,
} = {}) {
  const inti = new Set(coreSources)
  const problems = []
  const idle = []
  const lewatPemanasan = !Number.isFinite(uptimeSec) || uptimeSec >= warmupMin * 60

  for (const [id, s] of Object.entries(sources)) {
    if (!s || typeof s !== 'object') continue
    const state = s.state ?? 'ok'
    const ageHours = umurJam(s.retrievedAt, now)
    const alasan = []

    if (state === 'degraded') alasan.push(s.error || 'sumber melaporkan degradasi')
    if (ageHours !== null && ageHours > staleHours) alasan.push(`data berumur ${Math.round(ageHours)} jam`)

    if (state === 'belum-dimuat') {
      if (inti.has(id) && lewatPemanasan) {
        alasan.push(`belum pernah dimuat setelah ${Math.round((Number.isFinite(uptimeSec) ? uptimeSec : warmupMin * 60) / 60)} menit`)
      } else {
        // Bukan masalah: sumber lazy atau proses masih memanas. Tetap dicatat supaya
        // tidak hilang dari pandangan operator.
        idle.push({ id, reason: inti.has(id) ? 'menunggu pemanasan' : 'dimuat saat diminta' })
        continue
      }
    }

    if (!alasan.length) continue
    problems.push({ id, state, ageHours, reason: alasan.join('; ') })
  }
  return { ok: problems.length === 0, checkedAt: new Date(now).toISOString(), staleHours, problems, idle }
}

/** Tanda tangan stabil untuk anti-bising: id+state masalah, terurut. */
export function sourceSignature(health) {
  return (health?.problems ?? [])
    .map((p) => `${p.id}:${p.state}`)
    .sort()
    .join('|')
}

/**
 * Apakah alarm perlu dikirim sekarang? Kirim bila tanda tangan berubah, atau bila
 * tanda tangan sama tetapi sudah lewat masa tenang (`cooldownH`).
 *
 * @param {{signature?: string, at?: string}|null} prev keadaan terakhir (dari state file)
 */
export function shouldNotifySourceHealth(prev, signature, { now = new Date(), cooldownH = COOLDOWN_H } = {}) {
  if (!signature) return false
  if (!prev || prev.signature !== signature) return true
  const t = prev.at ? new Date(prev.at).getTime() : NaN
  if (!Number.isFinite(t)) return true
  return new Date(now).getTime() - t >= cooldownH * JAM
}

/** Kalimat siap kirim ke Telegram (satu paragraf, tanpa HTML). */
export function renderSourceHealth(health, { url = '' } = {}) {
  if (!health || health.ok) return ''
  const baris = health.problems.map((p) => `• ${p.id} (${p.state}): ${p.reason}`)
  const catatan = (health.idle ?? []).length
    ? [`(${health.idle.length} sumber lain belum dimuat — wajar, dimuat saat diminta)`]
    : []
  return [
    `Niu — ${health.problems.length} sumber data bermasalah`,
    ...baris,
    ...catatan,
    ...(url ? [`Status: ${url}`] : []),
  ].join('\n')
}
