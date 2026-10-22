import LevelBadge from './LevelBadge.jsx'

/**
 * P7.3 — kepala status: satu angka besar + satu kalimat, lalu lencana tingkat.
 *
 * Dipakai di Ringkas (mobile) dan papan kerja (desktop). Angka utama memakai
 * font display sesuai arah (Bricolage di Tanah, Instrument Sans di Langit);
 * JetBrains Mono disimpan untuk angka teknis di panel Detail.
 *
 * Semantik: <section aria-labelledby> → h2 adalah judul yang dibaca pembaca layar;
 * angka besar diberi `aria-hidden`? Tidak — angka adalah isi, jadi dibiarkan
 * terbaca, tetapi satuannya dipisah dengan spasi tak-putus agar tidak dibaca
 * "derajat Celsius" terpisah dari angkanya.
 */
export default function StatusHeadline({
  id = 'status',
  kicker,
  kickerNode,
  title,
  subtitle,
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
      data-niu-card="status"
      className={`niu-status-card ${
        framed
          ? 'rounded-tanah-kartu bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:bg-langit-kartu sm:p-5'
          : ''
      }`}
    >
      <div className="niu-status-heading flex items-start justify-between gap-3">
        <div className="niu-status-heading-main min-w-0">
          <h2
            id={titleId}
            className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta"
          >
            {title}
          </h2>
          {subtitle && (
            <p className="mt-0.5 text-body-sm leading-snug break-words text-tanah-tinta-redup dark:text-langit-tinta-redup">
              {subtitle}
            </p>
          )}
        </div>
        {(kicker || kickerNode || aside) && (
          <div className="niu-status-heading-aside flex shrink-0 flex-col items-end gap-1">
            {(kickerNode || kicker) && (
              <span className="niu-status-kicker">{kickerNode ?? kicker}</span>
            )}
            {aside && <div>{aside}</div>}
          </div>
        )}
      </div>

      {value != null && value !== '' && (
        <p
          className={`niu-status-value mt-2 font-medium leading-none tabular-nums ${toneClass}`}
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
