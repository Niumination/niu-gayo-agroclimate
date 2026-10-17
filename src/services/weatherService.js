/**
 * Service layer (M3): fetch + komposisi analisis domain.
 * Logika risiko murni ada di domain/ — file ini hanya menghubungkan data ke analisis.
 */
import { fetchForecast } from '../api/openMeteo.js'
import { fetchEnsemblePrecip, memberArrays } from '../api/ensemble.js'
import { tempStatus, dryingStatus, leafWetnessRustRisk } from '../domain/coffee.js'
import { landslideScore, watershedIndex, windRisk } from '../domain/disaster.js'
import { rainProbabilities } from '../domain/ensemble.js'
import { sliceHourlyFromCurrent, currentSolarRad, apiTimestamp } from '../domain/format.js'
import { weatherFeatures } from '../domain/hazards/features.js'
import { evaluateAll } from '../domain/hazards/index.js'
import { getHiddenHazards } from '../lib/prefs.js'

function colorForLevel(level) {
  const l = String(level)
  if (l.includes('Bahaya') || l === 'Tinggi' || l.startsWith('Tunda')) return 'text-level-bahaya dark:text-level-bahaya-dark'
  if (l.includes('Waspada') || l === 'Sedang') return 'text-level-waspada dark:text-level-waspada-dark'
  return 'text-level-rendah dark:text-level-rendah-dark'
}

