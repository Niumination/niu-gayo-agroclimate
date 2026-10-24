/**
 * F-05/F-16 (Sprint B, rencana audit) — kesehatan sumber data, satu tempat.
 *
 * Audit 23 Okt 2026 menemukan dua kegagalan yang tidak bersuara: IMERG gagal 15/15
 * (ARI jatuh ke model) dan MAGMA menolak host produksi, tetapi tidak ada yang
 * memberi tahu siapa pun. `/healthz` sudah memuat keadaan per sumber; modul ini
 * mengubahnya menjadi **daftar masalah** yang bisa dipakai alarm.
 *
 * Aturan (disepakati di rencana audit):
 *  - sumber `degraded` → masalah;
 *  - data lebih tua dari `staleHours` (bawaan 6 jam) → masalah;
 *  - `belum-dimuat` → masalah (server baru hidup atau cache kosong).
 *
 * Murni: tanpa jaringan, tanpa jam global, tanpa tulis berkas.
 */

export const STALE_HOURS = 6
export const COOLDOWN_H = 6

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
 * @returns {{ok: boolean, checkedAt: string, staleHours: number, problems: Array<{id: string, state: string, ageHours: number|null, reason: string}>}}
 */
export function assessSources(sources = {}, { now = new Date(), staleHours = STALE_HOURS } = {}) {
  const problems = []
  for (const [id, s] of Object.entries(sources)) {
    if (!s || typeof s !== 'object') continue
    const state = s.state ?? 'ok'
    const ageHours = umurJam(s.retrievedAt, now)
    const alasan = []

    if (state === 'degraded') alasan.push(s.error || 'sumber melaporkan degradasi')
    if (state === 'belum-dimuat') alasan.push('belum pernah dimuat')
    if (ageHours !== null && ageHours > staleHours) alasan.push(`data berumur ${Math.round(ageHours)} jam`)

    if (!alasan.length) continue
    problems.push({ id, state, ageHours, reason: alasan.join('; ') })
  }
  return { ok: problems.length === 0, checkedAt: new Date(now).toISOString(), staleHours, problems }
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
  return [
    `Niu — ${health.problems.length} sumber data bermasalah`,
    ...baris,
    url ? `Status: ${url}` : '',
  ]
    .filter(Boolean)
    .join('\n')
}
