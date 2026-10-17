import { useState } from 'react'
import AttentionCard from './AttentionCard.jsx'
import DetailPanel from './DetailPanel.jsx'
import { hazardPanels, HAZARD_TABS } from './HazardDetail.jsx'
import { LEVEL_ORDER } from '../../domain/hazards/levels.js'

/**
 * P7.4/P7.5 — daftar "Perlu perhatian".
 *
 * Mobile: maksimal `limit` kartu, akordeon satu terbuka.
 * Desktop: dipakai dengan `limit={0}`? Tidak — desktop memakai inspector;
 * daftar ini tetap muncul di zona Ringkas sebagai pintasan tiga teratas.
 *
 * Rincian memakai `DetailPanel` mode `bare` (judul sudah ada di kepala kartu)
 * dan isi dari `hazardPanels()` supaya identik dengan inspector desktop.
 */
export default function HazardAttention({
  hazards,
  limit = 3,
  heading = 'Perlu perhatian',
  sub = 'Bahaya aktif hari ini, terberat lebih dulu',
  emptyText = 'Tidak ada bahaya aktif. Tetap pantau pembaruan berikutnya.',
  onSeeAll,
  seeAllLabel,
  onSelect,
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
                detailId={`attn-${r.id}-detail`}
                onToggle={() => {
                  if (onSelect) onSelect(r.id)
                  setOpenId(open ? null : r.id)
                }}
                actionLabel="Detail"
                closeLabel="Tutup rincian"
              >
                <DetailPanel
                  id={`attn-${r.id}-panel`}
                  title={`Rincian ${name}`}
                  bare
                  level={r.level}
                  levelLabel={r.levelLabel}
                  tabs={HAZARD_TABS}
                  panels={hazardPanels(r)}
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
