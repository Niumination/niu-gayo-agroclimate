/**
 * Fitur cuaca turunan yang dipakai modul hazard hidrometeorologi (longsor, DAS, angin, karat).
 * Satu fungsi murni untuk klien (JSON Open-Meteo mentah) dan server (array nilai dari server/openMeteo.js),
 * sehingga kedua jalur memakai definisi jendela yang sama (BUG-01: mulai dari jam berjalan, bukan 00:00).
 *
 * @param {object} raw { hourly:{ time[], precipitation[], soil_moisture_0_to_7cm[], wind_speed_10m[], wind_gusts_10m[],
 *   leaf_wetness_probability[], temperature_2m[] }, current:{ time, precipitation, wind_speed_10m, wind_gusts_10m, temperature_2m, relative_humidity_2m },
 *   daily:{ precipitation_sum[] } }
 * @returns {object|null} fitur (null bila deret kosong)
 */
export function weatherFeatures(raw) {
  const hourly = raw?.hourly
  const times = hourly?.time ?? []
  if (!times.length) return null
  const curr = raw.current ?? {}
  const nowIdx = Math.max(0, curr.time ? times.indexOf(curr.time) : -1)
  const arr = (k) => hourly[k] ?? []
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? 0 : Number(v))
  const sumWindow = (k, back) => arr(k).slice(Math.max(0, nowIdx - back + 1), nowIdx + 1).reduce((a, b) => a + num(b), 0)
  const r1 = (v) => Math.round(v * 10) / 10

  const precip = arr('precipitation')
  const rain24 = sumWindow('precipitation', 24)
  const rain72 = sumWindow('precipitation', 72)
  const rainNext24 = precip.slice(nowIdx + 1, nowIdx + 25).reduce((a, b) => a + num(b), 0)
  const peakHourly = Math.max(0, ...precip.slice(Math.max(0, nowIdx - 23), nowIdx + 1).map(num))
  const peakNext24 = Math.max(0, ...precip.slice(nowIdx + 1, nowIdx + 25).map(num))
  const gustsNext24 = arr('wind_gusts_10m').slice(nowIdx, nowIdx + 24).map(num)
  const windNext24 = arr('wind_speed_10m').slice(nowIdx, nowIdx + 24).map(num)

  // Karat daun: jendela 48 jam (leaf wetness ≥ 70 % & suhu 18–25 °C) — definisi identik dengan weatherService M3:
  // slice(start, start+48) dengan start = max(0, nowIdx-47). Tanpa past_days deret mulai 00:00 hari ini, sehingga
  // jendela ini sebagian berisi prakiraan (T-debt, lihat CHANGELOG Sprint 3) — dipertahankan demi paritas kartu.
  const start = Math.max(0, nowIdx - 47)
  const rolling48h = times.slice(start, start + 48).map((t, i) => ({
    leafWetness: num(arr('leaf_wetness_probability')[start + i]),
    temp: arr('temperature_2m')[start + i] ?? null,
  })).filter((h) => h.temp != null)

  // Fase 3.2 H-SUHU — ringkasan termal 3 hari: Tmin/Tmax harian + kondisi malam (19–07 WIB: awan, angin, Td) + VPD siang (09–15 WIB).
  const thermal = thermalSummary(raw, nowIdx)

  return {
    nowTime: curr.time ?? times[nowIdx],
    nowIdx,
    thermal,
    rain24: r1(rain24),
    rain72: r1(rain72),
    rainNext24: r1(rainNext24),
    peakHourly: r1(peakHourly),
    peakNext24: r1(peakNext24),
    dailyRainSum: r1(num(raw.daily?.precipitation_sum?.[0])),
    soilMoisture: num(arr('soil_moisture_0_to_7cm')[nowIdx]),
    wind: num(curr.wind_speed_10m ?? arr('wind_speed_10m')[nowIdx]),
    gust: num(curr.wind_gusts_10m ?? arr('wind_gusts_10m')[nowIdx]),
    gustMaxNext24: gustsNext24.length ? Math.max(...gustsNext24) : 0,
    windMaxNext24: windNext24.length ? Math.max(...windNext24) : 0,
    windDirection: curr.wind_direction_10m ?? null,
    temp: curr.temperature_2m ?? arr('temperature_2m')[nowIdx] ?? null,
    rh: curr.relative_humidity_2m ?? null,
    rolling48h,
  }
}

