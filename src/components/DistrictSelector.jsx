import { useEffect, useMemo, useRef } from 'react'
import { Check, MapPin, X } from 'lucide-react'
import { LOCATIONS } from '../data/locations'

/** Pemilih sentra bersama untuk kepala ponsel dan desktop. */
export default function DistrictSelector({
  open = false,
  onClose,
  selectedLocation,
  onSelectLocation,
  tr = (key) => key,
}) {
  const dialogRef = useRef(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const locations = useMemo(() => [...LOCATIONS].sort((a, b) => b.elevation - a.elevation), [])

  useEffect(() => {
    if (!open) return undefined
    const dialog = dialogRef.current
    const previousFocus = document.activeElement
    const focusSelected = () => {
      const selected = dialog?.querySelector('[aria-current="true"]')
      ;(selected || dialog?.querySelector('button'))?.focus()
    }
    const frame = window.requestAnimationFrame(focusSelected)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current?.()
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const focusable = [...dialog.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
        window.requestAnimationFrame(() => previousFocus.focus())
      }
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[85] grid place-items-center bg-soil/45 p-4 backdrop-blur-sm"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.()
      }}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="location-picker-title"
        className="niu-modal-surface flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu shadow-2xl dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu"
      >
        <header className="flex items-start justify-between gap-3 border-b border-tanah-garis px-5 py-4 dark:border-langit-garis">
          <div className="min-w-0">
            <p className="text-caption uppercase tracking-wide text-tanah-tinta-halus dark:text-langit-tinta-halus">Wilayah pantauan</p>
            <h2 id="location-picker-title" className="mt-1 text-body font-semibold text-tanah-tinta dark:text-langit-tinta">
              Pilih sentra
            </h2>
            <p className="mt-1 text-body-sm text-tanah-tinta-redup dark:text-langit-tinta-redup">15 sentra kopi di Aceh Tengah</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pilihan sentra"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-tanah-kendali text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </header>
        <ol className="min-h-0 overflow-y-auto p-2">
          {locations.map((location) => {
            const active = location.id === selectedLocation?.id
            return (
              <li key={location.id}>
                <button
                  type="button"
                  aria-current={active ? 'true' : undefined}
                  aria-label={`${location.name}, ${location.elevation.toLocaleString('id-ID')} ${tr('mdpl')}, ${location.type}${active ? ', dipilih' : ''}`}
                  onClick={() => {
                    onSelectLocation?.(location)
                    onClose?.()
                  }}
                  className={`flex min-h-14 w-full items-center gap-3 rounded-tanah-kendali px-3 py-2 text-left transition-colors duration-100 ease-out active:scale-[.99] dark:rounded-langit-kendali ${
                    active
                      ? 'bg-tanah-terbenam text-tanah-tinta dark:bg-langit-terbenam dark:text-langit-tinta'
                      : 'text-tanah-tinta-isi hover:bg-tanah-terbenam dark:text-langit-tinta-isi dark:hover:bg-langit-terbenam'
                  }`}
                >
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${active ? 'bg-tanah-aksen text-tanah-aksen-tinta dark:bg-langit-aksen dark:text-langit-aksen-tinta' : 'bg-tanah-kartu text-tanah-tinta-redup dark:bg-langit-kartu dark:text-langit-tinta-redup'}`}>
                    {active ? <Check aria-hidden="true" className="h-4 w-4" /> : <MapPin aria-hidden="true" className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-body-sm font-semibold">{location.name}</span>
                    <span className="mt-0.5 block break-words text-caption text-tanah-tinta-redup dark:text-langit-tinta-redup">
                      {location.elevation.toLocaleString('id-ID')} {tr('mdpl')} · {location.type}
                    </span>
                  </span>
                  {active && <span className="shrink-0 text-caption font-semibold text-tanah-aksen dark:text-langit-aksen">Dipilih</span>}
                </button>
              </li>
            )
          })}
        </ol>
      </section>
    </div>
  )
}
