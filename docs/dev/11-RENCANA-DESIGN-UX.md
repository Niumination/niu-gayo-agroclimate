# 11 · Rencana Penyempurnaan Design, Frontend & UX

**Status:** dokumen rencana (fase design/UX). Disusun 16 Okt 2026, berbasis audit statis 28 berkas `src/`, riset 12 klaster, dan **50 putaran iterasi audit → riset → rencana** (log lengkap di §8).
**Prasyarat teknis:** `main` = `f9f8058` (semua commit v2.1.0 sudah upstream; tag `v2.1.0` ada). Gerbang hijau di commit itu: 327 uji, `check:coverage`, `build`, `check:bundle`, `smoke`.
**Dokumen pendamping:** nilai token, tabel kontras terukur, dan aturan keras ada di [`docs/reference/DESIGN-TOKENS.md`](../reference/DESIGN-TOKENS.md). Gerbang otomatis: `npm run check:contrast`.

> **Cara membaca:** §1 ringkasan · §2 ruang lingkup · §3 metode · §4 temuan audit · §5 riset → implikasi · §6 paket kerja P1–P6 (yang dieksekusi) · §7 urutan & gerbang CI · §8 log 50 putaran · §9 definisi selesai · §10 risiko & keputusan yang masih terbuka.

## 1. Ringkasan eksekutif

Fungsi produk (11 modul bahaya, CAP, PWA offline-tolerant) sudah lengkap; **lapisan penyajiannya belum setara**. Audit menemukan tiga masalah struktural, bukan sekadar kosmetik:

1. **Tidak ada lapisan token semantik.** Warna ditulis sebagai opasitas (`text-ink/45`) atau heks mentah di komponen, sehingga **262 pemakaian teks di 21 berkas berada di bawah 4,5:1** (140 tema terang, 122 tema gelap) — termasuk teks yang benar-benar dibaca pengguna (footer, timestamp "data basi", label anjuran).
2. **Skala tipografi terlalu kecil & tidak seragam.** Tidak ada teks isi ≥ 16 px; ada 100 pemakaian 11 px dan 7 pemakaian 10 px. Font angka (JetBrains Mono) dideklarasikan tetapi tidak di-self-host sehingga tidak pernah termuat.
3. **Status & fokus tidak diumumkan.** Nol `aria-live` di seluruh aplikasi (pembaruan data senyap), nol aturan `focus:` yang eksplisit, `focus-visible:outline-none` di `AppBar`, 24 tombol dengan hanya 12 yang memenuhi target 44 px, dan tab `now/forecast/risk/locations` belum memakai semantik tabpanel.

Perbaikan dijadwalkan sebagai 6 paket kerja dengan kriteria terima terukur. Paket **P1 (token + kontras)** dan **P3 (tipografi)** memberi lompatan keterbacaan terbesar per usaha; P2 menutup celah aksesibilitas interaksi; P4 memperbaiki pengalaman menunggu/gagal/offline yang khas jaringan Gayo; P5 memoles gerak & visual; P6 memasang pengaman agar tidak mundur lagi.

| Metrik | Sekarang (audit) | Target setelah P1–P6 |
|---|---|---|
| Pasangan teks < 4,5:1 | 262 pemakaian di 21 berkas | ✅ **0 sejak P1** (417 utilitas diganti) |
| Teks isi ≥ 16 px | tidak ada | ✅ **sejak P3** (212 ukuran arbitrer → token) |
| Teks < 12 px | 107 pemakaian (10–11 px) | ✅ **sejak P3** (0 pemakaian) |
| Tombol ≥ 44 px | 12 dari 24 | ✅ **sejak P2** (0 dari 25 tombol < 44 px) |
| Aturan `focus:` eksplisit | 0 | ✅ **sejak P2** (0 penghapus penanda fokus) |
| `aria-live` untuk pembaruan data | 0 | ✅ **sejak P2** (pembaruan data + status) |
| Semantik tab (tablist/tab/tabpanel) | tidak ada | ✅ **sejak P2** (penuh + navigasi panah) |
| Safe-area aktif | `env()` inert (tanpa `viewport-fit=cover`) | ✅ **sejak P5** (`viewport-fit=cover` + safe-area header & bilah bawah) |
| Font data termuat | tidak (hanya deklarasi CSS) | ✅ **sejak P3** (2 berkas WOFF2 42 kB, preload + fallback metrik) |

## 2. Ruang lingkup

**Termasuk:** seluruh `src/` (26 komponen + `App.jsx` + `main.jsx` + `index.css`), `index.html` (viewport, preload font), gerbang CI, dan dokumen rujukan/tata kelola terkait.
**Tidak termasuk (sengaja):** perubahan data/domain (thresholds, registry bahaya), peta Leaflet (masih ditunda sesuai `docs/dev/10-ROADMAP-V3.md`), perubahan kontrak API rute, dan penambahan dependensi runtime — semua paket dijaga **0 dependensi runtime baru**; `eslint-plugin-jsx-a11y` (devDependency) hanya diusulkan di P6.

## 3. Metode

| Tahap | Cara | Hasil |
|---|---|---|
| Audit statis | Skrip sendiri atas 26 komponen: inventaris token, pemakaian opasitas, ukuran teks arbitrer, target sentuh, `aria-*`/`role`, dialog, motion. Tanpa browser (sandbox tidak punya Chromium/Firefox). | §4 (temuan A-1…A-9) |
| Riset | 12 klaster literatur: WCAG 2.2, tipografi ponsel, pesan untuk literasi rendah, palet buta warna, tooling a11y CI, token Tailwind 4, aksesibilitas grafik, font self-host, timing motion, UX offline PWA, skeleton, safe-area. | §5 (klaster R-1…R-12) |
| Sintesis | Hitung nilai token **usulan** dengan rumus WCAG + simulasi buta warna, bukan mengira-ngira; hasil terukur masuk `DESIGN-TOKENS.md`. | §6, lampiran token |
| Pengaman | Skrip `scripts/check-contrast.mjs` + 11 uji + langkah CI (informatif → `--strict` setelah P1 selesai). | putaran 50 |
| Disiplin | **50 putaran** audit → riset → rencana, tiap putaran mencatat temuan + keputusan. | §8 |

## 4. Temuan audit (A-1 … A-9)

