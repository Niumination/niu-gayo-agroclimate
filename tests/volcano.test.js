/**
 * Fase 2.2b H-VULKANIK — parser MAGMA (fixture HTML), fallback nilai terakhir, geometri sektor bawah angin,
 * level per jarak, modul registry `vulkanik`, laporan `abu`/`gas`.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { parseMagmaLevels, findVolcano, getVolcanoStatus, fetchSummitWind, readOverride, RADIUS_BY_LEVEL } from '../server/magma.js'
import volcanoMod, { bearingDeg, angleDiff, downwindSentra, levelForDistance } from '../src/domain/hazards/volcano.js'
import { BURNI_TELONG } from '../src/domain/geo.js'
import { LOCATIONS } from '../src/data/locations.js'
import { validateReport } from '../server/reports.js'
import { VOLCANO } from '../src/domain/thresholds.js'

const HTML = fs.readFileSync(new URL('./fixtures/hazards/magma-tingkat-aktivitas.html', import.meta.url), 'utf8')
const NOW = '2026-10-15T12:00:00Z'
const TAKENGON = LOCATIONS.find((l) => l.id === 'takengon')

test('parseMagmaLevels: fixture 14 Okt 2026 → Bur Ni Telong Level II (Waspada) + hitungan per level', () => {
  const p = parseMagmaLevels(HTML)
  assert.equal(p.ok, true)
  const v = findVolcano(p)
  assert.equal(v.name, 'Bur Ni Telong')
  assert.equal(v.region, 'Aceh')
  assert.equal(v.level, 2)
  assert.equal(v.label, 'Waspada')
  assert.match(v.reportUrl, /gunung-api\/laporan\/\d+/)
  assert.ok(p.counts[2] >= 15, `Level II: ${p.counts[2]}`)
  assert.ok(Object.keys(p.volcanoes).length >= 20)
  assert.ok(findVolcano(p, 'merapi') || findVolcano(p, 'semeru'))
  assert.equal(parseMagmaLevels('<html>tidak ada tabel</html>').ok, false)
  assert.equal(parseMagmaLevels(null).ok, false)
})

test('getVolcanoStatus: parse OK → simpan nilai terakhir; HTML berubah → degraded + fallback stale; angin opsional', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'volcano-'))
  const file = path.join(dir, 'last.json')
  const windJson = async () => ({ current: { time: '2026-10-15T19:00', wind_speed_10m: 8, wind_direction_10m: 90 }, hourly: { time: ['2026-10-15T19:00'], wind_speed_10m: [8], wind_direction_10m: [90], wind_speed_850hPa: [20], wind_direction_850hPa: [100] } })
  const ok = await getVolcanoStatus({ fetchText: async () => HTML, fetchJson: windJson, lastGoodFile: file, now: NOW })
  assert.equal(ok.degraded, false)
  assert.equal(ok.volcano.level, 2)
  assert.equal(ok.volcano.radiusKm, RADIUS_BY_LEVEL[2])
  assert.equal(ok.wind.dir850, 100)
  assert.ok(Array.isArray(ok.downwind) && ok.downwind.length === LOCATIONS.length)
  assert.ok(fs.existsSync(file))
  const broken = await getVolcanoStatus({ fetchText: async () => '<html><body>maintenance</body></html>', fetchJson: windJson, lastGoodFile: file, now: NOW })
  assert.equal(broken.degraded, true)
  assert.equal(broken.stale, true)
  assert.equal(broken.volcano.level, 2, 'fallback nilai terakhir')
  const noWind = await getVolcanoStatus({ fetchText: async () => HTML, fetchJson: async () => { throw new Error('HTTP 500') }, lastGoodFile: file, now: NOW })
  assert.equal(noWind.volcano.level, 2)
  assert.equal(noWind.wind, null)
  assert.match(noWind.error, /angin/)
  assert.equal(noWind.downwind.every((d) => d.inSector === false), true)
  const none = await getVolcanoStatus({ fetchText: async () => { throw new Error('HTTP 403') }, fetchJson: windJson, lastGoodFile: path.join(dir, 'none.json'), now: NOW })
  assert.equal(none.volcano, null)
  assert.equal(none.degraded, true)
  const w = await fetchSummitWind({ fetchJson: windJson })
  assert.equal(w.dir10m, 90)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('getVolcanoStatus: override manual (VOLCANO_OVERRIDE_PATH) — dipakai saat parser gagal, atau selalu bila force', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'volcano-ovr-'))
  const file = path.join(dir, 'last.json')
  const ovr = path.join(dir, 'override.json')
  const windJson = async () => ({ current: { time: '2026-10-15T19:00', wind_speed_10m: 8, wind_direction_10m: 90 }, hourly: { time: ['2026-10-15T19:00'], wind_speed_10m: [8], wind_direction_10m: [90] } })
  fs.writeFileSync(ovr, JSON.stringify({ burniTelong: { level: 'III', asOf: '2026-10-14', source: 'rilis PVMBG uji' } }))
  assert.deepEqual(readOverride(ovr).level, 3)
  assert.equal(readOverride(path.join(dir, 'tidak-ada.json')), null)
  fs.writeFileSync(path.join(dir, 'bad.json'), JSON.stringify({ burniTelong: { level: 'IX' } }))
  assert.equal(readOverride(path.join(dir, 'bad.json')), null, 'level tidak valid diabaikan')
  // parser OK + override tanpa force → nilai halaman dipakai
  const ok = await getVolcanoStatus({ fetchText: async () => HTML, fetchJson: windJson, lastGoodFile: file, overridePath: ovr, now: NOW })
  assert.equal(ok.volcano.level, 2)
  assert.equal(ok.overridden, undefined)
  // parser gagal + override → override dipakai, tidak degraded, tidak stale
  const broken = await getVolcanoStatus({ fetchText: async () => '<html>maintenance</html>', fetchJson: windJson, lastGoodFile: file, overridePath: ovr, now: NOW })
  assert.equal(broken.volcano.level, 3)
  assert.equal(broken.volcano.label, 'Siaga')
  assert.equal(broken.volcano.radiusKm, RADIUS_BY_LEVEL[3])
  assert.equal(broken.overridden, true)
  assert.equal(broken.degraded, false)
  assert.equal(broken.volcano.override.source, 'rilis PVMBG uji')
  // force → menimpa hasil parser yang sukses
  fs.writeFileSync(ovr, JSON.stringify({ burniTelong: { level: 4, force: true } }))
  const forced = await getVolcanoStatus({ fetchText: async () => HTML, fetchJson: windJson, lastGoodFile: file, overridePath: ovr, now: NOW })
  assert.equal(forced.volcano.level, 4)
  assert.equal(forced.overridden, true)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('geometri: bearing, selisih sudut, sektor bawah angin ±30° ≤ 30 km', () => {
  assert.ok(Math.abs(bearingDeg(0, 0, 1, 0) - 0) < 0.01, 'utara')
  assert.ok(Math.abs(bearingDeg(0, 0, 0, 1) - 90) < 0.01, 'timur')
  assert.ok(Math.abs(bearingDeg(0, 0, -1, 0) - 180) < 0.01, 'selatan')
  assert.equal(angleDiff(350, 10), 20)
  assert.equal(angleDiff(0, 180), 180)
  // Takengon terletak ±S/SSE dari puncak Burni Telong (bearing ≈ 170°). Angin DARI utara (0°) → kepulan KE selatan → Takengon di sektor.
  const fromNorth = downwindSentra({ windFromDeg: 0, locations: LOCATIONS })
  const tk = fromNorth.find((d) => d.id === 'takengon')
  assert.ok(tk.distKm > 10 && tk.distKm < 20, `jarak ${tk.distKm}`)
  assert.ok(tk.bearing > 150 && tk.bearing < 200, `bearing ${tk.bearing}`)
  assert.equal(tk.inSector, true)
  // Angin DARI selatan → kepulan ke utara → tidak ada sentra (semua di selatan puncak)
  const fromSouth = downwindSentra({ windFromDeg: 180, locations: LOCATIONS })
  assert.equal(fromSouth.filter((d) => d.inSector).length, 0)
  // Tanpa arah angin → tidak ada sektor
  assert.equal(downwindSentra({ windFromDeg: null, locations: LOCATIONS }).some((d) => d.inSector), false)
  // Jauh (> 30 km) tidak pernah di sektor
  const far = downwindSentra({ windFromDeg: 0, locations: [{ id: 'x', name: 'x', lat: BURNI_TELONG.lat - 0.5, lon: BURNI_TELONG.lon }] })
  assert.equal(far[0].inSector, false)
  assert.equal(VOLCANO.sectorHalfAngle, 30)
})

test('levelForDistance: Level I–IV × jarak (≤ 30 penuh, 30–60 turun satu, > 60 informasi)', () => {
  assert.equal(levelForDistance(1, 10), 'rendah')
  assert.equal(levelForDistance(2, 10), 'waspada')
  assert.equal(levelForDistance(3, 10), 'bahaya')
  assert.equal(levelForDistance(4, 10), 'ekstrem')
  assert.equal(levelForDistance(4, 45), 'bahaya')
  assert.equal(levelForDistance(2, 45), 'rendah')
  assert.equal(levelForDistance(4, 90), 'rendah')
  assert.equal(levelForDistance(0, 5), 'n/a')
})

function doc(level, { windFrom = 0, stale = false } = {}) {
  const downwind = downwindSentra({ windFromDeg: windFrom, locations: LOCATIONS })
  return { retrievedAt: NOW, degraded: stale, stale, pageUrl: 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas', volcano: { name: 'Bur Ni Telong', level, label: ['', 'Normal', 'Waspada', 'Siaga', 'Awas'][level], roman: ['', 'I', 'II', 'III', 'IV'][level], radiusKm: RADIUS_BY_LEVEL[level], reportUrl: 'https://magma.esdm.go.id/v1/gunung-api/laporan/1', summit: { lat: BURNI_TELONG.lat, lon: BURNI_TELONG.lon } }, wind: { dir10m: windFrom, speed10m: 10, dir850: windFrom, speed850: 25, source: 'test' }, downwind }
}

test('modul vulkanik: Level II → waspada Takengon + flag bawah angin; Level III → bahaya + globalBanner; stale → degraded', () => {
  const r2 = volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: doc(2) })
  assert.equal(r2.level, 'waspada')
  assert.equal(r2.flags.downwind, true)
  assert.equal(r2.flags.globalBanner, false)
  assert.match(r2.headline, /Waspada/)
  assert.match(r2.headline, /sentra berada di jalur yang berpotensi terdampak abu/)
  assert.match(r2.detail, /di bawah angin/)
  assert.match(r2.advice.umum[0], /sektor bawah angin/)
  assert.ok(r2.sources.some((s) => s.kind === 'official'))
  assert.equal(r2.flags.eventId, 'magma-level-2')
  const r3 = volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: doc(3, { windFrom: 180 }) })
  assert.equal(r3.level, 'bahaya')
  assert.equal(r3.flags.globalBanner, true)
  assert.equal(r3.flags.downwind, false)
  assert.ok(r3.advice.kebun.some((a) => /abu/.test(a)))
  const r4 = volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: doc(4) })
  assert.equal(r4.level, 'ekstrem')
  const r1 = volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: doc(1) })
  assert.equal(r1.level, 'rendah')
  const jagong = LOCATIONS.find((l) => l.id === 'jagongjeget') // ±43 km dari puncak → turun satu tingkat
  const rFar = volcanoMod.evaluate({ location: jagong, now: NOW, volcano: doc(3) })
  assert.equal(rFar.level, 'waspada')
  const stale = volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: doc(2, { stale: true }) })
  assert.equal(stale.degraded, true)
  assert.match(stale.headline, /informasi terakhir/)
  assert.equal(volcanoMod.evaluate({ location: TAKENGON, now: NOW, volcano: { volcano: null, degraded: true } }).level, 'n/a')
  assert.equal(volcanoMod.evaluate({}).level, 'n/a')
})

test('laporan warga abu/gas (FR-VULK-4): wajib kind yang valid', () => {
  assert.ok(validateReport({ location: 'takengon', type: 'abu', kind: 'tipis' }).report)
  assert.match(validateReport({ location: 'takengon', type: 'abu' }).error, /kind/)
  assert.match(validateReport({ location: 'takengon', type: 'abu', kind: 'x' }).error, /tipis \| tebal/)
  assert.equal(validateReport({ location: 'takengon', type: 'gas', kind: 'menyengat' }).report.kind, 'menyengat')
  assert.match(validateReport({ location: 'takengon', type: 'gas', kind: 'parah' }).error, /ringan \| menyengat/)
})
