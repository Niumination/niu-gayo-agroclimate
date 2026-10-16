import { contactsFor } from '../data/contacts.js'
import sentraKecamatan from '../data/hazards/sentraKecamatan.json'

/**
 * FR-X-4 — kontak darurat terpusat (src/data/contacts.js): hanya nomor terverifikasi yang ditampilkan; tautan tel:.
 * `hazard` = id bahaya aktif tertinggi (untuk menyaring kontak khusus, mis. Halo Kemenkes saat asap).
 */
export default function EmergencyContacts({ location, hazard = '*' }) {
  const kecId = sentraKecamatan?.sentra?.[location?.id]?.kecamatan ?? location?.id
  const list = contactsFor(hazard, kecId)
  if (!list.length) return null
  const seen = new Set()
  const unique = list.filter((c) => (seen.has(c.phone + c.name) ? false : (seen.add(c.phone + c.name), true)))
  return (
    <section aria-label="Kontak darurat" className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5">
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">Kontak darurat</h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Hubungi 112 untuk semua keadaan darurat; nomor lain untuk koordinasi & informasi.</p>
      </div>
      <ul className="divide-y divide-ink/10 dark:divide-mist/10">
        {unique.map((c) => (
          <li key={c.id} className="py-2.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-body text-ink-body dark:text-mist-body break-words">{c.name}</p>
              <p className="text-caption text-ink-muted dark:text-mist-subtle">{c.scope}{c.alt ? ` · alt. ${c.alt}` : ''}</p>
            </div>
            <a href={`tel:${String(c.phone).replace(/[^\d+]/g, '')}`} className="shrink-0 min-h-11 inline-flex items-center px-3 rounded-lg border border-ink/15 dark:border-mist/15 font-data text-body text-ink dark:text-mist hover:border-ink/40 dark:hover:border-mist/40 tabular-nums">
              {c.phone}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-caption text-ink-muted dark:text-mist-subtle">Nomor Puskesmas/posko kecamatan ditampilkan setelah diverifikasi (tugas manusia H-5). Koreksi: lihat “Tentang data &amp; batasan”.</p>
    </section>
  )
}