### A-1 Kontras warna — 262 pemakaian gagal
Sumber gagal bukan warna brand, melainkan **opasitas**: `ink/35`=2,16:1 · `ink/40`=2,45:1 · `ink/45`=2,81:1 · `ink/50`=3,21:1 · `ink/55`=3,72:1 · `ink/60`=4,34:1 · `mist/30`=2,69:1 · `mist/35`=2,78:1 · `mist/40`=3,24:1 · `mist/45`=3,80:1 · `mist/50`=4,38:1. Tema terang 140 temuan, tema gelap 122.
Berkas terparah: `AirQualityCard` 37 · `DisasterWarning` 34 · `HazardFocusCards` 30 · `FireDangerCard` 25 · `HazardPanel` 23 · `DroughtCard` 21.
Kasus nyata yang berdampak langsung: baris brand `AppBar` (`text-ink/40` = 2,45:1), footer `App.jsx` (`text-ink/45` = 2,81:1), dan status memuat (`text-ink/50` = 3,21:1).

### A-2 Tipografi
`text-[11px]`×100 · `text-[13px]`×93 · `text-[12px]`×19 · `text-[10px]`×7 · `text-[15px]`×6 · `text-[14px]`×1. Tidak ada satu pun teks isi pada 16 px. `font-data` dipakai 44× tetapi tidak ada berkas font di `dist/`.
**Selesai di P3 (2026-10-16):** seluruh 212 ukuran itu kini token skala (`text-caption` 12 px / `text-body` 16 px), `text-sm` 19× dinaikkan ke 16 px, `truncate` 12× diganti `break-words`, `tabular-nums` mengikuti seluruh nilai `font-data`, dan `JetBrains Mono` termuat dari `dist/fonts/` (42 kB, preload + fallback metrik).

### A-3 Target sentuh & fokus
24 `<button>`; hanya 10 ber-`min-h-[44px]` + 2 ber-`h-11 w-11`. Tidak ada aturan `focus:` eksplisit; `AppBar` memakai `focus-visible:outline-none` sehingga kontrol kehilangan penanda fokus. Tidak ada skip-link ke konten utama.

### A-4 Semantik status & tab
`aria-live` 0 (pembaruan data tidak diumumkan pembaca layar); `role="status"` ada 6×; tab `now/forecast/risk/locations` tanpa `role="tablist"/"tab"/"tabpanel"`, tanpa `aria-controls`/`id`, tanpa navigasi panah (fokus keyboard harus Tab melewati seluruh isi).

### A-5 Dialog & formulir — sudah baik, jadi acuan
`ReportButton` (Escape + focus trap + tombol 44 px) dan `AboutData` (Escape + autofocus) sudah benar. Pola ini dipromosikan sebagai **acuan internal** untuk semua panel yang bisa dibuka.

### A-6 Tema gelap
Permukaan memakai `#1A1512` (bukan hitam murni) — sudah benar. Masalahnya: 122 pemakaian teks gelap gagal, `ErrorBoundary` masih memakai kelas `slate-*`/`rose-*` di luar palet, dan `SchematicMap` menyimpan heks mentah (`#b3261e`, `#c2410c`, `#b45309`, `#3f6212`, `#9ca3af`).

### A-7 Gerak & area aman
Satu animasi masuk 200 ms (sesuai rekomendasi) + `prefers-reduced-motion` sudah dimatikan dengan benar. Namun `ekstrem` memakai `animate-pulse` sebagai penanda tambahan (berisiko bagi pengguna sensitif gerak) dan `index.html` belum memakai `viewport-fit=cover` sehingga `env(safe-area-inset-bottom)` di `BottomNav` **ber nilai 0** — niat kode sudah benar, hasilnya belum.

### A-8 Keadaan menunggu / kosong / gagal / basi
`App.jsx` menampilkan teks polos `role="status"` saat memuat (tanpa kerangka/skeleton), tanpa indikator progres pada aksi tombol, tanpa panel "kosong" eksplisit, dan status basi (`dataAge`, ≥ 30 menit) hanya berupa label — tidak ada ajakan tindakan.
**Selesai di P4 (2026-10-16):** skeleton bertata tetap (muncul > 300 ms, mati saat reduced-motion) · `EmptyState` di 10 kartu data + grafik hujan · pita data basi dengan tombol “Muat ulang sekarang” · pita offline terpusat + penanda cache · pita “koneksi kembali” yang bisa ditutup · spinner + anti kirim ganda + `role="status"` pada tombol kirim laporan · `tests/stateContract.test.js` (9 uji).

### A-9 I18n & pemuaian teks
76 label ditandai `[?]` (tugas manusia H-4; 52 pada audit, +15 label interaksi P2, +9 label keadaan memuat/kosong/basi P4). Label Gayo/Indonesia cenderung 20–35 % lebih panjang; beberapa kartu memakai `text-[11px]` + lebar tetap, sehingga berisiko terpotong saat terjemahan masuk.

### A-10 Teks antarmuka yang belum masuk i18n (temuan baru saat P2)
Beberapa label antarmuka ditulis keras dalam bahasa Indonesia meskipun aplikasi dwibahasa: footer panel bahaya (tombol tampilkan/sembunyikan, tautan bantuan, “Evaluasi … WIB”, catatan “bukan peringatan resmi”), seluruh label `ShareButton`, tautan bantuan di footer `App.jsx`, serta `AboutData`/`ReportButton`/`FireDangerCard` (“Tutup”, “Sembunyikan”, “Lihat N anjuran lain”), termasuk `aria-label` bagian. **Sudah diperbaiki P2:** 15 kunci (navigasi, tampilkan/sembunyikan, bantuan, berbagi, catatan footer) di bahasa id + Gayo dan dipakai lewat `tr()`; sisanya dicatat untuk P3/P4 bersama uji pemuaian.

## 5. Riset → implikasi (R-1 … R-12)

