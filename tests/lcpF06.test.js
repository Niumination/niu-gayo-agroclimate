/**
 * F-06 (audit 23–24 Okt 2026) — LCP & CLS halaman desktop.
 *
 * Dua akar masalah yang dikunci di sini:
 *  1. LCP: dashboard menunggu `hazards?location=all` (dan `consensus`) sebelum merender apa pun.
 *     Sekarang ketiganya "menyusul" lewat `onLate`, dan gelombang utama hanya memuat data yang
 *     benar-benar dibaca modul risiko.
 *  2. CLS: `main` kosong ~3 px lalu melompat ke tinggi penuh. Sekarang ruang dicadangkan
 *     `LivingMapBoot`, dan skeleton papan tidak lagi dirender sebagai saudara `<main>` di desktop.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const baca = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8')
const tanpaKomentar = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '')

const SERVICE = tanpaKomentar(baca('src/services/weatherService.js'))
const APP = tanpaKomentar(baca('src/App.jsx'))
const MAP = tanpaKomentar(baca('src/components/SchematicMap.jsx'))
const BOOT = baca('src/components/LivingMapBoot.jsx')
const LM = tanpaKomentar(baca('src/pages/LivingMapDesktop.jsx'))

test('F-06: gelombang utama tidak lagi menunggu hazards?location=all', () => {
  assert.doesNotMatch(SERVICE, /await\s+hzAllP/, 'hazardsAll tidak boleh di-await di jalur utama')
  assert.match(SERVICE, /emitLate\('hazardsAll'/, 'payload 15 sentra harus dikirim lewat onLate')
})

test('F-06: consensus & external-reports keluar dari jalur tunggu (bukan input modul risiko)', () => {
  const gelombang = SERVICE.slice(SERVICE.indexOf('Promise.allSettled(['), SERVICE.indexOf('])', SERVICE.indexOf('Promise.allSettled([')))
  assert.doesNotMatch(gelombang, /consensus\?location/, 'consensus hanya untuk kartu, jangan menahan data inti')
  assert.doesNotMatch(gelombang, /external-reports/, 'laporan warga eksternal hanya untuk kartu')
  assert.match(SERVICE, /emitLate\('consensus'/)
  assert.match(SERVICE, /emitLate\('externalReports'/)
  // Modul bahaya memang tidak membacanya — kalau ini berubah, penundaan harus dikaji ulang.
  const convective = baca('src/domain/hazards/convective.js')
  assert.match(convective, /ctx\.bmkgNowcast/, 'bmkgNowcast tetap WAJIB ditunggu karena dipakai convective')
  assert.match(gelombang, /bmkg-nowcast/, 'bmkg-nowcast tetap di gelombang utama')
})

test('F-06: laporan warga (reports) tidak lagi diminta serial setelah gelombang', () => {
  assert.doesNotMatch(SERVICE, /await fetch\(api\(`reports/, 'reports harus ikut gelombang paralel')
  assert.match(SERVICE, /const reportsP = fetch\(api\(`reports/)
})

test('F-06: App menggabungkan payload menyusul tanpa menimpa disaster utuh', () => {
  assert.match(APP, /onLate: \(key, value\) =>/)
  assert.match(APP, /key === 'consensus'\s*\?\s*\{ \.\.\.prev, disaster: \{ \.\.\.\(prev\.disaster \?\? \{\}\), consensus: value \} \}/)
  assert.match(APP, /lateRef\.current\[key\] = value/, 'balapan waktu: payload yang tiba lebih dulu disimpan')
})

test('F-06: ruang desktop dicadangkan sebelum data pertama (anti-CLS)', () => {
  assert.match(APP, /\{desktopLayout \?\? \(error \? null : <LivingMapBoot \/>\)\}/)
  const skeleton = APP.slice(APP.indexOf('showSkeleton &&'), APP.indexOf('showSkeleton &&') + 160)
  assert.match(skeleton, /!isDesktop/, 'skeleton papan tidak boleh menjadi saudara <main> di desktop')
  assert.match(BOOT, /className="living-map-shell lm-boot"/)
  assert.match(BOOT, /aria-hidden="true"/)
  assert.match(BOOT, /inert/, 'kerangka tidak boleh masuk pohon akses/papan ketik')
  // Tanpa angka/label bahaya apa pun di kerangka.
  assert.doesNotMatch(BOOT, /°C|\b(mm|Waspada|Bahaya|Ekstrem|Rendah)\b/)
})

test('F-04/F-06: peta papan desktop memakai level akut yang sama dengan bilahnya', () => {
  const app = tanpaKomentar(APP)
  // Living Map memakai level akut di berkasnya sendiri; papan desktop di tab Sentra di App.
  assert.match(tanpaKomentar(LM), /levelKey="worstAcute"/, 'Living Map memakai level akut')
  const sentra = app.slice(app.indexOf('const dSentra'), app.indexOf('const dArsip'))
  assert.match(sentra, /levelKey="worstAcute"/, 'tanpa ini tab Sentra menulis "Bahaya" saat bilah menulis "Waspada"')
  assert.match(sentra, /levelsPending=\{hazardsAllPending\}/)
})

test('F-06: peta menyatakan "memuat level" saat ringkasan sentra menyusul', () => {
  assert.match(MAP, /levelsPending = false/)
  assert.match(MAP, /levelsPending \? 0 : sentra\.filter/, 'catatan "belum punya data" tidak boleh muncul saat memuat')
  assert.match(MAP, /pendingLevel \? 'memuat level' : LABEL\[location\.worst\]/)
  assert.match(MAP, /Memuat level \{sentra\.length\} sentra/)
  assert.match(LM, /levelsPending=\{hazardsAllPending\}/)
})
