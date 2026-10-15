# Katalog Sumber Data Multi-Hazard

Versi 1.0 (final — 10 iterasi riset) · 2026-10-14. Kolom **Uji** = dipanggil langsung dari sandbox pada tanggal tersebut.
Kriteria pemilihan: gratis · publik · dapat diotomasi (JSON/CSV/XML) · lisensi jelas · tanpa dependensi berat di server.

## A. Sudah dipakai (baseline v1.2.0)
| Sumber | Endpoint | Variabel | Resolusi/Refresh | Lisensi | Uji |
|---|---|---|---|---|---|
| Open-Meteo Forecast (ECMWF IFS 0,25°) | `api.open-meteo.com/v1/forecast?models=ecmwf_ifs025` | T, RH, hujan, angin, gusts, leaf wetness, soil moisture, DNI | 0,25°, jam-an, 3 hari | CC BY 4.0 (non-komersial gratis) | ✅ |
| Open-Meteo Ensemble | `ensemble-api.open-meteo.com` | ECMWF 50 member, WN2 64 member | 3–15 hari | idem | ✅ |
| NASA GPM IMERG Late | OPeNDAP GES DISC (Earthdata token) | Hujan harian satelit (ARI) | 0,1°, D-1 | NASA open | ✅ (token) |
| BMKG Nowcast CAP | `bmkg.go.id/alerts/nowcast/id` (RSS) | Peringatan dini cuaca | 10 menit | Atribusi BMKG | ✅ |
| Telegram Bot API | sendMessage | Diseminasi | — | — | ✅ |

## B. Baru — Fase 1 (Asap & Kebakaran)
| Sumber | Endpoint | Variabel | Resolusi/Refresh | Lisensi/Kuota | Uji | Catatan |
|---|---|---|---|---|---|---|
| **Open-Meteo Air Quality** (CAMS global) | `air-quality-api.open-meteo.com/v1/air-quality?domains=cams_global` | `pm2_5, pm10, carbon_monoxide, aerosol_optical_depth, dust, us_aqi, european_aqi` current + hourly 5 hari | 0,4° (~45 km), 3-jam-an diinterpolasi jam-an; CAMS global update 12 jam | CC BY 4.0; 10.000/hari, 600/menit | ✅ 14 Okt: PM2.5 17,1 · AOD 1,06 · CO 401 | **Estimasi model, bukan pengukuran**; AOD/CO pendamping |
| **Open-Meteo Forecast `best_match`** | `api.open-meteo.com/v1/forecast` (tanpa `models=`) | `visibility` (m), `cape` | jam-an | idem | ✅ 4.140–8.460 m | ECMWF tidak punya `visibility` |
| **NASA FIRMS Area API** | `firms.modaps.eosdis.nasa.gov/api/area/csv/{MAP_KEY}/{VIIRS_SNPP_NRT\|VIIRS_NOAA20_NRT\|VIIRS_NOAA21_NRT\|MODIS_NRT}/{bbox}/{days}` | lat, lon, bright_ti4, frp, confidence, acq_date/time, daynight | VIIRS 375 m / MODIS 1 km; NRT ≈ 3 jam setelah lintasan | Gratis; MAP_KEY; 5.000 transaksi/10 menit | ⚠️ butuh kunci (`Invalid MAP_KEY` tanpa kunci) | bbox Aceh Tengah + 50 km ≈ `96.1,3.9,97.5,5.2` |
| **FWI System in-house** | dihitung dari Open-Meteo ECMWF harian | FFMC, DMC, DC, ISI, BUI, FWI | harian (jam 12–13 WIB) | — | — | Spin-up via Open-Meteo **Archive API** (ERA5) 60 hari |
| **Open-Meteo Archive (ERA5-Land/ERA5)** | `archive-api.open-meteo.com/v1/archive?daily=precipitation_sum,temperature_2m_max,temperature_2m_min,relative_humidity_2m_mean,wind_speed_10m_max,et0_fao_evapotranspiration` | Deret harian historis | 0,1° (ERA5-Land), tertinggal ~2–5 hari | idem | ✅ 14 Okt: 73 hari (1 Agu–12 Okt 2026) lengkap; Agu 74,7 mm, Sep 245,6 mm | Spin-up FWI 60 hari, HTH, neraca air, SPI (baseline 1991–2020) |
| SiPongi KLHK | `sipongi.menlhk.go.id` (UI, XLSX/KMZ) | Hotspot 4 satelit + status lahan | 30 menit | Publik, tanpa API | — | **Rujukan/atribusi**, bukan sumber mesin |
| ISPU KLH | `ispu.kemenlh.go.id` | ISPU stasiun AQMS | jam-an | Publik | — | Tidak ada stasiun di Aceh Tengah; pakai untuk validasi (stasiun terdekat) |
| BMKG citra sebaran asap (Himawari) | halaman web BMKG / Stamet | Peta sebaran asap | 1–3 jam | Atribusi | — | Tidak ada API; tautan sebagai rujukan di kartu |

