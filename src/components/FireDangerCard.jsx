import React, { useState } from 'react'

/**
 * H-API (v2 Fase 1, Sprint 2 — roadmap 1.6 / FR-API-4/5) — kartu "Bahaya Kebakaran & Hotspot".
 * Sumber: GET /api/fire-danger?location=<id> (FWI harian dari ERA5+ECMWF, hotspot FIRMS, HTH).
 * Gaya mengikuti AirQualityCard: satu panel, hairline rules, badge titik warna. Tanpa fetch di komponen.
 */

const TONE = {
  ekstrem: 'text-cherry-deep dark:text-cherry-soft',
  bahaya: 'text-cherry-deep dark:text-cherry-soft',
  waspada: 'text-husk-deep dark:text-husk-soft',
  rendah: 'text-leaf-deep dark:text-leaf-soft',
}
const DOT = { ekstrem: 'bg-cherry', bahaya: 'bg-cherry', waspada: 'bg-husk', rendah: 'bg-leaf' }
// Kelas FDRS (rendah/sedang/tinggi/ekstrem) → nada warna.
const CLASS_TONE = { rendah: TONE.rendah, sedang: 'text-rain dark:text-rain', tinggi: TONE.waspada, ekstrem: TONE.bahaya }
const CLASS_DOT = { rendah: 'bg-leaf', sedang: 'bg-rain', tinggi: 'bg-husk', ekstrem: 'bg-cherry' }
const CLASS_LABEL = { rendah: 'Rendah', sedang: 'Sedang', tinggi: 'Tinggi', ekstrem: 'Ekstrem' }

const num = (v, digits = 0) => (v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits }))
const shortDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00+07:00`)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Jakarta' })
}
const clock = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' })
}

function Badge({ level, label, toneMap = TONE, dotMap = DOT }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${toneMap[level] || TONE.rendah}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${dotMap[level] || 'bg-leaf'}`} />
      {label}
    </span>
  )
}

function Code({ label, value, cls, sub }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">{label}</p>
      <p className="font-data text-[15px] font-medium text-ink dark:text-mist tabular-nums">{value}</p>
      {cls && (
        <p className={`text-[11px] font-medium ${CLASS_TONE[cls] || ''}`}>
          <span aria-hidden="true" className={`inline-block w-1.5 h-1.5 rounded-full mr-1 align-middle ${CLASS_DOT[cls] || 'bg-leaf'}`} />
          {CLASS_LABEL[cls] || cls}
        </p>
      )}
      {sub && <p className="text-[11px] text-ink/50 dark:text-mist/45 leading-snug">{sub}</p>}
    </div>
  )
}

