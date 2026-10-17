import LevelBadge from './LevelBadge.jsx'

/**
 * P7.3 — kepala status: satu angka besar + satu kalimat, lalu lencana tingkat.
 *
 * Dipakai di Ringkas (mobile) dan papan kerja (desktop). Angka memakai
 * `font-data` (JetBrains Mono) supaya digit tidak "menari" saat nilai berubah;
 * ukuran memakai clamp agar 88 px di ponsel dan 72 px di kartu sempit.
 *
 * Semantik: <section aria-labelledby> → h2 adalah judul yang dibaca pembaca layar;
 * angka besar diberi `aria-hidden`? Tidak — angka adalah isi, jadi dibiarkan
 * terbaca, tetapi satuannya dipisah dengan spasi tak-putus agar tidak dibaca
 * "derajat Celsius" terpisah dari angkanya.
 */
export default function StatusHeadline({
  id = 'status',
  kicker,
  title,
  value,
  unit,
  note,
  level,
  levelLabel,
  aside,
  tone,
  framed = true,
  children,
}) {
  const titleId = `${id}-title`
  const toneClass =
    tone === 'dingin'
      ? 'text-rain-deep dark:text-rain-soft'
      : tone === 'panas'
        ? 'text-cherry-deep dark:text-cherry-soft'
        : 'text-tanah-tinta dark:text-langit-tinta'

  return (
    <section
      aria-labelledby={titleId}
      className={
        framed
          ? 'rounded-tanah-kartu bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:bg-langit-kartu sm:p-5'
          : ''
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker && (
            <p className="text-caption uppercase tracking-wide text-tanah-tinta-redup dark:text-langit-tinta-redup">
              {kicker}
            </p>
          )}
          <h2
            id={titleId}
            className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta"
          >
            {title}
          </h2>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>

      {value != null && value !== '' && (
        <p
          className={`mt-2 font-data font-medium leading-none tabular-nums ${toneClass}`}
          style={{ fontSize: 'clamp(3rem, 9vw, 5.5rem)' }}
        >
          {value}
          {unit && (
            <span className="ml-1 align-top text-body text-tanah-tinta-redup dark:text-langit-tinta-redup">
              {'\u00a0'}
              {unit}
            </span>
          )}
        </p>
      )}

      {note && (
        <p className="mt-2 text-body-sm leading-relaxed break-words text-tanah-tinta-isi dark:text-langit-tinta-isi">
          {note}
        </p>
      )}

      {level && (
        <p className="mt-3">
          <LevelBadge level={level} label={levelLabel} />
        </p>
      )}

      {children}
    </section>
  )
}
