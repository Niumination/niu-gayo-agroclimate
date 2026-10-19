import {  useState  } from 'react'
import { whatsappText, smsText, waShareUrl, smsShareUrl } from '../domain/share.js'

/**
 * FR-X-7 — bagikan ringkasan bahaya sentra: Web Share API bila ada, lalu WhatsApp (wa.me) / SMS / salin.
 * Teks disusun oleh src/domain/share.js (murni, teruji).
 */
export default function ShareButton({
  hazards,
  location,
  compact = true,
  buttonClassName,
  icon = null,
  tr = (k) => k,
  open: openProp,
  onOpenChange,
}) {
  const [internalOpen, setInternalOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const isControlled = openProp !== undefined
  const open = isControlled ? Boolean(openProp) : internalOpen
  const setOpen = (next) => {
    const value = typeof next === 'function' ? next(open) : next
    if (!isControlled) setInternalOpen(value)
    onOpenChange?.(value)
  }
  if (!hazards?.results?.length) return null
  const url = typeof window !== 'undefined' ? window.location.href : undefined
  const wa = whatsappText(hazards, location, { url })
  const sms = smsText(hazards, location)

  const share = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `Indeks bahaya — ${location?.name ?? ''}`, text: wa })
        return
      } catch { /* dibatalkan / tidak didukung → fallback menu */ }
    }
    setOpen((v) => !v)
  }
  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* abaikan */ }
  }

  // P2: role="group" (bukan role="menu" tanpa pengelolaan fokus) — semua item tetap
  // fokusable secara alami; target sentuh ≥ 44 px lewat min-h-11.
  const link = 'min-h-11 inline-flex items-center underline underline-offset-2 hover:text-ink dark:hover:text-mist transition duration-100 ease-out active:scale-[.97]'
  return (
    <span className="relative inline-flex items-center gap-2">
      <button
        type="button"
        onClick={share}
        className={`min-h-11 ${buttonClassName || link}`}
        aria-expanded={open}
        aria-label={icon ? tr('share') : undefined}
        title={icon ? tr('share') : undefined}
      >
        {icon}
        <span className={icon ? 'sr-only' : undefined}>{tr('share')}</span>
      </button>
      {open && (
        <span role="group" aria-label={tr('shareHow')} className={`inline-flex items-center gap-3 ${compact ? '' : 'flex-col items-start'}`}>
          <a className={link} href={waShareUrl(wa)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className={link} href={smsShareUrl(sms)}>SMS ({sms.length}/160)</a>
          <button type="button" className={link} onClick={() => copy(wa)}>{copied ? `${tr('copied')} ✓` : tr('copy')}</button>
        </span>
      )}
    </span>
  )
}
