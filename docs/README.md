# Dokumentasi Niu Gayo Agro-Climate

Peta dokumentasi mengikuti **empat kuadran Diátaxis** ([diataxis.fr](https://diataxis.fr/)): setiap berkas ditulis untuk **satu kebutuhan pembaca**, bukan dicampur.

| Kuadran | Menjawab | Isi | Lokasi |
|---|---|---|---|
| **Tutorial** | "Saya baru — bantu saya mulai" | langkah terpandu dari nol sampai sesuatu berjalan | [`tutorials/`](tutorials/) |
| **How-to** | "Saya perlu melakukan X" | resep tugas konkret, diasumsikan pembaca sudah paham dasar | [`how-to/`](how-to/) |
| **Reference** | "Apa nilai/parameter/endpoint yang tepat?" | tabel & spesifikasi yang dicari, bukan dibaca berurutan | [`reference/`](reference/) |
| **Explanation** | "Mengapa dirancang begini?" | latar belakang, keputusan, riset, trade-off | [`explanation/`](explanation/) |

Dua direktori di luar empat kuadran itu adalah **arsip & aset**, bukan bacaan:

| Lokasi | Isi |
|---|---|
| [`dev/`](dev/README.md) | arsip riset & perencanaan **10 iterasi** (14–15 Okt 2026): audit repo, log riset, PRD, roadmap 4 fase, katalog sumber data, arsitektur/ADR-12…26, ambang multi-bahaya, risk register, tata kelola, penyiapan data, roadmap v3 — ditambah **[11 · Rencana Design/Frontend/UX](dev/11-RENCANA-DESIGN-UX.md)** (16 Okt 2026, audit 26 komponen + 50 putaran iterasi; acuan paket P1–P6). Bernomor & bertanggal — diperlakukan sebagai catatan sejarah, bukan dokumentasi hidup. |
| [`templates/`](templates/) & [`validation/`](validation/) | draf surat pengantar BPBD; format & hasil validasi musiman |

## Mulai dari sini

| Saya ingin… | Buka |
|---|---|
| menjalankan proyek ini di komputer saya (≤ 10 menit) | [tutorials/01-jalankan-lokal.md](tutorials/01-jalankan-lokal.md) |
| menaruh dashboard di server produksi | [how-to/01-deploy-produksi.md](how-to/01-deploy-produksi.md) |
| mengaktifkan peringatan Telegram otomatis | [how-to/02-aktifkan-peringatan-telegram.md](how-to/02-aktifkan-peringatan-telegram.md) |
| memperbarui outlook musiman ENSO/IOD sebelum kedaluwarsa | [how-to/03-rawat-outlook-musiman.md](how-to/03-rawat-outlook-musiman.md) |
| mengubah ambang/level bahaya | [how-to/04-ubah-ambang-bahaya.md](how-to/04-ubah-ambang-bahaya.md) |
| menambah sumber data atau endpoint baru | [how-to/05-tambah-sumber-data.md](how-to/05-tambah-sumber-data.md) |
| menyiapkan data untuk validasi musiman (POD/FAR) | [how-to/06-kumpulkan-data-validasi.md](how-to/06-kumpulkan-data-validasi.md) |
| meninjau label bahasa Gayo `[?]` bersama penutur asli | [how-to/07-tinjau-label-gayo.md](how-to/07-tinjau-label-gayo.md) |
| mengaktifkan & memverifikasi hotspot NASA FIRMS (kunci H-1) | [how-to/08-aktifkan-hotspot-firms.md](how-to/08-aktifkan-hotspot-firms.md) |
| menguji aksesibilitas di browser sungguhan (pa11y/axe, manual) | [how-to/09-uji-browser-a11y.md](how-to/09-uji-browser-a11y.md) |
| mencari daftar endpoint API | [reference/ENDPOINT-API.md](reference/ENDPOINT-API.md) |
| mencari arti variabel `.env` | [reference/KONFIGURASI-ENV.md](reference/KONFIGURASI-ENV.md) |
| mencari daftar perintah npm & gerbang CI (termasuk `npm run lint`) | [reference/SKRIP-NPM.md](reference/SKRIP-NPM.md) |
| menyempurnakan tampilan, kontras, atau aksesibilitas | [reference/DESIGN-TOKENS.md](reference/DESIGN-TOKENS.md) · [dev/11-RENCANA-DESIGN-UX.md](dev/11-RENCANA-DESIGN-UX.md) |
| mencari angka ambang & rumus per bahaya | [reference/THRESHOLDS.md](reference/THRESHOLDS.md) |
| mengukur apakah indeks bahaya benar di lapangan | [reference/VALIDATION.md](reference/VALIDATION.md) |
| memahami alasan di balik desain (arsitektur, CAP, anti-kebisingan) | [explanation/README.md](explanation/README.md) |
| menyiapkan rilis & memeriksa kesehatan repo | [reference/SKRIP-NPM.md](reference/SKRIP-NPM.md) · [`AGENTS.md`](../AGENTS.md) |

## Konvensi

- **Bahasa:** dokumentasi berbahasa Indonesia (istilah teknis Inggris dipertahankan bila sudah lazim, mis. *cache*, *endpoint*, *fallback*).
- **Sumber kebenaran adalah kode.** Tabel di `reference/` **wajib** disinkronkan saat kode berubah — terutama ambang (`src/domain/thresholds.js` ↔ [`reference/THRESHOLDS.md`](reference/THRESHOLDS.md)) dan perintah (`package.json`/`scripts/` ↔ [`reference/SKRIP-NPM.md`](reference/SKRIP-NPM.md)).
- **Status klaim:** setiap angka adalah **estimasi model/satelit** kecuali disebut "pengukuran". Produk ini alat pendukung, **bukan** peringatan dini resmi (mandat BMKG/PVMBG/BPBD).
- **Perubahan ambang** selalu tiga berkas sekaligus: kode + tabel `reference/THRESHOLDS.md` + uji — lihat [how-to/04](how-to/04-ubah-ambang-bahaya.md).
- **Tugas manusia** (butuh akses/kunci/pihak luar) ditandai `H-1`…`H-10` dan didaftar di `docs/dev/09-DATA-PREP.md` serta `AGENTS.md`.

## Riwayat pemindahan (v2.1.0, A-5)

Struktur Diátaxis diperkenalkan 16 Okt 2026. Bila Anda menautkan dokumentasi ini dari luar repo (surat, surel, laporan), perbarui tautan berikut:

| Sebelum | Sekarang |
|---|---|
| `docs/THRESHOLDS.md` | [`docs/reference/THRESHOLDS.md`](reference/THRESHOLDS.md) |
| `docs/VALIDATION.md` | [`docs/reference/VALIDATION.md`](reference/VALIDATION.md) |
| `docs/dev/*` (tidak berubah) | tetap `docs/dev/` — sudah berada di kuadran *explanation* |
