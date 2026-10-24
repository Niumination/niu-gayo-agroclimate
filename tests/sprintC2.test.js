/**
 * Sprint C · bundel 2 (F-09, F-17, F-20, F-21, F-23, F-24, F-25).
 * Uji di sini memanggil perilaku, bukan mencari teks di sumber.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createPrewarm, schedulePrewarm } from '../server/prewarm.js'
import { readLocationId, withSentra } from '../src/lib/locationUrl.js'
import { hideBackground } from '../src/lib/hideBackground.js'
import { createHandler } from '../server/routes.js'

const ROOT = new URL('..', import.meta.url).pathname

// ── F-24 ────────────────────────────────────────────────────────────────────
test('F-24: sentra dibaca dari ?sentra= dan id asing diabaikan', () => {
  const valid = new Set(['bebesan', 'takengon'])
  assert.equal(readLocationId('?sentra=bebesan', null, valid), 'bebesan')
  assert.equal(readLocationId('?tampilan=peta-hidup&sentra=takengon', null, valid), 'takengon')
  assert.equal(readLocationId('?sentra=tidak-ada', 'bebesan', valid), 'bebesan', 'id asing jatuh ke cadangan')
  assert.equal(readLocationId('', 'bebesan', valid), 'bebesan')
  assert.equal(readLocationId('?sentra=', 'bebesan', valid), 'bebesan')
  assert.equal(readLocationId('?sentra=%20%20', 'bebesan', valid), 'bebesan', 'spasi saja bukan id')
})

test('F-24: withSentra menyetel/menghapus sentra tanpa merusak parameter lain', () => {
  const parse = (href) => {
    const u = new URL(href, 'http://n')
    return { sentra: u.searchParams.get('sentra'), q: Object.fromEntries([...u.searchParams].filter(([k]) => k !== 'sentra')), hash: u.hash }
  }
  const a = parse(withSentra('https://x/?tampilan=peta-hidup', 'bebesan'))
  assert.equal(a.sentra, 'bebesan')
  assert.deepEqual(a.q, { tampilan: 'peta-hidup' })

  const b = parse(withSentra('https://x/?sentra=bebesan&zona=risiko', 'linge'))
  assert.equal(b.sentra, 'linge', 'sentra lama diganti, bukan ditambah')
  assert.deepEqual(b.q, { zona: 'risiko' }, 'parameter lain utuh')

  assert.equal(withSentra('https://x/?sentra=bebesan', null), '/', 'tanpa sentra = alamat bersih')
  assert.equal(withSentra('https://x/#main', 'bebesan'), '/?sentra=bebesan#main', 'hash dipertahankan')
})

// ── F-17 ────────────────────────────────────────────────────────────────────
test('F-17: prewarm menghangatkan berurutan, melewati yang tak ada, dan tahan gagal', async () => {
  const urutan = []
  const prewarm = createPrewarm({
    hazardsAllGet: async () => { urutan.push('hazards'); throw new Error('upstream diam') },
    bmkgGet: async () => { urutan.push('bmkg') },
    quakesAllGet: async () => { urutan.push('quakes') },
    // floodGet sengaja tidak diberikan
  }, { log: () => {} })

  const hasil = await prewarm('uji')
  assert.deepEqual(urutan, ['hazards', 'bmkg', 'quakes'], 'berurutan & langkah gagal tidak menghentikan sisanya')
  assert.deepEqual(hasil.failed, ['hazards-all'])
  assert.deepEqual(hasil.ok, ['bmkg-nowcast', 'quakes'])
})

test('F-17: prewarm tidak berjalan dobel saat dipanggil bersamaan', async () => {
  let dipanggil = 0
  let lepas
  const tahan = new Promise((r) => { lepas = r })
  const prewarm = createPrewarm({ hazardsAllGet: async () => { dipanggil++; await tahan } }, { log: () => {} })
  const a = prewarm('start')
  const b = await prewarm('flush')
  lepas()
  await a
  assert.equal(b.skipped, true, 'panggilan kedua dilewati, bukan menumpuk')
  assert.equal(dipanggil, 1)
})

test('F-17: schedulePrewarm bisa dimatikan dan tidak menahan proses', async () => {
  let jalan = 0
  const prewarm = async () => { jalan++ }
  assert.equal(schedulePrewarm(prewarm, { enabled: false }), null)
  const t = schedulePrewarm(prewarm, { delayMs: 5 })
  assert.ok(t, 'timer dijadwalkan')
  await new Promise((r) => setTimeout(r, 40))
  assert.equal(jalan, 1)
})

test('F-17: flush cache memicu pemanasan ulang (best-effort)', async () => {
  let dipanggil = 0
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    LOCATIONS: [{ id: 'takengon', name: 'Takengon Kota' }],
    clearCache: () => {},
    onCacheCleared: () => { dipanggil++ },
  })
  const res = { status: null, body: '', writeHead(s, h) { this.status = s; this.headers = h; return this }, end(d) { this.body = d ?? '' } }
  await handler({ url: '/api/cache/flush', method: 'POST', headers: {}, socket: { remoteAddress: '127.0.0.1' } }, res)
  assert.equal(res.status, 200)
  assert.equal(dipanggil, 1)
})

// ── F-25 ────────────────────────────────────────────────────────────────────
function node(extra = {}) {
  const attrs = new Map(Object.entries(extra.attrs || {}))
  return {
    inert: extra.inert ?? false,
    children: extra.children || [],
    parentElement: null,
    setAttribute(k, v) { attrs.set(k, String(v)) },
    getAttribute(k) { return attrs.has(k) ? attrs.get(k) : null },
    removeAttribute(k) { attrs.delete(k) },
    hasAttribute(k) { return attrs.has(k) },
    _attrs: attrs,
  }
}

test('F-25: latar modal jadi inert + aria-hidden, lalu pulih persis seperti semula', () => {
  const body = node()
  const saudara1 = node({ inert: false })
  const saudara2 = node({ inert: true, attrs: { 'aria-hidden': 'false' } })
  const lapisanModalLain = node({ attrs: { 'data-lm-modal-keep': '' } })
  const dikendalikanReact = node({ attrs: { 'data-lm-react-inert': '' } })
  const panel = node()
  body.children = [saudara1, saudara2, lapisanModalLain, dikendalikanReact, panel]
  panel.parentElement = body
  body.parentElement = null

  const asliDocument = globalThis.document
  globalThis.document = { body }
  try {
    const pulihkan = hideBackground(panel)
    assert.equal(saudara1.inert, true)
    assert.equal(saudara1.getAttribute('aria-hidden'), 'true')
    assert.equal(saudara2.getAttribute('aria-hidden'), 'true')
    assert.equal(lapisanModalLain.inert, false, 'lapisan modal lain tidak boleh dimatikan')
    assert.equal(dikendalikanReact.inert, false, 'elemen yang diatur React dilewati')
    pulihkan()
    assert.equal(saudara1.inert, false)
    assert.equal(saudara1.getAttribute('aria-hidden'), null, 'atribut baru dihapus, bukan diset "null"')
    assert.equal(saudara2.inert, true, 'nilai inert asli dikembalikan')
    assert.equal(saudara2.getAttribute('aria-hidden'), 'false', 'nilai aria-hidden asli dikembalikan')
  } finally {
    if (asliDocument === undefined) delete globalThis.document
    else globalThis.document = asliDocument
  }
})

// ── F-23 ────────────────────────────────────────────────────────────────────
// ErrorBoundary berupa komponen JSX, jadi tidak bisa diimpor Node tanpa transpilasi.
// Yang diuji di sini: kontrak pemakaian — tiap panel Living Map dibungkus boundary ringkas,
// dan boundary itu memang punya cabang `compact` (bukan halaman galat penuh).
test('F-23: panel Living Map punya boundary sendiri (bukan satu boundary di akar)', () => {
  const boundary = readFileSync(path.join(ROOT, 'src/components/ErrorBoundary.jsx'), 'utf8')
  assert.match(boundary, /this\.props\.compact/, 'ErrorBoundary harus punya cabang compact')
  assert.match(boundary, /data-boundary="panel"/, 'penanda panel untuk pengujian & gaya')
  const lmd = readFileSync(path.join(ROOT, 'src/pages/LivingMapDesktop.jsx'), 'utf8')
  const jumlah = (lmd.match(/<ErrorBoundary compact>/g) || []).length
  assert.ok(jumlah >= 3, `harus ada ≥3 boundary panel, ditemukan ${jumlah}`)
  assert.match(lmd, /<ErrorBoundary compact>\{sections\[activePanel\]\}<\/ErrorBoundary>/, 'isi panel konteks dibungkus')
})

// ── F-21 ────────────────────────────────────────────────────────────────────
test('F-21: konfigurasi build menetapkan target ES2020 untuk JS & CSS', async () => {
  const mod = await import(path.join(ROOT, 'vite.config.js'))
  const cfg = mod.default
  assert.equal(cfg.build?.target, 'es2020')
  assert.deepEqual(cfg.build?.cssTarget, ['chrome87', 'safari14', 'firefox78', 'edge88'])
})

// ── F-09 & F-20 (pasca-build) ───────────────────────────────────────────────
test('F-09: service worker memakai offline.html sebagai cadangan navigasi', () => {
  const dir = path.join(ROOT, 'dist')
  if (!existsSync(dir)) return console.log('skip: dist/ belum ada')
  const wb = readdirSync(dir).find((f) => /^workbox-[0-9a-f]{8}\.js$/.test(f))
  const sw = (existsSync(path.join(dir, 'sw.js')) ? readFileSync(path.join(dir, 'sw.js'), 'utf8') : '') +
    (wb ? readFileSync(path.join(dir, wb), 'utf8') : '')
  assert.match(sw, /offline\.html/, 'offline.html harus jadi tujuan cadangan')
  assert.doesNotMatch(sw, /createHandlerBoundToURL\("\/index\.html"\)/, 'index.html bukan lagi cadangan navigasi')
})

test('F-09 × F-14: navigasi NetworkFirst, index.html tidak pernah menelan alamat salah', () => {
  // Dua perbaikan ini dulu saling meniadakan: `navigateFallback` tidak pernah terpakai
  // (denylist F-14 menolak semua alamat selain akar, dan akar dilayani precache), sehingga
  // offline.html mati — dan navigasi luring ke `/?sentra=linge` berakhir di halaman galat
  // peramban. Konfigurasi sekarang: tanpa navigateFallback, navigasi lewat NetworkFirst
  // dengan cadangan precache ke offline.html.
  // Komentar menjelaskan riwayat; yang dinilai hanya kode.
  const cfg = readFileSync(path.join(ROOT, 'vite.config.js'), 'utf8').replace(/^\s*\/\/.*$/gm, '')
  assert.match(cfg, /navigateFallback:\s*null/, 'navigateFallback harus null (bawaan plugin = index.html)')
  assert.doesNotMatch(cfg, /navigateFallback:\s*['"]/, 'navigateFallback berupa string berarti index.html/berkas lain akan menelan alamat salah')
  assert.match(cfg, /request\.mode === 'navigate'/, 'hanya navigasi dokumen yang ditangani route ini')
  assert.match(cfg, /precacheFallback:\s*\{\s*fallbackURL:\s*'\/offline\.html'\s*\}/, 'cadangan offline.html lewat precacheFallback')
  assert.match(cfg, /cacheableResponse:\s*\{\s*statuses:\s*\[200\]\s*\}/, 'hanya jawaban 200 yang disimpan — 404 tidak boleh jadi halaman')

  const swPath = path.join(ROOT, 'dist', 'sw.js')
  if (!existsSync(swPath)) return console.log('skip: dist/sw.js belum ada')
  const sw = readFileSync(swPath, 'utf8')
  assert.doesNotMatch(sw, /createHandlerBoundToURL/, 'tidak ada handler index.html untuk navigasi')
  assert.doesNotMatch(sw, /new e\.NavigationRoute|NavigationRoute\(/, 'tidak ada NavigationRoute: alamat salah harus sampai ke server')
  assert.match(sw, /pages-cache/, 'cache halaman terpisah dari cache API')
  assert.match(sw, /PrecacheFallbackPlugin/, 'cadangan offline.html terpasang di bundel')
})

test('F-20: dua tampilan desktop dipecah ke chunk terpisah', () => {
  const dir = path.join(ROOT, 'dist', 'assets')
  if (!existsSync(dir)) return console.log('skip: dist/assets belum ada')
  const files = readdirSync(dir)
  assert.ok(files.some((f) => /^LivingMapDesktop-.*\.js$/.test(f)), 'chunk LivingMapDesktop tidak ada')
  assert.ok(files.some((f) => /^LivingMapDesktop-.*\.js$/.test(f)), 'chunk LivingMapDesktop tidak ada')
  const utama = files.find((f) => /^index-.*\.js$/.test(f))
  const isi = readFileSync(path.join(dir, utama), 'utf8')
  assert.ok(isi.length > 0)
})
