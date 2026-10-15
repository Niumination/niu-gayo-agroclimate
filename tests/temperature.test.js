// Fase 3.1/3.2 — SPI (gamma McKee), VPD siang, stres dingin/embun upas & panas/aborsi bunga, modul registry `suhu`, thermalSummary.
import test from 'node:test'
import assert from 'node:assert/strict'
import { coldStress, heatStress, isFloweringMonth } from '../src/domain/hazards/temperature.js'
import temperature from '../src/domain/hazards/temperature.js'
import { thermalSummary, weatherFeatures } from '../src/domain/hazards/features.js'
import { gammaP, normInv, fitGamma, spiValue, spiClass, computeSpi, recentTotal, loadSpiBaseline, SPI_BASELINE_FILE } from '../server/spi.js'
import { vpdDaytime, assessDrought } from '../src/domain/hazards/drought.js'
import drought from '../src/domain/hazards/drought.js'
import { LOCATIONS } from '../src/data/locations.js'

test('coldStress: ambang 10/6/4 + syarat embun upas (cerah, tenang, Td ≤ 2) + koreksi elevasi ≥ 1.400 m', () => {
  assert.equal(coldStress({ tmin: 12 }).level, 'rendah')
  assert.equal(coldStress({ tmin: 10 }).level, 'waspada')
  assert.equal(coldStress({ tmin: 6 }).level, 'bahaya')
  // 4 °C tetapi berawan → bahaya, bukan ekstrem
  assert.equal(coldStress({ tmin: 4, cloudCover: 70, windSpeed: 2, dewPoint: 1 }).level, 'bahaya')
  const frost = coldStress({ tmin: 3.5, cloudCover: 10, windSpeed: 3, dewPoint: 0.5 })
  assert.equal(frost.level, 'ekstrem')
  assert.equal(frost.frost, true)
  assert.ok(frost.reasons.some((r) => /cerah/.test(r)))
  // Jagong Jeget 1.450 m: Tmin model 4,8 → dikoreksi 3,8 → memenuhi syarat embun upas
  const jj = coldStress({ tmin: 4.8, cloudCover: 5, windSpeed: 4, dewPoint: -1, elevation: 1450 })
  assert.equal(jj.tminAdj, 3.8)
  assert.equal(jj.elevationAdjusted, true)
  assert.equal(jj.level, 'ekstrem')
  // Takengon 1.200 m dengan Tmin sama → tidak dikoreksi → bahaya saja
  const tk = coldStress({ tmin: 4.8, cloudCover: 5, windSpeed: 4, dewPoint: -1, elevation: 1200 })
  assert.equal(tk.level, 'bahaya')
  assert.equal(coldStress({ tmin: null }).level, 'n/a')
})

test('heatStress: 28/30/32 + VPD > 0,82 saat fase bunga menaikkan 1 tingkat', () => {
  assert.equal(heatStress({ tmax: 27.9 }).level, 'rendah')
  assert.equal(heatStress({ tmax: 28 }).level, 'waspada')
  assert.equal(heatStress({ tmax: 30 }).level, 'bahaya')
  assert.equal(heatStress({ tmax: 32 }).level, 'ekstrem')
  const f = heatStress({ tmax: 28.5, vpd: 1.1, flowering: true })
  assert.equal(f.level, 'bahaya')
  assert.equal(f.vpdBump, true)
  assert.equal(heatStress({ tmax: 28.5, vpd: 1.1, flowering: false }).level, 'waspada')
  assert.equal(heatStress({ tmax: 25, vpd: 1.5, flowering: true }).level, 'rendah') // VPD tidak menaikkan dari rendah
  assert.equal(heatStress({ tmax: 32, vpd: 1.5, flowering: true }).level, 'ekstrem')
  assert.equal(isFloweringMonth(2), true)
  assert.equal(isFloweringMonth(11), false)
})

