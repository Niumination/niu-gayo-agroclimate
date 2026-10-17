import { useEffect, useState } from 'react'
import { dismissFor, isDismissed, isIosSafari, isStandalone } from './install.js'

/**
 * P7.6 — tawaran pasang aplikasi (Android/desktop) dan panduan iOS.
 *
 * - Android/Chromium: memakai event `beforeinstallprompt`; tombol "Pasang aplikasi"
 *   memanggil `prompt()` lalu menghormati pilihan pengguna.
 * - iOS Safari tidak punya event itu: tampilkan langkah manual Bagikan → Tambah ke
 *   Layar Utama, dengan tombol "Mengerti".
 * - Tawaran tidak muncul bila aplikasi sudah berdiri sendiri (standalone) atau
 *   pengguna menutupnya dalam 7 hari terakhir.
 * - Semua tombol ≥ 44 px; tidak ada dialog paksa — pengguna bisa menutup.
 */
export default function InstallHint() {
  const [evt, setEvt] = useState(null)
  const [ios, setIos] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (isStandalone() || isDismissed()) return
    if (isIosSafari()) {
      setIos(true)
      setOpen(true)
      return
    }
    const onPrompt = (e) => {
      e.preventDefault()
      setEvt(e)
      setOpen(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  const close = (days = 7) => {
    dismissFor(days)
    setOpen(false)
  }

  const install = async () => {
    if (!evt) return
    try {
      evt.prompt()
      const choice = await evt.userChoice
      if (choice?.outcome === 'accepted') {
        dismissFor(3650)
        setOpen(false)
      } else {
        close()
      }
    } catch {
      close()
    }
  }

  if (!open) return null

  return (
    <section
      aria-labelledby="install-title"
      className="mx-4 mt-3 rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu"
      data-ios={ios ? 'true' : 'false'}
    >
      <div className="flex items-start gap-3">
        <svg viewBox="0 0 512 512" className="mt-0.5 h-9 w-9 shrink-0" aria-hidden="true" focusable="false">
          <rect width="512" height="512" rx="116" fill="#2F4A38" />
          <path d="M256 96c-44 58-78 104-78 148a78 78 0 0 0 156 0c0-44-34-90-78-148Z" fill="#F1E7D8" />
          <circle cx="332" cy="176" r="26" fill="#FFD2A1" />
        </svg>
        <div className="min-w-0 flex-1">
          <h2 id="install-title" className="text-body font-semibold break-words text-tanah-tinta dark:text-langit-tinta">
            Pasang Niu di layar utama
          </h2>
          {ios ? (
            <>
              <p className="mt-1 text-body-sm leading-relaxed text-tanah-tinta-isi dark:text-langit-tinta-isi">
                Di Safari: ketuk tombol <strong>Bagikan</strong> (kotak dengan panah ke atas), lalu pilih{' '}
                <strong>Tambah ke Layar Utama</strong>, kemudian <strong>Tambah</strong>.
              </p>
              <button
                type="button"
                onClick={() => close()}
                className="mt-3 inline-flex min-h-11 items-center rounded-pil border border-tanah-garis-kuat px-4 text-body-sm font-semibold text-tanah-aksen hover:bg-tanah-terbenam dark:border-langit-garis-kuat dark:text-langit-aksen dark:hover:bg-langit-terbenam"
              >
                Mengerti
              </button>
            </>
          ) : (
            <>
              <p className="mt-1 text-body-sm leading-relaxed text-tanah-tinta-isi dark:text-langit-tinta-isi">
                Buka lebih cepat dan tetap terbaca saat sinyal lemah. Tanpa toko aplikasi, tanpa akun.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={install}
                  className="inline-flex min-h-11 items-center rounded-pil bg-tanah-aksen px-4 text-body-sm font-semibold text-tanah-aksen-tinta hover:opacity-90 dark:bg-langit-aksen dark:text-langit-aksen-tinta"
                >
                  Pasang aplikasi
                </button>
                <button
                  type="button"
                  onClick={() => close()}
                  className="inline-flex min-h-11 items-center rounded-pil px-4 text-body-sm font-semibold text-tanah-tinta-redup hover:bg-tanah-terbenam dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
                >
                  Nanti saja
                </button>
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onClick={() => close()}
          aria-label="Tutup tawaran pasang"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-tanah-kendali text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            <path d="m3.5 3.5 9 9M12.5 3.5l-9 9" />
          </svg>
        </button>
      </div>
    </section>
  )
}
