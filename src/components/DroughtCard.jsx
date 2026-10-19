import EmptyState from './EmptyState'

/**
 * H-KERING (v2 Fase 1, Sprint 2 — roadmap 1.9b / FR-KER-2/4 ringkas) — kartu "Kekeringan & Air Kebun".
 * Sumber: GET /api/drought?location=<id> (HTH kelas BMKG dari arsip ERA5-Land, proyeksi 3 hari ECMWF, neraca air 30 hari).
 */

const TONE = {
  ekstrem: 'text-level-ekstrem dark:text-level-ekstrem-dark',
  bahaya: 'text-level-bahaya dark:text-level-bahaya-dark',
  waspada: 'text-level-waspada dark:text-level-waspada-dark',
  rendah: 'text-level-rendah dark:text-level-rendah-dark',
}
const DOT = { ekstrem: 'bg-level-ekstrem', bahaya: 'bg-level-bahaya', waspada: 'bg-level-waspada', rendah: 'bg-level-rendah' }
const num = (v, digits = 0) => (v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
const shortDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}

function Badge({ level, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-body font-semibold ${TONE[level] || TONE.rendah}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${DOT[level] || 'bg-leaf'}`} />
      {label}
    </span>
  )
}

function Metric({ label, value, unit, sub }) {
  return (
    <div className="min-w-0">
      <p className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-muted">{label}</p>
      <p className="font-data text-body font-medium text-ink dark:text-mist tabular-nums">
        {value}
        {unit && <span className="text-caption font-normal text-ink-muted dark:text-mist-muted ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-caption text-ink-muted dark:text-mist-muted leading-snug">{sub}</p>}
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
            className={`flex-1 rounded-xs ${dry ? 'bg-husk/50 dark:bg-husk/40' : 'bg-rain/70 dark:bg-rain/60'}`}
            style={{ height: `${h}px` }}
          />
        )
      })}
    </div>
  )
}

export default function DroughtCard({ drought, tr = (k) => k }) {
  if (!drought) {
    return <EmptyState title={tr('droughtUnavailable')} hint={tr('emptyHint')} />
  }
  const label = (k, fallback) => {
    const v = tr(k)
    return !v || v === k ? fallback : v
  }
  const title = label('drought', 'Kekeringan & Air Kebun')
  const subtitle = label('droughtSub', 'Pantau hujan terkini dan kebutuhan air kebun.')
  const shell = (children) => (
    <section aria-label={title} data-niu-card="drought" className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )
  const a = drought.assessment
  if (!a) {
    return shell(
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 text-body text-ink-muted dark:text-mist-muted">
        <p>{label('droughtUnavailable', 'Data hujan belum tersedia saat ini.')}</p>
        {drought.error && (
          <details className="mt-2 text-caption">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Lihat rincian gangguan sumber</summary>
            <p className="mt-1 break-words">{drought.error}</p>
          </details>
        )}
      </div>,
    )
  }
  const h = a.hth
  const b = a.balance30
  const levelLabel = { rendah: label('low', 'Rendah'), waspada: label('alert', 'Waspada'), bahaya: label('danger', 'Bahaya'), ekstrem: 'Ekstrem' }[a.level] || a.level
  const projText = h.projected.breaksOn
    ? `hujan diperkirakan turun pada ${shortDate(h.projected.breaksOn)}`
    : h.projected.horizonDays > 0
      ? `belum ada hujan dalam perkiraan sampai ${shortDate(drought.archive?.today ? addDays(drought.archive.today, h.projected.horizonDays - 1) : null)}`
      : 'perkiraan belum tersedia'

  return shell(
    <>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 flex items-start justify-between gap-3">
        <div>
          <p className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-muted">Tanpa hujan sampai {shortDate(h.lastDataDate)}</p>
          <p className="font-data text-4xl font-semibold tabular-nums leading-none mt-1 text-ink dark:text-mist">
            {num(h.days)}
            <span className="text-base font-normal text-ink-muted dark:text-mist-muted ml-1">hari{h.truncated ? '+' : ''}</span>
          </p>
          <p className="mt-2 text-body font-medium text-ink-body dark:text-mist-body">{h.classLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-muted">Keadaan</p>
          <div className="mt-1">
            <Badge level={a.level} label={levelLabel} />
          </div>
        </div>
      </div>

      <RainBars series={a.series} rainDayMm={a.thresholds?.rainDayMm ?? 1} />
      <p className="mt-1 text-caption text-ink-muted dark:text-mist-muted">
        Hujan terakhir: {h.lastRainDate ? `${shortDate(h.lastRainDate)} (${num(h.lastRainMm, 1)} mm)` : 'tidak ada dalam arsip'} · perkiraan ke depan: {projText}
      </p>

      <details className="group mt-4 border-t border-ink/10 pt-1 dark:border-mist/10">
        <summary className="mt-4 min-h-11 inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-ink/15 px-3 text-body font-semibold text-leaf-deep dark:border-mist/15 dark:text-leaf-soft">
          Angka &amp; istilah teknis
        </summary>

      <div className="mt-2 grid grid-cols-3 gap-3">
        <Metric label="Hujan 30 hari" value={num(b.rain)} unit="mm" />
        <Metric label="ET0 30 hari" value={num(b.et0)} unit="mm" sub="evapotranspirasi acuan" />
        <Metric label="Neraca P − ET0" value={`${b.balance > 0 ? '+' : ''}${num(b.balance)}`} unit="mm" sub={b.level === 'rendah' ? 'surplus/normal' : b.level === 'waspada' ? 'defisit — waspada' : 'defisit — bahaya'} />
      </div>

      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">Anjuran kebun</h3>
        <ul className="mt-1.5 space-y-1 text-body leading-relaxed text-ink-body dark:text-mist-body list-disc pl-4">
          {a.advice.slice(0, 3).map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
      </div>
      </details>
      {(drought.archive?.lagDays ?? 0) > 1 && (
        <p role="status" className="mt-3 text-caption text-husk-deep dark:text-husk-soft">
          Pembaruan data hujan tertunda. Periksa kondisi setempat dan prakiraan resmi BMKG.
        </p>
      )}
      <details className="group mt-4 border-t border-ink/10 pt-1 dark:border-mist/10">
        <summary className="mt-3 min-h-11 inline-flex cursor-pointer list-none items-center gap-2 rounded-lg border border-ink/15 px-3 text-body font-semibold text-leaf-deep dark:border-mist/15 dark:text-leaf-soft">
          Sumber, metode, dan catatan data
        </summary>
        <p className="mt-2 text-caption text-ink-muted dark:text-mist-subtle leading-relaxed">
          HTH adalah jumlah hari berturut-turut dengan hujan di bawah 1 mm (definisi BMKG). Arsip perkiraan hujan ERA5-Land mencakup hingga 90 hari, beresolusi sekitar 9 km, dan bukan pengukuran langsung di kebun; data tertinggal {drought.archive?.lagDays ?? '—'} hari. Rujukan:{' '}
          <a className="min-h-11 inline-flex items-center underline" href="https://www.bmkg.go.id/iklim" target="_blank" rel="noreferrer">BMKG Iklim (Monitoring HTH dasarian)</a>
          {drought.warnings?.length > 0 && <span className="block mt-1">Catatan sumber: {drought.warnings.join('; ')}</span>}
        </p>
      </details>
    </>,
  )
}

function addDays(iso, n) {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
