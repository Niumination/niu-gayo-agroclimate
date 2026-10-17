/**
 * P7.8 — ikonografi Niu.
 *
 * Satu bahasa bentuk untuk seluruh aplikasi: garis 24×24, tebal 1,7,
 * ujung membulat, `currentColor` (tanpa warna tetap) dan selalu dekoratif
 * (`aria-hidden`) karena nama bahaya/cuaca selalu ditulis sebagai teks.
 *
 * Warna diatur pemanggil dengan token dua tangga (mis. `text-tanah-aksen
 * dark:text-langit-aksen`) sehingga ikon tetap ≥ 3:1 terhadap permukaannya.
 */

const base = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
}

/** 11 bahaya yang dikenal registry (`HAZARD_IDS`). */
export const HAZARD_ICONS = {
  longsor: (
    <>
      <path d="M3 20h18" />
      <path d="M3 16.5 8.5 7l3.2 5.4 2.4-3.6L21 16.5" />
      <path d="M13.6 19.2l.9-1.6M16.8 19.4l1-1.8M19.6 19.1l.7-1.3" />
    </>
  ),
  banjir: (
    <>
      <path d="M3 9.5c2.2 0 2.2 1.6 4.4 1.6S9.6 9.5 11.8 9.5s2.2 1.6 4.4 1.6 2.2-1.6 4.8-1.6" />
      <path d="M3 14.4c2.2 0 2.2 1.6 4.4 1.6s2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.8-1.6" />
      <path d="M3 19.3c2.2 0 2.2 1.6 4.4 1.6s2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.8-1.6" />
    </>
  ),
  angin: (
    <>
      <path d="M3 8.5h9.2a2.6 2.6 0 1 0-2.6-2.6" />
      <path d="M3 13h13.4a2.7 2.7 0 1 1-2.7 2.7" />
      <path d="M3 17.5h6" />
    </>
  ),
  asap: (
    <>
      <path d="M3 8.2c2.4-2 3.6 2 6 0s3.6 2 6 0 3.6 2 6 0" />
      <path d="M3 13c2.4-2 3.6 2 6 0s3.6 2 6 0 3.6 2 6 0" />
      <path d="M3 17.8c2.4-2 3.6 2 6 0s3.6 2 6 0 3.6 2 6 0" />
    </>
  ),
  kebakaran: (
    <>
      <path d="M12 3.2c2.6 3.1 5.4 5.6 5.4 9.1a5.4 5.4 0 0 1-10.8 0c0-1.6.6-2.8 1.6-4 .3 1.2 1 2 2 2.3-.6-2.9.5-5.5 1.8-7.4Z" />
    </>
  ),
  kekeringan: (
    <>
      <circle cx="12" cy="8" r="3.4" />
      <path d="M12 1.6v1.5M12 12.9v1.5M5.3 8H3.7M20.3 8h-1.6M7.3 3.3 6.2 2.2M17.8 2.2l-1.1 1.1" />
      <path d="M3 20.4l3.4-3.2 3 2.6 3.2-3.4 3 2.8 3.4-3" />
    </>
  ),
  karat: (
    <>
      <path d="M20 4.4C11.4 4.6 5.2 7.2 5.2 13.1a5.2 5.2 0 0 0 5.2 5.2C16.2 18.3 19.4 11.6 20 4.4Z" />
      <path d="M5.8 19.4 18.2 6.6" />
      <circle cx="10.4" cy="12.6" r=".9" />
      <circle cx="13.8" cy="9.4" r=".9" />
    </>
  ),
  gempa: (
    <>
      <path d="M2.6 14.2h4l1.8-4.6 3 8 2.4-6 1.8 2.6h5.8" />
      <path d="M4 19.4h16" />
    </>
  ),
  vulkanik: (
    <>
      <path d="M3.4 19.6 9.2 9.4h5.6l5.8 10.2z" />
      <path d="M9.6 9.4c.4-1.4 1.2-2.2 2.4-2.8 1.2.6 2 1.4 2.4 2.8" />
      <path d="M12 6.6V3.4M9.6 3.8l-1-1.4M14.4 3.8l1-1.4" />
    </>
  ),
  badai: (
    <>
      <path d="M6.6 9.4a4 4 0 0 1 7.8-1.2 3.3 3.3 0 0 1 3.4 3.3 3.2 3.2 0 0 1-3.2 3.2H7.6a3.3 3.3 0 0 1-1-6.3Z" />
      <path d="M12.8 14.7 10 19.4h3l-1.4 3" />
    </>
  ),
  suhu: (
    <>
      <path d="M14.6 13.2V5.4a2.6 2.6 0 0 0-5.2 0v7.8a4.4 4.4 0 1 0 5.2 0Z" />
      <path d="M12 9.4v6.4" />
    </>
  ),
}

/** Enam keadaan cuaca untuk bilah jam-an. */
export const WEATHER_ICONS = {
  cerah: (
    <>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.4v2.2M12 19.4v2.2M2.4 12h2.2M19.4 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" />
    </>
  ),
  berawan: (
    <>
      <circle cx="9" cy="8.4" r="3.4" />
      <path d="M9 3.4v1.4M4.2 8.4H2.9M15.1 8.4h-1.3M5.6 5l-.9-.9M12.6 5l.9-.9" />
      <path d="M8.8 18.8h8.4a3.4 3.4 0 0 0 .6-6.7 4.4 4.4 0 0 0-8.4 1.2 3 3 0 0 0-.6 5.5Z" />
    </>
  ),
  mendung: (
    <path d="M7.4 18.6h9.2a3.7 3.7 0 0 0 .5-7.4 4.9 4.9 0 0 0-9.3 1.4 3.3 3.3 0 0 0-.4 6Z" />
  ),
  hujan: (
    <>
      <path d="M7.4 15.4h9.2a3.7 3.7 0 0 0 .5-7.4 4.9 4.9 0 0 0-9.3 1.4 3.3 3.3 0 0 0-.4 6Z" />
      <path d="M9 18.4l-.9 2M13 18.4l-.9 2M17 18.4l-.9 2" />
    </>
  ),
  petir: (
    <>
      <path d="M7.4 14.6h9.2a3.7 3.7 0 0 0 .5-7.4 4.9 4.9 0 0 0-9.3 1.4 3.3 3.3 0 0 0-.4 6Z" />
      <path d="M13.2 13.4 10.6 18h2.6l-1.2 2.8" />
    </>
  ),
  kabut: (
    <>
      <path d="M4 9.4h11.6M8 13h12M5.4 16.6h11.2M9.6 20h8" />
    </>
  ),
}

export const HAZARD_ICON_IDS = Object.keys(HAZARD_ICONS)
export const WEATHER_ICON_IDS = Object.keys(WEATHER_ICONS)

/** Ikon bahaya; tak dikenal → ikon tanda seru netral. */
export function HazardIcon({ id, className = 'h-5 w-5' }) {
  const path = HAZARD_ICONS[id] ?? (
    <>
      <circle cx="12" cy="12" r="8.6" />
      <path d="M12 8v5M12 16.2v.1" />
    </>
  )
  return (
    <svg {...base} className={className} data-hazard-icon={HAZARD_ICONS[id] ? id : 'lain'}>
      {path}
    </svg>
  )
}

/** Ikon cuaca; tak dikenal → ikon kabut netral. */
export function WeatherIcon({ name, className = 'h-6 w-6' }) {
  const path = WEATHER_ICONS[name] ?? WEATHER_ICONS.kabut
  return (
    <svg {...base} className={className} data-weather-icon={WEATHER_ICONS[name] ? name : 'kabut'}>
      {path}
    </svg>
  )
}
