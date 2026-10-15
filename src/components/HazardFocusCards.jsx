import React from 'react'
import { LEVEL_LABEL } from '../domain/hazards/levels.js'

/**
 * Fase 2–3 — kartu fokus per bahaya baru, semuanya membaca HasilHazard dari registry (data.hazards.results) + payload mentah:
 *  - StormCard (FR-KONV-3): level, jam puncak, indikator per model, strip 12 jam, hujan es/puting beliung.
 *  - FloodCard (FR-BJR-5): debit GloFAS 14 hari (SVG inline) vs median & p95 klimatologi, rasio, label "model, bukan muka air".
 *  - TemperatureCard (FR-SUHU-3): Tmin/Tmax 3 hari + risiko dingin/panas + anjuran.
 *  - QuakeCard (FR-GEMPA-3) & VolcanoCard (FR-VULK-3): ringkas dari flags.
 *  - ExternalReportsCard (FR-BJR-6): laporan warga PetaBencana.id (CC BY-NC 4.0).
 * Tanpa dependensi grafik; semua angka diformat id-ID.
 */

const TONE = { ekstrem: 'text-cherry-deep dark:text-cherry-soft', bahaya: 'text-cherry-deep dark:text-cherry-soft', waspada: 'text-husk-deep dark:text-husk-soft', rendah: 'text-leaf-deep dark:text-leaf-soft', 'n/a': 'text-ink/50 dark:text-mist/45' }
const DOT = { ekstrem: 'bg-cherry', bahaya: 'bg-cherry', waspada: 'bg-husk', rendah: 'bg-leaf', 'n/a': 'bg-ink/20 dark:bg-mist/20' }
const FILL = { ekstrem: '#b3261e', bahaya: '#b3261e', waspada: '#b7791f', rendah: '#2f855a', 'n/a': '#9ca3af' }
const num = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }))
const hhmm = (t) => (t ? `${String(t).slice(11, 16)}` : '—')
const ddmm = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—')

