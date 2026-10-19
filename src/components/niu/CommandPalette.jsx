import { useEffect, useMemo, useRef, useState } from 'react'

/**
 * P7.5 — palet perintah (⌘K / Ctrl+K).
 *
 * - Satu input, satu daftar; `role="combobox"` + `aria-activedescendant`
 *   sehingga fokus tetap di input saat panah naik/turun.
 * - Enter menjalankan item aktif, Escape menutup dan mengembalikan fokus.
 * - Item terakhir yang dijalankan disimpan di `localStorage` (maks 5) dan
 *   muncul sebagai grup "Terakhir dipakai" saat kueri kosong.
 * - Semua item berasal dari props; komponen ini tidak tahu domain bahaya.
 */

const KEY = 'niu.komando.riwayat'

const readRecent = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(raw) ? raw.filter((x) => typeof x === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

const pushRecent = (id) => {
  try {
    const next = [id, ...readRecent().filter((x) => x !== id)].slice(0, 5)
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    /* penyimpanan penuh / mode privat — riwayat hanya hilang, palet tetap jalan */
  }
}

const normalize = (value) => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
const editDistance = (left, right) => {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  for (let i = 1; i <= left.length; i += 1) {
    let diagonal = previous[0]
    previous[0] = i
    for (let j = 1; j <= right.length; j += 1) {
      const above = previous[j]
      previous[j] = Math.min(previous[j] + 1, previous[j - 1] + 1, diagonal + (left[i - 1] === right[j - 1] ? 0 : 1))
      diagonal = above
    }
  }
  return previous[right.length]
}
const fuzzyScore = (item, query) => {
  const label = normalize(item.label)
  const text = normalize(`${item.label} ${item.sub || ''}`)
  const exactAt = text.indexOf(query)
  if (exactAt >= 0) return (label.startsWith(query) ? 0 : 1000) + exactAt
  const words = text.split(/[^a-z0-9]+/).filter(Boolean)
  const tokens = query.split(/\s+/).filter(Boolean)
  let score = 0
  for (const token of tokens) {
    let best = Infinity
    for (const word of words) {
      const at = word.indexOf(token)
      if (at >= 0) best = Math.min(best, 20 + at)
      else if (token.length >= 3) {
        const limit = token.length >= 7 ? 2 : 1
        const distance = editDistance(token, word)
        if (distance <= limit) best = Math.min(best, 100 + distance * 10 + Math.abs(word.length - token.length))
      }
    }
    if (!Number.isFinite(best)) return null
    score += best
  }
  return 2000 + score
}

export default function CommandPalette({ open, onClose, items = [], placeholder = 'Cari sentra, bahaya, bagian, atau aksi…' }) {
  const [q, setQ] = useState('')
  const [idx, setIdx] = useState(0)
  const [recent, setRecent] = useState([])
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const openerRef = useRef(null)

  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement
    setQ('')
    setIdx(0)
    setRecent(readRecent())
    const t = setTimeout(() => inputRef.current?.focus(), 0)
    return () => {
      clearTimeout(t)
      const o = openerRef.current
      if (o && typeof o.focus === 'function') o.focus()
    }
  }, [open])

  const groups = useMemo(() => {
    const byId = new Map(items.map((it) => [it.id, it]))
    const query = normalize(q.trim())
    if (!query) {
      const rec = recent.map((id) => byId.get(id)).filter(Boolean)
      const rest = items.filter((it) => !recent.includes(it.id))
      const out = []
      if (rec.length) out.push({ label: 'Terakhir dipakai', items: rec })
      for (const g of [...new Set(rest.map((it) => it.group))]) {
        out.push({ label: g, items: rest.filter((it) => it.group === g) })
      }
      return out
    }
    const scored = items
      .map((it) => {
        const score = fuzzyScore(it, query)
        return score == null ? null : { it, score }
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score)
      .map((result) => result.it)
    if (!scored.length) return []
    const out = []
    for (const g of [...new Set(scored.map((it) => it.group))]) {
      out.push({ label: g, items: scored.filter((it) => it.group === g) })
    }
    return out
  }, [items, q, recent])

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups])
  const active = flat[Math.min(idx, Math.max(0, flat.length - 1))]
  const activeId = active ? `pal-${active.id}` : undefined

  const run = (it) => {
    if (!it) return
    pushRecent(it.id)
    onClose?.()
    it.run?.()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      inputRef.current?.focus()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose?.()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIdx((i) => (flat.length ? (i + 1) % flat.length : 0))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setIdx((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      run(active)
    }
  }

  useEffect(() => {
    const el = document.getElementById(activeId || '')
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeId])

  if (!open) return null

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[80] flex items-start justify-center bg-soil/45 px-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Palet perintah"
        className="niu-modal-surface w-full max-w-[620px] overflow-hidden rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu shadow-2xl dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu"
      >
        <div className="flex items-center gap-2 border-b border-tanah-garis px-3 dark:border-langit-garis">
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 shrink-0 text-tanah-tinta-redup dark:text-langit-tinta-redup"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            role="combobox"
            aria-expanded="true"
            aria-controls="pal-list"
            aria-autocomplete="list"
            aria-activedescendant={activeId}
            aria-label="Cari dan jalankan perintah"
            autoComplete="off"
            spellCheck="false"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setIdx(0)
            }}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className="min-h-12 w-full min-w-0 bg-transparent text-body text-tanah-tinta placeholder:text-tanah-tinta-halus focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tanah-aksen dark:text-langit-tinta dark:placeholder:text-langit-tinta-halus dark:focus-visible:outline-langit-aksen"
          />
          <kbd className="shrink-0 rounded border border-tanah-garis px-1.5 py-0.5 font-data text-caption text-tanah-tinta-redup dark:border-langit-garis dark:text-langit-tinta-redup">
            Esc
          </kbd>
        </div>

        <div ref={listRef} id="pal-list" role="listbox" aria-label="Hasil pencarian" className="max-h-[52vh] overflow-y-auto p-1.5">
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-body-sm text-tanah-tinta-redup dark:text-langit-tinta-redup">
              Tidak ada hasil untuk “{q}”. Coba kata lain.
            </p>
          )}
          {groups.map((g) => (
            <div key={g.label} role="group" aria-label={g.label}>
              <p aria-hidden="true" className="px-2.5 pb-1 pt-2 text-caption uppercase tracking-wide text-tanah-tinta-halus dark:text-langit-tinta-halus">
                {g.label}
              </p>
              {g.items.map((it) => {
                const on = active?.id === it.id
                return (
                  <div
                    key={it.id}
                    id={`pal-${it.id}`}
                    role="option"
                    aria-selected={on}
                    tabIndex={-1}
                    onMouseEnter={() => setIdx(flat.findIndex((x) => x.id === it.id))}
                    onClick={() => run(it)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        run(it)
                      }
                    }}
                    className={`cursor-pointer rounded-tanah-kendali px-2.5 py-2 dark:rounded-langit-kendali ${
                      on ? 'bg-tanah-terbenam dark:bg-langit-terbenam' : ''
                    }`}
                  >
                    <span className="block text-body-sm font-semibold break-words text-tanah-tinta dark:text-langit-tinta">
                      {it.label}
                    </span>
                    {it.sub && (
                      <span className="block text-caption break-words text-tanah-tinta-redup dark:text-langit-tinta-redup">
                        {it.sub}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-tanah-garis px-3 py-2 text-caption text-tanah-tinta-halus dark:border-langit-garis dark:text-langit-tinta-halus">
          <span>↑ ↓ pilih</span>
          <span>↵ jalankan</span>
          <span>Esc tutup</span>
        </div>
      </div>
    </div>
  )
}
