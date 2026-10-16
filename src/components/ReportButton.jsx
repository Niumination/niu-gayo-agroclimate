import React, { useEffect, useRef, useState } from 'react'

// F8 — tombol 'Lapor kejadian' + modal form (bukan PII).
// Aksesibilitas: focus trap sederhana, Esc menutup, label eksplisit, fokus awal di select.
const TYPES = [
  { value: 'longsor', label: 'Tanah longsor' },
  { value: 'banjir', label: 'Banjir / banjir bandang' },
  { value: 'angin', label: 'Angin kencang' },
  { value: 'karat', label: 'Karat daun kopi' },
  // v2 Fase 1 (FR-ASAP-6): kabut asap (skala jarak pandang + bau) & kebakaran lahan/hutan
  { value: 'asap', label: 'Kabut asap' },
  { value: 'kebakaran', label: 'Kebakaran lahan / hutan' },
  // Sprint 3 (FR-X-5): kekeringan (tanda di lapangan) & badai konvektif (sub-jenis)
  { value: 'kekeringan', label: 'Kekeringan / sumber air surut' },
  { value: 'badai', label: 'Badai: petir / hujan es / puting beliung' },
  // Fase 2.2b (FR-VULK-4): hujan abu & bau belerang (Burni Telong)
  { value: 'abu', label: 'Hujan abu vulkanik' },
  { value: 'gas', label: 'Bau belerang / gas vulkanik' },
  // Fase 2.1 (FR-GEMPA-5): gempa dirasakan (skala awam → MMI)
  { value: 'gempa', label: 'Gempa dirasakan' },
]
// Sub-pilihan generik per tipe (field `kind`)
const KIND_OPTIONS = {
  badai: { label: 'Jenis badai', options: [
    { value: 'petir', label: 'Petir / kilat sangat dekat' },
    { value: 'hujan_es', label: 'Hujan es' },
    { value: 'puting_beliung', label: 'Puting beliung / angin puyuh' },
  ] },
  abu: { label: 'Ketebalan abu', options: [
    { value: 'tipis', label: 'Tipis — debu di daun / kendaraan' },
    { value: 'tebal', label: 'Tebal — jarak pandang turun, atap tertutup' },
  ] },
  gas: { label: 'Kekuatan bau', options: [
    { value: 'ringan', label: 'Ringan — tercium sesekali' },
    { value: 'menyengat', label: 'Menyengat — mata / tenggorokan perih' },
  ] },
  gempa: { label: 'Seberapa kuat terasa?', options: [
    { value: 'lemah', label: 'Lemah — sebagian orang merasakan, lampu gantung bergoyang' },
    { value: 'sedang', label: 'Sedang — banyak orang terbangun, barang jatuh' },
    { value: 'kuat', label: 'Kuat — orang berlarian keluar, dinding retak' },
  ] },
}
const DROUGHT_SIGNS = [
  { value: 'sumur_kering', label: 'Sumur / mata air mengering' },
  { value: 'daun_layu', label: 'Daun kopi layu / gugur' },
  { value: 'sungai_surut', label: 'Sungai / irigasi surut' },
]
const VISIBILITY = [
  { value: '>5km', label: 'Jarak pandang > 5 km (tipis)' },
  { value: '1-5km', label: 'Jarak pandang 1–5 km (sedang)' },
  { value: '<1km', label: 'Jarak pandang < 1 km (pekat)' },
]
const PLACEHOLDER = {
  asap: 'cth: asap sejak pagi, bau menyengat, anak-anak batuk',
  kebakaran: 'cth: api di semak dekat kebun, arah angin ke kampung',
  kekeringan: 'cth: sumur kampung tinggal 1 m, bibit baru tanam mulai layu',
  badai: 'cth: hujan es sebesar kelereng ±10 menit, atap seng beterbangan',
  abu: 'cth: abu tipis di daun kopi sejak subuh, arah dari Burni Telong',
  gas: 'cth: bau belerang kuat di lembah saat mendung, beberapa warga pusing',
  gempa: 'cth: terasa ±5 detik pukul 03.10, piring bergetar, tidak ada kerusakan',
}

