export async function getAgroClimateData(location) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,direct_normal_irradiance&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max&timezone=Asia%2FJakarta&forecast_days=3`

  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`Gagal mengambil data cuaca: HTTP ${resp.status}`)
  }

  const data = await resp.json()
  const curr = data.current
  const hourly = data.hourly
  const daily = data.daily

  const temp = curr.temperature_2m
  const rh = curr.relative_humidity_2m
  const rain = curr.precipitation
  const wind = curr.wind_speed_10m
  const solarRad = hourly.direct_normal_irradiance?.[0] || 0
  const dailyRainSum = daily.precipitation_sum?.[0] || 0

  // Analisis Pertanian Kopi Arabika Gayo
  let tempStatus = 'Optimal (15 - 24°C)'
  let tempBadge = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
  if (temp < 15.0) {
    tempStatus = 'Dingin (Pertumbuhan vegetative melambat)'
    tempBadge = 'bg-blue-500/20 text-blue-400 border-blue-500/30'
  } else if (temp > 24.0) {
    tempStatus = 'Panas (Waspada kematangan ceri prematur & hama PBKo)'
    tempBadge = 'bg-amber-500/20 text-amber-400 border-amber-500/30'
  }

  // Risiko Jamur Karat Daun (Hemileia vastatrix)
  let rustRisk = 'Rendah'
  let rustColor = 'text-emerald-400'
  let rustDesc = 'Kelembapan udara aman, sirkulasi angin memadai.'
  if (rh >= 85 && temp >= 18 && temp <= 25) {
    rustRisk = 'Tinggi'
    rustColor = 'text-rose-400'
    rustDesc = 'Kombinasi RH >85% dan suhu hangat sangat kondusif untuk spora karat daun. Periksa naungan dan sanitasi kebun.'
  } else if (rh >= 75) {
    rustRisk = 'Sedang'
    rustColor = 'text-amber-400'
    rustDesc = 'Kelembapan cukup tinggi, pantau tanaman rentan di area cekungan.'
  }

  // Rekomendasi Penjemuran Kopi (Green Bean / Gabah)
  let dryingStatus = 'Sangat Baik'
  let dryingColor = 'text-emerald-400'
  let dryingDesc = 'Radiasi matahari kuat, tidak ada curah hujan. Penjemuran optimal di para-para.'
  if (rain > 0.1) {
    dryingStatus = 'Hujan - Tutup Terpal'
    dryingColor = 'text-rose-400'
    dryingDesc = 'Hujan sedang turun. Segera amankan kopi ke dalam solar dryer atau tutup kubah plastik.'
  } else if (solarRad < 150 || rh > 80) {
    dryingStatus = 'Kurang Optimal'
    dryingColor = 'text-amber-400'
    dryingDesc = 'Matahari tertutup awan tebal. Balik gabah lebih sering untuk mencegah fermentasi berlebih.'
  }

  // Analisis Mitigasi Bencana Hidrometeorologi
  let landslideRisk = 'Rendah'
  let landslideColor = 'text-emerald-400'
  if (dailyRainSum >= 50.0 || rain >= 15.0) {
    landslideRisk = 'Bahaya Tinggi'
    landslideColor = 'text-rose-400'
  } else if (dailyRainSum >= 25.0 || rain >= 5.0) {
    landslideRisk = 'Waspada'
    landslideColor = 'text-amber-400'
  }

  let lakeRisk = 'Normal'
  if (['luttawar', 'bintang', 'kebayakan', 'takengon'].includes(location.id)) {
    if (dailyRainSum >= 40.0) {
      lakeRisk = 'Waspada Luapan DAS Peusangan'
    }
  }

  let windRisk = 'Normal'
  if (wind >= 35.0) {
    windRisk = 'Bahaya Angin Kencang (Pohon Peneduh Roboh)'
  } else if (wind >= 20.0) {
    windRisk = 'Waspada Angin Kencang'
  }

  return {
    timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
    current: {
      temp,
      rh,
      rain,
      wind,
      solarRad,
    },
    daily: {
      minTemp: daily.temperature_2m_min[0],
      maxTemp: daily.temperature_2m_max[0],
      rainProb: daily.precipitation_probability_max[0],
      rainSum: dailyRainSum,
    },
    hourly: hourly.time.slice(0, 12).map((t, idx) => ({
      time: t.split('T')[1].slice(0, 5),
      temp: hourly.temperature_2m[idx],
      rain: hourly.precipitation[idx],
      solar: hourly.direct_normal_irradiance?.[idx] || 0,
    })),
    coffee: {
      tempStatus,
      tempBadge,
      rustRisk,
      rustColor,
      rustDesc,
      dryingStatus,
      dryingColor,
      dryingDesc,
    },
    disaster: {
      landslideRisk,
      landslideColor,
      lakeRisk,
      windRisk,
    },
  }
}
