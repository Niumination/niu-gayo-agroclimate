import {  useState  } from 'react'
import { GROUP_LABEL } from '../domain/hazards/index.js'
import { LEVEL_LABEL, LEVEL_ORDER } from '../domain/hazards/levels.js'
import { InteractionsList } from './HazardFocusCards.jsx'
import { prefs } from '../lib/prefs.js'
import ShareButton from './ShareButton.jsx'
import EmptyState from './EmptyState'
import { HazardIcon } from '../icons/index.jsx'
import LevelBadge from './niu/LevelBadge.jsx'

/**
 * v2 Fase 0 (roadmap 0.4 / FR-X-2, FR-X-3, FR-X-6) — panel "Indeks Bahaya" yang dirender dari registry.
 * Sumber: data.hazards = evaluateAll(ctx) → { results[] (sudah terurut level tertinggi dulu), worst, active[], counts }.
 * Kartu rinci lama (DisasterWarning, AirQualityCard, FireDangerCard, DroughtCard) tetap ada; panel ini ringkasan + rincian ringkas per bahaya.
 * Tanpa fetch, tanpa logika domain (hanya tampilan). Palet: badge titik warna, hairline rules (lihat AirQualityCard).
 */

// Ramp level terukur (docs/reference/DESIGN-TOKENS.md §3.3): warna + label + bentuk ikon.
const TONE = {
  ekstrem: 'text-level-ekstrem dark:text-level-ekstrem-dark',
  bahaya: 'text-level-bahaya dark:text-level-bahaya-dark',
  waspada: 'text-level-waspada dark:text-level-waspada-dark',
  rendah: 'text-level-rendah dark:text-level-rendah-dark',
  'n/a': 'text-ink-muted dark:text-mist-subtle',
}