function Shell({ title, subtitle, level, children, footer, ariaLabel }) {
  return (
    <section aria-label={ariaLabel || title} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
          {subtitle && <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{subtitle}</p>}
        </div>
        {level && (
          <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold shrink-0 ${TONE[level] || TONE['n/a']}`}>
            <span aria-hidden="true" className={`w-2 h-2 rounded-full ${DOT[level] || DOT['n/a']}`} />
            {LEVEL_LABEL[level] || level}
          </span>
        )}
      </div>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 space-y-3">{children}</div>
      {footer && <p className="mt-3 pt-3 border-t border-ink/10 dark:border-mist/10 text-[11px] text-ink/45 dark:text-mist/40">{footer}</p>}
    </section>
  )
}

function Metric({ label, value, unit }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">{label}</p>
      <p className="font-data text-[15px] font-medium text-ink dark:text-mist tabular-nums">
        {value}
        {unit && <span className="text-[11px] font-normal text-ink/50 dark:text-mist/45 ml-1">{unit}</span>}
      </p>
    </div>
  )
}

function AdviceList({ advice, keys = ['umum', 'kebun', 'rentan', 'sekolah'], max = 4 }) {
  const items = keys.flatMap((k) => (advice?.[k] ?? []).map((t) => ({ k, t }))).slice(0, max)
  if (!items.length) return null
  const LABEL = { umum: 'Umum', kebun: 'Kebun', rentan: 'Kelompok rentan', sekolah: 'Sekolah' }
  return (
    <ul className="space-y-1.5">
      {items.map(({ k, t }, i) => (
        <li key={i} className="text-[13px] text-ink/80 dark:text-mist/75 leading-snug flex gap-2">
          <span className="text-[10px] uppercase tracking-wide text-ink/45 dark:text-mist/40 mt-[3px] shrink-0 w-14">{LABEL[k]}</span>
          <span>{t}</span>
        </li>
      ))}
    </ul>
  )
}

const pick = (hazards, id) => hazards?.results?.find((r) => r.id === id) ?? null

/* ---------------- H-PETIR ---------------- */
export function StormCard({ hazards }) {
  const r = pick(hazards, 'badai')
  if (!r || r.level === 'n/a') return null
  const f = r.flags ?? {}
  const hours = f.hours ?? []
  return (
    <Shell title="Petir & Badai" subtitle="Indeks konvektif 12 jam — ECMWF (CAPE, kode cuaca) × GFS (Lifted Index)" level={r.level} ariaLabel="Petir dan badai konvektif" footer={`${(r.sources ?? []).map((s) => s.name).join(' · ')} · estimasi model, bukan peringatan resmi`}>
      <p className={`text-[13px] font-medium ${TONE[r.level]}`}>{r.headline}</p>
      {hours.length > 0 && (
        <div>
          <div className="flex gap-[2px] h-6" role="img" aria-label="Level konvektif per jam 12 jam ke depan">
            {hours.map((h) => (
              <span key={h.time} title={`${hhmm(h.time)} WIB: ${LEVEL_LABEL[h.level]} · CAPE ${num(h.capeEcmwf)} J/kg${h.li != null ? ` · LI ${h.li}` : ''}${h.gust ? ` · hembusan ${num(h.gust)} km/jam` : ''}`} className="flex-1 rounded-sm" style={{ backgroundColor: FILL[h.level], opacity: h.level === 'rendah' ? 0.35 : 0.9 }} />
            ))}
          </div>
          <div className="flex justify-between text-[10px] text-ink/45 dark:text-mist/40 mt-1">
            <span>{hhmm(hours[0].time)}</span>
            <span>{f.peakTime ? `puncak ${hhmm(f.peakTime)}` : ''}</span>
            <span>{hhmm(hours[hours.length - 1].time)}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-3 gap-3">
        {r.metrics.filter((m) => ['capeEcmwf', 'li', 'gust'].includes(m.key)).map((m) => (
          <Metric key={m.key} label={m.label} value={num(m.value, m.key === 'li' ? 1 : 0)} unit={m.unit} />
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {f.signals && (
          <span className={`px-2 py-0.5 rounded-full border ${f.agreement === false ? 'border-husk/60 text-husk-deep dark:text-husk-soft' : 'border-ink/15 dark:border-mist/15 text-ink/60 dark:text-mist/55'}`}>
            ECMWF {LEVEL_LABEL[f.signals.ecmwf] ?? '–'} · GFS {LEVEL_LABEL[f.signals.gfs] ?? '–'}{f.agreement === false ? ' — tidak sepakat' : f.agreement ? ' — sepakat' : ''}
          </span>
        )}
        {f.hail && <span className="px-2 py-0.5 rounded-full border border-husk/60 text-husk-deep dark:text-husk-soft">Potensi hujan es (kualitatif)</span>}
        {f.tornado && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Potensi puting beliung (≥ 45 km/jam = ekstrem BMKG)</span>}
        {f.bmkgActive && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Peringatan dini BMKG aktif</span>}
      </div>
      <AdviceList advice={r.advice} />
    </Shell>
  )
}

/* ---------------- H-BANJIR+ ---------------- */
function DischargeChart({ cell }) {
  const d = cell?.daily
  if (!d?.time?.length) return null
  const W = 320
  const H = 96
  const padL = 30
  const padB = 16
  const n = d.time.length
  const all = [...d.discharge, ...d.climMedian, ...d.climP95, ...(d.max ?? [])].filter((v) => v != null)
  const maxV = Math.max(1, ...all) * 1.1
  const x = (i) => padL + (i / Math.max(1, n - 1)) * (W - padL - 4)
  const y = (v) => H - padB - (v / maxV) * (H - padB - 6)
  const path = (arr) => arr.map((v, i) => (v == null ? null : `${i === 0 || arr[i - 1] == null ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean).join(' ')
  const band = d.min && d.max && d.min.some((v) => v != null) ? `${d.max.map((v, i) => (v == null ? '' : `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)).join(' ')} ${[...d.min].reverse().map((v, j) => (v == null ? '' : `L${x(n - 1 - j).toFixed(1)},${y(v).toFixed(1)}`)).join(' ')} Z` : null
  const todayX = x(cell.todayIdx ?? 0)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Debit GloFAS sel ${cell.name} 14 hari dengan median dan p95 klimatologi`}>
      {band && <path d={band} fill="#2b6cb0" opacity="0.12" />}
      {d.climP95.some((v) => v != null) && <path d={path(d.climP95)} fill="none" stroke="#b3261e" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />}
      {d.climMedian.some((v) => v != null) && <path d={path(d.climMedian)} fill="none" stroke="#2f855a" strokeWidth="1" strokeDasharray="4 2" opacity="0.9" />}
      <path d={path(d.discharge)} fill="none" stroke="#2b6cb0" strokeWidth="2" />
      <line x1={todayX} x2={todayX} y1={4} y2={H - padB} stroke="currentColor" opacity="0.3" strokeWidth="1" />
      {d.time.map((t, i) => (i % 3 === 0 ? <text key={t} x={x(i)} y={H - 3} fontSize="8" textAnchor="middle" fill="currentColor" opacity="0.55">{ddmm(t)}</text> : null))}
      <text x={2} y={y(maxV / 1.1) + 3} fontSize="8" fill="currentColor" opacity="0.55">{num(maxV / 1.1)}</text>
      <text x={2} y={H - padB} fontSize="8" fill="currentColor" opacity="0.55">0</text>
    </svg>
  )
}

