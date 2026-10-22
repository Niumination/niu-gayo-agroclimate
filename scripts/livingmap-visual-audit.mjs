import puppeteer from 'puppeteer'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.env.BASE || 'http://127.0.0.1:5190/?tampilan=peta-hidup'
const OUT = process.env.OUT || '/home/user/niu-visual-review/living-map-baseline/screenshots'
mkdirSync(OUT, { recursive: true })

const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
const logs = []
page.on('console', (msg) => { if (msg.type() === 'error' || msg.type() === 'warning') logs.push(`${msg.type()}: ${msg.text()}`) })
page.on('pageerror', (err) => logs.push(`pageerror: ${err.message}`))
await page.setViewport({ width: 1440, height: 960, deviceScaleFactor: 1 })
await page.goto(BASE, { waitUntil: 'networkidle2', timeout: 120000 })
await page.waitForSelector('.living-map-shell', { timeout: 120000 })
await page.waitForSelector('.niu-map-svg', { timeout: 120000 })
await new Promise((r) => setTimeout(r, 9000))

const report = await page.evaluate(() => {
  const q = (s) => document.querySelector(s)
  const shell = q('.living-map-shell')
  const credit = q('.lm-map-credit')
  const controls = q('.niu-map-controls')
  const panel = q('.lm-bottom-panel')
  const rect = (el) => (el ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k) => [k, Math.round(el.getBoundingClientRect()[k])])) : null)
  const cs = (el) => (el ? getComputedStyle(el) : null)
  return {
    shell: rect(shell),
    summary: rect(q('.lm-summary')),
    credit: { rect: rect(credit), text: credit?.textContent, background: cs(credit)?.backgroundColor, blur: cs(credit)?.backdropFilter },
    controls: rect(controls),
    controlIdle: controls ? [...controls.querySelectorAll('button')].slice(0, 3).map((b) => ({ label: b.textContent.trim(), bg: getComputedStyle(b).backgroundColor, blur: getComputedStyle(b).backdropFilter, h: Math.round(b.getBoundingClientRect().height), w: Math.round(b.getBoundingClientRect().width) })) : [],
    panel: { rect: rect(panel), maxHeight: cs(panel)?.maxHeight, bg: cs(panel)?.backgroundColor },
    drawer: rect(q('.lm-context')),
    mapPins: document.querySelectorAll('[data-map-pin]').length,
    hazardRows: document.querySelectorAll('[data-hazard-row]').length,
    heading: q('.lm-summary h2')?.textContent,
    summaryText: q('.lm-summary')?.innerText?.slice(0, 220),
    shellHeight: shell?.getBoundingClientRect().height,
    horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }
})

await page.screenshot({ path: `${OUT}/01-idle-1440.png` })

// hover panel bawah (pakai panel musim agar tidak tertutup ringkasan)
const panelBox = await page.$eval('.lm-season-panel', (el) => { const r = el.getBoundingClientRect(); return { x: r.x + r.width - 60, y: r.y + 16 } })
await page.mouse.move(panelBox.x, panelBox.y)
await new Promise((r) => setTimeout(r, 700))
const hovered = await page.evaluate(() => {
  const p = document.querySelector('.lm-season-panel')
  const c = document.querySelector('.niu-map-controls')
  return { maxHeight: getComputedStyle(p).maxHeight, height: Math.round(p.getBoundingClientRect().height), bg: getComputedStyle(p).backgroundColor, controlsBottom: Math.round(c?.getBoundingClientRect().bottom ?? -1), panelTop: Math.round(p.getBoundingClientRect().top), hoverSolid: getComputedStyle(c.querySelector('button')).backgroundColor }
})
await page.screenshot({ path: `${OUT}/02-panel-hover-1440.png` })

