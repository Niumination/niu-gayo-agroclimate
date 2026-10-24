import { ArrowDown } from 'lucide-react'
import { LEVEL_LABEL, LEVEL_ORDER } from '../../domain/hazards/levels.js'

/** Ringkasan satu-sentuh seperti pita status pada prototipe papan kerja v6. */
export default function DesktopSummaryBar({ hazards, onOpenRisk, onSelectHazard }) {
  const results = hazards?.results ?? []
  const allActive = (hazards?.active ?? []).filter((item) => LEVEL_ORDER[item.level] >= LEVEL_ORDER.waspada)
  // F-04 (audit 23 Okt 2026): karat endemik di dataran tinggi — level "bahaya" sepanjang tahun
  // karena model ambang absolut jenuh. Levelnya tidak diubah; ia hanya dipisahkan dari hitungan
  // harian supaya "terberat" kembali menunjukkan bahaya yang benar-benar berubah hari ini.
  const chronic = (hazards?.chronic ?? []).filter((item) => (LEVEL_ORDER[item.level] ?? 0) >= LEVEL_ORDER.waspada)
  const chronicIds = new Set(chronic.map((item) => item.id))
  const active = allActive.filter((item) => !chronicIds.has(item.id))
  const top = [...active].sort((a, b) => (LEVEL_ORDER[b.level] ?? 0) - (LEVEL_ORDER[a.level] ?? 0)).slice(0, 3)
  const worst = LEVEL_LABEL[hazards?.worstAcute ?? hazards?.worst] ?? 'belum tersedia'
  const allUnavailable = results.length > 0 && results.every((item) => item.level === 'n/a')
  // Ditulis sebagai satu baris tambahan-pendek, bukan baris baru: tinggi kartu tidak berubah
  // (F-08: footer harus tetap 0 px gulir).
  const chronicNote = chronic.length ? ` · ${chronic.map((item) => item.label?.id ?? item.id).join(', ').toLowerCase()} endemik` : ''
  const chronicTitle = chronic.length
    ? chronic.map((item) => `${item.label?.id ?? item.id}: ${LEVEL_LABEL[item.level] ?? item.level} sepanjang tahun — kelola rutin, bukan alarm harian`).join('\n')
    : undefined

  return (
    <div className="niu-desktop-summarybar" role="status" aria-live="polite">
      <span className="niu-summary-dot" aria-hidden="true" />
      <div className="niu-summary-copy">
        <strong>{allUnavailable ? 'Data bahaya belum tersedia' : active.length ? `${active.length} bahaya perlu perhatian` : 'Tidak ada bahaya akut saat ini'}</strong>
        <span title={chronicTitle}>{`dari ${results.length || 11} dipantau · tertinggi ${worst}${chronicNote}`}</span>
      </div>
      <div className="niu-summary-chips" aria-label="Bahaya yang perlu perhatian">
        {top.map((item) => {
          const label = item.label?.id || item.id
          return (
            <button
              key={item.id}
              type="button"
              data-level={item.level}
              className="min-h-11 active:scale-[.97]"
              onClick={() => {
                onSelectHazard?.(item.id)
                onOpenRisk?.()
              }}
              aria-label={`Buka rincian ${label}`}
            >
              {label}
            </button>
          )
        })}
      </div>
      <button type="button" className="niu-summary-link min-h-11 active:scale-[.97]" onClick={onOpenRisk}>
        Lihat semua <ArrowDown aria-hidden="true" />
      </button>
    </div>
  )
}
