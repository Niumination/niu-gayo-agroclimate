/**
 * P7.6 — deteksi & penundaan tawaran pasang PWA.
 * Fungsi murni atas `window`/`navigator` supaya mudah diuji dan tidak
 * menimbulkan efek samping saat modul diimpor.
 */
export const DISMISS_KEY = 'niu.install.dismiss'
export const DISMISS_DAYS = 7

export function isStandalone(win = typeof window !== 'undefined' ? window : null) {
  if (!win) return false
  try {
    return win.matchMedia?.('(display-mode: standalone)').matches === true || win.navigator?.standalone === true
  } catch {
    return false
  }
}

export function isIos(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav) return false
  const ua = nav.userAgent || ''
  const touchMac = nav.platform === 'MacIntel' && (nav.maxTouchPoints || 0) > 1
  return /iPad|iPhone|iPod/.test(ua) || touchMac
}

export function isIosSafari(nav = typeof navigator !== 'undefined' ? navigator : null) {
  if (!nav || !isIos(nav)) return false
  const ua = nav.userAgent || ''
  return /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

/**
 * Akses localStorage bisa melempar SecurityError saat halaman berjalan di iframe
 * sandbox (origin opaque), bukan hanya tidak tersedia. Baca lewat helper ini.
 */
function safeLocalStorage() {
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

export function isDismissed(now = Date.now(), storage = safeLocalStorage()) {
  if (!storage) return false
  try {
    const until = Number(storage.getItem(DISMISS_KEY) || 0)
    return Number.isFinite(until) && until > now
  } catch {
    return false
  }
}

export function dismissFor(days = DISMISS_DAYS, now = Date.now(), storage = safeLocalStorage()) {
  if (!storage) return
  try {
    storage.setItem(DISMISS_KEY, String(now + days * 24 * 60 * 60 * 1000))
  } catch {
    /* mode privat */
  }
}
