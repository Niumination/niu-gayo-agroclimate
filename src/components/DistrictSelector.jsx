import React from 'react'
import { LOCATIONS } from '../data/locations'

/**
 * Pemilih sentra ringkas (select). Mobile: satu kontrol 44px penuh lebar.
 * Desktop: baris label + koordinat mono (dipakai sebagai quick-jump).
 */
export default function DistrictSelector({ selectedLocation, onSelectLocation, tr, variant = 'mobile' }) {
  const sorted = [...LOCATIONS].sort((a, b) => b.elevation - a.elevation)

  return (
    <div className={variant === 'desktop' ? 'flex items-end gap-4 flex-wrap' : ''}>
      <div className={variant === 'desktop' ? 'min-w-[260px]' : ''}>
        <label htmlFor="district-select" className="block text-[13px] font-medium text-ink/60 dark:text-mist/55 mb-1.5">
          {tr('pickRegion')}
        </label>
        <select
          id="district-select"
          value={selectedLocation?.id}
          onChange={(e) => {
            const loc = LOCATIONS.find((l) => l.id === e.target.value)
            if (loc) onSelectLocation(loc)
          }}
          className="w-full min-h-[44px] bg-surface dark:bg-soil border border-ink/15 dark:border-mist/15 rounded-lg px-3 text-[15px] font-medium text-ink dark:text-mist"
        >
          {sorted.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} · {loc.elevation} {tr('mdpl')}
            </option>
          ))}
        </select>
      </div>
      {selectedLocation && (
        <p className={`text-[13px] text-ink/55 dark:text-mist/50 ${variant === 'desktop' ? 'pb-3' : 'mt-2'}`}>
          {tr('regionChar')}: <span className="text-ink/80 dark:text-mist/80">{selectedLocation.type}</span>
          <span className="ml-2 font-data text-[11px] text-ink/40 dark:text-mist/40">
            {selectedLocation.lat.toFixed(4)}°N, {selectedLocation.lon.toFixed(4)}°E
          </span>
        </p>
      )}
    </div>
  )
}
