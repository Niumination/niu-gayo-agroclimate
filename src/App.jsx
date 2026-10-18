import {  useState, useEffect, useMemo, useCallback  } from 'react'
import AppBar from './components/AppBar'
import DesktopHeader from './components/DesktopHeader'
import BottomNav from './components/BottomNav'
import MobileTabShell from './components/MobileTabShell'
import LocationRail from './components/LocationRail'
import RingkasMobile from './pages/RingkasMobile.jsx'
import DesktopBoard from './pages/DesktopBoard.jsx'
import InstallHint from './pwa/InstallHint.jsx'
import CoffeeAdvisory from './components/CoffeeAdvisory'
import DisasterWarning from './components/DisasterWarning'
import AirQualityCard from './components/AirQualityCard'
import FireDangerCard from './components/FireDangerCard'
import DroughtCard from './components/DroughtCard'
import HazardPanel from './components/HazardPanel'
import { StormCard, FloodCard, TemperatureCard, QuakeCard, VolcanoCard, ExternalReportsCard } from './components/HazardFocusCards'
import ClimateBanner from './components/ClimateBanner'
import DisasterHistoryCard from './components/DisasterHistoryCard'
import EmergencyContacts from './components/EmergencyContacts'
import AboutData from './components/AboutData'
import SchematicMap from './components/SchematicMap'
import SeasonalBanner from './components/SeasonalBanner'
import ReportButton from './components/ReportButton'
import HourlyForecast from './components/HourlyForecast'
import RainChart from './components/RainChart'
import { LOCATIONS } from './data/locations'
import { getAgroClimateData } from './services/weatherService'
import { t } from './i18n/messages'
import { prefs, applyTheme, effectiveTheme } from './lib/prefs'
import { dataAge } from './lib/dataAge'
import { useBreakpoint } from './lib/useBreakpoint'
import AppSkeleton, { useDelayedVisible } from './components/Skeleton'
import EmptyState from './components/EmptyState'
import Notice from './components/Notice'

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
  const [errorDetail, setErrorDetail] = useState(null)
  // P2 — pengumuman untuk pembaca layar (WCAG 4.1.3 Status Messages)
  const [liveMsg, setLiveMsg] = useState('')

  // i18n
  const [aboutOpen, setAboutOpen] = useState(false) // FR-X-9 modal "Tentang data & batasan"
  const tr = useMemo(() => (key) => t('id', key), [])

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

  // Status offline + keadaan "kembali daring" (P4)
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [backOnline, setBackOnline] = useState(false)
  // P4 — skeleton hanya muncul setelah 300 ms; muat cepat tidak berkedip (riset R-11)
  const showSkeleton = useDelayedVisible(300)
  // P4 — minta penyimpanan persisten supaya cache offline tidak dibuang sistem (riset R-10)
  useEffect(() => {
    navigator.storage?.persist?.().catch(() => {})
  }, [])
  useEffect(() => {
    const on = () => {
      setOffline(false)
      setBackOnline(true)
    }
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
  const [selHaz, setSelHaz] = useState(null)

  useEffect(() => {
    const zona = new URLSearchParams(window.location.search).get('zona')
    if (zona === 'risiko') setTab('risk')
  }, [])

  // Badge umur data
  const age = useMemo(
    () => dataAge(fetchedAt ? Date.now() - fetchedAt : null),
    [fetchedAt]
  )

  const loadData = useCallback(
    async (loc) => {
      setLoading(true)
      setError(null)
      setErrorDetail(null)
      try {
        const res = await getAgroClimateData(loc)
        setData(res)
        setFetchedAt(Date.now())
        const level = res?.hazards?.worst
        const jam = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
        setLiveMsg(
          level && level !== 'n/a'
            ? `${tr('updated')} ${jam} WIB — ${tr('highestLevel')}: ${level}`
            : `${tr('updated')} ${jam} WIB`
        )
      } catch (err) {
        setError(tr('errorLoad'))
        setErrorDetail(err?.message || null)
      } finally {
        setLoading(false)
      }
    },
    [tr]
  )

  useEffect(() => {
    loadData(selectedLocation)
  }, [selectedLocation, loadData])

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
    theme,
    isAuto,
    onToggleTheme: cycleTheme,
    onResetTheme: resetTheme,
    age,
    tr,
  }

  const rainPanel = data && (
    <section
      aria-label={tr('rainChart')}
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">{tr('rainChart')}</h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">{tr('rainChartSub')}</p>
      </div>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10">
        {rainSeries.length > 0 ? (
          <RainChart data={rainSeries} labelRain={tr('rain')} />
        ) : (
          <EmptyState title={tr('emptyForecast')} hint={tr('emptyHint')} />
        )}
      </div>
    </section>
  )

  /* ---------- Konten per tab mobile ---------- */
  const mobileNow = data && (
    <>
      <RingkasMobile
        current={data.current}
        daily={data.daily}
        location={selectedLocation}
        hazards={data.hazards}
        hourly={data.hourly}
        tr={tr}
        onOpenRisk={() => setTab('risk')}
      />
      {/* H-ASAP (v2 Fase 1) — kabut asap & kualitas udara, tampil di tab utama selama episode karhutla */}
      <AirQualityCard airQuality={data.airQuality} tr={tr} />
      <CoffeeAdvisory coffee={data.coffee} tr={tr} />
      <SeasonalBanner seasonal={data.disaster?.seasonal} tr={tr} />
      {/* 1.9c — konteks iklim ENSO/IOD (BMKG terkurasi) + verifikasi lokal arsip ERA5 */}
      <ClimateBanner drought={data.drought} tr={tr} />
      <div className="flex justify-center">
        <ReportButton location={selectedLocation} />
      </div>
    </>
  )

  const mobileForecast = data && (
    <>
      {rainPanel}
      <HourlyForecast hourly={data.hourly} tr={tr} variant="mobile" />
    </>
  )

  const mobileRisk = data && (
    <>
      {/* v2 Fase 0 (ADR-12, FR-X-3) — indeks bahaya majemuk dari registry, urut level tertinggi dulu */}
      <HazardPanel hazards={data.hazards} location={selectedLocation} tr={tr} onAbout={() => setAboutOpen(true)} />
      <DisasterWarning disaster={data.disaster} dailyRainSum={data.daily.rainSum} location={selectedLocation} tr={tr} />
      {/* H-API (v2 Fase 1, Sprint 2) — bahaya kebakaran: FWI + hotspot + HTH; H-KERING — kekeringan ringkas */}
      <FireDangerCard fireDanger={data.fireDanger} tr={tr} />
      <DroughtCard drought={data.drought} tr={tr} />
      {/* Fase 2–3 — kartu fokus: petir/badai, debit GloFAS, gempa, Burni Telong, suhu kopi, laporan PetaBencana (tampil hanya bila ada data) */}
      <StormCard hazards={data.hazards} />
      <FloodCard hazards={data.hazards} flood={data.flood} />
      <QuakeCard hazards={data.hazards} />
      <VolcanoCard hazards={data.hazards} volcano={data.volcano} />
      <TemperatureCard hazards={data.hazards} />
      <ExternalReportsCard externalReports={data.externalReports} />
      {/* 1.9d — riwayat multi-bahaya + FR-X-4 kontak darurat */}
      <DisasterHistoryCard history={data.disaster?.disasterHistory} location={selectedLocation} tr={tr} />
      <EmergencyContacts location={selectedLocation} hazard={data.hazards?.active?.[0]?.id ?? '*'} />
    </>
  )

  const mobileLocations = (
    <>
      {/* 1.6b — peta skematik level 15 sentra (klik → pilih) */}
      {data && <SchematicMap hazardsAll={data.hazardsAll} selectedLocation={selectedLocation} onSelectLocation={onSelectLocation} hotspots={data.fireDanger?.hotspots?.nearest ?? []} compact />}
      <LocationRail selectedLocation={selectedLocation} onSelectLocation={onSelectLocation} tr={tr} />
    </>
  )

  /* ---------- Layout desktop ---------- */
  /* ---------- Desktop P7.5 — lima zona di dalam papan kerja ---------- */
  const goZone = (id) => {
    document.getElementById(`zona-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const dRingkas = data && (
    <div className="space-y-4">
      <RingkasMobile
        current={data.current}
        daily={data.daily}
        location={selectedLocation}
        hazards={data.hazards}
        hourly={data.hourly}
        tr={tr}
        onOpenRisk={() => goZone('risiko')}
      />
      <CoffeeAdvisory coffee={data.coffee} tr={tr} />
      <AirQualityCard airQuality={data.airQuality} tr={tr} />
      <SeasonalBanner seasonal={data.disaster?.seasonal} tr={tr} />
      <ClimateBanner drought={data.drought} tr={tr} />
    </div>
  )

  const dRamalan = data && (
    <div className="space-y-4">
      {rainPanel}
      <HourlyForecast hourly={data.hourly} tr={tr} variant="desktop" />
      <DroughtCard drought={data.drought} tr={tr} />
    </div>
  )

  const dRisiko = data && (
    <div className="space-y-4">
      <HazardPanel
        hazards={data.hazards}
        location={selectedLocation}
        tr={tr}
        onAbout={() => setAboutOpen(true)}
        onSelect={(id) => setSelHaz(id)}
        selectedId={selHaz ?? data.hazards?.worst}
      />
      <DisasterWarning disaster={data.disaster} dailyRainSum={data.daily.rainSum} location={selectedLocation} tr={tr} />
      <StormCard hazards={data.hazards} />
      <FloodCard hazards={data.hazards} flood={data.flood} />
      <TemperatureCard hazards={data.hazards} />
      <QuakeCard hazards={data.hazards} />
      <VolcanoCard hazards={data.hazards} volcano={data.volcano} />
      <FireDangerCard fireDanger={data.fireDanger} tr={tr} />
      <ExternalReportsCard externalReports={data.externalReports} />
    </div>
  )

  const dSentra = data && (
    <div className="space-y-4">
      <SchematicMap
        hazardsAll={data.hazardsAll}
        selectedLocation={selectedLocation}
        onSelectLocation={onSelectLocation}
        hotspots={data.fireDanger?.hotspots?.nearest ?? []}
      />
      <EmergencyContacts location={selectedLocation} hazard={data.hazards?.active?.[0]?.id ?? '*'} />
    </div>
  )

  const dArsip = data && (
    <div className="space-y-4">
      <DisasterHistoryCard history={data.disaster?.disasterHistory} location={selectedLocation} tr={tr} />
      <section className="rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu">
        <h2 className="text-body font-semibold text-tanah-tinta dark:text-langit-tinta">Tentang data &amp; batasan</h2>
        <p className="mt-1 text-body-sm leading-relaxed text-tanah-tinta-isi dark:text-langit-tinta-isi">
          Ambang, sumber, dan catatan keterbatasan tiap bahaya dijelaskan di panel ini. Niu adalah
          informasi pendukung keputusan, bukan peringatan dini resmi.
        </p>
        <button
          type="button"
          onClick={() => setAboutOpen(true)}
          className="mt-3 inline-flex min-h-11 items-center rounded-pil border border-tanah-garis-kuat px-4 text-body-sm font-semibold text-tanah-aksen hover:bg-tanah-terbenam dark:border-langit-garis-kuat dark:text-langit-aksen dark:hover:bg-langit-terbenam"
        >
          Buka tentang data &amp; batasan
        </button>
      </section>
    </div>
  )

  const desktopLayout = data && (
    <DesktopBoard
      hazards={data.hazards}
      location={selectedLocation}
      onSelectLocation={onSelectLocation}
      tr={tr}
      selectedHazardId={selHaz}
      onSelectHazard={setSelHaz}
      sections={{ ringkas: dRingkas, ramalan: dRamalan, risiko: dRisiko, sentra: dSentra, arsip: dArsip }}
    />
  )

  return (
    <div className="min-h-screen flex flex-col">
      {/* P2 — WCAG 2.4.1: lewati navigasi ke konten utama (hanya terlihat saat difokus) */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:px-4 focus:min-h-11 focus:inline-flex focus:items-center focus:rounded-lg focus:bg-leaf-deep focus:text-on-accent focus:text-body focus:font-semibold"
      >
        {tr('skipToContent')}
      </a>
      {/* P2 — pengumuman pembaruan data untuk pembaca layar */}
      <div role="status" aria-live="polite" className="sr-only">{liveMsg}</div>
      {isDesktop ? (
        <DesktopHeader {...headerProps} />
      ) : (
        <AppBar selectedLocation={selectedLocation} {...headerProps} />
      )}

      <InstallHint />

      {error && (
        <div
          role="alert"
          className="mx-4 mt-4 border border-cherry/30 bg-cherry/5 text-cherry-deep dark:text-cherry-soft p-4 rounded-card text-body"
        >
          <p className="font-medium">{error}</p>
          {errorDetail && (
            <details className="mt-2 text-caption">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian teknis</summary>
              <p className="mt-1 break-words">{errorDetail}</p>
            </details>
          )}
          <button
            type="button"
            onClick={() => loadData(selectedLocation)}
            className="mt-2 min-h-11 px-4 inline-flex items-center rounded-lg bg-cherry text-on-accent font-semibold text-body transition duration-100 ease-out active:scale-[.97]"
          >
            {tr('retry')}
          </button>
        </div>
      )}

      {/* P4 — offline: pita tetap + penanda data dari cache */}
      {offline && (
        <Notice
          tone="waspada"
          message={`${tr('offlineBanner')} — ${tr('offlineCacheNote')}`}
          actionLabel={tr('retry')}
          onAction={() => loadData(selectedLocation)}
        />
      )}

      {/* P4 — data basi (>= 30 menit): label + ajakan tindakan, ≥ 44 px */}
      {data && age?.stale && !loading && (
        <Notice
          tone="waspada"
          message={`${tr('dataAgeStale')} · ${tr('dataAge')} ${age.label}`}
          actionLabel={tr('staleAction')}
          onAction={() => loadData(selectedLocation)}
        />
      )}

      {/* P4 — kembali daring: tawarkan muat ulang, jangan paksa */}
      {backOnline && !offline && (
        <Notice
          tone="aman"
          message={tr('onlineAgain')}
          actionLabel={tr('refresh')}
          onAction={() => {
            setBackOnline(false)
            loadData(selectedLocation)
          }}
          onDismiss={() => setBackOnline(false)}
          dismissLabel={tr('dismiss')}
        />
      )}

      {/* P4 — menunggu: pengumuman pembaca layar + skeleton bertata tetap setelah 300 ms */}
      {loading && !data && (
        <>
          <p role="status" aria-live="polite" className="sr-only">
            {tr('loadingData')}
          </p>
          {showSkeleton && (
            <div aria-busy="true" className="flex-1 w-full max-w-shell mx-auto px-4 py-4">
              <AppSkeleton />
            </div>
          )}
        </>
      )}

      {isDesktop ? (
        <main id="main" className="flex-1 w-full min-w-0">{desktopLayout}</main>
      ) : (
        <>
          <main id="main" className="flex-1 w-full">
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

      <footer className="border-t border-ink/10 dark:border-mist/10 py-4 text-center text-caption text-ink-muted dark:text-mist-subtle">
        Niu Gayo Agro-Climate &bull; {tr('footer')} &bull;{' '}
        <button type="button" onClick={() => setAboutOpen(true)} className="min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
          {tr('aboutData')}
        </button>
      </footer>
      <AboutData open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
