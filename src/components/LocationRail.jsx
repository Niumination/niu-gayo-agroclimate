import { LOCATIONS } from '../data/locations'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'

const LEVEL_COLOR = {
  ekstrem: 'var(--color-level-ekstrem)',
  bahaya: 'var(--color-level-bahaya)',
  waspada: 'var(--color-level-waspada)',
  rendah: 'var(--color-level-rendah)',
  'n/a': 'var(--color-line-strong)',
}

/** Rel 15 sentra dengan level bahaya dan sorot-silang dengan peta. */
export default function LocationRail({
  selectedLocation,
  onSelectLocation,
  highlightedLocationId,
  onHighlightLocation,
  hazardsAll,
  tr = (key) => key,
}) {
  const sorted = [...LOCATIONS].sort((a, b) => b.elevation - a.elevation)
  const levels = Object.fromEntries((hazardsAll?.locations ?? []).map((item) => [item.id, item]))

  return (
    <nav aria-label={tr('pickRegion')} className="min-w-0">
      <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">{tr('pickRegion')}</h2>
      <ol className="mt-3 divide-y divide-ink/5 dark:divide-mist/10">
        {sorted.map((loc, index) => {
          const active = loc.id === selectedLocation?.id
          const highlighted = loc.id === highlightedLocationId
          const level = levels[loc.id]?.worst ?? 'n/a'
          return (
            <li key={loc.id}>
              <button
                type="button"
                onClick={() => onSelectLocation?.(loc)}
                onMouseEnter={() => onHighlightLocation?.(loc.id)}
                onMouseLeave={() => onHighlightLocation?.(null)}
                onFocus={() => onHighlightLocation?.(loc.id)}
                onBlur={() => onHighlightLocation?.(null)}
                aria-current={active ? 'true' : undefined}
                data-highlighted={highlighted ? 'true' : undefined}
                className={`w-full text-left py-3 pr-2 flex items-baseline gap-2.5 min-h-[44px] rounded-md transition-colors duration-100 ease-out active:scale-[.97] ${
                  active
                    ? 'text-leaf-deep dark:text-leaf-soft'
                    : 'text-ink-body dark:text-mist-body hover:text-ink dark:hover:text-mist'
                } ${highlighted ? 'bg-tanah-terbenam dark:bg-langit-terbenam' : ''}`}
              >
                <span className="font-data text-caption w-5 shrink-0 text-ink-subtle dark:text-mist-subtle tabular-nums">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  aria-hidden="true"
                  className="w-2 h-2 rounded-full shrink-0 self-center ring-2 ring-tanah-kartu dark:ring-langit-kartu"
                  style={{ background: LEVEL_COLOR[level] ?? LEVEL_COLOR['n/a'] }}
                />
                <span className="flex-1 min-w-0 break-words text-body-sm font-medium">{loc.name}</span>
                <span className="font-data text-caption shrink-0 text-ink-muted dark:text-mist-subtle tabular-nums">
                  {loc.elevation.toLocaleString('id-ID')}
                </span>
                {/* Audit F-07b — titik warna level bersifat dekoratif (aria-hidden), jadi level
                    diucapkan lewat teks tersembunyi; sebelumnya aria-label menimpa seluruh teks
                    yang terlihat (nama + indeks + elevasi) dan ditandai axe. */}
                <span className="sr-only"> — {LEVEL_LABEL[level] ?? 'status tidak tersedia'}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
