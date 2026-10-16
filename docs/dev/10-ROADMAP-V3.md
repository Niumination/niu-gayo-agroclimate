# Roadmap v3 (2027–2028) — evaluasi v2 & arah berikutnya

**Status:** dokumen arah (Fase 4.5). Disusun 15 Okt 2026 setelah Sprint 4 menyelesaikan seluruh butir Fase 0–4 yang tidak memerlukan masukan manusia (11 modul bahaya, CAP + cron, validasi, CI). Butir di sini **belum dijadwalkan**; prioritas ditetapkan setelah laporan validasi musim hujan 2026/27 (`docs/VALIDATION.md`).

## 1. Evaluasi singkat v2 (apa yang sudah ada)
| Area | Keadaan akhir v2 | Catatan evaluasi |
|---|---|---|
| Cakupan bahaya | 11 modul registry: longsor, banjir+ (GloFAS), angin, badai, asap, kebakaran, kekeringan (HTH/neraca/SPI/VPD), gempa, vulkanik, suhu, karat | semua estimasi model; belum ada satu pun pengukuran in-situ milik proyek |
| Diseminasi | CAP-JSON/XML, Telegram (cron 30 menit + cepat 5 menit), WhatsApp/SMS teks, feed | Web Push belum (VAPID); belum ada kanal resmi BPBD |
| Validasi | arsip harian + `validate-season.mjs` + protokol | belum ada data kejadian BPBD terstruktur (H-8) |
| Kinerja | bundel gzip ≈ 132 kB (batas 200), PWA offline-tolerant, 285 test, smoke CI | peta SVG; Leaflet ditunda |
| Tata kelola | AGENTS.md, THRESHOLDS §1–21, Tentang data & batasan, lisensi per sumber | FIRMS/Telegram/VAPID = kunci manusia |

## 2. Kandidat v3 (urut perkiraan nilai ÷ biaya)
| # | Kandidat | Nilai | Biaya | Prasyarat |
|---|---|---|---|---|
| V3-1 | **Kalibrasi lokal ambang** dari laporan validasi 2 musim (longsor ARI, GloFAS rasio per sel, FWI kelas, koreksi Tmin elevasi) | tinggi | rendah (ubah `thresholds.js` + docs + test) | laporan validasi, kejadian BPBD |
| V3-2 | **Web Push opt-in** per sentra (level ≥ bahaya) memakai `/api/alerts/feed` + service worker; VAPID | tinggi untuk warga tanpa Telegram | sedang (dependensi `web-push`, UI izin, state langganan) | H-9 VAPID key, HTTPS |
| V3-3 | **Sensor PM2,5 murah** (PMS5003/SDS011 + ESP32) di 3–5 titik (puskesmas/sekolah) → `POST /api/sensors` → koreksi bias CAMS & ISPU terukur | tinggi saat episode asap | sedang (perangkat ± Rp 600 rb/titik, perawatan) | mitra Dinkes/DLH, `SENSOR_TOKENS` |
| V3-4 | **Termometer minimum/datalogger** di plato (Jagong Jeget, Atu Lintang) untuk embun upas | sedang | rendah | petani mitra |
| V3-5 | **Muka air Lut Tawar / AWLR Peusangan** (BWS Sumatera I / SIHKA) → ganti label "model" menjadi terukur | tinggi | rendah–sedang (akses data) | izin BWS |
| V3-6 | **Peta Leaflet lazy-load** (ADR-24 tahap 2): tile OSM/MapTiler berizin saat online, lapisan hotspot/angin/sektor abu, chunk terpisah ≤ 45 kB gzip | sedang | sedang | keputusan anggaran bundel (naikkan batas per berkas?) |
| V3-7 | **WN3 / model lokal** (Weathernews, jika tersedia) + konsensus 3 model untuk hujan & badai | sedang | sedang (kuota) | akses API |
| V3-8 | **API publik berdokumen** (`/api/hazards`, `/api/alerts/feed`, CAP) + kebijakan kuota & atribusi, agar BPBD/koperasi dapat menyematkan | sedang | rendah (OpenAPI + rate limit) | tata kelola 08 |
| V3-9 | **Bahasa Gayo** lengkap untuk label & anjuran (saat ini `[?]` placeholder) | sedang (inklusi) | rendah–sedang | penutur/penyuluh (H-4) |
| V3-10 | **Nowcasting hujan radar/satelit** (BMKG radar Lhokseumawe bila dapat diakses; GPM IMERG early — sudah ada `server/imerg.js` sebagai rintisan) | tinggi untuk badai/banjir bandang | tinggi | akses data |
| V3-11 | **Model longsor berbasis fisik ringan** (Iverson/TRIGRS-lite dengan DEM 30 m) menggantikan skor heuristik | tinggi | tinggi | DEM, data tanah |
| V3-12 | **Kanal WhatsApp Business/SMS gateway** resmi BPBD | tinggi | biaya operasional | MoU |

## 2b. Hutang teknis & pengerasan (rilis v2.1, hasil audit 2026-10-16)
| # | Item | Alasan / sumber |
|---|---|---|
| A-1 | Naikkan lompatan mayor: Tailwind 4, Vite 8, `@vitejs/plugin-react` 6, lucide-react 1.x | ✅ **SELESAI v2.1.0 (2026-10-16)** — Tailwind 4.3.3 (rantai `chokidar→braces` hilang, `npm audit` **0**), Vite 8.3.4 (Rolldown; `manualChunks`→`advancedChunks`), plugin-react 6.1.2 (Oxc), lucide 1.58. Lihat CHANGELOG 2.1.0; catatan kompatibilitas browser (Safari 16.4+/Chrome 111+) ada di README |
| A-2 | Ambang cakupan uji (`test:coverage`) + laporan tren; mulai dari modul kritis (hazards, alert, thresholds) | ✅ **SELESAI v2.1.0 (2026-10-16)** — `scripts/check-coverage.mjs` + `npm run check:coverage`: gagal bila baris < 95 % / cabang < 80 % / fungsi < 92 %, baseline tren terversi `scripts/coverage-baseline.json` (96,42 / 83,78 / 95,96 pada 321 uji), 15 uji baru, CI memakai gerbang ini (audit F-10 ditutup) |
| A-3 | Tag rilis bertanda tangan / attestation (`git tag -s` atau Sigstore) | audit F-06 — butuh kunci GPG/identitas penerbit (tugas manusia H-10) |
| A-4 | ~~Pantau advisory `braces`~~ | ✅ **SELESAI v2.1.0** — rantai dependensinya sudah tidak ada (A-1) |
| A-5 | Pisahkan `docs/` mengikuti empat kuadran Diátaxis (tutorial/how-to/reference/explanation) bila dokumentasi bertambah | audit F-15 catatan struktur |

## 3. Yang sengaja tidak dilakukan
- Memberi label "peringatan dini resmi" pada keluaran apa pun — mandat BMKG/BPBD/PVMBG.
- Mengumpulkan data pribadi pelapor (tetap anonim, tanpa lokasi presisi).
- Menambah pustaka UI/grafik besar; semua grafik tetap SVG inline.

## 4. Indikator keputusan untuk memulai v3
1. Laporan validasi musim hujan 2026/27 tersedia (POD/FAR per bahaya).
2. Minimal satu mitra institusi (BPBD/Staklim/Dinkes) menunjuk narahubung.
3. Cron Telegram berjalan ≥ 60 hari tanpa insiden (lihat `/healthz`).
