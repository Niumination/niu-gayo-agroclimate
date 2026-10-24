import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import AppBar from './components/AppBar'
import DesktopHeader from './components/DesktopHeader'
import BottomNav from './components/BottomNav'
import MobileTabShell from './components/MobileTabShell'
import LocationRail from './components/LocationRail'
import RingkasMobile from './pages/RingkasMobile.jsx'
import DesktopSummaryBar from './components/niu/DesktopSummaryBar.jsx'
import DesktopHazardInspector from './components/niu/DesktopHazardInspector.jsx'
import HourStrip from './components/niu/HourStrip.jsx'
import DesktopBoard from './pages/DesktopBoard.jsx'
import LivingMapDesktop from './pages/LivingMapDesktop.jsx'
import LivingMapBoot from './components/LivingMapBoot.jsx'
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

const DESKTOP_LAYOUT_PREF_VERSION = 'v6-layout-20261019c'

function migrateDesktopLayoutPreferences() {
  try {
    if (localStorage.getItem('niu.desktop.layout-version') === DESKTOP_LAYOUT_PREF_VERSION) return false
    for (const key of ['niu.rail', 'niu.desk.rail', 'niu.insp', 'niu.desk.insp']) {
      localStorage.removeItem(key)
    }
    localStorage.setItem('niu.desktop.layout-version', DESKTOP_LAYOUT_PREF_VERSION)
    return true
  } catch {
    return false
  }
}

