import React from 'react'

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

export default function MetricChip({ label, value, unit, note, tone = 'default', className = '' }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[13px] font-medium text-ink/60 dark:text-mist/55 leading-tight">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-data text-xl font-semibold tabular-nums tracking-tight ${TONE[tone] || TONE.default}`}>
          {value}
        </span>
        {unit ? <span className="font-data text-[11px] text-ink/50 dark:text-mist/45">{unit}</span> : null}
      </div>
      {note ? <div className="mt-0.5 text-[11px] text-ink/45 dark:text-mist/40 truncate">{note}</div> : null}
    </div>
  )
}
