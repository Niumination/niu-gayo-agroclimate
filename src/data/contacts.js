// Kontak darurat & faskes per kecamatan untuk kartu multi-bahaya (FR-X-4, FR-ASAP-9).
// STATUS: KERANGKA. Hanya nomor bertanda `verified: true` yang sudah dipakai di UI/terverifikasi publik.
// Nomor Puskesmas/posko kecamatan WAJIB diisi & diverifikasi (telepon langsung / situs Dinkes Aceh Tengah) sebelum ditampilkan.
// Jangan menampilkan entri dengan phone null di UI.

export const EMERGENCY_CONTACTS = [
  { id: 'bpbd-aceh-tengah', name: 'BPBD Aceh Tengah (Pusdalops)', phone: '112', alt: '(0643) 21113', scope: 'kabupaten', hazards: ['*'], verified: true, note: 'Sudah dipakai di DisasterWarning.jsx' },
  { id: 'call-112', name: 'Layanan darurat nasional', phone: '112', scope: 'nasional', hazards: ['*'], verified: true },
  { id: 'bmkg-196', name: 'BMKG Contact Center', phone: '196', scope: 'nasional', hazards: ['gempa', 'petir', 'angin', 'banjir'], verified: true },
  { id: 'halo-kemenkes', name: 'Halo Kemenkes', phone: '1500567', scope: 'nasional', hazards: ['asap'], verified: true },
  { id: 'rsud-datu-beru', name: 'RSUD Datu Beru Takengon (IGD)', phone: '0643-21126', scope: 'kabupaten', hazards: ['asap', 'gempa', '*'], verified: true, note: 'Sumber: Wikidata, periksa ulang' },
  { id: 'dinkes-aceh-tengah', name: 'Dinas Kesehatan Aceh Tengah', phone: null, scope: 'kabupaten', hazards: ['asap'], verified: false },
  { id: 'damkar-aceh-tengah', name: 'Pemadam Kebakaran Aceh Tengah', phone: null, scope: 'kabupaten', hazards: ['kebakaran'], verified: false, note: 'ISI: nomor Damkar (113 bila terintegrasi)' },
  { id: 'manggala-agni-aceh', name: 'Manggala Agni Daops Aceh / KPH', phone: null, scope: 'provinsi', hazards: ['kebakaran', 'asap'], verified: false },
  { id: 'pos-pga-burni-telong', name: 'Pos Pengamatan Gunung Api Burni Telong (PVMBG)', phone: null, scope: 'kabupaten', hazards: ['vulkanik'], verified: false },
]

// Satu entri per kecamatan GADM (src/data/geo/kecamatan.json → properties.id). Isi nama & nomor Puskesmas/posko.
// STATUS: Sumber web terbatas, hanya 2 nomor terverifikasi (Takengon, Lut Tawar dari alamatsehat.com).
//其余需 manual verification via Dinkes Aceh Tengah (0822-8887-7789).
export const KECAMATAN_CONTACTS = {
  takengon: { puskesmas: { name: 'Puskesmas Takengon Kota', phone: '0852-7585-8010' }, posko: { name: 'Posko Kecamatan Takengon', phone: null } },
  luttawar: { puskesmas: { name: 'Puskesmas Lut Tawar', phone: '0852-7585-8010' }, posko: { name: 'Posko Kecamatan Lut Tawar', phone: null } },
  kebayakan: { puskesmas: { name: 'Puskesmas Kebayakan', phone: null }, posko: { name: 'Posko Kecamatan Kebayakan', phone: null } },
  pegasing: { puskesmas: { name: 'Puskesmas Pegasing', phone: null }, posko: { name: 'Posko Kecamatan Pegasing', phone: null } },
  bies: { puskesmas: { name: 'Puskesmas Bies', phone: null }, posko: { name: 'Posko Kecamatan Bies', phone: null } },
  bintang: { puskesmas: { name: 'Puskesmas Bintang', phone: null }, posko: { name: 'Posko Kecamatan Bintang', phone: null } },
  silihnara: { puskesmas: { name: 'Puskesmas Silih Nara', phone: null }, posko: { name: 'Posko Kecamatan Silih Nara', phone: null } },
  kutepanang: { puskesmas: { name: 'Puskesmas Kute Panang', phone: null }, posko: { name: 'Posko Kecamatan Kute Panang', phone: null } },
  ketol: { puskesmas: { name: 'Puskesmas Ketol', phone: null }, posko: { name: 'Posko Kecamatan Ketol', phone: null } },
  celala: { puskesmas: { name: 'Puskesmas Celala', phone: null }, posko: { name: 'Posko Kecamatan Celala', phone: null } },
  rusipantara: { puskesmas: { name: 'Puskesmas Rusip Antara', phone: null }, posko: { name: 'Posko Kecamatan Rusip Antara', phone: null } },
  atulintang: { puskesmas: { name: 'Puskesmas Atu Lintang', phone: null }, posko: { name: 'Posko Kecamatan Atu Lintang', phone: null } },
  jagongjeget: { puskesmas: { name: 'Puskesmas Jagong Jeget', phone: null }, posko: { name: 'Posko Kecamatan Jagong Jeget', phone: null } },
  linge: { puskesmas: { name: 'Puskesmas Linge Isaq', phone: null }, posko: { name: 'Posko Kecamatan Linge', phone: null } },
  bebesan: { puskesmas: { name: 'Puskesmas Bebesen', phone: null }, posko: { name: 'Posko Kecamatan Bebesen', phone: null } },
}

/** Kontak yang boleh ditampilkan: terverifikasi & punya nomor. */
export function contactsFor(hazard, kecamatanId) {
  const general = EMERGENCY_CONTACTS.filter((c) => c.verified && c.phone && (c.hazards.includes('*') || c.hazards.includes(hazard)))
  const k = KECAMATAN_CONTACTS[kecamatanId]
  const local = []
  if (k?.puskesmas?.phone) local.push({ id: `puskesmas-${kecamatanId}`, name: k.puskesmas.name, phone: k.puskesmas.phone, scope: 'kecamatan' })
  if (k?.posko?.phone) local.push({ id: `posko-${kecamatanId}`, name: k.posko.name, phone: k.posko.phone, scope: 'kecamatan' })
  return [...local, ...general]
}
