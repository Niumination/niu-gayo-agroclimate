import EmptyState from './EmptyState'

/**
 * Tren per jam. Mobile: grid rapat tanpa horizontal scroll.
 * Desktop: satu baris 12 kolom (kepadatan lebih tinggi).
 * Semua nilai memakai font-data (pembacaan instrumen).
 */
export default function HourlyForecast({ hourly, tr, variant = 'mobile' }) {
  if (!hourly || hourly.length === 0) {
    return <EmptyState title={tr('emptyForecast')} hint={tr('emptyHint')} />
  }

  return (
    <section aria-label={tr('hourlyTrend')} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">{tr('hourlyTrend')}</h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">{tr('hourlySub')}</p>
      </div>

      <div
        className={`pt-3 border-t border-ink/10 dark:border-mist/10 grid gap-2 ${
          variant === 'desktop'
            ? 'grid-cols-6 xl:grid-cols-12'
            : 'grid-cols-3'
        }`}
      >
        {hourly.map((item, idx) => (
          <div
            key={idx}
            className="min-w-0 py-2 px-1 text-center border-b border-ink/5 dark:border-mist/10 last:border-b-0"
          >
            <span className="font-data text-caption text-ink-muted dark:text-mist-subtle block tabular-nums">{item.time}</span>
            <span className="font-data text-body font-semibold text-ink dark:text-mist block mt-0.5 tabular-nums">
              {item.temp}°C
            </span>
            <div className="mt-1.5 pt-1.5 border-t border-ink/5 dark:border-mist/10 space-y-0.5">
              <div className="flex items-center justify-between gap-1 text-caption">
                <span className="text-ink-muted dark:text-mist-subtle">{tr('rain')}</span>
                <span className={`font-data ${item.rain > 0 ? 'text-rain-deep dark:text-rain-soft font-semibold' : 'text-ink-subtle dark:text-mist-subtle'}`}>
                  {item.rain}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-caption">
                <span className="text-ink-muted dark:text-mist-subtle">{tr('sun')}</span>
                <span className={`font-data ${item.solar > 200 ? 'text-husk-deep dark:text-husk-soft font-semibold' : 'text-ink-subtle dark:text-mist-subtle'}`}>
                  {Math.round(item.solar)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-caption text-ink-subtle dark:text-mist-subtle">
        {tr('rain')} <span className="font-data tabular-nums">mm</span> · {tr('sun')} <span className="font-data tabular-nums">W/m²</span>
      </p>
    </section>
  )
}
