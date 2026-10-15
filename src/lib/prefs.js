// Preferensi UI persisten: bahasa, tema, wilayah terpilih (localStorage).
const KEYS = {
  lang: 'nga.lang',
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
  getLang() {
    return safeGet(KEYS.lang)
  },
  setLang(v) {
    safeSet(KEYS.lang, v)
  },
  getTheme() {
    return safeGet(KEYS.theme) // null → ikut prefers-color-scheme
  },
  setTheme(v) {
    if (v === 'light' || v === 'dark') safeSet(KEYS.theme, v)
    else {
      try {
        window.localStorage.removeItem(KEYS.theme)
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

/** Terapkan tema ke <html>: dark/light + media query bila ikut sistem. */
export function applyTheme(theme) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  if (theme === 'light' || theme === 'dark') {
    root.classList.add(theme)
    root.style.colorScheme = theme
  } else {
    root.style.colorScheme = ''
  }
}

/** Tema efektif saat ini (ikut sistem bila tidak ada preferensi eksplisit). */
export function effectiveTheme() {
  const stored = prefs.getTheme()
  if (stored) return stored
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}
