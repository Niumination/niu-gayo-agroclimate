// Uji P8 — pembaruan service worker: satu muat ulang, bukan dua.
//
// Fungsi diuji atas objek tiruan (tanpa DOM), lalu kontrak berkas nyata:
// `main.jsx` wajib memasangnya dan modul wajib memakai `updateViaCache: 'none'`.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { SW_SCOPE, SW_URL, watchServiceWorker } from '../src/pwa/swUpdate.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const tick = () => new Promise((resolve) => setImmediate(resolve))

function makeEnv({ controller = null, readyState = 'loading', register } = {}) {
  const swListeners = new Map()
  const winListeners = new Map()
  const calls = { register: [], update: 0, reload: 0 }
  const registration = {
    update: () => {
      calls.update += 1
      return Promise.resolve()
    },
  }
  const nav = {
    serviceWorker: {
      controller,
      addEventListener: (type, fn) => {
        if (!swListeners.has(type)) swListeners.set(type, new Set())
        swListeners.get(type).add(fn)
      },
      removeEventListener: (type, fn) => swListeners.get(type)?.delete(fn),
      register:
        register ??
        ((url, options) => {
          calls.register.push({ url, options })
          return Promise.resolve(registration)
        }),
    },
  }
  const win = {
    document: { readyState },
    location: { reload: () => { calls.reload += 1 } },
    addEventListener: (type, fn) => {
      if (!winListeners.has(type)) winListeners.set(type, new Set())
      winListeners.get(type).add(fn)
    },
    removeEventListener: (type, fn) => winListeners.get(type)?.delete(fn),
  }
  const fireSW = (type) => {
    for (const fn of swListeners.get(type) ?? []) fn({ type })
  }
  const fireWin = (type) => {
    for (const fn of [...(winListeners.get(type) ?? [])]) fn({ type })
  }
  const counts = () => ({
    sw: [...swListeners.values()].reduce((n, set) => n + set.size, 0),
    win: [...winListeners.values()].reduce((n, set) => n + set.size, 0),
  })
  return { win, nav, calls, fireSW, fireWin, counts }
}

test('tanpa dukungan service worker → noop, tidak melempar', () => {
  assert.equal(typeof watchServiceWorker({ win: null, nav: null }), 'function')
  const cleanup = watchServiceWorker({ win: {}, nav: {} })
  assert.equal(typeof cleanup, 'function')
  assert.doesNotThrow(() => cleanup())
})

test('kunjungan pertama: controllerchange tidak memicu muat ulang', () => {
  const env = makeEnv({ controller: null })
  watchServiceWorker({ win: env.win, nav: env.nav })
  env.fireSW('controllerchange')
  env.fireSW('controllerchange')
  assert.equal(env.calls.reload, 0, 'pemasangan awal bukan pembaruan')
})

test('sudah dikendalikan: controllerchange memuat ulang tepat sekali', () => {
  const env = makeEnv({ controller: { scriptURL: '/sw.js' } })
  watchServiceWorker({ win: env.win, nav: env.nav })
  env.fireSW('controllerchange')
  assert.equal(env.calls.reload, 1)
  env.fireSW('controllerchange')
  assert.equal(env.calls.reload, 1, 'peristiwa berulang tidak membuat loop')
})

test('halaman dimuat → daftar ulang /sw.js dengan updateViaCache none, lalu update()', async () => {
  const env = makeEnv()
  watchServiceWorker({ win: env.win, nav: env.nav })
  env.fireWin('load')
  await tick()
  assert.equal(env.calls.register.length, 1)
  assert.equal(env.calls.register[0].url, SW_URL)
  assert.equal(env.calls.register[0].options.scope, SW_SCOPE)
  assert.equal(env.calls.register[0].options.updateViaCache, 'none', 'skrip SW tidak boleh dibaca dari cache HTTP')
  assert.equal(env.calls.update, 1)
})

test('dokumen sudah selesai dimuat → langsung siapkan pembaruan', async () => {
  const env = makeEnv({ readyState: 'complete' })
  watchServiceWorker({ win: env.win, nav: env.nav })
  await tick()
  assert.equal(env.calls.register.length, 1)
  assert.equal(env.calls.update, 1)
})

test('pendaftaran ditolak/melempar tidak merambat ke aplikasi', async () => {
  const throwing = makeEnv({
    register: () => {
      throw new Error('SW ditolak')
    },
  })
  assert.doesNotThrow(() => watchServiceWorker({ win: throwing.win, nav: throwing.nav }))
  throwing.fireWin('load')
  await tick()

  const rejecting = makeEnv({ register: () => Promise.reject(new Error('offline')) })
  watchServiceWorker({ win: rejecting.win, nav: rejecting.nav })
  rejecting.fireWin('load')
  await tick()
  assert.equal(rejecting.calls.reload, 0)
})

test('pembersih melepas listener dan menghentikan pemuatan ulang', async () => {
  const env = makeEnv({ controller: { scriptURL: '/sw.js' } })
  const cleanup = watchServiceWorker({ win: env.win, nav: env.nav })
  assert.deepEqual(env.counts(), { sw: 1, win: 1 })
  cleanup()
  assert.deepEqual(env.counts(), { sw: 0, win: 0 })
  env.fireSW('controllerchange')
  env.fireWin('load')
  await tick()
  assert.equal(env.calls.reload, 0)
  assert.equal(env.calls.register.length, 0, 'setelah dibersihkan tidak ada pendaftaran baru')
})

test('kontrak: main.jsx memasang pemantau, modul memakai opsi yang aman', () => {
  const main = read('src/main.jsx')
  const mod = read('src/pwa/swUpdate.js')
  assert.match(main, /import \{ watchServiceWorker \} from '\.\/pwa\/swUpdate\.js'/)
  assert.match(main, /watchServiceWorker\(\)/, 'pemantau harus benar-benar dipanggil')
  assert.match(mod, /controllerchange/, 'menunggu service worker baru mengambil alih')
  assert.match(mod, /updateViaCache: 'none'/, 'melewati cache HTTP browser')
  assert.match(mod, /hadController/, 'kunjungan pertama tidak boleh memuat ulang')
})
