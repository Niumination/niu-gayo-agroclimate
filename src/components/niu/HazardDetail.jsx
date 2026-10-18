/**
 * P7.5 — isi rincian satu bahaya, dipakai bersama oleh
 * `HazardAttention` (mobile, inline) dan inspector desktop.
 *
 * Tiga panel: Ringkas (apa & kenapa), Angka (nilai model + sumber),
 * Saran (tindakan per kelompok). Semua teks berasal dari registry bahaya;
 * tidak ada angka yang dihitung ulang di lapisan tampilan.
 */

export const ADVICE_LABEL = [
  ['umum', 'Umum'],
  ['rentan', 'Kelompok rentan'],
  ['kebun', 'Kebun & panen'],
  ['sekolah', 'Sekolah'],
]

const txt = (a) => (typeof a === 'string' ? a : a?.id ?? '')

export function Advice({ advice }) {
  const groups = ADVICE_LABEL.filter(([k]) => Array.isArray(advice?.[k]) && advice[k].length > 0)
  if (!groups.length) return null
  return (
    <div className="space-y-2">
      {groups.map(([k, label]) => (
        <div key={k}>
          <p className="text-caption uppercase tracking-wide text-tanah-tinta-redup dark:text-langit-tinta-redup">
            {label}
          </p>
          <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-body-sm leading-relaxed text-tanah-tinta-isi dark:text-langit-tinta-isi">
            {advice[k].slice(0, 4).map((a, i) => (
              <li key={i} className="break-words">
                {txt(a)}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** Tiga panel siap pakai untuk `DetailPanel panels={...}`. */
export function hazardPanels(r) {
  const score = r?.score == null ? null : Math.round(r.score)
  return {
    ringkas: (
      <>
        <p className="text-body-sm leading-relaxed break-words text-tanah-tinta-isi dark:text-langit-tinta-isi">
          {r.headline || 'Informasi bahaya terbaru tersedia.'}
        </p>
        {r.advice?.umum?.length > 0 && (
          <div className="mt-3">
            <Advice advice={{ umum: r.advice.umum }} />
          </div>
        )}
        <p className="mt-3 text-caption leading-relaxed break-words text-tanah-tinta-halus dark:text-langit-tinta-halus">
          Pilih tab Angka untuk nilai model, atau Saran untuk tindakan per kelompok.
        </p>
      </>
    ),
    angka: (
      <>
        {r.metrics?.length > 0 ? (
          <dl className="divide-y divide-tanah-garis dark:divide-langit-garis">
            {r.metrics.slice(0, 6).map((m) => (
              <div key={m.key} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                <dt className="min-w-0 text-body-sm break-words text-tanah-tinta-redup dark:text-langit-tinta-redup">
                  {m.label || m.key}
                </dt>
                <dd className="font-data text-body-sm font-semibold tabular-nums text-tanah-tinta dark:text-langit-tinta">
                  {m.value == null ? '—' : String(m.value)}
                  {m.unit ? ` ${m.unit}` : ''}
                </dd>
              </div>
            ))}
            {score != null && (
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5">
                <dt className="text-body-sm text-tanah-tinta-redup dark:text-langit-tinta-redup">Skor model</dt>
                <dd className="font-data text-body-sm font-semibold tabular-nums text-tanah-tinta dark:text-langit-tinta">
                  {score}/100
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-body-sm text-tanah-tinta-isi dark:text-langit-tinta-isi">
            Belum ada angka model untuk bahaya ini.
          </p>
        )}
        {(r.detail || r.sources?.length > 0) && (
          <details className="mt-3 text-caption leading-relaxed break-words text-tanah-tinta-halus dark:text-langit-tinta-halus">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Sumber dan catatan teknis</summary>
            {r.sources?.length > 0 && <p className="mt-1">Sumber: {r.sources.map((s) => s.name).join(' · ')}</p>}
            {r.detail && <p className="mt-1">{r.detail}</p>}
          </details>
        )}
      </>
    ),
    saran: (
      <>
        <Advice advice={r.advice} />
        {!r.advice?.umum?.length && !r.advice?.kebun?.length && !r.advice?.rentan?.length && !r.advice?.sekolah?.length && (
          <p className="text-body-sm text-tanah-tinta-isi dark:text-langit-tinta-isi">
            Belum ada saran khusus; ikuti panduan umum di tab Ringkas.
          </p>
        )}
      </>
    ),
  }
}

export const HAZARD_TABS = [
  { id: 'ringkas', label: 'Ringkas' },
  { id: 'angka', label: 'Angka' },
  { id: 'saran', label: 'Saran' },
]
