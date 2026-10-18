import EmptyState from './EmptyState'

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
    <span className={`inline-flex items-center gap-1.5 text-body font-semibold ${riskTone(level)}`}>
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
        <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">{label}</h3>
        <div className="flex items-baseline gap-2">
          <RiskBadge level={level} />
          {typeof score === 'number' && (
            <details className="text-caption text-ink-muted dark:text-mist-subtle">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Detail angka</summary>
              <span className="block tabular-nums">Skor model {score}/100</span>
            </details>
          )}
        </div>
      </div>
      {children}
    </div>
  )
}

export default function DisasterWarning({ disaster, dailyRainSum, tr = (k) => k }) {
  if (!disaster) {
    return <EmptyState title={tr('emptyWarning')} hint={tr('emptyHint')} />
  }
  const confidence = disaster.confidence
  const consensus = disaster.consensus
  const bmkg = disaster.bmkgNowcast

  return (
    <section
      aria-label="Peringatan dini cuaca dan bencana"
      className="bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-card p-5"
    >
      <div className="pb-3">
        <h2 className="text-body font-semibold tracking-tight text-ink dark:text-mist">
          Ada longsor di lereng kopi?
        </h2>
        <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">
          Hujan berlebih, guncangan gempa, dan tanah yang sudah jenuh.
        </p>
      </div>

      {/* F1 — badge konsensus multi-model (ADR-8) */}
      {consensus && (
        <div className="mb-3 py-3 border-y border-ink/10 dark:border-mist/10 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-body font-medium text-ink-body dark:text-mist-muted">Kecocokan prakiraan</span>
          <span className={`inline-flex items-center gap-1.5 text-body font-semibold ${CONSENSUS_TONE[consensus.level] || TONE.safe}`}>
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${consensus.level === 'tinggi' ? 'bg-cherry' : consensus.level === 'sedang' ? 'bg-husk' : 'bg-leaf'}`}
            />
            {String(consensus.level).charAt(0).toUpperCase() + String(consensus.level).slice(1)}
          </span>
          <span className="text-caption text-ink-muted dark:text-mist-subtle">
            {consensus.level === 'tinggi' ? 'Sejumlah prakiraan menunjukkan potensi hujan deras.' : 'Perkiraan hujan masih perlu dipantau.'}
          </span>
          <details className="basis-full text-caption text-ink-muted dark:text-mist-subtle">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Lihat jumlah sumber dan ambang hujan</summary>
            <p>{consensus.votes} dari {consensus.sources} model memperkirakan hujan deras (lebih dari 25 mm sehari).{consensus.degraded ? ' Sebagian data belum diperbarui.' : ''}</p>
          </details>
        </div>
      )}

      {/* F5 — peringatan resmi BMKG (ADR-10) */}
      {bmkg && (
        <div className="mb-3 rounded-card border border-ink/10 dark:border-mist/10 p-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-body font-semibold text-ink dark:text-mist">
              Peringatan Resmi BMKG
            </span>
            {!bmkg.active && (
              <span className="text-caption text-ink-muted dark:text-mist-subtle">Tidak ada peringatan resmi BMKG</span>
            )}
          </div>
          {bmkg.active && (bmkg.alerts || []).length > 0 && (
            <div className="mt-2 space-y-2">
              {bmkg.alerts.map((a, i) => (
                <div key={i}>
                  <p className="text-body font-medium text-husk-deep dark:text-husk-soft">{a.title}</p>
                  <p className="mt-0.5 text-caption leading-relaxed text-ink-muted dark:text-mist-muted line-clamp-4">
                    {a.description}
                  </p>
                  <p className="mt-0.5 font-data text-caption text-ink-subtle dark:text-mist-subtle tabular-nums">
                    {a.pubDate} — <a className="min-h-11 inline-flex items-center underline" href={a.link} target="_blank" rel="noreferrer">lihat peringatan BMKG</a>
                  </p>
                </div>
              ))}
            </div>
          )}
          <details className="mt-1.5 text-caption text-ink-subtle dark:text-mist-subtle">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Sumber dan waktu pembaruan</summary>
            <p className="mt-1">Sumber: {bmkg.source || 'BMKG'} · diperbarui {bmkg.retrievedAt}</p>
          </details>
        </div>
      )}

      {confidence && (
        <div className="mb-3 py-3 border-y border-ink/10 dark:border-mist/10 flex flex-wrap items-baseline gap-x-5 gap-y-1">
          <span className="text-body font-medium text-ink-body dark:text-mist-muted">Peluang hujan deras</span>
          <details className="basis-full text-caption text-ink-muted dark:text-mist-subtle">
            <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Lihat persentase dan metode prakiraan</summary>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
              {confidence.map((c) => (
                <span key={c.label} className="font-data text-body-sm text-ink-body dark:text-mist-body tabular-nums">
                  {c.label} <span className="font-semibold text-ink dark:text-mist">{c.prob}%</span>
                </span>
              ))}
              <span>Data berasal dari ensemble ECMWF (50 anggota).</span>
            </div>
          </details>
        </div>
      )}

      <div className="divide-y divide-ink/10 dark:divide-mist/10">
        <Row label="Potensi Tanah Longsor" item={disaster.landslide}>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-muted dark:text-mist-muted">
            Akumulasi hujan 24 jam: <span className="font-data text-ink-body dark:text-mist-body tabular-nums">{dailyRainSum} mm</span>
          </p>
          {(disaster.landslide?.detail || disaster.landslide?.ari) && (
            <details className="mt-1 text-caption text-ink-muted dark:text-mist-muted">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian hujan dan penilaian lereng</summary>
              {disaster.landslide?.detail && <p className="mt-1">{disaster.landslide.detail}</p>}
              {disaster.landslide?.ari && (
                <p className="mt-1">Hujan terkumpul sebelumnya: 24 jam {disaster.landslide.ari.ari24} mm / 72 jam {disaster.landslide.ari.ari72} mm. Metode: Antecedent Rainfall Index ({disaster.landslide.ari.source}).</p>
              )}
            </details>
          )}
        </Row>

        {/* F4 — riwayat kejadian terdokumentasi per sentra */}
        {disaster.disasterHistory?.count > 0 && (
          <div className="py-4">
            <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">Riwayat kejadian</h3>
            <p className="mt-1.5 text-caption text-ink-muted dark:text-mist-muted">
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
            <h3 className="text-body font-medium text-ink-body dark:text-mist-muted">Laporan warga</h3>
            <p className="mt-1.5 text-caption text-ink-muted dark:text-mist-muted">
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

        <Row label="Kondisi DAS Peusangan" item={disaster.das}>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-muted dark:text-mist-muted">
            Pemantauan hujan di hulu dan aliran sungai untuk membantu mengantisipasi luapan.
          </p>
          {disaster.das?.detail && (
            <details className="mt-1 text-caption text-ink-muted dark:text-mist-muted">
              <summary className="min-h-11 inline-flex cursor-pointer items-center underline underline-offset-2">Rincian pengukuran dan perkiraan</summary>
              <p className="mt-1">{disaster.das.detail}</p>
            </details>
          )}
        </Row>

        <Row label="Angin kencang" item={disaster.wind}>
          <p className="mt-1.5 text-caption leading-relaxed text-ink-muted dark:text-mist-muted">
            Waspada pohon pelindung kopi &amp; tebing jalan
          </p>
        </Row>
      </div>

      <div className="mt-4 pt-4 border-t border-ink/10 dark:border-mist/10 text-caption leading-relaxed text-ink-muted dark:text-mist-muted">
        <p>
          <strong className="font-medium text-husk-deep dark:text-husk-soft">Protokol mitigasi BPBD:</strong> jauhi
          lereng terjal jika hujan lebat berlangsung &gt;2 jam berturut-turut. Posko BPBD Aceh Tengah{' '}
          <span className="font-data text-ink-body dark:text-mist-body tabular-nums">112 / (0643) 21113</span>.
        </p>
        <p className="mt-1.5 text-ink-subtle dark:text-mist-subtle">
          Peringatan bersifat prakiraan probabilistik — verifikasi dengan kondisi lapangan.
        </p>
      </div>
    </section>
  )
}
