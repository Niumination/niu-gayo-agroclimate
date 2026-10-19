import {  useRef  } from 'react'
import { CloudSun, CloudRain, AlertTriangle, MapPin } from 'lucide-react'

/**
 * Bottom tab bar mobile — 4 tab state (bukan anchor).
 * P2: role="tablist" + id/aria-controls, roving tabindex, navigasi panah kiri/kanan
 * (Home/End), target sentuh 56 px, aman safe-area, umpan balik tekan halus.
 */
export const MOBILE_TABS = [
  { id: 'now', labelKey: 'tabNow', Icon: CloudSun },
  { id: 'forecast', labelKey: 'tabForecast', Icon: CloudRain },
  { id: 'risk', labelKey: 'tabRisk', Icon: AlertTriangle },
  { id: 'locations', labelKey: 'tabLocations', Icon: MapPin },
]

export default function BottomNav({ active, onChange, tr }) {
  const refs = useRef({})
  const ids = MOBILE_TABS.map((t) => t.id)

  const onKeyDown = (e) => {
    const i = ids.indexOf(active)
    let next = null
    if (e.key === 'ArrowRight') next = ids[(i + 1) % ids.length]
    else if (e.key === 'ArrowLeft') next = ids[(i - 1 + ids.length) % ids.length]
    else if (e.key === 'Home') next = ids[0]
    else if (e.key === 'End') next = ids[ids.length - 1]
    if (!next) return
    e.preventDefault()
    onChange(next)
    refs.current[next]?.focus()
  }

  return (
    <nav
      aria-label={tr('tabsLabel')}
      data-niu-nav="mobile"
      className="niu-bottom-nav fixed bottom-0 inset-x-0 z-40 bg-surface/95 dark:bg-soil/95 backdrop-blur-md border-t border-ink/10 dark:border-mist/10 pb-[env(safe-area-inset-bottom)]"
    >
      <div role="tablist" aria-label={tr('tabsLabel')} className="grid grid-cols-4">
        {MOBILE_TABS.map(({ id, labelKey, Icon }) => {
          const isActive = active === id
          return (
            <button
              key={id}
              ref={(el) => { refs.current[id] = el }}
              id={`tab-${id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${id}`}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(id)}
              onKeyDown={onKeyDown}
              className={`min-h-[56px] flex flex-col items-center justify-center gap-0.5 text-body font-medium transition duration-100 ease-out active:scale-[.97] ${
                isActive
                  ? 'text-leaf-deep dark:text-leaf-soft'
                  : 'text-ink-muted dark:text-mist-muted'
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
