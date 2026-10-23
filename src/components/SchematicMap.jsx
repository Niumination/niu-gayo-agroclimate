import { useEffect, useMemo, useRef, useState } from 'react'
import kecamatan from '../data/geo/kecamatan.json'
import { LOCATIONS } from '../data/locations.js'
import { makeProjection, geometryToPath, featureBbox, haversineKm, placeLabels, BURNI_TELONG } from '../domain/geo.js'
import { arrowToDirection, nextPin } from '../lib/pinNav.js'

/** Peta skematik SVG offline dengan pin sentra yang bisa dipilih, disorot, dizum, dan digeser. */
const FILL = { ekstrem: 'var(--color-level-ekstrem)', bahaya: 'var(--color-level-bahaya)', waspada: 'var(--color-level-waspada)', rendah: 'var(--color-level-rendah)', 'n/a': 'var(--color-line-strong)' }
const LABEL = { ekstrem: 'Ekstrem', bahaya: 'Bahaya', waspada: 'Waspada', rendah: 'Rendah', 'n/a': 'Tidak tersedia' }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

export default function SchematicMap({
  hazardsAll,
  selectedLocation,
  highlightedLocationId,
  onHighlightLocation,
  onSelectLocation,
  hotspots = [],
  compact = false,
  layers,
  onLayerChange,
  bare = false,
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  // Sapuan "data baru" — hanya untuk peta Living Map (bare), sekali jalan per pembaruan.
  const [scanTick, setScanTick] = useState(0)
  const lastStampRef = useRef(null)
  const [internalHighlight, setInternalHighlight] = useState(null)
  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)
  const suppressTimerRef = useRef(null)
  const geo = useMemo(() => {
    const features = kecamatan.features ?? []
    const bbox = featureBbox(features)
    const proj = makeProjection(bbox, { width: 600, height: compact ? 400 : 460, padding: 14 })
    const paths = features.map((feature) => ({
      id: feature.properties.id,
      name: feature.properties.name,
      kab: feature.properties.kab,
      d: geometryToPath(feature.geometry, proj.project),
    }))
    const volcano = proj.project(BURNI_TELONG.lon, BURNI_TELONG.lat)
    return { proj, paths, volcano, radiusPx: proj.kmToPx(BURNI_TELONG.radiusKm) }
  }, [compact])

  const levels = useMemo(() => Object.fromEntries((hazardsAll?.locations ?? []).map((location) => [location.id, location])), [hazardsAll])
  const { proj, paths, volcano, radiusPx } = geo
  const sentra = LOCATIONS.map((location) => {
    const [x, y] = proj.project(location.lon, location.lat)
    const row = levels[location.id]
    return {
      ...location,
      x,
      y,
      worst: layers?.risk === false ? 'n/a' : row?.worst ?? 'n/a',
      active: layers?.risk === false ? [] : row?.active ?? [],
      distVolcanoKm: haversineKm(location.lat, location.lon, BURNI_TELONG.lat, BURNI_TELONG.lon),
    }
  })
  // U5 — label peta 8,5 px terlalu kecil di jendela sempit. Di bawah 1200 px
  // dicoba 9,5 px dulu; label yang tidak muat (klaster Takengon) turun ke 8,5 px
  // supaya tidak ada sentra yang kehilangan label atau keluar dari peta.
  const [narrowMap, setNarrowMap] = useState(false)
  useEffect(() => {
    if (!bare) return undefined
    const mq = window.matchMedia('(max-width: 1199px)')
    const sync = () => setNarrowMap(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [bare])
  const labelFontSize = 8.5
  const narrowLabelSize = 9.5
  // U4 — jangan biarkan peta "kosong tanpa alasan": hitung sentra yang belum
  // punya level. Saat lapisan risiko dimatikan, semua memang n/a, jadi diamkan.
  const missingCount = layers?.risk === false ? 0 : sentra.filter((location) => location.worst === 'n/a').length
  const nearVolcano = sentra.filter((location) => location.distVolcanoKm <= 15).sort((a, b) => a.distVolcanoKm - b.distVolcanoKm)
  const rank = { ekstrem: 4, bahaya: 3, waspada: 2, rendah: 1, 'n/a': 0 }
  const shortName = (name) => name.replace(/\s*\(.*\)$/, '')
  const labelText = (name) => shortName(name)
  const labelPoints = sentra.map((location) => ({
    id: location.id,
    x: location.x,
    y: location.y,
    text: labelText(location.name),
    priority: (location.id === selectedLocation?.id ? 10 : 0) + rank[location.worst],
    force: location.id === selectedLocation?.id,
  }))
  const labelBoxes = [...sentra.map((location) => ({ x1: location.x - 6, x2: location.x + 6, y1: location.y - 6, y2: location.y + 6 })), { x1: volcano[0] - 8, x2: volcano[0] + 95, y1: volcano[1] - 14, y2: volcano[1] + 6 }]
  // Susunan label dasar 8,5 px (semua sentra yang muat), lalu di jendela sempit
  // tiap label dicoba dinaikkan ke 9,5 px satu per satu bila kotaknya tetap
  // bebas. Hasilnya: ukuran naik tanpa ada label yang hilang dibanding dasar.
  const labelRect = (point, position, size) => {
    const width = point.text.length * size * 0.55
    const left = position.anchor === 'start' ? position.x : position.anchor === 'end' ? position.x - width : position.x - width / 2
    return { x1: left, x2: left + width, y1: position.y - size / 2, y2: position.y + size / 2 }
  }
  const labelCandidates = (point, size, gap) => {
    const width = point.text.length * size * 0.55
    const height = size
    return [
      { x: point.x + gap, y: point.y + height * 0.35, anchor: 'start', box: { x1: point.x + gap, x2: point.x + gap + width, y1: point.y - height / 2, y2: point.y + height / 2 } },
      { x: point.x - gap, y: point.y + height * 0.35, anchor: 'end', box: { x1: point.x - gap - width, x2: point.x - gap, y1: point.y - height / 2, y2: point.y + height / 2 } },
      { x: point.x, y: point.y + gap + height * 0.9, anchor: 'middle', box: { x1: point.x - width / 2, x2: point.x + width / 2, y1: point.y + gap, y2: point.y + gap + height } },
      { x: point.x, y: point.y - gap - height * 0.2, anchor: 'middle', box: { x1: point.x - width / 2, x2: point.x + width / 2, y1: point.y - gap - height, y2: point.y - gap } },
    ]
  }
  const labelHits = (box, others) => others.some((other) => !(box.x2 < other.x1 || box.x1 > other.x2 || box.y2 < other.y1 || box.y1 > other.y2))
  const labels = { ...placeLabels(labelPoints, { fontSize: labelFontSize, boxes: labelBoxes }) }
  if (narrowMap) {
    const occupied = new Map()
    for (const point of labelPoints) {
      if (labels[point.id]) occupied.set(point.id, labelRect(point, labels[point.id], labelFontSize))
    }
    const order = [...labelPoints].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0))
    for (const point of order) {
      if (!labels[point.id]) continue
      const others = [...labelBoxes, ...[...occupied].filter(([id]) => id !== point.id).map(([, box]) => box)]
      const candidate = labelCandidates(point, narrowLabelSize, 7).find((option) => !labelHits(option.box, others))
      if (!candidate) continue
      labels[point.id] = { x: candidate.x, y: candidate.y, anchor: candidate.anchor, size: narrowLabelSize }
      occupied.set(point.id, candidate.box)
    }
  }
  const asOf = hazardsAll?.retrievedAt
    ? new Date(hazardsAll.retrievedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : null
  const activeHighlight = highlightedLocationId === undefined ? internalHighlight : highlightedLocationId
  // U1 — satu pin masuk urutan Tab; panah berpindah pin, Enter/Space memilih.
  const [rovingPin, setRovingPin] = useState(null)
  const selectedPinId = selectedLocation?.id ?? null
  useEffect(() => {
    if (selectedPinId) setRovingPin(selectedPinId)
  }, [selectedPinId])
  const pinIds = sentra.map((location) => location.id)
  const rovingId = pinIds.includes(rovingPin) ? rovingPin : pinIds.includes(selectedPinId) ? selectedPinId : pinIds[0]
  const focusPin = (id) => {
    setRovingPin(id)
    requestAnimationFrame(() => svgRef.current?.querySelector(`[data-map-pin="${id}"]`)?.focus())
  }
  const panZoomEnabled = !compact
  const centerX = proj.width / 2
  const centerY = proj.height / 2
  const transform = `translate(${pan.x} ${pan.y}) translate(${centerX} ${centerY}) scale(${zoom}) translate(${-centerX} ${-centerY})`

  // Picu sapuan hanya saat cap waktu data berubah (bukan pada muat pertama).
  const retrievedStamp = hazardsAll?.retrievedAt ? String(hazardsAll.retrievedAt) : null
  useEffect(() => {
    if (!bare || !retrievedStamp) return
    if (lastStampRef.current && lastStampRef.current !== retrievedStamp) setScanTick((tick) => tick + 1)
    lastStampRef.current = retrievedStamp
  }, [bare, retrievedStamp])

  useEffect(() => () => {
    if (suppressTimerRef.current) window.clearTimeout(suppressTimerRef.current)
  }, [])

  const setHighlight = (id) => {
    setInternalHighlight(id)
    onHighlightLocation?.(id)
  }

  const onPointerDown = (event) => {
    if (!panZoomEnabled || event.button !== 0) return
    if (event.target.closest?.('[data-map-pin]')) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startPan: pan,
      rect,
      moved: false,
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId)
    } catch { /* pointer capture tidak didukung peramban lama */ }
  }

  const onPointerMove = (event) => {
    const drag = dragRef.current
    if (!panZoomEnabled || !drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY
    if (!drag.moved && Math.hypot(deltaX, deltaY) < 4) return
    drag.moved = true
    const svgDeltaX = deltaX * (proj.width / Math.max(drag.rect.width, 1))
    const svgDeltaY = deltaY * (proj.height / Math.max(drag.rect.height, 1))
    const maxX = Math.max(18, (proj.width * (zoom - 1)) / 2)
    const maxY = Math.max(18, (proj.height * (zoom - 1)) / 2)
    setPan({
      x: clamp(drag.startPan.x + svgDeltaX, -maxX, maxX),
      y: clamp(drag.startPan.y + svgDeltaY, -maxY, maxY),
    })
  }

  const endPointer = (event) => {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.moved) {
      suppressClickRef.current = true
      if (suppressTimerRef.current) window.clearTimeout(suppressTimerRef.current)
      suppressTimerRef.current = window.setTimeout(() => {
        suppressClickRef.current = false
        suppressTimerRef.current = null
      }, 250)
    }
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    } catch { /* pointer capture tidak didukung peramban lama */ }
    dragRef.current = null
  }

  const onClickCapture = (event) => {
    if (!suppressClickRef.current) return
    event.preventDefault()
    event.stopPropagation()
    suppressClickRef.current = false
    if (suppressTimerRef.current) window.clearTimeout(suppressTimerRef.current)
    suppressTimerRef.current = null
  }

  const selectLocation = (event, location) => {
    event.stopPropagation()
    onSelectLocation?.(location)
  }

  const onPinKeyDown = (event, location) => {
    const direction = arrowToDirection(event.key)
    if (direction) {
      event.preventDefault()
      const target = nextPin(sentra.map((item) => ({ id: item.id, x: item.x, y: item.y })), location.id, direction)
      if (target && target !== location.id) focusPin(target)
      return
    }
    if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault()
      const target = event.key === 'Home' ? pinIds[0] : pinIds[pinIds.length - 1]
      if (target) focusPin(target)
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
    event.preventDefault()
    onSelectLocation?.(location)
  }

  const resetMap = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  // Baris alat prototipe V4: zoom + layer sebagai satu kelompok tombol, legenda
  // tingkat bahaya di baris yang sama. Di peta tanpa bingkai, baris ini yang
  // menggantikan deretan kontrol melayang di kanan.
  const zoomButtons = (
    <>
      <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} aria-label="Perbesar peta" title="Perbesar peta" className="min-h-11 min-w-11 active:scale-[.97]">+</button>
      <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} aria-label="Perkecil peta" title="Perkecil peta" className="min-h-11 min-w-11 active:scale-[.97]">−</button>
      <button type="button" onClick={resetMap} aria-label="Atur ulang tampilan peta" title="Atur ulang tampilan peta" className="min-h-11 min-w-11 active:scale-[.97]">⟲</button>
    </>
  )

  const layerButtons = (withIcon) => (onLayerChange && layers ? [
    ['boundaries', 'Batas wilayah'], ['sentra', 'Sentra'], ['risk', 'Risiko'], ['hotspots', 'Hotspot'],
  ].map(([id, label]) => (
    <button key={id} type="button" onClick={() => onLayerChange(id)} aria-label={`${layers[id] ? 'Sembunyikan' : 'Tampilkan'} layer ${label.toLowerCase()}`} aria-pressed={Boolean(layers[id])} title={label} className={`min-h-11 text-caption active:scale-[.97] ${layers[id] ? 'niu-map-layer-active' : ''}`}>
      {withIcon && <span className="niu-map-layer-icon" aria-hidden="true" />}
      {label}
    </button>
  )) : null)

  // Tanpa bingkai: satu kelompok bertingkat (zoom | layer) untuk baris alat.
  const groupedControls = (
    <div className="niu-map-controls" role="group" aria-label="Kontrol peta">
      <div className="niu-map-zoom" role="group" aria-label="Zoom peta">{zoomButtons}</div>
      {onLayerChange && layers && (
        <div className="niu-map-layer-set" role="group" aria-label="Layer peta">{layerButtons(true)}</div>
      )}
    </div>
  )

  // Kartu peta biasa (papan kerja): struktur tombol tetap seperti sebelumnya.
  const flatControls = (
    <div className="niu-map-controls" role="group" aria-label="Kontrol peta">
      {zoomButtons}
      {layerButtons(false)}
    </div>
  )

  // U3 — legenda bukan lagi hiasan: kelompok warna risiko dan chip hotspot
  // sekaligus tombol lapisan, sehingga state `layers` dan legenda selalu sama.
  const riskLegend = ['ekstrem', 'bahaya', 'waspada', 'rendah', 'n/a'].map((level) => (
    <span key={level} className="inline-flex items-center gap-1"><span className="niu-map-legend-dot w-2 h-2 rounded-full" style={{ background: FILL[level] }} />{LABEL[level]}</span>
  ))
  const volcanoLegend = (
    <span key="volcano" className="inline-flex items-center gap-1" title="Gunung api Burni Telong (PVMBG)">
      <span className="w-2 h-2 bg-level-bahaya" style={{ clipPath: 'polygon(50% 0,0 100%,100% 100%)' }} />gunung api
    </span>
  )
  const hotspotLegend = (
    <span className="inline-flex items-center gap-1">
      <span className={bare ? 'niu-map-legend-dot w-2 h-2 bg-[#f97316]' : 'niu-map-legend-dot w-2 h-2 rounded-full bg-[#f97316]'} style={bare ? { clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' } : undefined} />hotspot
    </span>
  )
  const legendToggle = (id, label, content) => {
    const interactive = Boolean(onLayerChange && layers)
    const on = Boolean(layers?.[id])
    if (!interactive) return <span key={id} className="inline-flex items-center">{content}</span>
    return (
      <button
        key={id}
        type="button"
        className="niu-map-legend-toggle min-h-11"
        aria-pressed={on}
        title={`${on ? 'Sembunyikan' : 'Tampilkan'} ${label}`}
        onClick={() => onLayerChange(id)}
      >
        {content}
        {/* Audit F-07 — aria-label lama tidak memuat teks legenda yang terlihat
            ("Ekstrem, Bahaya, …"), sehingga axe menandainya label-content-name-mismatch.
            Aksi ditulis sebagai teks tersembunyi agar nama = teks tampak + tindakan. */}
        <span className="sr-only"> — {on ? 'sembunyikan' : 'tampilkan'} {label}</span>
      </button>
    )
  }
  const legendItems = (
    <>
      {legendToggle('risk', 'warna risiko', riskLegend)}
      {volcanoLegend}
      {legendToggle('hotspots', 'titik panas', hotspotLegend)}
    </>
  )

  return (
    <section aria-label="Peta skematik bahaya 15 sentra" data-niu-card="map" className={bare ? 'niu-map-card niu-map-card--bare' : 'niu-map-card bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5'}>
      {!bare && <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Peta skematik bahaya</h2>
          <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Warna = level tertinggi per sentra{asOf ? ` · ${asOf} WIB` : ''} · bukan peta navigasi</p>
        </div>
        {hazardsAll?.worst && (
          <span className="text-caption text-ink-muted dark:text-mist-muted text-right">
            Tertinggi: <span className="font-semibold" style={{ color: FILL[hazardsAll.worst.level] }}>{hazardsAll.worst.name}</span>
          </span>
        )}
      </div>}

      <div className={`niu-map-wrap${panZoomEnabled ? ' niu-map-wrap--interactive' : ''}`}>
        {panZoomEnabled && !bare && flatControls}
        <svg
          ref={svgRef}
          viewBox={`0 0 ${proj.width} ${proj.height}`}
          role="group"
          aria-label="Peta kecamatan Aceh Tengah dan Bener Meriah dengan 15 sentra kopi yang dapat dipilih"
          className="niu-map-svg w-full h-auto"
          style={{ touchAction: panZoomEnabled ? 'none' : 'auto' }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPointer}
          onPointerCancel={endPointer}
          onClickCapture={onClickCapture}
        >
          <title>Peta skematik bahaya — Aceh Tengah dan Bener Meriah</title>
          <desc>Satu titik Tab untuk peta. Gunakan panah kiri, kanan, atas, dan bawah untuk berpindah antar sentra, Home/End ke ujung daftar, lalu Enter atau Spasi untuk memilih. Di desktop, seret peta untuk menggeser; kontrol tambah, kurang, dan atur ulang mengubah tampilan.</desc>
          <g transform={transform}>
            {layers?.boundaries !== false && paths.map((path) => (
              <path key={path.id} d={path.d} fill={path.kab === 'Aceh Tengah' ? 'currentColor' : 'none'} fillOpacity={path.kab === 'Aceh Tengah' ? 0.06 : 0} stroke="currentColor" strokeOpacity={path.kab === 'Aceh Tengah' ? 0.35 : 0.18} strokeWidth={0.8} strokeDasharray={path.kab === 'Aceh Tengah' ? undefined : '3 2'} className="text-ink dark:text-mist">
                <title>{`${path.name} (${path.kab})`}</title>
              </path>
            ))}
            <circle className={bare ? 'niu-volcano-ring' : undefined} cx={volcano[0]} cy={volcano[1]} r={radiusPx} fill="var(--color-level-bahaya)" fillOpacity={0.12} stroke="var(--color-level-bahaya)" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="2 2" />
            <polygon points={`${volcano[0]},${volcano[1] - 6} ${volcano[0] - 5},${volcano[1] + 4} ${volcano[0] + 5},${volcano[1] + 4}`} fill="var(--color-level-bahaya)">
              <title>{`${BURNI_TELONG.name} — Level ${BURNI_TELONG.level}, radius ${BURNI_TELONG.radiusKm} km (${BURNI_TELONG.source})`}</title>
            </polygon>
            <text x={volcano[0] + 8} y={volcano[1] - 4} fontSize="9" fill="var(--color-level-bahaya)">Burni Telong (Lv II)</text>
            {layers?.hotspots !== false && hotspots.filter((hotspot) => Number.isFinite(Number(hotspot?.lat)) && Number.isFinite(Number(hotspot?.lon))).map((hotspot, index) => {
              const [x, y] = proj.project(hotspot.lon, hotspot.lat)
              const hotspotLabel = `Hotspot ${hotspot.satellite ?? ''} ${hotspot.frp ? `FRP ${hotspot.frp} MW` : ''}`.trim()
              const hotspotKey = `${hotspot.satellite ?? 'hotspot'}-${index}`
              // Bentuk membedakan entitas: belah ketupat di peta Living Map, lingkaran di peta lain.
              return bare ? (
                <g key={hotspotKey} className={index < 3 ? 'niu-map-hotspot' : undefined} style={index < 3 ? { animationDelay: `${index * 2}s` } : undefined}>
                  <rect x={x - 3.5} y={y - 3.5} width={7} height={7} rx={1} transform={`rotate(45 ${x} ${y})`} fill="#f97316" fillOpacity={0.9}>
                    <title>{hotspotLabel}</title>
                  </rect>
                </g>
              ) : (
                <circle key={hotspotKey} cx={x} cy={y} r={3} fill="#f97316" fillOpacity={0.8}>
                  <title>{hotspotLabel}</title>
                </circle>
              )
            })}
            {layers?.sentra !== false && sentra.map((location) => {
              const selected = location.id === selectedLocation?.id
              const highlighted = location.id === activeHighlight
              const label = layers?.risk === false ? location.name : `${location.name}: ${LABEL[location.worst]}${location.active.length ? ` (${location.active.join(', ')})` : ''}`
              return (
                <g
                  key={location.id}
                  data-map-pin={location.id}
                  onClick={(event) => selectLocation(event, location)}
                  onKeyDown={(event) => onPinKeyDown(event, location)}
                  onPointerEnter={() => setHighlight(location.id)}
                  onPointerLeave={() => setHighlight(null)}
                  onFocus={() => { setHighlight(location.id); setRovingPin(location.id) }}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setHighlight(null)
                  }}
                  style={{ cursor: onSelectLocation ? 'pointer' : 'default' }}
                  role={onSelectLocation ? 'button' : undefined}
                  tabIndex={onSelectLocation ? (location.id === rovingId ? 0 : -1) : undefined}
                  aria-label={onSelectLocation ? label : undefined}
                  aria-current={selected ? 'true' : undefined}
                >
                  {highlighted && <circle className="niu-pin-highlight text-ink dark:text-mist" cx={location.x} cy={location.y} r={13} fill="none" stroke="currentColor" strokeOpacity={0.9} strokeWidth={1.5} strokeDasharray="2 2" />}
                  {bare && location.worst === 'ekstrem' && (
                    <circle cx={location.x} cy={location.y} r={12.5} fill={FILL[location.worst]} fillOpacity={0.16} aria-hidden="true" />
                  )}
                  {bare && selected && (
                    <>
                      <circle className="niu-pin-sonar" cx={location.x} cy={location.y} r={16} fill="none" stroke={FILL[location.worst]} aria-hidden="true" />
                      <circle className="niu-pin-sonar niu-pin-sonar--late" cx={location.x} cy={location.y} r={16} fill="none" stroke={FILL[location.worst]} aria-hidden="true" />
                    </>
                  )}
                  {selected && <circle cx={location.x} cy={location.y} r={10} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.2} className="text-ink dark:text-mist" />}
                  {/* Audit F-26 — bidang ketuk 24 px (WCAG 2.2 SC 2.5.8). Transparan,
                      tidak mengubah tampilan; hanya memperluas area hover/klik pin. */}
                  {onSelectLocation && <circle cx={location.x} cy={location.y} r={12} fill="transparent" data-map-hit="true" aria-hidden="true" />}
                  <circle cx={location.x} cy={location.y} r={location.worst === 'ekstrem' ? 7 : 5.5} fill={FILL[location.worst]} stroke="#fff" strokeWidth={1}>
                    <title>{label}</title>
                  </circle>
                  {labels[location.id] && (
                    <text
                      x={labels[location.id].x}
                      y={labels[location.id].y}
                      textAnchor={labels[location.id].anchor}
                      fontSize={labels[location.id].size ?? labelFontSize}
                      fontWeight={selected || highlighted ? 700 : 400}
                      fill="currentColor"
                      fillOpacity={selected || highlighted ? 1 : 0.86}
                      className="niu-pin-label text-ink dark:text-mist"
                      data-narrow={narrowMap ? 'true' : undefined}
                    >{labelText(location.name)}</text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
        {bare && scanTick > 0 && <span key={scanTick} className="niu-map-scan" aria-hidden="true" />}
      </div>

      {bare && missingCount >= 3 && (
        <p className="niu-map-data-note" role="status">
          {missingCount} dari {sentra.length} sentra belum punya data · coba muat ulang
        </p>
      )}

      {bare ? (
        <div className="niu-map-toolrow">
          {panZoomEnabled && groupedControls}
          <div className="niu-map-legend-overlay" role="group" aria-label="Legenda peta: warna risiko dan titik panas">
            {legendItems}
          </div>
        </div>
      ) : (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted dark:text-mist-muted">
          {legendItems}
        </div>
      )}
      {nearVolcano.length > 0 && (
        <p className={bare ? 'sr-only' : 'mt-2 text-caption text-ink-muted dark:text-mist-subtle'}>
          Jarak ke Burni Telong: {nearVolcano.map((location) => `${location.name.replace(/\s*\(.*\)$/, '')} ${location.distVolcanoKm.toFixed(1)} km`).join(' · ')}. Status gunung api dari PVMBG/MAGMA (tidak otomatis).
        </p>
      )}
    </section>
  )
}
