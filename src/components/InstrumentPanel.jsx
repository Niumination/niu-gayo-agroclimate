import MetricChip from './MetricChip'

/**
 * Panel instrumen utama: suhu dominan + metrik pendukung dipisah hairline,
 * bukan empat kartu identik. Satu panel = satu pembacaan besar.
 */
export default function InstrumentPanel({ current, daily, location, tr, className = '' }) {
  if (!current || !daily) return null

  const rhTone = current.rh > 85 ? 'warn' : 'default'
  const rainTone = current.rain > 5 ? 'info' : 'default'
  const windTone = current.wind > 20 ? 'warn' : 'default'

  return (
    <section
      aria-label={tr('appName')}
      data-niu-card="instrument"
      className={`bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist break-words">
            {location?.name}
          </h2>
          <p className="text-body-sm text-ink-muted dark:text-mist-muted break-words">
            {tr('elevation')} <span className="font-data tabular-nums">{location?.elevation}</span> {tr('mdpl')}
          </p>
        </div>
        <span className="shrink-0 text-caption font-medium px-2 py-1 rounded-full border border-ink/10 dark:border-mist/15 text-ink-muted dark:text-mist-muted">
          {tr('airTemp')}
        </span>
      </div>

      {/* Pembacaan dominan */}
      <div className="mt-4 flex items-end gap-2">
        <span className="font-data font-semibold leading-none tracking-tighter text-[3.5rem] sm:text-[4.25rem] text-ink dark:text-mist tabular-nums">
          {current.temp}
        </span>
        <span className="font-data text-lg text-ink-muted dark:text-mist-muted pb-2 tabular-nums">°C</span>
      </div>
      <p className="mt-1 text-body text-ink-muted dark:text-mist-muted">
        {tr('min')} <span className="font-data text-ink-body dark:text-mist-body tabular-nums">{daily.minTemp}°C</span>
        {'  '}
        {tr('max')} <span className="font-data text-ink-body dark:text-mist-body tabular-nums">{daily.maxTemp}°C</span>
      </p>

      {/* Metrik pendukung, dipisah hairline rule */}
      <div className="mt-5 pt-4 border-t border-ink/10 dark:border-mist/10 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-4">
        <MetricChip label={tr('humidity')} value={current.rh} unit="%" tone={rhTone} />
        <MetricChip label={tr('rainNow')} value={current.rain} unit="mm/jam" tone={rainTone} />
        <MetricChip label={tr('rainProb')} value={daily.rainProb} unit="%" />
        <MetricChip label={tr('windSpeed')} value={current.wind} unit="km/jam" tone={windTone} />
      </div>
    </section>
  )
}
