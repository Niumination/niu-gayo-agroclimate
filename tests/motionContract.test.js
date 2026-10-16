// Uji kontrak P5 — gerak, area aman, dan umpan balik tekan (berbasis sumber, tanpa browser).
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8')
const html = read('index.html')
const css = read('src/index.css')
const app = read('src/App.jsx')
const tokens = read('docs/reference/DESIGN-TOKENS.md')

/** Semua berkas sumber React (tanpa berkas uji). */
function sourceFiles() {
  const out = []
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(jsx?|css)$/.test(e.name)) out.push([path.relative(ROOT, p), fs.readFileSync(p, 'utf8')])
    }
  }
  walk(path.join(ROOT, 'src'))
  return out
}
const SRC = sourceFiles()

test('P5 · index.html: viewport-fit=cover + color-scheme + theme-color dinamis', () => {
  assert.ok(html.includes('viewport-fit=cover'), 'tanpa viewport-fit=cover semua env(safe-area-inset-*) bernilai 0')
  assert.ok(html.includes('color-scheme'), 'meta color-scheme hilang (kontrol bawaan browser mengikuti tema)')
  assert.ok(html.includes('name="theme-color"'), 'meta theme-color hilang')
  assert.ok(app.includes("querySelector('meta[name=\"theme-color\"]')"), 'theme-color tidak diperbarui mengikuti tema terpilih')
})

test('P5 · area aman dipakai di header & navigasi bawah', () => {
  assert.ok(read('src/components/AppBar.jsx').includes('pt-[env(safe-area-inset-top)]'), 'AppBar tanpa safe-area atas')
  assert.ok(read('src/components/DesktopHeader.jsx').includes('pt-[env(safe-area-inset-top)]'), 'DesktopHeader tanpa safe-area atas')
  assert.ok(read('src/components/BottomNav.jsx').includes('pb-[env(safe-area-inset-bottom)]'), 'BottomNav tanpa safe-area bawah')
})

test('P5 · tidak ada animasi berdenyut yang membawa makna', () => {
  for (const [rel, t] of SRC) {
    assert.ok(!/animate-(pulse|bounce)/.test(t), `${rel}: animate-pulse/bounce tidak boleh dipakai (level ekstrem harus tetap terbaca tanpa denyut)`)
  }
})

test('P5 · durasi gerak ≤ 300 ms (fungsional maksimum 500 ms)', () => {
  for (const [rel, t] of SRC) {
    for (const m of t.matchAll(/duration-(\d+)/g)) {
      assert.ok(Number(m[1]) <= 300, `${rel}: duration-${m[1]} melebihi 300 ms`)
    }
    for (const m of t.matchAll(/animate-\[[^\]]*?(\d+)(ms|s)\]/g)) {
      const ms = m[2] === 's' ? Number(m[1]) * 1000 : Number(m[1])
      assert.ok(ms <= 500, `${rel}: animasi ${ms} ms melebihi batas fungsional 500 ms`)
    }
  }
})

test('P5 · gerak memakai token easing, bukan nilai lepas', () => {
  assert.match(css, /--ease-enter: cubic-bezier/, 'token --ease-enter hilang')
  assert.match(css, /--ease-exit: cubic-bezier/, 'token --ease-exit hilang')
  assert.ok(css.includes('animation: nga-enter 200ms var(--ease-enter) both;'), '.anim-enter tidak memakai token easing')
})

test('P5 · prefers-reduced-motion mematikan gerak, bukan fungsi', () => {
  assert.match(css, /prefers-reduced-motion[\s\S]{0,240}\.anim-enter \{ animation: none; \}/)
  assert.match(css, /prefers-reduced-motion[\s\S]{0,240}\.skeleton \{ animation: none/)
  assert.match(css, /animation-duration: 0\.01ms !important/)
  assert.ok(!/\.anim-enter \{ display: none/.test(css), 'reduced-motion tidak boleh menyembunyikan konten')
})

test('P5 · umpan balik tekan merata pada aksi utama', () => {
  const wajib = [
    'src/App.jsx',
    'src/components/AboutData.jsx',
    'src/components/AirQualityCard.jsx',
    'src/components/AppBar.jsx',
    'src/components/BottomNav.jsx',
    'src/components/ClimateBanner.jsx',
    'src/components/DesktopHeader.jsx',
    'src/components/DisasterHistoryCard.jsx',
    'src/components/ErrorBoundary.jsx',
    'src/components/FireDangerCard.jsx',
    'src/components/HazardPanel.jsx',
    'src/components/LocationRail.jsx',
    'src/components/Notice.jsx',
    'src/components/ReportButton.jsx',
    'src/components/ShareButton.jsx',
  ]
  for (const rel of wajib) {
    assert.ok(read(rel).includes('active:scale-[.97]'), `${rel}: umpan balik tekan hilang`)
  }
})

test('P5 · baris flex dengan teks panjang memakai min-w-0', () => {
  const wajib = [
    'src/App.jsx',
    'src/components/AppBar.jsx',
    'src/components/DisasterHistoryCard.jsx',
    'src/components/FireDangerCard.jsx',
    'src/components/HazardPanel.jsx',
    'src/components/HourlyForecast.jsx',
    'src/components/LocationRail.jsx',
    'src/components/MetricChip.jsx',
    'src/components/Notice.jsx',
  ]
  for (const rel of wajib) {
    assert.ok(read(rel).includes('min-w-0'), `${rel}: min-w-0 hilang (teks panjang bisa memaksa lebar keluar)`)
  }
})

test('P5 · tabel gerak & area aman hidup di dokumen token', () => {
  assert.ok(tokens.includes('## 5. Gerak (motion)'), 'bagian gerak di DESIGN-TOKENS hilang')
  assert.match(tokens, /umpan balik tekan tombol \| 90 ms/, 'tabel gerak kehilangan baris umpan balik tekan')
  assert.ok(/prefers-reduced-motion/.test(tokens), 'aturan reduced-motion tidak terdokumentasi')
})
