// Uji kontrak P7.5 — papan kerja desktop (rel + kanvas + inspector).
// Berbasis sumber: memastikan struktur v6, pintasan papan ketik, master–detail,
// dan palet perintah tidak hilang tanpa sengaja.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const strip = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((l) => !l.trim().startsWith('//'))
    .join('\n')

const BOARD = strip(read('src/pages/DesktopBoard.jsx'))
const PAL = strip(read('src/components/niu/CommandPalette.jsx'))
const PANEL = strip(read('src/components/HazardPanel.jsx'))
const APP = strip(read('src/App.jsx'))
const CSS = strip(read('src/index.css'))

test('P7.5: papan kerja ada dan dipakai App untuk desktop', () => {
  assert.match(APP, /<DesktopBoard/)
  assert.ok(APP.indexOf('<DesktopBoard') > 0)
})

test('P7.5: lima zona bernomor dirender sebagai section', () => {
  for (const z of ['ringkas', 'ramalan', 'risiko', 'sentra', 'arsip']) {
    assert.ok(BOARD.includes(`id="zona-${z}"`), `zona ${z} hilang`)
  }
})

test('P7.5: navigasi zona memakai tombol, bukan tautan kosong', () => {
  assert.match(BOARD, /goZone\(z\.id\)/)
  assert.match(BOARD, /scrollIntoView/)
})

test('P7.5: rel 264 px bisa dilipat ke 76 px', () => {
  assert.match(CSS, /--desk-rail: 76px/)
  assert.match(CSS, /--desk-rail: 264px/)
  assert.match(BOARD, /setRail\(rail === 'lipat' \? 'buka' : 'lipat'\)/)
})

test('P7.5: rel terlipat menampilkan inisial sentra, bukan menghilangkan fitur', () => {
  assert.match(BOARD, /initials/)
  assert.match(BOARD, /aria-label=\{loc\.name\}/)
  assert.match(BOARD, /LOCATIONS/)
})

test('P7.5: pilihan rel/kepadatan/fokus/inspector disimpan lokal', () => {
  for (const key of ['niu.desk.rail', 'niu.desk.dens', 'niu.desk.focus', 'niu.desk.insp']) {
    assert.ok(BOARD.includes(key), `${key} tidak disimpan`)
  }
})

test('P7.5: pintasan [ D F dan 1–5 terpasang', () => {
  assert.match(BOARD, /e\.key === '\['/)
  assert.match(BOARD, /e\.key === 'd' \|\| e\.key === 'D'/)
  assert.match(BOARD, /e\.key === 'f' \|\| e\.key === 'F'/)
  assert.match(BOARD, /\^\[1-5\]\$/)
})

test('P7.5: toggle punya aria-pressed, bukan hanya warna', () => {
  assert.match(BOARD, /aria-pressed=\{rail === 'lipat'\}/)
  assert.match(BOARD, /aria-pressed=\{dens === 'padat'\}/)
  assert.match(BOARD, /aria-pressed=\{focus === 'on'\}/)
})

test('P7.5: inspector memakai DetailPanel dengan tiga tab', () => {
  assert.match(BOARD, /<DetailPanel/)
  assert.match(BOARD, /tabs=\{HAZARD_TABS\}/)
  assert.match(BOARD, /panels=\{hazardPanels\(selected\)\}/)
})

test('P7.5: inspector punya tombol tutup & perbesar berlabel', () => {
  assert.match(BOARD, /closeLabel="Tutup panel rincian"/)
  assert.match(BOARD, /aria-label=\{big \? 'Perkecil panel rincian' : 'Perbesar panel rincian'\}/)
})

test('P7.5: inspector menetap ≥1500 px, menjadi laci di bawahnya', () => {
  assert.match(CSS, /@media \(min-width: 1500px\)/)
  assert.match(CSS, /minmax\(0, 1fr\) 380px/)
  assert.match(CSS, /@media \(max-width: 1499px\)/)
  assert.match(CSS, /position: fixed;\s*\n\s*top: 112px;/)
})

test('P7.5: di bawah 1200 px inspector menjadi dialog yang tak memenuhi layar kosong', () => {
  assert.match(CSS, /@media \(max-width: 1199px\)/)
  assert.match(CSS, /max-height: calc\(100vh - 24px\)/)
})

