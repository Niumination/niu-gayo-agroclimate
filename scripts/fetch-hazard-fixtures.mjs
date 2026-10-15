#!/usr/bin/env node
// Mengunduh respons nyata dari sumber data multi-bahaya (lihat docs/dev/04-DATA-SOURCES.md)
// dan menyimpannya sebagai fixture di tests/fixtures/hazards/ untuk TDD offline.
// Tanpa dependensi. Jalankan: node scripts/fetch-hazard-fixtures.mjs
// Sumber yang butuh kunci (FIRMS) dilewati bila env FIRMS_MAP_KEY kosong.

import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

const OUT = path.resolve('tests/fixtures/hazards')
const UA = 'niu-gayo-agroclimate/fixtures (+https://cuaca.abstract.biz.id)'
const TAKENGON = { lat: 4.6275, lon: 96.8486 }
const TZ = 'Asia%2FJakarta'
const FIRMS_KEY = process.env.FIRMS_MAP_KEY || ''
const BBOX = '96.1,3.9,97.5,5.2'

function daysAgo(n) {
  const d = new Date(Date.now() - n * 864e5)
  return d.toISOString().slice(0, 10)
}

const SOURCES = [
  {
    file: 'openmeteo-airquality-takengon.json',
    url: `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${TAKENGON.lat}&longitude=${TAKENGON.lon}&domains=cams_global&current=pm2_5,pm10,carbon_monoxide,aerosol_optical_depth,dust,us_aqi,european_aqi&hourly=pm2_5,pm10,carbon_monoxide,aerosol_optical_depth&past_days=1&forecast_days=5&timezone=${TZ}`,
  },
  {
    file: 'openmeteo-forecast-bestmatch-visibility.json',
    url: `https://api.open-meteo.com/v1/forecast?latitude=${TAKENGON.lat}&longitude=${TAKENGON.lon}&hourly=visibility,relative_humidity_2m,cape,direct_normal_irradiance&forecast_days=2&timezone=${TZ}`,
  },
  {
    file: 'openmeteo-gfs-cape-li.json',
    url: `https://api.open-meteo.com/v1/forecast?latitude=${TAKENGON.lat}&longitude=${TAKENGON.lon}&models=gfs_seamless&hourly=cape,lifted_index,convective_inhibition,freezing_level_height&forecast_days=2&timezone=${TZ}`,
  },
  {
    file: 'openmeteo-ecmwf-convective.json',
    url: `https://api.open-meteo.com/v1/forecast?latitude=${TAKENGON.lat}&longitude=${TAKENGON.lon}&models=ecmwf_ifs025&hourly=cape,weather_code,wind_gusts_10m,precipitation,showers,temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_gusts_10m_max&forecast_days=3&timezone=${TZ}`,
  },
  {
    file: 'openmeteo-archive-90d.json',
    url: `https://archive-api.open-meteo.com/v1/archive?latitude=${TAKENGON.lat}&longitude=${TAKENGON.lon}&start_date=${daysAgo(92)}&end_date=${daysAgo(2)}&daily=precipitation_sum,temperature_2m_max,temperature_2m_min,temperature_2m_mean,relative_humidity_2m_mean,wind_speed_10m_max,et0_fao_evapotranspiration&timezone=${TZ}`,
  },
  {
    file: 'openmeteo-flood-peusangan-4cells.json',
    // 4 sel hulu DAS Peusangan: bintang, luttawar, kebayakan, silihnara
    url: `https://flood-api.open-meteo.com/v1/flood?latitude=4.58,4.61,4.65,4.61&longitude=96.95,96.88,96.85,96.72&daily=river_discharge,river_discharge_mean,river_discharge_median,river_discharge_p75,river_discharge_max&past_days=7&forecast_days=7`,
  },
  { file: 'bmkg-autogempa.json', url: 'https://data.bmkg.go.id/DataMKG/TEWS/autogempa.json' },
  { file: 'bmkg-gempadirasakan.json', url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempadirasakan.json' },
  { file: 'bmkg-gempaterkini.json', url: 'https://data.bmkg.go.id/DataMKG/TEWS/gempaterkini.json' },
  {
    file: 'usgs-300km-12mo.geojson',
    url: `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=4.63&longitude=96.85&maxradiuskm=300&minmagnitude=4&starttime=${daysAgo(365)}&orderby=time`,
  },
  { file: 'magma-tingkat-aktivitas.html', url: 'https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas', text: true },
  {
    file: 'petabencana-aceh-7d.geojson',
    url: 'https://api.petabencana.id/reports?admin=ID-AC&timeperiod=604800&geoformat=geojson',
  },
  { file: 'bmkg-nowcast-cap.rss', url: 'https://www.bmkg.go.id/alerts/nowcast/id', text: true },
]

if (FIRMS_KEY) {
  SOURCES.push({
    file: 'firms-viirs-snpp-gayo-2d.csv',
    url: `https://firms.modaps.eosdis.nasa.gov/api/area/csv/${FIRMS_KEY}/VIIRS_SNPP_NRT/${BBOX}/2`,
    text: true,
  })
}

async function fetchOne(src) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 20000)
  try {
    const res = await fetch(src.url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: ctrl.signal })
    const body = await res.text()
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 120)}`)
    let out = body
    if (!src.text) out = JSON.stringify(JSON.parse(body), null, 1) // validasi JSON + rapikan
    await writeFile(path.join(OUT, src.file), out)
    return { file: src.file, ok: true, bytes: Buffer.byteLength(out) }
  } catch (e) {
    return { file: src.file, ok: false, error: e.message }
  } finally {
    clearTimeout(t)
  }
}

await mkdir(OUT, { recursive: true })
const results = await Promise.all(SOURCES.map(fetchOne))
const manifest = {
  fetchedAt: new Date().toISOString(),
  note: 'Fixture respons nyata untuk test offline modul multi-bahaya. Perbarui dengan: node scripts/fetch-hazard-fixtures.mjs',
  results,
}
await writeFile(path.join(OUT, 'MANIFEST.json'), JSON.stringify(manifest, null, 2))
for (const r of results) console.log(r.ok ? `✅ ${r.file} (${r.bytes} B)` : `❌ ${r.file}: ${r.error}`)
if (!FIRMS_KEY) console.log('⏭  FIRMS dilewati (set FIRMS_MAP_KEY untuk mengunduh hotspot nyata)')
