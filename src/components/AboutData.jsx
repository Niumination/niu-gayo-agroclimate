import {  useEffect, useRef  } from 'react'

/**
 * FR-X-9 — halaman/modal "Tentang data & batasan": sumber + lisensi, arti "estimasi", cara membaca level,
 * privasi laporan warga, kontak koreksi. Konten statis (id); tautan dari HazardPanel & kartu.
 */
const SOURCES = [
  { name: 'Open-Meteo Forecast (ECMWF IFS 0,25°)', use: 'cuaca jam-an, hembusan angin, kelembapan tanah, basah daun → longsor, DAS, angin, karat daun', license: 'CC BY 4.0', url: 'https://open-meteo.com/' },
  { name: 'Open-Meteo Air Quality (CAMS global, Copernicus)', use: 'PM2,5/PM10/CO/AOD → ISPU estimasi & proksi kabut asap', license: 'CC BY 4.0 · data CAMS (lisensi Copernicus)', url: 'https://open-meteo.com/en/docs/air-quality-api' },
  { name: 'Open-Meteo Historical (ERA5/ERA5-Land)', use: 'arsip 90 hari → Hari Tanpa Hujan, neraca air, spin-up FWI', license: 'CC BY 4.0', url: 'https://open-meteo.com/en/docs/historical-weather-api' },
  { name: 'NASA FIRMS (VIIRS S-NPP/NOAA-20/NOAA-21, MODIS)', use: 'titik panas ≤ 10/25/50 km dari sentra (butuh kunci MAP_KEY di server)', license: 'bebas dengan atribusi NASA', url: 'https://firms.modaps.eosdis.nasa.gov/' },
  { name: 'BMKG — peringatan dini / nowcast (CAP RSS)', use: 'peringatan resmi cuaca ekstrem (ditampilkan apa adanya)', license: 'publik, atribusi BMKG', url: 'https://www.bmkg.go.id/' },
  { name: 'Canadian FWI System (Van Wagner 1987) · kelas BMKG DC', use: 'kode FFMC/DMC/DC/ISI/BUI/FWI dari cuaca siang; kelas Drought Code mengikuti BMKG', license: 'metode publik; implementasi diuji terhadap dataset cffdrs', url: 'https://www.bmkg.go.id/cuaca/karhutla/dc' },
  { name: 'Riwayat kejadian (BNPB, BPBD Aceh Tengah, media)', use: 'kartu riwayat per sentra — kurasi manual, bukan daftar lengkap', license: 'kutipan dengan tautan sumber', url: 'https://www.bnpb.go.id/' },
  { name: 'Batas kecamatan GADM 4.1', use: 'peta skematik', license: 'gratis untuk akademik/non-komersial', url: 'https://gadm.org/' },
]

