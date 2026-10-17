// Uji kontrak P2 — aksesibilitas interaksi (tanpa browser; berbasis sumber).
// Tujuan: perbaikan P2 tidak bisa mundur diam-diam. Setiap uji memeriksa berkas
// sumber nyata, bukan snapshot, sehingga gagal berarti kode benar-benar berubah.
import test from 'node:test'
import assert from 'node:assert'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { messages } from '../src/i18n/messages.js'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC_DIR = path.join(ROOT, 'src')

/** Telusuri src/ → daftar { rel, text } untuk .js/.jsx/.css. */
function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(p, out)
    else if (/\.(js|jsx|css)$/.test(entry.name)) out.push(p)
  }
  return out
}

/** Buang komentar blok & baris komentar penuh (tanpa mengganggu URL `https://`). */
export function stripComments(text) {
  const noBlock = text.replace(/\/\*[\s\S]*?\*\//g, '')
  return noBlock
    .split('\n')
    .filter((line) => {
      const t = line.trim()
      return !t.startsWith('//') && !t.startsWith('*') && !t.startsWith('{/*')
    })
    .join('\n')
}

const SRC = walk(SRC_DIR).map((f) => ({ rel: path.relative(ROOT, f), text: fs.readFileSync(f, 'utf8') }))
const css = fs.readFileSync(path.join(SRC_DIR, 'index.css'), 'utf8')
const file = (rel) => {
  const hit = SRC.find((f) => f.rel === rel)
  assert.ok(hit, `berkas ${rel} tidak ditemukan`)
  return hit.text
}

/** Ambil seluruh tag <button …> dengan pemindai yang sadar kurawal & kutip. */
export function buttonTags(text) {
  const tags = []
  for (let i = 0; i < text.length; i++) {
    if (!text.startsWith('<button', i)) continue
    let depth = 0
    let quote = null
    let j = i + 7
    for (; j < text.length; j++) {
      const ch = text[j]
      if (quote) {
        if (ch === '\\') j++
        else if (ch === quote) quote = null
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') quote = ch
      else if (ch === '{') depth++
      else if (ch === '}') depth--
      else if (ch === '>' && depth === 0) break
    }
    tags.push(text.slice(i, j + 1))
    i = j
  }
  return tags
}

const TARGET = /(min-h-\[?\d|min-h-11|\bh-1[0-2]\b|\bpy-[3-9]\b|\bp-[5-9]\b)/

/** Kelas konstanta lokal (mis. `const link = '…'`) untuk className dinamis. */
function classConsts(text) {
  const map = {}
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*'([^']*)'/g)) map[m[1]] = m[2]
  for (const m of text.matchAll(/const\s+(\w+)\s*=\s*`([^`]*)`/g)) map[m[1]] = m[2]
  return map
}

test('P2 · skala tipografi ada di @theme (teks isi 16 px, minimum 12 px)', () => {
  for (const token of ['--text-body:', '--text-body-sm:', '--text-label:', '--text-caption:']) {
    assert.ok(css.includes(token), `token ${token} hilang dari src/index.css`)
  }
  assert.match(css, /--text-body:\s*1rem/, 'text-body harus 1 rem (16 px)')
})

test('P2 · setiap utilitas skala teks yang dipakai punya tokennya', () => {
  const scale = ['body', 'body-sm', 'label', 'caption']
  const used = new Set()
  for (const { text } of SRC) {
    for (const m of text.matchAll(/(?:^|[\s"'`:{])text-(body[\w-]*|label|caption)\b/g)) used.add(m[1])
  }
  assert.ok(used.size > 0, 'tidak ada utilitas skala teks terpakai — periksa regex')
  for (const name of used) {
    assert.ok(scale.includes(name), `utilitas text-${name} bukan bagian skala resmi`)
    assert.ok(css.includes(`--text-${name}:`), `utilitas text-${name} dipakai tanpa token --text-${name}`)
  }
})

test('P2 · tab mobile memakai semantik tablist + roving tabindex + panah', () => {
  const t = file('src/components/BottomNav.jsx')
  for (const need of [
    'role="tablist"',
    "tr('tabsLabel')",
    'role="tab"',
    'aria-selected={isActive}',
    'aria-controls={`panel-${id}`}',
    'tabIndex={isActive ? 0 : -1}',
    "'ArrowRight'",
    "'ArrowLeft'",
    "'Home'",
    "'End'",
    'min-h-[56px]',
    'aria-hidden="true"',
    'env(safe-area-inset-bottom)',
  ]) {
    assert.ok(t.includes(need), `BottomNav.jsx kehilangan: ${need}`)
  }
})

