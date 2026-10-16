import React from 'react'
import EmptyState from './EmptyState'

// F7 — banner kalender musiman. Fase: tinggi=cherry, sedang=husk, rendah=leaf.
const PHASE_STYLE = {
  tinggi: 'border-cherry/30 bg-cherry/5 text-cherry-deep dark:text-cherry-soft',
  sedang: 'border-husk/30 bg-husk/5 text-husk-deep dark:text-husk-soft',
  rendah: 'border-leaf/30 bg-leaf/5 text-leaf-deep dark:text-leaf-soft',
}

export default function SeasonalBanner({ seasonal, tr = (k) => k }) {
  if (!seasonal) {
    return <EmptyState title={tr('emptyData')} hint={tr('emptyHint')} />
  }
  return (
    <div
      role="status"
      className={`flex flex-wrap items-baseline gap-x-3 gap-y-0.5 border rounded-card px-4 py-3 text-body ${PHASE_STYLE[seasonal.phase] || PHASE_STYLE.rendah}`}
    >
      <span className="font-semibold">Musim risiko longsor: {seasonal.label} ({seasonal.peakMonths})</span>
      <span className="text-caption opacity-75">{seasonal.note}</span>
      {/* Fase 3.4 — fase kering (karhutla/kekeringan) + jendela embun upas + penyesuaian ENSO/IOD */}
      {seasonal.dry && (
        <span className="basis-full text-caption opacity-90">
          Musim kering: <strong>{seasonal.dry.label}</strong> ({seasonal.dry.months}) — {seasonal.dry.note}
          {seasonal.frostWindow ? ' Jendela embun upas plato > 1.400 m (malam cerah & tenang).' : ''}
        </span>
      )}
      {seasonal.climate?.active && seasonal.climate.note && <span className="basis-full text-caption opacity-75">Penyesuaian iklim: {seasonal.climate.note}</span>}
    </div>
  )
}
