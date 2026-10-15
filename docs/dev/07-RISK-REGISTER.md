# Risk Register — Perluasan Multi-Bahaya

> Versi 1.0 (hasil 10 iterasi riset). Skala: Kemungkinan (K) 1–5, Dampak (D) 1–5, Skor = K×D. Pemilik default: maintainer repo. Ditinjau setiap akhir fase.

## 1. Risiko produk & keselamatan

| ID | Risiko | K | D | Skor | Mitigasi | Indikator pemicu |
|---|---|---|---|---|---|---|
| R-01 | Pengguna menganggap ISPU **estimasi** (CAMS) sebagai nilai resmi dan mengambil keputusan kesehatan yang salah | 4 | 4 | 16 | Label "estimasi model, resolusi ~40 km" wajib; pembanding sensor mitra (Fase 4); tautan ISPUNet; ambang kebijakan sekolah selalu bertuliskan "keputusan pemda" | Laporan warga "tidak sesuai" > 20 % |
| R-02 | **Alarm palsu** (mis. FFMC "ekstrem" setiap kemarau; CAPE tinggi tanpa badai) → *alert fatigue*, pengguna mematikan notifikasi | 4 | 4 | 16 | Kalibrasi lokal FFMC (prototipe: ekstrem tercapai setelah ~10 hari kering); "ekstrem" butuh kombinasi hotspot/agreement multi-model; dedupe 1 pesan/bahaya/sentra/6 jam; KPI FAR < 30 % | Rasio *unsubscribe* naik; FAR > 30 % |
| R-03 | **Peringatan terlewat** (asap tebal tetapi CAMS rendah; hotspot tertutup awan) | 3 | 5 | 15 | Fusi: AOD, jarak pandang, laporan warga, BMKG; status "indikasi lapangan" bila laporan ≥ 3 dalam 6 jam; tidak pernah menampilkan "aman" eksplisit saat data parsial | *Miss rate* > 20 % pada episode asap |
| R-04 | Aplikasi dipersepsikan sebagai **otoritas peringatan** (melanggar peran BMKG/PVMBG/BPBD) | 3 | 4 | 12 | ADR-22: sender "informasi pendukung"; selalu kutip sumber; MoU dengan BPBD; disclaimer halaman "Tentang data" | Keluhan instansi |
| R-05 | Dampak kopi–asap dinyatakan terlalu pasti padahal bukti terbatas | 3 | 2 | 6 | Kata "kehati-hatian"; fokus pada DNI/penjemuran yang terukur | Koreksi pakar |
| R-06 | Bahasa Gayo tidak akurat untuk istilah teknis baru (ISPU, hotspot) | 3 | 2 | 6 | Review penutur asli sebelum rilis; fallback id-ID | Umpan balik pengguna |

## 2. Risiko data & sumber eksternal

| ID | Risiko | K | D | Skor | Mitigasi | Indikator |
|---|---|---|---|---|---|---|
| R-10 | Perubahan format/URL **BMKG** (gempa JSON, RSS CAP, SPBK/HTH HTML) | 4 | 3 | 12 | Parser toleran + fixture test; `degraded` tanpa throw; pemantauan /healthz per sumber | Error parser > 1 jam |
| R-11 | **MAGMA** (HTML scraping) berubah/tidak stabil | 4 | 3 | 12 | Cache 1 jam + stale 7 hari; status manual `volcanoOverride.json`; tautan langsung MAGMA | 2 fetch gagal beruntun |
| R-12 | **FIRMS** MAP_KEY kuota (5.000 transaksi/10 menit) atau kunci bocor | 2 | 3 | 6 | Kunci di env server; satu bbox; cache 30 menit; fallback "hotspot tak tersedia" | HTTP 429 |
| R-13 | Open-Meteo gratis berubah syarat (rate limit 10k/hari) saat endpoint bertambah (AQ, Archive, Flood, GFS) | 3 | 4 | 12 | Semua panggilan lewat server + cache SWR; 15 sentra × 6 endpoint × 24 = ~2.200/hari; cron `/api/alerts` memakai cache yang sama | Mendekati 8k/hari |
| R-14 | **PetaBencana** NC-license membatasi pemakaian bila produk berubah komersial | 2 | 2 | 4 | Hanya konteks; mudah dilepas | Perubahan model bisnis |
| R-15 | GloFAS klimatologi lokal tidak representatif (sel 5 km vs sungai kecil) | 3 | 3 | 9 | Label "estimasi model global"; gabung dengan Indeks Luapan hujan; AWLR bila tersedia | Validasi BWS |
| R-16 | Resolusi CAMS ~40 km tidak menangkap asap lokal lembah Takengon | 4 | 3 | 12 | Fusi AOD/jarak pandang/laporan; sensor mitra; anjuran "lihat kondisi sekitar" | Deviasi vs sensor > 50 poin |

## 3. Risiko teknis

| ID | Risiko | K | D | Skor | Mitigasi | Indikator |
|---|---|---|---|---|---|---|
| R-20 | Bundle membengkak (peta, grafik) → PWA lambat di HP kelas bawah | 3 | 3 | 9 | ADR-24 SVG dulu; `scripts/check-bundle.mjs` gagal > 400 kB gzip; lazy import | CI gagal |
| R-21 | Server zero-dep menjadi kompleks (8+ sumber) | 3 | 3 | 9 | Registry hazard + `fetchAllSettled`; satu modul per sumber; test kontrak | Waktu respons /api/hazards > 1,5 s |
| R-22 | Service worker caching menyajikan data basi tanpa label | 3 | 3 | 9 | `fetchedAt` + badge "diperbarui X menit lalu"; `networkFirst` untuk API | Keluhan "data lama" |
| R-23 | Web Push: VAPID key hilang/rotasi → semua langganan putus | 2 | 3 | 6 | Simpan kunci di env & backup; dokumentasi rotasi | — |
| R-24 | Scraping MAGMA/BMKG dianggap pelanggaran ToS | 2 | 3 | 6 | Rate rendah; User-Agent jelas dengan kontak; minta akses resmi lewat MoU | Surat keberatan |

## 4. Risiko organisasi & keberlanjutan

| ID | Risiko | K | D | Skor | Mitigasi | Indikator |
|---|---|---|---|---|---|---|
| R-30 | *Maintainer* tunggal; beban operasi musim asap tinggi | 4 | 4 | 16 | Otomasi penuh (cron, cache, degraded); dokumentasi runbook; rekrut 1–2 kontributor/relawan Destana | Waktu respons isu > 48 jam |
| R-31 | Tidak ada MoU → BPBD tidak memakai/memvalidasi | 3 | 3 | 9 | Surat pengantar sebelum Fase 2; demo bersama; kanal Telegram BPBD | Tidak ada balasan 2 bulan |
| R-32 | Biaya kanal berbayar (WhatsApp API ≈ Rp500 rb/bln + Rp367/pesan) tidak terdanai | 3 | 2 | 6 | Tetap gratis: Telegram, Web Push, feed; WA hanya teks salin-tempel | — |
| R-33 | Kurangnya *ground truth* untuk validasi (sedikit stasiun) | 4 | 3 | 12 | Riwayat BNPB/BPBD terstruktur; laporan warga berlabel; sensor murah; kerja sama kampus (Univ. Gajah Putih/USK) | KPI validasi tak terukur |

## 5. Ringkasan prioritas (skor ≥ 12)
R-01, R-02 (16) · R-03 (15) · R-30 (16) · R-04, R-10, R-11, R-13, R-16, R-33 (12). Fokus Fase 1: pelabelan estimasi, anti-alarm palsu, degraded/caching, dan pendekatan ke BPBD.
