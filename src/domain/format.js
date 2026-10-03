/** Fungsi murni format tampilan. */

/** BUG-01/02 fix: potong hourly mulai jam berjalan (index current.time), ambil n jam. */
export function sliceHourlyFromCurrent(data, n = 12) {
  const hourly = data.hourly ?? {}
  const times = hourly.time ?? []
  const currentTime = data.current?.time
  let start = 0
  if (currentTime) {
    const idx = times.findIndex((t) => t === currentTime)
    if (idx >= 0) start = idx
  }
  return times.slice(start, start + n).map((t, i) => {
    const idx = start + i
    return {
      time: t.split('T')[1].slice(0, 5),
      temp: hourly.temperature_2m?.[idx],
      rain: hourly.precipitation?.[idx],
      solar: hourly.direct_normal_irradiance?.[idx] ?? 0,
      gusts: hourly.wind_gusts_10m?.[idx],
      leafWetness: hourly.leaf_wetness_probability?.[idx],
    }
  })
}

/** BUG-02 fix: solarRad jam berjalan, bukan hourly[0] (tengah malam). */
export function currentSolarRad(data) {
  const hourly = data.hourly ?? {}
  const times = hourly.time ?? []
  const idx = data.current?.time ? times.findIndex((t) => t === data.current.time) : -1
  const i = idx >= 0 ? idx : 0
  return hourly.direct_normal_irradiance?.[i] ?? 0
}

/** BUG-03 fix: timestamp dari current.time API. */
export function apiTimestamp(data) {
  const t = data.current?.time
  if (!t) return null
  return t.split('T')[1].slice(0, 5)
}