## C. Baru — Fase 2–3 (kandidat, diverifikasi pada iterasi berikut)
| Sumber | Endpoint | Untuk hazard | Uji | Status |
|---|---|---|---|---|
| **BMKG Gempa** | `data.bmkg.go.id/DataMKG/TEWS/autogempa.json`, `gempadirasakan.json` (15 terasa, field `Dirasakan` MMI), `gempaterkini.json` (15 M≥5); shakemap `data.bmkg.go.id/DataMKG/TEWS/{Shakemap}` | H-GEMPA | ✅ 14 Okt: ketiganya JSON valid | Publik tanpa kunci; refresh ~1–5 menit; atribusi BMKG |
| **USGS FDSN Event** | `earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&latitude=4.63&longitude=96.85&maxradiuskm=300&minmagnitude=4` | H-GEMPA (riwayat/pelengkap) | ✅ 67 kejadian M≥4 / 12 bulan | Publik; rate-limit wajar; untuk riwayat & kalibrasi, bukan peringatan utama |
| **MAGMA Indonesia (PVMBG)** | Halaman publik `magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas` (HTML; seksi Level IV→I; tautan laporan bertanda tangan) | H-VULKANIK (Bur Ni Telong) | ✅ 14 Okt: "Bur Ni Telong – Aceh" di seksi **Level II (Waspada)** | **API `/api/v1/vona` 401, `/v1/vona/list` 403** → parser HTML + fixture + degraded; ajukan akses resmi |
| **Open-Meteo GFS (`gfs_seamless`)** | `api.open-meteo.com/v1/forecast?models=gfs_seamless&hourly=cape,lifted_index` | H-PETIR (LI; pembanding CAPE) | ✅ 14 Okt: CAPE 310 J/kg, LI −2,3 (vs ECMWF CAPE 2.090 → ketidaksepakatan besar) | ECMWF via Open-Meteo tidak punya `lifted_index`/CIN/freezing level |
| Open-Meteo ECMWF (`cape`, `weather_code`, `showers`, `wind_gusts_10m`) | endpoint yang sudah dipakai | H-PETIR / H-ANGIN+ | ✅ | tambah variabel ke query yang ada (tanpa call baru) |
| Open-Meteo (angin di puncak Burni Telong 4,769 N 96,821 E) | `wind_direction_10m`, `wind_speed_10m` (+ level tekanan 850 hPa bila dipakai) | H-VULKANIK sektor abu | ⏳ Fase 2 | Variabel level tekanan tersedia di Open-Meteo |
| **Open-Meteo Flood API (GloFAS v4)** | `flood-api.open-meteo.com/v1/flood?daily=river_discharge,river_discharge_mean,river_discharge_p75,river_discharge_max&past_days=7&forecast_days=7` | H-BANJIR+ (debit & anomali) | ✅ 14 Okt: sel Takengon 6,4–25,1 m³/s; Lut Tawar 4,9–16,5; Bintang 2,2–6,5; Angkup 1,2–4,3 | 0,05° (~5,5 km), harian, ensemble; historis sejak 1984 untuk klimatologi; CC BY 4.0 |
| BMKG prediksi musim / ENSO-IOD / HTH dasarian | Rilis pers & web Staklim Aceh (tanpa API) | Konteks iklim (banner), validasi HTH | ✅ kurasi: El Niño sangat kuat (+3,44) & IOD + (0,935), musim hujan 2026/27 terlambat, puncak Des–Feb | Kurasi manual ke `climateOutlook.json` tiap dasarian/bulan |
| **PetaBencana.id Open API** | `api.petabencana.id/reports?admin=ID-AC&timeperiod=604800&geoformat=geojson` (wajib `User-Agent`); jenis `flood,earthquake,fire,haze,wind,volcano`; `/floodgauges` | Laporan masyarakat eksternal | ✅ 14 Okt: 5 laporan banjir Aceh 7 hari (Gayo Lues, Tamiang, Tenggara); 54 haze nasional | CC BY-NC 4.0; `tags.region_code` = kode BPS (Aceh Tengah 1104) |
| SIHKA PUPR (pos hidrologi/AWLR telemetri B/BWS) | `gis.pusair-pu.go.id` | Muka air terukur (jika ada pos Lut Tawar/Peusangan) | ⏳ verifikasi | Potensi menghapus label "indeks" |
| InaRISK BNPB | `inarisk.bnpb.go.id` (ArcGIS REST) | Peta indeks risiko per bahaya (statis) | ⏳ iterasi 9 | Untuk konteks kerentanan per kecamatan |

