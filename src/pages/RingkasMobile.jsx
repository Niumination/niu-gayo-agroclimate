import { useState } from 'react'
import StatusHeadline from '../components/niu/StatusHeadline.jsx'
import InstrumentTechnicalDetail from '../components/niu/InstrumentTechnicalDetail.jsx'
import HazardAttention from '../components/niu/HazardAttention.jsx'
import HourStrip from '../components/niu/HourStrip.jsx'
import MetricChip from '../components/MetricChip.jsx'
import { WeatherIcon } from '../icons/index.jsx'
import { weatherGlyphForCode, weatherLabelKey } from '../domain/weather/wmo.js'
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

export default function RingkasMobile({
  current,
  daily,
  location,
  modelElevation,
  hazards,
  hourly,
  tr = (k) => k,
  onOpenRisk,
  showAttention = true,
  showHours = true,
  showCondition = false,
  className = '',
  // F-04: layar desktop boleh mengirim level akut (tanpa bahaya kronis/endemik) supaya badge
  // di panel konteks tidak bertentangan dengan bilah ringkasan. Tanpa prop ini perilaku mobile
  // sepenuhnya tetap memakai `hazards.worst`.
  worstLevel,
}) {
  const [technicalOpen, setTechnicalOpen] = useState(false)
  if (!current || !daily) return null
  const worst = worstLevel ?? hazards?.worst
  const rhTone = current.rh > 85 ? 'warn' : 'default'
  const rainTone = current.rain > 5 ? 'info' : 'default'
  const windTone = current.wind > 20 ? 'warn' : 'default'
  const locationSubtitle = [
    location?.elevation != null ? `${tr('elevationLine')} ${n0(location.elevation)} ${tr('mdpl')}` : null,
    location?.type,
  ].filter(Boolean).join(' · ')
  const weatherContext = [
    current.rh >= 85 ? tr('humidContext') : null,
    current.wind < 10 ? tr('weakWindContext') : null,
  ].filter(Boolean)
  const statusNote = [
    `${tr('min')} ${n1(daily.minTemp)}°C · ${tr('max')} ${n1(daily.maxTemp)}°C`,
    ...weatherContext,
  ].join(' · ')
  const technicalId = 'ringkas-status-technical'
  // Glyph cuaca hanya diminta Living Map desktop (fase 3); mobile tetap sama.
  const glyphName = showCondition ? weatherGlyphForCode(current.weatherCode) : null

  return (
    <div className={`niu-ringkas-mobile space-y-4 ${className}`}>
      <StatusHeadline
        id="ringkas-status"
        kicker={tr('airTemp')}
        kickerNode={
          glyphName ? (
            <span className="niu-condition-chip">
              <WeatherIcon key={glyphName} name={glyphName} motion={showCondition} className="niu-condition-icon h-4 w-4 shrink-0" />
              <span>{tr(weatherLabelKey(glyphName))}</span>
            </span>
          ) : null
        }
        title={location?.name ? `${tr('nowAt')} ${location.name}` : tr('airTemp')}
        subtitle={locationSubtitle}
        value={n1(current.temp)}
        unit="°C"
        note={statusNote}
        level={worst}
        levelLabel={LEVEL_LABEL[worst]}
      >
        <div className="niu-metrics mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-tanah-garis pt-4 dark:border-langit-garis">
          <MetricChip label={tr('humidity')} compactLabel={tr('humidityCompact')} value={current.rh} unit="%" tone={rhTone} />
          <MetricChip label={tr('rainNow')} compactLabel={tr('rainNowCompact')} value={current.rain} unit="mm/jam" tone={rainTone} />
          <MetricChip label={tr('rainProb')} compactLabel={tr('rainProbCompact')} value={daily.rainProb} unit="%" />
          <MetricChip label={tr('windSpeed')} compactLabel={tr('windSpeedCompact')} value={current.wind} unit="km/jam" tone={windTone} />
        </div>
        <div className="niu-instrument-detail mt-4 border-t border-dashed border-tanah-garis pt-3 dark:border-langit-garis">
          <button
            type="button"
            aria-expanded={technicalOpen}
            aria-controls={technicalId}
            onClick={() => setTechnicalOpen((open) => !open)}
            className="inline-flex min-h-11 items-center gap-2 rounded-pil bg-tanah-terbenam px-4 text-body-sm font-semibold text-tanah-aksen transition-colors duration-100 ease-out hover:bg-tanah-permukaan active:scale-[.98] dark:rounded-none dark:bg-transparent dark:px-1 dark:text-langit-aksen dark:hover:bg-transparent"
          >
            <span aria-hidden="true" className="text-xl leading-none">{technicalOpen ? '−' : '+'}</span>
            {technicalOpen ? tr('closeTechnicalDetails') : tr('technicalDetails')}
          </button>
          <InstrumentTechnicalDetail
            id={technicalId}
            open={technicalOpen}
            current={current}
            location={location}
            modelElevation={modelElevation}
          />
        </div>
      </StatusHeadline>

      {showAttention && (
        <HazardAttention
          hazards={hazards}
          limit={3}
          heading="Perlu perhatian"
          sub="Bahaya aktif hari ini, terberat lebih dulu"
          onSeeAll={onOpenRisk}
          seeAllLabel="Lihat semua di Risiko"
        />
      )}

      {showHours && <HourStrip hours={hourly} />}
    </div>
  )
}
