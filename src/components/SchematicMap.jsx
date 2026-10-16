import {  useMemo  } from 'react'
import kecamatan from '../data/geo/kecamatan.json'
import { LOCATIONS } from '../data/locations.js'
import { makeProjection, geometryToPath, featureBbox, haversineKm, placeLabels, BURNI_TELONG } from '../domain/geo.js'

/**
 * Fase 1.6b (FR-API-6 / FR-X-2) — peta skematik SVG inline: batas kecamatan GADM (Aceh Tengah + Bener Meriah),
 * 15 sentra diwarnai level bahaya tertinggi (dari /api/hazards?location=all), Burni Telong + radius rekomendasi 3 km,
 * titik panas terdekat (bila ada). Tanpa tile/pustaka peta; dapat dirender offline (PWA). Klik sentra → pilih lokasi.
 */
const FILL = { ekstrem: 'var(--color-level-ekstrem)', bahaya: 'var(--color-level-bahaya)', waspada: 'var(--color-level-waspada)', rendah: 'var(--color-level-rendah)', 'n/a': 'var(--color-line-strong)' }
const LABEL = { ekstrem: 'Ekstrem', bahaya: 'Bahaya', waspada: 'Waspada', rendah: 'Rendah', 'n/a': 'Tidak tersedia' }

