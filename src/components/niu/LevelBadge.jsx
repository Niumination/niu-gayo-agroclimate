import { LEVEL_LABEL } from '../../domain/hazards/levels.js'

/**
 * P7.3 — lencana tingkat bahaya untuk arah Tanah (terang) & Langit (gelap).
 *
 * Aturan yang dijaga:
 * - Makna tidak bergantung pada warna saja (WCAG 1.4.1): setiap tingkat punya
 *   bentuk glif berbeda — centang, segitiga, lonceng, oktagon, garis.
 * - Glif digambar dengan stroke `currentColor` (tanpa lubang berwarna latar),
 *   jadi tetap benar di kedua tangga tanpa tahu permukaan di belakangnya.
 * - Warna memakai token dua tangga: `tanah-level-*` / `langit-level-*`.
 * - Label selalu teks nyata (bukan aria-label saja); glif dekoratif → aria-hidden.
 */

const TONE = {
  rendah: 'text-tanah-level-rendah dark:text-langit-level-rendah',
  waspada: 'text-tanah-level-waspada dark:text-langit-level-waspada',
  bahaya: 'text-tanah-level-bahaya dark:text-langit-level-bahaya',
  ekstrem: 'text-tanah-level-ekstrem dark:text-langit-level-ekstrem',
  'n/a': 'text-tanah-tinta-redup dark:text-langit-tinta-redup',
}

const GLYPH = {
  rendah: <path d="M2.5 6.4 4.8 8.7 9.5 3.6" />,
  waspada: (
    <>
      <path d="M6 1.6 11 10.4H1z" strokeLinejoin="round" />
      <path d="M6 4.6v2.6M6 8.8v.1" />
    </>
  ),
  bahaya: (
    <>
      <path d="M6 1.6a3.2 3.2 0 0 1 3.2 3.2c0 1.4.5 2 1 2.7H1.8c.5-.7 1-1.3 1-2.7A3.2 3.2 0 0 1 6 1.6Z" strokeLinejoin="round" />
      <path d="M4.7 9.1a1.3 1.3 0 0 0 2.6 0" />
      <path d="M6 9.1v1.6" />
    </>
  ),
  ekstrem: (
    <>
      <path d="M4 1.4h4l2.6 2.6v4L8 10.6H4L1.4 8V4z" strokeLinejoin="round" />
      <path d="M6 3.6v3.1M6 8.3v.1" />
    </>
  ),
  'n/a': <path d="M2.2 6h7.6" />,
}

export function LevelGlyph({ level, className = 'h-4 w-4 shrink-0' }) {
  const key = GLYPH[level] ? level : 'n/a'
  return (
    <svg
      viewBox="0 0 12 12"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      aria-hidden="true"
      focusable="false"
      data-glyph={key}
    >
      {GLYPH[key]}
    </svg>
  )
}

export default function LevelBadge({ level, label, size = 'md', className = '', ...rest }) {
  const key = TONE[level] ? level : 'n/a'
  const text = label ?? LEVEL_LABEL[key] ?? 'Data belum tersedia'
  const glyph = size === 'sm' ? 'h-3 w-3 shrink-0' : 'h-4 w-4 shrink-0'
  const textSize = size === 'sm' ? 'text-caption' : 'text-body-sm'
  return (
    <span
      className={`inline-flex items-center gap-1.5 font-semibold ${textSize} ${TONE[key]} ${className}`}
      data-level={key}
      {...rest}
    >
      <LevelGlyph level={key} className={glyph} />
      <span className="break-words">{text}</span>
    </span>
  )
}
