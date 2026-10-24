/**
 * Audit F-25 — selagi modal terbuka, latar harus benar-benar mati: tidak terbaca pembaca layar
 * (`aria-hidden`) dan tidak bisa difokus (`inert`). Fungsi ini menyimpan nilai asli setiap
 * saudara yang disentuh dan mengembalikannya saat modal ditutup, sehingga tidak ada `inert`
 * yang tertinggal bila modal dibuka-tutup berkali-kali.
 *
 * Ditulis lepas dari React supaya bisa diuji dengan pohon DOM tiruan sederhana.
 */
export function hideBackground(element) {
  const saved = []
  let current = element
  while (current?.parentElement) {
    const parent = current.parentElement
    for (const sibling of parent.children) {
      // `data-lm-modal-keep` = lapisan modal lain yang harus tetap hidup.
      // `data-lm-react-inert` = elemen yang status inert-nya dikendalikan React.
      if (sibling === current) continue
      if (sibling.hasAttribute?.('data-lm-modal-keep') || sibling.hasAttribute?.('data-lm-react-inert')) continue
      saved.push([sibling, sibling.inert, sibling.getAttribute?.('aria-hidden') ?? null])
      sibling.inert = true
      sibling.setAttribute?.('aria-hidden', 'true')
    }
    current = parent
    if (parent === document.body) break
  }
  return () => {
    for (const [node, inert, aria] of saved) {
      node.inert = inert
      if (aria === null) node.removeAttribute?.('aria-hidden')
      else node.setAttribute?.('aria-hidden', aria)
    }
  }
}
