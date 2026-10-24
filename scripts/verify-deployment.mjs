#!/usr/bin/env node
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const baseArg = args.find((arg) => /^https?:\/\//i.test(arg)) || process.env.NIU_LIVE_URL
const expectArg = args.find((arg) => arg.startsWith('--expect='))?.slice('--expect='.length)
// F-15 (audit 23 Okt 2026): versi target dibaca dari package.json, bukan ditulis ulang di sini —
// sebelumnya naik versi membuat verify:deployment gagal karena angka lama tertinggal.
const EXPECTED_VERSION = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version
const expected = expectArg || process.env.NIU_EXPECTED_REVISION || (() => {
  try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() } catch { return null }
})()

if (!baseArg || !expected) {
  console.error('Pakai: npm run verify:deployment -- https://cuaca.abstract.biz.id --expect=<SHA-40>')
  process.exit(2)
}
const base = new URL(baseArg.endsWith('/') ? baseArg : `${baseArg}/`)
const failures = []
const warnings = []
const pass = (text) => console.log(`✓ ${text}`)
const fail = (text) => failures.push(text)

async function fetchChecked(url, label) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store', Pragma: 'no-cache' },
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    return response
  } catch (error) {
    fail(`${label}: ${error.message}`)
    return null
  }
}

const cacheIsFreshSafe = (response, label) => {
  if (!response) return
  const cc = response.headers.get('cache-control') || ''
  const maxAge = Number(cc.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1] ?? 0)
  if (!/no-cache|no-store/i.test(cc) || maxAge > 0) {
    fail(`${label}: Cache-Control harus no-cache/no-store, ditemukan "${cc || '(kosong)'}"`)
  } else {
    pass(`${label}: cache entry point selalu divalidasi (${cc})`)
  }
  const cf = response.headers.get('cf-cache-status') || ''
  const age = Number(response.headers.get('age') || 0)
  if (cf.toLowerCase() === 'hit' && age > 0) fail(`${label}: Cloudflare menyajikan HIT lama (Age ${age})`)
}

const nonce = `verify=${Date.now()}`
const buildRes = await fetchChecked(new URL(`/build-info.json?${nonce}`, base), 'build-info.json')
let build
if (buildRes) {
  try { build = await buildRes.json() } catch { fail('build-info.json bukan JSON valid') }
}
if (build) {
  if (build.app !== 'Niu') fail(`aplikasi statis salah: ${build.app}`)
  if (build.revision !== expected) fail(`frontend revision ${build.revision}; target ${expected}`)
  if (build.dirty !== false) fail(`frontend build dirty=${build.dirty}; rilis harus berasal dari working tree bersih`)
  if (build.version !== EXPECTED_VERSION) fail(`frontend version ${build.version}; target ${EXPECTED_VERSION}`)
  if (!build.assets?.scripts?.length || !build.assets?.styles?.length) fail('build-info tidak mencatat JS/CSS assets')
  if (failures.length === 0) pass(`frontend build ${build.version} · ${build.revision}`)
}
cacheIsFreshSafe(buildRes, '/build-info.json')

const htmlRes = await fetchChecked(new URL(`/?${nonce}`, base), 'halaman utama')
let html = ''
if (htmlRes) {
  html = await htmlRes.text()
  if (!html.includes('<div id="root"></div>')) fail('index.html tidak berisi root aplikasi Niu')
  cacheIsFreshSafe(htmlRes, '/')
  if (failures.length === 0) pass('index.html dimuat')
}

