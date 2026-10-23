import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import AirQualityCard from '../components/AirQualityCard.jsx'
import ClimateBanner from '../components/ClimateBanner.jsx'
import CoffeeAdvisory from '../components/CoffeeAdvisory.jsx'
import CommandPalette from '../components/niu/CommandPalette.jsx'
import DesktopSummaryBar from '../components/niu/DesktopSummaryBar.jsx'
import DisasterHistoryCard from '../components/DisasterHistoryCard.jsx'
import EmergencyContacts from '../components/EmergencyContacts.jsx'
import HazardPanel from '../components/HazardPanel.jsx'
import DesktopHazardInspector from '../components/niu/DesktopHazardInspector.jsx'
import HourStrip from '../components/niu/HourStrip.jsx'
import RingkasMobile from '../pages/RingkasMobile.jsx'
import ReportButton from '../components/ReportButton.jsx'
import SchematicMap from '../components/SchematicMap.jsx'
import { Maximize2, Minimize2, PanelRight, X } from 'lucide-react'
import SeasonalBanner from '../components/SeasonalBanner.jsx'
import { LOCATIONS } from '../data/locations.js'
import './LivingMapDesktop.css'

const PANELS = [
  { id: 'condition', label: 'Kondisi' },
  { id: 'risk', label: 'Risiko' },
  { id: 'forecast', label: 'Prakiraan' },
  { id: 'services', label: 'Sentra & layanan' },
  { id: 'history', label: 'Riwayat' },
]
const PANEL_SHORTCUTS = ['condition', 'risk', 'forecast', 'services', 'history']
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
const MODE_NEXT = { '1': '2', '2': '3', '3': '1' }
const MODE_META = {
  '1': { label: 'Mode 1 · Normal', next: 'Mode 2 · paling lebar', short: 'Mode 1', Icon: Maximize2 },
  '2': { label: 'Mode 2 · Paling lebar', next: 'Mode 3 · lebar menengah', short: 'Mode 2', Icon: PanelRight },
  '3': { label: 'Mode 3 · Lebar menengah', next: 'Mode 1 · normal', short: 'Mode 3', Icon: Minimize2 },
}

/**
 * Port desktop Living Map V4 ke komponen React.
 *
 * Prinsip: tampilan shell baru, tetapi seluruh data dan komponen domain berasal
 * dari App/getAgroClimateData. Komponen ini tidak melakukan fetch, tidak
 * menghitung ulang risiko, dan tidak menulis data.
 */
