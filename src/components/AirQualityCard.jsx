import React, { useState } from 'react'

/**
 * H-ASAP (v2 Fase 1, "rilis cepat") — kartu Kabut Asap & Kualitas Udara.
 * Sumber: GET /api/air-quality (ISPU estimasi CAMS global + proksi jarak pandang best_match).
 * Gaya mengikuti DisasterWarning/CoffeeAdvisory: satu panel, hairline rules, badge titik warna.
 * Semua angka adalah estimasi model (~40 km) — bukan ISPU resmi (tidak ada stasiun ISPU di Aceh Tengah).
 */

const TONE = {
  ekstrem: 'text-cherry-deep dark:text-cherry-soft',
  bahaya: 'text-cherry-deep dark:text-cherry-soft',
  waspada: 'text-husk-deep dark:text-husk-soft',
  rendah: 'text-leaf-deep dark:text-leaf-soft',
}
const DOT = { ekstrem: 'bg-cherry', bahaya: 'bg-cherry', waspada: 'bg-husk', rendah: 'bg-leaf' }
// Kategori ISPU resmi: Baik hijau, Sedang biru, Tidak Sehat kuning, Sangat Tidak Sehat merah, Berbahaya hitam.
const CATEGORY_TONE = {
  baik: TONE.rendah,
  sedang: 'text-rain dark:text-rain',
  tidak_sehat: TONE.waspada,
  sangat_tidak_sehat: TONE.bahaya,
  berbahaya: 'text-ink dark:text-mist',
}
const CATEGORY_DOT = { baik: 'bg-leaf', sedang: 'bg-rain', tidak_sehat: 'bg-husk', sangat_tidak_sehat: 'bg-cherry', berbahaya: 'bg-ink dark:bg-mist' }
const TREND = { naik: '↑ naik', turun: '↓ turun', stabil: '→ stabil' }
const GROUP_ORDER = ['umum', 'rentan', 'kebun', 'sekolah']
const GROUP_SHORT = { umum: 'Umum', rentan: 'Kelompok rentan', kebun: 'Pekerja kebun', sekolah: 'Sekolah & kampung' }

const hhmm = (iso) => (iso ? String(iso).slice(11, 16) : '—')
const clock = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
}
const num = (v, digits = 0) => (v == null ? '—' : Number(v).toLocaleString('id-ID', { maximumFractionDigits: digits, minimumFractionDigits: digits }))

