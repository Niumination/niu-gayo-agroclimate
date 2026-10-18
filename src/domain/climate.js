/**
 * Ringkasan iklim musiman berbasis rilis BMKG/NOAA dan verifikasi kondisi setempat.
 * Angka indeks, nama model, dan catatan teknis dikirim terpisah agar UI dapat
 * menyembunyikannya sampai pengguna membuka rincian.
 */
export function climateBannerModel(outlook, { now = new Date(), drought = null } = {}) {
  const cur = outlook?.current
  if (!cur) return null
  const valid = cur.validUntil ? new Date(`${cur.validUntil}T23:59:59+07:00`).getTime() >= new Date(now).getTime() : false
  const enso = cur.enso ? `${cur.enso.phase}${cur.enso.strength ? ` ${cur.enso.strength}` : ''}` : null
  const nino = cur.enso?.nino34Dasarian == null ? null : `Niño-3.4 ${cur.enso.nino34Dasarian > 0 ? '+' : ''}${cur.enso.nino34Dasarian} °C${cur.enso.nino34Period ? ` (${cur.enso.nino34Period})` : ''}`
  const ensoPeriod = cur.enso?.index3Month == null ? null : `indeks tiga bulanan ${cur.enso.index3Month > 0 ? '+' : ''}${cur.enso.index3Month} °C${cur.enso.index3MonthPeriod ? ` (${cur.enso.index3MonthPeriod})` : ''}`
  const iod = cur.iod ? `IOD ${cur.iod.phase}${cur.iod.index != null ? ` (${cur.iod.index > 0 ? '+' : ''}${cur.iod.index})` : ''}${cur.iod.period ? ` (${cur.iod.period})` : ''}` : null
  const season = cur.season?.status ?? null
  const rain30 = drought?.assessment?.balance30?.rain ?? null
  const hth = drought?.assessment?.hth?.days ?? null
  let local = null
  let localSummary = null
  let localTone = 'rendah'
  if (rain30 != null) {
    if (rain30 >= 150 && (hth ?? 0) <= 5) {
      local = `Kondisi aktual sentra ini basah (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari) — prospek kering regional belum terasa merata di sini; asap yang muncul juga dapat terbawa dari wilayah lain.`
      localSummary = 'Kondisi setempat masih basah; cuaca dapat berbeda antarwilayah.'
      localTone = 'rendah'
    } else if (rain30 < 60 || (hth ?? 0) > 20) {
      local = `Kondisi aktual sentra ini kering (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari) — selaras dengan prospek regional.`
      localSummary = 'Kondisi setempat mulai kering; hemat air dan waspadai kebakaran lahan.'
      localTone = 'tinggi'
    } else {
      local = `Kondisi aktual sentra ini sedang (hujan 30 hari ${Math.round(rain30)} mm, HTH ${hth ?? 0} hari).`
      localSummary = 'Kondisi setempat berada di peralihan; pantau hujan dan perubahan cuaca.'
      localTone = 'sedang'
    }
  }
  const tone = !valid ? 'sedang' : cur.enso?.strength?.includes('kuat') || season?.includes('kemarau') ? 'tinggi' : 'sedang'
  const cpc = cur.cpcCrossCheck
  const technicalSummary = [
    enso,
    nino,
    ensoPeriod,
    iod,
    cpc ? `NOAA CPC Niño-3.4 ${cpc.nino34 > 0 ? '+' : ''}${cpc.nino34} °C (${cpc.nino34Period || cpc.issuedAt}); ${cpc.note}` : null,
  ].filter(Boolean).join('. ')
  return {
    valid,
    issuedAt: cur.issuedAt ?? null,
    validUntil: cur.validUntil ?? null,
    title: valid ? 'Perkiraan iklim musiman' : 'Perkiraan iklim — perlu pembaruan',
    summary: valid
      ? season ? `Kemarau dapat berlangsung lebih panjang; hujan setempat tetap bisa turun.` : 'Prakiraan musim terbaru tersedia.'
      : 'Informasi prakiraan musim perlu diperbarui.',
    technicalSummary,
    detail: cur.season?.note ?? null,
    implications: cur.implications?.id ?? [],
    local,
    localSummary,
    localTone,
    tone,
    sources: cur.sources ?? [],
    staleNote: valid ? null : `Data terkurasi dalam src/data/hazards/climateOutlook.json berlaku sampai ${cur.validUntil}; perlu diperbarui dari rilis BMKG dan NOAA CPC terbaru.`,
  }
}
