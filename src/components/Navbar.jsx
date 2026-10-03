import React from 'react'
import { LANGS } from '../i18n/messages'

export default function Navbar({
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
  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-2">
        <div className="flex items-center space-x-3 min-w-0">
          <span className="text-2xl" role="img" aria-label="Coffee">☕</span>
          <div className="min-w-0">
            <div className="flex items-center space-x-2 flex-wrap">
              <h1 className="text-lg font-bold tracking-tight truncate">{tr('appName')}</h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 font-medium">
                ecmwf_ifs025
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block truncate">{tr('appTagline')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {lastUpdated && age && (
            <span className="text-xs text-slate-500 dark:text-slate-400 hidden md:inline-block">
              {tr('updated')}: <span className="font-mono text-slate-700 dark:text-slate-200">{lastUpdated}</span>{' '}
              <span
                className={`ml-1 px-1.5 py-0.5 rounded border text-[10px] ${
                  age.stale
                    ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/40'
                    : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/40'
                }`}
              >
                {age.label} {age.stale ? '⚠' : '✓'}
              </span>
            </span>
          )}

          <select
            aria-label={tr('language')}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="bg-slate-100 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {LANGS.map((l) => (
              <option key={l.id} value={l.id}>{l.label}</option>
            ))}
          </select>

          <button
            onClick={onToggleTheme}
            onDoubleClick={isAuto ? undefined : onResetTheme}
            title={isAuto ? undefined : `${tr('themeLight')}/${tr('themeDark')} (klik-ganda = auto)`}
            aria-label={theme === 'dark' ? tr('themeLight') : tr('themeDark')}
            className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm border border-slate-300 dark:border-slate-700 transition"
          >
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>

          <button
            onClick={onRefresh}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-xs font-medium border border-slate-300 dark:border-slate-700 transition flex items-center space-x-1 disabled:opacity-50"
          >
            <span>{loading ? tr('refreshing') : tr('refresh')}</span>
          </button>
        </div>
      </div>
    </header>
  )
}
