/**
 * P7.4 — bilah 12 jam untuk beranda mobile.
 *
 * Berbeda dari `HourlyForecast` (grid 3 kolom di tab Ramalan), bilah ini
 * meniru "strip" instrumen: kisi rapat tanpa gulir mendatar (semua jam terlihat),
 * tinggi tetap, angka besar, dan penanda jam pertama = sekarang.
 *
 * Aturan:
 * - Setiap jam adalah `<li>` dengan teks lengkap (jam, suhu, hujan) — bukan grafik
 *   tanpa label; batang hujan dekoratif (`aria-hidden`).
 * - Tidak memakai `truncate`; label boleh membungkus di layar 320 px.
 */

const r1 = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(1).replace('.', ','))
const r0 = (v) => (v == null || Number.isNaN(Number(v)) ? '—' : String(Math.round(Number(v))))

export default function HourStrip({
  hours = [],
  title = '12 jam ke depan',
  sub = 'Suhu, hujan, dan terpaan angin per jam',
  className = '',
}) {
  if (!Array.isArray(hours) || hours.length === 0) return null
  const maxRain = Math.max(0.5, ...hours.map((h) => Number(h.rain) || 0))

  return (
    <section
      aria-labelledby="hourstrip-title"
      className={`rounded-tanah-kartu border border-tanah-garis bg-tanah-kartu p-4 dark:rounded-langit-kartu dark:border-langit-garis dark:bg-langit-kartu ${className}`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2
          id="hourstrip-title"
          className="text-body font-semibold leading-snug break-words text-tanah-tinta dark:text-langit-tinta"
        >
          {title}
        </h2>
        <p className="text-caption text-tanah-tinta-redup dark:text-langit-tinta-redup">{sub}</p>
      </div>

      <ol className="mt-3 grid grid-cols-4 gap-1 min-[380px]:grid-cols-6">
          {hours.map((h, i) => {
            const rain = Number(h.rain) || 0
            const bar = Math.max(2, Math.round((rain / maxRain) * 22))
            const now = i === 0
            return (
              <li
                key={`${h.time}-${i}`}
                className={`rounded-tanah-kendali px-1 pb-2 pt-2 text-center dark:rounded-langit-kendali ${
                  now ? 'bg-tanah-terbenam dark:bg-langit-terbenam' : ''
                }`}
              >
                <span className="block font-data text-caption tabular-nums text-tanah-tinta-redup dark:text-langit-tinta-redup">
                  {now ? 'Kini' : h.time}
                </span>
                <span className="mt-0.5 block font-data text-body-sm font-semibold tabular-nums text-tanah-tinta dark:text-langit-tinta">
                  {r1(h.temp)}
                  <span className="text-caption">°</span>
                </span>
                <span
                  aria-hidden="true"
                  className="mx-auto mt-1 block w-1.5 rounded-pil bg-rain dark:bg-rain-soft"
                  style={{ height: `${bar}px` }}
                />
                <span className="mt-1 block font-data text-caption tabular-nums text-tanah-tinta-redup dark:text-langit-tinta-redup">
                  {rain > 0 ? `${r1(rain)} mm` : '—'}
                </span>
                <span className="block text-caption text-tanah-tinta-halus dark:text-langit-tinta-halus">
                  {h.gusts != null ? `${r0(h.gusts)} km/j` : '\u00a0'}
                </span>
              </li>
            )
          })}
        </ol>
    </section>
  )
}