function Badge({ level, label, toneMap = TONE, dotMap = DOT }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${toneMap[level] || TONE.rendah}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${dotMap[level] || 'bg-leaf'}`} />
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

export default function AirQualityCard({ airQuality, tr = (k) => k }) {
  const [showCleanRoom, setShowCleanRoom] = useState(false)
  if (!airQuality) return null
  const label = (k, fallback) => {
    const v = tr(k)
    return !v || v === k ? fallback : v
  }
  const a = airQuality.assessment
  const title = label('airQuality', 'Kabut Asap & Kualitas Udara')
  const subtitle = label('airQualitySub', 'ISPU estimasi model CAMS global (~40 km) — bukan ISPU resmi')

  // Fungsi biasa (bukan komponen lokal) agar subtree tidak di-remount tiap render.
  const shell = (children) => (
    <section aria-label={title} className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">{title}</h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  )

  if (!a) {
    return shell(
      <p className="pt-3 border-t border-ink/10 dark:border-mist/10 text-[13px] text-ink/60 dark:text-mist/55">
        {label('airQualityUnavailable', 'Data kualitas udara belum tersedia saat ini.')}
        {airQuality.error && <span className="block mt-1 text-[11px] text-ink/45 dark:text-mist/40">({airQuality.error})</span>}
      </p>,
    )
  }

  const levelLabel = {
    rendah: label('low', 'Rendah'),
    waspada: label('alert', 'Waspada'),
    bahaya: label('danger', 'Bahaya'),
    ekstrem: 'Ekstrem',
  }[a.level] || a.level
  const cat = a.ispu.category
  const haze = a.haze
  const hazeLevelKey = haze.level === 'sangat_tebal' ? 'bahaya' : haze.level === 'tebal' ? 'waspada' : 'rendah'

  return shell(
    <>
      {/* Headline ISPU */}
      <div className="pt-3 border-t border-ink/10 dark:border-mist/10 flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">
            ISPU {a.ispu.basis === '24h' ? 'rata-rata 24 jam' : 'sesaat'} · {a.ispu.paramLabel}
          </p>
          <p className="font-data text-4xl font-semibold tabular-nums leading-none mt-1 text-ink dark:text-mist">{a.ispu.index}</p>
          <div className="mt-2">
            <Badge level={cat.key} label={cat.label} toneMap={CATEGORY_TONE} dotMap={CATEGORY_DOT} />
          </div>
          {a.ispu.partial && (
            <p className="text-[11px] text-ink/50 dark:text-mist/45 mt-1">Data {a.ispu.hours} jam — rata-rata parsial</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-[11px] uppercase tracking-wide text-ink/50 dark:text-mist/45">Status</p>
          <div className="mt-1">
            <Badge level={a.level} label={levelLabel} />
          </div>
          {a.instant && a.instant.index !== a.ispu.index && (
            <p className="text-[11px] text-ink/50 dark:text-mist/45 mt-1 tabular-nums">sesaat {a.instant.index} ({a.instant.category.label})</p>
          )}
        </div>
      </div>

      {/* Kabut asap (proksi jarak pandang) */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">{label('haze', 'Kabut asap')} · jarak pandang siang ({haze.windowLabel})</h3>
          <Badge level={hazeLevelKey} label={haze.level === 'tidak_diketahui' ? 'Tidak diketahui' : haze.level === 'tidak_ada' ? 'Tidak terdeteksi' : haze.label} />
        </div>
        <p className="mt-1 text-[13px] text-ink/75 dark:text-mist/70 tabular-nums">
          {haze.visibilityKm != null ? (
            <>
              Minimum <span className="font-data font-medium">{num(haze.visibilityKm, 1)} km</span> pukul {hhmm(haze.time)}
              {haze.supported && haze.level !== 'tidak_ada' && <span className="text-ink/50 dark:text-mist/45"> · didukung {haze.supportReason}</span>}
            </>
          ) : (
            'Jarak pandang tidak tersedia dari model.'
          )}
        </p>
        {haze.lowVisibilityNonSmoke && (
          <p className="mt-1 text-[11px] text-ink/50 dark:text-mist/45">
            Jarak pandang rendah tetapi PM2,5/AOD rendah — kemungkinan kabut atau awan rendah, bukan asap.
          </p>
        )}
      </div>

      {/* Pengukuran model */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 grid grid-cols-3 gap-3">
        <Metric label="PM2,5" value={num(a.measurements.pm25)} unit="µg/m³" sub={a.who.exceeded ? `> WHO ${a.who.pm25Daily}` : `WHO 24 jam ${a.who.pm25Daily}`} />
        <Metric label="PM10" value={num(a.measurements.pm10)} unit="µg/m³" />
        <Metric label="AOD" value={num(a.measurements.aod, 2)} sub={a.measurements.aod != null && a.measurements.aod >= 1 ? 'asap tebal di atmosfer' : null} />
      </div>

      {/* Prospek */}
      {a.outlook && (
        <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 flex items-center justify-between gap-2 text-[13px]">
          <span className="text-ink/70 dark:text-mist/60">{label('outlook24h', 'Prospek 24 jam')}</span>
          <span className="font-data tabular-nums text-ink dark:text-mist">
            puncak {a.outlook.peakIndex ?? '—'}
            {a.outlook.peakCategory && <span className="text-ink/50 dark:text-mist/45"> ({a.outlook.peakCategory.label})</span>}
            {a.outlook.peakTime && <span className="text-ink/50 dark:text-mist/45"> {hhmm(a.outlook.peakTime)}</span>}
            <span className="ml-2">{TREND[a.outlook.trend] || a.outlook.trend}</span>
          </span>
        </div>
      )}

      {/* Anjuran */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">{label('advice', 'Anjuran')} — {cat.label}</h3>
        {a.advice.policy && (
          <p className={`mt-2 text-[13px] leading-relaxed font-medium ${TONE[a.level] || ''}`}>{a.advice.policy}</p>
        )}
        <dl className="mt-2 space-y-1.5">
          {GROUP_ORDER.filter((g) => a.advice.groups[g]).map((g) => (
            <div key={g} className="text-[13px] leading-relaxed">
              <dt className="inline font-medium text-ink/70 dark:text-mist/60">{GROUP_SHORT[g]}: </dt>
              <dd className="inline text-ink/75 dark:text-mist/70">{a.advice.groups[g]}</dd>
            </div>
          ))}
        </dl>
        {a.advice.whoNote && <p className="mt-2 text-[11px] text-ink/50 dark:text-mist/45">{a.advice.whoNote}</p>}
        {(a.coffee.dryingHold || a.coffee.fieldWorkHold) && (
          <p className="mt-3 text-[11px] text-ink/55 dark:text-mist/45 leading-relaxed">
            <strong className="font-medium text-ink/70 dark:text-mist/60">Kopi:</strong>{' '}
            {a.coffee.dryingHold && 'tunda penjemuran terbuka (asap). '}
            {a.coffee.fieldWorkHold && 'tunda kerja kebun yang tidak mendesak.'}
          </p>
        )}
        {a.advice.crossCutting.length > 0 && (
          <ul className="mt-2 text-[11px] text-ink/55 dark:text-mist/45 leading-relaxed list-disc pl-4 space-y-0.5">
            {a.advice.crossCutting.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        )}
        {a.advice.cleanRoom && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => setShowCleanRoom((v) => !v)}
              aria-expanded={showCleanRoom}
              className="text-[11px] font-medium underline underline-offset-2 text-ink/70 dark:text-mist/60"
            >
              {showCleanRoom ? 'Sembunyikan' : 'Tampilkan'} daftar periksa {a.advice.cleanRoomTitle?.toLowerCase() || 'ruang bersih'}
            </button>
            {showCleanRoom && (
              <ol className="mt-1 text-[11px] text-ink/55 dark:text-mist/45 leading-relaxed list-decimal pl-4 space-y-0.5">
                {a.advice.cleanRoomItems.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            )}
          </div>
        )}
      </div>

      {/* Sumber */}
      <p className="mt-4 pt-3 border-t border-ink/10 dark:border-mist/10 text-[11px] text-ink/45 dark:text-mist/40 leading-relaxed">
        Estimasi {a.flags.model} via Open-Meteo Air Quality · jam data {hhmm(a.time)} WIB · diambil {clock(airQuality.retrievedAt)}.
        Bukan pengganti pengumuman resmi:{' '}
        <a href="https://ispu.menlhk.go.id/" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">ISPUNet KLHK</a>
        {' · '}
        <a href="https://www.bmkg.go.id/kualitas-udara/informasi-partikulat-pm25.bmkg" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">PM2,5 BMKG</a>.
      </p>
    </>,
  )
}
