# How-to: mengubah ambang atau level bahaya

**Kuadran:** how-to (tugas) · **Audiens:** developer/pakar domain · Tabel lengkap: [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md).

Ambang bukan preferensi gaya — ia menentukan kapan warga menerima peringatan. Karena itu perubahan ambang **selalu tiga tempat sekaligus**: kode, tabel referensi, dan uji. Riset di balik angka-angka itu ada di `docs/dev/06-THRESHOLDS-MULTI-HAZARD.md`; hasil validasi lapangan di [../reference/VALIDATION.md](../reference/VALIDATION.md).

## Di mana ambang tinggal

| Berkas | Isi |
|---|---|
| `src/domain/thresholds.js` | **sumber kebenaran**: `TEMP`, `RUST`, `DRYING`, `LANDSLIDE`, `WATERSHED`, `WIND`, `ENSEMBLE`, `ISPU`, `HAZE`, `FWI`, `HOTSPOT`, `HTH`, `WATER_BALANCE`, `QUAKE`, `VOLCANO`, `CONVECTIVE`, `FLOOD_DISCHARGE`, `SPI`, `VPD`, `TEMP_STRESS` |
| `src/domain/hazards/<id>.js` | memakai konstanta itu → skor → level; **jangan** menulis angka ambang di dalam modul |
| `src/domain/hazards/levels.js` | skala seragam `n/a < rendah < waspada < bahaya < ekstrem` (`LEVEL_ORDER`, `normalizeLevel`, `maxLevel`) |
| `src/domain/alert.js` | kebijakan kirim (`PUSH_POLICY`), jeda minimum, batas per siklus |
| `docs/reference/THRESHOLDS.md` | tabel yang dibaca manusia (pakar/BPBD) — **wajib** disinkronkan |
| `docs/dev/06-THRESHOLDS-MULTI-HAZARD.md` | latar riset & justifikasi angka (arsip; tambahkan catatan bila menyimpang dari riset) |

## Prosedur

1. **Ubah konstanta** di `src/domain/thresholds.js` (mis. `QUAKE.mmiWaspada`, `CONVECTIVE.capeWaspada`, `SPI.waspada`).
2. **Perbarui tabel** di [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) — bagian § yang sama, cantumkan alasan singkat bila angkanya menyimpang dari riset.
3. **Sesuaikan uji** yang mengunci perilaku: `tests/hazards.contract.test.js` (bentuk hasil semua modul), plus uji modul terkait (`tests/quake.test.js`, `tests/convective.test.js`, `tests/drought.test.js`, …). Bila level berubah, ada uji batas yang harus diubah — itu memang tujuannya.
4. **Jalankan gerbang:**

```bash
npm test                 # 321 uji: kontrak + batas level
npm run check:coverage   # cakupan tidak boleh turun di bawah ambang
npm run build && npm run check:bundle
npm run smoke            # bentuk respons API tetap sah
```

5. **Bila perubahan memengaruhi apa yang dikirim ke warga**, periksa juga `src/domain/alert.js` dan §13–14 di `reference/THRESHOLDS.md` (ambang kirim per bahaya, `MIN_INTERVAL_H`, maksimum per siklus).
6. Catat di `CHANGELOG.md` **dengan alasan** (mis. temuan validasi musim, permintaan BPBD) — bukan sekadar “ubah ambang”.

## Level: naik satu tangga, bukan nilai kontinu

Modul bahaya mengembalikan **level** (`rendah`…`ekstrem`), bukan angka mentah ke UI. Level dipakai registry untuk: mengurutkan panel, menentukan `worst` per sentra, memicu interaksi lintas-bahaya (`src/domain/hazards/interactions.js`), dan memutuskan pengiriman. Menambah bahaya baru berarti menambah modul di `src/domain/hazards/<id>.js`, bukan menambah cabang `if` di komponen.

## Interaksi lintas-bahaya

Lima aturan (gempa×tanah jenuh, kekeringan×FFMC, badai×longsor, vulkanik×hujan, asap×hujan) ada di `interactions.js` dan diterapkan setelah semua modul dievaluasi. Mengubahnya berarti menyentuh §19 `reference/THRESHOLDS.md` + `tests/interactions.test.js`.

## Yang tidak boleh

- Menulis angka ambang langsung di komponen React atau di modul bahaya.
- Menampilkan “aman” eksplisit saat data parsial — pola **degraded** harus dipertahankan.
- Mengubah ambang untuk menaikkan/menurunkan frekuensi peringatan tanpa dasar validasi; gunakan §KPI di `reference/VALIDATION.md` sebagai rujukan keputusan.
