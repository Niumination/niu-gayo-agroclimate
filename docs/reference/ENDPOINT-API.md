# Referensi: endpoint HTTP

**Kuadran:** reference (cari, bukan dibaca berurutan) · Server: `server/index.js` + `server/routes.js`, default port **7455** (`PORT`).

Semua endpoint menerima **GET** kecuali disebut lain. `location` = id sentra dari `src/data/locations.js` (mis. `takengon`, `ketol`) atau `all` bila didukung. Permintaan dengan `location` tidak dikenal → `400`.

## 1. Cuaca & konsensus (v1)

| Endpoint | Isi | TTL cache |
|---|---|---|
| `/api/weather?location=<id>` | cuaca kini + fitur turunan (antecedent rainfall index, dll.) | `PROXY_TTL_MIN` (10) |
| `/api/ensemble?location=<id>` | konsensus multi-model (sebaran antar model) | `ENSEMBLE_TTL_MIN` (30) |
| `/api/consensus?location=<id>` | ringkasan konsensus (label keyakinan) | `WN2_TTL_MIN` (30) |
| `/api/alerts?location=<id>` | peringatan cuaca gaya lama (sebelum registry bahaya) | `ALERTS_TTL_MIN` (10) |
| `/api/bmkg-nowcast` | nowcast resmi BMKG (RSS CAP) untuk Aceh | `BMKG_TTL_MIN` (10) |

## 2. Bahaya per jenis

| Endpoint | Isi | TTL cache | Catatan |
|---|---|---|---|
| `/api/air-quality?location=<id>\|all` | ISPU estimasi CAMS + proksi kabut asap + anjuran | `AQ_TTL_MIN` (60) | `all` = ringkasan 15 sentra (dipakai peta) |
| `/api/hotspots?location=<id>` | hotspot FIRMS 48 jam ≤ 50 km dari sentra | `FIRMS_TTL_MIN` (30) | *degraded* tanpa `FIRMS_MAP_KEY`; **0 hotspot = `degraded:false`** + `summary` berlevel `rendah` (bukan error); `?all` memuat `counts` + `perLocation` 15 sentra |
| `/api/fire-danger?location=<id>\|all` | kode FWI hari ini + 7 hari + proyeksi D+1–2 + HTH | `ARCHIVE_TTL_MIN` (720) | arsip ERA5 tertinggal 1–2 hari |
| `/api/drought?location=<id>\|all` | HTH, neraca air 30 hari, deret hujan, **SPI-1/3**, VPD 7 hari | `ARCHIVE_TTL_MIN` | SPI dari `server/clim/spi-baseline.json` |
| `/api/quakes[?location=<id>]` | gempa BMKG relevan (≤ 300 km / Aceh) + jarak & MMI indikatif | `QUAKE_TTL_MIN` (2) | radius: `QUAKE_RADIUS_KM` (300) |
| `/api/volcano` | tingkat aktivitas Burni Telong (MAGMA) + sentra bawah angin + radius rekomendasi | `VOLCANO_TTL_MIN` (60) | parser HTML; *last-good* ≤ `MAGMA_STALE_DAYS` |
| `/api/convective?location=<id>` | indeks konvektif ECMWF × GFS 12 jam (CAPE, LI, hembusan, hujan es) | `CONVECTIVE_TTL_MIN` (30) | |
| `/api/flood` | debit GloFAS 4 sel DAS Peusangan + anomali vs klimatologi | `FLOOD_TTL_MIN` (360) | label **model**, bukan muka air terukur |
| `/api/external-reports` | laporan warga PetaBencana.id untuk Gayo | `PETABENCANA_TTL_MIN` (10) | CC BY-NC 4.0 — tampil saja, bukan kebenaran lapangan |

## 3. Registry bahaya & peringatan

| Endpoint | Isi |
|---|---|
| `/api/hazards?location=<id>\|all` | **11 bahaya** dengan level seragam, metrik, anjuran (umum/rentan/kebun/sekolah), sumber, `interactions[]`; `all` = ringkasan 15 sentra + **penulisan arsip harian** |
| `/api/alerts/feed[?hours=&location=&hazard=&id=&format=]` | peringatan bergaya CAP 1.2. `format=cap` → **CAP 1.2 XML** (satu peringatan, `id` opsional), selain itu JSON. `hours` 1…336 (default 24) |
| `POST /api/alerts/run[?dryRun=1&only=gempa,vulkanik]` | menjalankan siklus peringatan (dipakai `scripts/alerts-cron.mjs`). `dryRun` tidak mengirim & tidak mengubah state; `only` = jalur cepat per bahaya |
| `/api/reports` | **GET** riwayat laporan warga 7 hari (`?location=`); **POST** kirim laporan (validasi + rate limit **5/jam/IP**, payload ≤ 10 kB) → `201` |
| `/api/seasonal?month=<1-12>` | kalender musiman diperluas (fase kering, jendela embun upas, penyesuaian ENSO/IOD) |
| `/api/disaster-history?location=<id>[&hazard=<id>]` | riwayat kejadian terkurasi per sentra + ringkasan per bahaya |

## 4. Operasional

| Endpoint | Isi |
|---|---|
| `/healthz` | `ok`, `version`, `uptime`, `cache`, `features` (`hazardsEnabled`, `firmsKey`, `telegram`, `cronToken`), `sources.*` = `{ state: ok \| degraded \| belum-dimuat, fresh, retrievedAt, error }`. **Tidak memicu fetch** — membaca isi cache |
| `POST /api/cache/flush` | mengosongkan cache (butuh akses loopback; dipakai saat debugging) |

## Kontrak & keamanan

- **Header keamanan** pada **semua** respons (JSON maupun CAP XML): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`.
- **`POST /api/alerts/run`**: bila `ALERTS_CRON_TOKEN` terisi, wajib header `x-cron-token` (dibandingkan constant-time). Salah → `403`; metode salah → `405`.
- **Pola degraded**: sumber yang gagal **tidak** membuat endpoint `5xx`. Bentuk responsnya tetap, dengan `degraded: true` + `error`, dan bila ada nilai terakhir tersimpan maka nilai itu dipakai beserta `retrievedAt`. Uji `scripts/smoke.mjs` menegakkan aturan ini.
- **Status kode**: `200` normal · `201` laporan dibuat · `400` parameter salah · `403` token cron · `404` tidak ditemukan · `405` metode salah · `413` payload terlalu besar · `429` rate limit laporan · `502` galat internal saat menangani permintaan.
- **Kontrak hasil bahaya** (dipakai `/api/hazards`): `{ id, label, group, level, levelLabel, score, headline, detail, metrics[], advice{umum,rentan,kebun,sekolah}, sources[], flags, degraded, validUntil, evaluatedAt }`. Level: `n/a < rendah < waspada < bahaya < ekstrem`.

Lihat juga: [KONFIGURASI-ENV.md](KONFIGURASI-ENV.md) (TTL & kunci) · [SKRIP-NPM.md](SKRIP-NPM.md) (smoke & gerbang) · [THRESHOLDS.md](THRESHOLDS.md) §13–14 (kapan peringatan dikirim)
