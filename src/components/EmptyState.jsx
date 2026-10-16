
/**
 * EmptyState P4 — kartu data tidak boleh hilang tanpa penjelasan.
 * Setiap keadaan kosong memuat: apa yang kosong, mengapa (bila diketahui), dan langkah berikutnya.
 * Label tombol aksi wajib ≥ 44 px (`min-h-11`) seperti aksi lain.
 */
export default function EmptyState({ title, hint, action, icon = null, tone = 'netral', className = '' }) {
  const toneRing =
    tone === 'waspada'
      ? 'border-level-waspada/40 dark:border-level-waspada-dark/40'
      : 'border-line-strong dark:border-line-strong-dark'
  return (
    <div
      className={`min-h-[120px] rounded-card border border-dashed ${toneRing} bg-surface dark:bg-soil p-5 flex flex-col items-center justify-center text-center gap-2 ${className}`}
    >
      {icon ? (
        <span aria-hidden="true" className="text-ink-muted dark:text-mist-muted">
          {icon}
        </span>
      ) : null}
      <p className="text-body font-medium text-ink dark:text-mist">{title}</p>
      {hint ? <p className="text-body-sm text-ink-muted dark:text-mist-muted max-w-prose">{hint}</p> : null}
      {action ?? null}
    </div>
  )
}
