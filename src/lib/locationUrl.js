/**
 * F-24 (audit 2026-10-23) — sentra terpilih ikut di URL.
 *
 * Sebelum ini sentra hanya disimpan di localStorage, sehingga tautan yang dibagikan
 * (`Bagikan`, WhatsApp, atau salinan alamat peramban) selalu membuka sentra milik
 * *penerima*, bukan sentra yang sedang dilihat pengirim.
 *
 * Kontrak:
 *   readLocationId(search, fallback) → id sentra dari `?sentra=` bila sah, jika tidak `fallback`
 *   withSentra(href, id)             → href dengan `?sentra=` disetel/dihapus, parameter lain utuh
 *
 * Keduanya fungsi murni supaya bisa diuji tanpa DOM.
 */

/** Batas panjang id yang masuk akal (id sentra di repo ini pendek, mis. "bebesan"). */
const MAX_ID = 40

export function readLocationId(search, fallback = null, validIds = null) {
  let raw
  try {
    raw = new URLSearchParams(search || '').get('sentra') || ''
  } catch {
    raw = ''
  }
  const id = raw.trim().slice(0, MAX_ID)
  if (!id) return fallback
  if (validIds && !validIds.has(id)) return fallback
  return id
}

export function withSentra(href, id) {
  const url = new URL(href, 'http://n')
  if (id) url.searchParams.set('sentra', id)
  else url.searchParams.delete('sentra')
  const qs = url.searchParams.toString()
  return `${url.pathname}${qs ? `?${qs}` : ''}${url.hash}`
}
