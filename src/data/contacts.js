// Kontak darurat & faskes per kecamatan untuk kartu multi-bahaya (FR-X-4, FR-ASAP-9).
// STATUS: KERANGKA. Hanya nomor bertanda `verified: true` yang sudah dipakai di UI/terverifikasi publik.
// Nomor Puskesmas/posko kecamatan WAJIB diisi & diverifikasi (telepon langsung / situs Dinkes Aceh Tengah) sebelum ditampilkan.
// Jangan menampilkan entri dengan phone null di UI.

export const EMERGENCY_CONTACTS = [
  { id: 'bpbd-aceh-tengah', name: 'BPBD Aceh Tengah (Pusdalops)', phone: '112', alt: '(0643) 21113', scope: 'kabupaten', hazards: ['*'], verified: true, note: 'Sudah dipakai di DisasterWarning.jsx' },
  { id: 'call-112', name: 'Layanan darurat nasional', phone: '112', scope: 'nasional', hazards: ['*'], verified: true },
  { id: 'bmkg-196', name: 'BMKG Contact Center', phone: '196', scope: 'nasional', hazards: ['gempa', 'petir', 'angin', 'banjir'], verified: true },
  { id: 'halo-kemenkes', name: 'Halo Kemenkes', phone: '1500567', scope: 'nasional', hazards: ['asap'], verified: true },
  { id: 'rsud-datu-beru', name: 'RSUD Datu Beru Takengon (IGD)', phone: null, scope: 'kabupaten', hazards: ['asap', 'gempa', '*'], verified: false, note: 'ISI: nomor IGD' },
  { id: 'dinkes-aceh-tengah', name: 'Dinas Kesehatan Aceh Tengah', phone: null, scope: 'kabupaten', hazards: ['asap'], verified: false },
  { id: 'damkar-aceh-tengah', name: 'Pemadam Kebakaran Aceh Tengah', phone: null, scope: 'kabupaten', hazards: ['kebakaran'], verified: false, note: 'ISI: nomor Damkar (113 bila terintegrasi)' },
  { id: 'manggala-agni-aceh', name: 'Manggala Agni Daops Aceh / KPH', phone: null, scope: 'provinsi', hazards: ['kebakaran', 'asap'], verified: false },
  { id: 'pos-pga-burni-telong', name: 'Pos Pengamatan Gunung Api Burni Telong (PVMBG)', phone: null, scope: 'kabupaten', hazards: ['vulkanik'], verified: false },
]

// Satu entri per kecamatan GADM (src/data/geo/kecamatan.json → properties.id). Isi nama & nomor Puskesmas/posko.
export const KECAMATAN_CONTACTS = {
  bebesan: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Bebesen', phone: null } },
  luttawar: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Lut Tawar', phone: null } },
  kebayakan: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Kebayakan', phone: null } },
  pegasing: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Pegasing', phone: null } },
  bies: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Bies', phone: null } },
  bintang: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Bintang', phone: null } },
  silihnara: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Silih Nara', phone: null } },
  kutepanang: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Kute Panang', phone: null } },
  ketol: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Ketol', phone: null } },
  celala: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Celala', phone: null }, note: 'Posko menerima laporan karhutla 19 Jul 2026 (BNPB)' },
  rusipantara: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Rusip Antara', phone: null } },
  atulintang: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Atu Lintang', phone: null } },
  jagongjeget: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Jagong Jeget', phone: null } },
  linge: { puskesmas: { name: null, phone: null }, posko: { name: 'Posko Kecamatan Linge', phone: null } },
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
