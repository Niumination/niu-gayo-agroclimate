# Protokol validasi musiman — Niu Gayo Agro-Climate v2 (Fase 1.10b / 4.2)

Dokumen ini menetapkan **cara mengukur** apakah indeks bahaya (longsor, banjir+, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat) benar-benar berguna di lapangan, sebelum dipakai sebagai dasar keputusan mitigasi bersama BPBD Aceh Tengah. Semua indeks adalah **estimasi model/satelit**; validasi inilah yang menentukan kalibrasi lokal berikutnya (lihat `docs/THRESHOLDS.md`).

## 1. Data yang dikumpulkan otomatis
| Data | Lokasi | Cara terisi |
|---|---|---|
| Arsip level per sentra | `server/data/hazard-archive/YYYY-MM-DD.json` | setiap evaluasi `/api/hazards?location=all` (cron 30 menit) menyimpan 1 snapshot/sentra/jam: `{ at, hour, location, worst, levels{hazard: level}, active[] }` |
| Laporan warga | `server/data/reports.json` | tombol **Lapor** di aplikasi (tipe = id bahaya; `abu`/`gas` dipetakan ke `vulkanik`) |
| Feed peringatan terkirim | `server/data/alert-feed.json` / `GET /api/alerts/feed` | siklus `POST /api/alerts/run` |
| Laporan eksternal | `GET /api/external-reports` (PetaBencana.id, CC BY-NC) | hanya ditampilkan, **tidak** dipakai sebagai kebenaran lapangan tanpa kurasi |

## 2. Kejadian terkurasi (kebenaran lapangan)
Buat berkas JSON per musim (contoh `docs/validation/events-2026-27.json`, format di `events-template.json`):
```json
[{ "date": "2026-11-12", "location": "ketol", "hazard": "longsor", "source": "BPBD", "note": "Longsor Jalan Ketol–Bener Meriah KM 7, 1 rumah rusak (Pusdalops BPBD AT)" }]
```
- `location` = id sentra (`src/data/locations.js`) atau `*` bila kabupaten-wide (mis. kabut asap).
- `source`: `BPBD` (Pusdalops/laporan kejadian), `BMKG` (peringatan dini/gempa dirasakan), `PVMBG`, `media`, `warga` (terverifikasi).
- Satu baris per kejadian-hari; kejadian berhari-hari → satu baris per hari.

## 3. Metrik (skrip `scripts/validate-season.mjs`)
```
npm run validate:season -- --days 120 --min waspada --events docs/validation/events-2026-27.json --out server/data/validation-2027-02.json
```
| Metrik | Definisi | Target KPI (`docs/dev/08`) |
|---|---|---|
| **POD** (hit rate) | kejadian yang didahului/disertai status aktif (≥ `--min`) pada hari H atau H−1 ÷ semua kejadian | ≥ 70 % longsor/banjir/asap pada kejadian BPBD; ≥ 80 % gempa dirasakan (BMKG) |
| **FAR** | hari-sentra aktif tanpa kejadian pada H/H+1 ÷ hari-sentra aktif | dilaporkan apa adanya; dibandingkan antar musim (turun = kalibrasi membaik). Laporan warga jarang → FAR tinggi bukan bukti model salah |
| **Rasio aktif** | hari-sentra aktif ÷ (hari × sentra) | ≤ 25 % (menghindari kelelahan peringatan) |
| **Lead time** | selisih jam antara status aktif pertama dan kejadian (dihitung manual dari snapshot `hour`) | ≥ 6 jam untuk longsor/banjir; ≥ 1 jam untuk badai |

## 4. Validasi silang khusus
| Bahaya | Pembanding | Catatan |
|---|---|---|
| Kebakaran (FWI) | SPBK/FDRS BMKG (kelas FFMC/DC) untuk titik terdekat | bandingkan kelas harian (tabel kontingensi 4×4); FIRMS hotspot ≤ 10 km sebagai kejadian |
| Asap (ISPU estimasi CAMS) | stasiun ISPU KLHK terdekat (Banda Aceh/Lhokseumawe) & sensor PM2,5 mitra (Fase 4.3) | bias CAMS di dataran tinggi diharapkan negatif saat asap lokal; catat MAE |
| Banjir+ (GloFAS) | kejadian banjir Pusdalops BPBD 2025–2027 + muka air Lut Tawar (bila ada) | uji ambang rasio 2/3/5 → sesuaikan per sel |
| Gempa | BMKG `Dirasakan` vs MMI indikatif per sentra | selisih ≤ 1 skala MMI dianggap cocok |
| Suhu/embun upas | pengamatan petani plato (Jagong Jeget, Atu Lintang) + termometer min sederhana | kalibrasi koreksi −1 °C elevasi |
| Kekeringan (SPI) | rilis BMKG SPI/HTH Aceh (Staklim) | bandingkan kelas SPI-3 bulanan |

## 5. Jadwal & tanggung jawab
- **Tiap akhir musim** (Feb: puncak hujan; Sep: puncak kering): jalankan skrip, lampirkan tabel Markdown ke `docs/validation/laporan-<musim>.md`, bahas dengan BPBD/penyuluh (format rapat di `08-STAKEHOLDERS-GOVERNANCE.md`).
- **Perubahan ambang** hanya melalui `src/domain/thresholds.js` + pembaruan `docs/THRESHOLDS.md` + test, dengan rujukan ke laporan validasi.
- Arsip berusia > 2 musim boleh dipadatkan (rata-rata harian) untuk menghemat disk.

## 6. Batasan
- Arsip baru berisi sejak cron aktif (tugas H-7); hari tanpa server = `missing`.
- Snapshot per jam hanya tersimpan saat `/api/hazards?location=all` dipanggil (cron atau pengguna) — gunakan cron agar konsisten.
- Kejadian tanpa koordinat/sentra dipetakan manual ke sentra terdekat; catat ketidakpastian di `note`.
