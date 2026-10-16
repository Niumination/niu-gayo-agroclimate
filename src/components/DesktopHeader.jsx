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
  tr,
}) {
  const ageTone = age?.stale
    ? 'text-husk-deep dark:text-husk-soft border-husk/40 bg-husk/10'
    : 'text-leaf-deep dark:text-leaf-soft border-leaf/40 bg-leaf/10'

  return (
    <header className="sticky top-0 z-40 bg-surface/90 dark:bg-soil/90 backdrop-blur-md border-b border-ink/10 dark:border-mist/10 pt-[env(safe-area-inset-top)]">
      <div className="max-w-shell mx-auto px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-semibold tracking-tight text-ink dark:text-mist">Niu Gayo Agro-Climate</span>
          <span className="font-data text-caption text-ink-muted dark:text-mist-subtle tabular-nums">ecmwf_ifs025</span>
          {age && (
            <span className={`inline-flex items-center gap-1.5 text-caption font-medium px-2 py-0.5 rounded-full border ${ageTone}`}>
              <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${age.stale ? 'bg-husk' : 'bg-leaf'}`} />
              {tr('dataAge')} {age.label}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="font-data text-caption text-ink-muted dark:text-mist-subtle tabular-nums">
              {tr('updated')} {lastUpdated}
            </span>
          )}
          <select
            aria-label={tr('language')}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="h-11 bg-transparent text-body text-ink-body dark:text-mist-body rounded-lg px-2"
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
            className="h-11 w-11 grid place-items-center rounded-lg text-lg text-ink-body dark:text-mist-body hover:bg-ink/5 dark:hover:bg-mist/5 transition duration-100 ease-out active:scale-[.97]"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? tr('refreshing') : tr('refresh')}
            className="min-h-11 px-3 inline-flex items-center gap-2 rounded-lg text-body font-medium text-ink-body dark:text-mist-body hover:bg-ink/5 dark:hover:bg-mist/5 disabled:opacity-40 transition duration-100 ease-out active:scale-[.97]"
          >
            <RefreshCw size={15} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            {loading ? tr('refreshing') : tr('refresh')}
          </button>
        </div>
      </div>
    </header>
  )
}