| # | Klaster | Butir kunci | Implikasi di repo |
|---|---|---|---|
| R-1 | WCAG 2.2 AA | Kriteria baru: 2.4.11 Fokus Tidak Terhalang · 2.5.7 Gerakan Menggeser · 2.5.8 Target 24×24 · 3.2.6 Bantuan Konsisten · 3.3.7 Entri Berulang · 3.3.8 Autentikasi; 4.1.1 dihapus. Pemindai otomatis hanya menangkap ±57 % temuan (2.5.8 hanya 18,7 %) | Gabungkan gerbang otomatis + audit manual (§9); target internal **44 px** (di atas minimum 24 px); tombol bantuan di posisi konsisten (3.2.6) |
| R-2 | Tipografi ponsel | 16 px = ambang praktis teks isi; input < 16 px memicu zoom otomatis iOS; hindari < 12 px; line-height 1,5–1,7; pakai rem | Skala §4 DESIGN-TOKENS; `input` ≥ 16 px; hapus semua `text-[10px]/[11px]` |
| R-3 | Peringatan literasi rendah | Pola terbaik: gabungkan warna + ikon + teks pendek + anjuran aksi (situasi → masalah → solusi, pola MET Norway) | Struktur kartu peringatan diseragamkan (headline · mengapa · apa yang dilakukan); sinergi dengan H-4 (label Gayo) |
| R-4 | Palet buta warna | Wong & IBM: beda **terang** + bentuk wajib; lampu lalu lintas merah/kuning/hijau gagal untuk ±8 % pria | Ramp level §3.3 + ikon/bentuk berbeda per level (warna tak pernah tunggal) |
| R-5 | Tooling a11y CI | axe-core sebagai mesin; `@axe-core/playwright`, `jest-axe`, `pa11y-ci` (ratchet), `@lhci/cli` (tren), `eslint-plugin-jsx-a11y` | Sandbox tanpa browser → gerbang kontras mandiri lebih dulu (sudah dibuat); usul ESLint a11y di P6; skenario browser didokumentasikan untuk dijalankan manual oleh Hermes |
| R-6 | Tailwind 4 | `@theme inline` + CSS var memungkinkan token peran yang berpindah tema tanpa pasangan `dark:`; verifikasi keluaran kompilasi karena `color-mix` & tabrakan nama palet | Strategi P1: `:root`/`html.dark` menetapkan var → utilitas peran; kelas `dark:` lama tetap jalan selama transisi |
| R-7 | Grafik aksesibel | Pengkodean berulang (pola/penanda/label langsung), sparkline/small-multiples lebih baik dari banyak seri; sediakan tabel + ringkasan tersembunyi | `RainChart` & `SchematicMap`: pola garis, label langsung, `aria-label` ringkasan |
| R-8 | Font | Self-host WOFF2 subset (latin + latin-ext), satu variable font, `font-display: swap`, satu preload, fallback metrik disetel (contoh CLS 0,19 → < 0,05) | P3: `public/fonts/` + preload + `size-adjust`; ongkos ±30–40 kB (anggaran 200 kB masih longgar dari 131,6 kB) |
| R-9 | Motion | Tekan 80–100 ms · hover 100–150 · sederhana 150–200 · modal 200–300 · fungsional ≤ 500; ease-out masuk, ease-in keluar; jangan linear | Tabel §5 DESIGN-TOKENS + umpan balik `active:` (hari ini hanya 1 pemakaian di seluruh repo) |
| R-10 | Offline PWA | Banner offline + penandaan basi eksplisit; toast "pembaruan tersedia → muat ulang" (jangan `skipWaiting` otomatis); `navigator.storage.persist()`; iOS dapat menghapus penyimpanan ±7 hari | P4: banner offline diperjelas + tombol muat ulang; jangan pernah menampilkan data basi tanpa label |
| R-11 | Skeleton | Penelitian Viget (n=136): skeleton (2,82 s) > spinner (2,41 s) > layar kosong (2,29 s) — manfaat utama skeleton adalah **stabilitas layout** (CLS), bukan ilusi kecepatan; spinner < 300 ms; spinner di dalam tombol untuk aksi | P4: skeleton bertata letak tetap per kartu; spinner kecil di dalam tombol aksi (laporan kirim) |
| R-12 | Safe-area | `env(safe-area-inset-*)` bernilai 0 tanpa `viewport-fit=cover`; emulator Chrome pun mengembalikan 0; `min-width: 0` wajib pada flex | P5: `index.html` `viewport-fit=cover` + perbaikan `min-w-0` yang masih hilang |

## 6. Paket kerja (yang dikerjakan)

Setiap paket memuat: tujuan · langkah · berkas sasaran · kriteria terima · ukuran usaha (S/M/L).

### P1 — Token semantik & kontras (usaha **M** — dampak terbesar) · ✅ **SELESAI 2026-10-16**
**Tujuan:** nol pemakaian teks < 4,5:1; warna berperan, bukan opasitas.
**Hasil terukur:** 417 utilitas teks beropasitas → token peran di **66 berkas**; `text-(ink|mist)/NN` sisa **0**; `check:contrast --strict` **34/34 pasangan lulus** (56 token terbaca); `ErrorBoundary` keluar dari palet `slate/rose`; `SchematicMap` bebas heks mentah; `AppBar` tidak lagi menghapus penanda fokus; glyph bentuk per tingkat (`LevelGlyph`) dipasang di lencana `HazardPanel`; angka uji **340** (2 uji baru: pemetaan pita & komentar), bundel 131,6 → **132,0 kB**. Sisa P1: tint latar kartu level + ikon di komponen lain (dikerjakan bersama P2).
**Langkah**
1. Tambah token §3 `DESIGN-TOKENS.md` ke `src/index.css` (`@theme` + blok `:root` / `html.dark`).
2. Ganti 262 pemakaian opasitas memakai tabel pemetaan §3.2 (terang → `ink-muted`/`ink-subtle`, gelap → `mist-muted`/`mist-subtle`), lalu hapus pasangan `dark:` yang menjadi mubazir.
3. Ganti heks mentah: `SchematicMap` → token; `ErrorBoundary` `slate-*`/`rose-*` → `ink/mist` + `cherry`.
4. Ganti lencana level ke ramp §3.3 (+ ikon per level) dan garis aksen 3 px pada kartu level.
5. Ubah langkah CI menjadi `npm run check:contrast -- --strict`.
**Kriteria terima:** `check:contrast --strict` hijau; `grep -nE 'text-(ink|mist)/[0-4][0-9]' src` = 0; tangkapan layar terang/gelap di 320/375/768/1280 px tidak ada teks "pudar"; uji tetap 338/338.

