import React, { useState, useEffect } from 'react'
import Navbar from './components/Navbar'
import DistrictSelector from './components/DistrictSelector'
import MetricCard from './components/MetricCard'
import CoffeeAdvisory from './components/CoffeeAdvisory'
import DisasterWarning from './components/DisasterWarning'
import HourlyForecast from './components/HourlyForecast'
import { LOCATIONS } from './data/locations'
import { getAgroClimateData } from './services/weatherService'

export default function App() {
  const [selectedLocation, setSelectedLocation] = useState(LOCATIONS[0])
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const loadData = async (loc) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getAgroClimateData(loc)
      setData(res)
    } catch (err) {
      setError(err.message || 'Gagal memuat data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData(selectedLocation)
  }, [selectedLocation])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Navbar
        lastUpdated={data?.timestamp}
        onRefresh={() => loadData(selectedLocation)}
        loading={loading}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DistrictSelector
          selectedLocation={selectedLocation}
          onSelectLocation={setSelectedLocation}
        />

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-xl text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Row 1: Metrics Utama */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title="Suhu Udara"
                value={data.current.temp}
                unit="°C"
                subtitle={`Min ${data.daily.minTemp}°C / Max ${data.daily.maxTemp}°C`}
                badge={data.coffee.tempBadge}
                icon="🌡️"
              />
              <MetricCard
                title="Kelembapan (RH)"
                value={data.current.rh}
                unit="%"
                subtitle="Kelembapan Relatif Udara"
                statusColor={data.current.rh > 85 ? 'text-amber-400' : 'text-slate-100'}
                icon="💧"
              />
              <MetricCard
                title="Curah Hujan Saat Ini"
                value={data.current.rain}
                unit="mm/jam"
                subtitle={`Peluang Harian ${data.daily.rainProb}%`}
                statusColor={data.current.rain > 5 ? 'text-cyan-400' : 'text-slate-100'}
                icon="🌧️"
              />
              <MetricCard
                title="Kecepatan Angin"
                value={data.current.wind}
                unit="km/jam"
                subtitle="Kecepatan Angin 10 Meter"
                statusColor={data.current.wind > 20 ? 'text-amber-400' : 'text-slate-100'}
                icon="🌬️"
              />
            </div>

            {/* Row 2: Coffee & Disaster Advisory */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CoffeeAdvisory coffee={data.coffee} />
              <DisasterWarning
                disaster={data.disaster}
                dailyRainSum={data.daily.rainSum}
                location={selectedLocation}
              />
            </div>

            {/* Row 3: Hourly Forecast */}
            <HourlyForecast hourly={data.hourly} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-800/80 bg-slate-950 py-4 text-center text-xs text-slate-500">
        Niu Gayo Agro-Climate &bull; Niumination Ecosystem &bull; Kabupaten Aceh Tengah
      </footer>
    </div>
  )
}
