# How-to: menambah sumber data atau endpoint baru

**Kuadran:** how-to (tugas) · **Audiens:** developer · Referensi hasil akhir: [../reference/ENDPOINT-API.md](../reference/ENDPOINT-API.md), [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md), [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md).

Repo ini punya satu pola untuk **semua** sumber data eksternal (Open-Meteo, BMKG, MAGMA, FIRMS, PetaBencana). Ikuti pola itu; jangan menambah dependensi server (NFR: nol dependensi baru di server, klien tetap ringan).

## Pola wajib

1. **Fungsi murni untuk URL & normalisasi** — `build*Url(loc)` dan `normalize*(raw)` diekspor terpisah supaya bisa diuji tanpa jaringan.
2. **Fetch yang bisa di-inject** — setiap fungsi jaringan menerima `{ fetchImpl = fetch }`. Uji **selalu** memakai mock; jangan pernah memanggil jaringan di `npm test`.
3. **Tidak pernah `throw` ke handler** — kegagalan upstream → objek `{ degraded: true, error, retrievedAt }` + **nilai terakhir tersimpan** di `server/data/` bila ada. Kartu tetap tampil, dengan penanda jelas. Jangan menampilkan “aman”.
4. **TTL cache lewat env** — konstanta di `server/config.js` (`<NAMA>_TTL_MIN`), didokumentasikan di `.env.example` dan [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md).
5. **Jejak uji** — fungsi murni → uji unit; respons nyata → fixture di `tests/fixtures/hazards/` (ambil dengan `scripts/fetch-hazard-fixtures.mjs`).

## Langkah

1. **Modul server**: buat `server/<nama>.js` mengikuti `server/flood.js` (paling ringkas) atau `server/bmkgQuake.js`.
2. **Konfigurasi**: tambahkan base URL (opsional, dengan default bawaan) + `*_TTL_MIN` di `server/config.js`, lalu salin ke `.env.example`.
3. **Rute**: daftarkan path di `server/routes.js` (`createHandler(ctx)`; `ctx` dirakit di `server/index.js`). Semua respons lewat helper `json(res, …)` agar header keamanan konsisten. Validasi `?location=` terhadap `VALID_LOCATIONS` → `400` bila salah.
4. **Arsip/fixture**: simpan contoh respons nyata ke `tests/fixtures/hazards/<nama>.json` (tanpa data pribadi/kunci).
5. **Uji**: `tests/<nama>Server.test.js` (URL/normalisasi/degraded + `fetchImpl` mock, `dataDir` sementara — **jangan** menulis ke `server/data/` dari uji). Bila ikut menentukan level bahaya, tambahkan uji modul di `tests/<bahaya>.test.js`.
6. **Jadikan bahaya (bila perlu)**: modul murni `src/domain/hazards/<id>.js` yang memenuhi kontrak registry, daftarkan di `src/domain/hazards/index.js`. `id` = tipe laporan warga = kunci i18n = feature flag. `tests/hazards.contract.test.js` akan memverifikasi bentuk hasilnya otomatis.
7. **Bila menyentuh level**: ubah `src/domain/thresholds.js` + [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) + uji batas bersamaan (lihat [04-ubah-ambang-bahaya.md](04-ubah-ambang-bahaya.md)).
8. **Smoke & CI**: tambahkan path ke daftar endpoint di `scripts/smoke.mjs` — smoke harus lulus **tanpa kunci** (degraded boleh, 5xx tidak).
9. **Dokumentasi**: perbarui [../reference/ENDPOINT-API.md](../reference/ENDPOINT-API.md) (baris endpoint), `.env.example`, dan `docs/dev/04-DATA-SOURCES.md` (URL, lisensi, TTL, fallback).
10. **Gerbang terakhir**:

```bash
npm test && npm run check:coverage && npm run build && npm run check:bundle && npm run smoke
```

## Lisensi & atribusi

Sebelum menambah sumber, tulis lisensinya di `docs/dev/04-DATA-SOURCES.md` dan tampilkan atribusi di UI (`AboutData.jsx`). Contoh yang sudah berjalan: laporan PetaBencana.id **CC BY-NC 4.0** (hanya ditampilkan, tidak dipakai sebagai kebenaran lapangan), GloFAS/Open-Meteo (berlabel *estimasi*), MAGMA (rujuk PVMBG sebagai otoritas).

## Jangan lakukan

- Memanggil API dari komponen React (semua lewat server; klien hanya `/api/*`).
- Menyimpan kunci di kode/`dist/`.
- Menghapus penanda `degraded` agar tampilan “bersih” — itu justru menghapus informasi penting.
