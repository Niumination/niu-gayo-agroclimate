/**
 * P8 — pembaruan service worker yang tidak tertahan satu muat ulang.
 *
 * Vite PWA mem-precache `index.html` **dan** seluruh bundel, lalu menjawab
 * navigasi lewat NavigationRoute. Saat rilis baru naik, service worker baru
 * mengaktifkan diri (`skipWaiting` + `clientsClaim`) hanya **setelah** halaman
 * selesai dimuat. Akibatnya muat ulang pertama pasca-deploy masih menyajikan
 * HTML lama dari precache: pengguna melihat versi aplikasi sebelumnya sampai
 * ia memuat ulang untuk kedua kalinya.
 *
 * Modul ini menutup celah itu:
 *   1. `registration.update()` saat halaman selesai dimuat, supaya service
 *      worker baru diunduh lebih awal, bukan menunggu navigasi berikutnya;
 *   2. `updateViaCache: 'none'` supaya skrip `/sw.js` tidak dibaca dari cache
 *      HTTP browser (cache CDN tetap perlu diatur di sisi server);
 *   3. muat ulang **sekali** saat `controllerchange`, sehingga versi baru
 *      langsung terpakai pada satu kali muat ulang.
 *
 * Kunjungan pertama (belum ada service worker yang mengendalikan) tidak pernah
 * memicu muat ulang: itu pemasangan awal, bukan pembaruan.
 *
 * Semua dependensi disuntikkan lewat opsi supaya perilakunya bisa diuji tanpa
 * DOM, dan supaya modul tidak melakukan apa pun saat diimpor di Node.
 */

export const SW_URL = '/sw.js'
export const SW_SCOPE = '/'

/** Apakah `navigator.serviceWorker` tersedia dan berbentuk objek. */
function supportsServiceWorker(nav) {
  return Boolean(nav && nav.serviceWorker && typeof nav.serviceWorker.addEventListener === 'function')
}

/**
 * Pasang pemantau pembaruan service worker.
 *
 * @param {object} [options]
 * @param {Window} [options.win]   jendela (default `globalThis.window`)
 * @param {Navigator} [options.nav] navigator (default `globalThis.navigator`)
 * @param {() => void} [options.reload] pemuatan ulang (default `win.location.reload()`)
 * @returns {() => void} fungsi pembersih; aman dipanggil walau tidak terpasang
 */
export function watchServiceWorker({
  win = typeof window !== 'undefined' ? window : null,
  nav = typeof navigator !== 'undefined' ? navigator : null,
  reload = null,
} = {}) {
  const noop = () => {}
  if (!win || !supportsServiceWorker(nav)) return noop

  const sw = nav.serviceWorker
  const hadController = Boolean(sw.controller)
  const reloadPage = reload ?? (() => win.location?.reload?.())
  const readyState = win.document?.readyState

  let reloaded = false
  let disposed = false

  const onControllerChange = () => {
    // Pemasangan pertama: jangan memuat ulang, cukup pakai service worker baru.
    if (!hadController || reloaded) return
    reloaded = true
    reloadPage()
  }

  const onLoad = () => {
    if (disposed) return
    let pending
    try {
      // Mendaftar ulang dengan opsi berbeda adalah cara resmi memperbarui opsi
      // registrasi yang sudah ada; `updateViaCache: 'none'` melewati cache HTTP
      // browser untuk skrip service worker.
      pending = sw.register?.(SW_URL, { scope: SW_SCOPE, updateViaCache: 'none' })
    } catch {
      return
    }
    Promise.resolve(pending)
      .then((registration) => registration?.update?.())
      .catch(() => {
        /* offline atau pendaftaran ditolak: bukan alasan menggagalkan aplikasi */
      })
  }

  sw.addEventListener('controllerchange', onControllerChange)

  if (readyState === 'complete') {
    onLoad()
  } else if (typeof win.addEventListener === 'function') {
    win.addEventListener('load', onLoad, { once: true })
  }

  return () => {
    disposed = true
    sw.removeEventListener?.('controllerchange', onControllerChange)
    win.removeEventListener?.('load', onLoad)
  }
}
