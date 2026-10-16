import {  useState  } from 'react'
import EmptyState from './EmptyState'

/**
 * Fase 1.9d (FR-X-8) — riwayat kejadian multi-bahaya per sentra dengan filter per bahaya (chip) dan status darurat.
 * Sumber: data.disaster.disasterHistory ← GET /api/disaster-history?location=<id> (lastEvents ≤ 8, byHazard).
 */
const HAZARD_LABEL = { longsor: 'Longsor', banjir: 'Banjir', kebakaran: 'Kebakaran', gempa: 'Gempa', vulkanik: 'Vulkanik', angin: 'Angin', asap: 'Asap', kekeringan: 'Kekeringan' }
const DOT = { longsor: 'bg-husk', banjir: 'bg-rain', kebakaran: 'bg-cherry', gempa: 'bg-ink/50 dark:bg-mist/50', vulkanik: 'bg-cherry', angin: 'bg-husk', asap: 'bg-ink/40 dark:bg-mist/40', kekeringan: 'bg-husk' }
const fmt = (iso) => {
  const d = new Date(`${iso}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta' })
}

export default function DisasterHistoryCard({ history, location, tr = (k) => k }) {
  const [filter, setFilter] = useState(null)
  if (!history?.count) {
    return <EmptyState title={tr('emptyHistory')} hint={tr('emptyHint')} />
  }
  const events = (history.lastEvents ?? []).filter((e) => !filter || (e.hazard ?? e.type) === filter)
  const chips = Object.entries(history.byHazard ?? {}).sort((a, b) => b[1] - a[1])
  return (
    <section aria-label="Riwayat kejadian bencana" className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Riwayat kejadian {location?.name ? `— ${location.name}` : ''}</h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">{history.count} kejadian terdokumentasi publik (BNPB/BPBD/media) · bukan daftar lengkap</p>
      </div>
      {chips.length > 1 && (
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-ink/10 dark:border-mist/10">
          <button type="button" onClick={() => setFilter(null)} className={`min-h-11 inline-flex items-center px-2.5 py-1 rounded-full text-caption border transition duration-100 ease-out active:scale-[.97] ${!filter ? 'border-ink/40 dark:border-mist/40 text-ink dark:text-mist' : 'border-ink/15 dark:border-mist/15 text-ink-muted dark:text-mist-muted'}`}>
            Semua
          </button>
          {chips.map(([h, n]) => (
            <button key={h} type="button" onClick={() => setFilter(filter === h ? null : h)} aria-pressed={filter === h} className={`min-h-11 px-2.5 py-1 rounded-full text-caption border transition duration-100 ease-out active:scale-[.97] inline-flex items-center gap-1.5 ${filter === h ? 'border-ink/40 dark:border-mist/40 text-ink dark:text-mist' : 'border-ink/15 dark:border-mist/15 text-ink-muted dark:text-mist-muted'}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${DOT[h] || 'bg-ink/30'}`} />
              {HAZARD_LABEL[h] ?? h} {n}
            </button>
          ))}
        </div>
      )}
      <ul className="divide-y divide-ink/10 dark:divide-mist/10">
        {events.map((e) => (
          <li key={e.id ?? `${e.date}-${e.title}`} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-body font-medium text-ink-body dark:text-mist-body inline-flex items-center gap-1.5">
                  <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${DOT[e.hazard ?? e.type] || 'bg-ink/30'}`} />
                  {e.title}
                </p>
                {e.summary && <p className="text-caption leading-snug text-ink-muted dark:text-mist-muted mt-0.5">{e.summary}</p>}
                <p className="text-caption text-ink-muted dark:text-mist-subtle mt-1">
                  {fmt(e.date)}{e.district ? ` · ${e.district}` : ''}
                  {e.emergencyStatus && <span className="ml-1.5 inline-block px-1.5 rounded border border-cherry/40 text-cherry-deep dark:text-cherry-soft uppercase tracking-wide">{e.emergencyStatus}</span>}
                  {e.source && (
                    <>
                      {' · '}
                      <a href={e.source} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline underline-offset-2">sumber</a>
                    </>
                  )}
                </p>
              </div>
              <span className="shrink-0 font-data text-caption text-ink-muted dark:text-mist-subtle tabular-nums">{e.year}</span>
            </div>
          </li>
        ))}
        {events.length === 0 && <li className="py-3 text-caption text-ink-muted dark:text-mist-muted">Tidak ada kejadian untuk filter ini.</li>}
      </ul>
    </section>
  )
}
