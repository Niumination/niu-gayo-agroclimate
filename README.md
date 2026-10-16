# ☕ Niu Gayo Agro-Climate

> Sistem Presisi Cuaca Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi Aceh Tengah

## Latar Belakang
Dataran Tinggi Gayo (Kabupaten Aceh Tengah) merupakan produsen kopi Arabika organik terbesar di Indonesia. Variabilitas iklim mikro dan topografi pegunungan terjal membutuhkan sistem informasi cuaca beresolusi spasial tinggi untuk:
1. Menjaga produktivitas dan kualitas specialty coffee dari serangan penyakit karat daun (*Hemileia vastatrix*).
2. Memandu proses pascapanen penjemuran gabah/green bean dengan presisi radiasi matahari.
3. Melindungi warga dan petani dari bencana hidrometeorologi (tanah longsor di lereng perkebunan dan banjir luapan Danau Lut Tawar).

## Teknologi
- **Framework:** React 19 + Vite 8 (Rolldown/Oxc) + PWA
- **Styling:** Tailwind CSS 4 (konfigurasi CSS-first) — membutuhkan browser **Safari 16.4+ / Chrome 111+ / Firefox 128+** (Maret 2023 ke atas); perangkat lebih lama tetap dapat memakai rilis **v2.0.1** (tag git tersedia)
- **Data Engine:** Integrasi stream meteorologi resolusi tinggi ECMWF / WeatherNext 2–3; nowcast resmi BMKG (RSS CAP); NASA IMERG Late (sumber primer antecedent rainfall index, fallback model)
- **Test:** Native Node.js Test Runner

## Fitur (PRD F1–F8)
- Konsensus multi-model (F1), antecedent rainfall index (F2), PWA offline + i18n id-ID/Gayo + mode terang-gelap (F3), riwayat bencana per sentra (F4), nowcast resmi BMKG (F5), diseminasi Telegram (F6), kalender risiko musiman (F7), lapor warga dengan relay Telegram (F8).
- **v2.0.0 — multi-bahaya (Sprint 1–4, Okt 2026):** **Panel Indeks Bahaya** dari hazard registry **11 bahaya** dengan skala level seragam (`rendah < waspada < bahaya < ekstrem`), anjuran 4 kelompok (umum/rentan/kebun/sekolah), interaksi lintas-bahaya, tombol **Bagikan** (WhatsApp/SMS/salin) dan **Tentang data & batasan**:
  - *Hidrometeorologi:* tanah longsor (ARI + kelembapan tanah + lereng, dinaikkan setelah gempa M ≥ 5), **luapan DAS Peusangan v2** (indeks hujan hulu × anomali debit **GloFAS**), angin kencang, **petir & badai konvektif** (CAPE/LI ECMWF × GFS, hujan es, puting beliung).
  - *Atmosfer & kebakaran:* **kabut asap & kualitas udara** (ISPU estimasi CAMS, proksi jarak pandang), **bahaya kebakaran** (FWI System operasional × hotspot NASA FIRMS × HTH), **kekeringan** (HTH kelas BMKG, neraca air, **SPI-1/3** baseline 1991–2020, VPD).
  - *Geologi:* **gempa bumi** (BMKG TEWS, MMI indikatif per sentra, riwayat USGS 10 tahun), **Gunung Burni Telong** (tingkat aktivitas MAGMA/PVMBG, sektor bawah angin, radius rekomendasi).
  - *Agro-kopi:* **suhu ekstrem** (embun upas plato / stres panas saat berbunga), karat daun.
  - *Diseminasi & konteks:* peringatan **CAP 1.2** → Telegram (cron 30 menit + jalur cepat 5 menit gempa/vulkanik, anti-kebisingan), banner iklim ENSO/IOD + kalender musiman diperluas, riwayat kejadian, kontak darurat, laporan warga 11 tipe (+ `abu`, `gas`, `gempa`), laporan eksternal PetaBencana.id, **peta skematik SVG** 15 sentra.
  - Semua keluaran adalah *informasi pendukung berbasis model/satelit — bukan peringatan resmi*. Ambang: [`docs/reference/THRESHOLDS.md`](docs/reference/THRESHOLDS.md) §7–21 · validasi: [`docs/reference/VALIDATION.md`](docs/reference/VALIDATION.md) · arah berikutnya: [`docs/dev/10-ROADMAP-V3.md`](docs/dev/10-ROADMAP-V3.md).