test('P7.5: mode fokus menyembunyikan rel', () => {
  assert.match(CSS, /\.desk\[data-focus='on'\] \.desk-rail \{\s*\n\s*display: none;/)
})

test('P7.5: kepadatan mengurangi jarak antar-zona', () => {
  assert.match(CSS, /\.desk\[data-dens='padat'\] \.desk-flow \{\s*\n\s*gap: 20px;/)
})

test('P7.5: master–detail — baris bahaya memilih inspector, bukan membuka panel inline', () => {
  assert.match(PANEL, /aria-current=\{onSelect && open \? 'true' : undefined\}/)
  assert.match(PANEL, /\{open && !onSelect && \(/)
  assert.match(PANEL, /onSelect \? onSelect\(r\.id\) : onToggle\(\)/)
})

test('P7.5: palet perintah memakai combobox + listbox', () => {
  assert.match(PAL, /role="combobox"/)
  assert.match(PAL, /role="listbox"/)
  assert.match(PAL, /role="option"/)
  assert.match(PAL, /aria-activedescendant=\{activeId\}/)
})

test('P7.5: palet perintah adalah dialog modal dan bisa ditutup Escape', () => {
  assert.match(PAL, /role="dialog"/)
  assert.match(PAL, /aria-modal="true"/)
  assert.match(PAL, /e\.key === 'Escape'/)
})

test('P7.5: panah atas/bawah dan Enter menjalankan item', () => {
  assert.match(PAL, /ArrowDown/)
  assert.match(PAL, /ArrowUp/)
  assert.match(PAL, /e\.key === 'Enter'/)
  assert.match(PAL, /run\(active\)/)
})

test('P7.5: riwayat palet disimpan (maks 5) dan tampil sebagai grup', () => {
  assert.match(PAL, /niu\.komando\.riwayat/)
  assert.match(PAL, /slice\(0, 5\)/)
  assert.match(PAL, /Terakhir dipakai/)
})

test('P7.5: fokus kembali ke pemicu saat palet ditutup', () => {
  assert.match(PAL, /openerRef/)
  assert.match(PAL, /o\.focus\(\)/)
})

test('P7.5: palet memuat zona, bahaya, dan sentra', () => {
  assert.match(BOARD, /group: 'Bagian'/)
  assert.match(BOARD, /group: 'Bahaya'/)
  assert.match(BOARD, /group: 'Sentra'/)
})

test('P7.5: ⌘K / Ctrl+K membuka palet di papan kerja', () => {
  assert.match(BOARD, /e\.metaKey \|\| e\.ctrlKey/)
  assert.match(BOARD, /setPal\(true\)/)
})

test('P7.5: semua kartu lama tetap dirender di lima zona', () => {
  for (const comp of [
    'CoffeeAdvisory',
    'AirQualityCard',
    'SeasonalBanner',
    'ClimateBanner',
    'HourlyForecast',
    'DroughtCard',
    'HazardPanel',
    'DisasterWarning',
    'StormCard',
    'FloodCard',
    'TemperatureCard',
    'QuakeCard',
    'VolcanoCard',
    'FireDangerCard',
    'ExternalReportsCard',
    'SchematicMap',
    'EmergencyContacts',
    'DisasterHistoryCard',
  ]) {
    assert.ok(APP.includes(`<${comp}`), `${comp} hilang dari App`)
  }
})

test('P7.5: tombol lapor & bagikan tetap ada di rel dan di kartu risiko', () => {
  assert.match(BOARD, /<ReportButton/)
  assert.match(BOARD, /<ShareButton/)
  assert.match(PANEL, /<ShareButton/)
})

test('P7.5: header desktop tidak lagi menampilkan nama model teknis', () => {
  const header = read('src/components/DesktopHeader.jsx')
  assert.ok(!header.includes('ecmwf_ifs025'))
})

test('P7.5: tidak ada truncate atau warna heks di papan kerja & palet', () => {
  for (const [name, text] of [
    ['DesktopBoard', BOARD],
    ['CommandPalette', PAL],
  ]) {
    assert.ok(!/\btruncate\b/.test(text), `${name} memakai truncate`)
    assert.ok(!/#[0-9a-fA-F]{6}\b/.test(text), `${name} memakai warna heks`)
  }
})
