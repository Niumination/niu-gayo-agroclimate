# Explanation: mengapa sistem ini dirancang begini

**Kuadran:** explanation (pemahaman) · Audiens: siapa pun yang perlu **menilai** keputusan, bukan menjalankan perintah. Untuk tugas konkret buka [../how-to/](../how-to/); untuk angka & spesifikasi buka [../reference/](../reference/).

## Prinsip yang mengikat seluruh desain

1. **Alat pendukung, bukan otoritas.** Niu Gayo Agro-Climate tidak pernah mengeluarkan “peringatan dini resmi”. Semua keluaran adalah **estimasi model/satelit** yang mengutip dan merujuk BMKG/PVMBG/BPBD/Kemenkes. Karena itu setiap kartu menyebut sumber & waktu data, dan ada dialog “Tentang data & batasan”.
2. **Degradasi yang jujur.** Sumber data mati bukan alasan menampilkan “aman”. Sistem menampilkan nilai terakhir + penanda `degraded` + alasannya. Endpoint tidak mengembalikan 5xx hanya karena upstream lambat — diuji oleh `npm run smoke`.
3. **Level, bukan skor mentah.** Sebelas bahaya berbeda dikompresi ke skala bersama `n/a < rendah < waspada < bahaya < ekstrem` supaya warga dapat membandingkan dan menyusun prioritas tanpa memahami FWI/CAPE/SPI.
4. **Anti-kebisingan sebelum anti-kelalaian.** Peringatan hanya dikirim pada level tertentu per bahaya, dengan jeda minimum 6 jam per bahaya-sentra dan batas per siklus. Peringatan yang terlalu sering akan diabaikan — itu risiko nyata di kampung kecil. (Kebijakan: [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) §13–14.)
5. **Ringan di jaringan 3G Gayo.** Peta SVG inline, tanpa tile peta, anggaran bundle diuji otomatis (`check:bundle`), tanpa dependensi server tambahan.
6. **Data yang bisa diaudit.** Ambang terkumpul di satu modul (`src/domain/thresholds.js`) + tabel manusia; arsip level harian tersimpan agar klaim dapat divalidasi di lapangan; label Gayo yang belum disetujui penutur ditandai `[?]` alih-alih ditebak.

## Arsip pemikiran (10 iterasi riset)

Dokumen di [`../dev/`](../dev/README.md) ditulis 14–15 Okt 2026 melalui 10 iterasi riset→pembaruan dan **sengaja dibiarkan bersifat arsip** (bernomor, bertanggal) supaya jejak keputusan tetap terbaca. Peta isinya:

| Dokumen | Yang dijelaskan |
|---|---|
| `dev/00-REPO-AUDIT.md` | kondisi repo pada titik awal (fitur F1–F8, utang teknis T1–T12, celah multi-bahaya) |
| `dev/01-RESEARCH-LOG.md` | **log 10 iterasi**: pertanyaan → temuan + sumber → keputusan; termasuk endpoint yang diuji langsung |
| `dev/02-PRD-MULTI-HAZARD.md` | visi, persona, taksonomi 11 bahaya, kebutuhan fungsional (FR-…), NFR, pertanyaan terbuka |
| `dev/03-ROADMAP.md` | roadmap 4 fase beserta kriteria selesai per butir & gate G1–G3 |
| `dev/04-DATA-SOURCES.md` | katalog sumber per bahaya: URL, status uji, TTL, lisensi, fallback |
| `dev/05-ARCHITECTURE.md` | integrasi ke arsitektur eksisting + **ADR-12 … ADR-26** (registry bahaya, CAP, arsip, Leaflet ditunda, dll.) |
| `dev/06-THRESHOLDS-MULTI-HAZARD.md` | latar riset angka ambang (ISPU P.14/2020, FWI/FDRS, gempa, vulkanik, HTH/SPI, suhu, GloFAS, konvektif) |
| `dev/07-RISK-REGISTER.md` | risiko produk/data/teknis/organisasi + mitigasi |
| `dev/08-STAKEHOLDERS-GOVERNANCE.md` | pemangku kepentingan, alur laporan, kerangka hukum, lisensi, privasi, KPI & rencana validasi |
| `dev/09-DATA-PREP.md` | status penyiapan data/aset + daftar tugas manusia (H-1…H-10) |
| `dev/10-ROADMAP-V3.md` | arah v3 (sensor IoT, API publik, Web Push, Leaflet, kalibrasi lokal) + hutang teknis A-1…A-5 |

## Keputusan terbaru (v2.1.0)

- **A-1 — migrasi toolchain mayor:** Tailwind 4 (CSS-first), Vite 8/Rolldown, `@vitejs/plugin-react` 6 (Oxc), lucide 1.x. Motifnya bukan mode, tetapi **rantai dependensi**: `chokidar → braces` membawa CVE tanpa patch hulu. Hasil: `npm audit` 0 dan build 3,6 s → ~0,4 s. Trade-off yang diterima: lantai browser naik ke Safari 16.4+/Chrome 111+/FF 128+ (Maret 2023) — rilis v2.0.1 tetap tersedia untuk perangkat lama.
- **A-2 — gerbang cakupan uji:** cakupan berhenti menjadi laporan informatif, menjadi ambang gagal dengan baseline terversi supaya regresi pada modul kritis (hazards, alert, thresholds, routes) tertangkap CI. Lihat [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md).
- **A-5 — struktur Diátaxis:** dokumentasi dipisah menurut kebutuhan pembaca (tutorial/how-to/reference/explanation) supaya berkas “cara melakukan X” tidak lagi bercampur dengan tabel acuan dan riset.

## Cara berpikir yang diharapkan dari kontributor

- Setiap angka butuh **sumber**: riset (dev/06), pengukuran (kalibrasi), atau validasi lapangan. Semuanya punya jalur dokumentasi masing-masing.
- Klaim performa harus **terukur**: bundle diuji skrip, cakupan diuji ambang, kesegaran outlook diuji CI — bukan “sepertinya cukup cepat”.
- Fitur baru pada bahaya tertentu biasanya berarti **modul baru di registry**, bukan cabang baru di UI.
- Bila ragu antara “menambah peringatan” dan “mengurangi kebisingan”, pilih yang kedua lebih dulu, lalu buktikan lewat validasi.
