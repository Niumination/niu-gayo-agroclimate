# Tutorial: menjalankan Niu Gayo Agro-Climate di komputer lokal

**Kuadran:** tutorial (belajar) · **Perkiraan waktu:** 10–15 menit · **Audiens:** developer yang belum pernah menyentuh repo ini.

Di akhir tutorial ini Anda akan melihat dashboard yang berjalan di `http://localhost:5188`, dengan data cuaca nyata untuk 15 sentra di Aceh Tengah, dan suite uji hijau. Kita **tidak** mengubah kode sama sekali — tujuannya hanya membuat sesuatu yang bekerja.

## Prasyarat

- **Node.js ≥ 20.19** (`node --version`) — wajib, karena toolchain v2.1 memakai Vite 8.
- Git. Untuk Windows, gunakan Git Bash atau WSL agar perintah di bawah apa adanya.
- Koneksi internet (data diambil dari Open-Meteo/BMKG) — tanpa internet pun aplikasi tetap jalan, hanya saja kartu menampilkan status *degraded*.

## 1. Ambil kode & pasang dependensi

```bash
git clone https://github.com/niumination/niu-gayo-agroclimate.git
cd niu-gayo-agroclimate
npm ci          # memakai package-lock.json — hasil deterministik
```

`npm ci` mengunduh ~350 paket (± 30 detik–2 menit). Bila gagal karena npm 10 lama bereaksi aneh pada lockfile, jalankan **sekali** `npm install --legacy-peer-deps`, lalu ulangi `npm ci` (lihat [`../../../AGENTS.md`](../../AGENTS.md)).

## 2. Nyalakan API server

Buka terminal **pertama**:

```bash
node server/index.js
```

Anda akan melihat server siap di port **7455**. Biarkan terminal ini terbuka.

Uji cepat dari terminal kedua:

```bash
curl -s 'http://127.0.0.1:7455/api/weather?location=takengon' | head -c 300
```

Keluaran JSON berarti API sehat. Semua endpoint boleh menjawab dengan `degraded: true` bila sumber eksternal sedang lambat — itu perilaku normal yang disengaja.

## 3. Nyalakan dev server UI

Di terminal **kedua**:

```bash
npm run dev
```

Buka `http://localhost:5188`. Dalam beberapa detik Anda akan melihat:

1. **Panel Indeks Bahaya** (11 bahaya: longsor, banjir, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat) dengan level seragam.
2. **Kartu udara & kebakaran** (ISPU estimasi CAMS, FWI, jarak pandang).
3. **Peta skematik** 15 sentra dan pemilih lokasi.
4. Tombol **Bagikan**, **Lapor**, dan dialog **Tentang data & batasan** — semuanya berfungsi tanpa backend tambahan.

Vite meneruskan (`proxy`) semua panggilan `/api/*` ke port 7455, jadi jangan heran melihat dua proses.

> Tanpa `FIRMS_MAP_KEY` di `.env`, kartu hotspot tampil *degraded* dengan pesan yang jelas — itu memang desainnya, bukan kerusakan.

## 4. Pastikan semuanya hijau

```bash
npm test              # 321 uji, ~10 detik
npm run check:coverage # gerbang cakupan (baris ≥ 95 %, cabang ≥ 80 %, fungsi ≥ 92 %)
npm run build         # bundle produksi ke dist/ (± 0,5 detik)
npm run check:bundle  # verifikasi anggaran gzip
```

Kalau keempat perintah di atas keluar dengan kode 0, lingkungan lokal Anda sudah setara CI.

## 5. Coba mode terang/gelap & offline (PWA)

- Klik ikon tema di header → mode gelap. Kelas `dark` diterapkan di `<html>`; seluruh palet Gayo (`soil`, `mist`, `leaf`, `cherry`, `husk`, `rain`) punya varian gelap.
- `npm run build && npm run preview`, lalu matikan koneksi: service worker PWA tetap menyajikan shell aplikasi.

## Di mana melanjutkan

| Berikutnya | Buka |
|---|---|
| menaruh ini di server produksi | [../how-to/01-deploy-produksi.md](../how-to/01-deploy-produksi.md) |
| mengaktifkan peringatan Telegram | [../how-to/02-aktifkan-peringatan-telegram.md](../how-to/02-aktifkan-peringatan-telegram.md) |
| memahami daftar endpoint & arti parameter | [../reference/ENDPOINT-API.md](../reference/ENDPOINT-API.md) |
| mencari arti sebuah variabel `.env` | [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md) |
| tahu perintah apa saja yang tersedia | [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md) |
| memahami mengapa arsitekturnya begini | [../explanation/README.md](../explanation/README.md) |

## Masalah yang sering muncul

| Gejala | Sebab & solusi |
|---|---|
| Port 5188 sudah dipakai | hentikan proses lama, atau `npm run dev -- --port 5199` |
| Kartu selalu *degraded* | sumber eksternal lambat/kuota; cek `/healthz` — jangan hapus penanda *degraded* |
| `npm ci` galat `edgesOut` | `npm install --legacy-peer-deps` sekali, lalu `npm ci` |
| Build gagal `manualChunks is not a function` atau ada peringatan `advancedChunks` deprecated | konfigurasi lawas; v2.2.1 memakai `rolldownOptions.output.codeSplitting.groups` (lihat `vite.config.js`) |
