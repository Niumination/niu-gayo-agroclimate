
/**
 * Notice P4 — pita keadaan aplikasi (daring kembali, data basi, offline).
 * Satu pesan, satu tindakan opsional, satu tombol tutup; semuanya `role="status"`
 * supaya pembaca layar mendengar perubahan tanpa merebut fokus.
 * Ikon dibuat inline (tanpa impor) agar bundel tetap kecil.
 */
const TONE = {
  info: 'border-rain/40 bg-rain/5 text-rain-deep dark:text-rain-soft',
  waspada: 'border-husk/45 bg-husk/10 text-husk-deep dark:text-husk-soft',
  bahaya: 'border-cherry/40 bg-cherry/5 text-cherry-deep dark:text-cherry-soft',
  aman: 'border-leaf/40 bg-leaf/10 text-leaf-deep dark:text-leaf-soft',
}

function Glyph({ tone }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false }
  if (tone === 'aman') {
    // centang dalam lingkaran
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M8.5 12.5l2.5 2.5 4.5-5" />
      </svg>
    )
  }
  if (tone === 'bahaya') {
    // segi-delapan penanda berhenti (bahaya)
    return (
      <svg {...common}>
        <path d="M8.5 3h7l5.5 5.5v7L15.5 21h-7L3 15.5v-7L8.5 3z" />
        <path d="M12 8v5M12 16.2v.1" />
      </svg>
    )
  }
  if (tone === 'waspada') {
    // jam — "data terakhir … lalu"
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7.5V12l3.2 2" />
      </svg>
    )
  }
  // info: gelombang sinyal
  return (
    <svg {...common}>
      <path d="M4.5 9.5a11 11 0 0 1 15 0" />
      <path d="M7.5 13a7 7 0 0 1 9 0" />
      <path d="M10.5 16.5a3 3 0 0 1 3 0" />
      <path d="M12 19.5v.1" />
    </svg>
  )
}

export default function Notice({
  tone = 'info',
  message,
  actionLabel,
  onAction,
  dismissLabel,
  onDismiss,
  className = '',
}) {
  return (
    <div
      role="status"
      className={`mx-4 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-card border px-4 py-3 text-body ${TONE[tone] || TONE.info} ${className}`}
    >
      <span className="shrink-0">
        <Glyph tone={tone} />
      </span>
      <p className="min-w-0 flex-1">{message}</p>
      {onAction && actionLabel ? (
        <button
          type="button"
          onClick={onAction}
          className="min-h-11 px-3 inline-flex items-center rounded-lg bg-surface/80 dark:bg-soil/80 font-medium text-ink dark:text-mist motion-safe:transition active:scale-[.97]"
        >
          {actionLabel}
        </button>
      ) : null}
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label={dismissLabel}
          className="min-h-11 min-w-11 inline-flex items-center justify-center rounded-lg bg-surface/80 dark:bg-soil/80 text-ink dark:text-mist motion-safe:transition active:scale-[.97]"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  )
}