// mode panel konteks 1 → 2 → 3
const modes = []
// Panel Mode 2 di-portal ke <body>, jadi node lama terlepas: ambil ulang tiap klik.
const clickModeButton = async () => (await page.$('.lm-context-head button[data-mode]')).click()
for (const expected of ['2', '3', '1']) {
  await clickModeButton()
  await new Promise((r) => setTimeout(r, 500))
  const state = await page.evaluate(() => {
    const d = document.querySelector('.lm-context')
    const r = d.getBoundingClientRect()
    return { mode: d.dataset.mode, width: Math.round(r.width), left: Math.round(r.left), role: d.getAttribute('role'), ariaModal: d.getAttribute('aria-modal'), canvasInert: document.querySelector('.living-map-canvas')?.inert }
  })
  modes.push(state)
  if (expected === '2') {
    const focus = await page.evaluate(() => ({ active: document.activeElement?.getAttribute('aria-label'), bodyOverflow: document.body.style.overflow, scrim: Boolean(document.querySelector('.lm-modal-scrim')) }))
    modes[modes.length - 1].focus = focus
    await page.screenshot({ path: `${OUT}/03-drawer-mode2-1440.png` })
  }
  if (expected === '3') await page.screenshot({ path: `${OUT}/04-drawer-mode3-1440.png` })
  if (expected === '1') await page.screenshot({ path: `${OUT}/05-drawer-mode1-1440.png` })
}

// layer hotspot off
const hotspotBtn = await page.$$('.niu-map-controls button[aria-pressed]')
await hotspotBtn[hotspotBtn.length - 1]?.click()
await new Promise((r) => setTimeout(r, 300))
const layersState = await page.evaluate(() => ({
  buttons: [...document.querySelectorAll('.niu-map-controls button[aria-pressed]')].map((b) => ({ label: b.textContent.trim(), pressed: b.getAttribute('aria-pressed') })),
  hotspotDots: document.querySelectorAll('.niu-map-svg circle[fill="#f97316"]').length,
}))
await page.screenshot({ path: `${OUT}/06-layer-hotspot-off-1440.png` })

// tema Langit
await page.$$eval('header button', (btns) => {
  const b = btns.find((x) => /gelap|langit|tema/i.test(x.getAttribute('aria-label') || x.title || ''))
  if (b) { b.click(); return b.getAttribute('aria-label') }
  return null
})
await new Promise((r) => setTimeout(r, 800))
const themeState = await page.evaluate(() => ({ arah: document.documentElement.dataset.arah, creditBg: getComputedStyle(document.querySelector('.lm-map-credit')).backgroundColor }))
await page.screenshot({ path: `${OUT}/07-dark-1440.png` })

// viewport 1100 dan 900
for (const width of [1100, 900]) {
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 })
  await new Promise((r) => setTimeout(r, 900))
  await page.screenshot({ path: `${OUT}/08-${width}px.png` })
}
const tight = await page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, controls: document.querySelector('.niu-map-controls')?.getBoundingClientRect().toJSON(), controlsInside: (() => { const c = document.querySelector('.niu-map-controls')?.getBoundingClientRect(); const d = document.querySelector('.lm-context')?.getBoundingClientRect(); return c && d ? c.right <= d.left : null })(), summary: document.querySelector('.lm-summary')?.getBoundingClientRect().toJSON(), drawer: document.querySelector('.lm-context')?.getBoundingClientRect().toJSON() }))

// mobile tidak berubah
await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 })
await page.goto((process.env.BASE_MOBILE || 'http://127.0.0.1:5190/'), { waitUntil: 'networkidle2', timeout: 120000 })
await new Promise((r) => setTimeout(r, 3500))
const mobile = await page.evaluate(() => ({ livingMap: Boolean(document.querySelector('.living-map-shell')), tabbar: Boolean(document.querySelector('[role="tablist"]')), bottomNav: Boolean(document.querySelector('nav')), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth }))
await page.screenshot({ path: `${OUT}/09-mobile-390.png` })

writeFileSync(`${OUT}/report.json`, JSON.stringify({ report, hovered, modes, layersState, themeState, tight, mobile, logs }, null, 2))
console.log(JSON.stringify({ report, hovered, modes, layersState, themeState, tight, mobile, logs }, null, 2))
await browser.close()