const num = (v, digits = 1) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('id-ID', { maximumFractionDigits: digits }) : String(v))
const clock = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function AdviceList({ advice }) {
  const groups = [
    ['umum', 'Umum'],
    ['rentan', 'Kelompok rentan'],
    ['kebun', 'Kebun & panen'],
    ['sekolah', 'Sekolah'],
  ].filter(([k]) => Array.isArray(advice?.[k]) && advice[k].length > 0)
  if (!groups.length) return null
  return (
    <div className="mt-2 space-y-1.5">
      {groups.map(([k, label]) => (
        <div key={k}>
          <p className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-subtle">{label}</p>
          <ul className="list-disc pl-4 text-caption leading-snug text-ink-body dark:text-mist-body space-y-0.5">
            {advice[k].slice(0, 3).map((a, i) => (
              <li key={i}>{typeof a === 'string' ? a : a?.id ?? JSON.stringify(a)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function HazardRow({ r, open, onToggle, onSelect, inlineDetail }) {
  const label = r.label?.id || r.id
  const metrics = (r.metrics || []).filter((m) => m.value != null).slice(0, 4)
  const score = Number.isFinite(r.score) ? Math.max(0, Math.min(100, Math.round(r.score))) : null
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={() => (onSelect ? onSelect(r.id) : onToggle())}
        aria-expanded={onSelect ? undefined : open}
        aria-current={onSelect && open ? 'true' : undefined}
        data-hazard-row={r.id}
        className="min-h-11 inline-flex items-center w-full text-left flex items-start justify-between gap-3 transition duration-100 ease-out active:scale-[.97]"
      >
        <div className="min-w-0">
          <p className="flex items-start gap-2 text-body font-medium text-ink-body dark:text-mist-body break-words">
            <HazardIcon id={r.id} className="mt-0.5 h-4 w-4 shrink-0 text-ink-muted dark:text-mist-muted" />
            <span className="min-w-0">{label}</span>
          </p>
          <p className={`text-caption leading-snug mt-0.5 ${r.level === 'n/a' ? 'text-ink-muted dark:text-mist-subtle' : 'text-ink-body dark:text-mist-muted'}`}>{r.headline}</p>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <LevelBadge level={r.level} />
          {onSelect && (
            score == null ? (
              <span className="font-data text-caption tabular-nums text-ink-muted dark:text-mist-muted" aria-label="Skor belum tersedia">—</span>
            ) : (
              <span
                className="niu-hazard-score"
                role="meter"
                aria-label={`Skor ${score} dari 100`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={score}
              >
                <span className="niu-hazard-score-track" aria-hidden="true">
                  <span className="niu-hazard-score-fill" data-level={r.level} style={{ width: `${score}%` }} />
                </span>
                <b className="font-data tabular-nums">{score}</b>
              </span>
            )
          )}
          <span aria-hidden="true" className="text-caption text-ink-subtle dark:text-mist-subtle">{open ? '▴' : '▾'}</span>
        </div>
      </button>
      {open && onSelect && inlineDetail}
      {open && !onSelect && (
        <div className="mt-2 pl-0.5">
          {r.detail && (
            <details className="text-caption leading-snug text-ink-body dark:text-mist-muted">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Catatan teknis</summary>
              <p className="mt-1">{r.detail}</p>
            </details>
          )}
          {metrics.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-baseline justify-between gap-2 border-b border-dotted border-ink/10 dark:border-mist/10">
                  <dt className="text-caption text-ink-muted dark:text-mist-muted break-words">{m.label ?? m.key}</dt>
                  <dd className="font-data text-caption text-ink dark:text-mist tabular-nums">
                    {num(m.value)}
                    {m.unit ? <span className="text-ink-muted dark:text-mist-subtle text-caption"> {m.unit}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <AdviceList advice={r.advice} />
          {r.sources?.length > 0 && (
            <details className="mt-2 text-caption text-ink-muted dark:text-mist-subtle">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Sumber dan cara memperkirakan</summary>
              <p className="mt-1">
                Sumber: {r.sources.map((s) => s.name).join(' · ')}
                {r.flags?.estimate ? ' · angka ini merupakan perkiraan, bukan pengukuran langsung di stasiun' : ''}
              </p>
            </details>
          )}
        </div>
      )}
    </li>
  )
}

export default function HazardPanel({ hazards, location, onAbout, onToggleHidden, onSelect, selectedId, inlineDetail, tr = (k) => k }) {
  const [openId, setOpenId] = useState(null)
  const [showAll, setShowAll] = useState(false)
  const [hazardFilter, setHazardFilter] = useState('semua')
  if (!hazards?.results?.length) {
    return <EmptyState title={tr('emptyData')} hint={tr('emptyHint')} />
  }
  const { results, worst, active, counts, interactions = [] } = hazards
  const hidden = prefs.getHiddenHazards()
  const attentionCount = results.filter((r) => LEVEL_ORDER[r.level] >= LEVEL_ORDER.waspada).length
  const safeCount = results.filter((r) => r.level === 'rendah').length
  const visible = onSelect
    ? results.filter((r) => {
        if (hazardFilter === 'perhatian') return LEVEL_ORDER[r.level] >= LEVEL_ORDER.waspada
        if (hazardFilter === 'aman') return r.level === 'rendah'
        return true
      })
    : showAll ? results : results.filter((r) => r.level !== 'n/a' || active.length === 0)
  const asOf = clock(results[0]?.evaluatedAt)
  const headline =
    active.length === 0
      ? counts.degraded === counts.total
        ? 'Data bahaya belum tersedia'
        : 'Tidak ada bahaya aktif saat ini'
      : `${active.length} bahaya perlu perhatian, terberat: ${LEVEL_LABEL[worst]}`
  const groups = [...new Set(results.map((r) => r.group))].map((g) => GROUP_LABEL[g] || g).join(' · ')
  const groupsHuman = groups
    .replace('Agro-kopi', 'Kebun kopi')
    .replace('Hidrometeorologi', 'Hujan & angin')
    .replace('Atmosfer & kebakaran', 'Udara & api')
    .replace('Geologi', 'Tanah & gunung')

  return (
    <section
      aria-label="Daftar bahaya di sekitar"
      data-niu-card="hazard-list"
      className="niu-hazard-list bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Bahaya di sekitar {location?.name ?? 'Anda'}</h2>
          <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Semua yang perlu dipantau hari ini: {groupsHuman}</p>
        </div>
        <LevelBadge level={worst} />
      </div>

      <div className="py-3 border-y border-ink/10 dark:border-mist/10">
        <p className={`text-body font-medium ${active.length ? TONE[worst] : 'text-ink-body dark:text-mist-muted'}`}>{headline}</p>
        {active.length > 0 && (
          <p className="text-caption text-ink-muted dark:text-mist-muted mt-0.5">
            {active.map((r) => r.label?.id || r.id).join(', ')}
          </p>
        )}
        {counts.degraded > 0 && counts.degraded < counts.total && (
          <p className="text-caption text-ink-muted dark:text-mist-subtle mt-1">{counts.degraded} bahaya tanpa data (sumber tidak tersedia / tidak berlaku di sentra ini).</p>
        )}
        {/* Fase 2.5 (FR-X-2) — aturan interaksi lintas-bahaya */}
        {interactions.length > 0 && <div className="mt-2"><InteractionsList interactions={interactions} /></div>}
      </div>

      {onSelect && (
        <div className="niu-hazard-filter-group" role="group" aria-label="Saring bahaya">
          <button type="button" onClick={() => setHazardFilter('semua')} aria-pressed={hazardFilter === 'semua'} className="min-h-11 active:scale-[.97]">
            <span>Semua</span><span className="niu-hazard-filter-count">{results.length}</span>
          </button>
          <button type="button" onClick={() => setHazardFilter('perhatian')} aria-pressed={hazardFilter === 'perhatian'} className="min-h-11 active:scale-[.97]">
            <span>Perlu perhatian</span><span className="niu-hazard-filter-count">{attentionCount}</span>
          </button>
          <button type="button" onClick={() => setHazardFilter('aman')} aria-pressed={hazardFilter === 'aman'} className="min-h-11 active:scale-[.97]">
            <span>Aman</span><span className="niu-hazard-filter-count">{safeCount}</span>
          </button>
        </div>
      )}

      <ul className="divide-y divide-ink/10 dark:divide-mist/10 pt-3" aria-live={onSelect ? 'polite' : undefined}>
        {visible.length === 0 && (
          <li className="py-4 text-body-sm text-ink-muted dark:text-mist-muted">Tidak ada bahaya pada saringan ini.</li>
        )}
        {visible.map((r) => (
          <HazardRow
            key={r.id}
            r={r}
            open={selectedId ? selectedId === r.id : openId === r.id}
            onToggle={() => setOpenId(openId === r.id ? null : r.id)}
            onSelect={onSelect}
            inlineDetail={r.id === selectedId ? inlineDetail : null}
          />
        ))}
      </ul>
      {onSelect && inlineDetail && !visible.some((r) => r.id === selectedId) && inlineDetail}

      <div className="mt-3 pt-3 border-t border-ink/10 dark:border-mist/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-caption text-ink-muted dark:text-mist-subtle">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {!onSelect && visible.length < results.length && (
            <button type="button" onClick={() => setShowAll(true)} className="min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
              {tr('showAll')} ({results.length})
            </button>
          )}
          {!onSelect && showAll && visible.length === results.length && results.some((r) => r.level === 'n/a') && (
            <button type="button" onClick={() => setShowAll(false)} className="min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
              {tr('hideNoData')}
            </button>
          )}
          {hidden.length > 0 && onToggleHidden && (
            <button type="button" onClick={() => onToggleHidden([])} className="min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
              {tr('showHidden')} ({hidden.length})
            </button>
          )}
          {onAbout && (
            <button type="button" onClick={onAbout} className="min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]">
              {tr('aboutData')}
            </button>
          )}
          <ShareButton hazards={hazards} location={location} tr={tr} />
        </div>
        <span>{asOf ? `${tr('evaluatedAt')} ${asOf} WIB` : ''} · {tr('unofficialNote')}</span>
      </div>
    </section>
  )
}