export async function getAgroClimateData(location) {
  const data = await fetchForecast(location)

  const curr = data.current
  const hourly = data.hourly
  const daily = data.daily

  const temp = curr.temperature_2m
  const rh = curr.relative_humidity_2m
  const rain = curr.precipitation
  const wind = curr.wind_speed_10m
  const gust = curr.wind_gusts_10m ?? 0
  const solarRad = currentSolarRad(data)
  const dailyRainSum = daily.precipitation_sum?.[0] || 0

  // --- Agro-kopi (threshold sederhana) ---
  const ts = tempStatus(temp)
  let ds = dryingStatus(rain, solarRad, rh)

  // --- M3: karat daun berbasis leaf wetness rolling 48 jam (skor 0-100) ---
  const nowIdx = hourly.time.indexOf(curr.time)
  const start = nowIdx >= 0 ? nowIdx - 47 : 0
  const rolling48h = hourly.time
    .slice(Math.max(0, start), Math.max(0, start) + 48)
    .map((t, i) => {
      const idx = Math.max(0, start) + i
      return {
        leafWetness: hourly.leaf_wetness_probability?.[idx] ?? 0,
        temp: hourly.temperature_2m?.[idx],
      }
    })
    .filter((h) => h.temp != null)
  const lw = leafWetnessRustRisk(rolling48h)

  // --- M3: longsor — skor gabungan ---
  const idx0 = nowIdx >= 0 ? nowIdx : 0
  const rain24 = (hourly.precipitation || [])
    .slice(Math.max(0, idx0 - 23), idx0 + 1)
    .reduce((a, b) => a + (b ?? 0), 0)
  const rain72 = (hourly.precipitation || [])
    .slice(Math.max(0, idx0 - 71), idx0 + 1)
    .reduce((a, b) => a + (b ?? 0), 0)
  const peakHourly = Math.max(0, ...(hourly.precipitation || []).slice(Math.max(0, idx0 - 23), idx0 + 1))
  const soilNow = hourly.soil_moisture_0_to_7cm?.[idx0] ?? 0
  // F2 (ADR-9): ARI antecedent dari model (upgrade satelit IMERG menunggu Earthdata).
  const ari = { ari24: Math.round(rain24 * 10) / 10, ari72: Math.round(rain72 * 10) / 10, source: 'model-ecmwf' }
  const ls = landslideScore({
    rain24,
    rain72,
    ari,
    soilMoisture: soilNow,
    peakHourly,
    slopeClass: location.slopeClass || 'berbukit',
  })
  ls.ari = ari

  // --- M3: indeks hujan DAS (kartu per lokasi; agregat hulu berbobot ada di /api/alerts) ---
  const das = watershedIndex([{ id: location.id, rain24: dailyRainSum }])

  // --- M3: angin — wind_gusts_10m ---
  const wr = windRisk(wind, gust)

  // --- Ensemble P(hujan>X) — keyakinan kartu (best-effort, gagal = null) ---
  let confidence = null
  try {
    const ens = await fetchEnsemblePrecip(location)
    const probs = rainProbabilities(memberArrays(ens))
    if (probs) {
      confidence = [
        { label: 'P(hujan>25mm/24j)', prob: probs.p25 },
        { label: 'P(hujan>50mm/24j)', prob: probs.p50 },
      ]
    }
  } catch {
    confidence = null // jangan blokir dashboard jika ensemble gagal
  }

  // --- F1 konsensus + F5 nowcast BMKG via proxy server (best-effort, gagal = null) ---
  let consensus = null
  let bmkgNowcast = null
  let disasterHistory = null
  let seasonal = null
  let communityReports = null
  let airQuality = null
  let fireDanger = null
  let drought = null
  let hazardsAll = null
  let quakes = null
  let volcano = null
  let convective = null
  let flood = null
  let externalReports = null
  try {
    const base = import.meta.env.BASE_URL || '/agroclimate/'
    const api = (p) => `${base.replace(/\/$/, '')}/api/${p}`
    const [cRes, bRes, hRes, sRes, aRes, fRes, dRes, qRes, vRes, kRes, gRes, pRes] = await Promise.allSettled([
      fetch(api(`consensus?location=${encodeURIComponent(location.id)}`)),
      fetch(api('bmkg-nowcast')),
      fetch(api(`disaster-history?location=${encodeURIComponent(location.id)}`)),
      fetch(api('seasonal')),
      // H-ASAP (v2 Fase 1) — ISPU estimasi CAMS + proksi kabut asap (best-effort)
      fetch(api(`air-quality?location=${encodeURIComponent(location.id)}`)),
      // H-API (Sprint 2) — FWI harian + hotspot FIRMS + HTH; H-KERING — HTH & neraca air (best-effort)
      fetch(api(`fire-danger?location=${encodeURIComponent(location.id)}`)),
      fetch(api(`drought?location=${encodeURIComponent(location.id)}`)),
      // Fase 2 — gempa BMKG, Burni Telong (MAGMA), konvektif (CAPE/LI), debit GloFAS (best-effort)
      fetch(api(`quakes?location=${encodeURIComponent(location.id)}`)),
      fetch(api('volcano')),
      fetch(api(`convective?location=${encodeURIComponent(location.id)}`)),
      fetch(api('flood')),
      // Fase 2.4b — laporan warga PetaBencana.id (CC BY-NC, best-effort)
      fetch(api('external-reports')),
    ])
    // 1.6b — ringkasan level 15 sentra untuk peta skematik (best-effort)
    const hzAllP = fetch(api('hazards?location=all')).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    if (cRes.status === 'fulfilled' && cRes.value.ok) consensus = await cRes.value.json()
    if (bRes.status === 'fulfilled' && bRes.value.ok) bmkgNowcast = await bRes.value.json()
    // F4 — riwayat bencana per sentra (best-effort)
    if (hRes.status === 'fulfilled' && hRes.value.ok) {
      const hist = await hRes.value.json()
      if (hist?.count > 0) disasterHistory = hist
    }
    // F7 — kalender musiman
    if (sRes.status === 'fulfilled' && sRes.value.ok) seasonal = await sRes.value.json()
    // H-ASAP — payload degraded tetap diteruskan agar kartu bisa menampilkan "tidak tersedia"
    if (aRes.status === 'fulfilled' && aRes.value.ok) airQuality = await aRes.value.json()
    if (fRes.status === 'fulfilled' && fRes.value.ok) fireDanger = await fRes.value.json()
    if (dRes.status === 'fulfilled' && dRes.value.ok) drought = await dRes.value.json()
    if (qRes.status === 'fulfilled' && qRes.value.ok) quakes = await qRes.value.json()
    if (vRes.status === 'fulfilled' && vRes.value.ok) volcano = await vRes.value.json()
    if (kRes.status === 'fulfilled' && kRes.value.ok) convective = await kRes.value.json()
    if (gRes.status === 'fulfilled' && gRes.value.ok) flood = await gRes.value.json()
    if (pRes.status === 'fulfilled' && pRes.value.ok) externalReports = await pRes.value.json()
    // FR-ASAP-5 — dampak asap ke jendela penjemuran (ISPU ≥ 101 atau AOD ≥ 1 & DNI < 300 → "Tunda (asap)")
    const aq = airQuality?.assessment
    if (aq?.ispu) {
      ds = dryingStatus(rain, solarRad, rh, { ispu: aq.ispu.index, aod: aq.measurements?.aod ?? null, dni: solarRad })
    }
    // F8 — laporan warga 7 hari terakhir (best-effort)
    try {
      const rRes = await fetch(api(`reports?location=${encodeURIComponent(location.id)}`))
      if (rRes.ok) communityReports = await rRes.json()
    } catch { /* abaikan */ }
    hazardsAll = await hzAllP
  } catch {
    // jangan blokir dashboard
  }

  // v2 Fase 0 (ADR-12) — registry multi-bahaya: satu ctx, semua modul; hasil terurut level tertinggi dulu.
  // Kartu lama (DisasterWarning/AirQualityCard/...) tetap memakai field lama; HazardPanel memakai `hazards`.
  let hazards
  try {
    hazards = evaluateAll(
      {
        location,
        now: curr.time ?? new Date().toISOString(),
        weather: weatherFeatures(data),
        ari,
        airQuality,
        fireDanger,
        drought,
        bmkgNowcast,
        reports: communityReports?.reports ?? [],
        quakes,
        volcano,
        convective,
        flood,
      },
      { enabled: import.meta.env.VITE_HAZARDS_ENABLED ? String(import.meta.env.VITE_HAZARDS_ENABLED).split(',').map((x) => x.trim()).filter(Boolean) : null, hidden: getHiddenHazards() }
    )
  } catch {
    hazards = null // jangan blokir dashboard
  }

  return {
    timestamp: apiTimestamp(data) ?? new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    current: { temp, rh, rain, wind, gust, solarRad },
    daily: {
      minTemp: daily.temperature_2m_min[0],
      maxTemp: daily.temperature_2m_max[0],
      rainProb: daily.precipitation_probability_max[0],
      rainSum: dailyRainSum,
    },
    hourly: sliceHourlyFromCurrent(data, 12),
    coffee: {
      tempStatus: ts.level,
      tempBadge:
        ts.level === 'Optimal'
          ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
          : ts.level === 'Dingin'
            ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
            : 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30',
      rustRisk: lw.level,
      rustScore: lw.score,
      rustColor: colorForLevel(lw.level),
      rustDesc: lw.description,
      dryingStatus: ds.level,
      dryingColor: colorForLevel(ds.level),
      dryingDesc: ds.desc,
    },
    disaster: {
      landslide: ls,
      das,
      wind: { level: wr, gust },
      confidence,
      // F1 (ADR-8) konsensus multi-model + F5 (ADR-10) nowcast resmi BMKG
      consensus,
      bmkgNowcast,
      // F4 riwayat bencana + F7 kalender musiman + F8 laporan warga
      disasterHistory,
      seasonal,
      communityReports,
      // Kompatibilitas tampilan lama
      landslideRisk: ls.level,
      landslideColor: colorForLevel(ls.level),
      lakeRisk: das.level,
      windRisk: wr,
    },
    // H-ASAP — kualitas udara & kabut asap (null bila API proxy tidak tersedia)
    airQuality,
    // H-API — bahaya kebakaran (FWI + hotspot + HTH) & H-KERING — kekeringan (null bila API proxy tidak tersedia)
    fireDanger,
    drought,
    // v2 Fase 0 — hasil registry multi-bahaya { results[], worst, active[], counts } (null bila evaluasi gagal)
    hazards,
    // 1.6b — ringkasan level 15 sentra dari server (/api/hazards?location=all) untuk peta skematik
    hazardsAll,
    // Fase 2 — payload mentah untuk kartu khusus (gempa, Burni Telong, petir & badai, debit DAS)
    quakes,
    volcano,
    convective,
    flood,
    // Fase 2.4b — laporan warga PetaBencana.id (Gayo, 7 hari) — atribusi wajib CC BY-NC 4.0
    externalReports,
  }
}
