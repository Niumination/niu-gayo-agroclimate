# ☕ Niu Gayo Agro-Climate

> Sistem Presisi Cuaca Pertanian Kopi Arabika Gayo & Mitigasi Bencana Hidrometeorologi Aceh Tengah

## Latar Belakang
Dataran Tinggi Gayo (Kabupaten Aceh Tengah) merupakan produsen kopi Arabika organik terbesar di Indonesia. Variabilitas iklim mikro dan topografi pegunungan terjal membutuhkan sistem informasi cuaca beresolusi spasial tinggi untuk:
1. Menjaga produktivitas dan kualitas specialty coffee dari serangan penyakit karat daun (*Hemileia vastatrix*).
2. Memandu proses pascapanen penjemuran gabah/green bean dengan presisi radiasi matahari.
3. Melindungi warga dan petani dari bencana hidrometeorologi (tanah longsor di lereng perkebunan dan banjir luapan Danau Lut Tawar).

## Teknologi
- **Framework:** React 19 + Vite 6 (PWA)
- **Styling:** Tailwind CSS
- **Data Engine:** Integrasi stream meteorologi resolusi tinggi ECMWF / WeatherNext 2–3; nowcast resmi BMKG (RSS CAP); NASA IMERG Late (sumber primer antecedent rainfall index, fallback model)
- **Test:** Native Node.js Test Runner

## Fitur (PRD F1–F8)
- Konsensus multi-model (F1), antecedent rainfall index (F2), PWA offline + i18n id-ID/Gayo + mode terang-gelap (F3), riwayat bencana per sentra (F4), nowcast resmi BMKG (F5), diseminasi Telegram (F6), kalender risiko musiman (F7), lapor warga dengan relay Telegram (F8).
- **v2 (Fase 1, dalam pengembangan):** kartu **Kabut Asap & Kualitas Udara** — ISPU estimasi (Permen LHK P.14/2020) dari CAMS global via `GET /api/air-quality`, proksi kabut asap dari jarak pandang siang, anjuran kesehatan 4 kelompok; kartu **Bahaya Kebakaran** — FWI System operasional (pengamatan 12.00 WIB, spin-up arsip ERA5 90 hari, proyeksi 2 hari) × hotspot NASA FIRMS (butuh `FIRMS_MAP_KEY`, degraded tanpa kunci) × HTH via `GET /api/fire-danger` + `GET /api/hotspots`; kartu **Kekeringan** — Hari Tanpa Hujan kelas BMKG, proyeksi, neraca air 30 hari via `GET /api/drought`; laporan warga tipe `asap`/`kebakaran`; status penjemuran "Tunda (asap)". Lihat [`docs/THRESHOLDS.md`](docs/THRESHOLDS.md) §7–12.

### Endpoint API (server/index.js, :7455)
| Endpoint | Isi | Cache |
|---|---|---|
| `/api/weather?location=` · `/api/ensemble` · `/api/consensus` · `/api/alerts` · `/api/bmkg-nowcast` · `/api/seasonal` · `/api/disaster-history` · `/api/reports` | v1 (lihat CHANGELOG 1.1–1.2) | 10–30 menit |
| `/api/air-quality?location=<id>\|all` | ISPU estimasi CAMS + proksi kabut asap + anjuran | 60 menit |
| `/api/hotspots?location=<id>` | hotspot FIRMS 48 jam ≤ 50 km dari sentra + ringkasan radius; `degraded` tanpa `FIRMS_MAP_KEY` | 30 menit |
| `/api/fire-danger?location=<id>\|all` | kode FWI hari ini + riwayat 7 hari + proyeksi D+1–2, hotspot, HTH, level & anjuran | 30 menit |
| `/api/drought?location=<id>\|all` | HTH (kelas BMKG, proyeksi), neraca air 30 hari, deret hujan 30 hari | 12 jam (ikut arsip) |
- Detail status & desain: repo `niu-gayo-agroclimate-docs` (DISASTER-DATA-RESEARCH.md, PLAN.md).

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

# Build production
npm run build
```

## Rencana pengembangan multi-bahaya
Dokumen perencanaan perluasan ke semua jenis mitigasi bencana (kabut asap karhutla, kebakaran, gempa, vulkanik, kekeringan, suhu ekstrem, banjir, konvektif, kesehatan) ada di [`docs/dev/README.md`](docs/dev/README.md) — PRD, roadmap, sumber data, arsitektur/ADR, ambang, risk register, tata kelola.
