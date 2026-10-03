import React from 'react'

// Peringatan dini bencana. `disaster` berisi hasil domain/disaster.js (M3):
// landslide, dasIndex, wind, masing-masing { level, color, score?, desc? }
// plus `confidence` (P(hujan>X) dari ensemble) bila tersedia.
function tone(level) {
  const l = String(level || '').toLowerCase()
  if (l.includes('bahaya') || l.includes('tinggi')) return 'text-rose-600 dark:text-rose-400'
  if (l.includes('waspada') || l.includes('sedang')) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
}

function Card({ label, item, children }) {
  const level = item?.level ?? item?.risk ?? 'Rendah'
  const score = item?.score
  return (
    <div className="bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-3">
      <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 block mb-1">{label}</span>
      <div className="flex items-baseline space-x-2">
        <span className={`text-base font-bold ${tone(level)}`}>{level}</span>
        {typeof score === 'number' && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">{score}/100</span>
        )}
      </div>
      {children}
    </div>
  )
}

export default function DisasterWarning({ disaster, dailyRainSum, location }) {
  if (!disaster) return null
  const confidence = disaster.confidence

  return (
    <div className="bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <span className="text-xl" role="img" aria-label="Peringatan">⚠️</span>
        <div>
          <h2 className="text-base font-bold">Sistem Peringatan Dini Bencana Hidrometeorologi</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Mitigasi risiko longsor lereng kopi &amp; indeks hujan DAS Peusangan
          </p>
        </div>
      </div>

      {confidence && (
        <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs bg-slate-100 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-2">
          <span className="font-semibold text-slate-600 dark:text-slate-300">Keyakinan ensemble (ECMWF 50 member):</span>
          {confidence.map((c) => (
            <span key={c.label} className="font-mono text-slate-700 dark:text-slate-200">
              {c.label}: <span className="font-bold">{c.prob}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card label="Potensi Tanah Longsor" item={disaster.landslide}>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-2">
            Akumulasi hujan 24 jam:{' '}
            <span className="font-mono text-slate-700 dark:text-slate-200">{dailyRainSum} mm</span>
            {disaster.landslide?.detail ? ` • ${disaster.landslide.detail}` : ''}
          </span>
        </Card>

        <Card label="Indeks Hujan DAS Peusangan" item={disaster.das}>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-2">
            {disaster.das?.detail || 'Rata-rata berbobot lokasi hulu (Bintang, Lut Tawar, Kebayakan, Silih Nara)'}
          </span>
        </Card>

        <Card label="Angin (wind_gusts_10m)" item={disaster.wind}>
          <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-2">
            Waspada pohon pelindung kopi &amp; tebing jalan
          </span>
        </Card>
      </div>

      <div className="mt-4 p-3 bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-amber-600 dark:text-amber-400">Protokol Mitigasi BPBD:</span> Jauhi lereng
          terjal jika hujan lebat berlangsung &gt;2 jam berturut-turut.
        </div>
        <div className="text-slate-500 dark:text-slate-400 font-mono text-[11px]">
          Posko BPBD Aceh Tengah: <span className="text-slate-700 dark:text-slate-200">112 / (0643) 21113</span>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-slate-400 text-center">
        Peringatan bersifat prakiraan probabilistik — verifikasi dengan kondisi lapangan.
      </p>
    </div>
  )
}
