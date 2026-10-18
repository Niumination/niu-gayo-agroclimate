// Uji P7.7 — bahasa manusia.
// Menjaga janji Round L: lapisan pertama memakai kalimat manus, sedangkan
// istilah teknis tidak dihapus — hanya dipindah ke lapisan Detail
// (kunci berakhiran Sub/Note + panel "Tentang data & batasan").
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messages } from '../src/i18n/messages.js'
import { dataAge } from '../src/lib/dataAge.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const M = messages.id
const entries = Object.entries(M)

// Kata yang dilarang di seluruh teks produk (P7/03-BAHASA.md §3).
const BANNED = [
  'tersebut',
  'dalam rangka',
  'berkomitmen',
  'sinergi',
  'transformasi digital',
  'ekosistem',
  'memanfaatkan',
  'dilakukan',
  'diperlukan',
  'diharapkan dapat',
  'perlu dicatat',
  'tidak hanya',
  'sebagai bentuk',
  'optimal',
  'signifikan',
  'robust',
  'leverage',
]

// Kunci yang memang boleh memuat istilah teknis (lapisan Detail).
const isDetailKey = (k) => /(Sub|Note)$/.test(k)

// Judul kartu yang tampil paling depan — wajib ≤ 42 karakter.
const TITLE_KEYS = ['airQuality', 'fireDanger', 'drought', 'rustRisk', 'disasterWarning', 'coffeeAdvisory', 'outlook24h']
// Teks tombol/aksi — wajib ≤ 90 karakter.
const ACTION_KEYS = ['refresh', 'retry', 'staleAction', 'share', 'copy', 'dismiss', 'showAll', 'showHidden', 'hideNoData', 'skipToContent', 'aboutData']

test('pesan: jumlah kunci stabil (tidak ada yang hilang saat penulisan ulang)', () => {
  assert.ok(entries.length >= 80, `hanya ${entries.length} kunci`)
  for (const [k, v] of entries) assert.equal(typeof v, 'string', `${k} bukan string`)
})

test('pesan: tanpa kata birokratis di seluruh teks', () => {
  for (const [k, v] of entries) {
    for (const w of BANNED) {
      assert.equal(v.toLowerCase().includes(w), false, `"${w}" muncul di kunci ${k}: ${v}`)
    }
  }
})

test('pesan: lapisan pertama tanpa akronim; akronim hanya di kunci Detail', () => {
  for (const [k, v] of entries) {
    const acronyms = v.match(/\b[A-Z]{2,}\b/g) || []
    if (isDetailKey(k)) continue
    assert.deepEqual(acronyms, [], `akronim di kunci ${k}: ${acronyms.join(', ')}`)
  }
})

test('pesan: tanpa emoji, tanpa tanda seru ganda, tanpa HURUF KAPITAL PENUH', () => {
  for (const [k, v] of entries) {
    assert.equal(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(v), false, `emoji di ${k}`)
    assert.equal(v.includes('!!'), false, `tanda seru ganda di ${k}`)
    const caps = v.match(/\b[A-Z]{4,}\b/g) || []
    assert.deepEqual(caps, [], `kata kapital penuh di ${k}: ${caps.join(', ')}`)
  }
})

test('panjang: judul ≤ 42, aksi ≤ 90, semua teks ≤ 240 karakter', () => {
  for (const [k, v] of entries) assert.ok(v.length <= 240, `${k} ${v.length} karakter`)
  for (const k of TITLE_KEYS) assert.ok(M[k].length <= 42, `judul ${k} ${M[k].length} karakter`)
  for (const k of ACTION_KEYS) assert.ok(M[k].length <= 90, `aksi ${k} ${M[k].length} karakter`)
})

test('informasi teknis tidak dihapus, hanya turun ke Detail', () => {
  // Subjudul tetap ramah; ketelitian/istilah teknis tersedia setelah pengguna membuka rincian.
  assert.doesNotMatch(M.airQualitySub, /40 km/)
  assert.doesNotMatch(M.fireDangerSub, /titik panas/)
  assert.doesNotMatch(M.droughtSub, /90 hari/)
  assert.match(read('src/components/AirQualityCard.jsx'), /cakupan model sekitar 40 km/)
  assert.match(read('src/components/FireDangerCard.jsx'), /titik panas/)
  assert.match(read('src/components/DroughtCard.jsx'), /hingga 90 hari/)
  // Panel "Tentang data & batasan" memegang istilah lengkap + sumber.
  const about = read('src/components/AboutData.jsx')
  for (const term of ['ISPU', 'CAMS', 'FWI', 'ERA5', 'HTH', 'Open-Meteo', 'BMKG', 'BPBD']) {
    assert.ok(about.includes(term), `istilah ${term} hilang dari panel Detail`)
  }
  // Detail per bahaya masih punya tab Angka (nilai mentah) dan Saran (tindakan).
  const detail = read('src/components/niu/HazardDetail.jsx')
  assert.match(detail, /Angka/)
  assert.match(detail, /Saran/)
})

