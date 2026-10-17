import StatusHeadline from '../components/niu/StatusHeadline.jsx'
import HazardAttention from '../components/niu/HazardAttention.jsx'
import HourStrip from '../components/niu/HourStrip.jsx'
import MetricChip from '../components/MetricChip.jsx'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'

/**
 * P7.4 — beranda mobile "Ringkas".
 *
 * Susunan (dari atas): satu pembacaan besar → empat metrik pendukung →
 * "Perlu perhatian" (maks 3, dengan rincian tab) → bilah 12 jam.
 * Semua kartu lama (kualitas udara, panduan kopi, banner musim/iklim, tombol lapor)
 * tetap dirender App di bawah komponen ini — tidak ada fitur yang dihapus.
 */

const n1 = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 1 }))
const n0 = (v) => (v == null || v === '' ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: 0 }))

export default function RingkasMobile({ current, daily, location, hazards, hourly, tr = (k) => k, onOpenRisk }) {
  if (!current || !daily) return null
  const worst = hazards?.worst
  const rhTone = current.rh > 85 ? 'warn' : 'default'
  const rainTone = current.rain > 5 ? 'info' : 'default'
  const windTone = current.wind > 20 ? 'warn' : 'default'

  return (
    <div className="space-y-4">
      <StatusHeadline
        id="ringkas-status"
        kicker={tr('airTemp')}
        title={location?.name}
        value={n1(current.temp)}
        unit="°C"
        note={`${tr('min')} ${n1(daily.minTemp)} °C · ${tr('max')} ${n1(daily.maxTemp)} °C`}
        level={worst}
        levelLabel={LEVEL_LABEL[worst]}
        aside={
          <span className="inline-flex min-h-8 items-center rounded-pil border border-tanah-garis px-2.5 text-caption tabular-nums text-tanah-tinta-redup dark:border-langit-garis dark:text-langit-tinta-redup">
            <span className="font-data">{n0(location?.elevation)}</span>
            <span className="ml-1">{tr('mdpl')}</span>
          </span>
        }
      >
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-tanah-garis pt-4 dark:border-langit-garis">
          <MetricChip label={tr('humidity')} value={current.rh} unit="%" tone={rhTone} />
          <MetricChip label={tr('rainNow')} value={current.rain} unit="mm/jam" tone={rainTone} />
          <MetricChip label={tr('rainProb')} value={daily.rainProb} unit="%" />
          <MetricChip label={tr('windSpeed')} value={current.wind} unit="km/jam" tone={windTone} />
        </div>
      </StatusHeadline>

      <HazardAttention
        hazards={hazards}
        limit={3}
        heading="Perlu perhatian"
        sub="Bahaya aktif hari ini, terberat lebih dulu"
        onSeeAll={onOpenRisk}
        seeAllLabel="Lihat semua di Risiko"
      />

      <HourStrip hours={hourly} />
    </div>
  )
}
