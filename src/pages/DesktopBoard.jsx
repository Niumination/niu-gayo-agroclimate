import { useEffect, useMemo, useState } from 'react'
import DetailPanel from '../components/niu/DetailPanel.jsx'
import CommandPalette from '../components/niu/CommandPalette.jsx'
import ReportButton from '../components/ReportButton'
import ShareButton from '../components/ShareButton'
import LocationRail from '../components/LocationRail'
import { hazardPanels, HAZARD_TABS } from '../components/niu/HazardDetail.jsx'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'
import { LOCATIONS } from '../data/locations'

/**
 * P7.5 — papan kerja desktop: rel kiri + kanvas + inspector kanan.
 *
 * Sama seperti prototipe v6 yang disetujui:
 * - Rel 264 px bisa dilipat jadi 76 px (`[`), isi tersisa inisial sentra.
 * - Inspector menampilkan satu bahaya; master–detail terjadi lewat klik baris
 *   di zona Risiko (lewat prop `onSelect` dari HazardPanel).
 * - ⌘K membuka palet (zona, sentra, bahaya, aksi).
 * - `D` kepadatan, `F` mode fokus, `1–5` pindah zona; pilihan disimpan lokal.
 * - Di layar < 1500 px inspector menjadi laci kanan; ≥ 1500 px menetap.
 *
 * Semua kartu lama tetap dirender: komponen ini hanya membingkai lima zona.
 */

const read = (k, fallback) => {
  try {
    return localStorage.getItem(k) || fallback
  } catch {
    return fallback
  }
}
const store = (k, v) => {
  try {
    localStorage.setItem(k, v)
  } catch {
    /* mode privat */
  }
}