### P2 — Aksesibilitas interaksi (usaha **M**) · ✅ **SELESAI 2026-10-16**
**Hasil terukur:** pemindai tag `<button>`: **0 dari 25 tombol** di bawah 44 px (sebelumnya 12/24); 4 kontrol 32–40 px dinaikkan; tab bawah 56 px + safe-area; `BottomNav` = `tablist` penuh (roving tabindex + panah/Home/End) dan `MobileTabShell` = `tabpanel` ber-`aria-labelledby` **tanpa** `outline-none`; `aria-live="polite"` + `role="status"` untuk pembaruan data; skip-link `#main`; banner galat `role="alert"` + tombol “Coba lagi”; `AppBar`/`DesktopHeader` kontrol 44 px & emoji `aria-hidden`; skala teks jadi token (`--text-body/body-sm/label/caption`); 15 label interaksi masuk i18n (temuan baru A-10). Pengaman: `tests/a11yContract.test.js` (10 uji) → suite **350 uji**; bundel 132,0 → **132,9 kB**; `check:contrast --strict` tetap 34/34.
**Langkah**
1. Target sentuh: seluruh tombol/tautan aksi ≥ 44 px (`min-h-11`/`h-11 w-11` + `px-3`), minimum 24 px untuk kontrol sekunder dengan jarak ≥ 24 px.
2. Fokus: hapus `focus-visible:outline-none` di `AppBar`; pastikan `:focus-visible` global (2 px `leaf-deep`/`leaf-soft` + offset 2 px) tidak pernah ditimpa.
3. Semantik tab: `role="tablist"` (BottomNav/DesktopHeader) + `role="tab"` + `aria-selected` + `aria-controls` + `id` pada `MobileTabShell`/panel, plus navigasi panah kiri/kanan & Home/End.
4. `aria-live="polite"` pada status muat & perubahan level bahaya tertinggi; `role="status"` yang ada dipertahankan & diberi `aria-live` yang sesuai.
5. Skip-link "Lewati ke konten" + `<main id="main">`; `aria-expanded` akordeon (`HazardPanel`) diverifikasi; label ikon (tema/berbagi) memakai teks tersembunyi, bukan emoji tanpa nama.
6. Bantuan konsisten (WCAG 3.2.6): tombol "Tentang data & batasan" di posisi sama di desktop & mobile.
**Kriteria terima:** lintasan keyboard tanpa jebakan fokus; setiap kontrol punya penanda fokus terlihat; audit kontras tetap hijau; skenario uji manual §9 lulus.

### P3 — Tipografi, font, & pemuaian teks (usaha **M**) · ✅ **SELESAI 2026-10-16**
**Hasil terukur:** 212 ukuran arbitrer → token skala (sisa 2 ukuran baca besar 56/68 px); 19× `text-sm` → `text-body`; 12× `truncate` → `break-words`; `tabular-nums` +28 kelas `font-data`; JetBrains Mono variable 400–700 self-host **latin 30,7 kB + latin-ext 11,4 kB** (satu preload + fallback metrik `size-adjust: 102%`); gerbang `npm run check:typography` (+9 uji → **359 uji**) memakai aturan 16 px/12 px, larangan `truncate`, dan keberadaan font di `public/fonts` → `dist/fonts`; bundel JS tetap 132,9 kB gzip; precache 492 → 536 KiB.
**Langkah**
1. Terapkan skala §4: `text-caption/label/body-sm/body`; naikkan seluruh 10–11 px → 12 px minimum, teks isi & aksi → 16 px.
2. Input/`select` ≥ 16 px (cek `DistrictSelector`, `AppBar`, form laporan).
3. Self-host JetBrains Mono varian variable (latin + latin-ext) di `public/fonts/`; tambah `@font-face` `font-display: swap`, satu `<link rel="preload">`, dan `size-adjust` pada fallback untuk menekan CLS.
4. Angka: `tabular-nums` pada kolom angka; label satuan dipisah agar tidak memaksa ukuran kecil.
5. Uji pemuaian: cek 52 label Gayo/ID pada 320 px (target: tanpa pemotongan; teks boleh membungkus, bukan memotong).
**Kriteria terima:** 0 teks < 12 px; seluruh teks isi ≥ 16 px; `dist/` memuat ≥ 1 berkas font; `npm run check:bundle` tetap ≤ 200 kB (perkiraan akhir ±165 kB); tidak ada truncation di 320 px.

### P4 — Keadaan menunggu / kosong / basi / gagal (usaha **M**) · ✅ **SELESAI 2026-10-16**
**Hasil terukur:** `Skeleton.jsx` (kemunculan tertunda 300 ms, denyut mati saat reduced-motion) + `EmptyState.jsx` dipakai **10 kartu data** (sebelumnya `return null` tanpa penjelasan) + `Notice.jsx` untuk data basi (dengan tombol “Muat ulang sekarang” ≥ 44 px), offline (terpusat, penanda data cache) dan “koneksi kembali” (bisa ditutup, tidak memaksa) + spinner dalam tombol kirim laporan; `navigator.storage.persist()` diminta sekali; `tests/stateContract.test.js` (9 uji) → suite **368 uji**.
**Langkah**
1. Ganti status memuat teks → **skeleton** per kartu dengan tinggi tetap (stabilkan CLS), muncul > 300 ms, tanpa animasi bila `prefers-reduced-motion`.
2. Empty state bermakna per kartu ("belum ada deteksi hotspot di Gayo — ini normal di musim hujan") + langkah berikutnya.
3. Status basi: label + ikon + kalimat tindakan ("Data terakhir 2 jam lalu · coba muat ulang"), tombol muat ulang ≥ 44 px.
4. Spinner di dalam tombol untuk aksi kirim (`ReportButton`), nonaktifkan ulang-kirim beruntun, konfirmasi sukses lewat `aria-live`.
5. Offline: banner tetap + penanda data dari cache; setelah kembali online, tawarkan muat ulang (jangan paksa).
**Kriteria terima:** keempat keadaan ada di setiap kartu data; tidak ada layar kosong tanpa penjelasan; pembaruan diumumkan lewat `aria-live`.