test('umur data berbunyi seperti kalimat, bukan kode', () => {
  assert.equal(dataAge(10_000).label, 'baru saja')
  assert.equal(dataAge(7 * 60_000).label, '7 menit lalu')
  assert.equal(dataAge(3 * 3600_000 + 20 * 60_000).label, '3 jam lalu')
  assert.equal(dataAge(2 * 86400_000).label, '2 hari lalu')
  assert.equal(dataAge(null).label, '-')
  assert.equal(dataAge(31 * 60_000).stale, true)
  assert.equal(dataAge(5 * 60_000).stale, false)
})

test('judul bagian lama sudah memakai pertanyaan manusia', () => {
  const dw = read('src/components/DisasterWarning.jsx')
  assert.match(dw, /Ada longsor di lereng kopi\?/)
  assert.equal(/Sistem Peringatan Dini Bencana Hidrometeorologi/.test(dw), false)
  const bar = read('src/components/AppBar.jsx')
  assert.match(bar, /Niu · Tanah Gayo/)
  assert.equal(/[☀🌙]/u.test(bar), false, 'emoji tema masih dipakai')
  const head = read('src/components/DesktopHeader.jsx')
  assert.match(head, /Niu · Tanah Gayo/)
  assert.equal(/[☀🌙]/u.test(head), false, 'emoji tema masih dipakai di header desktop')
  assert.match(head, /from 'lucide-react'/)
})

test('angka teknis di kartu lama berada di balik "Angka & istilah teknis"', () => {
  for (const f of ['FireDangerCard', 'DroughtCard', 'AirQualityCard']) {
    const src = read(`src/components/${f}.jsx`)
    assert.match(src, /<details/, `${f} belum punya lapisan Detail`)
    assert.match(src, /Angka &amp; istilah teknis/, `${f} belum memberi label Detail`)
    assert.match(src, /<summary/, `${f} summary hilang`)
  }
})

// Akronim yang dilarang di lapisan Ringkas (P7/03-BAHASA.md §3).
// Nama lembaga (BMKG, PVMBG, MAGMA, USGS) dan kata bahasa Indonesia (DAS, SIAGA) dikecualikan —
// bukan akronim teknis, melainkan nama proper yang wajib disebut.
const BANNED_ACRONYMS = [
  'HTH', 'ISPU', 'VPD', 'CAPE', 'FWI', 'MMI', 'ERA5', 'GloFAS', 'ECMWF',
  'PM2,5', 'PM10', 'SPI', 'AOD', 'FFMC', 'GFS', 'IFS', 'FDRS', 'ARI', 'ET0',
  'CAMS', 'FIRMS', 'NASA', 'WMO', 'NOAA',
]

test('headline modul bahaya: lapis 1 tanpa akronim teknis', () => {
  const files = [
    'airQuality.js', 'convective.js', 'drought.js', 'fireWeather.js',
    'quake.js', 'temperature.js', 'volcano.js', 'wind.js', 'landslide.js', 'rust.js',
  ]
  for (const f of files) {
    const lines = read(`src/domain/hazards/${f}`).split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (!/headline\s*[:=]/.test(lines[i])) continue
      // Kumpulkan baris headline sampai ketemu `detail:` atau akhir assignment
      const blockLines = [lines[i]]
      for (let j = i + 1; j < Math.min(i + 6, lines.length); j++) {
        if (/detail\s*[:=]/.test(lines[j])) break
        blockLines.push(lines[j])
        if (/[,}]\s*$/.test(lines[j])) break
      }
      const staticParts = blockLines.join(' ').replace(/\$\{[^}]*\}/g, ' ')
      for (const acr of BANNED_ACRONYMS) {
        const re = new RegExp(`\\b${acr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        assert.equal(re.test(staticParts), false, `${f}:${i + 1}: akronim "${acr}" muncul di headline lapis 1`)
      }
    }
  }
})

test('HazardFocusCards: subtitle & footer tanpa akronim teknis', () => {
  const src = read('src/components/HazardFocusCards.jsx')
  // Ekstrak string literal subtitle="..." dan footer="..." (single/double/backtick)
  const patterns = ['subtitle', 'footer'].flatMap((key) =>
    [...src.matchAll(new RegExp(`${key}=\\s*"([^"]{4,})"`, 'g'))].map((m) => m[1])
  )
  assert.ok(patterns.length >= 8, `hanya ${patterns.length} subtitle/footer ditemukan`)
  for (const val of patterns) {
    for (const acr of BANNED_ACRONYMS) {
      const re = new RegExp(`\\b${acr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
      assert.equal(re.test(val), false, `subtitle/footer mengandung "${acr}": "${val.slice(0, 80)}"`)
    }
  }
})
