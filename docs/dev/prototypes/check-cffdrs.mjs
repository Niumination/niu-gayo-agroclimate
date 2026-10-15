// Verifikasi prototipe FWI terhadap dataset uji resmi 49 hari (Van Wagner & Pickett 1985)
// dengan nilai harapan dari paket R cffdrs (tests/testthat/data/fwi_01.csv).
import { readFileSync } from 'node:fs'
import { stepFwi, setFfmcConstant, FFMC_CONST } from './fwi.mjs'
const rows = readFileSync(new URL('../../../tests/fixtures/hazards/fwi-cffdrs-test_fwi-expected.csv', import.meta.url), 'utf8')
  .trim().split(/\r?\n/).slice(1).map((l) => l.split(',').map(Number))
for (const [label, K] of Object.entries(FFMC_CONST)) {
  setFfmcConstant(K)
  let prev = { ffmc: 85, dmc: 6, dc: 15 }
  const maxDiff = { ffmc: 0, dmc: 0, dc: 0, isi: 0, bui: 0, fwi: 0 }
  for (const r of rows) {
    const [, , , mon, , temp, rh, ws, prec, FFMC, DMC, DC, ISI, BUI, FWI] = r
    const out = stepFwi({ temp, rh, wind: ws, rain: prec, month: mon, prev })
    const exp = { ffmc: FFMC, dmc: DMC, dc: DC, isi: ISI, bui: BUI, fwi: FWI }
    for (const k of Object.keys(exp)) maxDiff[k] = Math.max(maxDiff[k], Math.abs(out[k] - exp[k]))
    prev = out
  }
  console.log(`Konstanta ${label} (${K}): selisih maksimum 49 hari →`, Object.fromEntries(Object.entries(maxDiff).map(([k, v]) => [k, +v.toFixed(3)])))
}
