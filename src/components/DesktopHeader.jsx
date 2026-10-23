import { useEffect, useState } from 'react'
import { ChevronDown, Info, MapPin, Moon, RefreshCw, Share2, Sun } from 'lucide-react'
import ShareButton from './ShareButton.jsx'
import DistrictSelector from './DistrictSelector.jsx'
import NiuMark from './niu/NiuMark.jsx'
import { dataFreshness } from '../lib/dataFreshness.js'

const updatedTime = (value) => {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jakarta',
  })
}

/** Kepala desktop: identitas, pilihan sentra terkontrol, status data, dan kontrol utama. */
export default function DesktopHeader({
  lastUpdated,
  selectedLocation,
  onSelectLocation,
  hazards,
  onAbout,
  onRefresh,
  loading,
  theme,
  isAuto,
  onToggleTheme,
  onResetTheme,
  age,
  tr,
  locationPickerOpen = false,
  onOpenLocationPicker,
  onCloseLocationPicker,
  shareOpen,
  onShareOpenChange,
  live = false,
}) {
  // U2 — chip kesegaran hanya untuk Living Map (`live`). Umur data ikut berjalan
  // tanpa memuat ulang: satu ticker 15 detik, bukan polling data.
  const [drift, setDrift] = useState(0)
  useEffect(() => {
    if (!live || !age) {
      setDrift(0)
      return undefined
    }
    const started = Date.now()
    const id = window.setInterval(() => {
      setDrift(Math.floor((Date.now() - started) / 60_000))
    }, 15_000)
    return () => window.clearInterval(id)
  }, [live, age])

  const minutes = age && Number.isFinite(age.minutes) ? age.minutes + drift : null
  const freshness = live && minutes != null ? dataFreshness(minutes) : null
  const ageLabel = freshness ? freshness.label : age?.label
  const currentDirection = theme === 'dark' ? 'Langit' : 'Tanah'
  const nextDirection = theme === 'dark' ? 'Tanah' : 'Langit'
  const locationLabel = selectedLocation?.name ?? 'Pilih sentra'
  const elevation = selectedLocation?.elevation?.toLocaleString('id-ID')

  return (
    <>
      <header className="niu-header niu-header-desktop sticky top-0 z-40 pt-[env(safe-area-inset-top)]" data-niu-header="desktop">
        <div className="niu-header-main niu-header-inner">
          <div className="niu-brand" aria-label="Niu · Tanah Gayo">
            <NiuMark />
            <span className="niu-brand-copy">
              <strong>Niu</strong>
              <small>Gayo Agro-Climate</small>
            </span>
          </div>

          <div className="niu-desktop-location">
            <button
              type="button"
              onClick={onOpenLocationPicker}
              aria-haspopup="dialog"
              title="Pilih sentra"
              className="niu-location-select niu-location-trigger min-h-11 w-full text-left active:scale-[.99]"
            >
              <MapPin className="niu-location-icon" aria-hidden="true" />
              {/* Audit F-07 — nama aksesibel dibangun dari teks yang terlihat (axe
                  label-content-name-mismatch): "Pilih sentra" ditambahkan sebagai teks
                  tersembunyi, bukan aria-label yang tidak memuat seluruh teks tampak. */}
              <span className="sr-only">Pilih sentra; saat ini </span>
              <span className="niu-location-trigger-copy min-w-0 flex-1">
                <strong>{locationLabel}</strong>
                {selectedLocation && (
                  <small>{elevation} {tr('mdpl')} · {selectedLocation.type}</small>
                )}
              </span>
              <ChevronDown className="niu-location-chevron" aria-hidden="true" />
            </button>
          </div>

          {age && (
            <span
              className={`niu-age ${age.stale ? 'is-stale' : 'is-fresh'}${freshness?.tier === 'fresh' ? ' niu-age--live' : ''}`}
              data-freshness={freshness?.tier}
              aria-live="polite"
              title={freshness?.note ? `Data ${ageLabel} — ${freshness.note}` : undefined}
            >
              <span aria-hidden="true" className="niu-age-dot" />
              {ageLabel}
              {freshness?.note && <span className="niu-age-note"> · {freshness.note}</span>}
            </span>
          )}
          {lastUpdated && <span className="niu-updated">Diperbarui {updatedTime(lastUpdated)} WIB</span>}

          <div className="niu-header-actions">
            <ShareButton
              hazards={hazards}
              location={selectedLocation}
              tr={tr}
              compact
              open={shareOpen}
              onOpenChange={onShareOpenChange}
              icon={<Share2 aria-hidden="true" />}
              buttonClassName="niu-icon-control niu-share-control min-h-11 min-w-11 active:scale-[.97]"
            />
            <button
              type="button"
              onClick={onToggleTheme}
              onDoubleClick={isAuto ? undefined : onResetTheme}
              aria-label={`Ganti ke mode ${nextDirection}`}
              title={`Mode ${currentDirection} aktif · ketuk untuk ${nextDirection}`}
              className="niu-icon-control min-h-11 min-w-11 active:scale-[.97]"
            >
              {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={onRefresh}
              disabled={loading}
              aria-label={loading ? tr('refreshing') : tr('refresh')}
              title={loading ? tr('refreshing') : tr('refresh')}
              className="niu-icon-control min-h-11 min-w-11 active:scale-[.97]"
            >
              <RefreshCw aria-hidden="true" className={loading ? 'animate-spin' : ''} />
            </button>
            <button type="button" onClick={onAbout} aria-label="Tentang data dan batasan" title="Tentang data" className="niu-icon-control min-h-11 min-w-11 active:scale-[.97]">
              <Info aria-hidden="true" />
            </button>
          </div>
        </div>
      </header>
      <DistrictSelector
        open={locationPickerOpen}
        onClose={onCloseLocationPicker}
        selectedLocation={selectedLocation}
        onSelectLocation={onSelectLocation}
        tr={tr}
      />
    </>
  )
}
