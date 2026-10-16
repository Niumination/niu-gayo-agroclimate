# How-to: mengaktifkan & memverifikasi hotspot NASA FIRMS

**Kuadran:** how-to (tugas) · **Audiens:** maintainer (tugas manusia **H-1**) · Kode: `server/firms.js`, `src/domain/hazards/hotspots.js`.

Tanpa `FIRMS_MAP_KEY`, blok hotspot di kartu “Bahaya Kebakaran” berjalan **degraded** dengan pesan “kunci belum diatur”. Panduan ini menutup celah itu: dari kunci sampai verifikasi, termasuk arti **nol hotspot** (yang sering disalahartikan sebagai error).

## 1. Ambil kunci (gratis, sekali)

1. Buka <https://firms.modaps.eosdis.nasa.gov/api/map_key/> (butuh email; kunci dikirim/ditampilkan langsung).
2. Simpan kunci — perlakukan seperti kata sandi.

## 2. Pasang HANYA di server (jangan pernah di repo)

```bash
cd ~/niumination/niu-gayo-agroclimate
$EDITOR .env                       # berkas ini sudah ada di .gitignore
# tambahkan satu baris:
FIRMS_MAP_KEY=<kunci-anda>
systemctl --user restart agroclimate-api.service
```

Aturan yang tidak boleh dilanggar:

- **Jangan** menaruh kunci di kode, `dist/`, atau pesan Telegram — semua berkas itu publik.
- **Jangan** commit `.env`. Bila tidak sengaja ter-commit, ganti kunci dari halaman yang sama (kunci lama tidak bisa dicabut, hanya bisa diganti).
- Kunci juga **tidak** boleh masuk paket pengiriman (zip/bundle/manifest) — verifikasi cepat: `grep -rc "$FIRMS_MAP_KEY" . --exclude-dir=node_modules --exclude-dir=.git` harus **0**.

## 3. Verifikasi (3 tingkat)

```bash
# a. server melihat kuncinya
curl -s http://127.0.0.1:7455/healthz | python3 -c 'import json,sys;print(json.load(sys.stdin)["features"])'
#    harapan: {'firmsKey': True, ...}

# b. sumber benar-benar menjawab (panggilan pertama memakan beberapa detik)
curl -s 'http://127.0.0.1:7455/api/hotspots?location=takengon' \
  | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["degraded"], d.get("reason"), d.get("summary"))'
#    harapan: False None {'id':'takengon', ..., 'level':'rendah'}

# c. setelah satu panggilan, /healthz menandai sumber "ok"
curl -s http://127.0.0.1:7455/healthz | python3 -c 'import json,sys;print(json.load(sys.stdin)["sources"]["hotspots"])'
#    harapan: {'state': 'ok', 'fresh': True, 'retrievedAt': '...'}
```

**Nol hotspot bukan error.** Bila keempat sumber sukses tetapi tidak ada deteksi, respons tetap `degraded: false` dengan `counts.total = 0` dan 15 sentra berlevel `rendah`. Yang menandakan masalah adalah `degraded: true` + `reason` berisi pesan (mis. “FIRMS_MAP_KEY belum diatur”) atau `warnings[]` dari sumber yang gagal.

## 4. Batas & kuota (pelajaran dari uji langsung, 16 Okt 2026)

| Hal | Nilai | Catatan |
|---|---|---|
| Rentang hari (`FIRMS_DAYS`) | **1–5** | API menolak > 5 dengan `HTTP 400 Invalid day range. Expects [1..5]`; kode **menjepit otomatis** (`clampFirmsDays`, `server/firms.js`) jadi salah isi tidak mematikan fitur — tapi tetap isi yang benar |
| Kuota | 5.000 transaksi / 10 menit per kunci | 4 sumber × 1 permintaan per refresh; TTL 30 menit → ≈ 8 permintaan/jam. Sangat longgar |
| Latensi data | ≈ 3 jam setelah lintasan satelit | `window.mainHours` 24 jam, `trendHours` 48 jam |
| Resolusi | VIIRS 375 m · MODIS 1 km | Keyakinan: VIIRS `n`/`h` lolos, MODIS ≥ 50 % |
| Cakupan | bbox `96.1,3.9,97.5,5.2` (Aceh Tengah + buffer ~50 km) | ubah lewat `FIRMS_BBOX`; jaga agar sentra tetap di dalam |

Penyetelan opsional: `FIRMS_SOURCES` (kurangi sumber = lebih hemat kuota), `FIRMS_TTL_MIN` (turunkan saat episode asap agar lebih cepat).

## 5. Menyegarkan fixture uji

```bash
# satu sumber saja (aman, cepat) — contoh bbox Gayo:
FIRMS_MAP_KEY=<kunci> node -e "…"   # atau curl manual ke /api/area/csv/<kunci>/VIIRS_SNPP_NRT/96.1,3.9,97.5,5.2/2

# SEMUA sumber sekaligus (Open-Meteo membatasi laju — jarang saja):
FIRMS_MAP_KEY=<kunci> node scripts/fetch-hazard-fixtures.mjs
```

Fixture nyata yang tersimpan saat ini (16 Okt 2026): `tests/fixtures/hazards/firms-viirs-snpp-gayo-2d.csv` (header saja — keadaan nyata “nol hotspot” di bbox Gayo) dan `firms-viirs-aceh-5d-REAL.csv` (2 deteksi nyata di Aceh bagian utara). Keduanya dipakai uji agar jalur “kunci aktif” tetap terbukti tanpa jaringan. Contoh sintetis lama dipertahankan karena uji lain bergantung pada nilai eksaknya.

## 6. Bila bermasalah

| Gejala | Sebab & solusi |
|---|---|
| `reason` menyebut “FIRMS_MAP_KEY belum diatur” | kunci tidak terbaca server — cek `.env`, lalu `systemctl --user restart agroclimate-api.service`; pastikan tidak ada spasi/kutip di nilai |
| Respons berisi `Invalid MAP_KEY` di `warnings[]` | kunci salah/typo. Halaman map_key menampilkan kunci; salin ulang |
| `warnings[]` menyebut HTTP 400 “day range” | `FIRMS_DAYS` di luar 1–5 pada versi lama; perbarui ke v2.1.0+ (sudah dijepit otomatis) |
| `degraded: true` tetapi `warnings[]` berisi HTTP 5xx | gangguan sementara di sisi NASA — biarkan; TTL 30 menit akan mencoba lagi, nilai terakhir tetap dipakai |
| Kartu menampilkan 0 hotspot padahal ada asap | hotspot adalah **anomali panas**, bukan asap; asap bisa datang dari luar bbox atau terbakar di bawah kanopi. Untuk verifikasi lapangan gunakan rujukan SiPongi/KLHK |

Lihat juga: [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md) · [../reference/ENDPOINT-API.md](../reference/ENDPOINT-API.md) · [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) §10 (ambang hotspot) · [../explanation/README.md](../explanation/README.md)
