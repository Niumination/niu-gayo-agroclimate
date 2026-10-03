import React from 'react'
import { LOCATIONS } from '../data/locations'

export default function DistrictSelector({ selectedLocation, onSelectLocation, tr }) {
  return (
    <div className="bg-white/80 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-lg mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <label htmlFor="district-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
            {tr('pickRegion')}
          </label>
          <div className="flex items-center space-x-2">
            <select
              id="district-select"
              value={selectedLocation.id}
              onChange={(e) => {
                const loc = LOCATIONS.find(l => l.id === e.target.value)
                if (loc) onSelectLocation(loc)
              }}
              className="bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none min-w-[240px]"
            >
              {LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name} (~{loc.elevation} {tr('mdpl')})
                </option>
              ))}
            </select>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-mono hidden sm:inline-block">
              [{selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E]
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4 text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-950/60 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-800/80">
          <div>
            <span className="text-slate-500 dark:text-slate-500 block">{tr('regionChar')}:</span>
            <span className="font-semibold text-coffee-600 dark:text-coffee-300">{selectedLocation.type}</span>
          </div>
          <div className="border-l border-slate-200 dark:border-slate-800 pl-4">
            <span className="text-slate-500 block">{tr('elevation')}:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedLocation.elevation} {tr('mdpl')}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