export default function AboutData({ open, onClose }) {
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    document.addEventListener('keydown', onKey)
    ref.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      {/* Latar penutup = <button> sungguhan: bisa dibaca pembaca layar, dan tidak
          menuntut jalur papan-ketik tambahan. Escape & tombol "Tutup" tetap jalur utama. */}
      <button
        type="button"
        aria-label="Tutup"
        tabIndex={-1}
        onClick={onClose}
        className="absolute inset-0 bg-ink/50"
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="about-title"
        className="relative w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto bg-surface dark:bg-soil border border-ink/10 dark:border-mist/10 rounded-t-card sm:rounded-card p-5 text-ink dark:text-mist"
      >
        <div className="flex items-start justify-between gap-3 pb-3 border-b border-ink/10 dark:border-mist/10">
          <div>
            <h2 id="about-title" className="text-body font-semibold tracking-tight">Tentang data &amp; batasan</h2>
            <p className="text-body text-ink-muted dark:text-mist-muted mt-0.5">Niu Gayo Agro-Climate adalah informasi pendukung keputusan — bukan peringatan dini resmi.</p>
          </div>
          <button type="button" onClick={onClose} className="min-h-11 px-3 rounded-lg border border-ink/15 dark:border-mist/15 text-body transition duration-100 ease-out active:scale-[.97]">Tutup</button>
        </div>

        <div className="space-y-5 pt-4 text-body leading-relaxed">
          <section>
            <h3 className="font-semibold">Apa arti “estimasi”?</h3>
            <p className="text-ink-body dark:text-mist-body mt-1">
              Hampir semua angka di aplikasi ini berasal dari <strong>model numerik atau satelit</strong>, bukan alat ukur di kampung Anda. ISPU dihitung dari model CAMS (~40 km) —
              nilai resmi hanya dari stasiun KLHK/BMKG. Kode kebakaran (FWI) memakai cuaca siang hasil reanalisis dan prakiraan. Skor longsor dan indeks DAS adalah indeks hujan,
              bukan pengukuran muka air atau pergerakan tanah. Perlakukan semuanya sebagai <em>indikasi</em>; utamakan pengamatan langsung dan arahan BPBD/BMKG.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Cara membaca level</h3>
            <ul className="mt-1 space-y-1 text-ink-body dark:text-mist-body">
              <li><span className="inline-block w-2 h-2 rounded-full bg-leaf mr-2" />Rendah — kondisi normal; tidak perlu tindakan khusus.</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-husk mr-2" />Waspada — pantau; siapkan langkah pencegahan di kebun/rumah.</li>
              <li><span className="inline-block w-2 h-2 rounded-full bg-cherry mr-2" />Bahaya — kurangi paparan/aktivitas berisiko; ikuti anjuran pada kartu.</li>
              <li><span aria-hidden="true" className="inline-block w-2 h-2 rounded-full bg-cherry mr-2" />Ekstrem — ambang resmi terlampaui jauh; prioritaskan keselamatan dan arahan petugas.</li>
              <li className="text-ink-muted dark:text-mist-muted">“Tidak tersedia” = sumber data sedang gagal atau bahaya tidak berlaku di sentra ini (mis. indeks DAS hanya untuk hulu Peusangan).</li>
            </ul>
            <p className="text-ink-muted dark:text-mist-muted mt-1">Ambang lengkap dan rujukannya: <code>docs/reference/THRESHOLDS.md</code> di repositori.</p>
          </section>

          <section>
            <h3 className="font-semibold">Sumber data &amp; lisensi</h3>
            <ul className="mt-1 divide-y divide-ink/10 dark:divide-mist/10">
              {SOURCES.map((s) => (
                <li key={s.name} className="py-2">
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center font-medium underline underline-offset-2">{s.name}</a>
                  <p className="text-caption text-ink-body dark:text-mist-muted">{s.use}</p>
                  <p className="text-caption text-ink-muted dark:text-mist-subtle">Lisensi: {s.license}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Keterbatasan yang perlu diketahui</h3>
            <ul className="list-disc pl-4 mt-1 space-y-1 text-ink-body dark:text-mist-body">
              <li>Resolusi model 25–40 km: lembah dan punggungan di Gayo bisa berbeda jauh dari nilai sel grid.</li>
              <li>Tanpa kunci FIRMS, titik panas tidak tersedia dan level kebakaran hanya dari cuaca.</li>
              <li>Jendela “hujan 72 jam” pada kartu memakai prakiraan hari berjalan (tanpa data masa lalu) — nilai antecedent bisa terlalu rendah.</li>
              <li>Prospek iklim (ENSO/IOD) dikurasi manual dari rilis BMKG dan bisa kedaluwarsa; tanggal berlaku tertera pada banner.</li>
              <li>Pesan Telegram/WhatsApp/SMS dari aplikasi ini bersifat informasi pendukung; status darurat resmi hanya dari BPBD/Bupati.</li>
            </ul>
          </section>

          <section>
            <h3 className="font-semibold">Privasi laporan warga</h3>
            <p className="text-ink-body dark:text-mist-body mt-1">
              Laporan hanya menyimpan sentra, jenis kejadian, pilihan skala, dan catatan bebas (maks. 500 karakter) beserta waktu. Tidak ada nama, nomor telepon, atau lokasi GPS.
              Alamat IP dipakai sementara untuk pembatasan 5 laporan/jam dan tidak disimpan bersama laporan. Laporan diteruskan ke kanal koordinasi Telegram internal.
            </p>
          </section>

          <section>
            <h3 className="font-semibold">Koreksi &amp; kontak</h3>
            <p className="text-ink-body dark:text-mist-body mt-1">
              Nomor kontak, riwayat kejadian, atau ambang yang keliru? Buka isu di repositori <a href="https://github.com/niumination/niu-gayo-agroclimate" target="_blank" rel="noopener noreferrer" className="min-h-11 inline-flex items-center underline underline-offset-2">niumination/niu-gayo-agroclimate</a> atau hubungi pengelola melalui kanal komunitas Niu Gayo.
              Darurat: <strong>112</strong> · BPBD Aceh Tengah <strong>(0643) 21113</strong> · Damkar <strong>113</strong>.
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
