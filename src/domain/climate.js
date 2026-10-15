/**
 * Fase 1.9c — banner konteks iklim (ENSO/IOD/musim) dari data terkurasi BMKG + verifikasi lokal dari arsip ERA5.
 * Fungsi murni: tidak membaca jam sistem secara implisit (parameter `now`).
 */
export function climateBannerModel(outlook, { now = new Date(), drought = null } = {}) {
  const cur = outlook?.current
  if (!cur) return null
  const valid = cur.validUntil ? new Date(`${cur.validUntil}T23:59:59+07:00`).getTime() >= new Date(now).getTime() : false
  const enso = cur.enso ? `${cur.enso.phase}${cur.enso.strength ? ` ${cur.enso.strength}` : ''}${cur.enso.nino34Dasarian != null ? ` (Niño3.4 ${cur.enso.nino34Dasarian > 0 ? '+' : ''}${cur.enso.nino34Dasarian} °C)` : ''}` : null
  const iod = cur.iod ? `IOD ${cur.iod.phase}${cur.iod.index != null ? ` (${cur.iod.index > 0 ? '+' : ''}${cur.iod.index})` : ''}` : null
  const season = cur.season?.status ?? null
  // Verifikasi lokal: hujan 30 hari & HTH dari /api/drought (bila ada) — kondisi aktual sentra bisa berbeda dari prospek regional.
  const rain30 = drought?.assessment?.balance30?.rain ?? null
  const hth = drought?.assessment?.hth?.days ?? null
  let local = null
  let localTone = 'rendah'
  if (rain30 != null) {
    if (rain30 >= 150 && (hth ?? 0) <= 5) {
      local = `Kondisi aktual sentra ini basah (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari) — prospek kemarau regional belum terasa di sini; asap yang muncul kemungkinan kiriman dari luar.`
      localTone = 'rendah'
    } else if (rain30 < 60 || (hth ?? 0) > 20) {
      local = `Kondisi aktual sentra ini kering (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari) — selaras dengan prospek regional.`
      localTone = 'tinggi'
    } else {
      local = `Kondisi aktual sentra ini sedang (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari).`
      localTone = 'sedang'
    }
  }
  const tone = !valid ? 'sedang' : cur.enso?.strength?.includes('kuat') || season?.includes('kemarau') ? 'tinggi' : 'sedang'
  return {
    valid,
    issuedAt: cur.issuedAt ?? null,
    validUntil: cur.validUntil ?? null,
    title: valid ? 'Konteks iklim musiman (BMKG)' : 'Konteks iklim musiman — perlu pembaruan',
    summary: [enso, iod, season ? `musim: ${season}` : null].filter(Boolean).join(' · '),
    detail: cur.season?.note ?? null,
    implications: cur.implications?.id ?? [],
    local,
    localTone,
    tone,
    sources: cur.sources ?? [],
    staleNote: valid ? null : `Data terkurasi berlaku s.d. ${cur.validUntil}; maintainer perlu memperbarui src/data/hazards/climateOutlook.json dari rilis BMKG terbaru.`,
  }
}
