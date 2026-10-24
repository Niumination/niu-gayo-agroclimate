import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

test('serve.py: SPA fallback hanya untuk navigasi; cache entry point ketat dan asset hash immutable', async (t) => {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'niu-dist-test-'))
  const port = 20_000 + Math.floor(Math.random() * 20_000)
  fs.mkdirSync(path.join(dist, 'assets'), { recursive: true })
  fs.writeFileSync(path.join(dist, 'index.html'), '<!doctype html><html><body><div id="root"></div></body></html>')
  fs.writeFileSync(path.join(dist, 'sw.js'), 'self.addEventListener("fetch", () => {})')
  fs.writeFileSync(path.join(dist, 'registerSW.js'), 'navigator.serviceWorker.register("/sw.js")')
  fs.writeFileSync(path.join(dist, 'manifest.webmanifest'), '{}')
  fs.writeFileSync(path.join(dist, 'assets', 'app-AbCdEfGh.js'), 'console.log("app")')

  const server = spawn('python3', ['scripts/serve.py'], {
    cwd: ROOT,
    env: { ...process.env, PORT: String(port), NIU_DIST_DIR: dist },
    stdio: 'ignore',
  })
  t.after(() => {
    server.kill('SIGTERM')
    fs.rmSync(dist, { recursive: true, force: true })
  })

  const base = `http://127.0.0.1:${port}`
  let ready = false
  for (let i = 0; i < 40; i++) {
    try {
      const response = await fetch(base, { signal: AbortSignal.timeout(500) })
      if (response.ok) { ready = true; break }
    } catch { /* tunggu server siap */ }
    await wait(50)
  }
  assert.equal(ready, true, 'server statis tidak mulai')

  const root = await fetch(base, { headers: { Accept: 'text/html' } })
  assert.equal(root.status, 200)
  assert.match(root.headers.get('cache-control') || '', /no-cache/)
  assert.match(root.headers.get('x-content-type-options') || '', /nosniff/)

  const route = await fetch(`${base}/risiko/aktif`, { headers: { Accept: 'text/html' } })
  assert.equal(route.status, 200)
  assert.match(await route.text(), /id="root"/)

  const missingAsset = await fetch(`${base}/assets/missing.js`, { headers: { Accept: '*/*' } })
  assert.equal(missingAsset.status, 404)
  assert.match(missingAsset.headers.get('cache-control') || '', /no-cache/)

  // Audit F-14 — alamat yang salah dibalas halaman 404 milik aplikasi, bukan bawaan Python,
  // dan statusnya tetap 404. Navigasi peramban (Accept: text/html) tetap dianggap rute SPA
  // (aplikasi tidak punya rute path; keadaan ada di query string) — jadi jalur extensionless
  // untuk permintaan *bukan* dokumen inilah yang wajib menampilkan halaman 404.
  fs.writeFileSync(path.join(dist, '404.html'), '<!doctype html><html><body>Halaman ini tidak ada</body></html>')
  const notFound = await fetch(`${base}/halaman-tidak-ada`)
  assert.equal(notFound.status, 404)
  assert.match(notFound.headers.get('content-type') || '', /text\/html/)
  assert.match(await notFound.text(), /Halaman ini tidak ada/)

  const asset404 = await fetch(`${base}/assets/tidak-ada.js`)
  assert.equal(asset404.status, 404)
  assert.doesNotMatch(await asset404.text(), /Halaman ini tidak ada/)

  // Rute SPA yang sah tidak pernah jadi 404.
  const spaRoute = await fetch(`${base}/halaman-tidak-ada`, { headers: { Accept: 'text/html' } })
  assert.equal(spaRoute.status, 200)
  assert.match(await spaRoute.text(), /id="root"/)

  const sw = await fetch(`${base}/sw.js`)
  assert.equal(sw.status, 200)
  assert.match(sw.headers.get('cache-control') || '', /no-cache/)
  // Skrip service worker tidak boleh disimpan perantara sama sekali: bila CDN
  // menyimpannya, rilis baru bisa tertahan berjam-jam.
  assert.match(sw.headers.get('cache-control') || '', /no-store/)
  assert.match(sw.headers.get('pragma') || '', /no-cache/)
  assert.equal(sw.headers.get('expires'), '0')

  const registerSw = await fetch(`${base}/registerSW.js`)
  assert.equal(registerSw.status, 200)
  assert.match(registerSw.headers.get('cache-control') || '', /no-store/)

  const hashed = await fetch(`${base}/assets/app-AbCdEfGh.js`)
  assert.equal(hashed.status, 200)
  assert.match(hashed.headers.get('cache-control') || '', /max-age=31536000.*immutable/)
})
