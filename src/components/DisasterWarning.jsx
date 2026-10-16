import React from 'react'

// Palet risiko mengikuti token Stasiun Cuaca Kebun (tone AA per tema).
const TONE = {
  danger: 'text-level-bahaya dark:text-level-bahaya-dark',
  warn: 'text-level-waspada dark:text-level-waspada-dark',
  safe: 'text-level-rendah dark:text-level-rendah-dark',
}

// F1 (ADR-8): warna badge konsensus — tinggi=cherry, sedang=husk, rendah=leaf.
const CONSENSUS_TONE = {
  tinggi: TONE.danger,
  sedang: TONE.warn,
  rendah: TONE.safe,
}

function riskTone(level) {
  const l = String(level || '').toLowerCase()
  if (l.includes('bahaya') || l.includes('tinggi')) return TONE.danger
  if (l.includes('waspada') || l.includes('sedang')) return TONE.warn
  return TONE.safe
}

// Badge titik warna + teks (bukan kartu berwarna).
function RiskBadge({ level }) {
  const l = String(level || '').toLowerCase()
  const dot = l.includes('bahaya') || l.includes('tinggi') ? 'bg-cherry' : l.includes('waspada') || l.includes('sedang') ? 'bg-husk' : 'bg-leaf'
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${riskTone(level)}`}>
      <span aria-hidden="true" className={`w-2 h-2 rounded-full ${dot}`} />
      {level}
    </span>
  )
}

function Row({ label, item, children }) {
  const level = item?.level ?? item?.risk ?? 'Rendah'
  const score = item?.score
  return (
    <div className="py-4 first:pt-0">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h3 className="text-[13px] font-medium text-ink-body dark:text-mist-muted">{label}</h3>
        <div className="flex items-baseline gap-2">
          <RiskBadge level={level} />
          {typeof score === 'number' && (
            <span className="font-data text-[11px] text-ink-muted dark:text-mist-subtle">{score}/100</span>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function DisasterWarning({ disaster, dailyRainSum, location }) {
  if (!disaster) return null
  const confidence = disaster.confidence
  const consensus = disaster.consensus
  const bmkg = disaster.bmkgNowcast
  const ari = disaster.landslide?.antecedentSource

  return (
    <section
      aria-label="Sistem Peringatan Dini Bencana Hidrometeorologi"
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3">
        <h2 className="text-sm font-semibold tracking-tight text-ink dark:text-mist">
          Sistem Peringatan Dini Bencana Hidrometeorologi
        </h2>
        <p className="text-[13px] text-ink-muted dark:text-mist-muted mt-0.5">
          Mitigasi risiko longsor lereng kopi &amp; indeks hujan DAS Peusangan
        </p>
      </div>

      {/* F1 — badge konsensus multi-model (ADR-8) */}
      {consensus && (
        <div className="mb-3 py-3 border-y border-ink/10 dark:border-mist/10 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-[13px] font-medium text-ink-body dark:text-mist-muted">Konsensus model</span>
          <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${CONSENSUS_TONE[consensus.level] || TONE.safe}`}>
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${consensus.level === 'tinggi' ? 'bg-cherry' : consensus.level === 'sedang' ? 'bg-husk' : 'bg-leaf'}`}
            />
            {String(consensus.level).charAt(0).toUpperCase() + String(consensus.level).slice(1)}
          </span>
          <span className="font-data text-[11px] text-ink-muted dark:text-mist-subtle">
            {consensus.votes}/{consensus.sources} model setuju hujan &gt; 25 mm/24j
            {consensus.degraded ? ' (degraded)' : ''}
          </span>
        </div>
      )}

      {/* F5 — peringatan resmi BMKG (ADR-10) */}
      {bmkg && (
        <div className="mb-3 rounded-card border border-ink/10 dark:border-mist/10 p-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[13px] font-semibold text-ink dark:text-mist">
              Peringatan Resmi BMKG
            </span>
            {!bmkg.active && (
              <span className="text-[11px] text-ink-muted dark:text-mist-subtle">Tidak ada peringatan resmi BMKG</span>
            )}
          </div>
          {bmkg.active && (bmkg.alerts || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {bmkg.alerts.map((a, i) => (
                <div key={i}>
                  <p className="text-[13px] font-medium text-husk-deep dark:text-husk-soft">{a.title}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted dark:text-mist-muted line-clamp-4">
                    {a.description}
                  </p>
                  <p className="mt-0.5 font-data text-[10px] text-ink-subtle dark:text-mist-subtle">
                    {a.pubDate} — <a className="underline" href={a.link} target="_blank" rel="noreferrer">detail CAP BMKG</a>
                  </p>
                </div>
              ))}
            </div>
          )}
          <p className="mt-1.5 text-[10px] text-ink-subtle dark:text-mist-subtle">
            Sumber: {bmkg.source || 'data.bmkg.go.id'} · diambil {bmkg.retrievedAt}
          </p>
        </div>
      )}

      {confidence && (
        <div className="mb-3 py-3 border-y border-ink/10 dark:border-mist/10 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-[13px] font-medium text-ink-body dark:text-mist-muted">
            Keyakinan ensemble <span className="text-ink-muted dark:text-mist-subtle">(ECMWF 50 member)</span>
          </span>
          {confidence.map((c) => (
            <span key={c.label} className="font-data text-[13px] text-ink-body dark:text-mist-body">
              {c.label} <span className="font-semibold text-ink dark:text-mist">{c.prob}%</span>
            </span>
          ))}
        </div>
      )}

      <div className="divide-y divide-ink/10 dark:divide-mist/10">
        <Row label="Potensi Tanah Longsor" item={disaster.landslide}>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted dark:text-mist-muted">
            Akumulasi hujan 24 jam <span className="font-data text-ink-body dark:text-mist-body">{dailyRainSum} mm</span>
            {disaster.landslide?.detail ? ` — ${disaster.landslide.detail}` : ''}
          </p>
          {/* F2 — ARI 24/72 jam di panel longsor (ADR-9) */}
          {disaster.landslide?.ari && (
            <p className="mt-1 text-[11px] text-ink-muted dark:text-mist-muted">
              Antecedent Rainfall Index{' '}
              <span className="font-data text-ink-body dark:text-mist-body">
                24j {disaster.landslide.ari.ari24} mm / 72j {disaster.landslide.ari.ari72} mm
              </span>{' '}
              <span className="text-ink-subtle dark:text-mist-subtle">({disaster.landslide.ari.source})</span>
            </p>
          )}
        </Row>

        {/* F4 — riwayat kejadian terdokumentasi per sentra */}
        {disaster.disasterHistory?.count > 0 && (
          <div className="py-4">
            <h3 className="text-[13px] font-medium text-ink-body dark:text-mist-muted">Riwayat kejadian</h3>
            <p className="mt-1.5 text-[11px] text-ink-muted dark:text-mist-muted">
              {disaster.disasterHistory.count} kejadian tercatat · terakhir:{' '}
              <span className="font-medium text-ink-body dark:text-mist-body">
                {disaster.disasterHistory.lastEvents[0].type}{' '}
                {disaster.disasterHistory.lastEvents[0].date.slice(0, 4)}
              </span>
            </p>
          </div>
        )}

        {/* F8 — laporan warga 7 hari terakhir */}
        {disaster.communityReports?.count > 0 && (
          <div className="py-4">
            <h3 className="text-[13px] font-medium text-ink-body dark:text-mist-muted">Laporan warga</h3>
            <p className="mt-1.5 text-[11px] text-ink-muted dark:text-mist-muted">
              {disaster.communityReports.count} laporan 7 hari terakhir
              {disaster.communityReports.reports[0] && (
                <>
                  {' '}· terakhir:{' '}
                  <span className="font-medium text-ink-body dark:text-mist-body">
                    {disaster.communityReports.reports[0].type}
                  </span>
                </>
              )}
            </p>
          </div>
        )}

        <Row label="Indeks Hujan DAS Peusangan" item={disaster.das}>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted dark:text-mist-muted">
            {disaster.das?.detail || 'Rata-rata berbobot lokasi hulu (Bintang, Lut Tawar, Kebayakan, Silih Nara)'}
          </p>
        </Row>

        <Row label="Angin (wind_gusts_10m)" item={disaster.wind}>
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted dark:text-mist-muted">
            Waspada pohon pelindung kopi &amp; tebing jalan
          </p>
        </Row>
      </div>

      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 text-[11px] leading-relaxed text-ink-muted dark:text-mist-muted">
        <p>
          <strong className="font-medium text-husk-deep dark:text-husk-soft">Protokol mitigasi BPBD:</strong> jauhi
          lereng terjal jika hujan lebat berlangsung &gt;2 jam berturut-turut. Posko BPBD Aceh Tengah{' '}
          <span className="font-data text-ink-body dark:text-mist-body">112 / (0643) 21113</span>.
        </p>
        <p className="mt-1.5 text-ink-subtle dark:text-mist-subtle">
          Peringatan bersifat prakiraan probabilistik — verifikasi dengan kondisi lapangan.
        </p>
      </div>
    </section>
  )
}
