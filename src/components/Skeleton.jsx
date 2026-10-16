import React, { useEffect, useState } from 'react'

/**
 * Skeleton P4 — kerangka bertata tetap selama data dimuat.
 * Riset R-11: manfaat utama skeleton adalah **stabilitas tata letak** (CLS), bukan ilusi kecepatan;
 * karena itu tinggi tiap blok tetap dan skeleton baru muncul setelah 300 ms (lihat `useDelayedVisible`).
 * Semua blok `aria-hidden` supaya pembaca layar hanya mendengar pengumuman `role="status"` dari App.
 */
export function SkeletonBlock({ className = 'h-4 w-full' }) {
  return <span aria-hidden="true" className={`skeleton block rounded-md ${className}`} />
}

/** Satu kartu data tiruan: judul + subjudul + beberapa baris berirama. */
export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <section
      aria-hidden="true"
      className={`bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5 ${className}`}
    >
      <SkeletonBlock className="h-5 w-2/5" />
      <SkeletonBlock className="mt-2 h-4 w-3/5" />
      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonBlock key={i} className={`h-9 ${i % 2 ? 'w-11/12' : 'w-full'}`} />
        ))}
      </div>
    </section>
  )
}

/**
 * Tampilkan skeleton hanya setelah `delay` ms — muat cepat (< 300 ms) tidak berkedip,
 * muat lambat dapat kerangka yang menenangkan (riset R-11).
 */
export function useDelayedVisible(delay = 300) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setVisible(true), delay)
    return () => clearTimeout(id)
  }, [delay])
  return visible
}

/** Kerangka halaman: panel instrumen + tiga kartu data. */
export default function AppSkeleton({ cards = 3 }) {
  return (
    <div className="space-y-4">
      <SkeletonCard lines={2} />
      {Array.from({ length: cards }).map((_, i) => (
        <SkeletonCard key={i} lines={i % 2 ? 2 : 3} />
      ))}
    </div>
  )
}
