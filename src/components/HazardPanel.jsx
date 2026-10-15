import React, { useState } from 'react'
import { GROUP_LABEL } from '../domain/hazards/index.js'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'
import { prefs } from '../lib/prefs.js'
import ShareButton from './ShareButton.jsx'

/**
 * v2 Fase 0 (roadmap 0.4 / FR-X-2, FR-X-3, FR-X-6) — panel "Indeks Bahaya" yang dirender dari registry.
 * Sumber: data.hazards = evaluateAll(ctx) → { results[] (sudah terurut level tertinggi dulu), worst, active[], counts }.
 * Kartu rinci lama (DisasterWarning, AirQualityCard, FireDangerCard, DroughtCard) tetap ada; panel ini ringkasan + rincian ringkas per bahaya.
 * Tanpa fetch, tanpa logika domain (hanya tampilan). Palet: badge titik warna, hairline rules (lihat AirQualityCard).
 */

const TONE = {
  ekstrem: 'text-cherry-deep dark:text-cherry-soft',
  bahaya: 'text-cherry-deep dark:text-cherry-soft',
  waspada: 'text-husk-deep dark:text-husk-soft',
  rendah: 'text-leaf-deep dark:text-leaf-soft',
  'n/a': 'text-ink/45 dark:text-mist/40',
}
const DOT = { ekstrem: 'bg-cherry', bahaya: 'bg-cherry', waspada: 'bg-husk', rendah: 'bg-leaf', 'n/a': 'bg-ink/20 dark:bg-mist/20' }

const num = (v, digits = 1) => (v == null || v === '' ? '—' : typeof v === 'number' ? v.toLocaleString('id-ID', { maximumFractionDigits: digits }) : String(v))
const clock = (iso) => {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function Badge({ level, label }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${TONE[level] || TONE['n/a']}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${DOT[level] || DOT['n/a']}${level === 'ekstrem' ? ' animate-pulse' : ''}`} />
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
          <p className="text-[11px] uppercase tracking-wide text-ink/45 dark:text-mist/40">{label}</p>
          <ul className="list-disc pl-4 text-[12px] leading-snug text-ink/75 dark:text-mist/70 space-y-0.5">
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
          <p className="text-[13px] font-medium text-ink/80 dark:text-mist/75 truncate">{label}</p>
          <p className={`text-[12px] leading-snug mt-0.5 ${r.level === 'n/a' ? 'text-ink/45 dark:text-mist/40' : 'text-ink/65 dark:text-mist/60'}`}>{r.headline}</p>
        </div>
        <div className="shrink-0 flex items-baseline gap-2">
          <Badge level={r.level} />
          {typeof r.score === 'number' && <span className="font-data text-[11px] text-ink/45 dark:text-mist/40">{r.score}</span>}
          <span aria-hidden="true" className="text-[11px] text-ink/35 dark:text-mist/30">{open ? '▴' : '▾'}</span>
        </div>
      </button>
      {open && (
        <div className="mt-2 pl-0.5">
          {r.detail && <p className="text-[12px] leading-snug text-ink/65 dark:text-mist/60">{r.detail}</p>}
          {metrics.length > 0 && (
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
              {metrics.map((m) => (
                <div key={m.key} className="flex items-baseline justify-between gap-2 border-b border-dotted border-ink/10 dark:border-mist/10">
                  <dt className="text-[11px] text-ink/50 dark:text-mist/45 truncate">{m.label ?? m.key}</dt>
                  <dd className="font-data text-[12px] text-ink dark:text-mist">
                    {num(m.value)}
                    {m.unit ? <span className="text-ink/45 dark:text-mist/40 text-[10px]"> {m.unit}</span> : null}
                  </dd>
                </div>
              ))}
            </dl>
          )}
          <AdviceList advice={r.advice} />
          {r.sources?.length > 0 && (
            <p className="mt-2 text-[11px] text-ink/45 dark:text-mist/40">
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
  const { results, worst, active, counts } = hazards
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
          <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{groups}</p>
        </div>
        <Badge level={worst} />
      </div>

      <div className="py-3 border-y border-ink/10 dark:border-mist/10">
        <p className={`text-[13px] font-medium ${active.length ? TONE[worst] : 'text-ink/70 dark:text-mist/60'}`}>{headline}</p>
        {active.length > 0 && (
          <p className="text-[12px] text-ink/60 dark:text-mist/55 mt-0.5">
            {active.map((r) => ((lang === 'gayo' && r.label?.gayo) || r.label?.id || r.id)).join(', ')}
          </p>
        )}
        {counts.degraded > 0 && counts.degraded < counts.total && (
          <p className="text-[11px] text-ink/45 dark:text-mist/40 mt-1">{counts.degraded} bahaya tanpa data (sumber tidak tersedia / tidak berlaku di sentra ini).</p>
        )}
      </div>

      <ul className="divide-y divide-ink/10 dark:divide-mist/10 pt-3">
        {visible.map((r) => (
          <HazardRow key={r.id} r={r} lang={lang} open={openId === r.id} onToggle={() => setOpenId(openId === r.id ? null : r.id)} />
        ))}
      </ul>

      <div className="mt-3 pt-3 border-t border-ink/10 dark:border-mist/10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] text-ink/45 dark:text-mist/40">
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
