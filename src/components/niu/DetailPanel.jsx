import { useRef, useState } from 'react'
import LevelBadge from './LevelBadge.jsx'

/**
 * P7.3 — panel rincian dengan tab Ringkas · Angka · Saran.
 *
 * Perilaku yang dijaga (sama dengan prototipe v6 yang disetujui):
 * - Tab memakai pola ARIA `tablist`/`tab`/`tabpanel`: hanya tab aktif yang
 *   `tabIndex=0`, panah kiri/kanan memindahkan fokus, Home/End ke ujung.
 * - Panel bisa dipakai inline (mobile, `modal=false` → `role="region"`) atau
 *   melayang di desktop (`modal=true` → `role="dialog" aria-modal="true"`).
 * - Tombol tutup selalu ≥ 44 px dan punya label teks yang jelas.
 * - Isi panel tidak pernah di-`truncate`; tabel lebar digulir di dalam wadahnya
 *   sendiri (`.detail-scroll`) agar halaman tidak melebar.
 */
export default function DetailPanel({
  id = 'detail',
  title,
  subtitle,
  level,
  levelLabel,
  tabs = [],
  tab,
  onTabChange,
  onClose,
  closeLabel = 'Tutup rincian',
  modal = false,
  bare = false,
  panels,
  aside,
  children,
}) {
  const [internal, setInternal] = useState(tabs[0]?.id)
  const active = (tabs.some((t) => t.id === tab) ? tab : internal) ?? tabs[0]?.id
  const refs = useRef({})
  const titleId = `${id}-title`

  const pick = (next) => {
    if (tab == null) setInternal(next)
    onTabChange?.(next)
  }

  const onKeyDown = (e) => {
    if (!tabs.length) return
    const i = tabs.findIndex((t) => t.id === active)
    const go = (n) => {
      const t = tabs[(n + tabs.length) % tabs.length]
      pick(t.id)
      refs.current[t.id]?.focus()
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      go(i + 1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      go(i - 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      go(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      go(tabs.length - 1)
    }
  }

  return (
    <div
      id={id}
      role={bare ? undefined : modal ? 'dialog' : 'region'}
      aria-modal={modal ? 'true' : undefined}
      aria-labelledby={bare ? undefined : titleId}
      aria-label={bare ? undefined : title}
      className={
        bare
          ? ''
          : 'rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu'
      }
    >
      <div className={bare ? 'sr-only' : 'flex items-start justify-between gap-3'}>
        <div className="min-w-0">
          <h2
            id={titleId}
            className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-caption leading-snug break-words text-tanah-tinta-redup dark:text-langit-tinta-redup">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {level && <LevelBadge level={level} label={levelLabel} size="sm" />}
          {aside}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label={closeLabel}
              className="grid h-11 w-11 place-items-center rounded-tanah-kendali text-tanah-tinta-redup transition-colors duration-100 ease-out hover:bg-tanah-terbenam hover:text-tanah-tinta dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam dark:hover:text-langit-tinta"
            >
              <svg
                viewBox="0 0 16 16"
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                aria-hidden="true"
                focusable="false"
              >
                <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {tabs.length > 0 && (
        <>
          <div role="tablist" aria-label="Bagian rincian" className="mt-3 flex gap-1 border-b border-tanah-garis dark:border-langit-garis">
            {tabs.map((t) => {
              const selected = t.id === active
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    refs.current[t.id] = el
                  }}
                  type="button"
                  role="tab"
                  id={`${id}-tab-${t.id}`}
                  aria-selected={selected}
                  aria-controls={`${id}-panel-${t.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => pick(t.id)}
                  onKeyDown={onKeyDown}
                  className={`-mb-px min-h-11 flex-1 border-b-2 px-2 text-body-sm font-semibold transition-colors duration-100 ease-out ${
                    selected
                      ? 'border-tanah-aksen text-tanah-tinta dark:border-langit-aksen dark:text-langit-tinta'
                      : 'border-transparent text-tanah-tinta-redup hover:border-tanah-garis-kuat hover:text-tanah-tinta dark:text-langit-tinta-redup dark:hover:border-langit-garis-kuat dark:hover:text-langit-tinta'
                  }`}
                >
                  {t.label}
                </button>
              )
            })}
          </div>
          <div
            role="tabpanel"
            id={`${id}-panel-${active}`}
            aria-labelledby={`${id}-tab-${active}`}
            tabIndex={0}
            className="detail-scroll mt-3 overflow-x-auto"
          >
            {panels ? panels[active] : children}
          </div>
        </>
      )}

      {tabs.length === 0 && <div className="detail-scroll mt-3 overflow-x-auto">{children}</div>}
    </div>
  )
}
