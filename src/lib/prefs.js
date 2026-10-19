// Preferensi UI persisten: tema, wilayah terpilih (localStorage).
const KEYS = {
  theme: 'nga.theme', // 'light' | 'dark' | null = ikut sistem
  location: 'nga.location',
  hiddenHazards: 'nga.hiddenHazards', // daftar id bahaya yang disembunyikan pengguna (koma), FR-X-3
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* storage tidak tersedia (private mode) — abaikan */
  }
}

export const prefs = {
  getTheme() {
    const stored = safeGet(KEYS.theme)
    if (stored === 'light' || stored === 'dark') return stored
    // Terima preferensi dari prototipe dua arah bila browser menyimpan kunci lama.
    const direction = safeGet('niu.arah') || safeGet('niu.theme')
    if (direction === 'langit' || direction === 'dark') return 'dark'
    if (direction === 'tanah' || direction === 'light') return 'light'
    return null // ikut prefers-color-scheme
  },
  setTheme(v) {
    if (v === 'light' || v === 'dark') {
      safeSet(KEYS.theme, v)
      safeSet('niu.arah', v === 'dark' ? 'langit' : 'tanah')
    } else {
      try {
        window.localStorage.removeItem(KEYS.theme)
        window.localStorage.removeItem('niu.arah')
        window.localStorage.removeItem('niu.theme')
      } catch {}
    }
  },
  getLocationId() {
    return safeGet(KEYS.location)
  },
  setLocationId(id) {
    safeSet(KEYS.location, id)
  },
  getHiddenHazards() {
    return getHiddenHazards()
  },
  setHiddenHazards(ids) {
    safeSet(KEYS.hiddenHazards, (ids || []).join(','))
  },
}

/** Id bahaya yang disembunyikan pengguna (aman dipanggil di luar browser → []). */
export function getHiddenHazards() {
  if (typeof window === 'undefined') return []
  const raw = safeGet(KEYS.hiddenHazards)
  return raw ? raw.split(',').map((x) => x.trim()).filter(Boolean) : []
}

/**
 * Terapkan satu dari dua ARAH desain penuh ke <html>.
 * `dark` tetap dipertahankan untuk utilitas lama; `data-arah` adalah sumber
 * kebenaran visual baru: terang = Tanah, gelap = Langit.
 */
export function applyTheme(theme) {
  const root = document.documentElement
  const resolved = theme === 'dark' ? 'dark' : 'light'
  root.classList.toggle('dark', resolved === 'dark')
  root.classList.toggle('light', resolved === 'light')
  root.dataset.arah = resolved === 'dark' ? 'langit' : 'tanah'
  root.style.colorScheme = resolved
}

/** Tema efektif saat ini (ikut sistem bila tidak ada preferensi eksplisit). */
export function effectiveTheme() {
  const stored = prefs.getTheme()
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