export default function LivingMapDesktop({
  location,
  data,
  hazards,
  hazardsAll,
  highlightedLocationId,
  onHighlightLocation,
  onSelectLocation,
  inspectorOpen,
  onInspectorOpenChange,
  onOpenReport,
  reportOpen,
  onReportOpenChange,
  onOpenShare,
  onRefresh,
  onToggleTheme,
  onAbout,
  tr = (key) => key,
  selectedHazardId,
  onSelectHazard,
  onOpenBoard,
}) {
  const [activePanel, setActivePanel] = useState('condition')
  const [drawerMode, setDrawerMode] = useState('1')
  const [summaryVisible, setSummaryVisible] = useState(true)
  const [focusMode, setFocusMode] = useState(false)
  const [compact, setCompact] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [layers, setLayers] = useState({ boundaries: true, sentra: true, risk: true, hotspots: true })
  const [pinnedPanels, setPinnedPanels] = useState({ weather: false, season: false })
  // Panel bawah yang sedang diperlebar menjadi dialog tengah (seperti pop-up pencarian).
  const [expandedPanel, setExpandedPanel] = useState(null)
  const hours12 = useMemo(() => data?.hourly?.slice(0, 12) ?? [], [data?.hourly])
  const hoursSignature = useMemo(() => hours12.map((hour) => `${hour.time}:${hour.rain}`).join('|'), [hours12])
  const [openPanels, setOpenPanels] = useState({ weather: false, season: false })
  const stageRef = useRef(null)
  const drawerRef = useRef(null)
  const modeButtonRef = useRef(null)
  // Strip 12 jam: batang hujan tumbuh sekali setiap data prakiraan berubah.
  const barsRef = useRef(null)
  useEffect(() => {
    const el = barsRef.current
    if (!el) return
    // Matikan lalu nyalakan lagi dengan satu reflow di antaranya supaya animasi
    // benar-benar diulang (dua perubahan dalam satu frame tidak me-restart CSS animation).
    el.dataset.grow = 'off'
    el.getBoundingClientRect()
    el.dataset.grow = 'on'
  }, [hoursSignature])
  const bottomRef = useRef(null)
  const restoreRef = useRef(null)
  const expandRef = useRef({ weather: null, season: null })
  const panelModalRef = useRef(null)

  const hotspots = data?.fireDanger?.hotspots?.nearest ?? []
  const activeHazard = hazards?.results?.find((item) => item.id === selectedHazardId) ?? null

  const showInspector = Boolean(inspectorOpen)
  const isModal = showInspector && drawerMode === '2'

  // Animasi CSS tetap berjalan di tab latar. Kelas dipasang di <html> supaya
  // header (chip "Diperbarui") ikut berhenti, bukan hanya isi shell.
  useEffect(() => {
    const root = document.documentElement
    const sync = () => root.classList.toggle('is-lm-paused', document.hidden)
    sync()
    document.addEventListener('visibilitychange', sync)
    return () => {
      document.removeEventListener('visibilitychange', sync)
      root.classList.remove('is-lm-paused')
    }
  }, [])

  const closeContext = useCallback(() => {
    setDrawerMode('1')
    onInspectorOpenChange?.(false)
    window.requestAnimationFrame(() => restoreRef.current?.focus({ preventScroll: true }))
  }, [onInspectorOpenChange])

  const tabTo = useCallback((id) => {
    if (!PANELS.some((panel) => panel.id === id)) return
    setActivePanel(id)
    onInspectorOpenChange?.(true)
  }, [onInspectorOpenChange])

  const setLayer = useCallback((key) => {
    setLayers((value) => ({ ...value, [key]: !value[key] }))
  }, [])

  const revealBottomPanel = useCallback((key, open) => {
    setOpenPanels((value) => (value[key] === open ? value : { ...value, [key]: open }))
  }, [])

  const toggleBottomPin = useCallback((key) => {
    const next = !pinnedPanels[key]
    setPinnedPanels((value) => ({ ...value, [key]: next }))
    revealBottomPanel(key, next)
  }, [pinnedPanels, revealBottomPanel])

  // F-02 (audit): saat panel tertutup, isinya hanya tersembunyi secara visual
  // (`max-height: 58px; overflow: hidden`), sehingga tombol jam di dalamnya masih
  // menerima fokus keyboard. `inert` mengeluarkan isi itu dari urutan fokus & pohon aksesibilitas.
  const collapsed = {
    weather: !(openPanels.weather || pinnedPanels.weather),
    season: !(openPanels.season || pinnedPanels.season),
  }

  const bottomProps = useCallback((key) => ({
    onMouseEnter: () => revealBottomPanel(key, true),
    onMouseLeave: () => { if (!pinnedPanels[key]) revealBottomPanel(key, false) },
    onFocusCapture: () => revealBottomPanel(key, true),
    onBlurCapture: (event) => {
      if (!event.currentTarget.contains(event.relatedTarget) && !pinnedPanels[key]) revealBottomPanel(key, false)
    },
  }), [pinnedPanels, revealBottomPanel])

  const paletteItems = useMemo(() => [
    ...LOCATIONS.map((item) => ({
      id: `sentra-${item.id}`,
      label: item.name,
      sub: `${item.elevation.toLocaleString('id-ID')} m · pilih sentra`,
      group: 'Sentra',
      run: () => onSelectLocation?.(item),
    })),
    ...(hazards?.results ?? []).map((item) => ({
      id: `bahaya-${item.id}`,
      label: item.label?.id || item.id,
      sub: item.headline || 'Buka rincian bahaya',
      group: 'Bahaya',
      run: () => { onSelectHazard?.(item.id); tabTo('risk') },
    })),
    ...PANELS.map((item, index) => ({
      id: `panel-${item.id}`,
      label: `${index + 1}. ${item.label}`,
      sub: 'Buka panel konteks',
      group: 'Panel',
      run: () => tabTo(item.id),
    })),
    { id: 'action-board', label: 'Kembali ke papan desktop', sub: 'Tampilan papan lima bagian', group: 'Aksi', run: onOpenBoard },
    { id: 'action-refresh', label: 'Muat ulang data', sub: 'Lewat pemuatan data App yang ada', group: 'Aksi', run: onRefresh },
    { id: 'action-report', label: 'Lapor kejadian', sub: 'Buka formulir laporan yang ada', group: 'Aksi', run: onOpenReport },
    { id: 'action-share', label: 'Bagikan ringkasan', sub: 'Buka pilihan berbagi yang ada', group: 'Aksi', run: onOpenShare },
    { id: 'action-about', label: 'Tentang data & batasan', sub: 'Sumber dan metode', group: 'Aksi', run: onAbout },
    { id: 'action-theme', label: 'Ganti arah Tanah / Langit', sub: 'Kontrol tema aplikasi', group: 'Aksi', run: onToggleTheme },
    { id: 'action-focus', label: `Mode fokus: ${focusMode ? 'aktif' : 'nonaktif'}`, sub: 'Sembunyikan ringkasan dan panel bawah', group: 'Aksi', run: () => setFocusMode((value) => !value) },
    { id: 'action-density', label: `Kepadatan: ${compact ? 'padat' : 'nyaman'}`, sub: 'Ubah jarak panel', group: 'Aksi', run: () => setCompact((value) => !value) },
  ], [hazards, onSelectLocation, onSelectHazard, onRefresh, onOpenReport, onOpenShare, onAbout, onToggleTheme, onOpenBoard, tabTo, focusMode, compact])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.defaultPrevented) return
      const target = event.target
      const inField = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (event.key === 'Escape' && (pinnedPanels.weather || pinnedPanels.season)) {
        setPinnedPanels({ weather: false, season: false })
        setOpenPanels({ weather: false, season: false })
        return
      }
      if (paletteOpen || inField || event.metaKey || event.ctrlKey || event.altKey) return
      if (event.key === '[') {
        event.preventDefault()
        setSummaryVisible((value) => !value)
      } else if (event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        setCompact((value) => !value)
      } else if (event.key === 'f' || event.key === 'F') {
        event.preventDefault()
        setFocusMode((value) => !value)
      } else if (/^[1-5]$/.test(event.key)) {
        tabTo(PANEL_SHORTCUTS[Number(event.key) - 1])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [paletteOpen, tabTo, pinnedPanels])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return undefined
    const setVar = (name, value) => {
      if (stage.style.getPropertyValue(name) !== value) stage.style.setProperty(name, value)
    }
    const update = () => {
      const bottom = bottomRef.current
      if (bottom) setVar('--lm-bottom-height', `${Math.ceil(bottom.getBoundingClientRect().height)}px`)
      // Baris alat peta (zoom + layer + legenda) duduk tepat di atas dua panel;
      // tinggi sebenarnya dipakai agar panel konteks berhenti di atasnya.
      const toolrow = document.querySelector('.niu-map-toolrow')
      if (toolrow) setVar('--lm-toolrow-height', `${Math.ceil(toolrow.getBoundingClientRect().height)}px`)
      // Dua panel dan baris alat sekarang lurus memenuhi halaman, jadi tidak ada
      // lagi inset kanan yang mengikuti lebar panel konteks.
      // Tinggi shell mengikuti posisi atasnya yang sebenarnya, agar banner pemasangan
      // atau header yang membesar tidak mendorong panel bawah ke luar layar.
      const top = Math.ceil(stage.getBoundingClientRect().top + window.scrollY)
      const footer = document.querySelector('footer')
      const footerH = footer ? Math.ceil(footer.getBoundingClientRect().height) : 0
      const available = Math.max(420, Math.round(window.innerHeight - top - footerH - 8))
      setVar('--lm-shell-height', `${available}px`)
    }
    update()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update)
    if (bottomRef.current) observer?.observe(bottomRef.current)
    if (drawerRef.current) observer?.observe(drawerRef.current)
    const toolrowNode = document.querySelector('.niu-map-toolrow')
    if (toolrowNode) observer?.observe(toolrowNode)
    if (document.body) observer?.observe(document.body)
    window.addEventListener('resize', update)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', update)
    }
  }, [data, focusMode, drawerMode, showInspector])

  useEffect(() => {
    if (!isModal || !drawerRef.current) return undefined
    const panel = drawerRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const saved = new Map()
    let current = panel
    while (current?.parentElement) {
      const parent = current.parentElement
      for (const sibling of parent.children) {
        if (sibling === current || sibling.hasAttribute('data-lm-modal-keep') || sibling.hasAttribute('data-lm-react-inert')) continue
        if (!saved.has(sibling)) saved.set(sibling, sibling.inert)
        sibling.inert = true
      }
      current = parent
      if (parent === document.body) break
    }
    document.body.style.overflow = 'hidden'
    const firstFocus = window.requestAnimationFrame(() => modeButtonRef.current?.focus({ preventScroll: true }))
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setDrawerMode('1')
        window.requestAnimationFrame(() => modeButtonRef.current?.focus({ preventScroll: true }))
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((item) => item.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      // Roving manual: urutan tab selalu melingkar di dalam panel, tidak bergantung
      // pada urutan sequential browser yang bisa melewati elemen inert di luar dialog.
      event.preventDefault()
      const index = focusable.indexOf(document.activeElement)
      const next = index < 0
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length
      focusable[next].focus()
    }
    const onFocusIn = (event) => {
      if (panel.contains(event.target)) return
      const first = [...panel.querySelectorAll(FOCUSABLE)].find((item) => item.getClientRects().length > 0)
      ;(first || panel).focus({ preventScroll: true })
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(firstFocus)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      for (const [element, wasInert] of saved) element.inert = wasInert
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') previousFocus.focus()
      })
    }
  }, [isModal])

  // Dialog "perlebar panel": fokus terkurung, Escape menutup, fokus kembali ke tombol asal.
  useEffect(() => {
    if (!expandedPanel) return undefined
    const panel = panelModalRef.current
    if (!panel) return undefined
    const opener = expandRef.current[expandedPanel]
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const focusFirst = window.requestAnimationFrame(() => {
      const first = [...panel.querySelectorAll(FOCUSABLE)].find((item) => item.getClientRects().length > 0)
      ;(first || panel).focus({ preventScroll: true })
    })
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setExpandedPanel(null)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((item) => item.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      event.preventDefault()
      const index = focusable.indexOf(document.activeElement)
      const next = index < 0
        ? (event.shiftKey ? focusable.length - 1 : 0)
        : (index + (event.shiftKey ? -1 : 1) + focusable.length) % focusable.length
      focusable[next].focus()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(focusFirst)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => {
        if (opener?.isConnected) opener.focus({ preventScroll: true })
      })
    }
  }, [expandedPanel])

  const modeMeta = MODE_META[drawerMode]

  const sections = {
    condition: (
      <div className="lm-section-stack">
        {data?.current && data?.daily ? (
          <RingkasMobile current={data.current} daily={data.daily} location={location} modelElevation={data.modelElevation} hazards={hazards} hourly={data.hourly} tr={tr} showAttention={false} showHours={false} showCondition />
        ) : null}
        <AirQualityCard airQuality={data?.airQuality} tr={tr} />
      </div>
    ),
    risk: (
      <div className="lm-section-stack">
        <HazardPanel
          hazards={hazards}
          location={location}
          tr={tr}
          onAbout={onAbout}
          onSelect={(id) => onSelectHazard?.(id)}
          selectedId={selectedHazardId ?? activeHazard?.id}
          inlineDetail={activeHazard ? (
            <DesktopHazardInspector
              selected={activeHazard}
              location={location}
              inline
              onClose={() => onSelectHazard?.(null)}
            />
          ) : null}
        />
        <p className="text-caption text-ink-muted dark:text-mist-muted">Pilih baris untuk membuka rincian dan menyorot sentra terkait. Rincian memakai inspector bahaya aplikasi yang sama.</p>
      </div>
    ),
    forecast: (
      <div className="lm-section-stack">
        <ClimateBanner drought={data?.drought} tr={tr} />
        {/* Prakiraan per jam tidak diulang di sini: strip 12 jam sudah menjadi isi
            panel "Waktu & prakiraan" di bawah peta. Panel itu bisa diperlebar
            menjadi dialog tengah, dan tombol ini membukanya dari sisi detail. */}
        <section className="lm-service-note" aria-labelledby="lm-forecast-hourly-title">
          <h3 id="lm-forecast-hourly-title" className="text-body-sm font-semibold">Prakiraan per jam</h3>
          <p className="text-caption">Rincian 12 jam ke depan ada di panel “Waktu &amp; prakiraan” di bawah peta — tidak diulang di sini agar tidak ada data ganda.</p>
          <button type="button" className="lm-inline-action min-h-11" onClick={() => setExpandedPanel('weather')}>
            Buka prakiraan per jam
          </button>
        </section>
      </div>
    ),
    services: (
      <div className="lm-section-stack">
        <EmergencyContacts location={location} hazard={activeHazard?.id ?? '*'} />
        <section className="lm-service-note">
          <h3 className="text-body-sm font-semibold">Sumber & batasan</h3>
          <p className="text-caption">Ambang, sumber, dan catatan keterbatasan dijelaskan pada panel Tentang data. Tombol laporan dan bagikan memakai alur aplikasi yang sudah ada.</p>
          <button type="button" className="mt-2 min-h-11 text-body-sm font-semibold underline underline-offset-2" onClick={onAbout}>Buka tentang data &amp; batasan</button>
        </section>
      </div>
    ),
    history: (
      <div className="lm-section-stack">
        <DisasterHistoryCard history={data?.disaster?.disasterHistory} location={location} tr={tr} />
      </div>
    ),
  }

  const contextPanel = !showInspector ? null : (
      <aside
        ref={drawerRef}
        className={`lm-context lm-context-mode-${drawerMode}`}
        aria-label="Panel konteks sentra"
        role={isModal ? 'dialog' : undefined}
        aria-modal={isModal ? 'true' : undefined}
        aria-labelledby="lm-context-title"
        tabIndex={isModal ? -1 : undefined}
      >
        <header className="lm-context-head">
          <div className="min-w-0 flex-1">
            <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted dark:text-mist-subtle">Konteks sentra</p>
            <h2 id="lm-context-title" className="text-body font-semibold text-ink dark:text-mist">{location?.name}</h2>
          </div>
          <button
            ref={modeButtonRef}
            type="button"
            className="lm-mode-button min-h-11"
            aria-label={`${modeMeta.label} dari 3. Ubah ke ${modeMeta.next}.`}
            title={`${modeMeta.label} · klik untuk ${modeMeta.next}`}
            aria-expanded={drawerMode === '2'}
            data-mode={drawerMode}
            onClick={() => setDrawerMode((value) => MODE_NEXT[value])}
          >
            <modeMeta.Icon aria-hidden="true" size={16} strokeWidth={1.7} />
            <span className="lm-mode-button-label">{modeMeta.short}</span>
          </button>
          <button type="button" className="min-h-11 min-w-11" aria-label="Tutup panel konteks" title="Tutup panel konteks" onClick={closeContext}>×</button>
        </header>

        <div className="lm-context-tabs" role="tablist" aria-label="Detail sentra">
          {PANELS.map((panel, index) => (
            <button
              key={panel.id}
              id={`lm-tab-${panel.id}`}
              type="button"
              role="tab"
              aria-selected={activePanel === panel.id}
              aria-controls="lm-context-content"
              tabIndex={activePanel === panel.id ? 0 : -1}
              className="min-h-11 px-3 text-body-sm"
              onClick={() => tabTo(panel.id)}
              onKeyDown={(event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
                event.preventDefault()
                const index = PANELS.findIndex((item) => item.id === activePanel)
                const next = event.key === 'Home' ? 0 : event.key === 'End' ? PANELS.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : PANELS.length - 1)) % PANELS.length
                tabTo(PANELS[next].id)
                requestAnimationFrame(() => document.getElementById(`lm-tab-${PANELS[next].id}`)?.focus())
              }}
            >
              <span className="lm-tab-number" aria-hidden="true">{index + 1}</span>{panel.label}
            </button>
          ))}
        </div>

        <div id="lm-context-content" className="lm-context-content" role="tabpanel" tabIndex={0} aria-labelledby={`lm-tab-${activePanel}`}>
          {sections[activePanel]}
        </div>
      </aside>
  )

  return (
    <div ref={stageRef} className={`living-map-shell${focusMode ? ' is-focus' : ''}${compact ? ' is-compact' : ''}`} data-mode={drawerMode} data-inspector={showInspector ? 'open' : 'closed'}>
      <div className="living-map-canvas" data-lm-react-inert="" inert={isModal || undefined}>
        <SchematicMap
          hazardsAll={hazardsAll}
          selectedLocation={location}
          highlightedLocationId={highlightedLocationId}
          onHighlightLocation={onHighlightLocation}
          onSelectLocation={onSelectLocation}
          hotspots={hotspots}
          layers={layers}
          onLayerChange={setLayer}
          bare
        />

        <div className="lm-map-credit">
          <span>Peta skematik</span>
          <span aria-hidden="true">·</span>
          {/* Audit F-01 — jalan keluar dari Living Map tanpa harus menebak pintasan keyboard. */}
          <button
            type="button"
            className="lm-view-back min-h-6"
            data-target="inline"
            onClick={onOpenBoard}
            aria-label="Kembali ke papan desktop"
            title="Kembali ke papan desktop"
          >Papan</button>
        </div>

        {summaryVisible && (
          <section className="lm-summary" aria-label={`Ringkasan ${location?.name ?? 'sentra terpilih'}`}>
            <div className="lm-summary-head">
              <div>
                <p className="text-caption font-semibold uppercase tracking-wide text-ink-muted dark:text-mist-subtle">Sentra terpilih</p>
                <h2 className="text-body font-semibold text-ink dark:text-mist">{location?.name}</h2>
                <p className="text-caption text-ink-muted dark:text-mist-muted">{location?.elevation?.toLocaleString('id-ID')} mdpl · {location?.type}</p>
              </div>
              <button type="button" className="min-h-11 min-w-11" aria-label="Sembunyikan ringkasan sentra" title="Sembunyikan ringkasan sentra" onClick={() => setSummaryVisible(false)}>−</button>
            </div>
            <DesktopSummaryBar hazards={hazards} onOpenRisk={() => tabTo('risk')} onSelectHazard={(id) => { onSelectHazard?.(id); tabTo('risk') }} />
            <div className="lm-summary-weather" aria-label="Kondisi cuaca sekarang">
              <span><small>Suhu</small><b>{data?.current?.temp == null ? '—' : `${Number(data.current.temp).toLocaleString('id-ID', { maximumFractionDigits: 1 })}°C`}</b></span>
              <span><small>RH</small><b>{data?.current?.rh == null ? '—' : `${Math.round(data.current.rh)}%`}</b></span>
              <span><small>Hujan</small><b>{data?.current?.rain == null ? '—' : `${Number(data.current.rain).toLocaleString('id-ID', { maximumFractionDigits: 1 })} mm`}</b></span>
            </div>
            <div className="lm-summary-actions">
              <ReportButton location={location} open={reportOpen} onOpenChange={onReportOpenChange} />
              <button type="button" className="min-h-11 text-body-sm font-semibold" onClick={() => onOpenShare?.()}>Bagikan</button>
            </div>
          </section>
        )}

        {!summaryVisible && <button type="button" className="lm-summary-restore min-h-11" onClick={() => setSummaryVisible(true)}>Sentra terpilih +</button>}
        {!showInspector && <button ref={restoreRef} type="button" className="lm-drawer-restore min-h-11" onClick={() => onInspectorOpenChange?.(true)}>Buka panel konteks</button>}

        <div className="lm-map-meta" aria-hidden={undefined}>
          <span>Sumber prakiraan: ECMWF IFS · 11 bahaya dipantau</span>
        </div>

        <div ref={bottomRef} className="lm-bottom">
          <article className={`lm-bottom-panel lm-weather-panel lm-bottom-major${openPanels.weather || pinnedPanels.weather ? ' is-open' : ''}${pinnedPanels.weather ? ' is-pinned' : ''}`} {...bottomProps('weather')}>
            <header className="lm-bottom-head">
              <h2 className="text-body-sm font-semibold text-ink dark:text-mist">Waktu &amp; prakiraan</h2>
              <div className="lm-bottom-actions">
                <button ref={(node) => { expandRef.current.weather = node }} type="button" className="min-h-11 min-w-11 lm-panel-expand" aria-haspopup="dialog" aria-label="Perlebar panel waktu dan prakiraan" title="Perlebar panel waktu dan prakiraan" onClick={() => setExpandedPanel('weather')}><Maximize2 aria-hidden="true" size={16} strokeWidth={1.7} /></button>
                <button type="button" className="min-h-11 min-w-11 lm-panel-toggle" aria-expanded={Boolean(openPanels.weather || pinnedPanels.weather)} aria-pressed={pinnedPanels.weather} aria-label={pinnedPanels.weather ? 'Lepas panel prakiraan' : 'Pertahankan panel prakiraan terbuka'} title={pinnedPanels.weather ? 'Lepas panel prakiraan' : 'Pertahankan panel prakiraan terbuka'} onClick={() => toggleBottomPin('weather')}>{pinnedPanels.weather ? '⌖' : '⌃'}</button>
              </div>
            </header>
            <div className="lm-bottom-content" inert={collapsed.weather || undefined} aria-hidden={collapsed.weather || undefined}>
              <div ref={barsRef} className="lm-bars">
                <HourStrip hours={hours12} interactive className="lm-hourstrip" />
              </div>
              <div className="lm-bottom-caption text-caption text-ink-muted dark:text-mist-subtle">12 jam dari data aplikasi. Tidak ada prakiraan tambahan di luar kontrak service.</div>
            </div>
          </article>

          <article className={`lm-bottom-panel lm-season-panel lm-bottom-major${openPanels.season || pinnedPanels.season ? ' is-open' : ''}${pinnedPanels.season ? ' is-pinned' : ''}`} {...bottomProps('season')}>
            <header className="lm-bottom-head">
              <h2 className="text-body-sm font-semibold text-ink dark:text-mist">Kebun &amp; musim</h2>
              <div className="lm-bottom-actions">
                <button ref={(node) => { expandRef.current.season = node }} type="button" className="min-h-11 min-w-11 lm-panel-expand" aria-haspopup="dialog" aria-label="Perlebar panel kebun dan musim" title="Perlebar panel kebun dan musim" onClick={() => setExpandedPanel('season')}><Maximize2 aria-hidden="true" size={16} strokeWidth={1.7} /></button>
                <button type="button" className="min-h-11 min-w-11 lm-panel-toggle" aria-expanded={Boolean(openPanels.season || pinnedPanels.season)} aria-pressed={pinnedPanels.season} aria-label={pinnedPanels.season ? 'Lepas panel kebun dan musim' : 'Pertahankan panel kebun dan musim terbuka'} title={pinnedPanels.season ? 'Lepas panel kebun dan musim' : 'Pertahankan panel kebun dan musim terbuka'} onClick={() => toggleBottomPin('season')}>{pinnedPanels.season ? '⌖' : '⌃'}</button>
              </div>
            </header>
            <div className="lm-bottom-content" inert={collapsed.season || undefined} aria-hidden={collapsed.season || undefined}>
              <CoffeeAdvisory coffee={data?.coffee} tr={tr} />
              <SeasonalBanner seasonal={data?.disaster?.seasonal} tr={tr} />
            </div>
          </article>
        </div>
      </div>

      {showInspector && (isModal && typeof document !== 'undefined'
        ? createPortal(
          <>
            <button type="button" tabIndex={-1} data-lm-modal-keep aria-label="Kembalikan panel konteks ke Mode 1" className="lm-modal-scrim min-h-11" onClick={() => setDrawerMode('1')} />
            {contextPanel}
          </>,
          document.body
        )
        : contextPanel)}

      {expandedPanel && typeof document !== 'undefined' && createPortal(
        <div
          className="lm-panel-modal-layer"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setExpandedPanel(null) }}
        >
          <div
            ref={panelModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lm-panel-modal-title"
            className="lm-panel-modal"
            tabIndex={-1}
          >
            <header className="lm-panel-modal-head">
              <h2 id="lm-panel-modal-title" className="text-body font-semibold">{expandedPanel === 'weather' ? 'Waktu & prakiraan' : 'Kebun & musim'}</h2>
              <button type="button" className="min-h-11 min-w-11" aria-label="Tutup panel yang diperlebar" title="Tutup panel" onClick={() => setExpandedPanel(null)}>
                <X aria-hidden="true" size={18} strokeWidth={1.7} />
              </button>
            </header>
            <div className="lm-panel-modal-body">
              {expandedPanel === 'weather' ? (
                <>
                  <HourStrip hours={data?.hourly?.slice(0, 12) ?? []} interactive className="lm-hourstrip" />
                  <p className="text-caption">12 jam dari data aplikasi. Tidak ada prakiraan tambahan di luar kontrak service.</p>
                </>
              ) : (
                <>
                  <CoffeeAdvisory coffee={data?.coffee} tr={tr} />
                  <SeasonalBanner seasonal={data?.disaster?.seasonal} tr={tr} />
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} items={paletteItems} />
      <p className="sr-only" aria-live="polite">{`Sentra terpilih: ${location?.name ?? ''}. Panel ${PANELS.find((panel) => panel.id === activePanel)?.label ?? ''}.`}</p>
    </div>
  )
}
