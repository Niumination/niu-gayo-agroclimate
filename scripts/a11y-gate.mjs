#!/usr/bin/env node
/**
 * Gerbang aksesibilitas berbasis browser — temuan audit F-39.
 *
 * Sebelum ini, seluruh pemeriksaan a11y di repo bersifat statis (ESLint jsx-a11y,
 * gerbang kontras token, uji kontrak berbasis sumber). Tiga temuan Sprint A
 * (label ganda, fokus di dalam panel terlipat, target sentuh < 24 px) lolos dari
 * semua gerbang itu karena hanya muncul saat halaman benar-benar dirender.
 *
 * Skrip ini menyalakan tiruan produksi lokal — `dist/` dilayani seperti host
 * statis, `/api/*` diteruskan ke `server/index.js` — lalu menjalankan axe-core
 * di tiga permukaan yang paling sering berubah:
 *   1. Peta hidup — Tanah     /
 *   2. Peta hidup — Langit    /?tampilan=peta-hidup  (localStorage tema gelap)
 *   3. sentra dari URL   /?sentra=linge
 *
 * Pemakaian:
 *   npm run build && npm run check:a11y
 *   CHROME_PATH=/path/ke/chrome node scripts/a11y-gate.mjs
 *
 * Tanpa browser yang bisa ditemukan, skrip berhenti dengan peringatan (exit 0)
 * supaya `npm run check:a11y` tetap ramah di mesin pengembang. Bila CHROME_PATH
 * diset — itulah yang dilakukan CI — browser wajib ada (exit 1), supaya gerbang
 * tidak pernah "lulus" karena diam-diam dilewati.
 */
import { spawn } from 'node:child_process'
import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)

/** Cari chrome/chromium: CHROME_PATH → cache @puppeteer/browsers → biner sistem. */
function findChrome() {
  const explicit = process.env.CHROME_PATH
  if (explicit) {
    if (existsSync(explicit)) return { path: explicit, source: 'CHROME_PATH' }
    console.error(`✗ CHROME_PATH diset tetapi tidak ada: ${explicit}`)
    process.exit(1)
  }
  const cacheRoots = [
    path.join(ROOT, '.cache', 'browsers'),
    path.join(process.env.HOME || '', '.cache', 'puppeteer'),
  ]
  for (const root of cacheRoots) {
    if (!existsSync(root)) continue
    for (const rel of ['chrome-headless-shell', 'chrome']) {
      const dir = path.join(root, rel)
      if (!existsSync(dir)) continue
      for (const build of readdirSync(dir)) {
        for (const bin of [
          path.join(dir, build, 'chrome-headless-shell-linux64', 'chrome-headless-shell'),
          path.join(dir, build, 'chrome-linux64', 'chrome'),
        ]) if (existsSync(bin)) return { path: bin, source: `cache ${rel}@${build}` }
      }
    }
  }
  for (const bin of ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome-stable']) {
    if (existsSync(bin)) return { path: bin, source: 'sistem' }
  }
  return null
}

/** Permukaan yang diperiksa. `prepare` dijalankan sebelum navigasi (localStorage). */
const SURFACES = [
  // F-32 — Peta Hidup kini satu-satunya UI desktop, jadi akar situs (`/`) ikut diperiksa
  // dengan kait yang sama; permukaan "papan" tidak ada lagi.
  { name: 'Peta hidup — Tanah', url: '/', wait: '.lm-bottom' },
  {
    name: 'Peta hidup — Langit',
    url: '/?tampilan=peta-hidup',
    wait: '.lm-bottom',
    prepare: () => {
      localStorage.setItem('nga.theme', 'dark')
      localStorage.setItem('niu.arah', 'langit')
    },
  },
  // Keadaan berbeda, bukan halaman berbeda: sentra dari URL (audit F-24) tetap harus bersih.
  { name: 'Peta hidup — sentra dari URL', url: '/?sentra=linge', wait: '.lm-bottom' },
]

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

function buildInfoVersion() {
  try { return JSON.parse(readFileSync(path.join(ROOT, 'dist', 'build-info.json'), 'utf8')).version } catch { return null }
}

/** Berkas masukan build yang lebih baru dari dist/index.html, atau null bila segar. */
function staleDist() {
  const distTime = statSync(path.join(ROOT, 'dist', 'index.html')).mtimeMs
  const inputs = ['index.html', 'vite.config.js', 'package.json']
  const walk = (dir, out = []) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(p, out)
      else out.push(p)
    }
    return out
  }
  if (existsSync(path.join(ROOT, 'src'))) inputs.push(...walk(path.join(ROOT, 'src')))
  if (existsSync(path.join(ROOT, 'public'))) inputs.push(...walk(path.join(ROOT, 'public')))
  for (const f of inputs) {
    if (statSync(f).mtimeMs > distTime + 1000) return path.relative(ROOT, f)
  }
  return null
}

