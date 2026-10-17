import { useState } from 'react'
import AttentionCard from './AttentionCard.jsx'
import DetailPanel from './DetailPanel.jsx'
import { LEVEL_ORDER } from '../../domain/hazards/levels.js'

/**
 * P7.4 — daftar "Perlu perhatian" untuk beranda mobile.
 *
 * Mengambil bahaya aktif (waspada ke atas) yang sudah diurutkan registry,
 * lalu menampilkan maksimal `limit` kartu. Satu kartu terbuka pada satu waktu
 * (akordeon) agar halaman tidak melompat saat beberapa rincian dibuka.
 *
 * Rincian memakai `DetailPanel` mode `bare`: tab Ringkas · Angka · Saran,
 * tanpa judul ganda karena judul sudah ada di kepala kartu.
 */

const ADVICE_LABEL = [
  ['umum', 'Umum'],
  ['rentan', 'Kelompok rentan'],
  ['kebun', 'Kebun & panen'],
  ['sekolah', 'Sekolah'],
]

const txt = (a) => (typeof a === 'string' ? a : a?.id ?? '')

function Advice({ advice }) {
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

export default function HazardAttention({
  hazards,
  limit = 3,
  heading = 'Perlu perhatian',
  sub = 'Bahaya aktif hari ini, terberat lebih dulu',
  emptyText = 'Tidak ada bahaya aktif. Tetap pantau pembaruan berikutnya.',
  onSeeAll,
  seeAllLabel,
}) {
  const [openId, setOpenId] = useState(null)
  const active = (hazards?.active ?? []).filter((r) => LEVEL_ORDER[r.level] >= LEVEL_ORDER.waspada)
  const shown = active.slice(0, limit)
  const rest = active.length - shown.length

  if (!shown.length) {
    return (
      <section
        aria-labelledby="attn-title"
        className="rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu"
      >
        <h2 id="attn-title" className="text-body font-semibold text-tanah-tinta dark:text-langit-tinta">
          {heading}
        </h2>
        <p className="mt-1 text-body-sm leading-relaxed text-tanah-tinta-isi dark:text-langit-tinta-isi">
          {emptyText}
        </p>
      </section>
    )
  }

  return (
    <section aria-labelledby="attn-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 px-0.5">
        <h2 id="attn-title" className="text-body font-semibold break-words text-tanah-tinta dark:text-langit-tinta">
          {heading}
          <span className="ml-2 font-data text-caption font-normal tabular-nums text-tanah-tinta-redup dark:text-langit-tinta-redup">
            {active.length}
          </span>
        </h2>
        <p className="text-caption text-tanah-tinta-redup dark:text-langit-tinta-redup">{sub}</p>
      </div>

      <ul className="mt-2 space-y-3">
        {shown.map((r) => {
          const name = r.label?.id || r.id
          const open = openId === r.id
          const detailId = `attn-${r.id}-detail`
          const score = r.score == null ? null : Math.round(r.score)
          return (
            <li key={r.id}>
              <AttentionCard
                id={`attn-${r.id}`}
                title={name}
                summary={r.headline}
                meta={score == null ? null : `Skor ${score}/100`}
                level={r.level}
                levelLabel={r.levelLabel}
                expanded={open}
                detailId={detailId}
                onToggle={() => setOpenId(open ? null : r.id)}
                actionLabel="Detail"
                closeLabel="Tutup rincian"
              >
                <DetailPanel
                  id={`attn-${r.id}-panel`}
                  title={`Rincian ${name}`}
                  bare
                  level={r.level}
                  levelLabel={r.levelLabel}
                  tabs={[
                    { id: 'ringkas', label: 'Ringkas' },
                    { id: 'angka', label: 'Angka' },
                    { id: 'saran', label: 'Saran' },
                  ]}
                  panels={{
                    ringkas: (
                      <>
                        <p className="text-body-sm leading-relaxed break-words text-tanah-tinta-isi dark:text-langit-tinta-isi">
                          {r.detail || r.headline}
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
                        {r.sources?.length > 0 && (
                          <p className="mt-3 text-caption leading-relaxed break-words text-tanah-tinta-halus dark:text-langit-tinta-halus">
                            Sumber: {r.sources.map((s) => s.name).join(' · ')}
                          </p>
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
                  }}
                />
              </AttentionCard>
            </li>
          )
        })}
      </ul>

      {(rest > 0 || onSeeAll) && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          {rest > 0 && (
            <p className="text-caption text-tanah-tinta-redup dark:text-langit-tinta-redup">
              {rest} bahaya lain ada di bagian Risiko.
            </p>
          )}
          {onSeeAll && (
            <button
              type="button"
              onClick={onSeeAll}
              className="inline-flex min-h-11 items-center rounded-pil px-3 text-body-sm font-semibold text-tanah-aksen underline-offset-4 hover:underline dark:text-langit-aksen"
            >
              {seeAllLabel || 'Lihat semua di Risiko'}
            </button>
          )}
        </div>
      )}
    </section>
  )
}
