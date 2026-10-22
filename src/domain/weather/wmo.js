/**
 * Pemetaan kode cuaca WMO (Open-Meteo `weather_code`) → enam glyph Niu.
 *
 * Glyph diambil dari `src/icons/index.jsx` (`WEATHER_ICONS`) supaya bahasa
 * bentuknya sama dengan seluruh aplikasi: grid 24, tebal 1,7, `currentColor`.
 * Kode WMO lengkap (0–99) dipetakan ke enam kelompok yang benar-benar berbeda
 * di layar; tidak ada glyph ketujuh agar legenda tetap mudah dihafal.
 *
 * Catatan: WMO 71–77/85–86 adalah salju. Tanah Gayo di atas 1.200 mdpl bisa
 * mengalaminya sesekali; karena tidak ada glyph salju, kelompok itu memakai
 * glyph hujan (presipitasi) dan label "Hujan" — bukan "Salju" — agar tidak
 * menjanjikan ketepatan yang tidak dimiliki ikonnya.
 */

export const WEATHER_GLYPHS = {
  cerah: { name: 'cerah', labelKey: 'wcClear' },
  berawan: { name: 'berawan', labelKey: 'wcPartly' },
  mendung: { name: 'mendung', labelKey: 'wcCloudy' },
  hujan: { name: 'hujan', labelKey: 'wcRain' },
  petir: { name: 'petir', labelKey: 'wcThunder' },
  kabut: { name: 'kabut', labelKey: 'wcFog' },
}

/** Kode WMO → nama glyph. Nilai tak dikenal/kosong jatuh ke "mendung". */
export function weatherGlyphForCode(code) {
  if (code === null || code === undefined || code === '') return 'mendung'
  const value = Number(code)
  if (!Number.isFinite(value)) return 'mendung'
  if (value === 0) return 'cerah'
  if (value === 1 || value === 2) return 'berawan'
  if (value === 3) return 'mendung'
  if (value === 45 || value === 48) return 'kabut'
  if (value === 95 || value === 96 || value === 99) return 'petir'
  if (
    (value >= 51 && value <= 67) ||
    (value >= 71 && value <= 77) ||
    (value >= 80 && value <= 86)
  ) {
    return 'hujan'
  }
  return 'mendung'
}

/** Kunci i18n label untuk sebuah glyph. */
export function weatherLabelKey(name) {
  return (WEATHER_GLYPHS[name] ?? WEATHER_GLYPHS.mendung).labelKey
}
