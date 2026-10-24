/**
 * F-06 (audit 24 Okt 2026) — kerangka ruang desktop.
 *
 * Sebelum perubahan ini, `main` kosong ~3 px selama data dimuat, lalu melompat ke ~977 px
 * (CLS 0,935). Komponen ini mencadangkan ruang final SEBELUM data ada sehingga tata letak
 * tidak bergeser saat konten asli masuk.
 *
 * Sengaja bukan tiruan konten: tidak ada angka, label, atau level bahaya apa pun — hanya
 * bidang dan bilah netral. `aria-hidden` + `inert` menjaga agar pembaca layar dan papan ketik
 * tidak pernah masuk ke kerangka ini.
 */
export default function LivingMapBoot() {
  return (
    <div className="living-map-shell lm-boot" data-boot="true" aria-hidden="true" inert>
      <div className="lm-boot-canvas" />
      <div className="lm-boot-summary" />
      <div className="lm-boot-panel" />
      <div className="lm-boot-bottom" />
    </div>
  )
}
