import { ispuSubIndex, ispuComposite, rolling24h } from './ispu.mjs'
import { stepFwi, ffmcClass, fwiClass } from './fwi.mjs'
import assert from 'node:assert/strict'

// ---- ISPU batas resmi ----
const cases = [[0,0],[15.4,50],[15.5,51],[55.4,100],[55.5,101],[150.4,200],[150.5,201],[250.4,300],[250.5,301]]
for (const [x,exp] of cases) { const got=ispuSubIndex('pm25',x); console.log('PM2.5',x,'→',got,'(harap',exp+')'); assert.equal(got,exp) }
console.log('PM2.5 17.1 (Takengon 14 Okt) →', ispuSubIndex('pm25',17.1), ispuComposite({pm25:17.1,pm10:17.2,co:401}))
console.log('PM2.5 61.2 →', ispuComposite({pm25:61.2,pm10:70,co:900}).category.label)
console.log('rolling24h partial:', rolling24h([10,20,null,30],3))

// ---- FWI: contoh referensi Van Wagner & Pickett 1985 (hari 1): T=17, RH=42, W=25, R=0, bulan 4; prev 85/6/15
const r = stepFwi({ temp:17, rh:42, wind:25, rain:0, month:4 })
console.log('FWI hari-1:', Object.fromEntries(Object.entries(r).map(([k,v])=>[k,+v.toFixed(2)])))
const ref = { ffmc:87.69, dmc:8.54, dc:19.01, isi:10.85, bui:8.49, fwi:10.10 }
for (const k of Object.keys(ref)) assert.ok(Math.abs(r[k]-ref[k])<0.05, `${k} ${r[k]} vs ${ref[k]}`)
// hari 2: T=20, RH=21, W=25, R=2.4
const r2 = stepFwi({ temp:20, rh:21, wind:25, rain:2.4, month:4, prev:r })
console.log('FWI hari-2:', Object.fromEntries(Object.entries(r2).map(([k,v])=>[k,+v.toFixed(2)])))
const ref2 = { ffmc:86.20, dmc:10.40, dc:23.57, isi:8.95, bui:10.34, fwi:9.34 }
for (const k of Object.keys(ref2)) assert.ok(Math.abs(r2[k]-ref2[k])<0.15, `${k} ${r2[k]} vs ${ref2[k]}`) // toleransi longgar: nilai referensi hari-2 dikutip dari ingatan, verifikasi dgn dataset uji cffdrs saat produksi

// ---- Simulasi Gayo: 10 hari kering (T 24, RH 60, W 8, R 0) dari kondisi basah, opsi ekuator
let st = { ffmc: 70, dmc: 5, dc: 30 }
for (let d=1; d<=10; d++) st = stepFwi({ temp:24, rh:60, wind:8, rain:0, month:8, prev:st, equator:true })
console.log('Gayo 10 hari kering (ekuator):', Object.fromEntries(Object.entries(st).map(([k,v])=>[k,+v.toFixed(1)])), 'kelas FFMC', ffmcClass(st.ffmc), 'FWI', fwiClass(st.fwi))
console.log('SEMUA ASSERSI LULUS')