function mkRaw({ tminNight = 8, cloud = 10, wind = 2, dew = 1, tmaxDay = 24, vpd = 0.5 } = {}) {
  const time = []
  const temperature_2m = []
  const cloud_cover = []
  const wind_speed_10m = []
  const dew_point_2m = []
  const vapour_pressure_deficit = []
  const relative_humidity_2m = []
  for (let d = 0; d < 3; d++) for (let h = 0; h < 24; h++) {
    time.push(`2026-10-${15 + d}T${String(h).padStart(2, '0')}:00`)
    const night = h <= 7 || h >= 19
    temperature_2m.push(night ? tminNight + (h === 5 ? 0 : 2) : tmaxDay - (h === 14 ? 0 : 3))
    cloud_cover.push(cloud)
    wind_speed_10m.push(wind)
    dew_point_2m.push(dew)
    vapour_pressure_deficit.push(night ? 0.1 : vpd)
    relative_humidity_2m.push(night ? 95 : 60)
  }
  return { current: { time: '2026-10-15T10:00', temperature_2m: 20, relative_humidity_2m: 70 }, hourly: { time, temperature_2m, cloud_cover, wind_speed_10m, dew_point_2m, vapour_pressure_deficit, relative_humidity_2m, precipitation: time.map(() => 0), wind_gusts_10m: time.map(() => 5), leaf_wetness_probability: time.map(() => 0), soil_moisture_0_to_7cm: time.map(() => 0.3) }, daily: { time: ['2026-10-15', '2026-10-16', '2026-10-17'], temperature_2m_min: [tminNight, tminNight, tminNight], temperature_2m_max: [tmaxDay, tmaxDay, tmaxDay], precipitation_sum: [0, 0, 0] } }
}

test('thermalSummary: 3 hari, malam 19–07, VPD siang; weatherFeatures.thermal terisi', () => {
  const raw = mkRaw({ tminNight: 5, cloud: 20, wind: 3, dew: 0, tmaxDay: 29, vpd: 1.2 })
  const th = thermalSummary(raw, 10)
  assert.equal(th.days.length, 3)
  assert.equal(th.days[0].tmin, 5)
  assert.equal(th.days[1].night.hours, 13) // 19–23 (5 jam) + 00–07 (8 jam)
  assert.equal(th.days[0].night.hours, 8) // hari pertama tanpa malam sebelumnya
  assert.equal(th.days[1].night.cloudMean, 20)
  assert.equal(th.days[1].night.dewAtColdest, 0)
  assert.equal(th.days[0].day.vpdMean, 1.2)
  assert.equal(th.hasDew, true)
  const w = weatherFeatures(raw)
  assert.ok(w.thermal?.days?.length === 3)
  assert.equal(thermalSummary({ hourly: { time: [] } }), null)
  // tanpa kolom VPD → hitung dari T & RH (Tetens)
  const raw2 = mkRaw()
  delete raw2.hourly.vapour_pressure_deficit
  const th2 = thermalSummary(raw2, 10)
  assert.ok(th2.days[0].day.vpdMean > 0.5 && th2.days[0].day.vpdMean < 1.5)
  assert.equal(th2.hasVpd, false)
})

