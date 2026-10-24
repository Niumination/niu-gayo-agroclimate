// Uji kontrak P7.3 — komponen inti Niu (tanpa browser; berbasis sumber).
// Setiap uji membaca berkas nyata di src/components/niu/, jadi perubahan yang
// menghilangkan aria/atribut/token akan menggagalkan build — bukan sekadar snapshot.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const DIR = path.join(ROOT, 'src', 'components', 'niu')

const stripComments = (text) =>
  text
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')

const read = (name) => fs.readFileSync(path.join(DIR, name), 'utf8')
const BADGE = read('LevelBadge.jsx')
const HEAD = read('StatusHeadline.jsx')
const CARD = read('AttentionCard.jsx')
const PANEL = read('DetailPanel.jsx')
const INDEX = read('index.js')
const THEME = fs.readFileSync(path.join(ROOT, 'src/styles/theme-directions.css'), 'utf8')

const ALL = { 'LevelBadge.jsx': BADGE, 'StatusHeadline.jsx': HEAD, 'AttentionCard.jsx': CARD, 'DetailPanel.jsx': PANEL }
const CODE = Object.fromEntries(Object.entries(ALL).map(([k, v]) => [k, stripComments(v)]))

test('P7.3: keempat komponen inti ada dan diekspor dari index.js', () => {
  for (const name of Object.keys(ALL)) assert.ok(fs.existsSync(path.join(DIR, name)), `${name} hilang`)
  for (const key of ['LevelBadge', 'StatusHeadline', 'AttentionCard', 'DetailPanel']) {
    assert.match(INDEX, new RegExp(key), `index.js tidak mengekspor ${key}`)
  }
})

test('P7.3: tidak ada warna heks langsung di komponen (semua lewat token)', () => {
  for (const [name, text] of Object.entries(CODE)) {
    assert.doesNotMatch(text, /#[0-9a-fA-F]{3,8}\b/, `${name} memuat warna heks`)
  }
})

test('P7.3: tidak ada pemotongan teks / opasitas teks terlarang', () => {
  for (const [name, text] of Object.entries(CODE)) {
    assert.doesNotMatch(text, /\btruncate\b/, `${name} memakai truncate`)
    assert.doesNotMatch(text, /text-(ink|mist|tanah|langit)[a-z-]*\/\d/, `${name} memakai opasitas teks`)
  }
})

test('P7.3: tidak ada ukuran teks arbitrer di bawah 16 px', () => {
  for (const [name, text] of Object.entries(CODE)) {
    for (const m of text.matchAll(/text-\[(\d+(?:\.\d+)?)px\]/g)) {
      assert.ok(Number(m[1]) >= 16, `${name} memakai ${m[0]}`)
    }
  }
})

test('StatusHeadline: angka utama memakai display font arah, bukan font-data teknis', () => {
  assert.match(HEAD, /niu-status-value/)
  assert.match(HEAD, /tabular-nums/)
  assert.doesNotMatch(HEAD, /font-data/)
  assert.ok(THEME.includes('.niu-status-value') && THEME.includes('font-family: var(--app-font)'))
})

test('StatusHeadline: skala angka utama mengikuti prototipe Tanah 88 px dan Langit 96 px', () => {
  assert.match(THEME, /font-size: 88px !important/)
  assert.match(THEME, /font-size: 96px !important/)
})

test('Metrik Tanah 2×2 di ponsel; Langit satu baris empat kolom di semua lebar', () => {
  const ringkas = fs.readFileSync(path.join(ROOT, 'src/pages/RingkasMobile.jsx'), 'utf8')
  assert.match(ringkas, /niu-metrics.*grid grid-cols-2/)
  assert.match(THEME, /@media \(min-width: 560px\)/)
  assert.match(THEME, /html\[data-arah='tanah'\] \.niu-metrics \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/)
  assert.match(THEME, /html\[data-arah='langit'\] \.niu-metrics \{ grid-template-columns: repeat\(4, minmax\(0, 1fr\)\); \}/)
  assert.match(THEME, /html\[data-arah='langit'\] \.niu-metric:last-child \{ border-right: 0; \}/)
  assert.doesNotMatch(THEME, /html\[data-arah='langit'\] \.niu-metric:nth-child\(-n\+2\).*border-bottom/)
})

test('StatusHeadline: permukaan mengikuti radius & kartu dua tangga', () => {
  assert.match(HEAD, /rounded-tanah-kartu/)
  assert.match(HEAD, /dark:rounded-langit-kartu/)
})

test('StatusHeadline: catatan membungkus, tidak memotong', () => {
  assert.match(HEAD, /break-words/)
})

test('AttentionCard: ringkasan dan meta memakai token tinta tangga', () => {
  assert.match(CARD, /text-tanah-tinta-isi/)
  assert.match(CARD, /dark:text-langit-tinta-isi/)
})

test('DetailPanel: daftar tab memakai pola ARIA tablist', () => {
  assert.match(PANEL, /role="tablist"/)
  assert.match(PANEL, /aria-label="Bagian rincian"/)
})

test('DetailPanel: setiap tab menandai pilihan dengan aria-selected', () => {
  assert.match(PANEL, /role="tab"/)
  assert.match(PANEL, /aria-selected=\{selected\}/)
})

test('DetailPanel: hanya tab aktif yang masuk urutan Tab', () => {
  assert.match(PANEL, /tabIndex=\{selected \? 0 : -1\}/)
})

test('DetailPanel: tab menunjuk panelnya lewat aria-controls', () => {
  assert.match(PANEL, /aria-controls=\{`\$\{id\}-panel-\$\{t\.id\}`\}/)
})

test('DetailPanel: panel memakai role tabpanel + aria-labelledby', () => {
  assert.match(PANEL, /role="tabpanel"/)
  assert.match(PANEL, /aria-labelledby=\{`\$\{id\}-tab-\$\{active\}`\}/)
})

test('DetailPanel: panah kiri/kanan memindahkan tab', () => {
  assert.match(PANEL, /e\.key === 'ArrowRight'/)
  assert.match(PANEL, /e\.key === 'ArrowLeft'/)
})

test('DetailPanel: Home/End menuju tab ujung', () => {
  assert.match(PANEL, /e\.key === 'Home'/)
  assert.match(PANEL, /e\.key === 'End'/)
})

test('DetailPanel: mode melayang memakai dialog + aria-modal', () => {
  assert.match(PANEL, /modal \? 'dialog' : 'region'/)
  assert.match(PANEL, /aria-modal=\{modal \? 'true' : undefined\}/)
})

test('DetailPanel: tombol tutup 44 px dengan label teks', () => {
  assert.match(PANEL, /h-11 w-11/)
  assert.match(PANEL, /aria-label=\{closeLabel\}/)
})

test('DetailPanel: tabel lebar digulir di dalam panel, bukan melebarkan halaman', () => {
  assert.match(PANEL, /detail-scroll/)
  assert.match(PANEL, /overflow-x-auto/)
})

test('DetailPanel: tabId tak dikenal jatuh ke tab pertama', () => {
  assert.match(PANEL, /tabs\.some\(\(t\) => t\.id === tab\)/)
})

test('DetailPanel: bisa dipakai tanpa tab (panel rincian polos)', () => {
  assert.match(PANEL, /tabs\.length === 0/)
})