test('P2 · panel tab terhubung ke tab-nya dan penanda fokus tidak dihapus', () => {
  const t = file('src/components/MobileTabShell.jsx')
  assert.ok(t.includes('role="tabpanel"'))
  assert.ok(t.includes('aria-labelledby={`tab-${active}`}'))
  assert.ok(t.includes('id={`panel-${active}`}'))
  assert.ok(t.includes('tabIndex={0}'))
  assert.ok(!t.includes('outline-none'), 'panel tab tidak boleh menghapus penanda fokus')
})

test('P2 · App: skip-link, konten utama, pengumuman status, tombol ulang', () => {
  const t = file('src/App.jsx')
  assert.ok(t.includes('href="#main"'), 'skip-link hilang')
  assert.match(t, /id="main"/g, 'main tanpa id="main"')
  assert.ok(t.includes('role="status"') && t.includes('aria-live="polite"'), 'pengumuman status hilang')
  assert.ok(t.includes("tr('skipToContent')"))
  assert.ok(t.includes("tr('retry')"), 'tombol coba lagi pada banner galat hilang')
  assert.ok(t.includes('role="alert"'), 'banner galat harus role=alert')
})

test('P2 · tidak ada kontrol yang menghapus penanda fokus', () => {
  const bad = []
  for (const { rel, text } of SRC) {
    for (const m of stripComments(text).matchAll(/(focus-visible:|focus:)?outline-(none|hidden)/g)) bad.push(`${rel}: ${m[0]}`)
  }
  assert.deepStrictEqual(bad, [], `penghapus penanda fokus ditemukan:\n${bad.join('\n')}`)
})

test('P2 · berbagi memakai grup (bukan menu) tanpa pengelolaan fokus', () => {
  const t = file('src/components/ShareButton.jsx')
  assert.ok(t.includes('role="group"'))
  assert.ok(!stripComments(t).includes('role="menu"'), 'ShareButton masih memakai role=menu')
  assert.ok(t.includes('aria-expanded={open}'))
  assert.ok(t.includes('min-h-11'))
})

test('P2 · kontak darurat & bantuan konsisten dapat dijangkau', () => {
  const tel = file('src/components/EmergencyContacts.jsx')
  assert.ok(tel.includes('href="tel:') || tel.includes('tel:'), 'tautan telepon hilang')
  assert.ok(tel.includes('min-h-11'), 'tautan telepon < 44 px')
  const panel = file('src/components/HazardPanel.jsx')
  assert.ok(panel.includes("tr('aboutData')"), 'bantuan konsisten (WCAG 3.2.6) hilang dari panel')
})

test('P2 · seluruh tombol punya target sentuh ≥ 44 px', () => {
  const offenders = []
  let total = 0
  for (const { rel, text } of SRC) {
    if (!text.includes('<button')) continue
    // Komentar dibuang lebih dulu: contoh `<button>` di dokumentasi JSX bukan tombol nyata (P6).
    const src = stripComments(text)
    const consts = classConsts(src)
    for (const tag of buttonTags(src)) {
      total++
      let ok = TARGET.test(tag)
      if (!ok) {
        // className dinamis: periksa konstanta kelas lokal yang direferensikan
        for (const m of tag.matchAll(/\$\{(\w+)\}|\{(\w+)\}/g)) {
          const name = m[1] || m[2]
          if (name && consts[name] && TARGET.test(consts[name])) ok = true
        }
      }
      // Tombol latar penuh (`absolute inset-0`) menutupi seluruh layar — target jauh di atas 44 px,
      // dan nilainya tidak perlu ditulis ulang sebagai kelas tinggi (P6: latar dialog jadi <button>).
      if (!ok && /\binset-0\b/.test(tag)) ok = true
      if (!ok) offenders.push(`${rel}: ${tag.slice(0, 90).replace(/\s+/g, ' ')}`)
    }
  }
  assert.ok(total >= 20, `pemindai tombol mencurigakan (total ${total})`)
  assert.deepStrictEqual(offenders, [], `tombol tanpa target ≥ 44 px:\n${offenders.join('\n')}`)
})

test('P2 · label interaksi & bantuan tersedia di kedua bahasa', () => {
  const keys = [
    'tabsLabel',
    'showAll',
    'hideNoData',
    'showHidden',
    'aboutData',
    'share',
    'shareHow',
    'copy',
    'copied',
    'evaluatedAt',
    'unofficialNote',
    'skipToContent',
    'retry',
    'emptyData',
    'highestLevel',
  ]
  for (const key of keys) {
    assert.ok(messages.id[key], `kunci id hilang: ${key}`)
  }
})