### Endpoint API (server/index.js, :7455)
| Endpoint | Isi | Cache |
|---|---|---|
| `/api/weather?location=` · `/api/ensemble` · `/api/consensus` · `/api/alerts` · `/api/bmkg-nowcast` · `/api/reports` | v1 (lihat CHANGELOG 1.1–1.2) | 10–30 menit |
| `/api/air-quality?location=<id>\|all` | ISPU estimasi CAMS + proksi kabut asap + anjuran | 60 menit |
| `/api/hotspots?location=<id>` | hotspot FIRMS 48 jam ≤ 50 km dari sentra + ringkasan radius; `degraded` tanpa `FIRMS_MAP_KEY` | 30 menit |
| `/api/fire-danger?location=<id>\|all` | kode FWI hari ini + riwayat 7 hari + proyeksi D+1–2, hotspot, HTH, level & anjuran | 30 menit |
| `/api/drought?location=<id>\|all` | HTH (kelas BMKG, proyeksi), neraca air 30 hari, deret hujan 30 hari, **SPI-1/3**, VPD 7 hari | 12 jam (ikut arsip) |
| `/api/quakes[?location=<id>]` | gempa BMKG relevan (≤ 300 km / Aceh) + jarak & MMI indikatif per sentra | 2 menit |
| `/api/volcano` | tingkat aktivitas Burni Telong (MAGMA), angin puncak, sentra di bawah angin, radius rekomendasi | 60 menit |
| `/api/convective?location=<id>` | indeks konvektif ECMWF × GFS 12 jam (CAPE, LI, hembusan, hujan es, jam puncak) | 30 menit |
| `/api/flood` | debit GloFAS 4 sel DAS Peusangan + anomali terhadap klimatologi (median/p95) | 6 jam |
| `/api/external-reports` | laporan warga PetaBencana.id untuk Gayo (CC BY-NC 4.0) | 10 menit |
| `/api/seasonal?month=` | kalender musiman diperluas (fase kering, jendela embun upas, penyesuaian ENSO/IOD) | statis |
| `/api/hazards?location=<id>\|all` | **hazard registry**: 11 bahaya (longsor, banjir, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat) dengan level seragam, metrik, anjuran, sumber, `interactions[]`; `all` = ringkasan 15 sentra untuk peta (+ arsip harian) | 10 menit (`HAZARDS_TTL_MIN`) |
| `/api/alerts/feed[?format=cap&id=]` | peringatan aktif bergaya CAP 1.2 (JSON; per-id sebagai CAP XML untuk ekspor) | — |
| `POST /api/alerts/run[?dryRun=1&only=gempa,vulkanik]` | satu siklus diseminasi (anti-kebisingan → Telegram); header `x-cron-token` wajib dari luar loopback | — |
| `POST /api/cache/flush` | kosongkan seluruh cache dalam proses (operasional: setelah mengubah kunci/TTL); server hanya mendengar 127.0.0.1 | — |
| `/api/disaster-history?location=<id>[&hazard=<id>]` | riwayat kejadian terdokumentasi per sentra (+ hitungan per bahaya) | statis |
| `/healthz` | versi, fitur aktif, status per sumber data (umur cache, degraded) | — |

**Cron peringatan (Fase 1.8 / 2.1):** `node scripts/alerts-cron.mjs --dry-run` untuk uji; produksi: salin `server/agroclimate-alerts.{service,timer}` (tiap 30 menit, semua bahaya) dan `server/agroclimate-alerts-fast.{service,timer}` (tiap 5 menit, `--only gempa,vulkanik`) ke `~/.config/systemd/user/`, isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, `ALERTS_CRON_TOKEN` di EnvironmentFile server, lalu `systemctl --user enable --now agroclimate-alerts.timer agroclimate-alerts-fast.timer`. Aturan anti-kebisingan: [`docs/reference/THRESHOLDS.md`](docs/reference/THRESHOLDS.md) §13–14.
- Detail status & desain: repo `niu-gayo-agroclimate-docs` (DISASTER-DATA-RESEARCH.md, PLAN.md).

