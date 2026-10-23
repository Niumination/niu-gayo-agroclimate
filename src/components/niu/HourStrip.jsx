import { useState } from 'react'

/**
 * Strip 12 jam. Mobile mempertahankan pola v4 yang bisa digeser mendatar;
 * desktop menambahkan pilihan jam, scrubber, pembacaan langsung, dan legenda v6.
 */

const r1 = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : Number(value).toLocaleString('id-ID', { minimumFractionDigits: 1, maximumFractionDigits: 1 }))
const r0 = (value) => (value == null || Number.isNaN(Number(value)) ? '—' : Math.round(Number(value)).toLocaleString('id-ID'))
const timeLabel = (value) => (typeof value === 'string' ? value.slice(0, 5).replace(':', '.') : '—')

export default function HourStrip({
  hours = [],
  title = '12 jam ke depan',
  sub,
  className = '',
  interactive = false,
}) {
  const [selectedIndex, setSelectedIndex] = useState(0)
  if (!Array.isArray(hours) || hours.length === 0) return null

  const maxRain = Math.max(0.5, ...hours.map((hour) => Number(hour.rain) || 0))
  const selected = hours[Math.min(selectedIndex, hours.length - 1)]
  const selectedTime = timeLabel(selected.time)
  const selectedRain = Number(selected.rain)
  const selectedSolar = Number(selected.solar)
  const selectedGust = Number(selected.gusts)
  const avgSolar = hours.reduce((total, hour) => total + (Number(hour.solar) || 0), 0) / hours.length
  const maxGust = Math.max(0, ...hours.map((hour) => Number(hour.gusts) || 0))
  const defaultSub = interactive
    ? 'Geser atau ketuk jam untuk membaca angkanya'
    : 'Suhu, hujan, dan matahari — geser ke samping'

  const onHourKeyDown = (event, index) => {
    let nextIndex
    if (event.key === 'ArrowRight') nextIndex = Math.min(hours.length - 1, index + 1)
    else if (event.key === 'ArrowLeft') nextIndex = Math.max(0, index - 1)
    else if (event.key === 'Home') nextIndex = 0
    else if (event.key === 'End') nextIndex = hours.length - 1
    else return
    event.preventDefault()
    setSelectedIndex(nextIndex)
    document.getElementById(`niu-hour-${nextIndex}`)?.focus()
  }

  const renderHour = (hour, index) => {
    const rain = Number(hour.rain) || 0
    const barHeight = Math.max(2, Math.round((rain / maxRain) * 34))
    const content = (
      <>
        <span className="niu-hour-time font-data tabular-nums">{timeLabel(hour.time)}</span>
        <span className="niu-hour-temp font-data tabular-nums">
          {r1(hour.temp)}<span className="text-caption">°</span>
        </span>
        <span className="niu-hour-rainbar" aria-hidden="true">
          <span className="niu-hour-rainbar-fill" style={{ height: `${barHeight}px` }} />
        </span>
        <span className="niu-hour-rain font-data tabular-nums">{r1(hour.rain)}</span>
        {!interactive && hour.gusts != null && (
          <span className="niu-hour-gust tabular-nums">{r0(hour.gusts)} km/j</span>
        )}
      </>
    )
    const className = `niu-hour rounded-tanah-kendali px-1 pb-2 pt-2 text-center dark:rounded-langit-kendali min-h-11${
      interactive ? ' niu-hour-button active:scale-[.99]' : ''
    }`

    return interactive ? (
      <button
        key={`${hour.time}-${index}`}
        id={`niu-hour-${index}`}
        type="button"
        className={className}
        onClick={() => setSelectedIndex(index)}
        onKeyDown={(event) => onHourKeyDown(event, index)}
        aria-pressed={index === selectedIndex}
      >
        {content}
        {/* Audit F-07b — aria-label lama ("00.00 · 17,7 derajat · …") tidak memuat teks
            angka yang terlihat, sehingga axe menandai label-content-name-mismatch.
            Satuan sekarang ditambahkan sebagai teks tersembunyi: nama = teks tampak + satuan. */}
        <span className="sr-only"> — suhu {r1(hour.temp)} derajat, hujan {r1(hour.rain)} mm/jam</span>
      </button>
    ) : (
      <li key={`${hour.time}-${index}`} className={className}>
        {content}
      </li>
    )
  }

  return (
    <section
      aria-labelledby="hourstrip-title"
      data-niu-card="hour-strip"
      className={`niu-hour-strip rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu ${interactive ? 'niu-hour-strip-interactive' : ''} ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="hourstrip-title"
          className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta"
        >
          {title}
        </h2>
        <p className="text-caption text-tanah-tinta-redup dark:text-langit-tinta-redup">{sub ?? defaultSub}</p>
      </div>

      {interactive ? (
        <div className="niu-hour-list niu-hour-list-interactive mt-3" role="group" aria-label="Prakiraan 12 jam">
          {hours.map(renderHour)}
        </div>
      ) : (
        <ol className="niu-hour-list niu-hour-list-mobile mt-3" aria-label="Prakiraan 12 jam: suhu, hujan, dan angin">
          {hours.map(renderHour)}
        </ol>
      )}

      {interactive && (
        <>
          <div className="niu-hour-scrubber">
            <label className="sr-only" htmlFor="niu-hourstrip-range">Geser jam yang ingin dibaca</label>
            <input
              id="niu-hourstrip-range"
              type="range"
              min="0"
              max={hours.length - 1}
              step="1"
              value={Math.min(selectedIndex, hours.length - 1)}
              aria-describedby="niu-hourstrip-reading"
              onChange={(event) => setSelectedIndex(Number(event.target.value))}
            />
            <p id="niu-hourstrip-reading" className="niu-hour-readout" aria-live="polite" aria-atomic="true">
              <strong>{selectedTime}</strong>
              {' · '}{r1(selected.temp)}°
              {' · hujan '}{Number.isFinite(selectedRain) ? `${r1(selectedRain)} mm/jam` : '—'}
              {' · matahari '}{Number.isFinite(selectedSolar) ? `${r0(selectedSolar)} W/m²` : '—'}
              {' · hembusan '}{Number.isFinite(selectedGust) ? `${r0(selectedGust)} km/jam` : '—'}
            </p>
          </div>
          <div className="niu-hour-legend" aria-label="Legenda prakiraan">
            <span><i className="niu-legend-rain" aria-hidden="true" />Hujan (mm/jam)</span>
            <span><i className="niu-legend-sun" aria-hidden="true" />Matahari · rata-rata {r0(avgSolar)} W/m²</span>
            <span><i className="niu-legend-wind" aria-hidden="true" />Hembusan · maks {r0(maxGust)} km/jam</span>
          </div>
        </>
      )}
    </section>
  )
}