### P5 — Gerak, area aman & polish visual (usaha **S**) · ✅ **SELESAI 2026-10-16**
**Hasil terukur:** token gerak `--ease-enter`/`--ease-exit` dipakai `.anim-enter`; **0** `animate-pulse`/`animate-bounce` dan **0** durasi > 300 ms di `src/`; umpan balik tekan `active:scale-[.97]` di **26 tempat / 15 berkas**; `viewport-fit=cover` aktif + `env(safe-area-inset-top)` di kedua header dan `env(safe-area-inset-bottom)` di navigasi bawah; `theme-color` dinamis mengikuti tema terpilih + `meta color-scheme`; `tests/motionContract.test.js` (9 uji) → suite **377 uji**.
1. Terapkan tabel motion §5; tambah umpan balik tekan (`active:scale-[.97]` 90 ms) pada tombol utama.
2. Hapus makna dari `animate-pulse` (level ekstrem tetap dikenali tanpa denyut), jaga blok `prefers-reduced-motion`.
3. `index.html`: `viewport-fit=cover`, `theme-color` untuk terang & gelap (`media="(prefers-color-scheme: dark)"`).
4. Audit `min-w-0` pada baris flex (temuan: beberapa kolom grid sudah, beberapa belum).
**Kriteria terima:** tidak ada animasi > 300 ms; safe-area terbukti aktif di perangkat (bukan emulator); tangkapan layar gelap/terang bersih.

### P6 — Pengaman & tata kelola (usaha **S–M**) · ✅ **SELESAI 2026-10-16**
**Hasil terukur:** `eslint.config.js` (flat) + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks` (devDependency, 0 dampak bundel) dan skrip **`npm run lint`** — 70 temuan awal → **0**; CI mendapat langkah lint sebelum tiap paket. Temuan nyata yang diperbaiki: latar dialog `AboutData`/`ReportButton` kini `<button>` sungguhan, `role="tablist"` dipindah ke daftar tab, hook React di `App.jsx` diperbaiki (`useCallback([tr])` + deps lengkap + `useMemo` tanpa dependensi berlebih), konstanta Lanczos ditulis ulang identik, 29 impor `React` mati + impor/variabel mati dibuang. Jalur uji browser didokumentasikan (`docs/how-to/09-uji-browser-a11y.md` + `.pa11yci.json`, ratchet, 4 tab × 2 tema) — dijalankan manual karena runner tidak punya browser.
1. `check:contrast -- --strict` di CI (langkah sudah ada, tinggal ubah flag setelah P1).
2. Usul ESLint flat config + `eslint-plugin-jsx-a11y` (devDependency; 0 dampak bundel) dengan skrip `npm run lint`, aturan inti: `alt-text`, `anchor-is-valid`, `no-static-element-interactions`, `click-events-have-key-events`.
3. Dokumentasikan jalur uji browser (untuk dijalankan manual di mesin Hermes): `npx pa11y-ci` pada halaman produksi + `@axe-core/playwright` untuk 4 tab × 2 tema; ambang dimulai dari kondisi sekarang lalu diturunkan bertahap (ratchet).
4. Perbarui `docs/reference/SKRIP-NPM.md`, `CHANGELOG.md`, `docs/dev/10-ROADMAP-V3.md` §2b (baris utang teknis design), `docs/dev/README.md`, dan `AGENTS.md` (daftar skrip gerbang).
**Kriteria terima:** tiga langkah CI baru hijau; dokumen rujukan memperbarui daftar skrip; tidak ada temuan desain yang hanya hidup di kepala orang.

## 7. Urutan & gerbang CI

```
P1 token+kontras  →  check:contrast --strict  →  P2 a11y interaksi
      ↘                                           ↘
        P3 tipografi+font  →  build+bundle  →  P4 state  →  P5 gerak/safe-area  →  P6 pengaman+docs