/**
 * Ringkasan termal per hari (≤ 3 hari) dari deret jam Open-Meteo (temperature_2m, dew_point_2m, cloud_cover, wind_speed_10m,
 * vapour_pressure_deficit) + daily temperature_2m_min/max. Malam hari d = 19:00 (d−1) … 07:00 (d). Fungsi murni; null bila deret kosong.
 */
export function thermalSummary(raw, nowIdx = 0) {
  const hourly = raw?.hourly
  const times = hourly?.time ?? []
  if (!times.length) return null
  const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v))
  const col = (k) => (Array.isArray(hourly[k]) ? hourly[k] : [])
  const temp = col('temperature_2m')
  const dew = col('dew_point_2m')
  const cloud = col('cloud_cover')
  const wind = col('wind_speed_10m')
  const vpd = col('vapour_pressure_deficit')
  const rh = col('relative_humidity_2m')
  const dayKeys = [...new Set(times.map((t) => t.slice(0, 10)))].slice(0, 3)
  const dailyT = raw.daily ?? {}
  const dIdx = (d) => (dailyT.time ?? []).indexOf(d)
  const mean = (arr) => {
    const v = arr.filter((x) => x != null)
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null
  }
  const min = (arr) => {
    const v = arr.filter((x) => x != null)
    return v.length ? Math.min(...v) : null
  }
  const max = (arr) => {
    const v = arr.filter((x) => x != null)
    return v.length ? Math.max(...v) : null
  }
  // VPD dari T & RH (Tetens) bila kolom vapour_pressure_deficit tidak ada
  const vpdAt = (i) => {
    const v = num(vpd[i])
    if (v != null) return v
    const t = num(temp[i])
    const h = num(rh[i])
    if (t == null || h == null) return null
    const es = 0.6108 * Math.exp((17.27 * t) / (t + 237.3))
    return Math.round(es * (1 - h / 100) * 100) / 100
  }
  const days = dayKeys.map((d, k) => {
    const idxOf = (prefix, from, to) => times.map((t, i) => ({ t, i })).filter(({ t }) => t.startsWith(prefix) && Number(t.slice(11, 13)) >= from && Number(t.slice(11, 13)) <= to).map(({ i }) => i)
    const prev = k > 0 ? dayKeys[k - 1] : null
    const nightIdx = [...(prev ? idxOf(prev, 19, 23) : []), ...idxOf(d, 0, 7)]
    const dayIdx = idxOf(d, 9, 15)
    const di = dIdx(d)
    const hourlyMin = min(nightIdx.length ? nightIdx.map((i) => num(temp[i])) : idxOf(d, 0, 23).map((i) => num(temp[i])))
    const hourlyMax = max(idxOf(d, 0, 23).map((i) => num(temp[i])))
    const coldest = nightIdx.length ? nightIdx.reduce((b, i) => (num(temp[i]) != null && (b == null || num(temp[i]) < num(temp[b])) ? i : b), null) : null
    return {
      date: d,
      tmin: di >= 0 ? num(dailyT.temperature_2m_min?.[di]) ?? hourlyMin : hourlyMin,
      tmax: di >= 0 ? num(dailyT.temperature_2m_max?.[di]) ?? hourlyMax : hourlyMax,
      night: {
        hours: nightIdx.length,
        cloudMean: mean(nightIdx.map((i) => num(cloud[i]))),
        windMean: mean(nightIdx.map((i) => num(wind[i]))),
        dewMin: min(nightIdx.map((i) => num(dew[i]))),
        coldestTime: coldest != null ? times[coldest] : null,
        cloudAtColdest: coldest != null ? num(cloud[coldest]) : null,
        windAtColdest: coldest != null ? num(wind[coldest]) : null,
        dewAtColdest: coldest != null ? num(dew[coldest]) : null,
      },
      day: { vpdMean: mean(dayIdx.map((i) => vpdAt(i))), vpdMax: max(dayIdx.map((i) => vpdAt(i))), rhMin: min(dayIdx.map((i) => num(rh[i]))) },
      partial: k === 0 && nowIdx > 7,
    }
  })
  return { days, hasDew: dew.some((v) => v != null), hasCloud: cloud.some((v) => v != null), hasVpd: vpd.some((v) => v != null) }
}
