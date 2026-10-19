import { useEffect, useRef } from 'react'
import DetailPanel from './DetailPanel.jsx'
import { hazardPanels, HAZARD_TABS } from './HazardDetail.jsx'
import { LEVEL_LABEL } from '../../domain/hazards/levels.js'

const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'

/** Inspector satu bahaya untuk dok/laci desktop dan akordeon di bawah baris terpilih. */
export default function DesktopHazardInspector({
  selected,
  location,
  onClose,
  big = false,
  onToggleBig,
  inline = false,
}) {
  const panelRef = useRef(null)
  const selectedIdRef = useRef(selected?.id)
  selectedIdRef.current = selected?.id

  useEffect(() => {
    if (!big || !panelRef.current) return undefined

    const panel = panelRef.current
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    const inertState = new Map()
    let current = panel

    // Kunci semua cabang di luar dialog, termasuk header, footer, rel, dan kanvas.
    while (current?.parentElement) {
      const parent = current.parentElement
      for (const sibling of parent.children) {
        if (sibling === current || sibling.hasAttribute('data-niu-modal-keep')) continue
        if (!inertState.has(sibling)) inertState.set(sibling, sibling.inert)
        sibling.inert = true
      }
      current = parent
      if (parent === document.body) break
    }
    document.body.style.overflow = 'hidden'

    const focusClose = () => panel.querySelector('[aria-label="Tutup panel rincian"]')?.focus()
    const frame = window.requestAnimationFrame(focusClose)
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onToggleBig?.(false)
        return
      }
      if (event.key !== 'Tab') return
      const focusable = [...panel.querySelectorAll(FOCUSABLE)].filter((element) => element.getClientRects().length > 0)
      if (!focusable.length) {
        event.preventDefault()
        panel.focus()
        return
      }
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = previousOverflow
      for (const [element, wasInert] of inertState) element.inert = wasInert
      window.requestAnimationFrame(() => {
        if (previousFocus?.isConnected && typeof previousFocus.focus === 'function') {
          previousFocus.focus()
          return
        }
        const rows = [...document.querySelectorAll('[data-hazard-row]')]
        const selectedRow = rows.find((row) => row.getAttribute('data-hazard-row') === selectedIdRef.current)
        ;(selectedRow || document.getElementById('zona-risiko'))?.focus()
      })
    }
  }, [big, onToggleBig])

  if (!selected) return null

  const aside = onToggleBig ? (
    <button
      type="button"
      onClick={() => onToggleBig((value) => !value)}
      aria-pressed={big}
      aria-label={big ? 'Perkecil panel rincian' : 'Perbesar panel rincian'}
      title="Perbesar / perkecil panel"
      className="grid h-11 w-11 place-items-center rounded-tanah-kendali text-tanah-tinta-redup hover:bg-tanah-terbenam dark:rounded-langit-kendali dark:text-langit-tinta-redup dark:hover:bg-langit-terbenam"
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {big ? (
          <path d="M8 4H5a1 1 0 0 0-1 1v3m12-4h3a1 1 0 0 1 1 1v3M4 16v3a1 1 0 0 0 1 1h3m12-4v3a1 1 0 0 1-1 1h-3" />
        ) : (
          <path d="M4 9V5a1 1 0 0 1 1-1h4M20 9V5a1 1 0 0 0-1-1h-4M4 15v4a1 1 0 0 0 1 1h4M20 15v4a1 1 0 0 1-1 1h-4" />
        )}
      </svg>
    </button>
  ) : null

  const title = selected.label?.id || selected.id
  const levelLabel = selected.levelLabel || LEVEL_LABEL[selected.level] || 'Belum dinilai'
  const subtitle = `${location?.name ?? ''} · ${levelLabel} · dinilai ${selected.score == null ? '—' : Math.round(selected.score)}/100`

  if (inline) {
    return (
      <aside className="niu-inline-inspector" aria-label={`Rincian ${title}`}>
        <DetailPanel
          id="desktop-inline-hazard-panel"
          title={title}
          subtitle={subtitle}
          level={selected.level}
          levelLabel={levelLabel}
          tabs={HAZARD_TABS}
          panels={hazardPanels(selected)}
          onClose={onClose}
          closeLabel="Tutup rincian bahaya"
        />
      </aside>
    )
  }

  return (
    <>
      {big && (
        <div
          className="desk-insp-scrim"
          data-niu-modal-keep
          aria-hidden="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              event.preventDefault()
              onToggleBig?.(false)
            }
          }}
        />
      )}
      <aside
        ref={panelRef}
        className={`desk-insp min-w-0 ${big ? 'desk-insp--big' : ''}`}
        aria-label={big ? undefined : 'Rincian bahaya terpilih'}
        role={big ? 'dialog' : undefined}
        aria-modal={big ? 'true' : undefined}
        aria-labelledby={big ? 'desk-insp-panel-title' : undefined}
        tabIndex={big ? -1 : undefined}
      >
        <div className="desk-insp-inner">
          <DetailPanel
            id="desk-insp-panel"
            title={title}
            subtitle={subtitle}
            level={selected.level}
            levelLabel={levelLabel}
            tabs={HAZARD_TABS}
            panels={hazardPanels(selected)}
            onClose={onClose}
            closeLabel="Tutup panel rincian"
            aside={aside}
          />
          <p className="mt-3 px-1 text-caption leading-relaxed text-tanah-tinta-halus dark:text-langit-tinta-halus">
            Pilih baris lain di bagian Risiko untuk mengganti rincian. Tekan Esc atau tombol tutup untuk menyembunyikan panel.
          </p>
        </div>
      </aside>
    </>
  )
}
