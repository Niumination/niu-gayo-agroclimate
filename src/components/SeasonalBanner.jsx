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
      <span className="text-caption">{seasonal.note}</span>
      {/* Fase 3.4 — fase kering (karhutla/kekeringan) + jendela embun upas + penyesuaian ENSO/IOD */}
      {seasonal.dry && (
        <span className="basis-full text-caption opacity-90">
          Musim kering: <strong>{seasonal.dry.label}</strong> ({seasonal.dry.months}) — {seasonal.dry.note}
          {seasonal.frostWindow ? ' Wilayah dataran tinggi berpeluang mengalami embun upas pada malam cerah dan tenang.' : ''}
        </span>
      )}
      {seasonal.climate?.active && seasonal.climate.note && <span className="basis-full text-caption">Perkiraan iklim: {seasonal.climate.note}</span>}
      {seasonal.climate?.active && seasonal.climate.detail && (
        <details className="basis-full mt-1 text-caption">
          <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian teknis iklim</summary>
          <p className="mt-1">{seasonal.climate.detail}</p>
        </details>
      )}
    </div>
  )
}
