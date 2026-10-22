/**
 * U1 — navigasi papan ketik antar-pin peta.
 *
 * Peta skematik punya 15 pin. Kalau semuanya `tabIndex=0`, pengguna keyboard
 * harus menekan Tab 15 kali sebelum mencapai panel konteks. Solusinya roving
 * tabindex: satu pin yang bisa di-Tab, panah berpindah ke pin terdekat pada
 * arah yang ditekan, Home/End ke ujung daftar.
 *
 * Fungsi ini murni agar mudah diuji: diberi daftar pin {id, x, y} dan arah,
 * kembalikan id pin tujuan. Tidak ada pembungkusan (wrap) supaya pengguna
 * tidak "berteleportasi" dari ujung kiri ke ujung kanan peta.
 */

const EPS = 4

export const PIN_DIRECTIONS = ['left', 'right', 'up', 'down']

/** Arah panah → arah peta (SVG: y bertambah ke bawah). */
export function arrowToDirection(key) {
  if (key === 'ArrowLeft') return 'left'
  if (key === 'ArrowRight') return 'right'
  if (key === 'ArrowUp') return 'up'
  if (key === 'ArrowDown') return 'down'
  return null
}

export function nextPin(pins, currentId, direction) {
  if (!Array.isArray(pins) || pins.length === 0) return null
  if (pins.length === 1) return pins[0].id
  const current = pins.find((pin) => pin.id === currentId)
  if (!current) return pins[0]?.id ?? null

  let best = null
  let bestScore = Infinity
  for (const pin of pins) {
    if (!pin || pin.id === current.id) continue
    const dx = pin.x - current.x
    const dy = pin.y - current.y
    const primary = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy
    if (primary <= EPS) continue
    const cross = Math.abs(direction === 'left' || direction === 'right' ? dy : dx)
    // Jarak searah + penalti arah menyilang: pin yang jauh menyamping tidak menang.
    const score = primary + cross * 1.8
    if (score < bestScore) {
      bestScore = score
      best = pin.id
    }
  }
  return best ?? current.id
}
