import React from 'react'
import { RefreshCw } from 'lucide-react'
import { LANGS } from '../i18n/messages'

/**
 * Header desktop: identitas aplikasi + kontrol (bahasa, tema, refresh)
 * dan badge umur data. Rail sentra ada di body, bukan di sini.
 */
export default function DesktopHeader({
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
    ? 'text-husk-deep dark:text-husk-soft border-husk/40 bg-husk/10'
    : 'text-leaf-deep dark:text-leaf-soft border-leaf/40 bg-leaf/10'

  return (
    <header className="sticky top-0 z-40 bg-surface/90 dark:bg-soil/90 backdrop-blur-md border-b border-ink/10 dark:border-mist/10">
      <div className="max-w-shell mx-auto px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-semibold tracking-tight text-ink dark:text-mist">Niu Gayo Agro-Climate</span>
          <span className="font-data text-[11px] text-ink/45 dark:text-mist/40">ecmwf_ifs025</span>
          {age && (
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border ${ageTone}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${age.stale ? 'bg-husk' : 'bg-leaf'}`} />
              {tr('dataAge')} {age.label}
            </span>
          )}
          {offline && (
            <span role="status" className="text-[11px] font-medium text-husk-deep dark:text-husk-soft">
              {tr('offlineBanner')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="font-data text-[11px] text-ink/45 dark:text-mist/40">
              {tr('updated')} {lastUpdated}
            </span>
          )}
          <select
            aria-label={tr('language')}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="h-9 bg-transparent text-[13px] text-ink/70 dark:text-mist/70 rounded-lg px-1 focus-visible:outline-none"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onToggleTheme}
            onDoubleClick={isAuto ? undefined : onResetTheme}
            aria-label={theme === 'dark' ? tr('themeLight') : tr('themeDark')}
            className="h-9 w-9 grid place-items-center rounded-lg text-ink/70 dark:text-mist/70 hover:bg-ink/5 dark:hover:bg-mist/5"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? tr('refreshing') : tr('refresh')}
            className="h-9 px-3 inline-flex items-center gap-2 rounded-lg text-[13px] font-medium text-ink/80 dark:text-mist/80 hover:bg-ink/5 dark:hover:bg-mist/5 disabled:opacity-40"
          >
            <RefreshCw size={15} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            {loading ? tr('refreshing') : tr('refresh')}
          </button>
        </div>
      </div>
    </header>
  )
}