**Verifikasi rilis & keamanan:** `npm test` (321 uji), `npm run check:coverage` (gerbang ambang cakupan: baris ≥ 95 %, cabang ≥ 80 %, fungsi ≥ 92 % + tren vs baseline), `npm run check:bundle`, `npm run check:outlook` (gagal bila `climateOutlook.json` kedaluwarsa — perbarui dari rilis BMKG/NOAA CPC), `npm run check:i18n` (inventaris label Gayo yang menunggu tinjauan penutur asli), `npm run smoke`. CI menjalankan langkah-langkah itu plus `npm audit --omit=dev --audit-level=high`. Semua respons API memakai header keamanan dasar (`nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`); token cron dibandingkan constant-time. Kebijakan pelaporan: [`SECURITY.md`](SECURITY.md).

## 🌐 Live Site

**[cuaca.abstract.biz.id](https://cuaca.abstract.biz.id)** — dashboard produksi, di-serve dari
server LightVela cloud via Cloudflare Tunnel (domain `abstract.biz.id`).

- Frontend (`dist/`) di-serve `scripts/serve.py` di port 7444
- API `server/index.js` di port 7455 — di-forward tunnel di path `/api/*` dan `/healthz`
- Subdomain API terpisah: `cuaca-api.abstract.biz.id`

## Menjalankan Proyek

```bash
# Install dependencies
npm install

# Jalankan development server
npm run dev

# Jalankan pengujian
npm test

# Gerbang cakupan uji (baris ≥ 95 %, cabang ≥ 80 %, fungsi ≥ 92 %; cetak tren vs baseline)
npm run check:coverage

# Build production
npm run build

# Anggaran ukuran bundle (JS utama ≤ 150 kB gzip)
npm run check:bundle

# Smoke test server (15 endpoint + dry-run siklus peringatan; dipakai CI)
npm run smoke

# Validasi musiman dari arsip harian (POD/FAR/rasio aktif) — lihat docs/reference/VALIDATION.md
npm run validate:season -- --days 120 --events docs/validation/events-template.json

# Klimatologi (artefak di server/clim/, cukup 1×/tahun; Open-Meteo membatasi laju → jalankan jarang)
npm run clim:flood && npm run clim:spi
```

## Dokumentasi

Peta lengkap mengikuti empat kuadran Diátaxis ada di **[`docs/README.md`](docs/README.md)**:

| Kebutuhan | Buka |
|---|---|
| mulai dari nol (10 menit) | [`docs/tutorials/01-jalankan-lokal.md`](docs/tutorials/01-jalankan-lokal.md) |
| mengerjakan sebuah tugas (deploy, Telegram, outlook, ambang, sumber data, validasi, label Gayo) | [`docs/how-to/`](docs/how-to/) |
| mencari angka/parameter (endpoint, `.env`, perintah npm, ambang) | [`docs/reference/`](docs/reference/) |
| memahami alasan desain & batasan | [`docs/explanation/`](docs/explanation/) |
| arsip riset 10 iterasi & roadmap | [`docs/dev/README.md`](docs/dev/README.md) |

## Rencana pengembangan multi-bahaya
Dokumen perencanaan perluasan ke semua jenis mitigasi bencana (kabut asap karhutla, kebakaran, gempa, vulkanik, kekeringan, suhu ekstrem, banjir, konvektif, kesehatan) ada di [`docs/dev/README.md`](docs/dev/README.md) — PRD, roadmap (status per butir), sumber data, arsitektur/ADR (+ realisasi §5), ambang, risk register, tata kelola, dan arah v3 (`10-ROADMAP-V3.md`). Butir yang masih menunggu manusia: `FIRMS_MAP_KEY`, token Telegram + aktivasi timer, VAPID (Web Push), tag `v2.0.0`, verifikasi nomor kecamatan, data kejadian BPBD (`docs/templates/surat-pengantar-BPBD.md`).