/** Versi chrome-headless-shell yang diharapkan pustaka ini — sumber tunggal, bukan pin tangan.
 *  Chrome 131 + puppeteer-core 25 terbukti tidak stabil (Runtime.evaluate menggantung), jadi
 *  pemasangan browser harus mengikuti revisi pustakanya; CI menurunkan angka yang sama. */
async function expectedBrowser() {
  try {
    const { PUPPETEER_REVISIONS } = await import('puppeteer-core/internal/revisions.js')
    return { version: PUPPETEER_REVISIONS['chrome-headless-shell'], known: true }
  } catch {
    return { version: 'latest', known: false }
  }
}

const chrome = findChrome()
if (!chrome) {
  const { version } = await expectedBrowser()
  console.warn('! Gerbang a11y dilewati: browser tidak ditemukan.')
  console.warn(`  Pasang: npx @puppeteer/browsers install chrome-headless-shell@${version} --path .cache/browsers`)
  console.warn('  lalu:   CHROME_PATH=<path dari keluaran perintah di atas> npm run check:a11y')
  process.exit(0)
}
if (!existsSync(path.join(ROOT, 'dist', 'index.html'))) {
  console.error('✗ dist/ belum ada — jalankan `npm run build` lebih dulu.')
  process.exit(1)
}

const { version } = require('../package.json')
const built = buildInfoVersion()
if (built && built !== version) {
  console.error(`✗ dist/ dari versi ${built}, package.json ${version} — jalankan ulang \`npm run build\`.`)
  process.exit(1)
}
// dist yang lebih tua dari sumbernya akan diaudit diam-diam dan gerbang "lolos"
// untuk kode yang sudah tiada. Build yang gagal wajib terlihat sebagai kegagalan.
const stale = staleDist()
if (stale) {
  console.error(`✗ dist/ kedaluwarsa: ${stale} lebih baru dari dist/index.html — jalankan \`npm run build\`.`)
  process.exit(1)
}

const puppeteer = (await import('puppeteer-core')).default
const axeSource = readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8')

// Browser yang terlalu jauh dari revisi pustaka membuat CDP menggantung, bukan gagal jelas.
// Beri peringatan agar penyebabnya terlihat sebelum orang menuduh uji a11y "flaky".
const expected = await expectedBrowser()
const installed = await (async () => {
  try {
    const out = await new Promise((resolve, reject) => {
      const p = spawn(chrome.path, ['--version'], { stdio: ['ignore', 'pipe', 'ignore'] })
      let buf = ''
      p.stdout.on('data', (c) => { buf += c })
      p.on('close', () => resolve(buf.trim()))
      p.on('error', reject)
    })
    return out.match(/(\d+)\./)?.[1] ?? null
  } catch { return null }
})()
const expectedMajor = expected.version.match(/^(\d+)/)?.[1] ?? null
if (installed && expectedMajor && installed !== expectedMajor && Math.abs(Number(installed) - Number(expectedMajor)) > 2) {
  console.warn(`! Browser ${installed}.x jauh dari revisi pustaka ${expected.version} — bila gerbang menggantung, pasang versi yang sama.`)
}

const PORT = Number(process.env.A11Y_PORT || 7489)
const API_PORT = PORT + 1
const BASE = `http://127.0.0.1:${PORT}`
const DIST = path.join(ROOT, 'dist')
console.log(`gerbang a11y · ${BASE} · chrome: ${chrome.path} (${chrome.source})`)

