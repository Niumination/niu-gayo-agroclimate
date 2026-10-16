import React from 'react'

const defaultTr = (k, f) => f ?? k

/**
 * Panduan agro-klimat kopi. Satu panel dengan hairline rules; dua pembacaan
 * (karat daun, jendela penjemuran) dipisah garis tipis, bukan kartu kembar.
 */
export default function CoffeeAdvisory({ coffee, tr = (k, f) => defaultTr(k, f) }) {
  if (!coffee) return null

  return (
    <section
      aria-label="Panduan Agro-Klimat Kopi Arabika Gayo"
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">
          Panduan Agro-Klimat Kopi Arabika Gayo
        </h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">
          Rekomendasi teknis budidaya &amp; penanganan pascapanen berbasis mikroklimat
        </p>
      </div>

      {/* Karat daun */}
      <div className="pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">Risiko Karat Daun (Hemileia vastatrix)</h3>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-caption font-medium px-2 py-0.5 rounded-full border border-ink/10 dark:border-mist/15 ${coffee.rustColor || 'text-ink dark:text-mist'}`}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
            {coffee.rustRisk}
          </span>
        </div>
        <p className="mt-2 text-body leading-relaxed text-ink-body dark:text-mist-body">{coffee.rustDesc}</p>
        <p className="mt-3 text-caption text-ink-muted dark:text-mist-muted leading-relaxed">
          <strong className="font-medium text-ink-body dark:text-mist-muted">Tindakan petani:</strong> bila risiko tinggi,
          pangkas tunas air (wiwil) untuk memperbaiki aerasi kebun dan sirkulasi cahaya kanopi.
        </p>
      </div>

      {/* Penjemuran */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">Jendela Penjemuran (Pascapanen)</h3>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-caption font-medium px-2 py-0.5 rounded-full border border-ink/10 dark:border-mist/15 ${coffee.dryingColor || 'text-ink dark:text-mist'}`}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
            {coffee.dryingStatus}
          </span>
        </div>
        <p className="mt-2 text-body leading-relaxed text-ink-body dark:text-mist-body">{coffee.dryingDesc}</p>
        <p className="mt-3 text-caption text-ink-muted dark:text-mist-muted leading-relaxed">
          <strong className="font-medium text-ink-body dark:text-mist-muted">Standar mutu:</strong> target kadar air green
          bean Specialty Gayo 11%–12%. Hindari terkena air hujan secara langsung.
        </p>
      </div>
    </section>
  )
}
