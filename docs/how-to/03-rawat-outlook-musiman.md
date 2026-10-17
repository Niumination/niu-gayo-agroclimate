# How-to: merawat outlook musiman (ENSO/IOD) agar tidak kedaluwarsa

**Kuadran:** how-to (tugas) · **Audiens:** maintainer · **Irama:** dasarian (10 hari) untuk BMKG, bulanan untuk NOAA CPC.

Berkas `src/data/hazards/climateOutlook.json` adalah **konteks iklim terkurasi manual** (tanpa API) yang dipakai `ClimateBanner`, `seasonalInfoExtended`, dan penyesuaian level beberapa bahaya. Berkas ini punya tanggal `validUntil`; lewat tanggal itu banner berubah menjadi “perlu pembaruan” dan **CI gagal** (`npm run check:outlook` keluar 1). Saat ini berlaku sampai **2026-11-12** (pembaruan CPC berikutnya).

## Kapan memperbarui

| Pemicu | Tindakan |
|---|---|
| Sisa ≤ 14 hari (peringatan di log CI) | jadwalkan pembaruan minggu ini |
| `validUntil` lewat | **wajib** sebelum rilis berikutnya; CI merah |
| Rilis BMKG dasarian baru (perubahan fase/indeks) | perbarui `enso`/`iod` + `sources` |
| NOAA CPC mengeluarkan ENSO Diagnostic Discussion (bulanan, biasanya Kamis kedua) | perbarui blok `cpcCrossCheck` |

Periksa kapan saja:

```bash
npm run check:outlook                  # sisa hari + validasi struktur
npm run check:outlook -- --warn-days 30
```

## Sumber yang dipakai

1. **BMKG — Iklim (Prediksi Musim, ENSO/IOD dasarian):** https://www.bmkg.go.id/iklim
2. **NOAA CPC — ENSO Diagnostic Discussion (bulanan):** https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/enso_advisory/ensodisc.shtml
3. Indeks bulanan untuk angka pendukung: `https://www.cpc.ncep.noaa.gov/data/indices/ersst5.nino.mth.91-20.ascii`
4. Staklim Aceh / BMKG Aceh untuk konteks lokal (permulaan musim hujan).

Contoh pembacaan CPC terakhir (8 Okt 2026): *El Niño Advisory*, anomali Niño-3.4 **+2,1 °C**, kuat–sangat kuat sampai Jan–Mar 2027, terbit lagi **12 Nov 2026** — angka itu sudah dicatat di `cpcCrossCheck`.

## Langkah memperbarui

1. Buka berkas dan sunting blok berikut (pertahankan nama kunci — divalidasi skrip):

| Kunci | Isi |
|---|---|
| `_meta.lastReviewed` | tanggal Anda meninjau (ISO) |
| `_meta.cadence` | sebutkan tanggal rilis berikutnya bila diketahui |
| `current.validUntil` | perkiraan tanggal rilis **berikutnya** (jangan terlalu jauh: keandalan turun) |
| `current.enso` | `phase`, `strength`, `nino34Dasarian`, `index3Month`, `note` |
| `current.iod` | `phase` (`positif`/`negatif`/`netral`), `index` |
| `current.season` | `status`, `rainyOnset`, `peak`, `note` |
| `current.implications.id` | 2–4 kalimat **tindakan** untuk petani/warga (bukan angka) |
| `current.sources[]` | minimal satu `{title, url}` — wajib, dan cantumkan tanggal rilis |
| `current.cpcCrossCheck` | tanggal terbit + angka pembanding CPC |

2. Wajib ada (skrip akan menolak bila kosong): `current.enso`, `current.iod`, `current.season`, `current.validUntil`, `current.sources`.

3. Jalankan gerbang:

```bash
npm run check:outlook     # harus ✓ dengan sisa > 14 hari
npm test                  # tests/outlook.test.js memverifikasi struktur & kesegaran
npm run build             # banner ikut berubah → pastikan check:bundle tetap lolos
```

4. Perbarui `docs/dev/09-DATA-PREP.md` (baris “outlook musiman”) dan catat tanggal tinjauan di CHANGELOG bila ini bagian dari rilis.

## Menulis implikasi yang baik

Implikasi dibaca warga di ponsel, jadi tulis **sebagai tindakan**, bukan angka:

- Baik: “Risiko karhutla & asap tetap tinggi sampai hujan konsisten.”
- Baik: “Saat hujan pertama deras setelah kemarau panjang: waspada longsor & luapan (tanah retak, serasah kering).”
- Kurang: “Niño-3.4 +2,1 °C.” (angka ini sudah ada di bagian lain; bukan tindakan)

Sejak Round L, kunci terjemahan bahasa daerah (`implications.gay`) sudah dihapus dari data; cukup isi teks Bahasa Indonesia.

Lihat juga: [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md) · [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md) · `docs/dev/10-ROADMAP-V3.md`
