import React from 'react'

// F7 — banner kalender musiman. Fase: tinggi=cherry, sedang=husk, rendah=leaf.
const PHASE_STYLE = {
  tinggi: 'border-cherry/30 bg-cherry/5 text-cherry-deep dark:text-cherry-soft',
  sedang: 'border-husk/30 bg-husk/5 text-husk-deep dark:text-husk-soft',
  rendah: 'border-leaf/30 bg-leaf/5 text-leaf-deep dark:text-leaf-soft',
}

export default function SeasonalBanner({ seasonal }) {
  if (!seasonal) return null
  return (
    <div
      role="status"
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border rounded-card px-4 py-3 text-[13px] ${PHASE_STYLE[seasonal.phase] || PHASE_STYLE.rendah}`}
    >
      <span className="font-semibold">Musim risiko longsor: {seasonal.label} ({seasonal.peakMonths})</span>
      <span className="text-[11px] opacity-75">{seasonal.note}</span>
    </div>
  )
}
