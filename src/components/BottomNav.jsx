import React from 'react'
import { CloudSun, CloudRain, AlertTriangle, MapPin } from 'lucide-react'

/**
 * Bottom tab bar mobile — 4 tab state (bukan anchor), role="tablist",
 * target sentuh >= 44px, aman safe-area.
 */
export const MOBILE_TABS = [
  { id: 'now', labelKey: 'tabNow', Icon: CloudSun },
  { id: 'forecast', labelKey: 'tabForecast', Icon: CloudRain },
  { id: 'risk', labelKey: 'tabRisk', Icon: AlertTriangle },
  { id: 'locations', labelKey: 'tabLocations', Icon: MapPin },
]

export default function BottomNav({ active, onChange, tr }) {
  return (
    <nav
      role="tablist"
      aria-label="Navigasi utama"
      className="fixed bottom-0 inset-x-0 z-40 bg-surface/95 dark:bg-soil/95 backdrop-blur-md border-t border-ink/10 dark:border-mist/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="grid grid-cols-4">
        {MOBILE_TABS.map(({ id, labelKey, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(id)}
              className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-[13px] font-medium transition-colors ${
                isActive
                  ? 'text-leaf-deep dark:text-leaf-soft'
                  : 'text-ink/55 dark:text-mist/50'
              }`}
            >
              <Icon size={20} aria-hidden="true" />
              {tr(labelKey)}
              <span
                aria-hidden="true"
                className={`h-0.5 w-6 rounded-full ${isActive ? 'bg-leaf' : 'bg-transparent'}`}
              />
            </button>
          )
        })}
      </div>
    </nav>
  )
}