if (html && build) {
  const liveScripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/g)]
    .map((match) => match[1]).filter((url) => url.startsWith('/assets/'))
  const liveStyles = [...html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["']/g)]
    .map((match) => match[1]).filter((url) => url.startsWith('/assets/'))
  const sort = (items) => [...items].sort().join('|')
  if (sort(liveScripts) !== sort(build.assets.scripts || [])) fail(`JS di index.html (${liveScripts.join(', ')}) tidak cocok dengan build-info (${(build.assets.scripts || []).join(', ')})`)
  if (sort(liveStyles) !== sort(build.assets.styles || [])) fail(`CSS di index.html (${liveStyles.join(', ')}) tidak cocok dengan build-info (${(build.assets.styles || []).join(', ')})`)
  for (const asset of [...liveScripts, ...liveStyles]) {
    const response = await fetchChecked(new URL(`${asset}?${nonce}`, base), `asset ${asset}`)
    if (!response) continue
    const type = response.headers.get('content-type') || ''
    const expectedType = asset.endsWith('.css') ? /text\/css/i : /javascript|ecmascript/i
    if (!expectedType.test(type)) fail(`${asset}: MIME salah (${type || 'kosong'}), kemungkinan menerima HTML fallback`)
    else pass(`${asset}: HTTP ${response.status} · ${type}`)
  }
}

for (const asset of ['/sw.js', '/registerSW.js', '/manifest.webmanifest']) {
  const response = await fetchChecked(new URL(`${asset}?${nonce}`, base), asset)
  if (!response) continue
  cacheIsFreshSafe(response, asset)
  const type = response.headers.get('content-type') || ''
  if (asset.endsWith('.webmanifest') ? !/manifest\+json|application\/json/i.test(type) : !/javascript/i.test(type)) {
    fail(`${asset}: Content-Type salah (${type || 'kosong'})`)
  }
}

// F-13/F-14 — halaman statis. Tanpa blok ini, `verify:deployment` tetap hijau walau
// alamat yang salah dibalas index.html dengan HTTP 200 (persis yang terjadi pada 2.3.2:
// `curl -sI` 404, tetapi peramban mendapat aplikasi). Karena itu uji di sini memakai
// header `Accept: text/html` seperti peramban sungguhan.
async function expectStatus(url, label, { status, accept, mustContain, mustNotContain } = {}) {
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      redirect: 'manual',
      headers: { 'Cache-Control': 'no-cache, no-store', ...(accept ? { Accept: accept } : {}) },
      signal: AbortSignal.timeout(15_000),
    })
    const body = await response.text()
    const want = status ?? 200
    if (response.status !== want) return fail(`${label}: HTTP ${response.status}, harus ${want}`)
    if (mustContain && !mustContain.test(body)) return fail(`${label}: isi tidak memuat ${mustContain}`)
    if (mustNotContain && mustNotContain.test(body)) return fail(`${label}: isi tidak boleh memuat ${mustNotContain}`)
    return pass(`${label}: HTTP ${response.status}`)
  } catch (error) {
    return fail(`${label}: ${error.message}`)
  }
}

const hilang = `/halaman-tidak-ada-${Date.now()}`
for (const accept of ['text/html,application/xhtml+xml', '*/*', undefined]) {
  await expectStatus(new URL(hilang, base), `404 bermerek (Accept: ${accept ?? 'tanpa header'})`, {
    status: 404,
    accept,
    mustContain: /Halaman ini tidak ada/,
    mustNotContain: /id="root"/,
  })
}
await expectStatus(new URL(`/assets/tidak-ada-${Date.now()}.js`, base), 'aset hilang → 404 polos', {
  status: 404,
  accept: '*/*',
  mustNotContain: /Halaman ini tidak ada/,
})
await expectStatus(new URL('/robots.txt', base), 'robots.txt', { mustContain: /Sitemap:/ })
await expectStatus(new URL('/sitemap.xml', base), 'sitemap.xml', { mustContain: /<urlset/ })

const healthRes = await fetchChecked(new URL(`/healthz?${nonce}`, base), '/healthz')
if (healthRes) {
  let health
  try { health = await healthRes.json() } catch { fail('/healthz bukan JSON valid') }
  if (health) {
    if (health.ok !== true) fail('API healthz tidak ok')
    if (health.version !== build?.version) fail(`versi API ${health.version} tidak sama dengan frontend ${build?.version}`)
    if (health.build?.dirty !== false) fail(`API build dirty=${health.build?.dirty}; rilis harus berasal dari working tree bersih`)
    if (health.build?.revision !== expected) fail(`API revision ${health.build?.revision ?? 'tidak tersedia'}; target ${expected}`)
    if (health.build?.frontendRevision !== expected) fail(`revision frontend yang dibaca API ${health.build?.frontendRevision ?? 'tidak tersedia'}; target ${expected}`)
    if (failures.length === 0) pass(`API ${health.version} · ${health.build?.revision}`)
    for (const [source, status] of Object.entries(health.sources || {})) {
      if (status?.state === 'degraded' || status?.fresh === false) {
        warnings.push(`${source}: ${status.state}${status.fresh === false ? ', memakai data terakhir' : ''}${status.error ? ` — ${status.error}` : ''}`)
      }
    }
    // 2.3.3 — daftar masalah yang dipakai alarm; cetak apa adanya supaya operator tahu
    // apa yang akan berbunyi, bukan hanya "ada peringatan".
    for (const problem of health.health?.problems ?? []) {
      warnings.push(`masalah (${problem.state}): ${problem.id} — ${problem.reason}`)
    }
  }
}

for (const warning of warnings) console.warn(`! Data sumber eksternal: ${warning}`)
if (failures.length) {
  console.error(`\n✗ verifikasi deployment gagal (${failures.length}):`)
  failures.forEach((item) => console.error(`  - ${item}`))
  process.exit(1)
}
console.log('\n✓ Frontend, API, hash aset, revision, dan cache entry-point cocok.')
if (warnings.length) console.log(`! Ada ${warnings.length} status sumber eksternal yang perlu dipantau; ini tidak mengubah lulusnya integritas deploy.`)
