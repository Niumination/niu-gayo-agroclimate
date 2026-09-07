import React from 'react'

export default function DisasterWarning({ disaster, dailyRainSum, location }) {
  if (!disaster) return null

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
        <span className="text-xl">⚠️</span>
        <div>
          <h2 className="text-base font-bold text-slate-100">Sistem Peringatan Dini Bencana Hidrometeorologi</h2>
          <p className="text-xs text-slate-400">Mitigasi risiko longsor lereng kopi & luapan Danau Lut Tawar / Peusangan</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Potensi Longsor */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Potensi Tanah Longsor</span>
          <div className="flex items-center space-x-2">
            <span className={`text-base font-bold ${disaster.landslideRisk.includes('Tinggi') ? 'text-rose-400' : disaster.landslideRisk.includes('Waspada') ? 'text-amber-400' : 'text-emerald-400'}`}>
              {disaster.landslideRisk}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Akumulasi hujan harian: <span className="font-mono text-slate-200">{dailyRainSum} mm</span>
          </span>
        </div>

        {/* Luapan Danau / DAS */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">DAS Peusangan & Danau</span>
          <div className="flex items-center space-x-2">
            <span className={`text-base font-bold ${disaster.lakeRisk.includes('Waspada') ? 'text-amber-400' : 'text-emerald-400'}`}>
              {disaster.lakeRisk}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Kawasan tangkapan air hulu Aceh Tengah
          </span>
        </div>

        {/* Bahaya Angin */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-3">
          <span className="text-xs font-semibold uppercase text-slate-400 block mb-1">Kecepatan Angin & Badai</span>
          <div className="flex items-center space-x-2">
            <span className={`text-base font-bold ${disaster.windRisk.includes('Bahaya') ? 'text-rose-400' : disaster.windRisk.includes('Waspada') ? 'text-amber-400' : 'text-emerald-400'}`}>
              {disaster.windRisk}
            </span>
          </div>
          <span className="text-[11px] text-slate-400 block mt-2">
            Waspada pohon pelindung kopi & tebing jalan
          </span>
        </div>
      </div>

      <div className="mt-4 p-3 bg-slate-950/80 border border-slate-800 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="text-slate-300">
          <span className="font-semibold text-amber-400">Protokol Mitigasi BPBD:</span> Jauhi lereng terjal jika hujan lebat berlangsung &gt;2 jam berturut-turut.
        </div>
        <div className="text-slate-400 font-mono text-[11px]">
          Posko BPBD Aceh Tengah: <span className="text-slate-200">112 / (0643) 21113</span>
        </div>
      </div>
    </div>
  )
}
