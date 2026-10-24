/**
 * Pembaca CSS kecil untuk uji struktural.
 *
 * Uji CSS berbasis `assert.match(css, /\.sel \{[^}]*prop: …/)` rapuh: satu spasi,
 * satu deklarasi baru, atau urutan properti yang berbeda membuatnya gagal padahal
 * tampilan tidak berubah. Helper ini mengurai CSS menjadi aturan + deklarasi sehingga
 * uji menyebut selector, properti, dan nilai — bukan potongan teks mentah.
 */

const rapikan = (s) => s.replace(/\s+/g, ' ').trim()

function buangKomentar(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

/**
 * @returns {Array<{media: string[], selector: string, decls: Object}>}
 */
export function parse(cssText) {
  const css = buangKomentar(cssText)
  const hasil = []
  const tumpuk = [] // {media, selector}
  let buf = ''
  let i = 0

  const mediaAktif = () => tumpuk.filter((t) => t.media).map((t) => t.media)

  while (i < css.length) {
    const ch = css[i]
    if (ch === '{') {
      const prelude = rapikan(buf)
      buf = ''
      tumpuk.push({ prelude, media: prelude.startsWith('@media') ? prelude : null })
      i += 1
      continue
    }
    if (ch === '}') {
      tumpuk.pop()
      buf = ''
      i += 1
      continue
    }
    if (ch === ';') {
      const bagian = rapikan(buf)
      buf = ''
      if (bagian && !bagian.startsWith('@')) {
        const parent = tumpuk[tumpuk.length - 1]
        const duaTitik = bagian.indexOf(':')
        if (parent && duaTitik > 0) {
          hasil.push({
            media: mediaAktif(),
            selector: rapikan(parent.prelude),
            prop: rapikan(bagian.slice(0, duaTitik)).toLowerCase(),
            value: rapikan(bagian.slice(duaTitik + 1)),
          })
        }
      }
      i += 1
      continue
    }
    buf += ch
    i += 1
  }
  return hasil
}

/** Semua deklarasi untuk selector (daftar selector dipecah per koma). */
export function decls(parsed, selector, { media } = {}) {
  const target = rapikan(selector)
  return parsed.filter((d) => {
    if (media !== undefined && !d.media.some((m) => m.includes(media))) return false
    const pilihan = d.selector.split(',').map(rapikan)
    return pilihan.includes(target)
  })
}

/** Nilai properti pertama untuk selector; `` bila tidak ada (aman untuk assert.match). */
export function value(parsed, selector, prop, opsi) {
  const ketemu = decls(parsed, selector, opsi).find((d) => d.prop === prop)
  return ketemu ? ketemu.value : ''
}

/** Semua nilai properti (mis. beberapa aturan media untuk selector sama). */
export function values(parsed, selector, prop) {
  return decls(parsed, selector).filter((d) => d.prop === prop).map((d) => d.value)
}

/** Benar bila selector punya deklarasi prop yang cocok dengan pola. */
export function has(parsed, selector, prop, pola) {
  return values(parsed, selector, prop).some((v) => pola.test(v))
}

/** Selector yang muncul di dalam @media yang memuat potongan query tertentu. */
export function selectorsIn(parsed, mediaPotongan) {
  return [...new Set(parsed.filter((d) => d.media.some((m) => m.includes(mediaPotongan))).map((d) => d.selector))]
}

/** Nama-nama @keyframes yang dideklarasikan di berkas CSS. */
export function keyframes(cssText) {
  return [...buangKomentar(cssText).matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
}
