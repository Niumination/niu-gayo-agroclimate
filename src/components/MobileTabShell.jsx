
/**
 * Kontainer konten mobile dengan transisi pindah tab (satu momen motion).
 * P2: role="tabpanel" + id/aria-labelledby agar hubungan tab ↔ panel terbaca
 * pembaca layar (WCAG 1.3.1/4.1.2); tabIndex=0 supaya panel bisa difokus langsung.
 */
export default function MobileTabShell({ active, children }) {
  return (
    <div
      key={active}
      id={`panel-${active}`}
      data-niu-page={active}
      role="tabpanel"
      aria-labelledby={`tab-${active}`}
      tabIndex={0}
      className="anim-enter px-4 pt-3 pb-28 space-y-4"
    >
      {children}
    </div>
  )
}
