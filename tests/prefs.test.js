/**
 * 2.3.4 — `src/lib/prefs.js` masuk lingkup kritis (lantai cakupan 80 %).
 *
 * Sebelum ini berkas preferensi hanya 41,86 %: jalur cadangan (kunci lama
 * `niu.arah`/`niu.theme`), mode privat tempat `localStorage` melempar, dan
 * penerapan tema ke `<html>` tidak pernah dieksekusi uji. Uji ini menjalankan
 * semuanya di atas `window` palsu — tanpa jsdom.
 */
import test from 'node:test'
import assert from 'node:assert/strict'

import { applyTheme, effectiveTheme, getHiddenHazards, prefs } from '../src/lib/prefs.js'

function fakeStorage(awal = {}) {
  const map = new Map(Object.entries(awal))
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
  }
}

/** Pasang `window` palsu; kembalikan fungsi pembersih. */
function pasangWindow(t, storage, { sistemTerang = false } = {}) {
  globalThis.window = {
    localStorage: storage,
    matchMedia: () => ({ matches: sistemTerang }),
  }
  t.after(() => {
    delete globalThis.window
  })
}

test('prefs.getTheme: tanpa preferensi → null (ikut sistem)', (t) => {
  pasangWindow(t, fakeStorage())
  assert.equal(prefs.getTheme(), null)
})

test('prefs.getTheme: kunci baru menang, nilai asing diabaikan', (t) => {
  const storage = fakeStorage({ 'nga.theme': 'dark' })
  pasangWindow(t, storage)
  assert.equal(prefs.getTheme(), 'dark')
  storage.setItem('nga.theme', 'light')
  assert.equal(prefs.getTheme(), 'light')
  storage.setItem('nga.theme', 'ungu')
  assert.equal(prefs.getTheme(), null, 'nilai tak dikenal tidak dipakai buta')
})

test('prefs.getTheme: kunci prototipe lama (niu.arah / niu.theme) tetap dibaca', (t) => {
  const storage = fakeStorage()
  pasangWindow(t, storage)
  for (const [kunci, nilai, harapan] of [
    ['niu.arah', 'langit', 'dark'],
    ['niu.arah', 'tanah', 'light'],
    ['niu.theme', 'dark', 'dark'],
    ['niu.theme', 'light', 'light'],
    ['niu.arah', 'melayang', null],
  ]) {
    storage.map.clear()
    storage.setItem(kunci, nilai)
    assert.equal(prefs.getTheme(), harapan, `${kunci}=${nilai}`)
  }
})

test('prefs.setTheme: menyimpan pilihan dan menulis kunci lama agar prototipe ikut berubah', (t) => {
  const storage = fakeStorage()
  pasangWindow(t, storage)
  prefs.setTheme('dark')
  assert.equal(storage.getItem('nga.theme'), 'dark')
  assert.equal(storage.getItem('niu.arah'), 'langit')
  prefs.setTheme('light')
  assert.equal(storage.getItem('nga.theme'), 'light')
  assert.equal(storage.getItem('niu.arah'), 'tanah')
  prefs.setTheme('ungu')
  assert.equal(storage.getItem('nga.theme'), null, 'nilai asing = kembali ke tema sistem, bukan tersimpan')
})

test('prefs.setTheme(null) menghapus ketiga kunci → kembali ke tema sistem', (t) => {
  const storage = fakeStorage({ 'nga.theme': 'dark', 'niu.arah': 'langit', 'niu.theme': 'dark' })
  pasangWindow(t, storage)
  prefs.setTheme(null)
  assert.deepEqual([...storage.map.keys()], [])
})

test('localStorage melempar (mode privat) → baca null, tulis diam, hapus diam', (t) => {
  const galat = () => {
    throw new Error('SecurityError')
  }
  pasangWindow(t, { getItem: galat, setItem: galat, removeItem: galat })
  assert.equal(prefs.getTheme(), null)
  assert.equal(prefs.getLocationId(), null)
  assert.doesNotThrow(() => prefs.setTheme('dark'))
  assert.doesNotThrow(() => prefs.setTheme(null))
  assert.doesNotThrow(() => prefs.setLocationId('linge'))
  assert.doesNotThrow(() => prefs.setHiddenHazards(['gempa']))
  assert.doesNotThrow(() => prefs.setHiddenHazards())
})

test('prefs lokasi: simpan dan baca id sentra', (t) => {
  const storage = fakeStorage()
  pasangWindow(t, storage)
  assert.equal(prefs.getLocationId(), null)
  prefs.setLocationId('takengon')
  assert.equal(prefs.getLocationId(), 'takengon')
})

test('prefs bahaya tersembunyi: daftar koma rapi, kosong bila belum ada', (t) => {
  const storage = fakeStorage()
  pasangWindow(t, storage)
  assert.deepEqual(prefs.getHiddenHazards(), [])
  prefs.setHiddenHazards(['gempa', 'banjir'])
  assert.equal(storage.getItem('nga.hiddenHazards'), 'gempa,banjir')
  assert.deepEqual(prefs.getHiddenHazards(), ['gempa', 'banjir'])
  storage.setItem('nga.hiddenHazards', ' gempa , ,banjir,')
  assert.deepEqual(prefs.getHiddenHazards(), ['gempa', 'banjir'], 'spasi & entri kosong dibuang')
  prefs.setHiddenHazards()
  assert.equal(storage.getItem('nga.hiddenHazards'), '')
})

test('getHiddenHazards aman di luar browser (SSR / uji node)', (t) => {
  const simpan = globalThis.window
  delete globalThis.window
  t.after(() => {
    if (simpan) globalThis.window = simpan
  })
  assert.deepEqual(getHiddenHazards(), [])
})

test('applyTheme: menaruh arah pada <html> — gelap = Langit, terang = Tanah', (t) => {
  const kelas = new Set()
  globalThis.document = {
    documentElement: {
      classList: {
        toggle: (nama, aktif) => (aktif ? kelas.add(nama) : kelas.delete(nama)),
      },
      dataset: {},
      style: {},
    },
  }
  t.after(() => {
    delete globalThis.document
  })
  const akar = globalThis.document.documentElement

  applyTheme('dark')
  assert.equal(akar.dataset.arah, 'langit')
  assert.equal(akar.style.colorScheme, 'dark')
  assert.equal(kelas.has('dark'), true)
  assert.equal(kelas.has('light'), false)

  applyTheme('light')
  assert.equal(akar.dataset.arah, 'tanah')
  assert.equal(akar.style.colorScheme, 'light')
  assert.equal(kelas.has('light'), true)
  assert.equal(kelas.has('dark'), false)

  applyTheme(undefined)
  assert.equal(akar.dataset.arah, 'tanah', 'nilai kosong dianggap terang, bukan gelap')
})

test('effectiveTheme: preferensi tersimpan menang atas sistem, jika kosong ikut sistem', (t) => {
  const storage = fakeStorage({ 'nga.theme': 'dark' })
  pasangWindow(t, storage, { sistemTerang: true })
  assert.equal(effectiveTheme(), 'dark')
  storage.removeItem('nga.theme')
  assert.equal(effectiveTheme(), 'light')
  globalThis.window.matchMedia = () => ({ matches: false })
  assert.equal(effectiveTheme(), 'dark')
})