```

Gerbang setelah tiap paket: `npm run lint` · `npm test` (377) · `npm run check:coverage` · `npm run check:contrast` · `npm run check:typography` · `npm run build` · `npm run check:bundle` · `npm run smoke` · `npm run check:outlook` · `npm run check:i18n`.
**Jangan** menyentuh `tailwind.config.js`/`postcss.config.js` (sudah dihapus pada v2.1.0) dan jangan menambah dependensi runtime.

## 8. Log 50 putaran (audit → riset → rencana)

Tiap putaran = satu siklus penuh: periksa keadaan → cari rujukan/ukuran → tetapkan keputusan. Angka pada kolom temuan berasal dari skrip audit yang sama dengan `check:contrast`.

### Fase A — putaran 1–28: audit per berkas `src/`

| # | Fokus | Temuan kunci | Keputusan |
|---|---|---|---|
| 1 | `DisasterWarning.jsx` (215 l) | 34 teks gagal kontras, 24 teks 10–13 px — di kartu peringatan utama | Prioritas P1+P3; headline bahaya ≥ 16 px |
| 2 | `AirQualityCard.jsx` (232 l) | 37 gagal (terparah); kategori ISPU hanya warna + angka kecil | P1 token + label kategori teks + ikon |
| 3 | `HazardPanel.jsx` (192 l) | 23 gagal, 17 teks kecil, 5 tombol tanpa 44 px; akordeon sudah `aria-expanded` | P2 target sentuh; `aria-expanded` dipertahankan |
| 4 | `HazardFocusCards.jsx` (288 l) | 30 gagal, 27 teks kecil; 4 kartu bahaya dibedakan warna | P1 ramp level + ikon/bentuk berbeda |
| 5 | `FireDangerCard.jsx` (209 l) | 25 gagal, 21 teks kecil; angka FWI pakai `font-data` yang tak termuat | P3 skala + font self-host |
| 6 | `HourlyForecast.jsx` (57 l) | 14 gagal; label jam 10–11 px | P3 (≥ 12 px, kolom tetap) |
| 7 | `DroughtCard.jsx` (154 l) | 21 gagal; skala SPI/HTH panjang tanpa legenda teks | P1 + legenda teks eksplisit |
| 8 | `DisasterHistoryCard.jsx` (68 l) | 11 gagal, 8 teks kecil, 2 tombol | P1+P3 |
| 9 | `DesktopHeader.jsx` (85 l) | 4 gagal; 4 `hover:` tanpa padanan `focus:` | P2 fokus eksplisit |
| 10 | `EmergencyContacts.jsx` (38 l) | 6 gagal; kontak darurat = aksi paling kritis saat panik | P1+P2 (tombol telepon ≥ 44 px) |
| 11 | `LocationRail.jsx` (45 l) | 4 gagal; label 11 px | P3 |
| 12 | `MetricChip.jsx` (29 l) | 5 gagal; chip informasi | P1 |
| 13 | `App.jsx` (328 l) | Status memuat = teks 13 px `ink/50` (3,21:1), footer 11 px `ink/45` (2,81:1) | P4 skeleton + P1 kontras |
| 14 | `AboutData.jsx` (113 l) | Dialog sudah Escape + autofocus ✓; 7 gagal | Pertahankan pola; P1 |
| 15 | `AppBar.jsx` (91 l) | `focus-visible:outline-none` (fokus hilang); toggle tema emoji tanpa nama aksesibel; baris brand `ink/40` | P2 (kritis) |
| 16 | `CoffeeAdvisory.jsx` (60 l) | 6 gagal, 9 teks kecil; konten edukasi | P3 |
| 17 | `DistrictSelector.jsx` (44 l) | 5 gagal; kontrol pilihan wilayah | P3 (input ≥ 16 px) |
| 18 | `ReportButton.jsx` (286 l) | Modal terbaik di repo: Escape + focus trap + 8 target 44 px + `role="status"` | Dijadikan acuan pola internal |
| 19 | `SchematicMap.jsx` (102 l) | 5 heks mentah di luar palet + 7 gagal | P1 (R3 tanpa heks) + P4 legenda |
| 20 | `BottomNav.jsx` (51 l) | `env(safe-area-inset-bottom)` ada tetapi inert | P5 `viewport-fit=cover` |
| 21 | `ClimateBanner.jsx` (47 l) | 6 teks kecil pada banner ENSO | P3 |
| 22 | `ErrorBoundary.jsx` (38 l) | Kelas `slate-*`/`rose-*` di luar palet | P1 |
| 23 | `InstrumentPanel.jsx` (57 l) | 7 gagal | P1 |
| 24 | `MobileTabShell.jsx` (14 l) | `anim-enter` 200 ms ✓ sesuai rekomendasi | Dipertahankan |
| 25 | `RainChart.jsx` (92 l) | Kontras aman, tetapi tanpa pola/label langsung/ringkasan a11y | P2+P4 (pengkodean berulang) |
| 26 | `SeasonalBanner.jsx` (30 l) | `role="status"` ✓; 4 teks kecil | P3 |
| 27 | `ShareButton.jsx` (49 l) | Hanya `hover:`; tanpa `active:`/fokus khusus | P5 umpan balik tekan |
| 28 | `main.jsx` + kerangka | Tidak ada skip-link, tidak ada `aria-live` di seluruh app | P2 |

### Fase B — putaran 29–40: riset klaster → implikasi

| # | Klaster | Temuan kunci | Keputusan |
|---|---|---|---|
| 29 | WCAG 2.2 AA | 6 kriteria baru; 4.1.1 dihapus; pemindai otomatis ±57 % | Gerbang otomatis + protokol manual §9 |
| 30 | Tipografi ponsel | 16 px ambang isi; < 16 px pada input → zoom iOS | R2, skala §4 |
| 31 | Pesan literasi rendah | Pola situasi → masalah → solusi + aksi konkret | Struktur kartu peringatan diseragamkan |
| 32 | Palet buta warna | Butuh beda terang + bentuk; merah/kuning/hijau gagal | Ramp level + ikon per level |
| 33 | Tooling a11y CI | axe/pa11y/LHCI butuh browser; `eslint-plugin-jsx-a11y` tidak | Gerbang kontras mandiri (dipakai), lint a11y di P6 |
| 34 | Tailwind 4 | `@theme inline` + var → satu token, dua tema | Strategi P1 |
| 35 | Grafik aksesibel | Pola + label langsung + tabel/ringkasan tersembunyi | `RainChart`, `SchematicMap` |
| 36 | Font self-host | WOFF2 subset + swap + preload + `size-adjust` | P3 (biaya ±30–40 kB, anggaran aman) |
| 37 | Motion timing | Tabel durasi per interaksi; jangan linear kecuali warna | §5 |
| 38 | Offline PWA | Banner + label basi; muat ulang atas permintaan pengguna | P4 |
| 39 | Skeleton | Skeleton > spinner > kosong; manfaat utama = stabilitas layout | P4 skeleton bertata tetap |
| 40 | Safe-area | Tanpa `viewport-fit=cover`, `env()` = 0 | P5 |

### Fase C — putaran 41–50: lintas-potong & implementasi

| # | Fokus | Temuan/keputusan |
|---|---|---|
| 41 | Nilai token teks | 12 kandidat diuji; dipilih 8 nilai (4 terang, 4 gelap) yang **lulus di tiga permukaan** (mis. `ink-muted #6A6058` = 5,73/6,13/5,21) |
| 42 | Ramp level | Teks/tint terukur 4,88–7,71 (terang) & 8,60–11,06 (gelap); tint saja 1,18–1,24 → ditambah garis aksen 3 px + ikon per level |
| 43 | Seri grafik | 5 seri diuji simulasi protanopia/deuteranopia; 3 pasangan ΔE < 15 → wajib pola/penanda/label langsung |
| 44 | Tombol & aksen | Putih di `leaf-deep` 7,97:1 · putih di `cherry` 6,39:1 · `ink` di `husk` 6,96:1 → semua kombinasi tombol lolos |
| 45 | Cincin fokus | `leaf-deep` 7,46:1 (terang) · `leaf-soft` 8,58:1 (gelap) → dipakai global, tanpa `outline-none` |
| 46 | Skala tipografi | `text-caption 12` · `label 14` · `body-sm 14` · `body 16` (default), `font-data 14–16` + `tabular-nums` |
| 47 | Motion & reduced-motion | Durasi final §5; `animate-pulse` dilepas dari makna; transisi tema 150 ms |
| 48 | Keadaan aplikasi | 4 keadaan wajib per kartu: memuat (skeleton) · kosong (penjelasan) · basi (aksi) · gagal (ulang) |
| 49 | I18n & pemuaian | Label Gayo 20–35 % lebih panjang → tanpa truncation pada 320 px; uji label `[?]` setelah H-4 |
| 50 | Konsolidasi & pengaman | `scripts/check-contrast.mjs` (+11 uji) & langkah CI dipasang; audit ulang saat penyusunan: **338 uji lulus**, cakupan 95,68/84,05/95,88 %; dokumen ini + `DESIGN-TOKENS.md` diterbitkan. Setelah P1–P2: **350 uji**, 95,78/84,20/95,94 % |

## 9. Definisi selesai (Definition of Done)

