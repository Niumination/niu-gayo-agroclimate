# Referensi: variabel lingkungan (`.env`)

**Kuadran:** reference · Berkas contoh: [`.env.example`](../../.env.example) · Dibaca oleh `server/config.js`, `server/*.js`, dan unit systemd (`EnvironmentFile=`).

> **Format aman-systemd:** hanya baris `KUNCI=nilai` yang dibaca; komentar harus berdiri di barisnya sendiri (komentar di ujung baris ikut menjadi bagian nilai). Jangan commit `.env`.

## Wajib / penting

| Variabel | Default | Fungsi |
|---|---|---|
| `PORT` | `7455` | port API |
| `ALERTS_CRON_TOKEN` | *(kosong)* | **Wajib bila `/api/alerts/run` dapat dipanggil dari luar loopback**; header `x-cron-token`, dibandingkan constant-time |
| `TELEGRAM_BOT_TOKEN` | *(kosong)* | kirim peringatan (H-7) |
| `TELEGRAM_HOME_CHANNEL` | *(kosong)* | id kanal/grup tujuan |
| `TELEGRAM_CRON_THREAD_ID` | `55` | topik (thread) di grup forum |
| `FIRMS_MAP_KEY` | *(kosong)* | hotspot NASA FIRMS (H-1); tanpa ini kartu hotspot *degraded* |
| `PUBLIC_URL` | `https://cuaca.abstract.biz.id/` | tautan yang disisipkan di pesan peringatan |
| `API_BASE` | `http://127.0.0.1:7455` | alamat API yang dipanggil `scripts/alerts-cron.mjs` |

## Cache / TTL (menit)

| Variabel | Default | Untuk |
|---|---|---|
| `PROXY_TTL_MIN` | `10` | `/api/weather` |
| `ENSEMBLE_TTL_MIN` | `30` | `/api/ensemble` |
| `ALERTS_TTL_MIN` | `10` | `/api/alerts` |
| `WN2_TTL_MIN` | `30` | `/api/consensus` |
| `BMKG_TTL_MIN` | `10` | `/api/bmkg-nowcast` |
| `HAZARDS_TTL_MIN` | `10` | `/api/hazards` |
| `AQ_TTL_MIN` | `60` | kualitas udara (CAMS diperbarui ± 2×/hari; turunkan ke `20` saat episode asap) |
| `FIRMS_TTL_MIN` | `30` | hotspot (kuota 5.000 transaksi/10 menit) |
| `ARCHIVE_TTL_MIN` | `720` | arsip ERA5 (FWI/HTH/SPI/VPD) |
| `FLOOD_TTL_MIN` | `360` | debit GloFAS |
| `CONVECTIVE_TTL_MIN` | `30` | indeks konvektif |
| `QUAKE_TTL_MIN` | `2` | gempa BMKG (jalur cepat 5 menit) |
| `VOLCANO_TTL_MIN` | `60` | status MAGMA |
| `PETABENCANA_TTL_MIN` | `10` | laporan eksternal |

## Perilaku & jalur data

| Variabel | Default | Fungsi |
|---|---|---|
| `HAZARDS_ENABLED` | `*` | daftar id bahaya dipisah koma; kosong = panel nonaktif |
| `VITE_HAZARDS_ENABLED` | *(kosong)* | versi klien (dibaca saat **build**) untuk membatasi panel |
| `ARCHIVE_DAYS` | `92` | rentang arsip ERA5 (spin-up FWI 90 hari + ≥ 61 hari agar kelas HTH “Ekstrem” terdeteksi) |
| `ARCHIVE_MAX_LAG_DAYS` | `7` | lag arsip melebihi ini → payload `degraded` |
| `QUAKE_RADIUS_KM` | `300` | radius relevansi gempa per sentra |
| `FIRMS_BBOX` | `96.1,3.9,97.5,5.2` | kotak batas hotspot |
| `FIRMS_SOURCES` | `VIIRS_SNPP_NRT,VIIRS_NOAA20_NRT,VIIRS_NOAA21_NRT,MODIS_NRT` | sensor FIRMS |
| `FIRMS_DAYS` | `2` | jendela hari hotspot — **1–5** (batas API FIRMS Area; di luar rentang dijepit otomatis oleh `clampFirmsDays`, `server/firms.js`) |
| `MAGMA_STALE_DAYS` | `7` | umur maksimum nilai MAGMA tersimpan yang boleh dipakai saat fetch gagal |
| `VOLCANO_OVERRIDE_PATH` | *(kosong)* | JSON manual `{burniTelong:{level,asOf,source,force}}` bila parser MAGMA berubah |
| `HAZARD_ARCHIVE_DIR` | *(kosong = `server/data/hazard-archive`)* | lokasi arsip harian untuk validasi |
| `BUNDLE_MAX_KB` / `BUNDLE_TOTAL_MAX_KB` | `150` / `200` | anggaran bundle yang diperiksa `npm run check:bundle` |

## URL dasar sumber data (opsional)

`OPEN_METEO_AIR_QUALITY`, `OPEN_METEO_ARCHIVE`, `OPEN_METEO_FLOOD`, `BMKG_QUAKE_BASE`, `MAGMA_URL`, `PETABENCANA_API`, `FIRMS_API` — semuanya punya default bawaan di `server/config.js`; isi hanya untuk uji/mirror.

## Belum dibaca kode (rencana v3 — jangan diisi dulu)

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `PUSH_MIN_LEVEL` (Web Push, **H-9**) · `SENSOR_TOKENS` (sensor PM2,5 mitra, Fase 4.3).

## Bukan env

- **NASA IMERG (Earthdata):** token dibaca dari `~/.netrc` (baris `machine urs.earthdata.nasa.gov`), bukan variabel lingkungan — lihat `server/imerg.js`.
  Sejak F-05 (2.2.5) kegagalannya dibedakan dan dilaporkan apa adanya di `/healthz.sources.imerg` dan
  `fallbackReason` tiap sentra:
  - `IMERG dialihkan ke login Earthdata (HTTP 302 …)` → token tidak terpasang/ditolak; periksa `~/.netrc`
    (baris diawali `machine urs.earthdata.nasa.gov` dan memuat token Earthdata yang masih berlaku).
  - `IMERG auth gagal (HTTP 401/403 …)` → token kedaluwarsa/dicabut.
  - `IMERG membalas halaman HTML (login)` → token diterima sebagai header tetapi tidak berlaku.
  - `IMERG tidak dapat dijangkau dari host ini (…)` → egress/ TLS ke `gpm1.gesdisc.eosdis.nasa.gov`
    diblokir dari host tersebut (bukan soal token). Berhenti setelah 2 tanggal, bukan 12.
  - `IMERG granule belum terbit (HTTP 404)` → benar-benar data kosong (bukan galat).
- **Telegram alternatif:** bila variabel tidak ada di lingkungan, server juga membaca `~/.hermes/.env`.

Lihat juga: [ENDPOINT-API.md](ENDPOINT-API.md) · [SKRIP-NPM.md](SKRIP-NPM.md) · `docs/dev/04-DATA-SOURCES.md` (katalog & lisensi sumber)
