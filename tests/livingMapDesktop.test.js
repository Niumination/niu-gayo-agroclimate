import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

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

test('Living Map: tetap di balik cabang desktop dan tidak mengganti default', () => {
  const app = read('src/App.jsx')
  assert.match(app, /'tampilan'\) === 'peta-hidup'/, 'pratinjau memakai flag eksplisit')
  assert.match(app, /new URLSearchParams\(window\.location\.search\)/)
  assert.match(app, /<DesktopBoard/, 'DesktopBoard tetap ada')
  assert.match(app, /<MobileTabShell/, 'jalur mobile tetap utuh')
  assert.match(app, /const desktopLayout = data && \(livingMapPreview \?/, 'pemilihan hanya di cabang desktop berdata')
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
  assert.match(jsx, /MODE_NEXT = \{ '1': '2', '2': '3', '3': '1' \}/)
  assert.match(css, /\.lm-context-mode-3 \{[^}]*min\(900px/, 'Mode 3 hingga 900 px')
  // Aturan responsif tidak boleh menimpa mode: Mode 2 harus tetap terlebar.
  assert.match(css, /\.lm-context\.lm-context-mode-2 \{ width: min\(1200px, 100vw\)/, 'Mode 2 tetap terlebar di layar sempit')
  assert.match(css, /\.lm-context\.lm-context-mode-3 \{ width: min\(760px/, 'Mode 3 tetap lebih lebar dari Mode 1 di layar sempit')
  assert.match(css, /\.lm-context-mode-2 \{[^}]*min\(1200px/, 'Mode 2 hingga 1200 px')
  assert.match(css, /\.lm-context \{[^}]*min\(390px/, 'Mode 1 lebih sempit dari Mode 3')
  assert.match(jsx, /role=\{isModal \? 'dialog' : undefined\}/, 'hanya mode terlebar menjadi dialog modal')
  assert.match(jsx, /aria-modal=\{isModal \? 'true' : undefined\}/)
  assert.match(jsx, /event\.key === 'Escape'[\s\S]{0,80}setDrawerMode\('1'\)/, 'Escape menurunkan mode')
})

test('Living Map: label peta dan kontrol peta mengikuti spesifikasi glass/transparan', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  assert.match(css, /\.lm-map-credit \{[^}]*backdrop-filter: blur\(12px\)/, 'label peta transparan + blur')
  assert.match(css, /\.lm-map-credit \{[^}]*background: color-mix\(/, 'label peta memakai latar transparan')
  const controls = css.match(/html body \.niu-map-card--bare \.niu-map-controls button \{([^}]*)\}/)
  assert.ok(controls, 'aturan idle kontrol peta ada')
  assert.match(controls[1], /background: transparent/)
  assert.match(controls[1], /backdrop-filter: none/)
  const row = css.match(/\n\.niu-map-toolrow \{([^}]*)\}/)
  assert.ok(row, 'baris alat peta ada')
  assert.match(row[1], /background: transparent/, 'baris alat transparan saat idle')
  assert.match(css, /\.niu-map-toolrow:hover,[\s\S]{0,80}background: var\(--lm-card\)/, 'baris alat solid saat hover/fokus')
  assert.match(css, /--lm-bottom-height/, 'posisi kontrol mengikuti tinggi panel bawah')
  assert.match(css, /--lm-toolrow-height/, 'tinggi baris alat diukur dan dipakai tata letak')
})

test('Living Map: panel bawah ringkas saat idle dan terbuka saat hover/fokus', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  assert.match(css, /\.lm-bottom-panel \{[^}]*max-height: 58px/, 'idle ringkas')
  assert.match(css, /\.lm-bottom-panel:hover,[\s\S]{0,200}\.lm-bottom-panel:focus-within,[\s\S]{0,160}max-height: min\(320px, 46vh, calc\(var\(--lm-shell-height/, 'hover/fokus membuka, dibatasi tinggi shell')
  assert.match(css, /backdrop-filter: blur\(16px\)/, 'panel terbuka memakai blur')
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
  assert.match(jsx, /createPortal\(/, 'mode modal dirender lewat portal ke body')
  assert.match(jsx, /isModal && typeof document !== 'undefined'\s*\? createPortal/, 'hanya mode modal yang di-portal')
  assert.match(jsx, /document\.body\s*\n?\s*\)/, 'target portal adalah document.body')
  // Token tema harus juga tersedia untuk panel yang keluar dari .living-map-shell.
  assert.match(css, /\.living-map-shell,\n\.lm-context \{/, 'token warna diwarisi panel portal')
  // Tombol perlebar harus punya label teks + ikon, bukan glyph samar.
  assert.match(jsx, /className="lm-mode-button min-h-11"/)
  assert.match(jsx, /lm-mode-button-label/)
  assert.match(jsx, /<modeMeta\.Icon aria-hidden="true"/)
  assert.match(css, /\.lm-mode-button \{[^}]*min-width: 44px/, 'tombol mode tetap target 44 px')
})

test('Living Map: fokus kembali ke pemicu saat panel ditutup', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.match(jsx, /const closeContext = useCallback/, 'penutupan panel terpusat')
  assert.match(jsx, /restoreRef\.current\?\.focus/, 'fokus kembali ke tombol buka panel')
  assert.match(jsx, /modeButtonRef\.current\?\.focus/, 'Escape mengembalikan fokus ke tombol mode')
})

test('Living Map: footer pratinjau setipis teks dan mengikuti tema', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const app = read('src/App.jsx')
  assert.match(app, /niu-footer-livingmap/, 'footer pratinjau memakai kelas sendiri')
  assert.match(app, /livingMapPreview\s*\n?\s*\? 'niu-footer-livingmap'/, 'kelas hanya pada mode Living Map')
  assert.match(css, /\.niu-footer-livingmap \{[^}]*padding: 4px 12px/, 'padding tipis')
  assert.match(css, /\.niu-footer-livingmap \{[^}]*font-size: var\(--text-caption/, 'ukuran mengikuti caption')
  assert.match(css, /html\[data-arah='langit'\] \.niu-footer-livingmap/, 'warna mengikuti tema Langit')
  assert.match(css, /\.niu-footer-livingmap button \{[^}]*min-height: 44px/, 'tautan footer tetap target 44 px')
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
  assert.match(jsx, /--lm-shell-height/, 'tinggi dihitung dari posisi aktual')
  assert.match(jsx, /window\.innerHeight - top - footerH/, 'menyisakan ruang footer')
  assert.match(css, /height: var\(--lm-shell-height/, 'CSS memakai variabel tinggi')
  assert.match(css, /min-height: 420px/, 'batas bawah aman untuk layar pendek')
})

test('Living Map: target sentuh dan fokus terlihat', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  assert.match(jsx, /className="min-h-11 min-w-11"/, 'tombol ikon ≥ 44 px')
  assert.match(jsx, /data-mode=\{drawerMode\}/)
  assert.match(jsx, /tabIndex=\{activePanel === panel\.id \? 0 : -1\}/, 'roving tabindex pada tab')
  assert.match(jsx, /aria-selected=\{activePanel === panel\.id\}/)
  const css = read('src/pages/LivingMapDesktop.css')
  assert.match(css, /focus-visible/, 'gaya fokus untuk kontrol peta')
  assert.match(css, /prefers-reduced-motion/, 'hormati reduced motion')
})

test('Living Map: skala teks ringkas hanya di permukaan peta (desktop)', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const base = css.match(/\.living-map-shell,\n\.lm-context \{([\s\S]*?)\n\}/)
  assert.ok(base, 'blok token dasar ada')
  // Port React sempat memakai skala global 16/14/12 → label & tab meluber di panel 390 px.
  assert.match(base[1], /--text-body: 0\.875rem/, 'teks isi 14 px di peta')
  assert.match(base[1], /--text-body-sm: 0\.8125rem/, 'teks kecil 13 px')
  assert.match(base[1], /--text-caption: 0\.6875rem/, 'caption 11 px')
  // Token global tidak boleh diubah: mobile & DesktopBoard tetap 16 px.
  const index = read('src/index.css')
  assert.match(index, /--text-body: 1rem;/)
  assert.doesNotMatch(index, /--text-body: 0\.875rem/, 'skala global tidak ikut mengecil')
  // Kontrol formulir tetap 16 px agar tidak memicu zoom.
  assert.match(css, /\.living-map-shell input,[\s\S]{0,200}font-size: 1rem/, 'kontrol formulir kembali ke 16 px')
})

test('Living Map: Mode 2 & 3 berlatar pejal, bukan kaca', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const mode3 = css.match(/\.lm-context-mode-3 \{([^}]*)\}/)
  const mode2 = css.match(/\.lm-context-mode-2 \{([^}]*)\}/)
  assert.ok(mode3 && mode2)
  for (const [name, block] of [['Mode 3', mode3[1]], ['Mode 2', mode2[1]]]) {
    assert.match(block, /background: var\(--lm-solid\)/, `${name} memakai permukaan pejal`)
    assert.match(block, /backdrop-filter: none/, `${name} tanpa blur`)
  }
  assert.match(css, /--lm-solid: var\(--color-tanah-kartu/, 'Mode pejal Tanah')
  assert.match(css, /--lm-solid: var\(--color-langit-kartu/, 'Mode pejal Langit')
  // Mode 1 tetap kaca tembus pandang (satu-satunya mode transparan).
  const base = css.match(/\n\.lm-context \{\n\s{2}position: absolute([\s\S]*?)\n\}/)
  assert.ok(base && /background: var\(--lm-glass-panel\)/.test(base[1] || ''), 'Mode 1 tetap kaca')
  assert.match(base[1] || '', /backdrop-filter: blur\(20px\) saturate\(1\.06\)/, 'Mode 1 memakai blur')
  assert.match(css, /--lm-glass-panel: color-mix\(in srgb, var\(--color-tanah-kartu[^)]*\) 58%/, 'kaca Tanah 58 %')
  assert.match(css, /--lm-glass-panel: color-mix\(in srgb, var\(--color-langit-kartu[^)]*\) 70%/, 'kaca Langit 70 %')
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
  const tabs = css.match(/\.lm-context-tabs \{[^}]*\}/)
  assert.ok(tabs)
  assert.match(tabs[0], /flex: none/, 'baris tab tidak menyusut (dulu terpotong 28 px)')
  assert.match(tabs[0], /flex-wrap: wrap/, 'tab membungkus, tidak terpotong di kanan')
  assert.doesNotMatch(tabs[0], /overflow-x: auto/, 'tidak ada tab tersembunyi di luar layar')
  // Panel konteks berhenti di atas baris alat + dua panel, pada semua mode non-dialog.
  assert.match(css, /\.lm-context \{[\s\S]{0,400}bottom: calc\(var\(--lm-bottom-height, 58px\) \+ 30px\)/, 'panel berhenti di atas dua panel bawah')
  // Baris alat dibatasi lebarnya supaya tidak pernah masuk ke kolom panel.
  assert.match(css, /\.niu-map-toolrow \{[^}]*max-width: calc\(100% - 428px\)/, 'baris alat menyisakan kolom panel')
  assert.match(css, /\.lm-context-mode-3 \{[\s\S]{0,200}bottom: calc\(var\(--lm-bottom-height/, 'Mode 3 juga berhenti di atas dua panel')
  // Dua panel lurus memenuhi halaman, tidak mengikuti lebar panel konteks.
  const dock = css.match(/\n\.lm-bottom \{([\s\S]*?)\n\}/)
  assert.ok(dock, 'aturan dok bawah ada')
  assert.match(dock[1], /right: 14px/, 'dok memenuhi halaman')
  assert.doesNotMatch(dock[1], /--lm-right-inset/, 'dok tidak mengikuti panel konteks')
  // Mode 2 tetap dialog layar penuh, jadi dok disembunyikan.
  assert.match(css, /\.living-map-shell\[data-mode='2'\] \.lm-bottom[\s\S]{0,80}display: none/)
  assert.doesNotMatch(css, /\[data-mode='3'\] \.lm-bottom[\s\S]{0,80}display: none/, 'Mode 3 tidak perlu menyembunyikan dok')
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
  assert.doesNotMatch(css, /(?<!-webkit-)backdrop-filter:[^;]+;\n\s*-webkit-backdrop-filter/, 'properti standar tidak boleh mendahului -webkit-')
  assert.match(css, /-webkit-backdrop-filter: blur\(12px\);\n\s*backdrop-filter: blur\(12px\);/, 'label peta tetap ber-blur setelah build')
})

test('Living Map: tombol perlebar panel bawah membuka dialog tengah', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const css = read('src/pages/LivingMapDesktop.css')
  // Tombol ada di kedua panel, dengan label aksi dan aria-haspopup.
  assert.match(jsx, /lm-panel-expand[^>]*aria-haspopup="dialog"[^>]*aria-label="Perlebar panel waktu dan prakiraan"/, 'tombol perlebar prakiraan')
  assert.match(jsx, /lm-panel-expand[^>]*aria-haspopup="dialog"[^>]*aria-label="Perlebar panel kebun dan musim"/, 'tombol perlebar kebun')
  assert.match(jsx, /className="min-h-11 min-w-11 lm-panel-expand"/, 'tombol tetap target 44 px')
  // Dialog di-portal ke body dan berpusat seperti pop-up pencarian.
  assert.match(jsx, /createPortal\(\s*<div\s+className="lm-panel-modal-layer"/, 'dialog di-portal ke body')
  assert.match(jsx, /role="dialog"[\s\S]{0,120}aria-modal="true"/, 'dialog modal')
  assert.match(css, /\.lm-panel-modal-layer \{[^}]*position: fixed[^}]*place-items: center/, 'lapisan dialog memusatkan isi')
  assert.match(css, /\.lm-panel-modal \{[^}]*width: min\(920px/, 'lebar dialog terbatas')
  // Escape menutup dan fokus kembali ke tombol asal.
  assert.match(jsx, /event\.key === 'Escape'[\s\S]{0,80}setExpandedPanel\(null\)/, 'Escape menutup dialog')
  assert.match(jsx, /expandRef\.current\[expandedPanel\]/, 'fokus kembali ke tombol perlebar')
  // Token tema diulang karena dialog berada di luar .living-map-shell.
  assert.match(css, /\.lm-panel-modal-layer \{[^}]*--lm-solid: var\(--color-tanah-kartu/, 'token Tanah di lapisan dialog')
  assert.match(css, /html\[data-arah='langit'\] \.lm-panel-modal-layer[\s\S]{0,200}--lm-solid: var\(--color-langit-kartu/, 'token Langit di lapisan dialog')
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
  const button = css.match(/html body \.niu-map-card--bare \.niu-map-controls button \{([^}]*)\}/)
  assert.ok(button)
  assert.match(button[1], /justify-content: center/, 'ikon & label di tengah tombol')
  assert.match(css, /html body \.niu-map-card--bare \.niu-map-zoom button \{ padding: 0;/, 'tombol zoom tanpa padding samping')
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
    assert.match(css, new RegExp(`@keyframes ${name}`), `keyframes ${name} ada`)
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
  assert.match(page, /showCondition \/>/, 'Living Map meminta glyph')
  assert.doesNotMatch(page, /<WeatherIcon/, 'halaman tidak menggambar ikon di luar komponen kartu')

  // Pemetaan WMO: enam kelompok, tanpa glyph ketujuh.
  assert.match(wmo, /value === 0\) return 'cerah'/)
  assert.match(wmo, /value === 45 \|\| value === 48\) return 'kabut'/)
  assert.match(wmo, /value === 95 \|\| value === 96 \|\| value === 99\) return 'petir'/)
  assert.match(wmo, /value >= 51 && value <= 67/, 'hujan sedang-lebat')
  assert.match(wmo, /value >= 80 && value <= 86/, 'hujan lokal')
  assert.doesNotMatch(wmo, /return 'salju'/, 'tidak ada glyph salju')

  // Gerak satu kali jalan, bukan animasi abadi.
  assert.match(css, /@keyframes lm-glyph-in/, 'glyph punya animasi masuk sekali')
  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduceBlock, /\.niu-condition-icon \{ animation: none; opacity: 1; transform: none; \}/, 'glyph diam saat reduce')
})

test('Living Map: gerak internal glyph cuaca hanya di desktop, statis jadi default', () => {
  const icons = read('src/icons/index.jsx')
  const ringkas = read('src/pages/RingkasMobile.jsx')
  const css = read('src/pages/LivingMapDesktop.css')

  assert.match(icons, /export function WeatherIcon\(\{ name, className = 'h-6 w-6', motion = false \}\)/, 'gerak opt-in, default diam')
  assert.match(icons, /data-weather-motion=\{motion \? 'live' : undefined\}/, 'penanda gerak di svg')
  for (const cls of ['lm-wx-rays', 'lm-wx-drift', 'lm-wx-rain', 'lm-wx-flash', 'lm-wx-fog']) {
    assert.match(icons, new RegExp(`className="${cls}"`), `bagian ${cls} hilang`)
  }
  assert.match(ringkas, /motion=\{showCondition\}/, 'hanya chip desktop yang meminta gerak')
  assert.match(css, /animation: lm-wx-spin 24s linear infinite/, 'matahari 24 dtk')
  assert.match(css, /animation: lm-wx-rain 1\.6s/, 'hujan 1,6 dtk')
  assert.match(css, /data-weather-motion='live'/, 'gerak dibatasi glyph opt-in')

  const reduceBlock = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduceBlock, /\.niu-condition-icon\[data-weather-motion='live'\] > \* \{ animation: none !important; \}/, 'gerak internal diam saat reduce')
})

test('Living Map: angka suhu tidak terpotong di layar pendek', () => {
  const css = read('src/pages/LivingMapDesktop.css')
  const media = css.slice(css.indexOf('@media (max-height: 780px)'))
  assert.ok(media.length > 0, 'ada aturan tinggi viewport')
  assert.match(media, /\.lm-context \.niu-status-value,[\s\S]*font-size: clamp\(50px, 7\.6dvh, 88px\) !important/, 'angka mengikuti tinggi viewport')
  assert.match(media, /\.lm-context \[data-niu-card='status'\] \{ padding-top: 10px !important; padding-bottom: 10px !important; \}/, 'padding kartu dirapatkan')
  assert.match(media, /\.lm-context \.lm-context-content \{ padding-top: 12px; padding-bottom: 12px; \}/, 'padding isi panel dirapatkan')
  assert.match(css, /\.niu-condition-chip \{/, 'chip kondisi memakai inline-flex')
})

test('Living Map: status kesegaran data dan catatan sentra tanpa data', () => {
  const header = read('src/components/DesktopHeader.jsx')
  const fresh = read('src/lib/dataFreshness.js')
  const map = read('src/components/SchematicMap.jsx')
  const css = read('src/pages/LivingMapDesktop.css')

  // U2 — chip hanya berubah untuk Living Map; papan desktop lain tetap seperti semula.
  assert.match(header, /const freshness = live && minutes != null \? dataFreshness\(minutes\) : null/, 'tier hanya saat live')
  assert.match(header, /data-freshness=\{freshness\?\.tier\}/, 'atribut tingkat untuk gaya')
  assert.match(header, /freshness\?\.tier === 'fresh' \? ' niu-age--live' : ''/, 'denyut hanya saat data baru')
  assert.match(header, /dataFreshness\(minutes\)/, 'memakai modul kesegaran')
  assert.match(fresh, /value < FRESH_LIMIT_MIN \? 'fresh' : value < STALE_LIMIT_MIN \? 'aging' : 'stale'/, 'tiga tingkat')
  assert.match(fresh, /note: tier === 'stale' \? 'mungkin tertunda' : null/, 'catatan hanya saat basi')
  assert.match(css, /\.niu-header-desktop \.niu-age\[data-freshness='aging'\]/, 'gaya tingkat aging ada')

  // U4 — catatan muncul hanya bila lapisan risiko aktif dan ≥3 sentra tanpa data.
  assert.match(map, /const missingCount = layers\?\.risk === false \? 0 : sentra\.filter\(\(location\) => location\.worst === 'n\/a'\)\.length/, 'hitung sentra tanpa data')
  assert.match(map, /\{bare && missingCount >= 3 && \(/, 'ambang tiga sentra')
  assert.match(map, /sentra belum punya data · coba muat ulang/, 'teks penjelasan')
  assert.match(css, /\.niu-map-data-note \{/, 'gaya catatan peta ada')
})

test('Living Map: chip legenda sekaligus tombol lapisan (U3)', () => {
  const map = read('src/components/SchematicMap.jsx')
  const css = read('src/pages/LivingMapDesktop.css')

  // Legenda memakai state `layers` yang sama dengan tombol baris alat.
  assert.match(map, /const legendToggle = \(id, label, content\) => \{/, 'helper toggle legenda ada')
  assert.match(map, /legendToggle\('risk', 'warna risiko', riskLegend\)/, 'kelompok warna = lapisan risiko')
  assert.match(map, /legendToggle\('hotspots', 'titik panas', hotspotLegend\)/, 'chip hotspot = lapisan hotspot')
  assert.match(map, /aria-pressed=\{on\}/, 'status tekan mengikuti layers')
  assert.match(map, /onClick=\{\(\) => onLayerChange\(id\)\}/, 'klik memakai handler layer yang sama')
  assert.match(map, /Sembunyikan' : 'Tampilkan'/, 'label aksi Sembunyikan/Tampilkan')
  assert.match(map, /role="group" aria-label="Legenda peta/, 'legenda adalah grup kontrol, bukan catatan')

  // Tanpa handler layer (papan desktop biasa) legenda tetap statis.
  assert.match(map, /if \(!interactive\) return <span key=\{id\}/, 'fallback statis')

  // Gaya: chip redup saat lapisan mati.
  assert.match(css, /\.niu-map-legend-toggle\[aria-pressed='false'\] \{ opacity: 0\.42; \}/, 'keadaan mati diredupkan')
  assert.match(css, /\.niu-map-legend-toggle:hover,[\s\S]{0,80}\.niu-map-legend-toggle:focus-visible/, 'hover/fokus terlihat')
})

test('Living Map: gerak hemat (pause tab latar) + ikon & simpul yang hidup', () => {
  const jsx = read('src/pages/LivingMapDesktop.jsx')
  const map = read('src/components/SchematicMap.jsx')
  const css = read('src/pages/LivingMapDesktop.css')

  // P0 — animasi berhenti saat tab tidak terlihat.
  assert.match(jsx, /root\.classList\.toggle\('is-lm-paused', document\.hidden\)/, 'kelas pause mengikuti document.hidden')
  assert.match(jsx, /addEventListener\('visibilitychange', sync\)/, 'mendengar visibilitychange')
  assert.match(jsx, /removeEventListener\('visibilitychange', sync\)/, 'listener dilepas saat unmount')
  assert.match(css, /html\.is-lm-paused \*,[\s\S]{0,140}animation-play-state: paused !important/, 'CSS menghentikan animasi')

  // P0 — ikon Lucide di shell mengikuti tebal glyph Niu (1,7), bukan 2.
  assert.doesNotMatch(jsx, /strokeWidth=\{2\}/, 'tidak ada ikon 2 px di shell Living Map')
  assert.match(jsx, /strokeWidth=\{1\.7\}/, 'ikon memakai tebal 1,7')

  // P1 — hotspot berdenyut, dibatasi tiga yang terdekat.
  assert.match(map, /className=\{index < 3 \? 'niu-map-hotspot' : undefined\}/, 'hanya tiga hotspot terdekat beranimasi')
  assert.match(css, /@keyframes lm-hotspot-ping/, 'keyframes hotspot ada')
  assert.match(css, /\.niu-map-hotspot \{[^}]*animation: lm-hotspot-ping 6s/, 'denyut 6 dtk')

  // P1 — cincin radius gunung api berputar pelan, hanya di peta bare.
  assert.match(map, /className=\{bare \? 'niu-volcano-ring' : undefined\}/, 'cincin gunung api dapat kelas')
  assert.match(css, /@keyframes lm-ring-rotate/, 'keyframes rotasi ada')
  assert.match(css, /\.niu-volcano-ring \{[^}]*animation: lm-ring-rotate 40s linear/, 'rotasi 40 dtk linear')

  // Reduced motion: keduanya diam.
  assert.match(css, /\.niu-map-hotspot, \.niu-volcano-ring \{ animation: none; \}/, 'dimatikan saat reduced motion')
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
