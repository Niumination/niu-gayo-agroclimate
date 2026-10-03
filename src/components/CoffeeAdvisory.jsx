import React from 'react'

const defaultTr = (k, f) => f ?? k

export default function CoffeeAdvisory({ coffee, tr = (k, f) => defaultTr(k, f) }) {
  if (!coffee) return null

  return (
    <div className="bg-white/80 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-lg">
      <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-3 mb-4">
        <span className="text-xl" role="img" aria-label="Kopi">☕</span>
        <div>
          <h2 className="text-base font-bold">Panduan Agro-Klimat Kopi Arabika Gayo</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Rekomendasi teknis budidaya &amp; penanganan pascapanen berbasis mikroklimat
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Status Karat Daun */}
        <div className="bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Risiko Karat Daun (Hemileia vastatrix)
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 ${coffee.rustColor || ''}`}>
              {coffee.rustRisk}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">{coffee.rustDesc}</p>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-800/50">
            💡 <strong className="text-slate-700 dark:text-slate-300">Tindakan Petani:</strong> Bila risiko tinggi, pangkas tunas air (wiwil) untuk memperbaiki aerasi kebun dan sirkulasi cahaya kanopi.
          </div>
        </div>

        {/* Status Penjemuran */}
        <div className="bg-slate-100/70 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800/80 rounded-lg p-4">
          <div className="flex items-center justify-between mb-1 gap-2">
            <span className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400">
              Jendela Penjemuran (Pascapanen)
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-900 ${coffee.dryingColor || ''}`}>
              {coffee.dryingStatus}
            </span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">{coffee.dryingDesc}</p>
          <div className="mt-3 text-[11px] text-slate-500 dark:text-slate-400 bg-slate-200/50 dark:bg-slate-900/50 p-2 rounded border border-slate-200 dark:border-slate-800/50">
            💡 <strong className="text-slate-700 dark:text-slate-300">Standar Mutu:</strong> Target kadar air green bean Specialty Gayo: 11% - 12%. Hindari terkena air hujan secara langsung.
          </div>
        </div>
      </div>
    </div>
  )
}
