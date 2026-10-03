import React from 'react'

/**
 * Kontainer konten mobile dengan transisi pindah tab (satu momen motion).
 * key={active} memicu anim-enter saat tab berganti.
 */
export default function MobileTabShell({ active, children }) {
  return (
    <div key={active} className="anim-enter px-4 pt-3 pb-28 space-y-4">
      {children}
    </div>
  )
}
