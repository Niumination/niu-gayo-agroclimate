import React, { useState } from 'react'
import { whatsappText, smsText, waShareUrl, smsShareUrl } from '../domain/share.js'

/**
 * FR-X-7 — bagikan ringkasan bahaya sentra: Web Share API bila ada, lalu WhatsApp (wa.me) / SMS / salin.
 * Teks disusun oleh src/domain/share.js (murni, teruji).
 */
export default function ShareButton({ hazards, location, compact = true }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
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

  const link = 'underline underline-offset-2 hover:text-ink dark:hover:text-mist'
  return (
    <span className="relative inline-flex items-center gap-2">
      <button type="button" onClick={share} className={link} aria-haspopup="menu" aria-expanded={open}>
        Bagikan
      </button>
      {open && (
        <span role="menu" className={`inline-flex items-center gap-2 ${compact ? '' : 'flex-col items-start'}`}>
          <a role="menuitem" className={link} href={waShareUrl(wa)} target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a role="menuitem" className={link} href={smsShareUrl(sms)}>SMS ({sms.length}/160)</a>
          <button role="menuitem" type="button" className={link} onClick={() => copy(wa)}>{copied ? 'Tersalin ✓' : 'Salin'}</button>
        </span>
      )}
    </span>
  )
}