**Otomatis (CI):** `npm run lint` · `npm test` (377) · `check:coverage` · `check:contrast --strict` · `check:typography` · `build` · `check:bundle` (≤ 200 kB JS) · `smoke` · `check:outlook` · `check:i18n`.
**Manual (butuh manusia/telepon nyata):**
1. **Keyboard:** Tab dari atas → skip-link → seluruh kontrol; tidak ada jebakan fokus; tab tab berpindah dengan panah; Shift+Tab berbalik arah.
2. **Pembaca layar** (TalkBack/VoiceOver/NVDA): 4 tab terbaca; perubahan status & hasil laporan diumumkan; peta punya ringkasan teks.
3. **Buta warna:** simulasikan deuteranopia/protanopia pada 4 tab × 2 tema — level & seri grafik tetap terbedakan tanpa warna.
4. **Zoom teks 200 %** & lebar 320 px: tidak ada isi terpotong atau perlu gulir horizontal (kecuali tabel).
5. **Perangkat nyata kelas menengah-bawah** di jaringan 4G: ukur LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1; cek safe-area pada perangkat berponi.
6. **Konteks lapangan:** 3 pengguna (petani muda, petani senior, guru) menyebutkan (a) level hari ini, (b) aksi yang harus dilakukan, dalam < 15 detik. Ini sekaligus mengunci bahasa label Gayo (H-4).
7. **Andaikan koneksi mati total:** aplikasi tetap terbuka, data terakhir berlabel basi, tombol muat ulang bekerja setelah online.

## 10. Risiko & keputusan yang masih terbuka

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Menambah berat font & token | Bundel naik ±30–40 kB | Anggaran 200 kB longgar (131,6 kB); subset + satu berkas variabel; `check:bundle` menjaga |
| Penggantian 262 pemakaian opasitas | Regresi visual halus tak terlihat tanpa mata manusia | Kerjakan P1 pada cabang terpisah + tangkapan layar 4 lebar × 2 tema sebelum/sesudah |
| Gerbang kontras `--strict` menyala lebih awal | CI merah saat P1 belum tuntas | ✅ Ditutup: CI memakai `--strict` sejak P1 (34/34 lulus) |
| Pemindai a11y statis (tanpa browser) bisa luput dari masalah nyata | Hasil P2 tak terverifikasi visual | Ditutup sebagian oleh `tests/a11yContract.test.js`; sisa verifikasi keyboard/TalkBack tetap manual (§9) |
| Perubahan tema besar di Tailwind 4 | Risiko keluaran kompilasi tak terduga | P1 hanya menambah token (tanpa menghapus kelas lama); pembersihan pasangan `dark:` dilakukan per komponen dengan uji + tangkapan layar |
| Label Gayo (H-4) belum selesai | Uji pemuaian teks tak bisa final | Struktur tahan panjang (boleh membungkus) diuji lebih dulu dengan versi panjang buatan |

**Keputusan pengguna (16 Okt 2026) — sudah dijawab:**
1. ✅ **Urutan:** kerjakan **P1→P6 berurutan otomatis**, tiap paket lewat gerbang CI dan dikirim sebagai paket Drive tersendiri.
2. ✅ **ESLint + `eslint-plugin-jsx-a11y`:** **boleh** (devDependency, 0 dampak bundel) — dipasang di P6.
3. ✅ **Font:** **bundel** `JetBrains Mono` subset latin+latin-ext (±30–40 kB) — dikerjakan di P3.
4. ✅ **Ikon panduan aksi petani:** boleh menambah ikon (bukan foto) memakai paket `lucide` yang sudah ada — dikerjakan bersama P3/P4.

## 11. Catatan pelaksanaan

| Paket | Status | Bukti |
|---|---|---|
| P1 token & kontras | ✅ selesai 2026-10-16 (commit `P1`) | 417 penggantian · `check:contrast --strict` hijau (34/34) · CI memakai `--strict` · `LevelGlyph` di `HazardPanel` · 340 uji · bundel 132,0 kB |
| P2 a11y interaksi | ✅ selesai 2026-10-16 (commit `P2`) | 0/25 tombol < 44 px · tablist+tabpanel penuh · skip-link + `aria-live` · `a11yContract` 10 uji · skala teks jadi token · 15 label i18n |
| P3 tipografi & font | ✅ selesai 2026-10-16 (commit `P3`) | 212 ukuran → token · 0 teks < 16 px isi / 0 teks < 12 px · JetBrains Mono 42 kB self-host + preload + fallback metrik · gerbang `check:typography` (9 uji) |
| P4 keadaan aplikasi | ✅ selesai 2026-10-16 (commit `P4`) | `Skeleton` (300 ms, reduced-motion) · `EmptyState` di 10 kartu · pita basi/offline/kembali daring (1 pengumuman) · spinner tombol kirim · `stateContract` 9 uji → 368 uji |
| P5 gerak & area aman | ✅ selesai 2026-10-16 (commit `P5`) | token gerak · 26 umpan balik tekan/15 berkas · `viewport-fit=cover` + safe-area header & nav · `theme-color` dinamis · `motionContract` 9 uji → 377 uji |
| P6 pengaman & docs | ✅ selesai 2026-10-16 (commit `P6`) | ESLint + `jsx-a11y` + react-hooks (0 temuan, langkah CI) · jalur uji browser terdokumentasi (pa11y/axe, ratchet) · dokumen gerbang disinkronkan |
| P7.1 token dua tangga | ✅ selesai 2026-10-17 (commit `d7763d1`) | 87 token Tanah/Langit · Bricolage 76,9 kB + Instrument Sans 30,1 kB · `check:contrast --strict` 78/78 |
| P7.2 hapus Bahasa Gayo | ✅ selesai 2026-10-17 (commit `f00e48b`) | `messages.js` satu bahasa (88 kunci) · pemilih bahasa & uji Gayo dihapus · `check:i18n` hijau |
| P7.3 komponen inti | ✅ selesai 2026-10-17 (commit `030796a`) | `LevelBadge`/`StatusHeadline`/`AttentionCard`/`DetailPanel` · 45 uji kontrak |
| P7.4 beranda mobile | ✅ selesai 2026-10-17 (commit `74bc088`) | Ringkas + 4 metrik + 3 kartu + bilah 12 jam · axe 0 @320/390/430 ×2 arah |
| P7.5 papan desktop v6 | ✅ selesai 2026-10-17 (commit `1b9d6bf`) | rel 264/76 · 5 zona · inspector 380 · palet ⌘K 31 aksi · 26 uji · axe 0 @1024–1920 |
| P7.6 PWA | ✅ selesai 2026-10-17 (commit `1adc5ff`) | manifest `id=/niu/` + 3 pintasan · ikon Niu · `offline.html` · tawaran Android/iOS · 23 uji |
| P7.7 bahasa manusia | ✅ selesai 2026-10-17 (commit `7263d45`) | judul pertanyaan · akronim turun ke Detail · "Angka & istilah teknis" · desimal koma · 9 uji |
| P7.8 ikonografi | ✅ selesai 2026-10-17 (commit `d66eb33`) | 11 ikon bahaya + 6 cuaca · favicon · judul dokumen Niu · 6 uji |
| P7.9 rilis 2.2.0 | ✅ selesai 2026-10-17 | bundel 143,9 kB (≤155) · 507 uji · cakupan 96,22/84,91/96,42 · CHANGELOG + versi 2.2.0 |

