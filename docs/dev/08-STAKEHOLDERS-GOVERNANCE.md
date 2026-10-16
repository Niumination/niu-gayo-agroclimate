# Pemangku Kepentingan, Tata Kelola, Lisensi, Privasi & KPI

> Versi 1.0 (hasil 10 iterasi riset). Melengkapi PRD (`02`) dan Roadmap (`03`). Posisi produk: **informasi pendukung** bagi petani kopi & warga Gayo yang mengutip lembaga berwenang — bukan otoritas peringatan dini.

## 1. Peta pemangku kepentingan

| Aktor | Peran dalam sistem bencana | Hubungan dengan produk | Prioritas kemitraan |
|---|---|---|---|
| **BPBD Aceh Tengah** (Pusdalops; 112 / (0643) 21113) | Komando penanganan darurat kabupaten (UU 24/2007); menerima laporan dari posko kecamatan | Penerima relay laporan warga; validator ambang; pengguna ringkasan harian; sumber riwayat kejadian | **P1** — surat pengantar sebelum Fase 2 |
| **Posko Kecamatan / Pemerintah Kampung (Reje)** | Titik pertama laporan masyarakat (contoh: Posko Kec. Celala, karhutla 19 Jul 2026) | Kontak per kecamatan di `contacts.js`; penerima pesan Telegram kampung; relawan Destana | P1 |
| **BMKG Staklim Aceh / Stamet** | Otoritas cuaca, iklim, HTH, SPBK, gempa (InaTEWS) | Sumber data (RSS CAP, JSON gempa, HTH/SPBK); kalibrasi FWI lokal; buletin iklim | P1 |
| **Manggala Agni Daops Aceh & KPH (KLHK/Dinas LHK Aceh)** | Pengendalian karhutla; patroli hotspot; ground-check | Validasi hotspot FIRMS vs lapangan; info status siaga | P1 |
| **PVMBG / Pos PGA Burni Telong** | Otoritas gunung api (status, VONA, rekomendasi radius) | Sumber status; konfirmasi perubahan level | P2 |
| **Dinkes Aceh Tengah / Puskesmas / RSUD Datu Beru** | Layanan kesehatan; pesan kesehatan asap; data ISPA | Kontak faskes per kecamatan; sensor PM2,5 murah; validasi anjuran | P1 (musim asap) |
| **DLH Aceh Tengah / DLHK Aceh** | ISPU resmi (bila ada alat), pengawasan pembakaran | Mitra sensor; rujukan ISPU resmi | P2 |
| **Dinas Pendidikan** | Keputusan kegiatan luar ruang/PJJ | Pengguna ambang 101/201/300 sebagai bahan keputusan | P2 |
| **BWS Sumatera I / Dinas Pengairan** | AWLR, operasi waduk/sungai Peusangan | Data tinggi muka air (Fase 3) | P3 |
| **Koperasi kopi, eksportir, penyuluh (Dinas Pertanian/BPP)** | Pascapanen, jadwal panen & jemur | Pengguna utama fitur agro; umpan balik dampak asap | P1 |
| **Petani & warga Gayo (pengguna akhir)** | Pelapor; penerima informasi | Laporan warga (F8), bahasa Gayo | — |
| **Perguruan tinggi (Univ. Gajah Putih, USK)** | Riset & validasi | Kalibrasi FWI/ISPU; skripsi/kolaborasi | P3 |

## 2. Alur informasi & laporan (target)

```
Sumber otoritatif (BMKG, PVMBG, KLHK/FIRMS, CAMS, GloFAS)
        │  fetch + cache (server)        ┌──────────────┐
        ▼                                 │ Laporan warga│──► Telegram BPBD/posko kecamatan (relay, sudah ada F8)
   Registry hazard ──► Alert (CAP-style) ─┤              │
        │                                 └──────────────┘
        ▼
   Kartu/peta aplikasi ─► Telegram kampung / Web Push / feed / teks WA-SMS (salin-tempel)
        │
        ▼
   Umpan balik ("sesuai/tidak sesuai") ─► log validasi ─► tinjauan ambang per musim
```

Prinsip: (1) jangan membuat kanal pelaporan paralel yang memutus posko kecamatan — relay ke kontak resmi; (2) setiap pesan mencantumkan sumber & waktu data; (3) status "ekstrem" selalu menyertakan instruksi menghubungi 112/BPBD.

## 3. Kerangka hukum & peran

| Instrumen | Isi relevan | Implikasi produk |
|---|---|---|
| UU 24/2007 Penanggulangan Bencana | BNPB/BPBD penyelenggara; peringatan dini oleh lembaga berwenang | Produk = pendukung; tidak menerbitkan "peringatan resmi" |
| Permen LHK P.14/2020 | Definisi & perhitungan ISPU | Gunakan rumus & kategori resmi; label "estimasi" bila dari model |
| Perka BMKG KEP.009/2010 | Kriteria cuaca ekstrem (angin > 25 kt, hujan ≥ 50 mm/hari, jarak pandang < 1 km, suhu ±3 °C) | Ambang "ekstrem" selaras BMKG |
| Perka BNPB tentang Destana | Relawan kampung tangguh bencana | Mitra diseminasi di tingkat kampung |
| UU 27/2022 Pelindungan Data Pribadi | Minimalisasi data, tujuan, retensi | Lihat §5 |
| Peraturan daerah/instruksi gubernur tentang larangan membuka lahan dengan membakar | Larangan pembakaran | Pesan edukasi "jangan membakar" pada level ≥ tinggi |

