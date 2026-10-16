import React, { useState } from 'react'
import { GROUP_LABEL } from '../domain/hazards/index.js'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'
import { InteractionsList } from './HazardFocusCards.jsx'
import { prefs } from '../lib/prefs.js'
import ShareButton from './ShareButton.jsx'

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

/**
 * Glyph level — bentuk berbeda per tingkat supaya makna tidak bergantung warna saja
 * (WCAG 1.4.1; ~8 % pria buta warna merah-hijau). Dekoratif → aria-hidden.
 */
function LevelGlyph({ level, className = 'w-3 h-3 shrink-0' }) {
  const common = { viewBox: '0 0 12 12', className, 'aria-hidden': 'true', focusable: 'false' }
  if (level === 'rendah')
    return (
      <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 6.4 4.6 9 10 3.2" />
      </svg>
    )
  if (level === 'waspada')
    return (
      <svg {...common} fill="currentColor">
        <path d="M6 1 11.4 10.6H.6z" />
        <path d="M5.4 4.4h1.2v3.2H5.4zM5.4 8.4h1.2v1.2H5.4z" fill="var(--color-surface)" stroke="none" />
      </svg>
    )
  if (level === 'bahaya')
    return (
      <svg {...common} fill="currentColor">
        <path d="M6 1.2a3.6 3.6 0 0 1 3.6 3.6c0 1.5.5 2.2 1.1 3H1.3c.6-.8 1.1-1.5 1.1-3A3.6 3.6 0 0 1 6 1.2Z" />
        <path d="M4.6 9.1h2.8a1.4 1.4 0 0 1-2.8 0Z" />
      </svg>
    )
  if (level === 'ekstrem')
    return (
      <svg {...common} fill="currentColor">
        <path d="M3.9.8h4.2l3.1 3.1v4.2l-3.1 3.1H3.9L.8 8.1V3.9z" />
        <path d="M5.4 3.4h1.2v3.4H5.4zM5.4 7.8h1.2v1.2H5.4z" fill="var(--color-surface)" stroke="none" />
      </svg>
    )
  return (
    <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
      <path d="M2.5 6h7" />
    </svg>
  )
}