**P6.1 (17 Okt 2026) — perbaikan `npm ci`:** paket sync-18 lolos semua gerbang lokal tetapi **gagal di CI pada langkah “Install dependencies”** (`ERESOLVE`), karena `eslint-plugin-jsx-a11y@6.10.2` hanya mengakui peer `eslint` ≤ 9 sementara proyek memakai ESLint 10.13.0; instalasi lokal waktu itu memakai `--legacy-peer-deps`. Solusi: berkas **`.npmrc`** (`legacy-peer-deps=true`, berkomentar + syarat pencabutan) dan lockfile diregenerasi; diverifikasi pada instalasi bersih (`npm ci` ✓, lint 0 temuan). **Jangan** memundurkan ESLint ke 9 — di 9.39.5 `no-unused-vars` inti tidak mengenali tag JSX (66 temuan palsu).

**Catatan teknis P6 yang perlu diingat:** (a) `npm run lint` **wajib** hijau sebelum commit — aturan `jsx-a11y` menangkap klik pada elemen statis, `alt-text`, dan `anchor-is-valid`; (b) latar dialog harus `<button tabIndex={-1} aria-label="Tutup">`, bukan `<div onClick>`; (c) `role="tablist"` hanya di daftar tab, bukan di `<nav>`; (d) jangan menambah `eslint-disable` bila dependansi hook bisa dibetulkan — perbaiki deps-nya; (e) uji browser (pa11y/axe) tetap tugas manusia: `docs/how-to/09-uji-browser-a11y.md`.

**Catatan teknis P5 yang perlu diingat:** (a) `env(safe-area-inset-*)` bernilai 0 tanpa `viewport-fit=cover` — jangan menghapusnya dari `index.html`; (b) `theme-color` satu meta yang diperbarui JS mengikuti tema terpilih, bukan pasangan `media="(prefers-color-scheme: …)"` (aplikasi punya sakelar tema sendiri); (c) jangan memakai `animate-pulse` untuk membawa makna — ada uji yang melarangnya; (d) `min-w-0` wajib pada anak flex berteks panjang, termasuk apa pun yang membungkus `font-data`.

**Catatan teknis P4 yang perlu diingat:** (a) skeleton hanya dirender setelah 300 ms (`useDelayedVisible`) — jangan menampilkannya seketika, getaran itulah yang membuat aplikasi terasa lambat; (b) pengumuman offline **hanya** dari `App` (pita `Notice`), jangan menambahkannya lagi di header agar pembaca layar tidak mengulang; (c) `EmptyState` wajib memuat petunjuk langkah berikutnya, bukan hanya “tidak ada data”; (d) pita keadaan memakai `role="status"` (sopan) bukan `alert` — kecuali galat yang menghentikan alur.

**Catatan teknis P3 yang perlu diingat:** (a) @font-face harus berada **setelah** `@import "tailwindcss";` dan **tanpa** titik-koma liar — kesalahan kecil di situ menggagalkan `lightningcss minify` saat build; (b) `size-adjust: 102%` dihitung dari advanced monospace lazim (Consolas 0,550 em · Menlo/DejaVu 0,602 em) vs JetBrains Mono 0,600 em — angka ini perkiraan, bukan hasil pengukuran perangkat; (c) font hanya untuk angka (`font-data`), teks isi tetap font sistem supaya unduhan tetap 42 kB; (d) uji pemuaian label Gayo pada 320 px masih butuh mata manusia (lihat §9).

**Catatan teknis P2 yang perlu diingat:** (a) skala teks hidup sebagai token `--text-*` di `@theme` sehingga utilitas baru tanpa token langsung ketahuan lewat uji kontrak; (b) pemindai target sentuh memeriksa tag `<button>` termasuk `className` dinamis (konstanta lokal seperti `const link = 'min-h-11 …'`); (c) tint latar kartu level masih memakai pasangan `dark:` — penyisiran bersama P3; (d) verifikasi keyboard/pembaca layar tetap manual (sandbox tanpa browser).

**Catatan teknis P1 yang perlu diingat:** (a) token baru tidak menambah dependensi dan hanya menambah ±0,4 kB gzip; (b) `check-contrast.mjs` kini mengabaikan komentar blok sehingga contoh anti-pola di dokumentasi/kode tidak dihitung sebagai temuan; (c) dua token jembatan `ink-body`/`mist-body` (~8:1) ditambahkan supaya teks isi tidak menyatu dengan judul saat opasitas dinaikkan; (d) tangkapan layar terang/gelap tetap perlu dilakukan manusia (sandbox tanpa browser).


**Catatan teknis P7 yang perlu diingat:** (a) token Tanah/Langit berada di `@theme` + `[data-theme=…]`, jangan menambah hex baru di komponen; (b) semua angka teknis punya rumah di Detail (`HazardDetail` tab Angka, `AboutData`, `<details>` di tiga kartu) — jangan menghapusnya dari sana; (c) `InstallHint` hanya tawaran, bukan penghalang: tunda 7 hari, tombol tutup selalu ada; (d) ikon bahaya/cuaca selalu dekoratif (`aria-hidden`) karena nama selalu teks; (e) `InstrumentPanel` dan `DistrictSelector` tidak lagi dipakai tetapi sengaja disimpan sampai pemilik memutuskan.
