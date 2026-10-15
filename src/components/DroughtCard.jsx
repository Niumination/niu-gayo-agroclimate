import React from 'react'

/**
 * H-KERING (v2 Fase 1, Sprint 2 — roadmap 1.9b / FR-KER-2/4 ringkas) — kartu "Kekeringan & Air Kebun".
 * Sumber: GET /api/drought?location=<id> (HTH kelas BMKG dari arsip ERA5-Land, proyeksi 3 hari ECMWF, neraca air 30 hari).
 */

const TONE = {
  ekstrem: 'text-cherry-deep dark:text-cherry-soft',
  bahaya: 'text-cherry-deep dark:text-cherry-soft',
  waspada: 'text-husk-deep dark:text-husk-soft',
  rendah: 'text-leaf-deep dark:text-leaf-soft',
}
const DOT = { ekstrem: 'bg-cherry', bahaya: 'bg-cherry', waspada: 'bg-husk', rendah: 'bg-leaf' }
const num = (v, digits = 0) => (v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
const shortDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

function Badge({ level, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${TONE[level] || TONE.rendah}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${DOT[level] || 'bg-leaf'}`} />
      {label}
    </span>
  )
}

function Metric({ label, value, unit, sub }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">{label}</p>
      <p className="font-data text-[15px] font-medium text-ink dark:text-mist tabular-nums">
        {value}
        {unit && <span className="text-[11px] font-normal text-ink/50 dark:text-mist/45 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-[11px] text-ink/50 dark:text-mist/45 leading-snug">{sub}</p>}
    </div>
  )
}

/** Batang hujan 30 hari (inline, tanpa dependensi grafik). */
function RainBars({ series, rainDayMm }) {
  if (!series?.length) return null
  const max = Math.max(5, ...series.map((s) => s.rain ?? 0))
  return (
    <div className="mt-2 flex items-end gap-[2px] h-10" role="img" aria-label={`Hujan harian ${series.length} hari terakhir`}>
      {series.map((s) => {
        const v = s.rain ?? 0
        const h = Math.max(2, Math.round((v / max) * 40))
        const dry = v < rainDayMm
        return (
          <span
            key={s.date}
            title={`${shortDate(s.date)}: ${num(v, 1)} mm`}
            className={`flex-1 rounded-sm ${dry ? 'bg-husk/50 dark:bg-husk/40' : 'bg-rain/70 dark:bg-rain/60'}`}
            style={{ height: `${h}px` }}
          />
        )
      })}
    </div>
  )
}

export default function DroughtCard({ drought, tr = (k) => k }) {
  if (!drought) return null
  const label = (k, fallback) => {
    const v = tr(k)
    return !v || v === k ? fallback : v
  }
  const title = label('drought', 'Kekeringan & Air Kebun')
  const subtitle = label('droughtSub', 'Hari Tanpa Hujan (HTH) kelas BMKG dari arsip ERA5-Land + proyeksi ECMWF')
  const shell = (children) => (
    <section aria-label={title} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )
  const a = drought.assessment
  if (!a) {
    return shell(
      <p className="pt-3 border-t border-ink/10 dark:border-mist/10 text-[13px] text-ink/60 dark:text-mist/55">
        {label('droughtUnavailable', 'Data arsip hujan belum tersedia saat ini.')}
        {drought.error && <span className="block mt-1 text-[11px] text-ink/45 dark:text-mist/40">({drought.error})</span>}
      </p>,
    )
  }
  const h = a.hth
  const b = a.balance30
  const levelLabel = { rendah: label('low', 'Rendah'), waspada: label('alert', 'Waspada'), bahaya: label('danger', 'Bahaya'), ekstrem: 'Ekstrem' }[a.level] || a.level
  const projText = h.projected.breaksOn
    ? `hujan ≥ 1 mm diperkirakan ${shortDate(h.projected.breaksOn)}`
    : h.projected.horizonDays > 0
      ? `tanpa hujan hingga ${num(h.projected.days)} hari pada ${shortDate(drought.archive?.today ? addDays(drought.archive.today, h.projected.horizonDays - 1) : null)}`
      : 'prakiraan tidak tersedia'

  return shell(
    <>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">HTH s.d. {shortDate(h.lastDataDate)}</p>
          <p className="font-data text-4xl font-semibold tabular-nums leading-none mt-1 text-ink dark:text-mist">
            {num(h.days)}
            <span className="text-base font-normal text-ink/50 dark:text-mist/45 ml-1">hari{h.truncated ? '+' : ''}</span>
          </p>
          <p className="mt-2 text-[13px] font-medium text-ink/75 dark:text-mist/70">{h.classLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">Status</p>
          <div className="mt-1">
            <Badge level={a.level} label={levelLabel} />
          </div>
        </div>
      </div>

      <RainBars series={a.series} rainDayMm={a.thresholds?.rainDayMm ?? 1} />
      <p className="mt-1 text-[11px] text-ink/50 dark:text-mist/45">
        Hujan terakhir ≥ 1 mm: {h.lastRainDate ? `${shortDate(h.lastRainDate)} (${num(h.lastRainMm, 1)} mm)` : 'tidak ada dalam arsip'} · proyeksi: {projText}
      </p>

      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 grid grid-cols-3 gap-3">
        <Metric label="Hujan 30 hari" value={num(b.rain)} unit="mm" />
        <Metric label="ET0 30 hari" value={num(b.et0)} unit="mm" sub="evapotranspirasi acuan" />
        <Metric label="Neraca P − ET0" value={`${b.balance > 0 ? '+' : ''}${num(b.balance)}`} unit="mm" sub={b.level === 'rendah' ? 'surplus/normal' : b.level === 'waspada' ? 'defisit — waspada' : 'defisit — bahaya'} />
      </div>

      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">Anjuran kebun</h3>
        <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink/75 dark:text-mist/70 list-disc pl-4">
          {a.advice.slice(0, 3).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      <p className="mt-3 text-[11px] text-ink/45 dark:text-mist/40 leading-relaxed">
        HTH = hari berturut hujan &lt; 1 mm (definisi BMKG). Arsip model ERA5-Land ~9 km, bukan penakar hujan; tertinggal {drought.archive?.lagDays ?? '—'} hari. Rujukan:{' '}
        <a className="underline" href="https://www.bmkg.go.id/iklim" target="_blank" rel="noreferrer">BMKG Iklim (Monitoring HTH dasarian)</a>
        {drought.warnings?.length > 0 && <span className="block mt-1">Catatan: {drought.warnings.join('; ')}</span>}
      </p>
    </>,
  )
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
