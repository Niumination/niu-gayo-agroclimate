import { ChevronDown, MapPin, Moon, RefreshCw, Sun } from 'lucide-react'
import DistrictSelector from './DistrictSelector.jsx'
import NiuMark from './niu/NiuMark.jsx'

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

/** Kepala ponsel mengikuti prototipe v4: arah, sentra dalam modal, dan muat ulang. */
export default function AppBar({
  selectedLocation,
  onSelectLocation,
  lastUpdated,
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
}) {
  const ageTone = age?.stale ? 'is-stale' : 'is-fresh'
  const currentDirection = theme === 'dark' ? 'Langit' : 'Tanah'
  const nextDirection = theme === 'dark' ? 'Tanah' : 'Langit'
  const locationLabel = selectedLocation?.name ?? 'Pilih sentra'
  const elevation = selectedLocation?.elevation?.toLocaleString('id-ID')

  return (
    <>
      <header className="niu-header niu-header-mobile sticky top-0 z-40 pt-[env(safe-area-inset-top)]" data-niu-header="mobile">
        <div className="niu-header-main min-w-0">
          <div className="niu-brand" aria-label="Niu · Tanah Gayo">
            <NiuMark />
            <span className="niu-brand-copy">
              <strong>Niu</strong>
              <small>Gayo</small>
            </span>
          </div>

          {age && (
            <span className={`niu-age ${ageTone}`} aria-live="polite">
              <span aria-hidden="true" className="niu-age-dot" />
              {age.label}
            </span>
          )}

          <div className="niu-header-actions">
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
              onClick={onOpenLocationPicker}
              aria-label={`Pilih sentra; saat ini ${locationLabel}`}
              title="Pilih sentra"
              aria-haspopup="dialog"
              className="niu-icon-control min-h-11 min-w-11 active:scale-[.97]"
            >
              <MapPin aria-hidden="true" />
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
          </div>
        </div>

        <div className="niu-location-row">
          <button
            type="button"
            onClick={onOpenLocationPicker}
            aria-haspopup="dialog"
            aria-label={`Pilih sentra. ${locationLabel}, ${elevation ?? ''} ${tr('mdpl')}, ${selectedLocation?.type ?? ''}`}
            className="niu-location-button min-h-11 min-w-0 active:scale-[.97]"
          >
            <MapPin className="niu-location-icon" aria-hidden="true" />
            <span className="niu-location-copy min-w-0">
              <strong>{locationLabel}</strong>
              {selectedLocation && (
                <span>{elevation} {tr('mdpl')} · {selectedLocation.type}</span>
              )}
            </span>
            <ChevronDown className="niu-location-chevron" aria-hidden="true" />
          </button>
          {lastUpdated && (
            <span className="niu-updated">
              Diperbarui {updatedTime(lastUpdated)} WIB
            </span>
          )}
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
