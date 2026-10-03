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
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">
          Panduan Agro-Klimat Kopi Arabika Gayo
        </h2>
        <p className="text-[13px] text-ink/55 dark:text-mist/50 mt-0.5">
          Rekomendasi teknis budidaya &amp; penanganan pascapanen berbasis mikroklimat
        </p>
      </div>

      {/* Karat daun */}
      <div className="pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">Risiko Karat Daun (Hemileia vastatrix)</h3>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border border-ink/10 dark:border-mist/15 ${coffee.rustColor || 'text-ink dark:text-mist'}`}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
            {coffee.rustRisk}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/75 dark:text-mist/70">{coffee.rustDesc}</p>
        <p className="mt-3 text-[11px] text-ink/55 dark:text-mist/45 leading-relaxed">
          <strong className="font-medium text-ink/70 dark:text-mist/60">Tindakan petani:</strong> bila risiko tinggi,
          pangkas tunas air (wiwil) untuk memperbaiki aerasi kebun dan sirkulasi cahaya kanopi.
        </p>
      </div>

      {/* Penjemuran */}
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[13px] font-medium text-ink/70 dark:text-mist/60">Jendela Penjemuran (Pascapanen)</h3>
          <span className={`shrink-0 inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full border border-ink/10 dark:border-mist/15 ${coffee.dryingColor || 'text-ink dark:text-mist'}`}>
            <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-current" />
            {coffee.dryingStatus}
          </span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-ink/75 dark:text-mist/70">{coffee.dryingDesc}</p>
        <p className="mt-3 text-[11px] text-ink/55 dark:text-mist/45 leading-relaxed">
          <strong className="font-medium text-ink/70 dark:text-mist/60">Standar mutu:</strong> target kadar air green
          bean Specialty Gayo 11%–12%. Hindari terkena air hujan secara langsung.
        </p>
      </div>
    </section>
  )
}