export default function DesktopBoard({
  hazards,
  location,
  onSelectLocation,
  tr = (k) => k,
  sections = {},
  selectedHazardId,
  onSelectHazard,
}) {
  const [rail, setRail] = useState(() => read('niu.desk.rail', 'buka'))
  const [dens, setDens] = useState(() => read('niu.desk.dens', 'nyaman'))
  const [focus, setFocus] = useState(() => read('niu.desk.focus', 'off'))
  const [insp, setInsp] = useState(() => {
    const saved = read('niu.desk.insp', null)
    if (saved) return saved
    return typeof window !== 'undefined' && window.innerWidth < 1200 ? 'tutup' : 'buka'
  })
  const [big, setBig] = useState(false)
  const [pal, setPal] = useState(false)

  const locations = useMemo(() => [...LOCATIONS].sort((a, b) => b.elevation - a.elevation), [])
  const results = useMemo(() => hazards?.results ?? [], [hazards])
  const selected = useMemo(() => {
    const byId = results.find((r) => r.id === selectedHazardId)
    if (byId) return byId
    return results.find((r) => r.level === hazards?.worst) ?? results[0] ?? null
  }, [results, selectedHazardId, hazards])

  const zones = useMemo(
    () => [
      { id: 'ringkas', label: 'Ringkas' },
      { id: 'ramalan', label: 'Ramalan' },
      { id: 'risiko', label: 'Risiko' },
      { id: 'sentra', label: 'Sentra' },
      { id: 'arsip', label: 'Arsip' },
    ],
    []
  )

  const goZone = (id) => {
    document.getElementById(`zona-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  useEffect(() => {
    store('niu.desk.rail', rail)
    store('niu.desk.dens', dens)
    store('niu.desk.focus', focus)
    store('niu.desk.insp', insp)
  }, [rail, dens, focus, insp])

  useEffect(() => {
    const onKey = (e) => {
      const inField = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '')
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setPal(true)
        return
      }
      if (inField || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.key === '[') {
        e.preventDefault()
        setRail((r) => (r === 'buka' ? 'lipat' : 'buka'))
      } else if (e.key === 'd' || e.key === 'D') {
        e.preventDefault()
        setDens((d) => (d === 'padat' ? 'nyaman' : 'padat'))
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault()
        setFocus((f) => (f === 'on' ? 'off' : 'on'))
      } else if (e.key === 'Escape') {
        if (big) {
          e.preventDefault()
          setBig(false)
        } else if (window.innerWidth < 1500 && insp === 'buka') {
          e.preventDefault()
          setInsp('tutup')
        }
      } else if (/^[1-5]$/.test(e.key)) {
        const z = zones[Number(e.key) - 1]
        if (z) {
          e.preventDefault()
          goZone(z.id)
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [zones, big, insp])

  const paletteItems = useMemo(() => {
    const out = [
      ...zones.map((z, i) => ({
        id: `zona-${z.id}`,
        label: `${i + 1}. ${z.label}`,
        sub: 'Pindah bagian',
        group: 'Bagian',
        run: () => goZone(z.id),
      })),
      ...results.map((r) => ({
        id: `bahaya-${r.id}`,
        label: r.label?.id || r.id,
        sub: r.headline,
        group: 'Bahaya',
        run: () => {
          onSelectHazard?.(r.id)
          setInsp('buka')
          goZone('risiko')
        },
      })),
    ]
    const locs = locations.map((loc) => ({
      id: `sentra-${loc.id}`,
      label: loc.name,
      sub: `${loc.elevation} m · pilih sentra`,
      group: 'Sentra',
      run: () => {
        onSelectLocation?.(loc)
        goZone('sentra')
      },
    }))
    return out.concat(locs)
  }, [zones, results, onSelectHazard, locations, onSelectLocation])

  return (
    <div
      className="desk mx-auto grid min-h-[70vh] max-w-shell grid-cols-[76px_minmax(0,1fr)] gap-0 px-4 xl:px-6"
      data-rail={rail}
      data-dens={dens}
      data-focus={focus}
      data-insp={insp}
    >
      <aside className="desk-rail min-w-0 border-r border-tanah-garis py-4 pr-3 dark:border-langit-garis" aria-label="Rel aksi dan sentra">
        <div className="flex items-center justify-between gap-2 px-1">
          {rail !== 'lipat' && (
            <p className="text-caption uppercase tracking-wide text-tanah-tinta-halus dark:text-langit-tinta-halus">
              Aksi & sentra
            </p>
          )}
          <button
            type="button"
            onClick={() => setRail(rail === 'lipat' ? 'buka' : 'lipat')}
            aria-pressed={rail === 'lipat'}
            aria-label={rail === 'lipat' ? 'Buka rel' : 'Lipat rel'}
            title="Lipat rel ([)"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-tanah-kendali text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <path d="M9 4v16" />
            </svg>
          </button>
        </div>

        <div className={`mt-3 ${rail === 'lipat' ? 'flex flex-col items-center gap-2' : 'space-y-2'}`}>
          <ReportButton location={location} className={rail === 'lipat' ? '!px-2' : 'w-full'} />
          <ShareButton
            hazards={hazards}
            location={location}
            tr={tr}
            compact
            buttonClassName="inline-flex min-h-11 w-full items-center justify-center rounded-pil border border-tanah-garis-kuat px-3 text-body-sm font-semibold text-tanah-aksen hover:bg-tanah-terbenam dark:border-langit-garis-kuat dark:text-langit-aksen dark:hover:bg-langit-terbenam"
          />
        </div>

        <div className="mt-5">
          {rail === 'lipat' ? (
            <nav aria-label={tr('pickRegion')} className="flex flex-col items-center gap-1">
              {locations.map((loc) => {
                const active = loc.id === location?.id
                const initials = loc.name
                  .replace(/\(.*?\)/g, '')
                  .trim()
                  .split(/\s+/)
                  .slice(0, 2)
                  .map((w) => w[0])
                  .join('')
                  .toUpperCase()
                return (
                  <button
                    key={loc.id}
                    type="button"
                    onClick={() => onSelectLocation?.(loc)}
                    aria-current={active ? 'true' : undefined}
                    aria-label={loc.name}
                    title={`${loc.name} · ${loc.elevation} m`}
                    className={`grid h-11 w-11 place-items-center rounded-tanah-kendali font-data text-caption font-semibold ${
                      active
                        ? 'bg-tanah-aksen text-tanah-aksen-tinta dark:bg-langit-aksen dark:text-langit-aksen-tinta'
                        : 'text-tanah-tinta-redup hover:bg-tanah-terbenam dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam'
                    }`}
                  >
                    {initials}
                  </button>
                )
              })}
            </nav>
          ) : (
            <LocationRail selectedLocation={location} onSelectLocation={onSelectLocation} tr={tr} />
          )}
        </div>
      </aside>

      <div className="desk-canvas min-w-0">
        <div className="desk-bar sticky top-16 z-30 -mx-4 flex flex-wrap items-center gap-2 border-b border-tanah-garis bg-tanah-permukaan/95 px-4 py-2 backdrop-blur dark:border-langit-garis dark:bg-langit-malam/95 xl:-mx-6 xl:px-6">
          <button
            type="button"
            onClick={() => setPal(true)}
            aria-haspopup="dialog"
            className="inline-flex min-h-10 min-w-0 flex-1 items-center gap-2 rounded-tanah-kendali border border-tanah-garis bg-tanah-kartu px-3 text-body-sm text-tanah-tinta-redup hover:border-tanah-garis-kuat dark:rounded-langit-kendali dark:border-langit-garis dark:bg-langit-kartu dark:text-langit-tinta-redup dark:hover:border-langit-garis-kuat"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.2-3.2" />
            </svg>
            <span className="min-w-0 break-words">Cari sentra, bahaya, atau aksi…</span>
            <kbd className="ml-auto hidden shrink-0 rounded border border-tanah-garis px-1.5 py-0.5 font-data text-caption sm:block dark:border-langit-garis">⌘K</kbd>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDens(dens === 'padat' ? 'nyaman' : 'padat')}
              aria-pressed={dens === 'padat'}
              title="Kepadatan (D)"
              className="min-h-10 rounded-tanah-kendali px-2.5 text-caption font-semibold text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
            >
              Kepadatan
            </button>
            <button
              type="button"
              onClick={() => setFocus(focus === 'on' ? 'off' : 'on')}
              aria-pressed={focus === 'on'}
              title="Mode fokus (F)"
              className="min-h-10 rounded-tanah-kendali px-2.5 text-caption font-semibold text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
            >
              Fokus
            </button>
          </div>
        </div>

        <nav aria-label="Bagian halaman" className="desk-zones sticky top-[104px] z-20 -mx-4 flex flex-wrap items-center gap-1 border-b border-tanah-garis bg-tanah-permukaan/95 px-4 py-1.5 backdrop-blur dark:border-langit-garis dark:bg-langit-malam/95 xl:-mx-6 xl:px-6">
          {zones.map((z, i) => (
            <button
              key={z.id}
              type="button"
              onClick={() => goZone(z.id)}
              className="min-h-9 rounded-pil px-2.5 text-caption font-semibold text-tanah-tinta-redup hover:bg-tanah-terbenam dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
            >
              <span className="font-data tabular-nums">{i + 1}</span> {z.label}
            </button>
          ))}
          <span className="ml-auto hidden text-caption text-tanah-tinta-halus md:block dark:text-langit-tinta-halus">
            ⌘K cari · [ rel · D padat · F fokus
          </span>
        </nav>

        <div className="desk-flow px-0 py-5">
          <section id="zona-ringkas" aria-labelledby="z-ringkas" className="desk-zone">
            <h2 id="z-ringkas" className="desk-zone-title">
              1 · Ringkas
            </h2>
            {sections.ringkas}
          </section>
          <section id="zona-ramalan" aria-labelledby="z-ramalan" className="desk-zone">
            <h2 id="z-ramalan" className="desk-zone-title">
              2 · Ramalan
            </h2>
            {sections.ramalan}
          </section>
          <section id="zona-risiko" aria-labelledby="z-risiko" className="desk-zone">
            <h2 id="z-risiko" className="desk-zone-title">
              3 · Risiko
            </h2>
            {sections.risiko}
          </section>
          <section id="zona-sentra" aria-labelledby="z-sentra" className="desk-zone">
            <h2 id="z-sentra" className="desk-zone-title">
              4 · Sentra
            </h2>
            {sections.sentra}
          </section>
          <section id="zona-arsip" aria-labelledby="z-arsip" className="desk-zone">
            <h2 id="z-arsip" className="desk-zone-title">
              5 · Arsip
            </h2>
            {sections.arsip}
          </section>
        </div>
      </div>

      {insp === 'buka' && selected && (
        <aside
          className={`desk-insp min-w-0 ${big ? 'desk-insp--big' : ''}`}
          aria-label="Rincian bahaya terpilih"
        >
          <div className="desk-insp-inner">
            <DetailPanel
              id="desk-insp-panel"
              title={selected.label?.id || selected.id}
              subtitle={`${location?.name ?? ''} · ${LEVEL_LABEL[selected.level]} · dinilai ${selected.score == null ? '—' : Math.round(selected.score)}/100`}
              level={selected.level}
              levelLabel={selected.levelLabel}
              tabs={HAZARD_TABS}
              panels={hazardPanels(selected)}
              onClose={() => setInsp('tutup')}
              closeLabel="Tutup panel rincian"
              aside={
                <button
                  type="button"
                  onClick={() => setBig((b) => !b)}
                  aria-pressed={big}
                  aria-label={big ? 'Perkecil panel rincian' : 'Perbesar panel rincian'}
                  title="Perbesar / perkecil panel"
                  className="grid h-11 w-11 place-items-center rounded-tanah-kendali text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
                  </svg>
                </button>
              }
            />
            <p className="mt-3 px-1 text-caption leading-relaxed text-tanah-tinta-halus dark:text-langit-tinta-halus">
              Pilih baris lain di bagian Risiko untuk mengganti rincian. Tekan Esc atau tombol tutup untuk menyembunyikan panel.
            </p>
          </div>
        </aside>
      )}

      {insp !== 'buka' && selected && (
        <button
          type="button"
          onClick={() => setInsp('buka')}
          aria-haspopup="dialog"
          className="fixed bottom-6 right-6 z-30 inline-flex min-h-11 items-center gap-2 rounded-pil border border-tanah-garis-kuat bg-tanah-kartu px-4 text-body-sm font-semibold text-tanah-aksen shadow-lg hover:bg-tanah-terbenam dark:border-langit-garis-kuat dark:bg-langit-kartu dark:text-langit-aksen dark:hover:bg-langit-terbenam"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M4 6h16M4 12h10M4 18h16" />
          </svg>
          Buka rincian
        </button>
      )}

      <CommandPalette open={pal} onClose={() => setPal(false)} items={paletteItems} />
    </div>
  )
}