export default function App() {
  const isDesktop = useBreakpoint()
  // Dua tampilan desktop: papan lima bagian (bawaan) dan Living Map.
  // `?tampilan=peta-hidup` tetap sah untuk tautan langsung dan pengujian, tetapi
  // pengguna kini dapat berpindah lewat tombol di papan dan tombol kembali di peta
  // (audit F-01: fitur sebelumnya tidak punya jalan masuk sama sekali).
  const readView = useCallback(() => (
    typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('tampilan') === 'peta-hidup'
      ? 'map'
      : 'board'
  ), [])
  const [desktopView, setDesktopView] = useState(readView)
  const showLivingMap = useCallback((next) => {
    setDesktopView(next ? 'map' : 'board')
    if (typeof window === 'undefined' || !window.history?.pushState) return
    const url = new URL(window.location.href)
    if (next) url.searchParams.set('tampilan', 'peta-hidup')
    else url.searchParams.delete('tampilan')
    // pushState (bukan replaceState) agar tombol Kembali peramban mengembalikan tampilan sebelumnya.
    window.history.pushState({ tampilan: next ? 'peta-hidup' : null }, '', url)
    window.scrollTo({ top: 0 })
  }, [])
  useEffect(() => {
    const onPop = () => setDesktopView(readView())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [readView])
  const livingMapPreview = isDesktop && desktopView === 'map'

  // Persistensi wilayah terpilih (localStorage)
  const [selectedLocation, setSelectedLocation] = useState(() => {
    const savedId = prefs.getLocationId()
    return LOCATIONS.find((l) => l.id === savedId) || LOCATIONS[0]
  })
  const [highlightedLocationId, setHighlightedLocationId] = useState(null)
  const [data, setData] = useState(null)
  // F-06 — hasil `hazards?location=all` datang setelah data utama; disimpan di ref supaya
  // tidak hilang bila tiba sebelum `setData(res)` (balapan waktu).
  // F-06 — payload "menyusul" (consensus, laporan warga, ringkasan 15 sentra). Disimpan di ref
  // supaya tidak hilang bila tiba sebelum `setData(res)` (balapan waktu pada jaringan cepat).
  const lateRef = useRef({})
  const mergeLate = useCallback(
    (prev, key, value) =>
      key === 'consensus'
        ? { ...prev, disaster: { ...(prev.disaster ?? {}), consensus: value } }
        : { ...prev, [key]: value },
    []
  )
  // F-06 — penanda "level sentra menyusul". Berhenti tepat saat payload tiba, atau setelah
  // 8 detik (misal endpoint gagal) supaya catatan "memuat" tidak pernah menggantung.
  const [hazardsAllPending, setHazardsAllPending] = useState(false)
  const hazardsAllTimerRef = useRef(null)
  const [fetchedAt, setFetchedAt] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [errorDetail, setErrorDetail] = useState(null)
  // P2 — pengumuman untuk pembaca layar (WCAG 4.1.3 Status Messages)
  const [liveMsg, setLiveMsg] = useState('')

  // i18n
  const [aboutOpen, setAboutOpen] = useState(false) // FR-X-9 modal "Tentang data & batasan"
  const [locationPickerOpen, setLocationPickerOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [shareOptionsOpen, setShareOptionsOpen] = useState(false)
  const openLocationPicker = useCallback(() => setLocationPickerOpen(true), [])
  const closeLocationPicker = useCallback(() => setLocationPickerOpen(false), [])
  const openReportDialog = useCallback(() => setReportDialogOpen(true), [])
  const openShareOptions = useCallback(() => setShareOptionsOpen(true), [])
  const openAbout = useCallback(() => setAboutOpen(true), [])
  const tr = useMemo(() => (key) => t('id', key), [])

  // Tema: light/dark/auto (prefers-color-scheme)
  const [theme, setTheme] = useState(() => effectiveTheme())
  const isAuto = prefs.getTheme() == null
  useEffect(() => {
    applyTheme(theme)
    // Samakan bilah sistem Android dengan permukaan atas tiap arah prototipe.
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#16273B' : '#F1E7D8')
  }, [theme])
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
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
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    const desktopViewport = typeof window !== 'undefined' && window.innerWidth >= 1024
    if (desktopViewport) migrateDesktopLayoutPreferences()
    try {
      const saved = localStorage.getItem('niu.insp') ?? localStorage.getItem('niu.desk.insp')
      if (saved === 'open' || saved === 'buka') return true
      if (saved === 'closed' || saved === 'tutup') return false
    } catch { /* mode privat */ }
    return desktopViewport
  })

  useEffect(() => {
    if (isDesktop && migrateDesktopLayoutPreferences()) setInspectorOpen(true)
  }, [isDesktop])

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
      lateRef.current = {}
      setHazardsAllPending(true)
      clearTimeout(hazardsAllTimerRef.current)
      hazardsAllTimerRef.current = setTimeout(() => setHazardsAllPending(false), 8000)
      try {
        const res = await getAgroClimateData(loc, {
          // F-06 — tiga payload tampilan-saja menyusul; konten utama tidak lagi menunggunya.
          onLate: (key, value) => {
            lateRef.current[key] = value
            if (key === 'hazardsAll') {
              clearTimeout(hazardsAllTimerRef.current)
              setHazardsAllPending(false)
            }
            setData((prev) => (prev ? mergeLate(prev, key, value) : prev))
          },
        })
        setData(Object.entries(lateRef.current).reduce((acc, [key, value]) => mergeLate(acc, key, value), res))
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
    [tr, mergeLate]
  )

  useEffect(() => {
    loadData(selectedLocation)
  }, [selectedLocation, loadData])

  const onSelectLocation = useCallback((loc) => {
    prefs.setLocationId(loc.id)
    setSelectedLocation(loc)
    if (!isDesktop) setTab('now')
  }, [isDesktop])

  // Data grafik hujan 24 jam (mm/jam)
  const rainSeries = useMemo(() => {
    if (!data?.hourly) return []
    return data.hourly.slice(0, 24).map((row) => ({ time: row.time, rain: row.rain }))
  }, [data])

  const headerProps = {
    lastUpdated: data?.timestamp,
    selectedLocation,
    onSelectLocation,
    hazards: data?.hazards,
    onAbout: openAbout,
    onOpenLocationPicker: openLocationPicker,
    onCloseLocationPicker: closeLocationPicker,
    locationPickerOpen,
    shareOpen: shareOptionsOpen,
    onShareOpenChange: setShareOptionsOpen,
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
      data-niu-card="rain-chart"
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
        modelElevation={data.modelElevation}
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
    <div className="niu-desktop-summary">
      <DesktopSummaryBar
        hazards={data.hazards}
        onOpenRisk={() => goZone('risiko')}
        onSelectHazard={(id) => {
          setSelHaz(id)
          setInspectorOpen(true)
        }}
      />
      <HourStrip hours={data.hourly?.slice(0, 12) ?? []} interactive className="niu-desktop-hourstrip" />
      <div className="niu-desktop-summary-grid">
        <RingkasMobile
          current={data.current}
          daily={data.daily}
          location={selectedLocation}
          modelElevation={data.modelElevation}
          hazards={data.hazards}
          hourly={data.hourly}
          tr={tr}
          showAttention={false}
          showHours={false}
          className="niu-desktop-weather"
        />
        <AirQualityCard airQuality={data.airQuality} tr={tr} />
      </div>
      <div className="niu-desktop-summary-extras">
        <CoffeeAdvisory coffee={data.coffee} tr={tr} />
      </div>
    </div>
  )

  const dRamalan = data && (
    <div className="niu-desktop-forecast">
      <div className="niu-desktop-forecast-top">
        {rainPanel}
        <DisasterWarning disaster={data.disaster} dailyRainSum={data.daily.rainSum} location={selectedLocation} tr={tr} />
      </div>
      <div className="niu-desktop-climate-grid">
        <SeasonalBanner seasonal={data.disaster?.seasonal} tr={tr} />
        <ClimateBanner drought={data.drought} tr={tr} />
      </div>
      <HourlyForecast hourly={data.hourly} tr={tr} variant="desktop" />
    </div>
  )

  const desktopSelectedHazard = data?.hazards?.results?.find((hazard) => hazard.id === selHaz)
    ?? data?.hazards?.results?.find((hazard) => hazard.level === data?.hazards?.worst)
    ?? data?.hazards?.results?.[0]
    ?? null
  const inlineHazardInspector = inspectorOpen && desktopSelectedHazard ? (
    <DesktopHazardInspector
      selected={desktopSelectedHazard}
      location={selectedLocation}
      onClose={() => {
        setInspectorOpen(false)
        window.requestAnimationFrame(() => {
          const rows = [...document.querySelectorAll('[data-hazard-row]')]
          const selectedRow = rows.find((row) => row.getAttribute('data-hazard-row') === desktopSelectedHazard.id)
          ;(selectedRow || document.getElementById('zona-risiko'))?.focus()
        })
      }}
      inline
    />
  ) : null

  const dRisiko = data && (
    <div className="niu-desktop-risk">
      <HazardPanel
        hazards={data.hazards}
        location={selectedLocation}
        tr={tr}
        onAbout={openAbout}
        onSelect={(id) => {
          setSelHaz(id)
          setInspectorOpen(true)
        }}
        selectedId={selHaz ?? data.hazards?.worst ?? desktopSelectedHazard?.id}
        inlineDetail={inlineHazardInspector}
      />
      <div className="niu-risk-focus-grid">
        <DroughtCard drought={data.drought} tr={tr} />
        <StormCard hazards={data.hazards} />
        <FloodCard hazards={data.hazards} flood={data.flood} />
        <TemperatureCard hazards={data.hazards} />
        <QuakeCard hazards={data.hazards} />
        <VolcanoCard hazards={data.hazards} volcano={data.volcano} />
        <FireDangerCard fireDanger={data.fireDanger} tr={tr} />
        <ExternalReportsCard externalReports={data.externalReports} />
      </div>
    </div>
  )

  const dSentra = data && (
    <div className="niu-desktop-locations">
      {/* F-04/F-06 — papan desktop memakai level AKUT, sama dengan bilah ringkasannya.
          Tanpa ini, tab "Sentra" menulis "Bahaya" sementara bilah menulis "Waspada".
          Peta mobile tetap memakai `worst` (bawaan) karena tidak melewati cabang ini. */}
      <SchematicMap
        hazardsAll={data.hazardsAll}
        levelsPending={hazardsAllPending}
        levelKey="worstAcute"
        selectedLocation={selectedLocation}
        highlightedLocationId={highlightedLocationId}
        onHighlightLocation={setHighlightedLocationId}
        onSelectLocation={onSelectLocation}
        hotspots={data.fireDanger?.hotspots?.nearest ?? []}
      />
      <EmergencyContacts location={selectedLocation} hazard={data.hazards?.active?.[0]?.id ?? '*'} />
    </div>
  )

  const dArsip = data && (
    <div className="niu-desktop-archive space-y-4">
      <DisasterHistoryCard history={data.disaster?.disasterHistory} location={selectedLocation} tr={tr} />
      <section data-niu-card="about-guide" className="rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu">
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

  const desktopLayout = data && (livingMapPreview ? (
    <LivingMapDesktop
      location={selectedLocation}
      data={data}
      hazards={data.hazards}
      hazardsAll={data.hazardsAll}
      hazardsAllPending={hazardsAllPending}
      highlightedLocationId={highlightedLocationId}
      onHighlightLocation={setHighlightedLocationId}
      onSelectLocation={onSelectLocation}
      inspectorOpen={inspectorOpen}
      onInspectorOpenChange={setInspectorOpen}
      onOpenReport={openReportDialog}
      reportOpen={reportDialogOpen}
      onReportOpenChange={setReportDialogOpen}
      onOpenShare={openShareOptions}
      onRefresh={() => loadData(selectedLocation)}
      onToggleTheme={cycleTheme}
      onAbout={openAbout}
      tr={tr}
      selectedHazardId={selHaz}
      onSelectHazard={setSelHaz}
      onOpenBoard={() => showLivingMap(false)}
    />
  ) : (
    <DesktopBoard
      hazards={data.hazards}
      hazardsAll={data.hazardsAll}
      location={selectedLocation}
      highlightedLocationId={highlightedLocationId}
      onHighlightLocation={setHighlightedLocationId}
      onSelectLocation={onSelectLocation}
      onOpenLocationPicker={openLocationPicker}
      inspectorOpen={inspectorOpen}
      onInspectorOpenChange={setInspectorOpen}
      onOpenReport={openReportDialog}
      reportOpen={reportDialogOpen}
      onReportOpenChange={setReportDialogOpen}
      onOpenShare={openShareOptions}
      onRefresh={() => loadData(selectedLocation)}
      onToggleTheme={cycleTheme}
      onAbout={openAbout}
      tr={tr}
      selectedHazardId={selHaz}
      onSelectHazard={setSelHaz}
      onOpenLivingMap={() => showLivingMap(true)}
      sections={{ ringkas: dRingkas, ramalan: dRamalan, risiko: dRisiko, sentra: dSentra, arsip: dArsip }}
    />
  ))

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
        <DesktopHeader {...headerProps} live={livingMapPreview} />
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
          {/* F-06: di desktop, kerangka `LivingMapBoot` di dalam <main> sudah mencadangkan ruang.
              Skeleton papan ini dulu dirender sebagai saudara <main> sehingga mendorongnya keluar
              layar (CLS 0,47). Mobile tetap memakai skeleton seperti sebelumnya. */}
          {showSkeleton && !isDesktop && (
            <div aria-busy="true" className="flex-1 w-full max-w-shell mx-auto px-4 py-4">
              <AppSkeleton />
            </div>
          )}
        </>
      )}

      {isDesktop ? (
        <main id="main" className="flex-1 w-full min-w-0">
          {/* Audit F-07 — halaman desktop tidak punya judul tingkat satu. Cukup satu,
              tersembunyi secara visual, dan ikut berubah saat sentra diganti. */}
          <h1 className="sr-only">
            {livingMapPreview
              ? `Peta hidup cuaca dan peringatan dini sentra ${selectedLocation?.name ?? 'Aceh Tengah'}`
              : `Cuaca dan peringatan dini sentra ${selectedLocation?.name ?? 'Aceh Tengah'}`}
          </h1>
          {/* F-06 — sebelum data pertama tiba, ruang final sudah dicadangkan (bukan <main> 3 px).
              Tidak ditampilkan saat galat, agar pesan kesalahan tidak terlihat seperti "memuat". */}
          {desktopLayout ?? (error ? null : <LivingMapBoot />)}
        </main>
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

      <footer className={livingMapPreview
        ? 'niu-footer-livingmap'
        : 'border-t border-ink/10 dark:border-mist/10 py-4 text-center text-caption text-ink-muted dark:text-mist-subtle'}>
        Niu Gayo Agro-Climate &bull; {tr('footer')} &bull;{' '}
        <button type="button" data-target="inline" onClick={() => setAboutOpen(true)} className="min-h-6 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
          {tr('aboutData')}
        </button>
      </footer>
      <AboutData open={aboutOpen} onClose={() => setAboutOpen(false)} />
    </div>
  )
}