## 4. Lisensi & atribusi sumber data

| Sumber | Lisensi | Atribusi di aplikasi |
|---|---|---|
| Open-Meteo (forecast, AQ/CAMS, Archive, Flood/GloFAS) | CC BY 4.0; gratis non-komersial (< 10k req/hari) | "Data: Open-Meteo.com · CAMS/ECMWF · GloFAS/Copernicus" |
| NASA FIRMS (VIIRS/MODIS) | Bebas; atribusi dianjurkan | "Hotspot: NASA FIRMS" |
| BMKG (CAP RSS, gempa JSON, HTH/SPBK) | Hak cipta BMKG; atribusi wajib | "Sumber: BMKG" + tautan |
| PVMBG/MAGMA Indonesia | Atribusi | "Status gunung api: PVMBG/MAGMA" |
| PetaBencana.id | CC BY-NC 4.0 | "Laporan: PetaBencana.id" |
| GADM 4.1 (batas kecamatan) | Bebas untuk akademik/non-komersial; redistribusi terbatas | Simpan versi tersederhana; atribusi; pertimbangkan batas BIG bila komersial |
| USGS | Domain publik | "USGS" |

Catatan: jika produk kelak komersial/berbayar → Open-Meteo perlu langganan API, PetaBencana & GADM harus diganti.

## 5. Privasi & keamanan

- **Laporan warga**: tanpa nama/nomor; hanya sentra, tipe, catatan bebas (filter PII sederhana: nomor telepon/NIK dihapus otomatis), waktu; rate-limit per IP (sudah ada) → dipertahankan.
- **Web Push**: simpan `endpoint`, `keys`, `sentraId`, `minLevel`, `createdAt`; hapus bila gagal kirim 3× atau tidak aktif 90 hari; tidak ada akun pengguna.
- **Sensor mitra**: token per perangkat (env/`sensors.json`), hanya data lingkungan + lokasi perangkat yang disetujui mitra.
- **Kunci**: FIRMS MAP_KEY, Telegram token, VAPID private — hanya di env server; tidak pernah ke klien.
- **Halaman "Tentang data & batasan"**: sumber, lisensi, arti "estimasi", kebijakan privasi singkat, kontak koreksi.

## 6. KPI & rencana validasi

| KPI | Target | Cara ukur | Kapan |
|---|---|---|---|
| Lead time informasi asap | ≤ 30 menit dari pembaruan CAMS/FIRMS | `fetchedAt` vs waktu sumber di log | Tiap episode |
| Hit rate karhutla lokal | ≥ 80 % kejadian BNPB/BPBD punya FFMC ≥ 78 atau hotspot ≤ 10 km pada H-0/H-1 | Cocokkan `disasterHistory.json` (hazard `kebakaran`) dengan arsip harian FWI/hotspot (`server/data/hazard-archive/`) | Akhir musim kemarau |
| False alarm ratio "ekstrem" | < 30 % | Hari "ekstrem" tanpa kejadian/hotspot/laporan dalam 48 jam | Akhir musim |
| Akurasi ISPU estimasi | MAE < 25 poin vs sensor/stasiun terdekat | Pembanding sensor mitra (Fase 4) / ISPUNet terdekat | Bulanan (musim asap) |
| Partisipasi laporan | ≥ 20 laporan/episode asap; ≥ 60 % "sesuai" pada umpan balik | `/api/reports` + tombol umpan balik | Tiap episode |
| Ketersediaan | 0 hari dashboard kosong; /api/hazards < 1,5 s p95 | /healthz per sumber; log | Mingguan |
| Kemitraan | ≥ 3 institusi aktif (BPBD, Dinkes/Puskesmas, Staklim/Manggala Agni) | MoU/komunikasi rutin | Fase 2–4 |
| Kinerja aplikasi | Lighthouse PWA ≥ 90; bundle ≤ 400 kB gzip | CI | Tiap rilis |

Rencana validasi per fase: Fase 1 — *shadow mode* 1 musim (hitung tanpa notifikasi push, bandingkan dengan kejadian); Fase 2 — notifikasi Telegram terbatas ke BPBD/koperasi; Fase 3 — tinjauan ambang bersama Staklim/BPBD; Fase 4 — sensor & evaluasi tahunan.

## 7. Siklus tata kelola dokumen

- `docs/dev/*` diperbarui setiap akhir fase; perubahan ambang wajib: PR + pembaruan `docs/reference/THRESHOLDS.md` + test.
- ADR baru setiap keputusan arsitektur (`05-ARCHITECTURE.md`, lanjut dari ADR-26).
- Risk register (`07`) ditinjau tiap fase; KPI dilaporkan ringkas di `CHANGELOG.md` per musim.
