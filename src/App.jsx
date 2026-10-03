import React, { useState, useEffect, useMemo, useCallback } from 'react'
import Navbar from './components/Navbar'
import DistrictSelector from './components/DistrictSelector'
import MetricCard from './components/MetricCard'
import CoffeeAdvisory from './components/CoffeeAdvisory'
import DisasterWarning from './components/DisasterWarning'
import HourlyForecast from './components/HourlyForecast'
import RainChart from './components/RainChart'
import { LOCATIONS } from './data/locations'
import { getAgroClimateData } from './services/weatherService'
import { t } from './i18n/messages'
import { prefs, applyTheme, effectiveTheme } from './lib/prefs'
import { dataAge } from './lib/dataAge'

export default function App() {
  // Persistensi wilayah terpilih (localStorage)
  const [selectedLocation, setSelectedLocation] = useState(() => {
    const savedId = prefs.getLocationId()
    return LOCATIONS.find((l) => l.id === savedId) || LOCATIONS[0]
  })
  const [data, setData] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // i18n
  const [lang, setLang] = useState(() => prefs.getLang() || 'id')
  const tr = useMemo(() => (key) => t(lang, key), [lang])
  useEffect(() => prefs.setLang(lang), [lang])

  // Tema: light/dark/auto (prefers-color-scheme)
  const [theme, setTheme] = useState(() => effectiveTheme())
  const isAuto = prefs.getTheme() == null
  useEffect(() => {
    applyTheme(theme)
  }, [theme])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)')
    const onChange = () => {
      if (prefs.getTheme() == null) setTheme(effectiveTheme())
    }
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  const cycleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    prefs.setTheme(next)
    setTheme(next)
  }
  const resetTheme = () => {
    prefs.setTheme(null)
    setTheme(effectiveTheme())
  }

  // Status offline
  const [offline, setOffline] = useState(() => !navigator.onLine)
  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  // Badge umur data
  const age = useMemo(
    () => dataAge(fetchedAt ? Date.now() - fetchedAt : null),
    [fetchedAt, data]
  )

  const loadData = useCallback(
    async (loc) => {
      setLoading(true)
      setError(null)
      try {
        const res = await getAgroClimateData(loc)
        setData(res)
        setFetchedAt(Date.now())
      } catch (err) {
        setError(err.message || tr('errorLoad'))
      } finally {
        setLoading(false)
      }
    },
    [lang] // eslint-disable-line react-hooks/exhaustive-deps
  )

  useEffect(() => {
    loadData(selectedLocation)
  }, [selectedLocation])

  const onSelectLocation = (loc) => {
    prefs.setLocationId(loc.id)
    setSelectedLocation(loc)
  }

  // Data grafik hujan 24 jam (mm/jam)
  const rainSeries = useMemo(() => {
    if (!data?.hourly) return []
    return data.hourly.slice(0, 24).map((row) => ({ time: row.time, rain: row.rain }))
  }, [data])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar
        lastUpdated={data?.timestamp}
        onRefresh={() => loadData(selectedLocation)}
        loading={loading}
        lang={lang}
        onLangChange={setLang}
        theme={theme}
        isAuto={isAuto}
        onToggleTheme={cycleTheme}
        onResetTheme={resetTheme}
        age={age}
        tr={tr}
      />

      {offline && (
        <div
          role="status"
          className="bg-amber-500/15 border-b border-amber-500/40 text-amber-700 dark:text-amber-300 px-4 py-2 text-xs text-center font-medium"
        >
          {tr('offlineBanner')}
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <DistrictSelector selectedLocation={selectedLocation} onSelectLocation={onSelectLocation} tr={tr} />

        {error && (
          <div
            role="alert"
            className="bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 p-4 rounded-xl text-sm"
          >
            {error}
          </div>
        )}

        {data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <MetricCard
                title={tr('airTemp')}
                value={data.current.temp}
                unit="°C"
                subtitle={`${tr('min')} ${data.daily.minTemp}°C / ${tr('max')} ${data.daily.maxTemp}°C`}
                badge={data.coffee.tempBadge}
                icon="🌡️"
              />
              <MetricCard
                title={tr('humidity')}
                value={data.current.rh}
                unit="%"
                subtitle={tr('humiditySub')}
                statusColor={data.current.rh > 85 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}
                icon="💧"
              />
              <MetricCard
                title={tr('rainNow')}
                value={data.current.rain}
                unit="mm/jam"
                subtitle={`${tr('rainProb')} ${data.daily.rainProb}%`}
                statusColor={data.current.rain > 5 ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-900 dark:text-slate-100'}
                icon="🌧️"
              />
              <MetricCard
                title={tr('windSpeed')}
                value={data.current.wind}
                unit="km/jam"
                subtitle={tr('windSub')}
                statusColor={data.current.wind > 20 ? 'text-amber-500 dark:text-amber-400' : 'text-slate-900 dark:text-slate-100'}
                icon="🌬️"
              />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CoffeeAdvisory coffee={data.coffee} />
              <DisasterWarning
                disaster={data.disaster}
                dailyRainSum={data.daily.rainSum}
                location={selectedLocation}
              />
            </div>

            <div className="bg-slate-900/5 dark:bg-slate-900/70 border border-slate-300 dark:border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
                <div>
                  <h2 className="text-base font-bold">{tr('rainChart')}</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{tr('rainChartSub')}</p>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border font-medium ${
                    age.stale
                      ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                      : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                  }`}
                  title={age.stale ? tr('dataAgeStale') : tr('dataAgeFresh')}
                >
                  {tr('dataAge')}: {age.label} {age.stale ? '⚠' : '✓'}
                </span>
              </div>
              <RainChart data={rainSeries} labelRain={tr('rain')} />
            </div>

            <HourlyForecast hourly={data.hourly} />
          </>
        )}
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-950 py-4 text-center text-xs text-slate-500">
        Niu Gayo Agro-Climate &bull; {tr('footer')}
      </footer>
    </div>
  )
}