export default function SchematicMap({ hazardsAll, selectedLocation, onSelectLocation, hotspots = [], compact = false }) {
  const geo = useMemo(() => {
    const features = kecamatan.features ?? []
    const bbox = featureBbox(features)
    const proj = makeProjection(bbox, { width: 600, height: compact ? 400 : 460, padding: 14 })
    const paths = features.map((f) => ({ id: f.properties.id, name: f.properties.name, kab: f.properties.kab, d: geometryToPath(f.geometry, proj.project) }))
    const volcano = proj.project(BURNI_TELONG.lon, BURNI_TELONG.lat)
    return { proj, paths, volcano, radiusPx: proj.kmToPx(BURNI_TELONG.radiusKm) }
  }, [compact])

  const levels = useMemo(() => Object.fromEntries((hazardsAll?.locations ?? []).map((l) => [l.id, l])), [hazardsAll])
  const { proj, paths, volcano, radiusPx } = geo
  const sentra = LOCATIONS.map((l) => {
    const [x, y] = proj.project(l.lon, l.lat)
    const row = levels[l.id]
    return { ...l, x, y, worst: row?.worst ?? 'n/a', active: row?.active ?? [], distVolcanoKm: haversineKm(l.lat, l.lon, BURNI_TELONG.lat, BURNI_TELONG.lon) }
  })
  const nearVolcano = sentra.filter((s) => s.distVolcanoKm <= 15).sort((a, b) => a.distVolcanoKm - b.distVolcanoKm)
  const RANK = { ekstrem: 4, bahaya: 3, waspada: 2, rendah: 1, 'n/a': 0 }
  const shortName = (n) => n.replace(/\s*\(.*\)$/, '')
  const labels = placeLabels(
    sentra.map((s) => ({ id: s.id, x: s.x, y: s.y, text: shortName(s.name), priority: (s.id === selectedLocation?.id ? 10 : 0) + RANK[s.worst] })),
    { boxes: [...sentra.map((s) => ({ x1: s.x - 6, x2: s.x + 6, y1: s.y - 6, y2: s.y + 6 })), { x1: volcano[0] - 8, x2: volcano[0] + 95, y1: volcano[1] - 14, y2: volcano[1] + 6 }] }
  )
  const asOf = hazardsAll?.retrievedAt ? new Date(hazardsAll.retrievedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : null

  return (
    <section aria-label="Peta skematik bahaya 15 sentra" className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Peta skematik bahaya</h2>
          <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Warna = level tertinggi per sentra{asOf ? ` · ${asOf} WIB` : ''} · bukan peta navigasi</p>
        </div>
        {hazardsAll?.worst && (
          <span className="text-caption text-ink-muted dark:text-mist-muted text-right">
            Tertinggi: <span className="font-semibold" style={{ color: FILL[hazardsAll.worst.level] }}>{hazardsAll.worst.name}</span>
          </span>
        )}
      </div>
      <svg viewBox={`0 0 ${proj.width} ${proj.height}`} role="img" aria-label="Peta kecamatan Aceh Tengah dan Bener Meriah dengan titik sentra kopi" className="w-full h-auto">
        <title>Peta skematik bahaya — Aceh Tengah</title>
        {paths.map((p) => (
          <path key={p.id} d={p.d} fill={p.kab === 'Aceh Tengah' ? 'currentColor' : 'none'} fillOpacity={p.kab === 'Aceh Tengah' ? 0.06 : 0} stroke="currentColor" strokeOpacity={p.kab === 'Aceh Tengah' ? 0.35 : 0.18} strokeWidth={0.8} strokeDasharray={p.kab === 'Aceh Tengah' ? undefined : '3 2'} className="text-ink dark:text-mist">
            <title>{`${p.name} (${p.kab})`}</title>
          </path>
        ))}
        {/* Burni Telong: radius rekomendasi PVMBG 3 km + segitiga */}
        <circle cx={volcano[0]} cy={volcano[1]} r={radiusPx} fill="var(--color-level-bahaya)" fillOpacity={0.12} stroke="var(--color-level-bahaya)" strokeOpacity={0.6} strokeWidth={0.8} strokeDasharray="2 2" />
        <polygon points={`${volcano[0]},${volcano[1] - 6} ${volcano[0] - 5},${volcano[1] + 4} ${volcano[0] + 5},${volcano[1] + 4}`} fill="var(--color-level-bahaya)">
          <title>{`${BURNI_TELONG.name} — Level ${BURNI_TELONG.level}, radius ${BURNI_TELONG.radiusKm} km (${BURNI_TELONG.source})`}</title>
        </polygon>
        <text x={volcano[0] + 8} y={volcano[1] - 4} fontSize="9" fill="var(--color-level-bahaya)">Burni Telong (Lv II)</text>
        {/* Titik panas terdekat (opsional) */}
        {hotspots.map((h, i) => {
          const [x, y] = proj.project(h.lon, h.lat)
          return <circle key={i} cx={x} cy={y} r={3} fill="#f97316" fillOpacity={0.8}><title>{`Hotspot ${h.satellite ?? ''} ${h.frp ? `FRP ${h.frp} MW` : ''}`.trim()}</title></circle>
        })}
        {/* Sentra */}
        {sentra.map((s) => {
          const selected = s.id === selectedLocation?.id
          return (
            <g key={s.id} onClick={() => onSelectLocation?.(s)} style={{ cursor: onSelectLocation ? 'pointer' : 'default' }} role={onSelectLocation ? 'button' : undefined} aria-label={`${s.name}: ${LABEL[s.worst]}`}>
              {selected && <circle cx={s.x} cy={s.y} r={10} fill="none" stroke="currentColor" strokeOpacity={0.6} strokeWidth={1.2} className="text-ink dark:text-mist" />}
              <circle cx={s.x} cy={s.y} r={s.worst === 'ekstrem' ? 7 : 5.5} fill={FILL[s.worst]} stroke="#fff" strokeWidth={1}>
                <title>{`${s.name}: ${LABEL[s.worst]}${s.active.length ? ` (${s.active.join(', ')})` : ''}`}</title>
              </circle>
              {labels[s.id] && (
                <text x={labels[s.id].x} y={labels[s.id].y} textAnchor={labels[s.id].anchor} fontSize="8.5" fontWeight={selected ? 600 : 400} fill="currentColor" fillOpacity={selected ? 1 : 0.75} className="text-ink dark:text-mist">{shortName(s.name)}</text>
              )}
            </g>
          )
        })}
      </svg>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-ink-muted dark:text-mist-muted">
        {['ekstrem', 'bahaya', 'waspada', 'rendah', 'n/a'].map((k) => (
          <span key={k} className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ background: FILL[k] }} />{LABEL[k]}</span>
        ))}
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 bg-level-bahaya" style={{ clipPath: 'polygon(50% 0,0 100%,100% 100%)' }} />gunung api</span>
        <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#f97316]" />hotspot</span>
      </div>
      {nearVolcano.length > 0 && (
        <p className="mt-2 text-caption text-ink-muted dark:text-mist-subtle">
          Jarak ke Burni Telong: {nearVolcano.map((s) => `${s.name.replace(/\s*\(.*\)$/, '')} ${s.distVolcanoKm.toFixed(1)} km`).join(' · ')}. Status gunung api dari PVMBG/MAGMA (tidak otomatis).
        </p>
      )}
    </section>
  )
}
