import React from 'react'

export default function Navbar({ lastUpdated, onRefresh, loading }) {
  return (
    <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="text-2xl" role="img" aria-label="Coffee">☕</span>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold text-slate-100 tracking-tight">Niu Gayo Agro-Climate</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-medium">WeatherNext Pipeline</span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">Sistem Presisi Cuaca Pertanian Kopi & Mitigasi Bencana Aceh Tengah</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-xs text-slate-400 hidden md:inline-block">
              Diperbarui: <span className="text-slate-200 font-mono">{lastUpdated} WIB</span>
            </span>
          )}
          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition flex items-center space-x-1 disabled:opacity-50"
          >
            <span>{loading ? 'Memuat...' : 'Muat Ulang'}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
