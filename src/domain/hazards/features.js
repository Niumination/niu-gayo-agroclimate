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

  return {
    nowTime: curr.time ?? times[nowIdx],
    nowIdx,
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