test('modul suhu: embun upas di Jagong Jeget (ekstrem), panas + VPD saat bunga (bahaya), kisaran aman (rendah), kontrak', () => {
  const jj = LOCATIONS.find((l) => l.id === 'jagongjeget')
  const cold = temperature.evaluate({ location: jj, now: '2026-07-20T00:00:00Z', weather: weatherFeatures(mkRaw({ tminNight: 4.5, cloud: 5, wind: 2, dew: -1, tmaxDay: 22 })) })
  assert.equal(cold.level, 'ekstrem')
  assert.equal(cold.flags.frost, true)
  assert.equal(cold.flags.dominant, 'cold')
  assert.match(cold.headline, /embun upas/i)
  assert.ok(cold.advice.kebun.some((t) => /EMBUN UPAS/.test(t)))
  assert.equal(cold.flags.elevationAdjusted, true)
  const tk = LOCATIONS.find((l) => l.id === 'takengon')
  const heat = temperature.evaluate({ location: tk, now: '2026-02-10T03:00:00Z', weather: weatherFeatures(mkRaw({ tminNight: 16, cloud: 30, wind: 5, dew: 14, tmaxDay: 29, vpd: 1.3 })) })
  assert.equal(heat.level, 'bahaya')
  assert.equal(heat.flags.flowering, true)
  assert.equal(heat.flags.dominant, 'heat')
  assert.match(heat.detail, /VPD siang 1.3 kPa/)
  const ok = temperature.evaluate({ location: tk, now: '2026-10-15T03:00:00Z', weather: weatherFeatures(mkRaw({ tminNight: 15, tmaxDay: 24 })) })
  assert.equal(ok.level, 'rendah')
  assert.deepEqual(ok.advice, {})
  assert.equal(temperature.evaluate({ location: tk, weather: {} }).level, 'n/a')
  assert.ok(ok.metrics.find((m) => m.key === 'elevation').value === 1200)
})

test('fungsi khusus: gammaP, normInv, fitGamma & SPI pada distribusi sintetis', () => {
  assert.ok(Math.abs(gammaP(1, 1) - (1 - Math.exp(-1))) < 1e-9)
  assert.ok(Math.abs(gammaP(2.5, 3) - 0.6937) < 1e-3)
  assert.ok(Math.abs(normInv(0.5)) < 1e-9)
  assert.ok(Math.abs(normInv(0.975) - 1.95996) < 1e-4)
  assert.ok(Math.abs(normInv(0.02) + 2.05375) < 1e-4)
  const sample = [120, 150, 90, 200, 110, 130, 170, 95, 140, 160, 125, 135, 105, 180, 115, 145, 155, 100, 190, 128]
  const fit = fitGamma(sample)
  assert.ok(fit.alpha > 5 && fit.beta > 0 && fit.q === 0)
  const median = spiValue(135, fit)
  assert.ok(Math.abs(median) < 0.35, `SPI median ≈ 0, dapat ${median}`)
  assert.ok(spiValue(40, fit) < -2)
  assert.ok(spiValue(260, fit) > 2)
  assert.equal(spiClass(-1.2).level, 'waspada')
  assert.equal(spiClass(-1.6).level, 'bahaya')
  assert.equal(spiClass(-2.3).level, 'ekstrem')
  assert.equal(spiClass(0.3).level, 'rendah')
  assert.equal(spiClass(null).level, 'n/a')
  // sampel dengan nol: koreksi q
  const zeros = fitGamma([0, 0, 0, 0, 10, 20, 30, 15, 25, 12, 18, 22])
  assert.ok(Math.abs(zeros.q - 4 / 12) < 1e-9)
  assert.ok(spiValue(0, zeros) < 0)
  assert.equal(fitGamma([1, 2, 3]), null)
})

test('computeSpi: baseline sintetis (Nov basah) → kering 30 hari di November = SPI sangat negatif; tanpa baseline → degraded', () => {
  const monthly = {}
  for (let y = 1991; y <= 2020; y++) for (let m = 1; m <= 12; m++) {
    const jitter = ((y * 7 + m * 13) % 10) * 6 // 0–54 deterministik
    monthly[`${y}-${String(m).padStart(2, '0')}`] = (m === 11 ? 300 : 150) + jitter
  }
  const base = { period: '1991-01-01 → 2020-12-31', years: 30, monthly }
  const time = []
  const precipitation_sum = []
  for (let i = 0; i < 92; i++) {
    const d = new Date(Date.UTC(2026, 8, 1 + i)) // 1 Sep … 1 Des
    time.push(d.toISOString().slice(0, 10))
    precipitation_sum.push(i >= 62 ? 0.2 : 5) // November hampir kering, Sep–Okt normal-ish
  }
  const daily = { time, precipitation_sum, source: time.map(() => 'archive') }
  const spi = computeSpi(daily, base, { today: '2026-12-01' })
  assert.ok(spi.spi1.value < -2, `SPI-1 ${spi.spi1.value}`)
  assert.equal(spi.spi1.level, 'ekstrem')
  assert.equal(spi.spi1.to, '2026-11-30')
  assert.ok(spi.spi3.value < spi.spi1.value + 3)
  assert.equal(spi.level, 'ekstrem')
  assert.equal(computeSpi(daily, null).degraded, true)
  assert.equal(computeSpi(daily, null).spi1, null)
  assert.equal(recentTotal(daily, 30, { today: '2026-12-01' }).days, 30)
  assert.equal(recentTotal({ time: time.slice(0, 10), precipitation_sum: precipitation_sum.slice(0, 10) }, 30), null)
})

