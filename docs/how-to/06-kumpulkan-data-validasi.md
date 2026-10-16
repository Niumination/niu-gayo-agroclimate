# How-to: menyiapkan data validasi musiman (POD/FAR)

**Kuadran:** how-to (tugas) · **Audiens:** maintainer + mitra (BPBD/Pusdalops) · Protokol & definisi metrik: [../reference/VALIDATION.md](../reference/VALIDATION.md).

Validasi menjawab pertanyaan yang tak bisa dijawab uji unit: *apakah level “waspada” kita muncul pada hari-hari yang benar-benar berkejadian?* Ada dua masukan: **(a)** arsip level otomatis, **(b)** daftar kejadian terkurasi dari manusia.

## 1. Pastikan arsip harian terisi (otomatis)

Setiap kali `/api/hazards?location=all` dievaluasi — yaitu setiap siklus cron 30 menit — server menambah satu snapshot per sentra per jam ke:

```
server/data/hazard-archive/YYYY-MM-DD.json
{ at, hour, location, worst, levels{hazard: level}, active[] }
```

Artinya: **timer peringatan harus sudah aktif** ([02-aktifkan-peringatan-telegram.md](02-aktifkan-peringatan-telegram.md)) agar data terkumpul. Lokasi arsip bisa dipindah dengan `HAZARD_ARCHIVE_DIR` (lihat [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md)).

```bash
ls server/data/hazard-archive | tail -3
curl -s 'http://127.0.0.1:7455/api/hazards?location=all' > /dev/null   # memicu satu snapshot sekarang
```

## 2. Buat berkas kejadian terkurasi (pekerjaan manusia)

Salin format lalu isi **per kejadian per hari**:

```bash
cp docs/validation/events-template.json docs/validation/events-2026-27.json
```

```json
[{ "date": "2026-11-12", "location": "ketol", "hazard": "longsor", "source": "BPBD", "note": "Longsor Jalan Ketol–Bener Meriah KM 7, 1 rumah rusak (Pusdalops BPBD AT)" }]
```

- `location`: id sentra (`src/data/locations.js`) atau `*` untuk kejadian kabupaten-wide (mis. kabut asap).
- `source`: `BPBD` · `BMKG` · `PVMBG` · `media` · `warga` (terverifikasi).
- Kejadian berhari-hari → satu baris per hari.
- Hanya masukkan yang **terverifikasi**; laporan warga mentah & PetaBencana bukan kebenaran lapangan tanpa kurasi.

Cara mendapatkannya: minta rekap Pusdalops BPBD (surat pengantar sudah tersedia di `docs/templates/surat-pengantar-BPBD.md`, pengiriman = **H-8**), arsip peringatan BMKG, dan catatan penyuluh.

## 3. Jalankan skor validasi

```bash
npm run validate:season -- --days 120 --min waspada \
  --events docs/validation/events-2026-27.json \
  --out server/data/validation-2027-02.json
```

Keluaran: **POD** (hit rate), **FAR** (false alarm rate), rasio hari-sentra aktif, dan tabel Markdown siap lampir.

| Metrik | Target | Bila jauh dari target |
|---|---|---|
| POD longsor/banjir/asap | ≥ 70 % | ambang terlalu tinggi atau kejadian kurang terkurasi — periksa dulu daftar kejadian |
| POD gempa dirasakan | ≥ 80 % | cek `QUAKE_RADIUS_KM` & ambang MMI |
| Rasio hari-sentra aktif | ≤ 25 % | ancaman kelelahan peringatan → naikkan ambang atau perpanjang jeda |
| FAR | dilaporkan apa adanya | jangan “diperbaiki”; bandingkan antar musim |

## 4. Tutup siklus

1. Lampirkan tabel Markdown ke `docs/validation/laporan-<musim>.md`.
2. Bahas dengan BPBD/penyuluh (format & waktu: `docs/dev/08-STAKEHOLDERS-GOVERNANCE.md`).
3. Perubahan ambang hasil validasi **hanya** lewat jalur resmi: `src/domain/thresholds.js` + [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) + uji → lihat [04-ubah-ambang-bahaya.md](04-ubah-ambang-bahaya.md).

## Karena validasi belum bisa dijalankan sekarang

- **Butuh ≥ 90 hari arsip** dan kejadian terkurasi; per Oktober 2026 keduanya belum cukup. Jangan menulis laporan validasi dari data kosong — sebut statusnya apa adanya.
- Uji unit (`npm test`) memverifikasi **mekanisme** skornya (`tests/validate-season.test.js`), bukan kebenaran lapangan.
