const number = (value, maximumFractionDigits = 1, minimumFractionDigits = 0) => {
  if (value == null || value === '') return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return parsed.toLocaleString('id-ID', { maximumFractionDigits, minimumFractionDigits })
}

const coordinate = (value, positive, negative) => {
  if (value == null || value === '') return '—'
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return '—'
  return `${number(Math.abs(parsed), 4, 4)}° ${parsed >= 0 ? positive : negative}`
}

const withUnit = (value, unit, maximumFractionDigits = 1) => {
  const formatted = number(value, maximumFractionDigits)
  return formatted === '—' ? formatted : `${formatted} ${unit}`
}

/** Rincian cuaca mentah tetap tersedia di balik satu tombol, bukan hilang dari Ringkas. */
export default function InstrumentTechnicalDetail({
  id,
  open,
  current,
  location,
  modelElevation,
}) {
  const readingTime = typeof current?.time === 'string'
    ? current.time.match(/T(\d{2}:\d{2})/)?.[1]
    : null
  const rows = [
    ['Titik', `${coordinate(location?.lat, 'LU', 'LS')} · ${coordinate(location?.lon, 'BT', 'BB')}`],
    ['Ketinggian model', withUnit(modelElevation, 'm', 0)],
    ['Hembusan angin', withUnit(current?.gust, 'km/jam')],
    ['Arah angin', withUnit(current?.windDirection, '°', 0)],
    ['Kode cuaca WMO', number(current?.weatherCode, 0)],
    ['Kemiringan lahan', location?.slopeClass || '—'],
  ]

  return (
    <div
      id={id}
      role="region"
      aria-label="Detail teknis cuaca"
      hidden={!open}
      className="niu-technical-detail mt-3 border-t border-tanah-garis pt-3 dark:border-langit-garis"
    >
      <div className="detail-scroll overflow-x-auto">
        <table className="w-full border-collapse text-body-sm">
          <caption className="pb-2 text-left text-caption text-tanah-tinta-halus dark:text-langit-tinta-halus">
            Sumber: Open-Meteo ECMWF IFS 0.25°; pembacaan {readingTime ? `${readingTime} WIB` : 'waktu tidak tersedia'}.
          </caption>
          <tbody>
            {rows.map(([label, value]) => (
              <tr key={label}>
                <th
                  scope="row"
                  className="border-b border-tanah-garis py-2 pr-4 text-left font-medium text-tanah-tinta-redup dark:border-langit-garis dark:text-langit-tinta-redup"
                >
                  {label}
                </th>
                <td className="border-b border-tanah-garis py-2 text-right tabular-nums text-tanah-tinta dark:border-langit-garis dark:text-langit-tinta">
                  {value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