const num = (v, digits = 1) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('id-ID', { maximumFractionDigits: digits }) : String(v))
const clock = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function Badge({ level, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${TONE[level] || TONE['n/a']}`}>
      <LevelGlyph level={level} />
      {label ?? LEVEL_LABEL[level] ?? level}
    </span>
  )
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
          <p className="text-[11px] uppercase tracking-wide text-ink-muted dark:text-mist-subtle">{label}</p>
          <ul className="list-disc pl-4 text-[12px] leading-snug text-ink-body dark:text-mist-body space-y-0.5">
            {advice[k].slice(0, 3).map((a, i) => (
              <li key={i}>{typeof a === 'string' ? a : a?.id ?? JSON.stringify(a)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

function HazardRow({ r, open, onToggle, lang }) {
  const label = (lang === 'gayo' && r.label?.gayo) || r.label?.id || r.id
  const metrics = (r.metrics || []).filter((m) => m.value != null).slice(0, 4)
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="w-full text-left flex items-start justify-between gap-3"
      >
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-body dark:text-mist-body truncate">{label}</p>
          <p className={`text-[12px] leading-snug mt-0.5 ${r.level === 'n/a' ? 'text-ink-muted dark:text-mist-subtle' : 'text-ink-body dark:text-mist-muted'}`}>{r.headline}</p>
        </div>
        <div className="shrink-0 flex items-baseline gap-2">
          <Badge level={r.level} />
          {typeof r.score === 'number' && <span className="font-data text-[11px] text-ink-muted dark:text-mist-subtle">{r.score}</span>}
          <span aria-hidden="true" className="text-[11px] text-ink-subtle dark:text-mist-subtle">{open ? '▴' : '▾'}</span>
        </div>
      </button>
      {open && (
        <div className="mt-2 pl-0.5">
          {r.detail && <p className="text-[12px] leading-snug text-ink-body dark:text-mist-muted">{r.detail}</p>}
          {metrics.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-baseline justify-between gap-2 border-b border-dotted border-ink/10 dark:border-mist/10">
                  <dt className="text-[11px] text-ink-muted dark:text-mist-muted truncate">{m.label ?? m.key}</dt>
                  <dd className="font-data text-[12px] text-ink dark:text-mist">
                    {num(m.value)}
                    {m.unit ? <span className="text-ink-muted dark:text-mist-subtle text-[10px]"> {m.unit}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <AdviceList advice={r.advice} />
          {r.sources?.length > 0 && (
            <p className="mt-2 text-[11px] text-ink-muted dark:text-mist-subtle">
              Sumber: {r.sources.map((s) => s.name).join(' · ')}
              {r.flags?.estimate ? ' · nilai estimasi model, bukan pengukuran stasiun' : ''}
            </p>
          )}
        </div>
      )}
    </li>
  )
}

export default function HazardPanel({ hazards, location, lang = 'id', onAbout, onToggleHidden, tr = (k) => k }) {
  const [openId, setOpenId] = useState(null)
  const [showAll, setShowAll] = useState(false)
  if (!hazards?.results?.length) return null
  const { results, worst, active, counts, interactions = [] } = hazards
  const hidden = prefs.getHiddenHazards()
  const visible = showAll ? results : results.filter((r) => r.level !== 'n/a' || active.length === 0)
  const asOf = clock(results[0]?.evaluatedAt)
  const headline =
    active.length === 0
      ? counts.degraded === counts.total
        ? 'Data bahaya belum tersedia'
        : 'Tidak ada bahaya aktif saat ini'
      : `${active.length} bahaya aktif — tertinggi: ${LEVEL_LABEL[worst]}`
  const groups = [...new Set(results.map((r) => r.group))].map((g) => GROUP_LABEL[g] || g).join(' · ')

  return (
    <section
      aria-label="Indeks bahaya majemuk"
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">Indeks Bahaya {location?.name ? `— ${location.name}` : ''}</h2>
          <p className="text-[13px] text-ink-muted dark:text-mist-muted mt-0.5">{groups}</p>
        </div>
        <Badge level={worst} />
      </div>

      <div className="py-3 border-y border-ink/10 dark:border-mist/10">
        <p className={`text-[13px] font-medium ${active.length ? TONE[worst] : 'text-ink-body dark:text-mist-muted'}`}>{headline}</p>
        {active.length > 0 && (
          <p className="text-[12px] text-ink-muted dark:text-mist-muted mt-0.5">
            {active.map((r) => ((lang === 'gayo' && r.label?.gayo) || r.label?.id || r.id)).join(', ')}
          </p>
        )}
        {counts.degraded > 0 && counts.degraded < counts.total && (
          <p className="text-[11px] text-ink-muted dark:text-mist-subtle mt-1">{counts.degraded} bahaya tanpa data (sumber tidak tersedia / tidak berlaku di sentra ini).</p>
        )}
        {/* Fase 2.5 (FR-X-2) — aturan interaksi lintas-bahaya */}
        {interactions.length > 0 && <div className="mt-2"><InteractionsList interactions={interactions} /></div>}
      </div>

      <ul className="divide-y divide-ink/10 dark:divide-mist/10 pt-3">
        {visible.map((r) => (
          <HazardRow key={r.id} r={r} lang={lang} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t border-ink/10 dark:border-mist/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-ink-muted dark:text-mist-subtle">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {visible.length < results.length && (
            <button type="button" onClick={() => setShowAll(true)} className="underline underline-offset-2 hover:text-ink dark:hover:text-mist">
              Tampilkan semua ({results.length})
            </button>
          )}
          {showAll && visible.length === results.length && results.some((r) => r.level === 'n/a') && (
            <button type="button" onClick={() => setShowAll(false)} className="underline underline-offset-2 hover:text-ink dark:hover:text-mist">
              Sembunyikan yang tanpa data
            </button>
          )}
          {hidden.length > 0 && onToggleHidden && (
            <button type="button" onClick={() => onToggleHidden([])} className="underline underline-offset-2 hover:text-ink dark:hover:text-mist">
              Tampilkan {hidden.length} bahaya yang disembunyikan
            </button>
          )}
          {onAbout && (
            <button type="button" onClick={onAbout} className="underline underline-offset-2 hover:text-ink dark:hover:text-mist">
              Tentang data &amp; batasan
            </button>
          )}
          <ShareButton hazards={hazards} location={location} />
        </div>
        <span>{asOf ? `Evaluasi ${asOf} WIB` : ''} · informasi pendukung, bukan peringatan resmi</span>
      </div>
    </section>
  )
}
