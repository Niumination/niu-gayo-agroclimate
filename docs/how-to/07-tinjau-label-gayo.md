# How-to: meninjau label bahasa Gayo `[?]` bersama penutur asli

**Kuadran:** how-to (tugas) · **Audiens:** maintainer + penutur/penyuluh Gayo · **Tugas manusia: H-4**.

Aplikasi ini dwibahasa (id-ID & Gayo). Setiap teks Gayo yang **belum disetujui penutur asli** ditandai literal **`[?]`**. Saat ini ada **76 placeholder pada 76 baris** — tempat terbesar di `src/i18n/messages.js` (kartu udara, kebakaran, kekeringan, dll.), sisanya label bahaya di modul `src/domain/hazards/*.js`.

Tujuannya: mengganti teks bertanda `[?]` dengan terjemahan yang **disetujui** penutur, sambil menjaga jejak audit.

## 1. Lihat daftar lengkapnya

```bash
npm run check:i18n              # daftar berkas:baris + ringkasan (informatif, keluar 0)
npm run check:i18n -- --dir src # membatasi pemindaian
```

Ringkasan saat ini: `ℹ [i18n] 76 placeholder Gayo "[?]" pada 76 baris`.

## 2. Siapkan sesi tinjauan

- Cari 1–2 penutur Gayo (penyuluh pertanian, guru, tokoh kampung). Sertakan **konteks**: string ini muncul di kartu mana, dibaca saat panik atau tenang?
- Kerjakan per kelompok layar, bukan per baris acak: (a) istilah cuaca, (b) nama bahaya, (c) **nasihat tindakan** (paling penting), (d) teks teknis “Tentang data & batasan”.
- Prinsip yang sudah dipakai di glosarium: *ren* = hujan, *beh* = tinggi, *aman* = aman — jangan mengubah istilah glosarium yang sudah disetujui (`tests/i18n.test.js` mengunci beberapa di antaranya).

## 3. Ganti teks & buang penanda

Contoh di `src/i18n/messages.js`:

```js
// sebelum
airQuality: 'Asap & Udara [?]',
// sesudah (disetujui Ibu X, 18 Okt 2026, Kampung Y)
airQuality: 'Asap & Ude<hasil tinjauan>',
```

Aturan:

1. Hanya hapus `[?]` bila **penutur benar-benar menyetujui** kalimat itu.
2. Bila terjemahan masih ragu, **biarkan** `[?]` dan tulis varian alternatif di catatan tinjauan (`docs/dev/09-DATA-PREP.md`, bagian bahasa Gayo) — jangan tebak.
3. Nasihat tindakan (`advice.gay` pada tiap modul bahaya) juga memakai penanda yang sama.
4. Jangan mengubah kunci (`id`) — itu dipakai laporan warga, feature flag, dan registry.

## 4. Verifikasi

```bash
npm test                        # tests/gayoPlaceholders.test.js memastikan penanda tetap terhitung
npm run check:i18n              # jumlah placeholder harus turun
npm run check:i18n -- --strict   # keluar 1 selama masih ada sisa → dipakai setelah H-4 tuntas
npm run build && npm run check:bundle
```

> **Penting saat H-4 selesai 100 %:** uji `tests/gayoPlaceholders.test.js` sengaja menuntut `hits.length > 0` (“harus ada placeholder sampai H-4 selesai”). Setelah placeholder habis, ubah uji itu menjadi `assert.equal(hits.length, 0)` dan jadikan `check:i18n --strict` langkah CI. Ini bukan bug — pengingat agar statusnya tidak berhenti setengah jalan.

## 5. Dokumentasikan

- Catat tanggal, nama peninjau (ringkas, tanpa data pribadi berlebih), dan wilayah dialeknya di `docs/dev/09-DATA-PREP.md`.
- Bila sesi ini bagian dari rilis, tambahkan baris di `CHANGELOG.md` (mis. “+18 label Gayo disetujui, sisa 34”).
- Perbarui baris **H-4** di `AGENTS.md` & roadmap v3 (`docs/dev/10-ROADMAP-V3.md`).

Lihat juga: [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md) (tidak ada env khusus bahasa) · [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md)
