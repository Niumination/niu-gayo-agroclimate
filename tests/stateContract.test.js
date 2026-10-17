// Uji kontrak P4 — keadaan memuat / kosong / basi / gagal (berbasis sumber, tanpa browser).
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messages } from '../src/i18n/messages.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const app = read('src/App.jsx')
const css = read('src/index.css')

const KARTU_EMPTY = [
  'AirQualityCard',
  'FireDangerCard',
  'DroughtCard',
  'DisasterWarning',
  'DisasterHistoryCard',
  'CoffeeAdvisory',
  'ClimateBanner',
  'SeasonalBanner',
  'HourlyForecast',
  'HazardPanel',
]

test('P4 · skeleton: kerangka bertata tetap, bukan sekadar teks memuat', () => {
  const t = read('src/components/Skeleton.jsx')
  assert.ok(t.includes('export function SkeletonBlock'))
  assert.ok(t.includes('export function SkeletonCard'))
  assert.ok(t.includes('useDelayedVisible'))
  assert.match(t, /delay = 300/, 'skeleton baru muncul >= 300 ms')
  assert.ok(t.includes('aria-hidden="true"'), 'blok skeleton harus disembunyikan dari pembaca layar')
  assert.ok(css.includes('.skeleton'), 'kelas .skeleton hilang dari index.css')
  assert.ok(css.includes('@keyframes nga-skeleton'))
  assert.match(css, /prefers-reduced-motion[\s\S]{0,200}\.skeleton \{ animation: none/, 'skeleton harus berhenti berdenyut saat reduced-motion')
})

test('P4 · App memakai pengumuman pembaca layar + skeleton saat menunggu', () => {
  assert.ok(app.includes("tr('loadingData')"), 'pengumuman status memuat hilang')
  assert.ok(app.includes('aria-busy="true"'))
  assert.ok(app.includes('<AppSkeleton'))
  assert.ok(app.includes('showSkeleton'))
})

test('P4 · keadaan basi: label + kalimat tindakan (bukan label pasif)', () => {
  assert.ok(app.includes("age?.stale"), 'pita data basi hilang')
  assert.ok(app.includes("tr('staleAction')"), 'tombol muat ulang data basi hilang')
  assert.ok(app.includes("tr('dataAge')"), 'label umur data hilang pada pita basi')
})

test('P4 · offline & kembali daring: pita terpusat + tawaran muat ulang (tidak dipaksa)', () => {
  assert.ok(app.includes("tr('offlineBanner')"), 'pita offline hilang dari App')
  assert.ok(app.includes("tr('offlineCacheNote')"), 'penanda data dari cache hilang')
  assert.ok(app.includes("tr('onlineAgain')"), 'tawaran muat ulang setelah kembali daring hilang')
  assert.ok(app.includes('setBackOnline(true)'), 'transisi offline → daring tidak dilacak')
  assert.ok(app.includes('onDismiss={() => setBackOnline(false)}'), 'pita kembali daring harus bisa ditutup tanpa memuat ulang')
  // pengumuman offline tidak boleh ganda di header
  assert.ok(!read('src/components/AppBar.jsx').includes("tr('offlineBanner')"), 'pita offline masih ada di AppBar (pengumuman ganda)')
  assert.ok(!read('src/components/DesktopHeader.jsx').includes("tr('offlineBanner')"), 'pita offline masih ada di DesktopHeader (pengumuman ganda)')
})

test('P4 · penyimpanan persisten diminta (cache offline tidak cepat dibuang)', () => {
  assert.ok(app.includes('navigator.storage?.persist?.()'), 'navigator.storage.persist() tidak dipanggil')
})

test('P4 · setiap kartu data punya keadaan kosong yang menjelaskan', () => {
  for (const nama of KARTU_EMPTY) {
    const t = read(`src/components/${nama}.jsx`)
    assert.ok(t.includes("import EmptyState from './EmptyState'"), `${nama}: impor EmptyState hilang`)
    assert.match(t, /<EmptyState[\s\S]{0,200}?hint=/, `${nama}: EmptyState tanpa petunjuk (hint)`)
  }
  const e = read('src/components/EmptyState.jsx')
  assert.ok(e.includes('min-h-['), 'EmptyState harus menjaga tinggi minimum (stabilkan tata letak)')
  assert.ok(e.includes('aria-hidden="true"'), 'ikon EmptyState harus dekoratif')
})

test('P4 · aksi kirim: spinner di dalam tombol, cegah kirim ganda, konfirmasi diumumkan', () => {
  const t = read('src/components/ReportButton.jsx')
  assert.ok(t.includes('motion-safe:animate-spin'), 'spinner tombol kirim hilang / tidak menghormati reduced-motion')
  assert.ok(t.includes("disabled={status === 'sending'"), 'tombol kirim harus dinonaktifkan selama mengirim')
  assert.ok(t.includes('role="status"'), 'konfirmasi sukses harus diumumkan lewat role=status')
})

test('P4 · pita keadaan (Notice) satu pesan, satu tindakan, mudah ditutup', () => {
  const t = read('src/components/Notice.jsx')
  assert.ok(t.includes('role="status"'))
  assert.ok(t.includes('min-h-11'), 'tombol tindakan/tutup pita harus >= 44 px')
  assert.ok(t.includes('aria-label={dismissLabel}'), 'tombol tutup butuh nama aksesibel')
  assert.ok(t.includes('min-w-11'), 'target tombol tutup harus cukup lebar')
})

test('P4 · label keadaan tersedia di kedua bahasa', () => {
  const keys = ['emptyHint', 'emptyHistory', 'emptyForecast', 'emptyWarning', 'staleAction', 'onlineAgain', 'offlineCacheNote', 'loadingData', 'dismiss', 'emptyData', 'retry']
  for (const key of keys) {
    assert.ok(messages.id[key], `kunci id hilang: ${key}`)
  }
})
