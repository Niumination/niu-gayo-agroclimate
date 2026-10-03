import React, { useState, useEffect, useMemo, useCallback } from 'react'
import AppBar from './components/AppBar'
import DesktopHeader from './components/DesktopHeader'
import BottomNav from './components/BottomNav'
import MobileTabShell from './components/MobileTabShell'
import LocationRail from './components/LocationRail'
import InstrumentPanel from './components/InstrumentPanel'
import CoffeeAdvisory from './components/CoffeeAdvisory'
import DisasterWarning from './components/DisasterWarning'
import HourlyForecast from './components/HourlyForecast'
import RainChart from './components/RainChart'
import { LOCATIONS } from './data/locations'
import { getAgroClimateData } from './services/weatherService'
import { t } from './i18n/messages'
import { prefs, applyTheme, effectiveTheme } from './lib/prefs'
import { dataAge } from './lib/dataAge'
import { useBreakpoint } from './lib/useBreakpoint'

export default function App() {
  const isDesktop = useBreakpoint()

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
    // meta theme-color dinamis mengikuti tema
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#1A1512' : '#FAF7F2')
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

  // Tab mobile (state, bukan anchor)
  const [tab, setTab] = useState('now')

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
    if (!isDesktop) setTab('now')
  }

  // Data grafik hujan 24 jam (mm/jam)
  const rainSeries = useMemo(() => {
    if (!data?.hourly) return []
    return data.hourly.slice(0, 24).map((row) => ({ time: row.time, rain: row.rain }))
  }, [data])

  const headerProps = {
    lastUpdated: data?.timestamp,
    onRefresh: () => loadData(selectedLocation),
    loading,
    lang,
    onLangChange: setLang,
    theme,
    isAuto,
    onToggleTheme: cycleTheme,
    onResetTheme: resetTheme,
    age,
    offline,
    tr,
  }

  const rainPanel = data && (
    <section
      aria-label={tr('rainChart')}
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{tr('rainChart')}</h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{tr('rainChartSub')}</p>
      </div>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10">
        <RainChart data={rainSeries} labelRain={tr('rain')} />
      </div>
    </section>
  )

  /* ---------- Konten per tab mobile ---------- */
  const mobileNow = data && (
    <>
      <InstrumentPanel current={data.current} daily={data.daily} location={selectedLocation} tr={tr} />
      <CoffeeAdvisory coffee={data.coffee} tr={tr} />
    </>
  )

  const mobileForecast = data && (
    <>
      {rainPanel}
      <HourlyForecast hourly={data.hourly} tr={tr} variant="mobile" />
    </>
  )

  const mobileRisk = data && (
    <DisasterWarning disaster={data.disaster} dailyRainSum={data.daily.rainSum} location={selectedLocation} tr={tr} />
  )

  const mobileLocations = (
    <LocationRail selectedLocation={selectedLocation} onSelectLocation={onSelectLocation} tr={tr} />
  )

  /* ---------- Layout desktop ---------- */
  const desktopLayout = data && (
    <div className="max-w-shell mx-auto px-8 py-6 anim-enter">
      {/* Grid editorial asimetris 12 kolom */}
      <div className="grid grid-cols-12 gap-8">
        {/* Rail kiri: indeks 15 sentra */}
        <aside className="col-span-3 min-w-0">
          <LocationRail selectedLocation={selectedLocation} onSelectLocation={onSelectLocation} tr={tr} />
        </aside>

        {/* Kolom tengah: instrumen besar + panduan kopi */}
        <div className="col-span-6 min-w-0 space-y-6">
          <InstrumentPanel current={data.current} daily={data.daily} location={selectedLocation} tr={tr} />
          <CoffeeAdvisory coffee={data.coffee} tr={tr} />
        </div>

        {/* Kolom kanan: peringatan + keyakinan ensemble */}
        <div className="col-span-3 min-w-0">
          <DisasterWarning disaster={data.disaster} dailyRainSum={data.daily.rainSum} location={selectedLocation} tr={tr} />
        </div>
      </div>

      {/* Baris bawah lebar penuh, dipisah hairline */}
      <div className="mt-8 pt-6 border-t border-ink/10 dark:border-mist/10 grid grid-cols-12 gap-8">
        <div className="col-span-7 min-w-0">{rainPanel}</div>
        <div className="col-span-5 min-w-0">
          <HourlyForecast hourly={data.hourly} tr={tr} variant="desktop" />
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen flex flex-col">
      {isDesktop ? (
        <DesktopHeader {...headerProps} />
      ) : (
        <AppBar selectedLocation={selectedLocation} {...headerProps} />
      )}

      {error && (
        <div
          role="alert"
          className="mx-4 mt-4 border border-cherry/30 bg-cherry/5 text-cherry-deep dark:text-cherry-soft p-4 rounded-card text-[13px]"
        >
          {error}
        </div>
      )}

      {loading && !data && (
        <p role="status" className="flex-1 grid place-items-center text-[13px] text-ink/50 dark:text-mist/50 py-16">
          {tr('refreshing')}
        </p>
      )}

      {isDesktop ? (
        <main className="flex-1 w-full anim-enter">{desktopLayout}</main>
      ) : (
        <>
          <main className="flex-1 w-full">
            <MobileTabShell active={tab}>
              {tab === 'now' && mobileNow}
              {tab === 'forecast' && mobileForecast}
              {tab === 'risk' && mobileRisk}
              {tab === 'locations' && mobileLocations}
            </MobileTabShell>
          </main>
          <BottomNav active={tab} onChange={setTab} tr={tr} />
        </>
      )}

      <footer className="border-t border-ink/10 dark:border-mist/10 py-4 text-center text-[11px] text-ink/45 dark:text-mist/40">
        Niu Gayo Agro-Climate &bull; {tr('footer')}
      </footer>
    </div>
  )
}
