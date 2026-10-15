# Draf surat pengantar — kerja sama validasi & diseminasi (untuk ditinjau manusia sebelum dikirim)

> **Status: DRAF.** Isi nama penanggung jawab, nomor surat, tanggal, lampiran, dan sesuaikan kop. Jangan kirim tanpa persetujuan pemilik proyek. Nomor telepon kontak darurat harus diverifikasi (tugas H-5).

---

**[KOP / NAMA ORGANISASI PENGEMBANG]**
Takengon, [tanggal]

Nomor : [..]/[..]/[bulan]/[tahun]
Lampiran : 1 (satu) berkas ringkasan sistem & protokol validasi
Perihal : **Permohonan kerja sama validasi data dan diseminasi informasi pendukung bahaya hidrometeorologi, karhutla/asap, gempa, dan gunung api — Dataran Tinggi Gayo**

Kepada Yth.
**Kepala Pelaksana BPBD Kabupaten Aceh Tengah**
di Takengon

Dengan hormat,

Kami mengembangkan **Niu Gayo Agro-Climate**, aplikasi web ringan (dapat dibuka tanpa pemasangan, hemat kuota) yang menerjemahkan data publik — prakiraan ECMWF/GFS (Open-Meteo), kualitas udara CAMS, hotspot NASA FIRMS, gempa BMKG, tingkat aktivitas Gunung Burni Telong (MAGMA/PVMBG), dan debit model GloFAS (Copernicus) — menjadi **indeks bahaya per sentra kopi** (15 sentra di Kabupaten Aceh Tengah) berikut anjuran tindakan bagi petani, sekolah, dan kelompok rentan. Seluruh keluaran dilabeli **"informasi pendukung — bukan peringatan resmi"** dan selalu merujuk ke BPBD/BMKG/PVMBG sebagai otoritas.

Sehubungan dengan itu, kami memohon kesediaan BPBD Kabupaten Aceh Tengah untuk:

1. **Berbagi data kejadian** (tanggal, lokasi/kampung, jenis bencana, dampak) tahun 2025–2027 dari Pusdalops, untuk **validasi** indeks (hit rate, false alarm, lead time) sesuai protokol terlampir; hasil validasi akan kami laporkan kembali tiap akhir musim.
2. **Meninjau ambang & anjuran** (terlampir) agar selaras dengan prosedur daerah, termasuk kontak darurat 112 / (0643) 21113 dan radius rekomendasi PVMBG Burni Telong.
3. **Menentukan kanal diseminasi** yang berkenan menerima ringkasan otomatis (Telegram/WhatsApp teks/CAP-XML), serta masukan tentang frekuensi dan format agar tidak menimbulkan kelelahan peringatan.
4. Bila berkenan, **penunjukan narahubung** untuk koordinasi teknis dan kegiatan sosialisasi bersama penyuluh pertanian/koperasi kopi.

Kami siap memaparkan sistem secara langsung dan menyesuaikan dengan kebutuhan BPBD. Seluruh kode terbuka (lisensi [..]) dan tidak memungut biaya.

Atas perhatian dan kerja sama Bapak/Ibu, kami ucapkan terima kasih.

Hormat kami,

[Nama]
[Jabatan / Organisasi]
[Telepon / surel]

Tembusan:
1. Stasiun Klimatologi Aceh (BMKG)
2. Pos Pengamatan Gunung Api Burni Telong (PVMBG)
3. Dinas Pertanian Kabupaten Aceh Tengah / BPP kecamatan terkait

---

## Lampiran — ringkasan untuk pembaca BPBD
| Bahaya | Sumber | Level | Catatan |
|---|---|---|---|
| Longsor | ECMWF hujan 24/72 jam, kelembapan tanah, kelas lereng | rendah–ekstrem | dinaikkan satu tingkat 72 jam setelah gempa M ≥ 5 ≤ 100 km bila tanah jenuh |
| Luapan DAS Peusangan | indeks hujan hulu + debit GloFAS (model) | rendah–ekstrem | bukan muka air terukur |
| Angin / badai petir | hembusan ECMWF; CAPE/LI ECMWF×GFS | rendah–ekstrem | ≥ 45 km/jam = kriteria ekstrem BMKG |
| Kabut asap & udara | CAMS (estimasi), jarak pandang model, laporan warga | ISPU estimasi | bukan pengukuran |
| Kebakaran lahan | FWI (ERA5+ECMWF), hotspot FIRMS, HTH | rendah–ekstrem | siaga lokal bila FFMC ≥ 78 & hotspot ≤ 25 km |
| Kekeringan | HTH kelas BMKG, neraca air, SPI-1/3 | rendah–ekstrem | baseline 1991–2020 |
| Gempa | BMKG TEWS | MMI indikatif | kejadian baru dikirim ≤ 5 menit |
| Gunung api | MAGMA/PVMBG | Level I–IV | sektor bawah angin ditandai |
| Suhu ekstrem kopi | Tmin/Tmax, titik embun, awan | rendah–ekstrem | embun upas plato |

Protokol validasi lengkap: `docs/VALIDATION.md`. Ambang: `docs/THRESHOLDS.md`.
