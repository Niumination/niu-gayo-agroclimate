
/**
 * Satu pembacaan instrumen: label sentence-case + nilai monospace panel.
 * `tone` mewarnai nilai saja (bukan kartu), supaya hierarki tetap tenang.
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

export default function MetricChip({ label, value, unit, note, tone = 'default', className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-body font-medium text-ink-muted dark:text-mist-muted leading-tight">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-data text-xl font-semibold tabular-nums tracking-tight ${TONE[tone] || TONE.default}`}>
          {fmt(value)}
        </span>
        {unit ? <span className="font-data text-caption text-ink-muted dark:text-mist-muted tabular-nums">{unit}</span> : null}
      </div>
      {note ? <div className="mt-0.5 text-caption text-ink-muted dark:text-mist-subtle break-words">{note}</div> : null}
    </div>
  )
}
