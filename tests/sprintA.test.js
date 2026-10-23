/**
 * Sprint A audit 23 Okt 2026 — enam perbaikan dengan bukti.
 *
 * F-01 Living Map punya jalan masuk & keluar (bukan hanya ?tampilan=peta-hidup)
 * F-02 isi panel bawah yang ringkas tidak lagi dapat difokus keyboard
 * F-03 POST /api/cache/flush butuh token/host lokal (bukan terbuka)
 * F-07 judul h1 desktop + nama aksesibel memuat teks yang terlihat
 * F-08 tombol teks footer 24 px sehingga baris footer kembali 26 px
 * F-26 bidang ketuk pin peta ≥ 24 px
 *
 * Uji F-03 bersifat perilaku (memanggil handler sungguhan), sisanya kontrak sumber
 * karena komponennya JSX tanpa DOM di Node. Yang diperiksa selalu hal yang bisa
 * berubah tanpa suara: orientasi prop, atribut, dan nilai ambang.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHandler } from '../server/routes.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')

const APP = read('src/App.jsx')
const BOARD = read('src/pages/DesktopBoard.jsx')
const MAP = read('src/pages/LivingMapDesktop.jsx')
const HEADER = read('src/components/DesktopHeader.jsx')
const SCHEMATIC = read('src/components/SchematicMap.jsx')

// ── F-01 ────────────────────────────────────────────────────────────────────────
test('F-01: Living Map punya jalan masuk dari papan dan jalan keluar dari peta', () => {
  // Masuk: tombol di kartu Aksi cepat + item palet, keduanya memanggil prop yang sama.
  assert.match(BOARD, /onOpenLivingMap/, 'papan tidak menerima handler peta hidup')
  assert.match(BOARD, /aria-label="Buka peta hidup"/, 'tombol peta hidup tanpa nama aksesibel')
  assert.match(BOARD, /id: 'aksi-peta-hidup'/, 'palet papan tidak memuat aksi peta hidup')

  // Keluar: tombol teks di pil "Peta skematik" + item palet peta.
  assert.match(MAP, /onOpenBoard/, 'peta tidak menerima handler kembali')
  assert.match(MAP, /lm-view-back/, 'tombol kembali tidak dirender')
  assert.match(MAP, /id: 'action-board'/, 'palet peta tidak memuat aksi kembali')

  // Keduanya disambungkan App ke satu fungsi yang juga memperbarui URL.
  assert.match(APP, /showLivingMap\(true\)/, 'App tidak membuka peta dari papan')
  assert.match(APP, /showLivingMap\(false\)/, 'App tidak menutup peta')
  assert.match(APP, /history\.pushState/, 'perpindahan tampilan tidak tercatat di riwayat peramban')
  assert.match(APP, /addEventListener\('popstate'/, 'tombol Kembali peramban tidak disinkronkan')
  // Parameter lama tetap sah untuk tautan langsung.
  assert.match(APP, /get\('tampilan'\) === 'peta-hidup'/, 'tautan ?tampilan=peta-hidup tidak lagi didukung')
})

// ── F-02 ────────────────────────────────────────────────────────────────────────
test('F-02: panel bawah yang ringkas mengeluarkan isinya dari urutan fokus', () => {
  assert.match(MAP, /const collapsed = \{/, 'status ringkas panel tidak dihitung')
  assert.match(MAP, /weather: !\(openPanels\.weather \|\| pinnedPanels\.weather\)/)
  assert.match(MAP, /season: !\(openPanels\.season \|\| pinnedPanels\.season\)/)
  const contents = MAP.match(/<div className="lm-bottom-content"[^>]*>/g) ?? []
  assert.equal(contents.length, 2, 'jumlah isi panel bawah berubah — periksa ulang')
  for (const tag of contents) {
    assert.match(tag, /inert=\{collapsed\.(weather|season) \|\| undefined\}/, `isi panel tanpa inert: ${tag}`)
    assert.match(tag, /aria-hidden=\{collapsed\.(weather|season) \|\| undefined\}/, `isi panel tanpa aria-hidden: ${tag}`)
  }
})

// ── F-03 (perilaku) ────────────────────────────────────────────────────────────
function fakeRes() {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(data) { this.body = data ?? ''; return this },
  }
}

async function flushRequest({ headers = {}, remoteAddress = '203.0.113.7', method = 'POST' } = {}) {
  const flushed = { n: 0 }
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['bebesan']),
    LOCATIONS: [{ id: 'bebesan' }],
    clearCache: () => { flushed.n++ },
  })
  const res = fakeRes()
  await handler({ url: '/api/cache/flush', method, headers, socket: { remoteAddress } }, res)
  return { res, flushed: flushed.n }
}

test('F-03: flush cache menolak permintaan publik, menerima host lokal', async () => {
  // 1. Klien jauh tanpa token → 403, cache tidak disentuh.
  const jauh = await flushRequest({ remoteAddress: '203.0.113.7' })
  assert.equal(jauh.res.status, 403, 'flush publik harus 403')
  assert.equal(jauh.flushed, 0, 'cache terhapus oleh permintaan yang ditolak')

  // 2. Datang lewat proxy (header Cloudflare) meski socket-nya loopback → tetap 403.
  const viaProxy = await flushRequest({ remoteAddress: '127.0.0.1', headers: { 'cf-connecting-ip': '203.0.113.7' } })
  assert.equal(viaProxy.res.status, 403, 'permintaan ber-proxy tidak boleh lolos lewat jalur loopback')
  assert.equal(viaProxy.flushed, 0)

  // 3. Operasional lokal (cron/skrip) → 200.
  const lokal = await flushRequest({ remoteAddress: '127.0.0.1' })
  assert.equal(lokal.res.status, 200, 'host lokal harus tetap bisa flush')
  assert.equal(lokal.flushed, 1)
  assert.deepEqual(JSON.parse(lokal.res.body), { ok: true })

  // 4. Metode selain POST → 405.
  const get = await flushRequest({ remoteAddress: '127.0.0.1', method: 'GET' })
  assert.equal(get.res.status, 405)

  // 5. Bila ALERTS_CRON_TOKEN diset, token benar wajib — jalur loopback tidak lagi cukup.
  const before = process.env.ALERTS_CRON_TOKEN
  process.env.ALERTS_CRON_TOKEN = 'token-uji-sprint-a'
  try {
    const tanpaToken = await flushRequest({ remoteAddress: '127.0.0.1' })
    assert.equal(tanpaToken.res.status, 403, 'saat token diset, loopback tanpa token harus ditolak')
    const tokenSalah = await flushRequest({ remoteAddress: '127.0.0.1', headers: { 'x-cron-token': 'salah' } })
    assert.equal(tokenSalah.res.status, 403)
    const tokenBenar = await flushRequest({ remoteAddress: '127.0.0.1', headers: { 'x-cron-token': 'token-uji-sprint-a' } })
    assert.equal(tokenBenar.res.status, 200, 'token yang benar harus diterima')
  } finally {
    if (before === undefined) delete process.env.ALERTS_CRON_TOKEN
    else process.env.ALERTS_CRON_TOKEN = before
  }
})

// ── F-07 ────────────────────────────────────────────────────────────────────────
test('F-07: judul h1 desktop ada dan nama aksesibel memuat teks yang terlihat', () => {
  // h1 hanya di cabang desktop — jalur mobile tidak diubah.
  assert.match(APP, /<h1 className="sr-only">/, 'tidak ada h1 di kerangka desktop')
  assert.match(APP, /Peta hidup cuaca dan peringatan dini sentra/, 'judul peta tidak menyebut konteks')

  // Pemilih sentra: aria-label yang tidak memuat seluruh teks tampak diganti teks tersembunyi.
  assert.doesNotMatch(HEADER, /aria-label=\{`Pilih sentra; saat ini/, 'aria-label lama masih ada')
  assert.match(HEADER, /<span className="sr-only">Pilih sentra; saat ini/, 'prefiks nama aksesibel hilang')

  // F-07b (ditemukan saat verifikasi browser): tiga bentuk lain di papan yang juga
  // memakai aria-label pengganti teks tampak — rel 15 sentra, strip jam, dan legenda pintasan.
  const RAIL = read('src/components/LocationRail.jsx')
  const STRIP = read('src/components/niu/HourStrip.jsx')
  assert.doesNotMatch(RAIL, /aria-label=\{`\$\{loc\.name\}/, 'rel sentra masih menimpa teks dengan aria-label')
  assert.match(RAIL, /<span className="sr-only"> — \{LEVEL_LABEL\[level\]/, 'level sentra tidak diucapkan lagi')
  assert.doesNotMatch(STRIP, /aria-label=\{hourText\(hour\)\}/, 'strip jam masih memakai aria-label lama')
  assert.match(STRIP, /sr-only"> — suhu/, 'satuan strip jam tidak diucapkan')
  assert.doesNotMatch(BOARD, /aria-label="Buka palet perintah \(⌘K\)"/, 'tombol pintasan masih menimpa teksnya')

  // Dua tombol legenda peta: aksi ditulis sebagai teks, bukan aria-label pengganti.
  assert.doesNotMatch(SCHEMATIC, /aria-label=\{`\$\{on \? 'Sembunyikan' : 'Tampilkan'\} \$\{label\}`\}/, 'aria-label legenda masih menimpa teks')
  assert.match(SCHEMATIC, /<span className="sr-only"> — \{on \? 'sembunyikan' : 'tampilkan'\} \{label\}<\/span>/)
})

// ── F-08 ────────────────────────────────────────────────────────────────────────
test('F-08: tombol teks footer 24 px, bukan 44 px, agar baris footer setipis teksnya', () => {
  const footer = APP.slice(APP.indexOf('niu-footer-livingmap'))
  const button = footer.slice(footer.indexOf('<button'), footer.indexOf('</button>'))
  assert.match(button, /min-h-6\b/, 'tombol footer belum 24 px')
  assert.match(button, /data-target="inline"/, 'tombol footer tidak ditandai sebagai teks sebaris')
  assert.doesNotMatch(button, /min-h-11/, 'tombol footer masih 44 px')
})

// ── F-26 ────────────────────────────────────────────────────────────────────────
test('F-26: bidang ketuk pin peta minimal 24 px', () => {
  // Ambil tag <circle> utuh yang memuat penanda bidang ketuk (urutan atribut bebas).
  const hit = SCHEMATIC.split('<circle').map((part) => `<circle${part.split('>')[0]}>`).find((tag) => tag.includes('data-map-hit="true"'))
  assert.ok(hit, 'tidak ada bidang ketuk tambahan pada pin')
  const r = Number(hit.match(/r=\{(\d+)\}/)?.[1])
  assert.ok(Number.isFinite(r) && r * 2 >= 24, `diameter bidang ketuk ${r * 2} px < 24 px`)
  assert.match(hit, /fill="transparent"/, 'bidang ketuk harus transparan agar tampilan tidak berubah')
})
