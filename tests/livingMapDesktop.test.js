import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { parse, value, values, decls, keyframes } from './helpers/css.js'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')

test('Living Map: satu sumber data, tanpa fetch/endpoint/tulis baru', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.doesNotMatch(jsx, /fetch\(/, 'komponen port tidak boleh fetch sendiri')
  assert.doesNotMatch(jsx, /\/api\//, 'komponen port tidak boleh mendeklarasikan endpoint')
  assert.doesNotMatch(jsx, /method:\s*['"]POST/i, 'komponen port tidak boleh menulis data')
  assert.doesNotMatch(jsx, /setInterval|setTimeout\([^)]*refresh/i, 'tidak ada polling paralel di shell')
  assert.match(jsx, /getAgroClimateData|data\?\.hourly/, 'memakai data hasil komposisi App/service')
})

test('Living Map: satu-satunya UI desktop, mobile tidak tersentuh', () => {
  const app = read('src/App.jsx')
  // F-32 — papan lima bagian diarsipkan; Peta Hidup dirender untuk setiap desktop berdata.
  assert.match(app, /const desktopLayout = data && \(\n\s*<LivingMapDesktop/, 'peta dirender sebagai layout desktop')
  assert.doesNotMatch(app, /<DesktopBoard|pages\/DesktopBoard\.jsx/, 'App tidak boleh lagi merujuk papan')
  assert.match(app, /<MobileTabShell/, 'jalur mobile tetap utuh')
  assert.match(app, /<Suspense fallback=\{<LivingMapBoot \/>\}>/, 'kerangka ruang tetap jadi cadangan')
})

test('Living Map: peta memakai SchematicMap dan layer hanya visibilitas', () => {
  const port = read('src/pages/LivingMapDesktop.jsx')
  const map = read('src/components/SchematicMap.jsx')
  assert.match(port, /<SchematicMap/)
  assert.match(port, /onLayerChange=\{setLayer\}/)
  for (const key of ['boundaries', 'sentra', 'risk', 'hotspots']) {
    assert.match(port, new RegExp(`${key}: true`), `layer ${key} ada`)
    assert.match(map, new RegExp(`layers\\?\\.${key}`), `peta menghormati layer ${key}`)
  }
  assert.match(map, /\$\{layers\[id\] \? 'Sembunyikan' : 'Tampilkan'\}/, 'tombol layer punya label aksi')
  assert.doesNotMatch(map, /lat:|lon:\s*\d/, 'tidak ada geometri/koordinat baru di komponen')
})

test('Living Map: tiga mode panel berurutan 1→2→3→1 dengan lebar yang benar', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.match(jsx, /MODE_NEXT = \{ '1': '2', '2': '3', '3': '1' \}/)
  assert.match(value(cssRules, '.lm-context-mode-3', 'width'), /min\(900px/, 'Mode 3 hingga 900 px')
  // Aturan responsif tidak boleh menimpa mode: Mode 2 harus tetap terlebar.
  assert.equal(value(cssRules, '.lm-context.lm-context-mode-2', 'width'), 'min(1200px, 100vw)', 'Mode 2 tetap terlebar di layar sempit')
  assert.match(value(cssRules, '.lm-context.lm-context-mode-3', 'width'), /^min\(760px/, 'Mode 3 tetap lebih lebar dari Mode 1 di layar sempit')
  assert.match(value(cssRules, '.lm-context-mode-2', 'width'), /min\(1200px/, 'Mode 2 hingga 1200 px')
  assert.match(value(cssRules, '.lm-context', 'width'), /min\(390px/, 'Mode 1 lebih sempit dari Mode 3')
  assert.match(jsx, /role=\{isModal \? 'dialog' : undefined\}/, 'hanya mode terlebar menjadi dialog modal')
  assert.match(jsx, /aria-modal=\{isModal \? 'true' : undefined\}/)
  assert.match(jsx, /event\.key === 'Escape'[\s\S]{0,80}setDrawerMode\('1'\)/, 'Escape menurunkan mode')
})

test('Living Map: label peta dan kontrol peta mengikuti spesifikasi glass/transparan', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.equal(value(cssRules, '.lm-map-credit', 'backdrop-filter'), 'blur(12px)', 'label peta transparan + blur')
  assert.match(value(cssRules, '.lm-map-credit', 'background'), /^color-mix\(/, 'label peta memakai latar transparan')
  const controls = css.match(/html body \.niu-map-card--bare \.niu-map-controls button \{([^}]*)\}/)
  assert.ok(controls, 'aturan idle kontrol peta ada')
  assert.match(controls[1], /background: transparent/)
  assert.match(controls[1], /backdrop-filter: none/)
  const row = css.match(/\n\.niu-map-toolrow \{([^}]*)\}/)
  assert.ok(row, 'baris alat peta ada')
  assert.match(row[1], /background: transparent/, 'baris alat transparan saat idle')
  assert.equal(value(cssRules, '.niu-map-toolrow:hover', 'background'), 'var(--lm-card)', 'baris alat solid saat hover')
  assert.equal(value(cssRules, '.niu-map-toolrow:focus-within', 'background'), 'var(--lm-card)', 'baris alat solid saat fokus')
  assert.ok(cssRules.some((d) => d.value.includes('var(--lm-bottom-height')), 'posisi kontrol mengikuti tinggi panel bawah')
  assert.ok(cssRules.some((d) => d.value.includes('var(--lm-toolrow-height')), 'tinggi baris alat diukur dan dipakai tata letak')
})

test('Living Map: panel bawah ringkas saat idle dan terbuka saat hover/fokus', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.equal(value(cssRules, '.lm-bottom-panel', 'max-height'), '58px', 'idle ringkas')
  for (const keadaan of [':hover', ':focus-within', '.is-open']) {
    assert.match(
      value(cssRules, `.lm-bottom-panel${keadaan}`, 'max-height'),
      /min\(320px, 46vh, calc\(var\(--lm-shell-height/,
      `panel ${keadaan} membuka, dibatasi tinggi shell`,
    )
  }
  assert.ok(
    cssRules.some((d) => d.selector.includes('.lm-bottom-panel:hover') && d.prop === 'backdrop-filter'),
    'panel terbuka memakai blur',
  )
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.match(jsx, /aria-expanded=\{Boolean\(openPanels\.weather/, 'toggle mengumumkan keadaan')
  assert.match(jsx, /aria-pressed=\{pinnedPanels\.weather\}/)
})

test('Living Map: reuse komponen domain, bukan salinan kartu', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  for (const comp of ['DesktopSummaryBar', 'HazardPanel', 'HourStrip', 'CoffeeAdvisory', 'SeasonalBanner', 'ReportButton', 'EmergencyContacts', 'DisasterHistoryCard', 'AirQualityCard', 'ClimateBanner', 'CommandPalette']) {
    assert.match(jsx, new RegExp(`import ${comp} from`), `${comp} dipakai ulang`)
  }
  assert.doesNotMatch(jsx, /dangerouslySetInnerHTML/, 'tidak ada HTML mentah yang disuntikkan')
  assert.match(jsx, /<ReportButton[^>]*open=\{reportOpen\}/, 'alur laporan asli dipertahankan')
})

test('Living Map: panel konteks di-portal hanya pada mode modal', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.match(jsx, /createPortal\(/, 'mode modal dirender lewat portal ke body')
  assert.match(jsx, /isModal && typeof document !== 'undefined'\s*\? createPortal/, 'hanya mode modal yang di-portal')
  assert.match(jsx, /document\.body\s*\n?\s*\)/, 'target portal adalah document.body')
  // Token tema harus juga tersedia untuk panel yang keluar dari .living-map-shell.
  for (const sel of ['.living-map-shell', '.lm-context']) {
    assert.equal(value(cssRules, sel, '--lm-solid'), 'var(--color-tanah-kartu)', `token warna diwarisi panel portal (${sel})`)
  }
  // Tombol perlebar harus punya label teks + ikon, bukan glyph samar.
  assert.match(jsx, /className="lm-mode-button min-h-11"/)
  assert.match(jsx, /lm-mode-button-label/)
  assert.match(jsx, /<modeMeta\.Icon aria-hidden="true"/)
  assert.equal(value(cssRules, '.lm-mode-button', 'min-width'), '44px', 'tombol mode tetap target 44 px')
})

test('Living Map: fokus kembali ke pemicu saat panel ditutup', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.match(jsx, /const closeContext = useCallback/, 'penutupan panel terpusat')
  assert.match(jsx, /restoreRef\.current\?\.focus/, 'fokus kembali ke tombol buka panel')
  assert.match(jsx, /modeButtonRef\.current\?\.focus/, 'Escape mengembalikan fokus ke tombol mode')
})

test('Living Map: footer pratinjau setipis teks dan mengikuti tema', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const app = read('src/App.jsx')
  // F-08 hanya untuk desktop; mobile wajib tetap memakai kelas 2.2.6.
  assert.match(app, /className=\{isDesktop\s*\n?\s*\? 'niu-footer-livingmap'/, 'footer desktop memakai kelas sendiri')
  assert.match(app, /'border-t border-ink\/10 dark:border-mist\/10 py-4 text-center text-caption text-ink-muted dark:text-mist-subtle'/, 'kelas footer mobile dipertahankan')
  assert.equal(value(cssRules, '.niu-footer-livingmap', 'padding'), '4px 12px', 'padding tipis')
  assert.match(value(cssRules, '.niu-footer-livingmap', 'font-size'), /var\(--text-caption/, 'ukuran mengikuti caption')
  assert.ok(decls(cssRules, "html[data-arah='langit'] .niu-footer-livingmap").length > 0, 'warna mengikuti tema Langit')
  // Audit F-08 (23 Okt 2026): target 44 px di dalam baris footer 26 px membuat tombol
  // menjorok 9 px ke luar layar dan halaman selalu bisa digulir. WCAG 2.2 SC 2.5.8
  // mensyaratkan 24 px untuk target sebaris — itulah nilai yang dikunci sekarang.
  assert.equal(value(cssRules, '.niu-footer-livingmap button', 'min-height'), '24px', 'tautan footer memakai target 24 px')
  assert.ok(
    !values(cssRules, '.niu-footer-livingmap button', 'margin-block').some((v) => v.startsWith('-')),
    'trik margin negatif tidak boleh kembali',
  )
})

test('Pratinjau: tahan iframe sandbox (origin opaque) dan tidak pernah blank', () => {
  const cfg = read('vite.config.js')
  const mjs = read('src/main.jsx')
  const install = read('src/pwa/install.js')
  // Arena merender preview di iframe sandbox: aset diblokir CORS bila header tidak ada.
  assert.match(cfg, /server: \{[\s\S]{0,200}cors: true/, 'dev server mengirim CORS')
  assert.match(cfg, /preview: \{[\s\S]{0,300}cors: true/, 'preview server mengirim CORS')
  // localStorage melempar SecurityError pada origin opaque.
  assert.doesNotMatch(install, /typeof localStorage !== 'undefined' \? localStorage/, 'tidak ada probe localStorage yang melempar')
  assert.match(install, /function safeLocalStorage\(\)/, 'akses storage dibungkus try/catch')
  // Kegagalan render harus terlihat, bukan layar kosong.
  assert.match(mjs, /class AppErrorBoundary extends React\.Component/)
  assert.match(mjs, /getDerivedStateFromError/)
  assert.match(mjs, /role="alert"/)
  assert.match(mjs, /className="min-h-11"/, 'tombol pemulihan tetap target 44 px')
})

test('Living Map: tinggi shell mengikuti banner/header, panel bawah tetap terlihat', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.match(jsx, /--lm-shell-height/, 'tinggi dihitung dari posisi aktual')
  assert.match(jsx, /window\.innerHeight - top - footerH/, 'menyisakan ruang footer')
  assert.ok(cssRules.some((d) => d.prop === 'height' && d.value.includes('var(--lm-shell-height')), 'CSS memakai variabel tinggi')
  assert.ok(cssRules.some((d) => d.prop === 'min-height' && d.value === '420px'), 'batas bawah aman untuk layar pendek')
})

test('Living Map: target sentuh dan fokus terlihat', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.match(jsx, /className="min-h-11 min-w-11"/, 'tombol ikon ≥ 44 px')
  assert.match(jsx, /data-mode=\{drawerMode\}/)
  assert.match(jsx, /tabIndex=\{activePanel === panel\.id \? 0 : -1\}/, 'roving tabindex pada tab')
  assert.match(jsx, /aria-selected=\{activePanel === panel\.id\}/)
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  assert.ok(cssRules.some((d) => d.selector.includes(':focus-visible')), 'gaya fokus untuk kontrol peta')
  assert.ok(cssRules.some((d) => d.media.some((m) => m.includes('prefers-reduced-motion'))), 'hormati reduced motion')
})

test('Living Map: skala teks ringkas hanya di permukaan peta (desktop)', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const base = css.match(/\.living-map-shell,\n\.lm-context \{([\s\S]*?)\n\}/)
  assert.ok(base, 'blok token dasar ada')
  // Port React sempat memakai skala global 16/14/12 → label & tab meluber di panel 390 px.
  assert.match(base[1], /--text-body: 0\.875rem/, 'teks isi 14 px di peta')
  assert.match(base[1], /--text-body-sm: 0\.8125rem/, 'teks kecil 13 px')
  assert.match(base[1], /--text-caption: 0\.6875rem/, 'caption 11 px')
  // Token global tidak boleh diubah: mobile & DesktopBoard tetap 16 px.
  const index = read('src/index.css')
  const indexRules = parse(index)
  assert.ok(
    indexRules.some((d) => d.prop === '--text-body' && d.value === '1rem'),
    'skala teks global tetap 1 rem',
  )
  assert.ok(!indexRules.some((d) => d.prop === '--text-body' && d.value === '0.875rem'), 'skala global tidak ikut mengecil')
  // Kontrol formulir tetap 16 px agar tidak memicu zoom.
  assert.equal(value(cssRules, '.living-map-shell input', 'font-size'), '1rem', 'kontrol formulir kembali ke 16 px')
})

test('Living Map: Mode 2 & 3 berlatar pejal, bukan kaca', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const mode3 = css.match(/\.lm-context-mode-3 \{([^}]*)\}/)
  const mode2 = css.match(/\.lm-context-mode-2 \{([^}]*)\}/)
  assert.ok(mode3 && mode2)
  for (const [name, block] of [['Mode 3', mode3[1]], ['Mode 2', mode2[1]]]) {
    assert.match(block, /background: var\(--lm-solid\)/, `${name} memakai permukaan pejal`)
    assert.match(block, /backdrop-filter: none/, `${name} tanpa blur`)
  }
  assert.ok(cssRules.some((d) => d.prop === '--lm-solid' && d.value === 'var(--color-tanah-kartu)'), 'Mode pejal Tanah')
  assert.ok(cssRules.some((d) => d.prop === '--lm-solid' && d.value === 'var(--color-langit-kartu)'), 'Mode pejal Langit')
  // Mode 1 tetap kaca tembus pandang (satu-satunya mode transparan).
  const base = css.match(/\n\.lm-context \{\n\s{2}position: absolute([\s\S]*?)\n\}/)
  assert.ok(base && /background: var\(--lm-glass-panel\)/.test(base[1] || ''), 'Mode 1 tetap kaca')
  assert.match(base[1] || '', /backdrop-filter: blur\(20px\) saturate\(1\.06\)/, 'Mode 1 memakai blur')
  assert.ok(cssRules.some((d) => d.prop === '--lm-glass-panel' && /color-mix\(in srgb, var\(--color-tanah-kartu.*\) 58%/.test(d.value)), 'kaca Tanah 58 %')
  assert.ok(cssRules.some((d) => d.prop === '--lm-glass-panel' && /color-mix\(in srgb, var\(--color-langit-kartu.*\) 70%/.test(d.value)), 'kaca Langit 70 %')
})

test('Living Map: arah Langit memakai latar & garis tema asli, bukan palet sendiri', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const langit = css.match(/html\[data-arah='langit'\] \.lm-context \{([\s\S]*?)\n\}/)
  assert.ok(langit, 'blok Langit ada')
  assert.match(langit[1], /--lm-surface: transparent/, 'gradasi langit body tidak ditutup warna rata')
  assert.match(langit[1], /--lm-line: var\(--niu-line/, 'garis memakai token tema')
  assert.match(langit[1], /--lm-text: var\(--niu-ink/, 'tinta memakai token tema')
  assert.match(langit[1], /--lm-muted: var\(--niu-ink-muted/, 'tinta redup memakai token tema')
  assert.doesNotMatch(langit[1], /--lm-surface: var\(--color-langit-malam/, 'tidak kembali ke latar rata lama')
})

test('Living Map: strip tab membungkus dan panel konteks tidak menimpa dua panel', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const tabs = css.match(/\.lm-context-tabs \{[^}]*\}/)
  assert.ok(tabs)
  assert.match(tabs[0], /flex: none/, 'baris tab tidak menyusut (dulu terpotong 28 px)')
  assert.match(tabs[0], /flex-wrap: wrap/, 'tab membungkus, tidak terpotong di kanan')
  assert.doesNotMatch(tabs[0], /overflow-x: auto/, 'tidak ada tab tersembunyi di luar layar')
  // Panel konteks berhenti di atas baris alat + dua panel, pada semua mode non-dialog.
  assert.equal(value(cssRules, '.lm-context', 'bottom'), 'calc(var(--lm-bottom-height, 58px) + 30px)', 'panel berhenti di atas dua panel bawah')
  // Baris alat dibatasi lebarnya supaya tidak pernah masuk ke kolom panel.
  assert.equal(value(cssRules, '.niu-map-toolrow', 'max-width'), 'calc(100% - 428px)', 'baris alat menyisakan kolom panel')
  assert.match(value(cssRules, '.lm-context-mode-3', 'bottom'), /^calc\(var\(--lm-bottom-height/, 'Mode 3 juga berhenti di atas dua panel')
  // Dua panel lurus memenuhi halaman, tidak mengikuti lebar panel konteks.
  const dock = css.match(/\n\.lm-bottom \{([\s\S]*?)\n\}/)
  assert.ok(dock, 'aturan dok bawah ada')
  assert.match(dock[1], /right: 14px/, 'dok memenuhi halaman')
  assert.doesNotMatch(dock[1], /--lm-right-inset/, 'dok tidak mengikuti panel konteks')
  // Jangan dipusatkan dengan lebar maksimum: di layar 1920 itu menyisakan
  // 230 px kosong di kiri dan kanan bawah, persis keluhan "dua panel di tengah".
  assert.doesNotMatch(dock[1], /max-width:/, 'dok tidak dibatasi lebar maksimum')
  assert.doesNotMatch(dock[1], /margin-inline:\s*auto/, 'dok tidak dipusatkan')
  // Mode 2 tetap dialog layar penuh, jadi dok disembunyikan.
  assert.ok(
    cssRules.some(
      (d) =>
        d.prop === 'display' &&
        d.value === 'none' &&
        d.selector.split(',').map((x) => x.trim()).includes(".living-map-shell[data-mode='2'] .lm-bottom"),
    ),
    'Mode 2 menyembunyikan dok',
  )
  assert.ok(
    !cssRules.some(
      (d) =>
        d.prop === 'display' &&
        d.value === 'none' &&
        d.selector.includes("[data-mode='3']") &&
        d.selector.split(',').map((x) => x.trim()).endsWith('.lm-bottom'),
    ),
    'Mode 3 tidak perlu menyembunyikan dok',
  )
})

test('Living Map: catatan data peta tidak menimpa baris alat', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const note = css.match(/\n\.niu-map-data-note \{([\s\S]*?)\n\}/)
  assert.ok(note, 'aturan catatan data peta ada')
  // Baris alat setinggi 56 px (satu baris) atau 104 px (dua baris di layar sempit);
  // catatan harus naik di atas keduanya, bukan memakai angka tetap.
  assert.match(note[1], /bottom: calc\(var\(--lm-bottom-rest-height[^)]*\) \+ var\(--lm-toolrow-height[^)]*\)/, 'posisi dihitung dari tinggi baris alat')
  assert.doesNotMatch(note[1], /\+ 82px/, 'bukan angka tetap yang menimpa tombol layer')
})

test('Living Map: baris alat peta mengikuti prototipe (kiri bawah, satu baris)', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const row = css.match(/\n\.niu-map-toolrow \{([^}]*)\}/)
  assert.ok(row)
  assert.match(row[1], /position: absolute/)
  assert.match(row[1], /left: 14px/, 'menempel kiri seperti prototipe')
  assert.match(row[1], /bottom: calc\(var\(--lm-bottom-rest-height/, 'tepat di atas dua panel versi ringkas')
  assert.match(row[1], /flex-direction|display: flex/)
  const markup = read('src/components/SchematicMap.jsx')
  assert.match(markup, /niu-map-toolrow/, 'baris alat dirender peta')
  assert.match(markup, /niu-map-zoom/, 'zoom dikelompokkan seperti prototipe')
  assert.match(markup, /niu-map-layer-set/, 'layer dikelompokkan seperti prototipe')
  assert.match(markup, /niu-map-legend-overlay[\s\S]{0,60}role="group"/, 'legenda di baris alat yang sama')
  // Baris alat memakai tinggi istirahat dua panel, bukan tinggi saat panel dibuka,
  // supaya ia tidak melompat menabrak kartu ringkasan.
  const rowCss = css.match(/\n\.niu-map-toolrow \{([^}]*)\}/)
  assert.match(rowCss[1], /--lm-bottom-rest-height/, 'acuan posisi adalah tinggi istirahat')
  assert.doesNotMatch(rowCss[1], /--lm-bottom-height/, 'bukan tinggi saat panel dibuka')
  // Saat panel bawah dibuka, dok menutupi baris alat (z-index dok > baris alat).
  const dock = css.match(/\n\.lm-bottom \{([\s\S]*?)\n\}/)
  assert.match(dock[1], /z-index: 11/)
  assert.match(rowCss[1], /z-index: 9/)
  assert.match(markup, /niu-map-layer-icon/, 'ikon layer bulat seperti prototipe')
})

test('Living Map: blur bertahan di bundel produksi (urutan prefix CSS)', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  // Lightning CSS membuang properti standar bila `-webkit-` ditulis sesudahnya,
  // sehingga seluruh efek kaca hilang di build. Prefixed harus lebih dulu.
  // Urutan deklarasi tidak bisa diurai jadi peta properti, jadi diperiksa apa adanya.
  assert.doesNotMatch(css, /(?<!-webkit-)backdrop-filter:[^;]+;\n\s*-webkit-backdrop-filter/, 'properti standar tidak boleh mendahului -webkit-')
  assert.match(css, /-webkit-backdrop-filter: blur\(12px\);\n\s*backdrop-filter: blur\(12px\);/, 'label peta tetap ber-blur setelah build')
})

test('Living Map: tombol perlebar panel bawah membuka dialog tengah', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  // Tombol ada di kedua panel, dengan label aksi dan aria-haspopup.
  assert.match(jsx, /lm-panel-expand[^>]*aria-haspopup="dialog"[^>]*aria-label="Perlebar panel waktu dan prakiraan"/, 'tombol perlebar prakiraan')
  assert.match(jsx, /lm-panel-expand[^>]*aria-haspopup="dialog"[^>]*aria-label="Perlebar panel kebun dan musim"/, 'tombol perlebar kebun')
  assert.match(jsx, /className="min-h-11 min-w-11 lm-panel-expand"/, 'tombol tetap target 44 px')
  // Dialog di-portal ke body dan berpusat seperti pop-up pencarian.
  assert.match(jsx, /createPortal\(\s*<div\s+className="lm-panel-modal-layer"/, 'dialog di-portal ke body')
  assert.match(jsx, /role="dialog"[\s\S]{0,120}aria-modal="true"/, 'dialog modal')
  assert.equal(value(cssRules, '.lm-panel-modal-layer', 'position'), 'fixed', 'lapisan dialog melayang')
  assert.equal(value(cssRules, '.lm-panel-modal-layer', 'place-items'), 'center', 'lapisan dialog memusatkan isi')
  assert.match(value(cssRules, '.lm-panel-modal', 'width'), /^min\(920px/, 'lebar dialog terbatas')
  // Escape menutup dan fokus kembali ke tombol asal.
  assert.match(jsx, /event\.key === 'Escape'[\s\S]{0,80}setExpandedPanel\(null\)/, 'Escape menutup dialog')
  assert.match(jsx, /expandRef\.current\[expandedPanel\]/, 'fokus kembali ke tombol perlebar')
  // Token tema diulang karena dialog berada di luar .living-map-shell.
  assert.ok(
    cssRules.some((d) => d.selector.includes('.lm-panel-modal-layer') && d.prop === '--lm-solid' && d.value === 'var(--color-tanah-kartu)'),
    'token Tanah di lapisan dialog',
  )
  assert.equal(
    value(cssRules, "html[data-arah='langit'] .lm-panel-modal-layer", '--lm-solid'),
    'var(--color-langit-kartu)',
    'token Langit di lapisan dialog',
  )
})

test('Living Map: tidak ada prakiraan per jam ganda di panel konteks', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  // Strip 12 jam hanya dirender di panel bawah dan di dialog perlebar — bukan di tab Prakiraan.
  const forecastSection = jsx.match(/forecast: \(([\s\S]*?)\n {4}\),/)
  assert.ok(forecastSection, 'seksi prakiraan ada')
  assert.doesNotMatch(forecastSection[1], /<HourStrip/, 'tab Prakiraan tidak mengulang strip jam')
  assert.doesNotMatch(forecastSection[1], /<HourlyForecast/, 'tab Prakiraan tidak mengulang tren per jam')
  assert.match(forecastSection[1], /setExpandedPanel\('weather'\)/, 'tab Prakiraan menautkan ke panel bawah')
  assert.doesNotMatch(jsx, /import HourlyForecast/, 'komponen tren per jam tidak lagi dipakai di shell')
})

test('Living Map: tombol zoom peta benar-benar di tengah', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const button = css.match(/html body \.niu-map-card--bare \.niu-map-controls button \{([^}]*)\}/)
  assert.ok(button)
  assert.match(button[1], /justify-content: center/, 'ikon & label di tengah tombol')
  assert.equal(value(cssRules, 'html body .niu-map-card--bare .niu-map-zoom button', 'padding'), '0', 'tombol zoom tanpa padding samping')
})

test('Living Map: panel konteks Mode 1 & kartu sentra terpilih = kaca yang memadat saat fokus', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const summary = css.match(/\n\.lm-summary \{([\s\S]*?)\n\}/)
  assert.ok(summary, 'blok .lm-summary ada')
  assert.match(summary[1], /background: var\(--lm-glass-panel\)/, 'kartu sentra terpilih transparan saat diam')
  assert.match(summary[1], /backdrop-filter: blur\(20px\) saturate\(1\.06\)/, 'kartu sentra terpilih memakai blur')
  const summaryFocus = css.match(/\.lm-summary:hover,\n\.lm-summary:focus-within \{([\s\S]*?)\n\}/)
  assert.ok(summaryFocus, 'aturan fokus kartu sentra ada')
  assert.match(summaryFocus[1], /background: var\(--lm-glass-strong\)/, 'kartu memadat saat hover/fokus')
  assert.match(summaryFocus[1], /backdrop-filter: blur\(26px\) saturate\(1\.08\)/, 'blur menguat saat hover/fokus')

  const ctxFocus = css.match(/\.lm-context:not\(\.lm-context-mode-2\):not\(\.lm-context-mode-3\):hover,\n[^{]+\{([\s\S]*?)\n\}/)
  assert.ok(ctxFocus, 'aturan fokus panel konteks Mode 1 ada')
  assert.match(ctxFocus[1], /background: var\(--lm-glass-strong\)/, 'panel Mode 1 memadat saat hover/fokus')
  assert.match(ctxFocus[1], /backdrop-filter: blur\(26px\) saturate\(1\.08\)/, 'blur menguat saat hover/fokus')
  // Mode 2 & 3 tidak boleh ikut memadat/menguat.
  for (const mode of ['2', '3']) {
    const block = css.match(new RegExp(`\\n\\.lm-context-mode-${mode} \\{([\\s\\S]*?)\\n\\}`))
    assert.ok(block, `blok Mode ${mode} ada`)
    assert.doesNotMatch(block[1], /--lm-glass-strong|backdrop-filter: blur/, `Mode ${mode} tetap pejal tanpa blur`)
  }
})

test('Living Map: gerak ringan fase 1–2 dan batas permukaannya', () => {
  const map = read('src/components/SchematicMap.jsx')
  const page = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const header = read('src/components/DesktopHeader.jsx')

  // Fase 1 — bentuk & penanda hanya pada varian bare (Living Map), peta lain tidak berubah.
  assert.match(map, /\{bare && selected && \(/, 'sonar hanya di peta bare')
  assert.match(map, /className="niu-pin-sonar"/, 'kelas sonar ada')
  assert.match(map, /\{bare && location\.worst === 'ekstrem' && \(/, 'halo ekstrem hanya di peta bare')
  assert.match(map, /return bare \? \(\s*<g key=\{hotspotKey\} className=\{index < 3/, 'hotspot jadi belah ketupat di peta bare')
  assert.match(map, /rotate\(45 \$\{x\} \$\{y\}\)/, 'belah ketupat tetap diputar 45 derajat')

  // Fase 2 — sapuan hanya saat cap waktu berubah, bukan muat pertama.
  assert.match(map, /if \(lastStampRef\.current && lastStampRef\.current !== retrievedStamp\)/, 'scan menunggu perubahan retrievedAt')
  assert.match(map, /className="niu-map-scan"/, 'lapisan scan dirender')

  // Strip jam: batang tumbuh diulang lewat data-grow, bukan remount.
  assert.match(page, /el\.dataset\.grow = 'off'/, 'data-grow dimatikan lalu dinyalakan')
  assert.match(page, /\[hoursSignature\]/, 'efek bergantung pada tanda tangan data jam')
  assert.match(page, /<div ref=\{barsRef\} className="lm-bars">/, 'strip dibungkus penanda lm-bars')

  // Denyut kesegaran: opt-in lewat prop live, tidak menular ke papan desktop lain.
  assert.match(header, /live = false/, 'prop live opsional')
  assert.match(header, /niu-age--live/, 'kelas live hanya saat diminta')

  // Semua animasi memakai transform/opacity dan punya versi diam.
  for (const name of ['lm-live-ping', 'lm-sonar', 'lm-scan', 'lm-bar-grow']) {
    assert.ok(keyframes(css).includes(name), `keyframes ${name} ada`)
  }
  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduceBlock, /\.niu-pin-sonar \{ animation: none; opacity: 0; \}/, 'sonar diam saat reduce')
  assert.match(reduceBlock, /\.niu-map-card--bare \.niu-map-scan \{ animation: none; opacity: 0; \}/, 'scan diam saat reduce')
  assert.match(reduceBlock, /\.niu-age--live\.is-fresh \.niu-age-dot::after \{ animation: none; opacity: \.55/, 'dot tetap terlihat saat reduce')
})

test('Living Map: glyph cuaca fase 3 hanya di panel desktop', () => {
  const ringkas = read('src/pages/RingkasMobile.jsx')
  const page = read('src/pages/LivingMapDesktop.jsx')
  const wmo = read('src/domain/weather/wmo.js')
  const css = read('src/pages/LivingMapDesktop.css')

  // Default mati: mobile tetap memakai chip "Suhu udara" tanpa glyph.
  assert.match(ringkas, /showCondition = false/, 'glyph opt-in, bukan default')
  assert.match(ringkas, /glyphName \? \(/, 'chip kondisi hanya saat diminta')
  assert.match(ringkas, /WeatherIcon key=\{glyphName\}/, 'glyph memakai set ikon Niu yang ada')
  // F-04 (2.2.6) menyisipkan `worstLevel` sebagai prop terakhir pada elemen yang sama,
  // jadi penanda akhir tag tidak lagi langsung `/>` setelah `showCondition`.
  assert.match(page, /showCondition[^/>]*\/>/, 'Living Map meminta glyph (prop lain boleh menyusul)')
  assert.doesNotMatch(page, /<WeatherIcon/, 'halaman tidak menggambar ikon di luar komponen kartu')

  // Pemetaan WMO: enam kelompok, tanpa glyph ketujuh.
  assert.match(wmo, /value === 0\) return 'cerah'/)
  assert.match(wmo, /value === 45 \|\| value === 48\) return 'kabut'/)
  assert.match(wmo, /value === 95 \|\| value === 96 \|\| value === 99\) return 'petir'/)
  assert.match(wmo, /value >= 51 && value <= 67/, 'hujan sedang-lebat')
  assert.match(wmo, /value >= 80 && value <= 86/, 'hujan lokal')
  assert.doesNotMatch(wmo, /return 'salju'/, 'tidak ada glyph salju')

  // Gerak satu kali jalan, bukan animasi abadi.
  assert.ok(keyframes(css).includes('lm-glyph-in'), 'glyph punya animasi masuk sekali')
  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduceBlock, /\.niu-condition-icon \{ animation: none; opacity: 1; transform: none; \}/, 'glyph diam saat reduce')
})

test('Living Map: gerak internal glyph cuaca hanya di desktop, statis jadi default', () => {
  const icons = read('src/icons/index.jsx')
  const ringkas = read('src/pages/RingkasMobile.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)

  assert.match(icons, /export function WeatherIcon\(\{ name, className = 'h-6 w-6', motion = false \}\)/, 'gerak opt-in, default diam')
  assert.match(icons, /data-weather-motion=\{motion \? 'live' : undefined\}/, 'penanda gerak di svg')
  for (const cls of ['lm-wx-rays', 'lm-wx-drift', 'lm-wx-rain', 'lm-wx-flash', 'lm-wx-fog']) {
    assert.match(icons, new RegExp(`className="${cls}"`), `bagian ${cls} hilang`)
  }
  assert.match(ringkas, /motion=\{showCondition\}/, 'hanya chip desktop yang meminta gerak')
  assert.ok(cssRules.some((d) => d.prop === 'animation' && /lm-wx-spin 24s linear infinite/.test(d.value)), 'matahari 24 dtk')
  assert.ok(cssRules.some((d) => d.prop === 'animation' && /lm-wx-rain 1\.6s/.test(d.value)), 'hujan 1,6 dtk')
  assert.ok(cssRules.some((d) => d.selector.includes("data-weather-motion='live'")), 'gerak dibatasi glyph opt-in')

  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduceBlock, /\.niu-condition-icon\[data-weather-motion='live'\] > \* \{ animation: none !important; \}/, 'gerak internal diam saat reduce')
})

test('Living Map: angka suhu tidak terpotong di layar pendek', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)
  const media = css.slice(css.indexOf('@media (max-height: 780px)'))
  assert.ok(media.length > 0, 'ada aturan tinggi viewport')
  assert.match(media, /\.lm-context \.niu-status-value,[\s\S]*font-size: clamp\(50px, 7\.6dvh, 88px\) !important/, 'angka mengikuti tinggi viewport')
  assert.match(media, /\.lm-context \[data-niu-card='status'\] \{ padding-top: 10px !important; padding-bottom: 10px !important; \}/, 'padding kartu dirapatkan')
  assert.match(media, /\.lm-context \.lm-context-content \{ padding-top: 12px; padding-bottom: 12px; \}/, 'padding isi panel dirapatkan')
  assert.equal(value(cssRules, '.niu-condition-chip', 'display'), 'inline-flex', 'chip kondisi memakai inline-flex')
})

test('Living Map: status kesegaran data dan catatan sentra tanpa data', () => {
  const header = read('src/components/DesktopHeader.jsx')
  const fresh = read('src/lib/dataFreshness.js')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)

  // U2 — chip hanya berubah untuk Living Map; papan desktop lain tetap seperti semula.
  assert.match(header, /const freshness = live && minutes != null \? dataFreshness\(minutes\) : null/, 'tier hanya saat live')
  assert.match(header, /data-freshness=\{freshness\?\.tier\}/, 'atribut tingkat untuk gaya')
  assert.match(header, /freshness\?\.tier === 'fresh' \? ' niu-age--live' : ''/, 'denyut hanya saat data baru')
  assert.match(header, /dataFreshness\(minutes\)/, 'memakai modul kesegaran')
  assert.match(fresh, /value < FRESH_LIMIT_MIN \? 'fresh' : value < STALE_LIMIT_MIN \? 'aging' : 'stale'/, 'tiga tingkat')
  assert.match(fresh, /note: tier === 'stale' \? 'mungkin tertunda' : null/, 'catatan hanya saat basi')
  assert.ok(decls(cssRules, ".niu-header-desktop .niu-age[data-freshness='aging']").length > 0, 'gaya tingkat aging ada')

  // U4 — catatan muncul hanya bila lapisan risiko aktif dan ≥3 sentra tanpa data;
  // ambang, hitungan, dan teksnya dibuktikan lewat render di `tests/domLivingMap.test.js`
  // (termasuk keadaan `levelsPending` yang dulu dipaksa 0 oleh F-06).
  assert.ok(decls(cssRules, '.niu-map-data-note').length > 0, 'gaya catatan peta ada')
})

test('Living Map: chip legenda sekaligus tombol lapisan (U3)', () => {
  // Perilaku legenda (peran grup, aria-pressed, label Sembunyikan/Tampilkan, fallback
  // statis) dibuktikan dengan render sungguhan di `tests/domLivingMap.test.js`.
  // Di sini tinggal bagian yang memang soal lembar gaya.
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)

  // Gaya: chip redup saat lapisan mati.
  assert.equal(value(cssRules, ".niu-map-legend-toggle[aria-pressed='false']", 'opacity'), '0.42', 'keadaan mati diredupkan')
  assert.ok(decls(cssRules, '.niu-map-legend-toggle:hover').length > 0, 'hover terlihat')
  assert.ok(decls(cssRules, '.niu-map-legend-toggle:focus-visible').length > 0, 'fokus terlihat')
})

test('Living Map: gerak hemat (pause tab latar) + ikon & simpul yang hidup', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const map = read('src/components/SchematicMap.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  const cssRules = parse(css)

  // P0 — animasi berhenti saat tab tidak terlihat.
  assert.match(jsx, /root\.classList\.toggle\('is-lm-paused', document\.hidden\)/, 'kelas pause mengikuti document.hidden')
  assert.match(jsx, /addEventListener\('visibilitychange', sync\)/, 'mendengar visibilitychange')
  assert.match(jsx, /removeEventListener\('visibilitychange', sync\)/, 'listener dilepas saat unmount')
  assert.equal(value(cssRules, 'html.is-lm-paused *', 'animation-play-state'), 'paused !important', 'CSS menghentikan animasi')

  // P0 — ikon Lucide di shell mengikuti tebal glyph Niu (1,7), bukan 2.
  assert.doesNotMatch(jsx, /strokeWidth=\{2\}/, 'tidak ada ikon 2 px di shell Living Map')
  assert.match(jsx, /strokeWidth=\{1\.7\}/, 'ikon memakai tebal 1,7')

  // P1 — hotspot berdenyut, dibatasi tiga yang terdekat.
  assert.match(map, /className=\{index < 3 \? 'niu-map-hotspot' : undefined\}/, 'hanya tiga hotspot terdekat beranimasi')
  assert.ok(keyframes(css).includes('lm-hotspot-ping'), 'keyframes hotspot ada')
  assert.match(value(cssRules, '.niu-map-hotspot', 'animation'), /^lm-hotspot-ping 6s/, 'denyut 6 dtk')

  // P1 — cincin radius gunung api berputar pelan, hanya di peta bare.
  assert.match(map, /className=\{bare \? 'niu-volcano-ring' : undefined\}/, 'cincin gunung api dapat kelas')
  assert.ok(keyframes(css).includes('lm-ring-rotate'), 'keyframes rotasi ada')
  assert.match(value(cssRules, '.niu-volcano-ring', 'animation'), /^lm-ring-rotate 40s linear/, 'rotasi 40 dtk linear')

  // Reduced motion: keduanya diam.
  for (const sel of ['.niu-map-hotspot', '.niu-volcano-ring']) {
    assert.ok(values(cssRules, sel, 'animation').includes('none'), `dimatikan saat reduced motion (${sel})`)
  }
})

test('Living Map: roving tabindex pada pin peta (U1)', () => {
  const map = read('src/components/SchematicMap.jsx')
  const nav = read('src/lib/pinNav.js')

  // Satu pin saja yang masuk urutan Tab.
  assert.match(map, /tabIndex=\{onSelectLocation \? \(location\.id === rovingId \? 0 : -1\) : undefined\}/, 'roving tabindex')
  assert.match(map, /const rovingId = pinIds\.includes\(rovingPin\) \? rovingPin : pinIds\.includes\(selectedPinId\) \? selectedPinId : pinIds\[0\]/, 'fallback pin pertama')
  assert.match(map, /useEffect\(\(\) => \{\s*if \(selectedPinId\) setRovingPin\(selectedPinId\)/, 'roving mengikuti pilihan')

  // Panah, Home/End, Enter/Space.
  assert.match(map, /const direction = arrowToDirection\(event\.key\)/, 'panah diterjemahkan')
  assert.match(map, /nextPin\(sentra\.map\(\(item\) => \(\{ id: item\.id, x: item\.x, y: item\.y \}\)\), location\.id, direction\)/, 'pakai nextPin')
  assert.match(map, /event\.key === 'Home' \|\| event\.key === 'End'/, 'Home/End ada')
  assert.match(map, /onSelectLocation\?\.\(location\)/, 'Enter/Spasi tetap memilih')
  assert.match(map, /Satu titik Tab untuk peta/, 'deskripsi peta menjelaskan satu titik Tab')

  // Fungsi navigasi diuji terpisah di tests/pinNav.test.js.
  assert.match(nav, /export function nextPin/, 'nextPin diekspor')
  assert.match(nav, /primary <= EPS/, 'abaikan pin di belakang arah')
})
