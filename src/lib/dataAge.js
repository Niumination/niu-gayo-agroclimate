// Konversi umur data (ms) → label + tingkat kesegaran untuk badge PWA.
export function dataAge(ms) {
  if (ms == null || Number.isNaN(ms)) return { label: '-', stale: true, minutes: Infinity }
  const minutes = Math.floor(ms / 60_000)
  let label
  if (minutes < 1) label = 'baru saja'
  else if (minutes < 60) label = `${minutes} menit`
  else if (minutes < 24 * 60) label = `${Math.floor(minutes / 60)} jam ${minutes % 60} mnt`
  else label = `${Math.floor(minutes / 1440)} hari`
  // Dianggap basi bila > 30 menit (di luar TTL cache proxy)
  return { label, stale: minutes >= 30, minutes }
}
