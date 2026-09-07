import React from 'react'

export default function CoffeeAdvisory({ coffee }) {
  if (!coffee) return null

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 mb-4">
        <span className="text-xl">☕</span>
        <div>
          <h2 className="text-base font-bold text-slate-100">Panduan Agro-Klimat Kopi Arabika Gayo</h2>
          <p className="text-xs text-slate-400">Rekomendasi teknis budidaya & penanganan pascapanen berbasis mikroklimat</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Karat Daun */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase text-slate-400">Risiko Karat Daun (Hemileia vastatrix)</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-slate-900 ${coffee.rustColor}`}>
              {coffee.rustRisk}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{coffee.rustDesc}</p>
          <div className="mt-3 text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800/50">
            💡 <strong className="text-slate-300">Tindakan Petani:</strong> Bila risiko tinggi, pangkas tunas air (wiwil) untuk memperbaiki aerasi kebun dan sirkulasi cahaya kanopi.
          </div>
        </div>

        {/* Status Penjemuran */}
        <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-semibold uppercase text-slate-400">Jendela Penjemuran (Pascapanen)</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-slate-900 ${coffee.dryingColor}`}>
              {coffee.dryingStatus}
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">{coffee.dryingDesc}</p>
          <div className="mt-3 text-[11px] text-slate-400 bg-slate-900/50 p-2 rounded border border-slate-800/50">
            💡 <strong className="text-slate-300">Standar Mutu:</strong> Target kadar air green bean Specialty Gayo: 11% - 12%. Hindari terkena air hujan secara langsung.
          </div>
        </div>
      </div>
    </div>
  )
}
