// Uji P7.6 — tawaran pasang (install) PWA.
// Dua lapis: (1) fungsi murni di src/pwa/install.js atas objek tiruan;
// (2) kontrak berkas nyata (manifest hasil build, offline.html, komponen).
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DISMISS_KEY, dismissFor, isDismissed, isIos, isIosSafari, isStandalone } from '../src/pwa/install.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const DAY = 24 * 60 * 60 * 1000

function memStorage(initial = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    _map: map,
  }
}

// ---------- isStandalone ----------

test('isStandalone: jendela kosong → false (tanpa melempar)', () => {
  assert.equal(isStandalone(null), false)
  assert.equal(isStandalone({}), false)
})

test('isStandalone: display-mode standalone via matchMedia → true', () => {
  const win = { matchMedia: (q) => ({ matches: q === '(display-mode: standalone)' }) }
  assert.equal(isStandalone(win), true)
})

test('isStandalone: matchMedia menolak query lain → false', () => {
  const win = { matchMedia: () => ({ matches: false }) }
  assert.equal(isStandalone(win), false)
})

test('isStandalone: navigator.standalone iOS → true walau matchMedia absen', () => {
  assert.equal(isStandalone({ navigator: { standalone: true } }), true)
})

test('isStandalone: matchMedia melempar → false, tidak merambat', () => {
  const win = {
    matchMedia: () => {
      throw new Error('boom')
    },
  }
  assert.equal(isStandalone(win), false)
})

// ---------- isIos / isIosSafari ----------

test('isIos: iPhone & iPad klasik terdeteksi', () => {
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X)' }), true)
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }), true)
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 15_7 like Mac OS X)' }), true)
})

test('isIos: iPadOS 13+ menyamar sebagai MacIntel dengan sentuhan', () => {
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 5 }), true)
})

test('isIos: Mac sungguhan (maxTouchPoints 0) → false', () => {
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', platform: 'MacIntel', maxTouchPoints: 0 }), false)
})

test('isIos: Android & Windows → false', () => {
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8)' }), false)
  assert.equal(isIos({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }), false)
})

test('isIosSafari: Safari iOS → true; Chrome/Firefox/Edge/Opera iOS → false', () => {
  const safari = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2 like Mac OS X) AppleWebKit/605.1.15 Version/18.2 Mobile/15E148 Safari/604.1' }
  assert.equal(isIosSafari(safari), true)
  for (const tag of ['CriOS', 'FxiOS', 'EdgiOS', 'OPiOS']) {
    const ua = safari.userAgent.replace('Version/18.2', `${tag}/18.2`)
    assert.equal(isIosSafari({ userAgent: ua }), false, `${tag} seharusnya bukan Safari`)
  }
})

test('isIosSafari: Android Chrome → false (bukan iOS)', () => {
  assert.equal(isIosSafari({ userAgent: 'Mozilla/5.0 (Linux; Android 14) Chrome/130 Safari/537.36' }), false)
})

// ---------- isDismissed / dismissFor ----------

test('isDismissed: tanpa penyimpanan → false', () => {
  assert.equal(isDismissed(Date.now(), null), false)
})

test('isDismissed: kunci kosong / rusak → false', () => {
  assert.equal(isDismissed(1000, memStorage({})), false)
  assert.equal(isDismissed(1000, memStorage({ [DISMISS_KEY]: 'bukan-angka' })), false)
})

test('isDismissed: cap waktu masa depan → true; masa lalu → false', () => {
  const now = 1_700_000_000_000
  assert.equal(isDismissed(now, memStorage({ [DISMISS_KEY]: String(now + 1) })), true)
  assert.equal(isDismissed(now, memStorage({ [DISMISS_KEY]: String(now - 1) })), false)
  assert.equal(isDismissed(now, memStorage({ [DISMISS_KEY]: String(now) })), false, 'tepat di batas dianggap sudah lewat')
})

test('dismissFor: menulis cap waktu now + 7 hari (bawaan)', () => {
  const store = memStorage()
  const now = 1_700_000_000_000
  dismissFor(undefined, now, store)
  assert.equal(store.getItem(DISMISS_KEY), String(now + 7 * DAY))
  assert.equal(isDismissed(now + 6 * DAY, store), true)
  assert.equal(isDismissed(now + 8 * DAY, store), false)
})

test('dismissFor: durasi khusus dihormati (mis. 3650 hari setelah menerima)', () => {
  const store = memStorage()
  dismissFor(3650, 0, store)
  assert.equal(Number(store.getItem(DISMISS_KEY)), 3650 * DAY)
})

test('dismissFor & isDismissed: penyimpanan melempar (mode privat) tidak merambat', () => {
  const boom = {
    getItem: () => {
      throw new Error('SecurityError')
    },
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }
  assert.equal(isDismissed(Date.now(), boom), false)
  assert.doesNotThrow(() => dismissFor(7, Date.now(), boom))
})

// ---------- Kontrak berkas nyata ----------

