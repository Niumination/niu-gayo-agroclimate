import { RefreshCw } from 'lucide-react'
import { LANGS } from '../i18n/messages'

/**
 * Header ringkas mobile: nama sentra + elevasi + badge umur data,
 * tombol tema, bahasa, dan refresh (target sentuh >= 44px).
 */
export default function AppBar({
  selectedLocation,
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
    ? 'text-husk-deep border-husk/40 bg-husk/10'
    : 'text-leaf-deep border-leaf/40 bg-leaf/10'

  return (
    <header className="sticky top-0 z-40 bg-surface/90 dark:bg-soil/90 backdrop-blur-md border-b border-ink/10 dark:border-mist/10 pt-[env(safe-area-inset-top)]">
      <div className="px-4 pt-3 pb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-base font-semibold tracking-tight text-ink dark:text-mist break-words leading-tight">
            {selectedLocation?.name}
          </h1>
          <p className="text-body text-ink-muted dark:text-mist-muted leading-tight">
            <span className="font-data tabular-nums">{selectedLocation?.elevation}</span> {tr('mdpl')}
          </p>
        </div>
        {age && (
          <span
            className={`shrink-0 mt-0.5 inline-flex items-center gap-1.5 text-caption font-medium px-2.5 py-1 rounded-full border ${ageTone}`}
          >
            <span aria-hidden="true" className={`w-1.5 h-1.5 rounded-full ${age.stale ? 'bg-husk' : 'bg-leaf'}`} />
            {tr('dataAge')} {age.label}
          </span>
        )}
      </div>
      <div className="px-2 pb-2 flex items-center justify-between gap-1">
        <span className="pl-2 text-caption font-data text-ink-subtle dark:text-mist-subtle break-words tabular-nums">
          Niu Gayo Agro-Climate · ecmwf_ifs025
        </span>
        <div className="flex items-center">
          <select
            aria-label={tr('language')}
            value={lang}
            onChange={(e) => onLangChange(e.target.value)}
            className="h-11 max-w-[9.5rem] bg-transparent text-body text-ink-body dark:text-mist-body rounded-lg px-2"
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
            className="h-11 w-11 grid place-items-center rounded-lg text-lg text-ink-body dark:text-mist-body transition duration-100 ease-out active:scale-[.97]"
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀️' : '🌙'}</span>
          </button>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            aria-label={loading ? tr('refreshing') : tr('refresh')}
            className="h-11 w-11 grid place-items-center rounded-lg text-ink-body dark:text-mist-body disabled:opacity-40 transition duration-100 ease-out active:scale-[.97]"
          >
            <RefreshCw size={20} aria-hidden="true" className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
    </header>
  )
}