## D. Prinsip penanganan sumber (berlaku untuk semua fetcher baru)
1. Timeout 15 s, retry 2× eksponensial, cache SWR dengan TTL per sumber, **tidak pernah throw** ke router → `{ degraded:true, error }`.
2. Setiap respons membawa `source`, `retrievedAt`, `model`/`sensor`, `license`.
3. Kunci API hanya di server (env / `~/.hermes/.env`), tidak pernah di bundle.
4. Kuota harian dipantau di `/healthz` (`quota: { openMeteoAq: n/10000 }`).
5. Fixture respons disimpan di `tests/fixtures/` untuk parser (CSV FIRMS, JSON BMKG, JSON CAMS).

## Tambahan iterasi 8–10

| Sumber | Bahaya | Akses | Status | Catatan |
|---|---|---|---|---|
| Sensor PM2,5 murah (Puskesmas/sekolah mitra) | H-ASAP | `POST /api/sensors` (token per perangkat) | ⏳ Fase 4 | Tidak ada AQMS resmi di Aceh Tengah (jawaban Q2); pembanding ISPU estimasi |
| Kemenkes Pusat Krisis / SE Mei 2026 | H-ASAP (kesehatan) | Statis (tabel anjuran) | ✅ dikurasi | Rujukan ambang sekolah 101/201/300 |
| GADM 4.1 level 3 (kecamatan) | Peta | Unduh sekali → `src/data/geo/kecamatan.json` (≤ 50 kB, mapshaper) | ⏳ Fase 1 | Non-komersial; ganti BIG bila komersial |
| InaRISK BNPB | Konteks risiko | Tautan/ArcGIS REST (tidak runtime) | 🔗 rujukan | Peta indeks risiko per bahaya |
| BNPB "Perkembangan Situasi" (harian) | Riwayat semua bahaya | Kurasi manual → `disasterHistory.json` | ✅ | Karhutla Ketol & Celala 2026, Wih Pesam 2026 |

## Lisensi ringkas
Lihat `08-STAKEHOLDERS-GOVERNANCE.md` §4 (Open-Meteo CC BY 4.0; FIRMS bebas; BMKG/PVMBG atribusi; PetaBencana CC BY-NC; GADM non-komersial).

## Status kesiapan aset (14 Okt 2026) — rincian di `09-DATA-PREP.md`
| Kelompok | Status |
|---|---|
| Open-Meteo (AQ, best_match, GFS, ECMWF konvektif, Archive, Flood), BMKG gempa ×3, USGS, MAGMA HTML, PetaBencana, BMKG nowcast RSS | ✅ Fixture nyata tersimpan di `tests/fixtures/hazards/`; skrip pembaru `scripts/fetch-hazard-fixtures.mjs` |
| NASA FIRMS | 🔑 Menunggu `FIRMS_MAP_KEY` (tugas manusia H-1); contoh sintetis untuk parser tersedia |
| FWI in-house | ✅ Prototipe = dataset uji resmi `cffdrs` 48 hari (selisih ≤ 0,005) |
| GADM kecamatan | ✅ `src/data/geo/kecamatan.json` (21 kB) |
| Data statis kurasi (kesehatan, iklim, riwayat, kontak) | ✅ Draf di `src/data/hazards/`; kontak kecamatan & teks Gayo menunggu pengisian manusia |
| SPBK Staklim, AWLR, sensor PM2,5, ISPU resmi | ⏳ Bergantung mitra |