export function FloodCard({ hazards, flood }) {
  const r = pick(hazards, 'banjir')
  if (!r || r.level === 'n/a' || !flood?.cells?.length) return null
  const cell = flood.cells.find((c) => c.id === r.flags?.cell) ?? flood.cells[0]
  return (
    <Shell title="Debit Sungai & Luapan DAS Peusangan" subtitle={`GloFAS v4 (Copernicus) sel ${cell.name} · klimatologi ${flood.climatology?.period?.split(' ')[0] ?? '1997'}–2025`} level={r.level} ariaLabel="Debit sungai dan luapan DAS Peusangan" footer={`${flood.label ?? 'Model hidrologi global — bukan muka air terukur.'}${cell.stale ? ' · nilai terakhir (API gagal)' : ''}`}>
      <p className={`text-[13px] font-medium ${TONE[r.level]}`}>{r.headline}</p>
      <DischargeChart cell={cell} />
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-ink/55 dark:text-mist/50">
        <span><span className="inline-block w-3 border-t-2 border-[#2b6cb0] align-middle mr-1" />debit (garis tebal) · pita = sebaran ensemble</span>
        <span><span className="inline-block w-3 border-t border-dashed border-[#2f855a] align-middle mr-1" />median musiman</span>
        <span><span className="inline-block w-3 border-t border-dashed border-[#b3261e] align-middle mr-1" />p95</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Debit hari ini" value={num(cell.today?.discharge, 1)} unit="m³/s" />
        <Metric label="× median musiman" value={num(cell.today?.ratio, 2)} unit="×" />
        <Metric label={`Puncak ${ddmm(cell.peak?.date)}`} value={num(cell.peak?.ratio, 2)} unit="×" />
      </div>
      {flood.cells.length > 1 && (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[12px]">
          {flood.cells.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2">
              <span className="text-ink/70 dark:text-mist/65 truncate">{c.name}</span>
              <span className={`font-data tabular-nums ${TONE[c.levelNext7] || TONE['n/a']}`}>{num(c.peak?.ratio, 1)}×</span>
            </li>
          ))}
        </ul>
      )}
      {r.flags?.bumpedByAri && <p className="text-[12px] text-husk-deep dark:text-husk-soft">Hujan 72 jam ≥ 100 mm: tanah jenuh → level dinaikkan satu tingkat.</p>}
      <AdviceList advice={r.advice} />
    </Shell>
  )
}