test('manifest: id, mode standalone, warna tema, ikon lengkap', () => {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'manifest.webmanifest'))) {
    // CI menjalankan test SEBELUM build (urutan ci.yml: test → build).
    // Kontrak manifest diverifikasi di step check:bundle/typography setelah build;
    // skip kontrak berkas build bila dist/ belum ada (mesin bersih / CI).
    console.log('skip: dist/ belum ada (CI pre-build)')
    return
  }
  const raw = read('dist/manifest.webmanifest')
  const m = JSON.parse(raw)
  // Audit F-12 (Sprint C) — id dulu '/niu/' padahal start_url '/', sehingga identitas
  // instalasi PWA tidak pernah cocok dengan scope. Sekarang id wajib sama dengan start_url.
  assert.equal(m.id, m.start_url, 'id manifest harus sama dengan start_url')
  assert.equal(m.id, '/')
  assert.equal(m.name, 'Niu — Cuaca & Peringatan Dini Tanah Gayo')
  assert.equal(m.short_name, 'Niu')
  assert.equal(m.display, 'standalone')
  assert.equal(m.theme_color.toUpperCase(), '#F1E7D8')
  assert.equal(m.background_color.toUpperCase(), '#F1E7D8')
  const icons = m.icons.map((i) => i.sizes)
  for (const size of ['192x192', '512x512']) assert.ok(icons.includes(size), `ikon ${size} hilang`)
  assert.ok(m.icons.some((i) => i.purpose === 'maskable'), 'ikon maskable hilang')
})

test('manifest: tiga pintasan menunjuk rute yang ada di aplikasi', () => {
  if (!fs.existsSync(path.join(ROOT, 'dist', 'manifest.webmanifest'))) {
    console.log('skip: dist/ belum ada (CI pre-build)')
    return
  }
  const m = JSON.parse(read('dist/manifest.webmanifest'))
  const urls = m.shortcuts.map((s) => s.url)
  assert.deepEqual(urls, ['/', '/?zona=risiko', '/?palet=1'])
  for (const s of m.shortcuts) {
    assert.ok(s.name.length > 2 && s.name.length <= 24, `nama pintasan terlalu panjang/pendek: ${s.name}`)
  }
  for (const name of ['pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png']) {
    assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'icons', name)), `${name} tak tersalin ke dist`)
  }
})

test('service worker: memuat offline.html sebagai cadangan navigasi', () => {
  // CI menjalankan test SEBELUM build; tanpa dist/ kontrak offline.html tak bisa diverifikasi
  // di sini — step check:typography (setelah build) memastikan offline.html ada di dist.
  if (!fs.existsSync(path.join(ROOT, 'dist', 'offline.html'))) {
    console.log('skip: dist/offline.html belum ada (CI pre-build)')
    return
  }
  // vite-plugin-pwa generateSW meletakkan daftar precache di file workbox ter-generate;
  // sw.js yang tersalin dari public/ mungkin hanya berisi register. Gabungkan keduanya.
  const sw = [
    fs.existsSync(path.join(ROOT, 'dist', 'sw.js')) ? read('dist/sw.js') : '',
    (() => {
      // Audit F-18 — nama berkas workbox berubah setiap rilis (hash 8 hex). Cari polanya,
      // jangan mengunci satu nama.
      const dir = path.join(ROOT, 'dist')
      if (!fs.existsSync(dir)) return ''
      const wb = fs.readdirSync(dir).find((f) => /^workbox-[0-9a-f]{8}\.js$/.test(f))
      return wb ? read(`dist/${wb}`) : ''
    })(),
    fs.existsSync(path.join(ROOT, 'public', 'sw.js')) ? read('public/sw.js') : '',
  ].join('\n')
  assert.match(sw, /offline\.html/, 'cadangan navigasi offline belum terdaftar')
  assert.ok(fs.existsSync(path.join(ROOT, 'dist', 'offline.html')))
})

test('service worker: navigation preload aktif dan mode auto-update dipertahankan', () => {
  const config = read('vite.config.js')
  assert.ok(config.includes('navigationPreload: true'))
  assert.ok(config.includes("registerType: 'autoUpdate'"))
  assert.ok(config.includes('skipWaiting: true'))
  assert.ok(config.includes('clientsClaim: true'))
})

test('offline.html: dua arah warna, tombol ≥44 px, rujukan resmi', () => {
  const html = read('public/offline.html')
  assert.match(html, /prefers-color-scheme/)
  assert.match(html, /min-height:\s*(4[4-9]|[5-9]\d|\d{3,})px/i, 'tombol mesti ≥44 px')
  assert.match(html, /BMKG/)
  assert.match(html, /BPBD|112/)
  assert.match(html, /lang="id"/)
})

test('InstallHint: ada jalur Android (prompt) & iOS (panduan), tombol tutup berlabel', () => {
  const src = read('src/pwa/InstallHint.jsx')
  assert.match(src, /beforeinstallprompt/)
  assert.match(src, /Tambah ke Layar Utama/)
  assert.match(src, /Pasang aplikasi/)
  assert.match(src, /aria-label="Tutup tawaran pasang"/)
  assert.match(src, /min-h-11/, 'tombol mesti ≥44 px')
})

test('AppBar: tanpa kode model teknis di layar', () => {
  for (const f of ['src/components/AppBar.jsx', 'src/pages/LivingMapDesktop.jsx']) {
    assert.equal(/ecmwf_ifs025/.test(read(f)), false, `${f} masih menampilkan ecmwf_ifs025`)
  }
})