export default function ReportButton({ location, onSubmitted, className = '' }) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('longsor')
  const [note, setNote] = useState('')
  const [visibility, setVisibility] = useState('1-5km')
  const [smell, setSmell] = useState(false)
  const [active, setActive] = useState(true)
  const [kind, setKind] = useState('petir')
  useEffect(() => {
    const opts = KIND_OPTIONS[type]?.options
    if (opts && !opts.some((o) => o.value === kind)) setKind(opts[0].value)
  }, [type]) // eslint-disable-line react-hooks/exhaustive-deps
  const [signs, setSigns] = useState([])
  const [status, setStatus] = useState(null) // 'sending' | 'ok' | 'error'
  const dialogRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
      if (e.key === 'Tab' && dialogRef.current) {
        const els = dialogRef.current.querySelectorAll('button, select, textarea, input')
        if (!els.length) return
        const first = els[0]
        const last = els[els.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    dialogRef.current?.querySelector('select')?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const submit = async (e) => {
    e.preventDefault()
    setStatus('sending')
    try {
      const base = (import.meta.env.BASE_URL || '/agroclimate/').replace(/\/$/, '')
      const res = await fetch(`${base}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location: location.id,
          type,
          note,
          ...(type === 'asap' ? { visibility, smell } : {}),
          ...(type === 'kebakaran' ? { active } : {}),
          ...(KIND_OPTIONS[type] ? { kind } : {}),
          ...(type === 'kekeringan' ? { signs } : {}),
        }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setStatus('ok')
      setNote('')
      setTimeout(() => {
        setOpen(false)
        setStatus(null)
        onSubmitted?.()
      }, 1200)
    } catch {
      setStatus('error')
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setStatus(null); setOpen(true) }}
        className={`inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-card border border-ink/15 dark:border-mist/15 text-body font-medium text-ink dark:text-mist hover:bg-ink/5 dark:hover:bg-mist/10 transition-colors ${className}`}
      >
        <span aria-hidden="true">⚠</span> Lapor kejadian
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="w-full max-w-md bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
          >
            <h2 id="report-title" className="text-body font-semibold text-ink dark:text-mist">
              Lapor kejadian — {location.name}
            </h2>
            <p className="mt-1 text-caption text-ink-muted dark:text-mist-muted">
              Laporan diteruskan ke koordinator BPBD. Tidak ada data pribadi yang dikumpulkan.
              {type === 'kebakaran' && <strong className="block mt-1 text-cherry-deep dark:text-cherry-soft">Api besar/mengancam rumah: hubungi Damkar 113 / BPBD lebih dulu.</strong>}
            </p>
            <form onSubmit={submit} className="mt-4 space-y-3">
              <div>
                <label htmlFor="report-type" className="block text-body font-medium text-ink-body dark:text-mist-muted">
                  Jenis kejadian
                </label>
                <select
                  id="report-type"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                  className="mt-1 w-full min-h-[44px] rounded-md border border-ink/15 dark:border-mist/15 bg-transparent px-3 text-body text-ink dark:text-mist"
                >
                  {TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              {type === 'asap' && (
                <>
                  <div>
                    <label htmlFor="report-visibility" className="block text-body font-medium text-ink-body dark:text-mist-muted">
                      Seberapa pekat asapnya?
                    </label>
                    <select
                      id="report-visibility"
                      value={visibility}
                      onChange={(e) => setVisibility(e.target.value)}
                      className="mt-1 w-full min-h-[44px] rounded-md border border-ink/15 dark:border-mist/15 bg-transparent px-3 text-body text-ink dark:text-mist"
                    >
                      {VISIBILITY.map((v) => (
                        <option key={v.value} value={v.value}>{v.label}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-caption text-ink-muted dark:text-mist-muted">
                      Patokan: bukit/menara yang biasanya terlihat jelas tidak tampak = &lt; 1 km.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 min-h-[44px] text-body text-ink-body dark:text-mist-body">
                    <input type="checkbox" checked={smell} onChange={(e) => setSmell(e.target.checked)} className="w-4 h-4" />
                    Bau asap menyengat / mata perih
                  </label>
                </>
              )}
              {type === 'kebakaran' && (
                <label className="flex items-center gap-2 min-h-[44px] text-body text-ink-body dark:text-mist-body">
                  <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
                  Api masih menyala saat ini
                </label>
              )}
              {KIND_OPTIONS[type] && (
                <div>
                  <label htmlFor="report-kind" className="block text-body font-medium text-ink-body dark:text-mist-muted">
                    {KIND_OPTIONS[type].label}
                  </label>
                  <select
                    id="report-kind"
                    value={kind}
                    onChange={(e) => setKind(e.target.value)}
                    className="mt-1 w-full min-h-[44px] rounded-lg border border-ink/15 dark:border-mist/15 bg-transparent px-3 text-body text-ink dark:text-mist"
                  >
                    {KIND_OPTIONS[type].options.map((k) => (
                      <option key={k.value} value={k.value}>{k.label}</option>
                    ))}
                  </select>
                </div>
              )}
              {type === 'kekeringan' && (
                <fieldset>
                  <legend className="text-body font-medium text-ink-body dark:text-mist-muted">Tanda yang terlihat</legend>
                  {DROUGHT_SIGNS.map((d) => (
                    <label key={d.value} className="flex items-center gap-2 min-h-11 text-body text-ink-body dark:text-mist-body">
                      <input
                        type="checkbox"
                        checked={signs.includes(d.value)}
                        onChange={(e) => setSigns(e.target.checked ? [...signs, d.value] : signs.filter((x) => x !== d.value))}
                        className="w-4 h-4"
                      />
                      {d.label}
                    </label>
                  ))}
                </fieldset>
              )}
              <div>
                <label htmlFor="report-note" className="block text-body font-medium text-ink-body dark:text-mist-muted">
                  Catatan (opsional)
                </label>
                <textarea
                  id="report-note"
                  rows={3}
                  maxLength={500}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder={PLACEHOLDER[type] || 'cth: longsor kecil di jalur kebun, hujan deras sejak sore'}
                  className="mt-1 w-full rounded-md border border-ink/15 dark:border-mist/15 bg-transparent px-3 py-2 text-body text-ink dark:text-mist"
                />
              </div>
              {status === 'ok' && (
                <p role="status" className="text-body text-leaf-deep dark:text-leaf-soft">Laporan terkirim — terima kasih.</p>
              )}
              {status === 'error' && (
                <p role="alert" className="text-body text-cherry-deep dark:text-cherry-soft">
                  Gagal mengirim (kemungkinan batas 5 laporan/jam). Coba lagi nanti.
                </p>
              )}
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="min-h-[44px] px-4 rounded-card text-body text-ink-body dark:text-mist-muted hover:bg-ink/5 dark:hover:bg-mist/10"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={status === 'sending' || status === 'ok'}
                  className="min-h-[44px] px-4 inline-flex items-center gap-2 rounded-card bg-leaf text-white text-body font-medium disabled:opacity-50"
                >
                  {status === 'sending' ? (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true" focusable="false" className="motion-safe:animate-spin">
                        <path d="M12 3a9 9 0 1 0 9 9" />
                      </svg>
                      Mengirim…
                    </>
                  ) : (
                    'Kirim laporan'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
