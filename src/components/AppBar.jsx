import React from 'react'
import { RefreshCw } from 'lucide-react'
import { LANGS } from '../i18n/messages'

/**
 * Header ringkas mobile: nama sentra + elevasi + badge umur data,
 * tombol tema, bahasa, dan refresh (target sentuh >= 44px).
 */
export default function AppBar({
  selectedLocation,
  lastUpdated,
  onRefresh,
  loading,
  lang,
  onLangChange,
  theme,
  isAuto,
  onToggleTheme,
  onResetTheme,
  age,
  offline,
  tr,
}) {
  const ageTone = age?.stale
    ? 'text-husk-deep border-husk/40 bg-husk/10'
    : 'text-leaf-deep border-leaf/40 bg-leaf/10'

  return (
    <header className="sticky top-0 z-40 bg-surface/90 dark:bg-soil/90 backdrop-blur-md border-b border-ink/10 dark:border-mist/10">
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-ink dark:text-mist truncate leading-tight">
            {selectedLocation?.name}
          </h1>
          <p className="text-[13px] text-ink/55 dark:text-mist/50 leading-tight">
            <span className="font-data">{selectedLocation?.elevation}</span> {tr('mdpl')}
          </p>
        </div>
        {age && (
          <span
            className={`shrink-0 mt-0.5 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-full border ${ageTone}`}
          >
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${age.stale ? 'bg-husk' : 'bg-leaf'}`} />
            {tr('dataAge')} {age.label}
          </span>
        )}
      </div>
      <div className="px-2 pb-2 flex items-center justify-between gap-1">
        <span className="pl-2 text-[11px] font-data text-ink/40 dark:text-mist/40 truncate">
          Niu Gayo Agro-Climate · ecmwf_ifs025
        </span>
        <div className="flex items-center">
          <select
            aria-label={tr('language')}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="h-11 max-w-[9.5rem] bg-transparent text-[13px] text-ink/70 dark:text-mist/70 rounded-lg px-1 focus-visible:outline-none"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.id === 'id' ? 'ID' : 'Gayo'}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onToggleTheme}
            onDoubleClick={isAuto ? undefined : onResetTheme}
            aria-label={theme === 'dark' ? tr('themeLight') : tr('themeDark')}
            className="h-11 w-11 grid place-items-center rounded-lg text-lg text-ink/70 dark:text-mist/70"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? tr('refreshing') : tr('refresh')}
            className="h-11 w-11 grid place-items-center rounded-lg text-ink/70 dark:text-mist/70 disabled:opacity-40"
          >
            <RefreshCw size={20} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {offline && (
        <p role="status" className="px-4 pb-2 text-[13px] font-medium text-husk-deep dark:text-husk-soft">
          {tr('offlineBanner')}
        </p>
      )}
    </header>
  )
}
