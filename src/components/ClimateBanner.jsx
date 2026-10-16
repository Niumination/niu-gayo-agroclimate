import React, { useState } from 'react'
import outlook from '../data/hazards/climateOutlook.json'
import { climateBannerModel } from '../domain/climate.js'

/**
 * Fase 1.9c (FR-KER-5) — banner konteks iklim: ENSO/IOD/prospek musim BMKG (terkurasi) + verifikasi lokal dari arsip ERA5.
 * Mengikuti gaya SeasonalBanner (border/tint per nada). Tanpa fetch.
 */
const STYLE = {
  tinggi: 'border-cherry/30 bg-cherry/5 text-cherry-deep dark:text-cherry-soft',
  sedang: 'border-husk/30 bg-husk/5 text-husk-deep dark:text-husk-soft',
  rendah: 'border-leaf/30 bg-leaf/5 text-leaf-deep dark:text-leaf-soft',
}

export default function ClimateBanner({ drought, now }) {
  const [open, setOpen] = useState(false)
  const m = climateBannerModel(outlook, { now: now ?? new Date(), drought })
  if (!m) return null
  return (
    <div role="status" className={`border rounded-card px-4 py-3 text-body ${STYLE[m.tone] || STYLE.sedang}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-h-11 inline-flex items-center w-full text-left flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="font-semibold">{m.title}</span>
        <span className="text-caption opacity-75">{m.summary}{m.issuedAt ? ` · rilis ${m.issuedAt}` : ''} {open ? '▴' : '▾'}</span>
      </button>
      {m.local && <p className={`mt-1 text-caption ${m.localTone === 'rendah' ? 'text-leaf-deep dark:text-leaf-soft' : ''}`}>{m.local}</p>}
      {open && (
        <div className="mt-2 space-y-1.5 text-caption text-ink-body dark:text-mist-body">
          {m.detail && <p>{m.detail}</p>}
          {m.implications.length > 0 && (
            <ul className="list-disc pl-4 space-y-0.5">
              {m.implications.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          )}
          {m.staleNote && <p className="text-caption opacity-80">{m.staleNote}</p>}
          {m.sources.length > 0 && (
            <p className="text-caption opacity-75">
              Sumber: {m.sources.map((s, i) => (
                <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline underline-offset-2">{s.title}</a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
