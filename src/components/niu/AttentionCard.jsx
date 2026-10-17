import LevelBadge from './LevelBadge.jsx'

/**
 * P7.3 — kartu "Perlu perhatian": satu bahaya, satu kalimat, satu tombol Detail.
 *
 * Kontrak aksesibilitas (diuji di tests/niuComponents.test.js):
 * - Tombol Detail memakai `aria-expanded` + `aria-controls` yang menunjuk id panel.
 * - Panel rincian hanya dirender saat terbuka; saat terbuka ia `role="region"`
 *   dengan `aria-label` yang menyebut nama bahaya.
 * - Target sentuh tombol ≥ 44 px (`min-h-11`) dan seluruh kartu tidak memotong teks
 *   (`break-words`, tanpa `truncate`).
 * - Tepi kiri kartu menandai tingkat — tetapi label + glif tetap ada, jadi warna
 *   tidak pernah menjadi satu-satunya pembawa makna.
 */

const EDGE = {
  rendah: 'border-l-tanah-level-rendah dark:border-l-langit-level-rendah',
  waspada: 'border-l-tanah-level-waspada dark:border-l-langit-level-waspada',
  bahaya: 'border-l-tanah-level-bahaya dark:border-l-langit-level-bahaya',
  ekstrem: 'border-l-tanah-level-ekstrem dark:border-l-langit-level-ekstrem',
  'n/a': 'border-l-tanah-garis-kuat dark:border-l-langit-garis-kuat',
}

export default function AttentionCard({
  id,
  title,
  summary,
  meta,
  level = 'n/a',
  levelLabel,
  expanded = false,
  onToggle,
  detailId = `${id}-detail`,
  icon = null,
  actionLabel = 'Detail',
  closeLabel = 'Tutup rincian',
  children,
}) {
  const key = EDGE[level] ? level : 'n/a'
  return (
    <article
      id={id}
      data-level={key}
      className={`rounded-tanah-kartu border border-tanah-garis border-l-4 bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu ${EDGE[key]}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 items-start gap-2.5">
          {icon && <span className="mt-0.5 shrink-0 text-tanah-aksen dark:text-langit-aksen">{icon}</span>}
          <div className="min-w-0">
          <h3 className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta">
            {title}
          </h3>
          {summary && (
            <p className="mt-1 text-body-sm leading-relaxed break-words text-tanah-tinta-isi dark:text-langit-tinta-isi">
              {summary}
            </p>
          )}
          </div>
        </div>
        <LevelBadge level={key} label={levelLabel} size="sm" className="pt-0.5" />
      </div>

      {meta && (
        <p className="mt-2 font-data text-caption tabular-nums text-tanah-tinta-redup dark:text-langit-tinta-redup">
          {meta}
        </p>
      )}

      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={detailId}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-pil border border-tanah-garis-kuat px-4 text-body-sm font-semibold text-tanah-aksen transition-colors duration-100 ease-out hover:bg-tanah-terbenam active:scale-[.98] dark:border-langit-garis-kuat dark:text-langit-aksen dark:hover:bg-langit-terbenam"
      >
        {expanded ? closeLabel : actionLabel}
        <svg
          viewBox="0 0 12 12"
          className={`h-3 w-3 transition-transform duration-100 ease-out ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          aria-hidden="true"
          focusable="false"
        >
          <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
        </svg>
      </button>

      {expanded && (
        <div
          id={detailId}
          role="region"
          aria-label={`Rincian ${title}`}
          className="mt-3 border-t border-tanah-garis pt-3 dark:border-langit-garis"
        >
          {children}
        </div>
      )}
    </article>
  )
}
