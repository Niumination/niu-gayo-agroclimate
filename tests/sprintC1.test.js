/**
 * Sprint C · bundel 1 (2.3.0) — rilis, pesan galat, PWA, 404.
 *
 * Tes di sini sengaja **perilaku**, bukan regex atas sumber (lihat audit F-38): fungsi
 * dipanggil dan hasilnya diperiksa.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, mkdtempSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { createHandler } from '../server/routes.js'
import { escapeMarkdown } from '../server/reports.js'
import { runAlertCycle } from '../server/alerts.js'
import os from 'node:os'
import path from 'node:path'

const ROOT = new URL('..', import.meta.url).pathname

function fakeRes() {
  return {
    status: null, headers: null, body: '',
    writeHead(status, headers) { this.status = status; this.headers = headers; return this },
    end(data) { this.body = data ?? ''; return this },
  }
}

test('F-31: galat 502 tidak membocorkan pesan internal, tetapi memberi kode + rujukan', async () => {
  const handler = createHandler({
    VALID_LOCATIONS: new Set(['takengon']),
    LOCATIONS: [{ id: 'takengon', name: 'Takengon Kota' }],
    HAZARDS_ON: true,
    hazardsGet: async () => { throw new Error('rahasia /srv/app/token=abc123') },
  })
  const res = fakeRes()
  await handler({ url: '/api/hazards?location=takengon', method: 'GET', headers: {} }, res)
  const body = JSON.parse(res.body)
  assert.equal(res.status, 502)
  assert.equal(body.code, 'internal')
  assert.match(body.ref, /^e[0-9a-z]+$/, 'harus ada nomor rujukan untuk dicocokkan ke log')
  assert.doesNotMatch(JSON.stringify(body), /rahasia|token|srv/, 'pesan internal tidak boleh ikut')
})

test('F-37: escapeMarkdown menetralkan markup Telegram tanpa mengubah teks biasa', () => {
  assert.equal(escapeMarkdown('hujan deras di kebun'), 'hujan deras di kebun')
  assert.equal(escapeMarkdown('catatan *penting* _miring_ `kode` [tautan]'), 'catatan \\*penting\\* \\_miring\\_ \\`kode\\` \\[tautan\\]')
  assert.equal(escapeMarkdown(null), '')
  assert.equal(escapeMarkdown(42), '42')
})

test('F-33: dry-run melaporkan draft, bukan "terkirim"', async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'nga-c1-'))
  const all = {
    _full: [{
      id: 'bintang',
      name: 'Bintang',
      hazards: [{ id: 'angin', level: 'bahaya', score: 80, headline: 'Hembusan 70 km/jam', label: { id: 'Angin Kencang' }, actions: [] }],
    }],
  }
  const dry = await runAlertCycle(all, { now: '2026-10-24T09:00:00Z', dryRun: true, dir, send: async () => ({ ok: true }) })
  assert.equal(dry.summary.mode, 'dry-run')
  assert.equal(dry.summary.sent, 0, 'dry-run tidak mengirim apa pun')
  assert.ok(dry.summary.planned >= 1, 'tetap melaporkan berapa pesan yang akan dikirim')
})

test('F-12: id manifest PWA sama dengan start_url (bila dist sudah dibangun)', () => {
  const p = path.join(ROOT, 'dist', 'manifest.webmanifest')
  if (!existsSync(p)) {
    console.log('skip: dist/manifest.webmanifest belum ada (uji pasca-build)')
    return
  }
  const m = JSON.parse(readFileSync(p, 'utf8'))
  assert.equal(m.id, m.start_url, 'id yang berbeda dari start_url membuat instalasi PWA tidak dikenali')
})

test('F-14: 404 bermerek tersedia, berbahasa Indonesia, tanpa aset eksternal', () => {
  const p = path.join(ROOT, 'public', '404.html')
  assert.ok(existsSync(p), 'public/404.html harus ada agar bisa disajikan server statis')
  const html = readFileSync(p, 'utf8')
  assert.match(html, /<html lang="id"/)
  assert.match(html, /Halaman ini tidak ada/)
  assert.match(html, /href="\/\?tampilan=peta-hidup"/, 'beri jalan ke peta hidup')
  assert.doesNotMatch(html, /(src|href)="https?:\/\//, 'tanpa aset eksternal: harus tampil saat offline/salah alamat')
})

test('F-13: sitemap.xml memuat halaman publik dan dirujuk robots.txt', () => {
  const sm = readFileSync(path.join(ROOT, 'public', 'sitemap.xml'), 'utf8')
  assert.match(sm, /<urlset[^>]*sitemaps\.org/, 'harus urlset sah')
  assert.match(sm, /<loc>https:\/\/cuaca\.abstract\.biz\.id\/<\/loc>/)
  const rb = readFileSync(path.join(ROOT, 'public', 'robots.txt'), 'utf8')
  assert.match(rb, /Sitemap: https:\/\/cuaca\.abstract\.biz\.id\/sitemap\.xml/)
})

test('F-22b: check:build-info tidak berhenti mentah di salinan tanpa .git', () => {
  if (!existsSync(path.join(ROOT, 'dist', 'build-info.json'))) {
    console.log('skip: dist/build-info.json belum ada (uji pasca-build)')
    return
  }
  const r = spawnSync(process.execPath, ['scripts/check-build-info.mjs'], { cwd: ROOT, encoding: 'utf8', timeout: 30_000 })
  if (!existsSync(path.join(ROOT, '.git')) && !process.env.NIU_BUILD_REVISION) {
    assert.equal(r.status, 0, 'harus dilewati dengan exit 0, bukan assertion')
    assert.match(r.stdout, /dilewati: bukan repo Git/)
  }
  assert.equal(r.status, 0)
})