const server = spawn(process.execPath, ['server/index.js'], {
  cwd: ROOT,
  env: { ...process.env, PORT: String(API_PORT), ALERTS_CRON_TOKEN: 'smoke', TELEGRAM_BOT_TOKEN: '' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let serverLog = ''
server.stdout.on('data', (c) => { serverLog += c })
server.stderr.on('data', (c) => { serverLog += c })

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let failures = 0
let statik = null
let browser = null
// Semua pegangan harus ditutup walau ada galat: tanpa ini proses menggantung
// (job CI menunggu sampai batas waktu, bukan gagal cepat seperti seharusnya).
const cleanup = async () => {
  try { await browser?.close() } catch { /* sudah tutup */ }
  try { statik?.close() } catch { /* sudah tutup */ }
  try { server.kill('SIGTERM') } catch { /* sudah mati */ }
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
}
const PROXY_PREFIX = ['/api/', '/healthz']

/** Tiruan host produksi: berkas statis dari dist/, sisanya index.html (SPA), /api → server lokal. */
function startStatic() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer((req, res) => {
      const pathname = decodeURIComponent(new URL(req.url, BASE).pathname)
      if (PROXY_PREFIX.some((p) => pathname === p.replace(/\/$/, '') || pathname.startsWith(p))) {
        const proxy = http.request(
          { host: '127.0.0.1', port: API_PORT, path: req.url, method: req.method, headers: { ...req.headers, host: `127.0.0.1:${API_PORT}` } },
          (up) => { res.writeHead(up.statusCode || 502, up.headers); up.pipe(res) },
        )
        proxy.on('error', (err) => { res.writeHead(502, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: err.message })) })
        req.pipe(proxy)
        return
      }
      let file = path.join(DIST, pathname)
      if (!file.startsWith(DIST) || !existsSync(file) || statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
      const ext = path.extname(file)
      res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream' })
      createReadStream(file).pipe(res)
    })
    srv.on('error', reject)
    srv.listen(PORT, '127.0.0.1', () => resolve(srv))
  })
}

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const res = await fetch(`${BASE}/healthz`, { signal: AbortSignal.timeout(1500) })
      if (res.ok) return true
    } catch { /* belum siap */ }
    await sleep(250)
  }
  return false
}

try {
  statik = await startStatic()
  if (!(await waitForServer())) {
    console.error(`✗ server lokal tidak siap dalam 30 s\n${serverLog.slice(-800)}`)
    process.exit(1)
  }

  browser = await puppeteer.launch({
    executablePath: chrome.path,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    defaultViewport: { width: 1920, height: 1080 },
  })

  for (const surface of SURFACES) {
    const page = await browser.newPage()
    if (surface.prepare) await page.evaluateOnNewDocument(surface.prepare)
    const errors = []
    page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)))
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)) })

    // Satu permukaan yang lambat tidak boleh menggantung seluruh gerbang: 45 s,
    // satu percobaan ulang, lalu permukaan itu ditandai gagal.
    const buka = async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          return await page.goto(`${BASE}${surface.url}`, { waitUntil: 'networkidle2', timeout: 45_000 })
        } catch (err) {
          if (attempt === 1) throw err
          await sleep(700)
        }
      }
      return null
    }
    try {
      await buka()
    } catch (err) {
      failures += 1
      console.error(`✗ ${surface.name}: gagal dibuka — ${err.message.split('\n')[0]}`)
      await page.close()
      continue
    }
    // Hidrasi React + data stasiun: permukaan harus benar-benar tergambar sebelum diaudit.
    await page.waitForFunction((sel) => !!document.querySelector(sel), { timeout: 90_000 }, surface.wait)
      .catch(() => errors.push(`permukaan tidak muncul: ${surface.wait}`))
    await sleep(1200)

    await page.evaluate(axeSource)
    const violations = await page.evaluate(async (tags) => {
      const res = await window.axe.run(document, { runOnly: { type: 'tag', values: tags } })
      return res.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        help: v.help,
        nodes: v.nodes.slice(0, 5).map((n) => `${n.target.join(' ')} — ${n.failureSummary?.split('\n')[1]?.trim() || ''}`),
      }))
    }, AXE_TAGS)

    if (violations.length === 0) {
      console.log(`✓ ${surface.name}: 0 pelanggaran axe`)
    } else {
      failures += violations.length
      console.error(`✗ ${surface.name}: ${violations.length} pelanggaran axe`)
      for (const v of violations) {
        console.error(`  · [${v.impact}] ${v.id} — ${v.help} (${v.nodes.length} simpul)`)
        for (const n of v.nodes) console.error(`      ${n}`)
      }
    }
    if (errors.length) {
      failures += 1
      console.error(`✗ ${surface.name}: ${errors.length} galat runtime`)
      for (const e of errors.slice(0, 5)) console.error(`  · ${e}`)
    }
    await page.close()
  }

  if (failures) {
    console.error(`\n✗ gerbang a11y gagal: ${failures} masalah`)
    process.exitCode = 1
  } else {
    console.log(`\n✓ gerbang a11y lolos — ${SURFACES.length} permukaan bersih (axe ${AXE_TAGS.join(', ')})`)
  }
} catch (err) {
  console.error(`✗ gerbang a11y error: ${err.message}`)
  process.exitCode = 1
} finally {
  await cleanup()
  // Keluar eksplisit: SW/proses anak tidak boleh menahan job CI.
  process.exit(failures ? 1 : 0)
}
