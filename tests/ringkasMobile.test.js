// Uji kontrak P7.4 — beranda mobile "Ringkas".
// Fokus: susunan baru memakai komponen P7.3, tidak menghapus kartu lama,
// tidak memunculkan istilah teknis di lapisan Ringkas, dan bilah 12 jam
// tidak menimbulkan gulir mendatar.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

const PAGE = read('src/pages/RingkasMobile.jsx')
const PAGE_CODE = stripComments(PAGE)
const STRIP = stripComments(read('src/components/niu/HourStrip.jsx'))
const ATTN = stripComments(read('src/components/niu/HazardAttention.jsx'))
const APP = stripComments(read('src/App.jsx'))

test('P7.4: RingkasMobile ada dan memakai ketiga komponen baru', () => {
  assert.match(PAGE, /StatusHeadline/)
  assert.match(PAGE, /HazardAttention/)
  assert.match(PAGE, /HourStrip/)
})

test('P7.4: RingkasMobile mengembalikan null tanpa data (bukan crash)', () => {
  assert.match(PAGE, /if \(!current \|\| !daily\) return null/)
})

test('P7.4: kepala status memakai suhu saat ini + satuan °C', () => {
  assert.match(PAGE, /value=\{n1\(current\.temp\)\}/)
  assert.match(PAGE, /unit="°C"/)
})

test('P7.4: catatan min/maks memakai istilah Indonesia dari messages', () => {
  assert.match(PAGE, /tr\('min'\)/)
  assert.match(PAGE, /tr\('max'\)/)
})

test('P7.4: empat metrik pendukung tetap ada (RH, hujan, peluang, angin)', () => {
  for (const key of ['humidity', 'rainNow', 'rainProb', 'windSpeed']) {
    assert.match(PAGE, new RegExp(`tr\\('${key}'\\)`), `metrik ${key} hilang`)
  }
})

test('P7.4: lencana tingkat memakai label resmi, bukan teks bebas', () => {
  assert.match(PAGE, /LEVEL_LABEL\[worst\]/)
})

test('P7.4: "Perlu perhatian" dibatasi tiga kartu dan bisa menuju Risiko', () => {
  assert.match(PAGE, /limit=\{3\}/)
  assert.match(PAGE, /onOpenRisk/)
})

test('P7.4: Ringkas tidak memuat istilah teknis model', () => {
  const banned = ['ECMWF', 'IFS', 'Open-Meteo', 'CAPE', 'ensemble', 'API', 'm³/s', 'Lifted Index']
  for (const word of banned) {
    assert.ok(!PAGE_CODE.includes(word), `istilah "${word}" muncul di Ringkas`)
  }
})

test('P7.4: App memakai RingkasMobile di tab Kini (mobile)', () => {
  assert.match(APP, /<RingkasMobile/)
  assert.ok(APP.indexOf('<RingkasMobile') < APP.indexOf('const mobileForecast'))
})

test('P7.4: kartu lama tidak dihapus dari tab Kini', () => {
  for (const comp of ['AirQualityCard', 'CoffeeAdvisory', 'SeasonalBanner', 'ClimateBanner', 'ReportButton']) {
    assert.ok(APP.includes(`<${comp}`), `${comp} hilang dari App`)
  }
})

test('P7.4: InstrumentPanel tetap dipakai di desktop', () => {
  assert.match(APP, /<InstrumentPanel/)
})

test('P7.4: HourStrip 12 jam memakai grid, bukan gulir mendatar', () => {
  assert.match(STRIP, /grid-cols-4/)
  assert.match(STRIP, /min-\[380px\]:grid-cols-6/)
  assert.ok(!STRIP.includes('overflow-x-auto'), 'HourStrip masih menggulir mendatar')
})

test('P7.4: HourStrip menandai jam pertama sebagai "Kini"', () => {
  assert.match(STRIP, /now \? 'Kini' : h\.time/)
})

test('P7.4: batang hujan dekoratif, bukan satu-satunya penyampai nilai', () => {
  assert.match(STRIP, /aria-hidden="true"/)
  assert.match(STRIP, /rain > 0 \?/)
})

test('P7.4: HourStrip aman saat data kosong', () => {
  assert.match(STRIP, /hours\.length === 0\) return null/)
})

test('P7.4: daftar perhatian menyaring level waspada ke atas', () => {
  assert.match(ATTN, /LEVEL_ORDER\[r\.level\] >= LEVEL_ORDER\.waspada/)
})

test('P7.4: hanya satu rincian terbuka pada satu waktu (akordeon)', () => {
  assert.match(ATTN, /setOpenId\(open \? null : r\.id\)/)
})

test('P7.4: rincian memakai DetailPanel bare dengan tiga tab', () => {
  assert.match(ATTN, /<DetailPanel/)
  assert.match(ATTN, /bare/)
  assert.match(ATTN, /label: 'Ringkas'/)
  assert.match(ATTN, /label: 'Angka'/)
  assert.match(ATTN, /label: 'Saran'/)
})

test('P7.4: tiap tab berisi hal berbeda (bukan isi sama)', () => {
  assert.match(ATTN, /ringkas: \(/)
  assert.match(ATTN, /angka: \(/)
  assert.match(ATTN, /saran: \(/)
  assert.match(ATTN, /panels=\{\{/)
})

test('P7.4: angka memakai definisi istilah (dl/dt/dd), bukan div tanpa makna', () => {
  assert.match(ATTN, /<dl/)
  assert.match(ATTN, /<dt/)
  assert.match(ATTN, /<dd/)
})

test('P7.4: sumber data disebut di tab Angka', () => {
  assert.match(ATTN, /Sumber: \{r\.sources/)
})

test('P7.4: keadaan tanpa bahaya aktif punya kalimat menenangkan', () => {
  assert.match(ATTN, /emptyText/)
  assert.match(ATTN, /Tidak ada bahaya aktif/)
})

test('P7.4: tombol "Lihat semua" memenuhi target 44 px', () => {
  assert.match(ATTN, /min-h-11/)
})

test('P7.4: tidak ada pemotongan teks di beranda baru', () => {
  for (const [name, text] of [
    ['RingkasMobile', PAGE_CODE],
    ['HourStrip', STRIP],
    ['HazardAttention', ATTN],
  ]) {
    assert.ok(!/\btruncate\b/.test(text), `${name} memakai truncate`)
  }
})
