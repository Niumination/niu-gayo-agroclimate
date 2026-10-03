import React from 'react'
import { LOCATIONS } from '../data/locations'

/**
 * Rail kiri desktop: indeks 15 sentra terurut elevasi (nomor urut sah —
 * memang urutan), titik status risiko, baris aktif ditandai.
 */
export default function LocationRail({ selectedLocation, onSelectLocation, tr }) {
  const sorted = [...LOCATIONS].sort((a, b) => b.elevation - a.elevation)

  return (
    <nav aria-label={tr('pickRegion')} className="min-w-0">
      <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{tr('pickRegion')}</h2>
      <ol className="mt-3 divide-y divide-ink/5 dark:divide-mist/10">
        {sorted.map((loc, i) => {
          const active = loc.id === selectedLocation?.id
          return (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => onSelectLocation(loc)}
                aria-current={active ? 'true' : undefined}
                className={`w-full text-left py-2.5 pr-2 flex items-baseline gap-2.5 rounded-md transition-colors ${
                  active
                    ? 'text-leaf-deep dark:text-leaf-soft'
                    : 'text-ink/75 dark:text-mist/70 hover:text-ink dark:hover:text-mist'
                }`}
              >
                <span className="font-data text-[11px] w-5 shrink-0 text-ink/35 dark:text-mist/30">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full shrink-0 self-center bg-leaf/70" />
                <span className="flex-1 min-w-0 truncate text-[13px] font-medium">{loc.name}</span>
                <span className="font-data text-[11px] shrink-0 text-ink/45 dark:text-mist/40">
                  {loc.elevation}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
