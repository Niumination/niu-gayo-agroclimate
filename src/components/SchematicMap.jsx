import { useEffect, useMemo, useRef, useState } from 'react'
import kecamatan from '../data/geo/kecamatan.json'
import { LOCATIONS } from '../data/locations.js'
import { makeProjection, geometryToPath, featureBbox, haversineKm, placeLabels, BURNI_TELONG } from '../domain/geo.js'

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
}) {
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
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
      worst: row?.worst ?? 'n/a',
      active: row?.active ?? [],
      distVolcanoKm: haversineKm(location.lat, location.lon, BURNI_TELONG.lat, BURNI_TELONG.lon),
    }
  })
  const nearVolcano = sentra.filter((location) => location.distVolcanoKm <= 15).sort((a, b) => a.distVolcanoKm - b.distVolcanoKm)
  const rank = { ekstrem: 4, bahaya: 3, waspada: 2, rendah: 1, 'n/a': 0 }
  const shortName = (name) => name.replace(/\s*\(.*\)$/, '')
  const labels = placeLabels(
    sentra.map((location) => ({
      id: location.id,
      x: location.x,
      y: location.y,
      text: shortName(location.name),
      priority: (location.id === selectedLocation?.id ? 10 : 0) + rank[location.worst],
    })),
    { boxes: [...sentra.map((location) => ({ x1: location.x - 6, x2: location.x + 6, y1: location.y - 6, y2: location.y + 6 })), { x1: volcano[0] - 8, x2: volcano[0] + 95, y1: volcano[1] - 14, y2: volcano[1] + 6 }] }
  )
  const asOf = hazardsAll?.retrievedAt
    ? new Date(hazardsAll.retrievedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
    : null
  const activeHighlight = highlightedLocationId === undefined ? internalHighlight : highlightedLocationId
  const panZoomEnabled = !compact
  const centerX = proj.width / 2
  const centerY = proj.height / 2
  const transform = `translate(${pan.x} ${pan.y}) translate(${centerX} ${centerY}) scale(${zoom}) translate(${-centerX} ${-centerY})`

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
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') return
    event.preventDefault()
    onSelectLocation?.(location)
  }

  const resetMap = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  return (
    <section aria-label="Peta skematik bahaya 15 sentra" data-niu-card="map" className="niu-map-card bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Peta skematik bahaya</h2>
          <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Warna = level tertinggi per sentra{asOf ? ` · ${asOf} WIB` : ''} · bukan peta navigasi</p>
        </div>
        {hazardsAll?.worst && (
          <span className="text-caption text-ink-muted dark:text-mist-muted text-right">
            Tertinggi: <span className="font-semibold" style={{ color: FILL[hazardsAll.worst.level] }}>{hazardsAll.worst.name}</span>
          </span>
        )}
      </div>

      <div className={`niu-map-wrap${panZoomEnabled ? ' niu-map-wrap--interactive' : ''}`}>
        {panZoomEnabled && (
          <div className="niu-map-controls" role="group" aria-label="Kontrol peta">
            <button type="button" onClick={() => setZoom((value) => Math.min(3, Number((value + 0.25).toFixed(2))))} aria-label="Perbesar peta" title="Perbesar peta" className="min-h-11 min-w-11 active:scale-[.97]">+</button>
            <button type="button" onClick={() => setZoom((value) => Math.max(1, Number((value - 0.25).toFixed(2))))} aria-label="Perkecil peta" title="Perkecil peta" className="min-h-11 min-w-11 active:scale-[.97]">−</button>
            <button type="button" onClick={resetMap} aria-label="Atur ulang tampilan peta" title="Atur ulang tampilan peta" className="min-h-11 min-w-11 active:scale-[.97]">⟲</button>
          </div>
        )}
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
          <desc>Pilih pin sentra dengan klik atau papan ketik. Di desktop, seret peta untuk menggeser; gunakan kontrol tambah, kurang, dan atur ulang untuk mengubah tampilan.</desc>
          <g transform={transform}>
            {paths.map((path) => (
              <path key={path.id} d={path.d} fill={path.kab === 'Aceh Tengah' ? 'currentColor' : 'none'} fillOpacity={path.kab === 'Aceh Tengah' ? 0.06 : 0} stroke="currentColor" strokeOpacity={path.kab === 'Aceh Tengah' ? 0.35 : 0.18} strokeWidth={0.8} strokeDasharray={path.kab === 'Aceh Tengah' ? undefined : '3 2'} className="text-ink dark:text-mist">
                <title>{`${path.name} (${path.kab})`}</title>
              </path>
            ))}
            <circle cx={volcano[0]} cy={volcano[1]} r={radiusPx} fill="var(--color-level-bahaya)" fillOpacity={0.12} stroke="var(--color-level-bahaya)" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="2 2" />
            <polygon points={`${volcano[0]},${volcano[1] - 6} ${volcano[0] - 5},${volcano[1] + 4} ${volcano[0] + 5},${volcano[1] + 4}`} fill="var(--color-level-bahaya)">
              <title>{`${BURNI_TELONG.name} — Level ${BURNI_TELONG.level}, radius ${BURNI_TELONG.radiusKm} km (${BURNI_TELONG.source})`}</title>
            </polygon>
            <text x={volcano[0] + 8} y={volcano[1] - 4} fontSize="9" fill="var(--color-level-bahaya)">Burni Telong (Lv II)</text>
            {hotspots.map((hotspot, index) => {
              const [x, y] = proj.project(hotspot.lon, hotspot.lat)
              return (
                <circle key={`${hotspot.satellite ?? 'hotspot'}-${index}`} cx={x} cy={y} r={3} fill="#f97316" fillOpacity={0.8}>
                  <title>{`Hotspot ${hotspot.satellite ?? ''} ${hotspot.frp ? `FRP ${hotspot.frp} MW` : ''}`.trim()}</title>
                </circle>
              )
            })}
            {sentra.map((location) => {
              const selected = location.id === selectedLocation?.id
              const highlighted = location.id === activeHighlight
              const label = `${location.name}: ${LABEL[location.worst]}${location.active.length ? ` (${location.active.join(', ')})` : ''}`
              return (
                <g
                  key={location.id}
                  data-map-pin={location.id}
                  onClick={(event) => selectLocation(event, location)}
                  onKeyDown={(event) => onPinKeyDown(event, location)}
                  onPointerEnter={() => setHighlight(location.id)}
                  onPointerLeave={() => setHighlight(null)}
                  onFocus={() => setHighlight(location.id)}
                  onBlur={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) setHighlight(null)
                  }}
                  style={{ cursor: onSelectLocation ? 'pointer' : 'default' }}
                  role={onSelectLocation ? 'button' : undefined}
                  tabIndex={onSelectLocation ? 0 : undefined}
                  aria-label={onSelectLocation ? label : undefined}
                  aria-current={selected ? 'true' : undefined}
                >
                  {highlighted && <circle cx={location.x} cy={location.y} r={13} fill="none" stroke="currentColor" strokeOpacity={0.9} strokeWidth={1.5} strokeDasharray="2 2" className="text-ink dark:text-mist" />}
                  {selected && <circle cx={location.x} cy={location.y} r={10} fill="none" stroke="currentColor" strokeOpacity={0.7} strokeWidth={1.2} className="text-ink dark:text-mist" />}
                  <circle cx={location.x} cy={location.y} r={location.worst === 'ekstrem' ? 7 : 5.5} fill={FILL[location.worst]} stroke="#fff" strokeWidth={1}>
                    <title>{label}</title>
                  </circle>
                  {labels[location.id] && (
                    <text x={labels[location.id].x} y={labels[location.id].y} textAnchor={labels[location.id].anchor} fontSize="8.5" fontWeight={selected || highlighted ? 600 : 400} fill="currentColor" fillOpacity={selected || highlighted ? 1 : 0.75} className="text-ink dark:text-mist">{shortName(location.name)}</text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted dark:text-mist-muted">
        {['ekstrem', 'bahaya', 'waspada', 'rendah', 'n/a'].map((level) => (
          <span key={level} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL[level] }} />{LABEL[level]}</span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-level-bahaya" style={{ clipPath: 'polygon(50% 0,0 100%,100% 100%)' }} />gunung api</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" />hotspot</span>
      </div>
      {nearVolcano.length > 0 && (
        <p className="mt-2 text-caption text-ink-muted dark:text-mist-subtle">
          Jarak ke Burni Telong: {nearVolcano.map((location) => `${location.name.replace(/\s*\(.*\)$/, '')} ${location.distVolcanoKm.toFixed(1)} km`).join(' · ')}. Status gunung api dari PVMBG/MAGMA (tidak otomatis).
        </p>
      )}
    </section>
  )
}