test('baseline terversi server/clim/spi-baseline.json: 15 lokasi × 360 bulan, rata-rata tahunan masuk akal (1.500–4.500 mm)', () => {
  const base = loadSpiBaseline(SPI_BASELINE_FILE)
  assert.ok(base, 'server/clim/spi-baseline.json harus ada (scripts/build-spi-baseline.mjs)')
  for (const loc of LOCATIONS) {
    const b = base.locations[loc.id]
    assert.ok(b, loc.id)
    assert.equal(Object.keys(b.monthly).length, 360, loc.id)
    assert.ok(b.annualMeanMm > 1500 && b.annualMeanMm < 4500, `${loc.id}: ${b.annualMeanMm}`)
  }
})

test('vpdDaytime + assessDrought(hourly) + modul kekeringan dengan SPI/VPD', () => {
  const time = []
  const temperature_2m = []
  const relative_humidity_2m = []
  for (let d = 0; d < 10; d++) for (let h = 0; h < 24; h++) {
    time.push(`2026-10-${String(1 + d).padStart(2, '0')}T${String(h).padStart(2, '0')}:00`)
    temperature_2m.push(h >= 9 && h <= 15 ? 27 : 18)
    relative_humidity_2m.push(h >= 9 && h <= 15 ? 50 : 90)
  }
  const v = vpdDaytime({ time, temperature_2m, relative_humidity_2m }, { today: '2026-10-11' })
  assert.equal(v.days, 7)
  assert.ok(v.mean > 1.5 && v.mean < 2.0, `VPD ${v.mean}`) // es(27)=3.57 kPa × 0,5 ≈ 1,78
  assert.equal(v.level, 'bahaya')
  const daily = { time: Array.from({ length: 40 }, (_, i) => `2026-09-${String(1 + (i % 30)).padStart(2, '0')}`).slice(0, 30).concat(Array.from({ length: 10 }, (_, i) => `2026-10-${String(1 + i).padStart(2, '0')}`)), precipitation_sum: Array(40).fill(0.2), et0_fao_evapotranspiration: Array(40).fill(4) }
  const a = assessDrought(daily, { today: '2026-10-11', hourly: { time, temperature_2m, relative_humidity_2m } })
  assert.equal(a.vpd7.level, 'bahaya')
  const r = drought.evaluate({ drought: { assessment: a, spi: { spi1: { value: -1.7, classLabel: 'Sangat kering', classKey: 'severely_dry', level: 'bahaya' }, spi3: { value: -0.9, classLabel: 'Mendekati normal', classKey: 'near_normal', level: 'rendah' }, level: 'bahaya', baseline: { period: '1991–2020' } }, retrievedAt: '2026-10-11T00:00:00Z', source: {} } })
  assert.equal(r.level, 'bahaya')
  assert.equal(r.flags.spiLevel, 'bahaya')
  assert.equal(r.flags.vpdLevel, 'bahaya')
  assert.ok(r.metrics.find((m) => m.key === 'spi1').value === -1.7)
  assert.ok(r.advice.kebun.some((t) => /VPD/.test(t)))
  assert.ok(r.advice.kebun.some((t) => /SPI/.test(t)))
  assert.match(r.detail, /SPI-1 -1.7/)
})