export default function FireDangerCard({ fireDanger, tr = (k) => k }) {
  const [showAll, setShowAll] = useState(false)
  if (!fireDanger) return null
  const label = (k, fallback) => {
    const v = tr(k)
    return !v || v === k ? fallback : v
  }
  const title = label('fireDanger', 'Bahaya Kebakaran & Hotspot')
  const subtitle = label('fireDangerSub', 'FWI System (FDRS Indonesia) dari ERA5/ECMWF + hotspot NASA FIRMS')

  const shell = (children) => (
    <section aria-label={title} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )

  const latest = fireDanger.fwi?.latest
  if (!latest) {
    return shell(
      <p className="pt-3 border-t border-ink/10 dark:border-mist/10 text-[13px] text-ink/60 dark:text-mist/55">
        {label('fireDangerUnavailable', 'Kode bahaya kebakaran belum tersedia saat ini.')}
        {fireDanger.warnings?.length > 0 && (
          <span className="block mt-1 text-[11px] text-ink/45 dark:text-mist/40">({fireDanger.warnings[0]})</span>
        )}
      </p>,
    )
  }

  const a = fireDanger.assessment
  const c = latest.codes
  const k = latest.classes
  const hs = fireDanger.hotspots
  const sum = hs?.summary
  const hth = fireDanger.hth
  const levelLabel = {
    rendah: label('low', 'Rendah'),
    waspada: label('alert', 'Waspada'),
    bahaya: label('danger', 'Bahaya'),
    ekstrem: 'Ekstrem',
  }[a.level] || a.level
  const advice = showAll ? a.advice : a.advice.slice(0, 2)

  return shell(
    <>
      {/* Headline */}
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">
            FWI {latest.isToday ? 'hari ini' : shortDate(latest.date)} · pengamatan {String(fireDanger.fwi.obsHourWib).padStart(2, '0')}.00 WIB
          </p>
          <p className="font-data text-4xl font-semibold tabular-nums leading-none mt-1 text-ink dark:text-mist">{num(c.fwi, 1)}</p>
          <div className="mt-2">
            <Badge level={k.fwi} label={`${CLASS_LABEL[k.fwi]} — kesulitan kendali api`} toneMap={CLASS_TONE} dotMap={CLASS_DOT} />
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">Status</p>
          <div className="mt-1">
            <Badge level={a.level} label={levelLabel} />
          </div>
          {a.siagaLokal && (
            <p className="mt-1 text-[11px] font-semibold text-cherry-deep dark:text-cherry-soft">Siaga Kebakaran Lokal</p>
          )}
        </div>
      </div>

      {a.siagaLokal && (
        <p role="alert" className="mt-3 border border-cherry/30 bg-cherry/5 rounded-md px-3 py-2 text-[12px] text-cherry-deep dark:text-cherry-soft">
          FFMC ≥ 78 dan ada hotspot ≤ 25 km dalam 24 jam — bahan bakar permukaan mudah menyala. Pantau arah angin dan laporkan asap/api.
        </p>
      )}
      {a.drivers?.ffmcExtremeGated && (
        <p className="mt-2 text-[11px] text-ink/50 dark:text-mist/45">
          FFMC kelas ekstrem ditampilkan "tinggi" karena belum ada hotspot ≤ 10 km atau HTH ≥ 21 hari (kalibrasi lokal).
        </p>
      )}

      {/* Kode komponen */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 grid grid-cols-3 gap-3">
        <Code label="FFMC" value={num(c.ffmc, 0)} cls={k.ffmc} sub="penyalaan serasah" />
        <Code label="DC" value={num(c.dc, 0)} cls={k.dc} sub="potensi asap gambut/kayu" />
        <Code label="ISI" value={num(c.isi, 1)} cls={k.isi} sub="penjalaran api rumput" />
      </div>
      <p className="mt-2 text-[11px] text-ink/50 dark:text-mist/45">
        Cuaca siang: {num(latest.obs?.temp, 1)} °C · RH {num(latest.obs?.rh, 0)} % · angin {num(latest.obs?.wind, 0)} km/j · hujan 24 j {num(latest.obs?.rain, 1)} mm
        {fireDanger.fwi.spinUpDays ? ` · spin-up ${fireDanger.fwi.spinUpDays} hari` : ''}
      </p>

      {/* Hotspot */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">Hotspot satelit (24 jam / 48 jam)</h3>
          {sum && !hs.degraded && <Badge level={sum.level} label={sum.level === 'bahaya' ? '≤ 10 km' : sum.level === 'waspada' ? '≤ 25 km' : 'tidak ada ≤ 25 km'} />}
        </div>
        {hs?.degraded ? (
          <p className="mt-1 text-[12px] text-ink/55 dark:text-mist/50">
            Data hotspot belum aktif{hs.reason ? ` — ${hs.reason}` : ''}.
          </p>
        ) : (
          <>
            <div className="mt-2 grid grid-cols-3 gap-3">
              <Code label="≤ 10 km" value={`${num(sum?.within10km24h)} / ${num(sum?.within10km48h)}`} />
              <Code label="≤ 25 km" value={`${num(sum?.within25km24h)} / ${num(sum?.within25km48h)}`} />
              <Code label="≤ 50 km" value={`${num(sum?.within50km24h)} / ${num(sum?.within50km48h)}`} />
            </div>
            <p className="mt-2 text-[11px] text-ink/50 dark:text-mist/45">
              {sum?.nearestKm != null
                ? `Terdekat ${num(sum.nearestKm, 1)} km (${clock(sum.nearestAt)} WIB)${sum.frpMax24h != null ? ` · FRP maks ${num(sum.frpMax24h, 1)} MW` : ''}${sum.intense24h ? ` · ${sum.intense24h} intens (≥ 20 MW)` : ''}`
                : 'Tidak ada deteksi ≤ 50 km dalam 48 jam.'}
            </p>
            <p className="mt-1 text-[11px] text-ink/45 dark:text-mist/40">Hotspot = anomali panas satelit (VIIRS 375 m / MODIS 1 km), belum tentu kebakaran.</p>
          </>
        )}
      </div>

      {/* HTH + proyeksi */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 grid grid-cols-3 gap-3">
        <Code label="HTH" value={hth ? `${num(hth.days)} hari` : '—'} sub={hth?.classLabel ?? 'hari tanpa hujan'} />
        {fireDanger.fwi.forecast?.slice(0, 2).map((f) => (
          <Code key={f.date} label={`FWI ${shortDate(f.date)}`} value={num(f.codes.fwi, 1)} cls={f.classes.fwi} />
        ))}
      </div>

      {/* Anjuran */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">Anjuran</h3>
        <ul className="mt-1.5 space-y-1 text-[13px] leading-relaxed text-ink/75 dark:text-mist/70 list-disc pl-4">
          {advice.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        {a.advice.length > 2 && (
          <button type="button" onClick={() => setShowAll((v) => !v)} className="mt-1 text-[12px] font-medium text-leaf-deep dark:text-leaf-soft hover:underline min-h-[32px]">
            {showAll ? 'Sembunyikan' : `Lihat ${a.advice.length - 2} anjuran lain`}
          </button>
        )}
      </div>

      <p className="mt-3 text-[11px] text-ink/45 dark:text-mist/40 leading-relaxed">
        Kelas FDRS Indonesia (de Groot dkk. 2007 / BMKG SPBK); FWI dihitung dari ERA5-Land + ECMWF (Open-Meteo, CC BY 4.0). Rujukan resmi:{' '}
        <a className="underline" href="https://www.bmkg.go.id/cuaca/karhutla/dc" target="_blank" rel="noreferrer">BMKG Karhutla</a> ·{' '}
        <a className="underline" href="https://sipongi.menlhk.go.id/" target="_blank" rel="noreferrer">SiPongi KLHK</a>
        {fireDanger.warnings?.length > 0 && <span className="block mt-1">Catatan: {fireDanger.warnings.join('; ')}</span>}
      </p>
    </>,
  )
}
