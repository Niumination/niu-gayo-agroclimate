import React from 'react'

/**
 * Tren per jam. Mobile: grid rapat tanpa horizontal scroll.
 * Desktop: satu baris 12 kolom (kepadatan lebih tinggi).
 * Semua nilai memakai font-data (pembacaan instrumen).
 */
export default function HourlyForecast({ hourly, tr, variant = 'mobile' }) {
  if (!hourly || hourly.length === 0) return null

  return (
    <section aria-label={tr('hourlyTrend')} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{tr('hourlyTrend')}</h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{tr('hourlySub')}</p>
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
            <span className="font-data text-[11px] text-ink/45 dark:text-mist/40 block">{item.time}</span>
            <span className="font-data text-sm font-semibold text-ink dark:text-mist block mt-0.5">
              {item.temp}°C
            </span>
            <div className="mt-1.5 pt-1.5 border-t border-ink/5 dark:border-mist/10 space-y-0.5">
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-ink/45 dark:text-mist/40">{tr('rain')}</span>
                <span className={`font-data ${item.rain > 0 ? 'text-rain-deep dark:text-rain-soft font-semibold' : 'text-ink/35 dark:text-mist/30'}`}>
                  {item.rain}
                </span>
              </div>
              <div className="flex items-center justify-between gap-1 text-[11px]">
                <span className="text-ink/45 dark:text-mist/40">{tr('sun')}</span>
                <span className={`font-data ${item.solar > 200 ? 'text-husk-deep dark:text-husk-soft font-semibold' : 'text-ink/35 dark:text-mist/30'}`}>
                  {Math.round(item.solar)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink/40 dark:text-mist/35">
        {tr('rain')} <span className="font-data">mm</span> · {tr('sun')} <span className="font-data">W/m²</span>
      </p>
    </section>
  )
}