/* ---------------- H-SUHU ---------------- */
export function TemperatureCard({ hazards }) {
  const r = pick(hazards, 'suhu')
  if (!r || r.level === 'n/a') return null
  const days = r.flags?.days ?? []
  return (
    <Shell title="Suhu & Kopi" subtitle="Stres dingin / embun upas & panas / aborsi bunga — 3 hari ke depan" level={r.level} ariaLabel="Suhu ekstrem untuk kopi" footer="Suhu udara 2 m model ECMWF; permukaan daun/rumput bisa lebih dingin 2–4 °C pada malam cerah & tenang.">
      <p className={`text-[13px] font-medium ${TONE[r.level]}`}>{r.headline}</p>
      <div className="grid grid-cols-3 gap-2">
        {days.map((d) => (
          <div key={d.date} className="rounded-lg border border-ink/10 dark:border-mist/10 p-2">
            <p className="text-[11px] text-ink/50 dark:text-mist/45">{ddmm(d.date)}</p>
            <p className="font-data text-[15px] tabular-nums text-ink dark:text-mist"><span className={TONE[d.cold] || ''}>{num(d.tmin, 1)}</span> <span className="text-ink/40 dark:text-mist/35">/</span> <span className={TONE[d.heat] || ''}>{num(d.tmax, 1)}</span> <span className="text-[10px] text-ink/45">°C</span></p>
            {d.vpd != null && <p className="text-[10px] text-ink/45 dark:text-mist/40">VPD {num(d.vpd, 2)} kPa</p>}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-[11px]">
        {r.flags?.frost && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Potensi embun upas</span>}
        {r.flags?.flowering && <span className="px-2 py-0.5 rounded-full border border-ink/15 dark:border-mist/15 text-ink/60 dark:text-mist/55">Fase bunga (indikatif)</span>}
        {r.flags?.elevationAdjusted && <span className="px-2 py-0.5 rounded-full border border-ink/15 dark:border-mist/15 text-ink/60 dark:text-mist/55">Koreksi −1 °C (≥ 1.400 m)</span>}
      </div>
      <AdviceList advice={r.advice} keys={['kebun', 'rentan', 'umum', 'sekolah']} />
    </Shell>
  )
}

/* ---------------- H-GEMPA & H-VULKANIK ---------------- */
export function QuakeCard({ hazards }) {
  const r = pick(hazards, 'gempa')
  if (!r || r.level === 'n/a') return null
  const recent = r.flags?.recent ?? []
  return (
    <Shell title="Gempa Bumi" subtitle="BMKG (gempa dirasakan, M ≥ 5, terkini) + riwayat USGS 10 tahun" level={r.level} ariaLabel="Gempa bumi" footer="MMI per sentra = estimasi atenuasi (indikatif); info resmi: bmkg.go.id / aplikasi InfoBMKG">
      <p className={`text-[13px] font-medium ${TONE[r.level]}`}>{r.headline}</p>
      {recent.length > 0 && (
        <ul className="divide-y divide-ink/10 dark:divide-mist/10 text-[12px]">
          {recent.map((q) => (
            <li key={q.id} className="py-1.5 flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-ink/75 dark:text-mist/70">{String(q.time).slice(0, 16).replace('T', ' ')} · M{num(q.mag, 1)} · {num(q.depthKm)} km · {q.region}</span>
              <span className={`font-data tabular-nums shrink-0 ${TONE[q.level] || TONE['n/a']}`}>{num(q.distKm)} km · {q.mmi ?? '–'}</span>
            </li>
          ))}
        </ul>
      )}
      {r.flags?.landslideAfterQuake && <p className="text-[12px] text-cherry-deep dark:text-cherry-soft">Gempa M ≥ 5 ≤ 100 km + tanah jenuh → risiko longsor susulan 72 jam.</p>}
      <AdviceList advice={r.advice} max={3} />
    </Shell>
  )
}

export function VolcanoCard({ hazards, volcano }) {
  const r = pick(hazards, 'vulkanik')
  if (!r || r.level === 'n/a') return null
  const v = volcano?.volcano
  return (
    <Shell title="Gunung Burni Telong" subtitle={v ? `Tingkat aktivitas Level ${v.roman ?? v.level ?? ''} ${v.label ?? ''} (PVMBG/MAGMA)` : 'Tingkat aktivitas PVMBG (MAGMA Indonesia)'} level={r.level} ariaLabel="Aktivitas Gunung Burni Telong" footer="Sumber: MAGMA Indonesia (PVMBG, Badan Geologi) · sektor bawah angin dari angin 10 m model">
      <p className={`text-[13px] font-medium ${TONE[r.level]}`}>{r.headline}</p>
      <div className="grid grid-cols-3 gap-3">
        {r.metrics.slice(0, 3).map((m) => (
          <Metric key={m.key} label={m.label} value={typeof m.value === 'number' ? num(m.value, 1) : m.value ?? '—'} unit={m.unit} />
        ))}
      </div>
      <AdviceList advice={r.advice} max={3} />
    </Shell>
  )
}

/* ---------------- PetaBencana ---------------- */
const PB_TYPE = { flood: 'Banjir', haze: 'Kabut asap', fire: 'Kebakaran', earthquake: 'Gempa', wind: 'Angin', volcano: 'Gunung api', landslide: 'Longsor', prep: 'Kesiapsiagaan', road: 'Jalan terputus', power: 'Listrik padam' }
export function ExternalReportsCard({ externalReports }) {
  const d = externalReports
  if (!d || (d.degraded && !d.total)) return null
  return (
    <Shell title="Laporan Warga PetaBencana.id" subtitle="Dataran Tinggi Gayo (Aceh Tengah, Bener Meriah, Gayo Lues) · 7 hari terakhir" ariaLabel="Laporan warga PetaBencana" footer={`${d.attribution}.`}>
      {d.total === 0 ? (
        <p className="text-[13px] text-ink/60 dark:text-mist/55">Belum ada laporan warga di wilayah Gayo dalam 7 hari terakhir. Lapor via <a className="underline" href="https://petabencana.id" target="_blank" rel="noreferrer noopener">petabencana.id</a> atau tombol Lapor di aplikasi ini.</p>
      ) : (
        <ul className="divide-y divide-ink/10 dark:divide-mist/10">
          {d.reports.slice(0, 6).map((r) => (
            <li key={r.id} className="py-2 text-[12px]">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink dark:text-mist">{PB_TYPE[r.type] ?? r.type}</span>
                <span className="text-ink/50 dark:text-mist/45 tabular-nums">{r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : ''} · {r.distanceKm} km</span>
              </div>
              {r.text && <p className="text-ink/70 dark:text-mist/65 leading-snug mt-0.5">{r.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </Shell>
  )
}

/* ---------------- Interaksi lintas-bahaya ---------------- */
export function InteractionsList({ interactions }) {
  if (!interactions?.length) return null
  return (
    <ul className="space-y-1.5" aria-label="Interaksi lintas-bahaya">
      {interactions.map((i) => (
        <li key={i.id} className={`text-[12px] leading-snug rounded-lg border px-3 py-2 ${i.severity === 'bahaya' || i.severity === 'ekstrem' ? 'border-cherry/40 bg-cherry/5' : 'border-husk/40 bg-husk/5'}`}>
          <span className="font-semibold text-ink dark:text-mist">{i.label}</span>
          {i.bumped && <span className="ml-1 text-[11px] text-ink/60 dark:text-mist/55">({i.bumped.id}: {LEVEL_LABEL[i.bumped.from]} → {LEVEL_LABEL[i.bumped.to]})</span>}
          <p className="text-ink/75 dark:text-mist/70 mt-0.5">{i.note}</p>
        </li>
      ))}
    </ul>
  )
}
