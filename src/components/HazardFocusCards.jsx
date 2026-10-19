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

const TONE = { ekstrem: 'text-level-ekstrem dark:text-level-ekstrem-dark', bahaya: 'text-level-bahaya dark:text-level-bahaya-dark', waspada: 'text-level-waspada dark:text-level-waspada-dark', rendah: 'text-level-rendah dark:text-level-rendah-dark', 'n/a': 'text-ink-muted dark:text-mist-muted' }
const DOT = { ekstrem: 'bg-level-ekstrem', bahaya: 'bg-level-bahaya', waspada: 'bg-level-waspada', rendah: 'bg-level-rendah', 'n/a': 'bg-ink/20 dark:bg-mist/20' }
const FILL = { ekstrem: 'var(--color-level-ekstrem)', bahaya: 'var(--color-level-bahaya)', waspada: 'var(--color-level-waspada)', rendah: 'var(--color-level-rendah)', 'n/a': 'var(--color-line-strong)' }
const num = (v, d = 0) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }))
const hhmm = (t) => (t ? `${String(t).slice(11, 16)}` : '—')
const ddmm = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—')
const STORM_METRIC_LABEL = { capeEcmwf: 'Energi badai maks', li: 'Instabilitas maks', gust: 'Hembusan maks' }

function Shell({ title, subtitle, level, children, footer, ariaLabel }) {
  return (
    <section aria-label={ariaLabel || title} data-niu-card="hazard-focus" className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
          {subtitle && <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">{subtitle}</p>}
        </div>
        {level && (
          <span className={`inline-flex items-center gap-1.5 text-body font-semibold shrink-0 ${TONE[level] || TONE['n/a']}`}>
            <span aria-hidden="true" className={`w-2 h-2 rounded-full ${DOT[level] || DOT['n/a']}`} />
            {LEVEL_LABEL[level] || level}
          </span>
        )}
      </div>
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 space-y-3">{children}</div>
      {footer && <p className="mt-3 pt-3 border-t border-ink/10 dark:border-mist/10 text-caption text-ink-muted dark:text-mist-subtle">{footer}</p>}
    </section>
  )
}

function Metric({ label, value, unit }) {
  return (
    <div className="min-w-0">
      <p className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-muted">{label}</p>
      <p className="font-data text-body font-medium text-ink dark:text-mist tabular-nums">
        {value}
        {unit && <span className="text-caption font-normal text-ink-muted dark:text-mist-muted ml-1">{unit}</span>}
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
        <li key={i} className="text-body text-ink-body dark:text-mist-body leading-snug flex gap-2">
          <span className="text-caption uppercase tracking-wide text-ink-muted dark:text-mist-subtle mt-[3px] shrink-0 w-14">{LABEL[k]}</span>
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
  const agreement = f.agreement === false ? 'Prakiraan berbeda; pantau pembaruan.' : f.agreement === true ? 'Beberapa prakiraan menunjukkan arah yang sama.' : 'Data pembanding belum lengkap.'
  return (
    <Shell title="Petir & Badai" subtitle="Pantau potensi badai dan petir dalam 12 jam ke depan." level={r.level} ariaLabel="Petir dan badai" footer="Ini bukan peringatan resmi BMKG; ikuti pengumuman setempat.">
      <p className={`text-body font-medium ${TONE[r.level]}`}>{r.headline}</p>
      {hours.length > 0 && (
        <div>
          <div className="flex gap-[2px] h-6" role="img" aria-label="Perkiraan potensi badai per jam dalam 12 jam ke depan">
            {hours.map((h) => (
              <span key={h.time} title={`${hhmm(h.time)} WIB: ${LEVEL_LABEL[h.level]}${h.gust ? ` · hembusan ${num(h.gust)} km/jam` : ''}`} className="flex-1 rounded-xs" style={{ backgroundColor: FILL[h.level], opacity: h.level === 'rendah' ? 0.35 : 0.9 }} />
            ))}
          </div>
          <div className="flex justify-between text-caption text-ink-muted dark:text-mist-subtle mt-1">
            <span>{hhmm(hours[0].time)}</span>
            <span>{f.peakTime ? `puncak ${hhmm(f.peakTime)}` : ''}</span>
            <span>{hhmm(hours[hours.length - 1].time)}</span>
          </div>
        </div>
      )}
      <div className="flex flex-wrap gap-2 text-caption">
        <span className="px-2 py-0.5 rounded-full border border-ink/15 dark:border-mist/15 text-ink-muted dark:text-mist-muted">{agreement}</span>
        {f.hail && <span className="px-2 py-0.5 rounded-full border border-husk/60 text-husk-deep dark:text-husk-soft">Potensi hujan es</span>}
        {f.tornado && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Potensi puting beliung</span>}
        {f.bmkgActive && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Peringatan dini BMKG aktif</span>}
      </div>
      <details className="text-caption text-ink-muted dark:text-mist-subtle">
        <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Angka dan sumber prakiraan</summary>
        <div className="mt-1 space-y-2">
          <div className="grid grid-cols-3 gap-3">
            {r.metrics.filter((m) => ['capeEcmwf', 'li', 'gust'].includes(m.key)).map((m) => (
              <Metric key={m.key} label={STORM_METRIC_LABEL[m.key] ?? m.label} value={num(m.value, m.key === 'li' ? 1 : 0)} unit={m.unit} />
            ))}
          </div>
          {r.detail && <p>{r.detail}</p>}
          {f.signals && <p>Perbandingan model cuaca: ECMWF {LEVEL_LABEL[f.signals.ecmwf] ?? '—'} · GFS {LEVEL_LABEL[f.signals.gfs] ?? '—'}{f.agreement === false ? ' — hasil berbeda' : f.agreement ? ' — hasil sejalan' : ''}. Kriteria badai dan hujan es memakai indikator CAPE/LI dan kode cuaca; ambang puting beliung memakai hembusan ≥ 45 km/jam.</p>}
        </div>
      </details>
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
      {d.climP95.some((v) => v != null) && <path d={path(d.climP95)} fill="none" stroke="var(--color-level-bahaya)" strokeWidth="1" strokeDasharray="3 3" opacity="0.8" />}
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
  const status = r.level === 'rendah' ? 'Belum terlihat peningkatan aliran yang menonjol.' : r.level === 'waspada' ? 'Pantau sungai dan hindari bantaran saat hujan deras.' : 'Jauhi bantaran sungai dan ikuti arahan petugas setempat.'
  return (
    <Shell title="Risiko Luapan Sungai Peusangan" subtitle="Pantau perubahan aliran sungai dan kondisi di sekitar." level={r.level} ariaLabel="Risiko luapan Sungai Peusangan" footer={`Data aliran sungai merupakan perkiraan, bukan pengukuran langsung.${cell.stale ? ' Pembaruan tertunda; data terakhir masih ditampilkan.' : ''}`}>
      <p className={`text-body font-medium ${TONE[r.level]}`}>{status}</p>
      <details>
        <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2 text-caption text-ink-muted dark:text-mist-subtle">Grafik, angka, dan sumber aliran sungai</summary>
        <div className="mt-2 space-y-3">
          <p className="text-caption text-ink-muted dark:text-mist-muted">{r.headline}</p>
          <DischargeChart cell={cell} />
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted dark:text-mist-muted">
            <span><span className="inline-block w-3 border-t-2 border-[#2b6cb0] align-middle mr-1" />aliran (garis tebal) · pita = kisaran perkiraan</span>
            <span><span className="inline-block w-3 border-t border-dashed border-[#2f855a] align-middle mr-1" />nilai tengah musiman</span>
            <span><span className="inline-block w-3 border-t border-dashed border-level-bahaya align-middle mr-1" />batas persentil 95</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Metric label="Perkiraan aliran hari ini" value={num(cell.today?.discharge, 1)} unit="m³/s" />
            <Metric label="Dibandingkan nilai tengah" value={num(cell.today?.ratio, 2)} unit="×" />
            <Metric label={`Puncak ${ddmm(cell.peak?.date)}`} value={num(cell.peak?.ratio, 2)} unit="×" />
          </div>
          {flood.cells.length > 1 && (
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-caption">
              {flood.cells.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2">
                  <span className="text-ink-body dark:text-mist-body break-words">{c.name}</span>
                  <span className={`font-data tabular-nums ${TONE[c.levelNext7] || TONE['n/a']}`}>{num(c.peak?.ratio, 1)}×</span>
                </li>
              ))}
            </ul>
          )}
          {r.flags?.bumpedByAri && <p className="text-caption text-husk-deep dark:text-husk-soft">Hujan 72 jam ≥ 100 mm menaikkan tingkat perkiraan karena tanah sudah basah.</p>}
          {r.detail && <p className="text-caption text-ink-muted dark:text-mist-subtle">{r.detail}</p>}
          {flood.label && <p className="text-caption text-ink-muted dark:text-mist-subtle">Metode dan sumber: {flood.label}; data riwayat {flood.climatology?.period ?? 'tersedia pada layanan sumber'}.</p>}
        </div>
      </details>
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
    <Shell title="Suhu & Kopi" subtitle="Pantau suhu dingin dan panas yang dapat memengaruhi kebun dalam tiga hari ke depan." level={r.level} ariaLabel="Suhu dan tanaman kopi" footer="Perkiraan regional dapat berbeda dari keadaan di kebun; periksa kondisi setempat.">
      <p className={`text-body font-medium ${TONE[r.level]}`}>{r.headline}</p>
      <div className="grid grid-cols-3 gap-2">
        {days.map((d) => (
          <div key={d.date} className="rounded-lg border border-ink/10 dark:border-mist/10 p-2">
            <p className="text-caption text-ink-muted dark:text-mist-muted">{ddmm(d.date)}</p>
            <p className="font-data text-body tabular-nums text-ink dark:text-mist"><span className={TONE[d.cold] || ''}>{num(d.tmin, 1)}</span> <span className="text-ink-subtle dark:text-mist-subtle">/</span> <span className={TONE[d.heat] || ''}>{num(d.tmax, 1)}</span> <span className="text-caption text-ink-muted dark:text-mist-muted">°C</span></p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-caption">
        {r.flags?.frost && <span className="px-2 py-0.5 rounded-full border border-cherry/60 text-cherry-deep dark:text-cherry-soft">Potensi embun upas</span>}
        {r.flags?.flowering && <span className="px-2 py-0.5 rounded-full border border-ink/15 dark:border-mist/15 text-ink-muted dark:text-mist-muted">Perkiraan masa berbunga</span>}
      </div>
      <details className="text-caption text-ink-muted dark:text-mist-subtle">
        <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian suhu dan sumber data</summary>
        <div className="mt-1 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            {days.filter((d) => d.vpd != null).map((d) => <Metric key={d.date} label={`Kelembapan udara ${ddmm(d.date)}`} value={num(d.vpd, 2)} unit="kPa" />)}
          </div>
          <p>Angka suhu mengacu pada udara sekitar 2 m di atas permukaan. Pada malam cerah dan tenang, permukaan daun atau rumput dapat 2–4 °C lebih dingin. Perhitungan menyesuaikan ketinggian sentra{r.flags?.elevationAdjusted ? ' (koreksi dataran tinggi diterapkan)' : ''}; kelembapan udara ditampilkan sebagai tekanan uap (VPD).</p>
          {r.detail && <p>{r.detail}</p>}
          <p>Sumber: prakiraan cuaca ECMWF melalui Open-Meteo.</p>
        </div>
      </details>
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
    <Shell title="Gempa Bumi" subtitle="Gempa terbaru di sekitar dan riwayat kejadian." level={r.level} ariaLabel="Gempa bumi" footer="Perkiraan dampak dapat berbeda menurut kondisi bangunan; ikuti informasi resmi BMKG.">
      <p className={`text-body font-medium ${TONE[r.level]}`}>{r.headline}</p>
      {recent.length > 0 && (
        <details>
          <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2 text-caption text-ink-muted dark:text-mist-subtle">Lihat daftar kejadian dan angka pendukung</summary>
          <ul className="mt-1 divide-y divide-ink/10 dark:divide-mist/10 text-caption">
            {recent.map((q) => (
              <li key={q.id} className="py-1.5 flex items-center justify-between gap-2">
                <span className="min-w-0 break-words text-ink-body dark:text-mist-body">{String(q.time).slice(0, 16).replace('T', ' ')} · magnitudo {num(q.mag, 1)} · kedalaman {num(q.depthKm)} km · {q.region}</span>
                <span className={`font-data tabular-nums shrink-0 ${TONE[q.level] || TONE['n/a']}`}>{num(q.distKm)} km · {q.mmi ?? '–'}</span>
              </li>
            ))}
          </ul>
          {r.detail && <p className="mt-2 text-caption text-ink-muted dark:text-mist-subtle">{r.detail}</p>}
        </details>
      )}
      {r.flags?.landslideAfterQuake && <p className="text-caption text-cherry-deep dark:text-cherry-soft">Guncangan dapat meningkatkan risiko longsor susulan. Hindari lereng dan tebing, lalu pantau retakan baru.</p>}
      <AdviceList advice={r.advice} max={3} />
    </Shell>
  )
}

export function VolcanoCard({ hazards, volcano }) {
  const r = pick(hazards, 'vulkanik')
  if (!r || r.level === 'n/a') return null
  const v = volcano?.volcano
  return (
    <Shell title="Gunung Burni Telong" subtitle="Ikuti perkembangan aktivitas dan arahan keselamatan." level={r.level} ariaLabel="Aktivitas Gunung Burni Telong" footer="Sumber status resmi: PVMBG / MAGMA Indonesia.">
      <p className={`text-body font-medium ${TONE[r.level]}`}>{r.headline}</p>
      <details>
        <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2 text-caption text-ink-muted dark:text-mist-subtle">Jarak, arah angin, dan catatan sumber</summary>
        <div className="mt-2 space-y-2">
          <div className="grid grid-cols-3 gap-3">
            {r.metrics.slice(0, 3).map((m) => (
              <Metric key={m.key} label={m.label} value={typeof m.value === 'number' ? num(m.value, 1) : m.value ?? '—'} unit={m.unit} />
            ))}
          </div>
          {r.detail && <p className="text-caption text-ink-muted dark:text-mist-muted">{r.detail}</p>}
          {v?.reportUrl && <a className="min-h-11 inline-flex items-center underline text-caption" href={v.reportUrl} target="_blank" rel="noreferrer noopener">Buka laporan terbaru MAGMA Indonesia</a>}
        </div>
      </details>
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
        <p className="text-body text-ink-muted dark:text-mist-muted">Belum ada laporan warga di wilayah Gayo dalam 7 hari terakhir. Lapor via <a className="min-h-11 inline-flex items-center underline" href="https://petabencana.id" target="_blank" rel="noreferrer noopener">petabencana.id</a> atau tombol Lapor di aplikasi ini.</p>
      ) : (
        <ul className="divide-y divide-ink/10 dark:divide-mist/10">
          {d.reports.slice(0, 6).map((r) => (
            <li key={r.id} className="py-2 text-caption">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-ink dark:text-mist">{PB_TYPE[r.type] ?? r.type}</span>
                <span className="text-ink-muted dark:text-mist-muted tabular-nums">{r.createdAt ? new Date(r.createdAt).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }) : ''} · {r.distanceKm} km</span>
              </div>
              {r.text && <p className="text-ink-body dark:text-mist-body leading-snug mt-0.5">{r.text}</p>}
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
        <li key={i.id} className={`text-caption leading-snug rounded-lg border px-3 py-2 ${i.severity === 'bahaya' || i.severity === 'ekstrem' ? 'border-cherry/40 bg-cherry/5' : 'border-husk/40 bg-husk/5'}`}>
          <span className="font-semibold text-ink dark:text-mist">{i.label}</span>
          {i.bumped && <span className="ml-1 text-caption text-ink-muted dark:text-mist-muted">Tingkat risiko terkait dinaikkan.</span>}
          <p className="text-ink-body dark:text-mist-body mt-0.5">{i.humanNote || i.note}</p>
          <details className="mt-1 text-caption text-ink-muted dark:text-mist-subtle">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Dasar penilaian teknis</summary>
            <p className="mt-1">{i.note}</p>
            {i.bumped && <p className="mt-1">Bahaya {i.bumped.id}: tingkat {LEVEL_LABEL[i.bumped.from]} dinaikkan menjadi {LEVEL_LABEL[i.bumped.to]}.</p>}
          </details>
        </li>
      ))}
    </ul>
  )
}
