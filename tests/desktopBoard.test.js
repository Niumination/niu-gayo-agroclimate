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
const INSPECTOR = strip(read('src/components/niu/DesktopHazardInspector.jsx'))
const APP = strip(read('src/App.jsx'))
const CSS = strip(read('src/index.css') + read('src/styles/desktop-layout.css'))

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

test('P7.5: rel 264 px bisa dilipat ke 76 px, dan 72 px di bawah 1100 px', () => {
  assert.match(CSS, /--desk-rail: 76px/)
  assert.match(CSS, /--desk-rail: 72px/)
  assert.match(CSS, /--desk-rail: 264px/)
  assert.match(BOARD, /setRail\(\(value\) => \(value === 'lipat' \? 'buka' : 'lipat'\)\)/)
})

test('P7.5: rel terlipat menampilkan inisial sentra, bukan menghilangkan fitur', () => {
  assert.match(BOARD, /initials/)
  assert.match(BOARD, /aria-label=\{`\$\{loc\.name\}/)
  assert.match(BOARD, /LOCATION_LEVEL_COLOR/)
  assert.match(BOARD, /LOCATIONS/)
})

test('P7.6: aksi rel terlipat memakai tombol ikon 44 px dan tidak meluber ke kanvas', () => {
  assert.match(BOARD, /className=\{rail === 'lipat' \? 'niu-rail-report-button'/)
  assert.match(BOARD, /niu-rail-share-button/)
  assert.match(BOARD, /<Share2 aria-hidden="true"/)
  assert.match(CSS, /\.desk-rail \.niu-rail-report-button/)
  assert.match(CSS, /max-width: 44px/)
  assert.match(CSS, /font-size: 0/)
})

test('P7.5: pilihan rel/kepadatan/fokus/inspector memakai kunci v6 dan memigrasikan pilihan lama', () => {
  for (const key of ['niu.rail', 'niu.dens', 'niu.focus', 'niu.insp']) {
    assert.ok(BOARD.includes(key), `${key} tidak disimpan`)
  }
  for (const key of ['niu.desk.rail', 'niu.desk.dens', 'niu.desk.focus', 'niu.desk.insp']) {
    assert.ok(BOARD.includes(key), `${key} lama tidak dimigrasikan`)
  }
})

test('P7.5: pintasan [ D F dan 1–5 terpasang', () => {
  assert.match(BOARD, /e\.key === '\['/)
  assert.match(BOARD, /e\.key === 'd' \|\| e\.key === 'D'/)
  assert.match(BOARD, /e\.key === 'f' \|\| e\.key === 'F'/)
  assert.match(BOARD, /\^\[1-5\]\$/)
})

test('P7.5: keadaan rel diumumkan, sedangkan kepadatan/fokus tetap dapat diubah lewat palet', () => {
  assert.match(BOARD, /aria-pressed=\{rail === 'lipat'\}/)
  assert.match(BOARD, /Kepadatan: \$\{dens === 'padat'/)
  assert.match(BOARD, /Mode fokus: \$\{focus === 'on'/)
  assert.match(BOARD, /setDens\(\(value\) =>/)
  assert.match(BOARD, /setFocus\(\(value\) =>/)
})

test('P7.5: inspector memakai DetailPanel dengan tiga tab', () => {
  assert.match(BOARD, /<DesktopHazardInspector/)
  assert.match(INSPECTOR, /<DetailPanel/)
  assert.match(INSPECTOR, /tabs=\{HAZARD_TABS\}/)
  assert.match(INSPECTOR, /panels=\{hazardPanels\(selected\)\}/)
})

test('P7.5: inspector punya tombol tutup & perbesar berlabel', () => {
  assert.match(INSPECTOR, /closeLabel="Tutup panel rincian"/)
  assert.match(INSPECTOR, /aria-label=\{big \? 'Perkecil panel rincian' : 'Perbesar panel rincian'\}/)
})

test('P7.6: inspector besar adalah dialog modal, mengunci fokus, dan pulih ke pemicu', () => {
  assert.ok(INSPECTOR.includes("role={big ? 'dialog' : undefined}"))
  assert.ok(INSPECTOR.includes("aria-modal={big ? 'true' : undefined}"))
  assert.ok(INSPECTOR.includes('sibling.inert = true'))
  assert.ok(INSPECTOR.includes("event.key === 'Escape'"))
  assert.ok(INSPECTOR.includes("event.key !== 'Tab'"))
  assert.ok(INSPECTOR.includes('desk-insp-scrim'))
  assert.ok(INSPECTOR.includes('previousFocus.focus()'))
})

test('P7.6: inspector menetap mulai 1440 px, melayang 1100–1439 px, lalu inline ≤1099 px', () => {
  assert.match(CSS, /@media \(min-width: 1440px\)/)
  assert.match(CSS, /minmax\(0, 1fr\) var\(--desk-insp-width\)/)
  assert.match(CSS, /@media \(max-width: 1439px\)/)
  assert.match(CSS, /position: fixed;\s*\n\s*top: var\(--desk-overlay-top\);/)
  assert.match(CSS, /@media \(max-width: 1099px\)/)
  assert.match(CSS, /grid-column: 1 \/ -1/)
})

test('P7.6: pada ≤1099 px rincian terpasang tepat di bawah bahaya terpilih', () => {
  assert.ok(APP.includes('onInspectorOpenChange={setInspectorOpen}'))
  assert.ok(APP.includes('setInspectorOpen(true)'))
  assert.ok(APP.includes('inlineDetail={inlineHazardInspector}'))
  assert.ok(PANEL.includes('{open && onSelect && inlineDetail}'))
  assert.ok(INSPECTOR.includes('niu-inline-inspector'))
  assert.ok(CSS.includes('.niu-inline-inspector { display: block'))
  assert.ok(CSS.includes(".desk[data-insp='buka'] > .desk-insp { display: none; }"))
})

test('P7.6: kartu risiko satu kolom ≤1099 px, 2 kolom sampai 1599 px, dan 4 mulai 1600 px', () => {
  assert.ok(CSS.includes('.niu-risk-focus-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));'))
  assert.ok(CSS.includes('@media (min-width: 1600px)'))
  assert.ok(CSS.includes('@media (max-width: 1099px)'))
  assert.ok(CSS.includes('.niu-risk-focus-grid { grid-template-columns: minmax(0, 1fr); }'))
  assert.ok(CSS.includes('.niu-risk-focus-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }'))
})

test('P7.6: mode fokus menang atas inspector, menyembunyikan chrome dan membatasi kanvas 1120 px', () => {
  assert.match(CSS, /\.desk\[data-focus='on'\] \.desk-rail/)
  assert.match(CSS, /\.desk\[data-focus='on'\] \.desk-insp/)
  assert.match(CSS, /max-width: 1120px !important/)
})


test('V6 desktop: satu bar navigasi sticky tanpa toolbar pencarian yang menambah baris', () => {
  assert.doesNotMatch(BOARD, /className="desk-bar"/)
  assert.match(BOARD, /className="desk-zones"/)
  assert.match(BOARD, /desk-shortcuts-trigger/)
  assert.match(BOARD, /onClick=\{\(\) => setPal\(true\)\}/)
  assert.ok(CSS.includes('.desk-zones {\n  grid-column: 1 / -1;\n  position: sticky;'))
  assert.ok(CSS.includes('top: var(--desk-header-height);'))
  assert.match(CSS, /--desk-header-height: 62px/)
  assert.match(CSS, /--desk-zones-height: 56px/)
  assert.ok(CSS.includes('.desk-zones {\n  grid-column: 1 / -1;\n  position: sticky;'))
  assert.match(CSS, /\.desk-zone-link \{[\s\S]*?min-height: 44px/)
  assert.match(CSS, /\.desk-zone-pill \{[\s\S]*?min-height: 38px/)
  assert.match(CSS, /margin-block: -4px -2px;/)
  assert.match(CSS, /margin-top: 0;/)
  assert.ok(CSS.includes('.desk-rail {\n  position: sticky;'))
})

test('V6 desktop: app bar 62 px dan selektor sentra proporsional, perubahan header dibatasi desktop', () => {
  assert.match(CSS, /@media \(min-width: 761px\)[\s\S]*?\.niu-header-desktop \{ height: 62px; min-height: 62px; \}/)
  assert.match(CSS, /@media \(min-width: 1280px\)[\s\S]*?\.niu-header-desktop \.niu-header-inner \{ padding-inline: 18px; \}/)
  assert.match(CSS, /\.niu-desktop-location \{ min-width: 280px; max-width: 340px; flex: 0 0 340px; \}/)
  assert.match(CSS, /\.niu-header-desktop \.niu-location-trigger \{ padding-block: 4px; \}/)
})

test('V6 desktop: rel terlipat di bawah 1600 px dan terbuka otomatis mulai 1600 px', () => {
  assert.match(BOARD, /width < 1600 \? 'lipat' : 'buka'/)
  assert.match(BOARD, /window\.innerWidth < 1600/)
  assert.match(BOARD, /className="desk-rail-toggle[^"]*"/)
  assert.match(BOARD, /aria-label=\{rail === 'lipat' \? 'Buka rel sentra' : 'Lipat rel sentra'\}/)
})

test('V6 desktop: lebar shell 1720 px dan inspector 352/412 px mengikuti breakpoint', () => {
  assert.match(CSS, /max-width: 1720px/)
  assert.match(CSS, /--desk-insp-width: 412px/)
  assert.match(CSS, /--desk-overlay-top: calc\(/)
  assert.match(CSS, /--desk-insp-width: 352px/)
  assert.match(CSS, /@media \(min-width: 1440px\) and \(max-width: 1699px\)/)
})

test('V6 desktop: semua kontrol papan tetap tersedia tanpa baris toolbar tambahan', () => {
  assert.match(BOARD, /className="desk-rail-toggle[^"]*"/)
  assert.match(BOARD, /id: 'aksi-kepadatan'/)
  assert.match(BOARD, /id: 'aksi-fokus'/)
  assert.match(BOARD, /id: 'aksi-rincian'/)
  assert.doesNotMatch(BOARD, /fixed bottom-6 right-6/)
})

test('P7.5: kepadatan mengurangi jarak antar-zona', () => {
  assert.match(CSS, /\.desk\[data-dens='padat'\] \.desk-flow \{\s*\n\s*gap: 20px;/)
})

test('P7.5: master–detail desktop memilih bahaya; rincian tetap tersedia di saringan mobile', () => {
  assert.match(PANEL, /aria-current=\{onSelect && open \? 'true' : undefined\}/)
  assert.match(PANEL, /\{open && !onSelect && \(/)
  assert.match(PANEL, /\{open && onSelect && inlineDetail\}/)
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

test('P7.6: palet memuat aksi v6 + Buka peta hidup + kontrol inspector tanpa menghilangkan aksi yang ada', () => {
  // Audit F-01 (23 Okt 2026): aksi ke-10 `aksi-peta-hidup` ditambahkan sebagai jalan masuk
  // Living Map; jumlah lama (9) sengaja dinaikkan bersama uji baru agar tidak jadi angka bebas.
  assert.equal((BOARD.match(/id: 'aksi-/g) ?? []).length, 10)
  assert.match(BOARD, /id: 'aksi-rincian'/)
  assert.match(BOARD, /id: 'aksi-peta-hidup'/)
  for (const action of ['onOpenReport', 'onOpenShare', 'onRefresh', 'onToggleTheme', 'setDens', 'setFocus', 'setInsp', 'onAbout', 'onOpenLocationPicker', 'onOpenLivingMap']) {
    assert.ok(BOARD.includes(action), `${action} tidak terhubung ke palet`)
  }
  assert.match(PAL, /fuzzyScore/)
  assert.match(PAL, /e\.key === 'Tab'/)
})

test('P7.5: ⌘K / Ctrl+K membuka palet di papan kerja', () => {
  assert.match(BOARD, /e\.metaKey \|\| e\.ctrlKey/)
  assert.match(BOARD, /setPal\(true\)/)
})

test('P7.6: Escape pada palet tidak menutup inspector yang berada di belakangnya', () => {
  assert.ok(BOARD.includes('if (e.defaultPrevented || pal) return'))
  assert.ok(PAL.includes("if (e.key === 'Escape')"))
  assert.ok(PAL.includes('onClose?.()'))
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
