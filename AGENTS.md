# Niu-Gayo-Agroclimate — Project AGENTS.md

**Lokasi:** `apps/niu-gayo-agroclimate/`  
**Stack:** React 19, Vite 6, Tailwind CSS, Open-Meteo & WeatherNext 3 Pipeline, Node Native Test  
**Remote:** `github.com/Niumination/niu-gayo-agroclimate`  
**Kategori:** Apps — Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi  

## Overview

Niu Gayo Agro-Climate adalah dashboard web presisi tinggi untuk memantau mikroklimat perkebunan kopi Arabika Gayo dan sistem peringatan dini bencana hidrometeorologi (longsor lereng terjal, banjir luapan Danau Lut Tawar & DAS Peusangan) di 15 wilayah sentra agro-ekologi Kabupaten Aceh Tengah.

## Fitur Utama

1. **Pemantauan Mikroklimat Kopi Arabika:**
   - Evaluasi suhu optimal (15°C – 24°C).
   - Deteksi risiko jamur karat daun (*Hemileia vastatrix*) berbasis kelembapan relatif tinggi (>85%) dan temperatur hangat.
   - Analisis jendela penjemuran (*post-harvest drying window*) berbasis radiasi surya normal langsung (*direct normal irradiance*) dan curah hujan.
2. **Sistem Peringatan Dini Bencana Alam:**
   - Deteksi potensi tanah longsor lereng perkebunan berbasis akumulasi presipitasi harian (>25mm waspada, >50mm bahaya).
   - Status muka air & luapan Daerah Tangkapan Air Danau Lut Tawar dan DAS Peusangan.
   - Peringatan kecepatan angin kencang (>35 km/jam) untuk keselamatan pohon pelindung kopi.
   - **v2 (multi-bahaya, dalam pengembangan):** hazard registry 7 bahaya (longsor, banjir, angin, karat, asap karhutla/ISPU, kebakaran/FWI × hotspot, kekeringan/HTH) dengan level seragam, panel bahaya, peringatan CAP → Telegram, banner iklim, riwayat kejadian, kontak darurat, peta skematik. Rencana lengkap di `docs/dev/`.
3. **Cakupan Wilayah:**
   - 15 Sentra di Kabupaten Aceh Tengah (Bebesan, Takengon, Pegasing, Kute Panang, Atu Lintang, Jagong Jeget, Lut Tawar, Bintang, Kebayakan, Bies, Silih Nara, Ketol, Celala, Rusip Antara, Linge).

## Verification Commands

- Test: `npm test` (menjalankan unit test berbasis node test runner)
- Build: `npm run build` (menghasilkan bundle production Vite di `dist/`)
- Dev Server: `npm run dev` (berjalan di port 5188)
- Production: `npm run build` → `dist/` di-serve `scripts/serve.py` (:7444); API `server/index.js` (:7455)
- Akses publik: `https://cuaca.abstract.biz.id` (Cloudflare Tunnel) — `/api/*` + `/healthz` forward ke :7455
- Dev: `npm run dev` mem-proxy `/api` ke `127.0.0.1:7455` — jalankan `node server/index.js` bersamaan agar kartu konsensus/BMKG/kualitas udara tampil
- Cek cepat H-ASAP: `curl -s 'http://127.0.0.1:7455/api/air-quality?location=takengon' | head -c 600` (lihat `docs/THRESHOLDS.md` §7–9)
- Cek cepat H-API/H-KERING (Sprint 2): `curl -s 'http://127.0.0.1:7455/api/fire-danger?location=takengon'`, `.../api/hotspots?location=takengon`, `.../api/drought?location=takengon` (`docs/THRESHOLDS.md` §10–12). Panggilan pertama ±5–10 detik (arsip 90 hari × 15 sentra diambil per lokasi, TTL 12 jam); file runtime `server/data/archive-<id>.json` & `fwi-state.json` (gitignored) boleh dihapus kapan saja.
- Hotspot berjalan *degraded* (kartu tetap tampil) sampai `FIRMS_MAP_KEY` diisi di `.env` — tugas manusia H-1 (`docs/dev/09-DATA-PREP.md` §2). Jangan commit kunci.
- Ambang (`src/domain/thresholds.js`) dan `docs/THRESHOLDS.md` harus diubah bersamaan; test server memakai `fetchImpl` mock + `dataDir` sementara — jangan menulis ke `server/data/` dari test.
- Hazard registry (Sprint 3): modul baru = satu file murni di `src/domain/hazards/<id>.js` yang mengikuti kontrak `docs/dev/05-ARCHITECTURE.md` §2.1 dan didaftarkan di `src/domain/hazards/index.js` (id = tipe laporan warga = kunci i18n = feature flag); `tests/hazards.contract.test.js` memverifikasi bentuk hasil setiap modul secara otomatis. Cek cepat: `curl -s 'http://127.0.0.1:7455/api/hazards?location=takengon'`, `.../api/hazards?location=all`, `.../healthz`.
- Diseminasi: `node scripts/alerts-cron.mjs --dry-run` (tidak mengirim, tidak mengubah `server/data/alert-state.json`); aturan anti-kebisingan dan pemetaan CAP di `docs/THRESHOLDS.md` §13–14 — ubah `src/domain/alert.js` dan dokumen bersamaan. Jangan mengirim pesan Telegram nyata dari test (`send` di-inject).
- Anggaran kinerja: `npm run check:bundle` setelah `npm run build` (JS utama ≤ 150 kB gzip; saat ini ≈ 114 kB). Peta skematik memakai `src/data/geo/kecamatan.json` (GADM 4.1, 21 kB) — jangan ganti dengan tile/Leaflet tanpa lazy-load (ADR-24).
