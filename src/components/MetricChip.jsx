
/**
 * Satu pembacaan instrumen: label ringkas + angka display yang mengikuti arah.
 * Detail teknis tetap memakai `font-data`; pembacaan utama memakai font Tanah/Langit.
 */
const TONE = {
  default: 'text-ink dark:text-mist',
  safe: 'text-leaf-deep dark:text-leaf-soft',
  warn: 'text-husk-deep dark:text-husk-soft',
  danger: 'text-cherry-deep dark:text-cherry-soft',
  info: 'text-rain-deep dark:text-rain-soft',
}

const fmt = (v) =>
  typeof v === 'number' ? v.toLocaleString('id-ID', { maximumFractionDigits: 1 }) : v

export default function MetricChip({ label, compactLabel, value, unit, note, tone = 'default', className = '' }) {
  return (
    <div className={`niu-metric min-w-0 ${className}`}>
      <div className="niu-metric-label text-body font-medium text-ink-muted dark:text-mist-muted leading-tight">
        {compactLabel ? (
          <>
            <span className="niu-metric-label-full">{label}</span>
            <span className="niu-metric-label-compact" aria-hidden="true">{compactLabel}</span>
          </>
        ) : label}
      </div>
      <div className="mt-1 flex flex-wrap items-baseline gap-1">
        <span className={`niu-metric-value text-xl font-semibold tabular-nums tracking-tight ${TONE[tone] || TONE.default}`}>
          {fmt(value)}
        </span>
        {unit ? <span className="niu-metric-unit text-caption text-ink-muted dark:text-mist-muted tabular-nums">{unit}</span> : null}
      </div>
      {note ? <div className="mt-0.5 text-caption text-ink-muted dark:text-mist-subtle break-words">{note}</div> : null}
    </div>
  )
}
