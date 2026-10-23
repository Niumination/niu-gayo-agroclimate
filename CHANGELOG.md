# Changelog

## [2.2.5] — 2026-10-23 — Sumber data: kegagalan IMERG & MAGMA akhirnya bisa didiagnosis

Sprint B bagian 3 — F-05 (IMERG 0/15) dan F-16 (MAGMA 403). Kedua temuan ini **bukan bug parser**:
parser dan URL terbukti benar saat diuji dari host lain (MAGMA: 200, 69 gunung, Bur Ni Telong
"Waspada"; IMERG: endpoint menjawab 302/401 sesuai ada-tidaknya token). Yang salah adalah **cara
sistem melaporkan kegagalannya** — dan itu yang membuat masalah di host tidak pernah bisa dituntaskan.

**F-05 — IMERG: berhenti menyamarkan kegagalan sebagai "data belum terbit"**
- `fetchText()` dulu menelan semua respons selain 401/403 menjadi `null`. Token yang tidak terpasang
  membuat NASA mengalihkan (302) ke halaman login, `fetch` mengikuti redirect itu, menerima **200
  berisi HTML**, dan parser menganggapnya "granule belum ada". Hasilnya `imergCount: 0` dengan alasan
  menyesatkan, sementara 12 tanggal × 3 percobaan tetap dijalankan.
- Sekarang `redirect: 'manual'` + klasifikasi eksplisit: `302 → login`, `401/403 → token ditolak`,
  `200 + HTML → halaman login`, `404 → benar-benar kosong`, selain itu jaringan.
- Galat auth/HTML **tidak** diulang per tanggal; host tak terjangkau berhenti setelah **2** tanggal
  (dulu bisa 12). Diukur: satu kegagalan kini selesai ~3,4 detik, bukan puluhan detik/menit.
- `/healthz` mendapat `sources.imerg` (`imergCount`, `fallbackCount`, `total`, `error` = alasan
  terakhir dari sentra), jadi `verify:deployment` otomatis menampilkannya sebagai peringatan sumber.
  `/api/alerts` tetap menyebut alasan per sentra (`antecedent.fallbackReason`).

**F-16 — MAGMA: satu percobaan ulang dengan UA peramban, lalu pesan yang jujur**
- `fetchMagmaHtml()` mengirim UA aplikasi; bila dijawab 401/403, mencoba **sekali** dengan UA peramban.
  Bila tetap ditolak, pesannya menyebut blokir di sisi sumber, bukan "HTTP 403" telanjang, dan payload
  `/api/volcano` menandai `blocked: true`.
- Nilai terakhir tetap dipakai (`stale: true`) dengan batas umur `MAGMA_STALE_DAYS` seperti sebelumnya.

**Yang belum berubah (dan tidak bisa diselesaikan dari kode):** data IMERG baru akan kembali bila host
produksi punya token Earthdata yang sah **dan** bisa menjangkau `gpm1.gesdisc.eosdis.nasa.gov`; MAGMA
baru pulih bila IP host tidak lagi diblokir (atau UA peramban lolos). Keduanya kini terlihat jelas di
`/healthz` alih-alih tersembunyi.

**Gerbang uji:** 611 tes (+8), eslint 0, build OK, hash aset **tidak berubah**.

## [2.2.4] — 2026-10-23 — Laporan warga: tulis atomik, simpanan terbatas, rate limit tak bisa dipalsukan

Sprint B bagian 2 — tiga temuan audit pada jalur `POST /api/reports`. Ketiganya berada di satu berkas
(`server/reports.js`) dan satu baris route, jadi digabung dalam satu patch. Bentuk respons API tidak
berubah: `201` / `400` / `413` / `429` tetap sama.

**F-34 — penulisan atomik**
- `saveReports()` dulu memanggil `fs.writeFileSync()` langsung ke `reports.json`. Proses yang mati di
  tengah penulisan meninggalkan JSON terpotong; `loadReports()` menelannya sebagai `[]` dan **seluruh
  riwayat laporan hilang tanpa suara**.
- Kini: serialisasi dulu (gagal = tidak menyentuh berkas), tulis ke `*.tmp` di direktori yang sama,
  `fsync`, lalu `rename` (atomik di POSIX). Galat apa pun membersihkan berkas sementara dan membiarkan
  berkas lama utuh.

**F-35 — simpanan tidak lagi tumbuh tanpa batas**
- Tiap kiriman dulu menambah entri selamanya, sementara API hanya menyajikan 7 hari.
- Kini `pruneReports()` mempertahankan **30 hari** dan paling banyak **5 000 entri** (±1 MB), entri
  tertua dibuang lebih dulu; entri tanpa `timestamp` valid ikut dibuang. `loadReports()` juga menolak
  JSON yang bukan larik.

**F-36 — rate limit tidak bisa dilewati dengan header buatan sendiri**
- Kunci dulu diambil dari `x-forwarded-for` apa adanya (dipecah pada koma pertama) — nilai yang
  sepenuhnya ditulis klien. Mengganti header tiap permintaan = batas 5/jam tidak pernah tercapai, dan
  tiap IP palsu menjadi kunci baru di peta in-memory.
- Kini `clientIp()`: `cf-connecting-ip` (ditimpa Cloudflare) → XFF **hanya** bila `TRUST_PROXY_XFF=1`,
  dengan hop **terakhir** (proxy terdekat) → alamat soket. Peta kunci dipangkas saat melewati
  **20 000** kunci, jadi IP palsu tidak bisa menggelembungkan memori.

**Bukti runtime (server lokal, port 7461/7462):**
- 6 × `POST /api/reports` dengan `x-forwarded-for` **berbeda** tiap kali → `201 201 201 201 201 429`.
  Sebelum perbaikan, keenamnya `201`.
- Direktori data dibuat read-only → `POST` menjawab `502`, `reports.json` **utuh**, 0 berkas `.tmp`
  tertinggal (dulu penulisan langsung ke berkas tujuan).
- Berkas laporan tetap JSON valid dan hanya berisi entri yang lolos validasi.

**Gerbang uji:** 603 tes (+7), eslint 0, cakupan baris 96,9 %, build OK, hash aset **tidak berubah**
(`index-phbGh5bg.js` / `index-B8VTY5rg.css`) — nol perubahan tampilan.

## [2.2.3] — 2026-10-23 — Gerbang aksesibilitas di browser masuk CI (F-39)

Sprint B dibuka dengan temuan yang paling menahan: sampai 2.2.2 seluruh pemeriksaan a11y repo berjalan
tanpa browser. Tiga temuan Sprint A — label ganda, fokus masuk ke panel terlipat, target sentuh < 24 px —
lolos dari `npm test`, `check:contrast --strict`, `check:typography`, dan ESLint `jsx-a11y` karena hanya
muncul setelah halaman dirender. Pada 2.2.2 ketiganya ditemukan lewat pemeriksaan manual, bukan gerbang.

**F-39 — `npm run check:a11y`**
- `scripts/a11y-gate.mjs` menyalakan tiruan produksi lokal: `dist/` dilayani seperti host statis (SPA
  fallback), `/api/*` diteruskan ke `server/index.js`, lalu axe-core dijalankan di tiga permukaan —
  **Papan desktop**, **Peta hidup · Tanah**, **Peta hidup · Langit** (tema gelap lewat `localStorage`
  sebelum navigasi, bukan sekadar `prefers-color-scheme`).
- Standar yang sama dengan audit: `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`. Satu pelanggaran = exit 1,
  lengkap dengan aturan, dampak, dan selector simpul.
- **Tidak bisa lulus diam-diam:** `CHROME_PATH` yang diset tetapi tidak ada = gagal; `dist/` yang lebih tua
  dari `src/` = gagal (dulu build gagal membuat audit berjalan di atas bundel lama dan tetap hijau);
  galat konsol halaman ikut menggagalkan permukaan itu.
- Tanpa browser sama sekali, gerbang berhenti dengan peringatan + perintah pemasangan (jalur pengembang),
  sedangkan CI selalu memberi `CHROME_PATH` sehingga jalur itu tidak pernah terpakai di sana.

**CI**
- Langkah baru setelah `npm run build`: versi `chrome-headless-shell` **diturunkan dari `puppeteer-core`**
  (`PUPPETEER_REVISIONS`) — bukan dipin tangan — dipasang ke `.cache/browsers/` (gitignored), `CHROME_PATH`
  diekspor lewat `$GITHUB_ENV`, lalu `npm run check:a11y`. Pin manual pernah membuat Chrome 131 dipakai
  bersama `puppeteer-core` 25: halaman kedua menggantung (`Runtime.evaluate` timeout) dan proses tidak
  pernah keluar. Kini versi selalu sepasang, dan gerbang menutup browser di `finally` + keluar eksplisit.
- `puppeteer-core@25.16.0` + `axe-core@4.14.0` sebagai devDependencies: `npm audit` **0 kerentanan**
  (versi 23 membawa 7 advisory high lewat rantai `proxy-agent`/`basic-ftp`; CI tetap hanya menggerbang
  `--omit=dev`, tetapi utang baru tidak perlu ditambah).
- Catatan lama "a11y browser sengaja tidak di CI" dihapus; `docs/how-to/09-uji-browser-a11y.md` kini memuat
  gerbang otomatis sebagai langkah 1, dengan pemeriksaan manual yang tersisa (`2.5.8`, `2.4.11`, zoom 200 %,
  kondisi jaringan) tetap di §3.

**Gerbang uji:** 595 tes (+8 `tests/sprintB.test.js` sebagai kontrak: skrip ada, memakai empat tag WCAG,
tiga permukaan bernama, CI memberi `CHROME_PATH`, `.cache/` gitignored), eslint 0, cakupan 96,76 % baris.
Dibuktikan bisa gagal: satu `<img>` tanpa `alt` disuntik ke `DesktopBoard.jsx` → `✗ Papan desktop:
1 pelanggaran axe [critical] image-alt`, exit 1; setelah dikembalikan, tiga permukaan bersih.

## [2.2.2] — 2026-10-23 — Living Map bisa dijangkau + enam perbaikan audit

Hasil audit 50 iterasi (23 Okt 2026) menemukan fitur Living Map V4 tidak punya jalan masuk:
hanya bisa dibuka dengan mengetik `?tampilan=peta-hidup`. Rilis ini menutup temuan Sprint A.

**F-01 — jalan masuk & keluar Living Map**
- Tombol **Buka peta hidup** di kartu "Aksi cepat" papan desktop, plus aksi `Buka peta hidup` di palet (⌘K).
- Tombol **Papan** di dalam pil label "Peta skematik" + aksi `Kembali ke papan desktop` di palet peta.
- Perpindahan memakai `history.pushState`, jadi tombol Kembali peramban bekerja; `?tampilan=peta-hidup` tetap sah.

**F-02 — fokus tidak lagi masuk ke panel yang tertutup**
- Isi dua panel bawah diberi `inert` + `aria-hidden` saat ringkas. Sebelumnya 12 tombol jam tersembunyi masih
  menerima fokus keyboard (panel 58 px, `overflow: hidden`, isi 302 px).

**F-03 — `POST /api/cache/flush` tidak lagi terbuka**
- Wajib `x-cron-token` bila `ALERTS_CRON_TOKEN` diset; tanpa token hanya menerima permintaan langsung dari loopback
  tanpa header proxy (`cf-connecting-ip`/`x-forwarded-for`/`x-real-ip`). Metode selain POST → 405.

**F-07 — struktur judul & nama aksesibel**
- `<h1>` tersembunyi di kerangka desktop (papan & peta), mengikuti sentra terpilih.
- Pemilih sentra dan dua tombol legenda peta tidak lagi memakai `aria-label` yang menimpa teks terlihat
  (axe `label-content-name-mismatch`, 3 simpul).

**F-08 — footer kembali setipis teksnya**
- Tombol "Tentang data & batasan" memakai target 24 px (WCAG 2.2 SC 2.5.8), bukan 44 px di dalam baris 26 px.
  Menghilangkan 9 px gulir vertikal yang muncul di semua lebar desktop.

**F-26 — bidang ketuk pin peta 24 px**
- Lingkaran transparan r=12 pada tiap pin (sebelumnya 23 px mengikuti tinggi label).

**F-15 — `verify:deployment` membaca versi dari `package.json`**
- Versi tidak lagi ditulis ulang di skrip, sehingga naik versi tidak membuat verifikasi gagal.

**Gerbang uji:** 587 tes (6 berkas uji baru `tests/sprintA.test.js`), eslint 0, dan `a11yContract` diperketat —
pola lama `min-h-[?\d` menerima semua tinggi termasuk 24 px; kini hanya 44 px ke atas, dengan dua pengecualian
teks sebaris yang ditandai `data-target="inline"` dan didaftarkan namanya.

## [2.2.1] — 2026-10-18 — Bahasa manusia, sinkronisasi upstream & ketahanan deployment

Penerapan paket zip v2.2.0 ke live site menghasilkan 57 akronim teknis tampil di lapisan 1 desktop (target prototipe = 10). Root cause: spesifikasi P7.7 hanya menguji `messages.js` + 3 kartu lama; `headline` modul bahaya dan `subtitle`/`footer` `HazardFocusCards.jsx` tidak terjangkau uji.

**Perbaikan (commit `fca5d75`):**
- `headline` 6 modul bahaya: kalimat manusia, akronim teknis pindah ke `detail` (lapisan Detail)
- `HazardFocusCards.jsx`: subtitle/footer tanpa ECMWF/GFS/GloFAS/PVMBG/MAGMA; label metrik storm pakai bahasa manusia
- `FireDangerCard.jsx`: subtitle tanpa FWI/FDRS/ERA5/ECMWF
- `temperature.js`: label "VPD siang" → "Tekanan uap siang"
- `volcano.js`: headline tanpa Level/ROMAN
- `quake.js`: headline tanpa MMI/BMKG
- Gerbang uji baru: `tests/copyLanguage.test.js` cek `headline` + `subtitle`/`footer` tidak boleh ada akronim teknis
- 5 test lama diupdate untuk kontrak baru

**Perbaikan lanjutan (commit `63f9995`):**
- `seasonal.js`: HTH → "hari tanpa hujan" di advice musiman
- `healthAdvice.json`: "pantau ISPU setiap pagi" → "pantau udara setiap pagi"

**Hasil ukur (browser DOM scan):**
| | Sebelum | Sesudah |
|---|---|---|
| Akronim visible desktop | 57 | 13 |
| Akronim visible mobile | 14 | 3 |

Sisa = nama lembaga (BMKG/PVMBG/MAGMA) + label metrik (PM2,5/AOD/FWI) + footer Detail + teks arsip (MMI VII) — sesuai prototipe.

**Gates:** 509/509 test pass · lint 0 · build 144.0 kB · bundle hash `CKKltsPD`

### Sprint sinkronisasi upstream & ketahanan deploy — 2026-10-18

- Patch disusun di atas upstream `main` terverifikasi `f5463cddf2e6327271b6fde0d555fd3e6813ccd3`; tidak mengubah remote dan tidak melakukan push/deploy.
- Build mencatat versi, revisi Git, status working tree, waktu build, dan daftar aset JS/CSS. `/healthz` membandingkan revisi API dengan frontend; `verify:deployment` memeriksa build, aset, cache entry-point, service worker/PWA, dan API setelah penerapan.
- `/api/weather`, `/api/ensemble`, agregat `/api/alerts`, dan `/api/hotspots` mempertahankan JSON `200` berstatus degraded saat sumber eksternal gagal; jalur SPA tidak lagi menyamarkan aset hilang sebagai `index.html`; cache entry-point/PWA diperketat.
- Kesalahan muat utama dan batas aplikasi memakai pesan pengguna; rincian teknis tetap dapat dibuka. Ringkasan cuaca, musim, kartu bahaya, skor, sumber, ambang, dan metode berada pada lapisan Detail. Menu dan fitur tidak dihapus.
- Outlook iklim ditinjau ulang terhadap publikasi BMKG 13 Oktober dan NOAA CPC 8 Oktober 2026; angka, periode, dan indeks dari dua lembaga dibedakan.
- Pemisahan vendor diperbarui dari opsi Rolldown yang deprecated ke `rolldownOptions.output.codeSplitting.groups`.
- **Verifikasi lokal:** 517/517 uji lulus; lint lulus; cakupan 96,49% baris / 84,25% cabang / 96,53% fungsi; audit dependensi penuh 0 temuan; outlook, i18n, kontras 78/78, tipografi, build, provenance, dan bundle diperiksa. Smoke test lokal lulus; sebagian sumber eksternal dapat berstatus degraded tanpa menghasilkan HTTP 5xx. Deployment live belum dilakukan dan tetap harus diverifikasi setelah penerapan.

## [2.2.0] — 2026-10-17 — Rilis **Niu** (Round L, P7.1–P7.9) ✅

Wajah baru penuh: identitas **Niu**, dua arah **Tanah/Langit**, bahasa manusia, PWA terpasang, tanpa Bahasa Gayo.

### P7.1 — Token dua tangga & font baru ✅
- Tangga **TANAH** (terang): kertas `#F1E7D8`, kartu `#FBF6EC`, aksen `#2F4A38`; **LANGIT** (gelap): malam `#101C28`, kartu `#16273B`, aksen `#FFD2A1`. Kontras teks terukur 4,7–14,8:1.
- Dua keluarga huruf self-host: **Bricolage Grotesque** (76,9 kB) untuk terang, **Instrument Sans** (30,1 kB) untuk gelap, `size-adjust` 101,7 % / 98,3 %; JetBrains Mono tetap untuk angka. Total 4 berkas font, preload dua font utama.
- Radius dua tangga (26/14 px vs 20/12 px) + fallback metrik; `check:contrast --strict` **78/78**.

### P7.2 — Bahasa Gayo dihapus ✅
- `messages.js` tinggal satu bahasa (Indonesia), pemilih bahasa, 88 kunci, dan seluruh uji/dokumen terkait dihapus; `check:i18n` memastikan tidak ada sisa placeholder/kunci.

### P7.3 — Komponen inti ✅
- `LevelBadge`+`LevelGlyph` (bentuk berbeda per tingkat, bukan warna saja), `StatusHeadline`, `AttentionCard`, `DetailPanel` (tab Ringkas·Angka·Saran dengan pola ARIA tablist), dipakai ulang oleh `HazardPanel` dan papan desktop. **45 uji kontrak**.

### P7.4 — Beranda mobile Ringkas ✅
- Beranda baru: kepala status suhu/keadaan, empat metrik, "Perlu perhatian" (maks 3 kartu + Detail), bilah 12 jam; target 44 px, tanpa gulir mendatar di 320 px; axe **0** di 320/390/430 dua arah.

### P7.5 — Papan kerja desktop v6 ✅
- Rel 264 px (terlipat 76 px), kanvas lima zona, inspector 380 px (menetap ≥1500, laci 1200–1499, dialog <1200), palet ⌘K 31 aksi, pintasan `D`/`F`/`[`/`1–5`. axe **0** di 1024–1920 dua arah; tanpa luapan; **26 uji**.

### P7.6 — PWA terpasang ✅
- Manifest `id=/niu/`, nama Niu, standalone portrait, warna `#F1E7D8`, ikon 192/512 + maskable, tiga pintasan (`/`, `/?zona=risiko`, `/?palet=1`), `offline.html` dua arah.
- Tawaran pasang Android lewat `beforeinstallprompt`, panduan "Tambah ke Layar Utama" untuk iOS Safari, tunda 7 hari, semua tombol ≥ 44 px. **23 uji**.

### P7.7 — Bahasa manusia ✅
- Seluruh string ditulis ulang: judul kartu menjadi pertanyaan ("Aman bernapas di luar?", "Ada api di dekat kebun?", "Perlu tambah air?"), tanpa akronim di lapisan pertama; angka teknis pindah ke balik **"Angka & istilah teknis"** dan panel *Tentang data & batasan*.
- Jam 24 memakai titik (00.00), desimal koma (19,1 °C), umur data berbunyi "baru saja"/"7 menit lalu"; emoji dihapus dari antarmuka. **9 uji bahasa**.

### P7.8 — Ikonografi ✅
- 11 ikon bahaya + 6 ikon cuaca, garis 24×24 `currentColor` (tanpa warna tetap, selalu dekoratif), dipakai di kartu perhatian dan daftar bahaya; favicon dan apple-touch-icon; judul dokumen & `theme-color` Niu. **6 uji**.

### P7.9 — Kinerja & pembersihan ✅
- Bundel **143,9 kB gzip** (batas 155) · terbesar 75,5 kB. Cakupan **96,22 / 84,91 / 96,42 %**. Total **507 uji**.
- axe **0** pada 32 kombinasi tab × lebar (320–1600) × dua arah dengan data contoh; tanpa luapan mendatar.
- Dua komponen lama tanpa pemakaian (`InstrumentPanel`, `DistrictSelector`) **sengaja tidak dihapus** — menunggu keputusan pemilik; tidak lagi dirujuk kode aktif.

## [Belum dirilis] — Fase design/frontend/UX (P1–P6 ✅ selesai)

### P1 — Token semantik & kontras (2026-10-16) ✅
- **Nol teks di bawah 4,5:1.** 417 utilitas teks beropasitas (`text-ink/45`, `dark:text-mist/40`, …) di **66 berkas** diganti token peran; pindai ulang menemukan **0** sisa. Sebelumnya 262 pemakaian gagal ambang WCAG AA di 21 berkas.
- **Token semantik baru di `src/index.css`** (29 token): permukaan (`surface-raised`, `surface-sunken`, `soil-raised`, `soil-sunken`), teks berjenjang (`ink-soft/body/muted/subtle` + padanan `mist-*`), garis (`line-strong/subtle` + varian gelap), aksen (`on-accent`), dan **ramp level bahaya** (`level-rendah/waspada/bahaya/ekstrem` + tint + varian gelap). Nilai & kontras terukur: `docs/reference/DESIGN-TOKENS.md`.
- **Ramp level dipakai lencana:** `HazardPanel`, `HazardFocusCards`, `DroughtCard`, `FireDangerCard`, `AirQualityCard`, `DisasterWarning` memakai token level, dan `HazardPanel` menampilkan **glyph bentuk berbeda per tingkat** (centang · segitiga · bel · segi-delapan) — makna tidak lagi bergantung warna (WCAG 1.4.1).
- **Warna di luar palet dihapus:** `ErrorBoundary` (dulu `slate-*`/`rose-*`) kini memakai palet tema + target 44 px + `role="alert"`; `SchematicMap` dan `HazardFocusCards` tidak lagi menyimpan heks mentah (memakai `var(--color-level-*)`).
- **Fokus keyboard tidak lagi dihapus:** `AppBar` (pemilih wilayah) melepas `focus-visible:outline-none` sehingga penanda fokus kembali terlihat.
- **Gerbang kontras jadi penjaga build:** CI menjalankan `npm run check:contrast -- --strict` — **34/34 pasangan token lulus** (teks 4,5:1 · non-teks 3:1) dan 0 utilitas teks beropasitas; regresi kontras kini **menggagalkan build**. Skrip juga mengabaikan komentar blok supaya contoh anti-pola di dokumentasi tidak dihitung.
- Uji: **340** (338 → +2: pemetaan pita opasitas & pengabaian komentar). Cakupan 95,70 / 84,06 / 95,89 %. Bundel 131,6 → **132,0 kB** gzip (tanpa dependensi baru).

### P2 — Aksesibilitas interaksi (2026-10-16) ✅
- **Target sentuh ≥ 44 px menyeluruh.** Pemindai tag `<button>` atas seluruh `src/` menemukan **0 tombol** di bawah 44 px (sebelumnya 12 dari 24); 4 kontrol yang masih 32–40 px dinaikkan (tutup dialog `AboutData`, tautan `tel:` `EmergencyContacts`, baris tanda di `ReportButton`, tombol anjuran `FireDangerCard`), tab bawah mobile jadi **56 px** + `env(safe-area-inset-bottom)`.
- **Semantik tab lengkap.** `BottomNav` memakai `role="tablist"/"tab"`, `aria-selected`, `aria-controls`, `id`, **roving tabindex**, dan navigasi keyboard panah kiri/kanan + Home/End; `MobileTabShell` memakai `role="tabpanel"` + `aria-labelledby` + `tabIndex=0` **tanpa** menghapus penanda fokus (WCAG 2.4.7).
- **Status diumumkan ke pembaca layar.** `aria-live="polite"` + `role="status"` baru untuk pembaruan data (jumlah bahaya aktif + level tertinggi + jam WIB), **skip-link** “Lewati ke konten utama” menuju `#main`, dan banner galat kini `role="alert"` dengan tombol **Coba lagi** (`min-h-11`).
- **Fokus & label.** `AppBar`/`DesktopHeader`: kontrol `h-11`/`min-h-11`, emoji tema ditandai `aria-hidden` (label tetap teks), dan tidak ada lagi `outline-none` di seluruh `src/`.
- **Skala tipografi dipasang sebagai token.** `@theme` kini mendefinisikan `--text-body` (16 px, teks isi & aksi), `--text-body-sm`/`--text-label` (14 px), `--text-caption` (12 px); teks aksi/kontrol P2 naik ke 16 px, metadata ke 12 px. 15 label antarmuka (navigasi, bantuan, berbagi, footer panel) berpindah dari teks keras ke i18n id+Gayo (temuan baru **A-10**; sisa teks keras di kartu dicatat untuk P3/P4).
- **Pengaman baru:** `tests/a11yContract.test.js` (**10 uji**) mengunci tablist/tabpanel, skip-link + `aria-live`, larangan `outline-none`, target seluruh tombol ≥ 44 px (pemindai tag sadar-kurawal), keberadaan token skala teks, dan ketersediaan label i18n baru di kedua bahasa.
- Gerbang paket: **350 uji lulus** · cakupan 95,78 / 84,20 / 95,94 % · `check:contrast --strict` hijau (34/34) · bundel **132,9 kB** gzip (batas 200) · `check:outlook` (27 hari) · `check:i18n` (67 placeholder) · `smoke` lolos · 35 dokumen / 117 tautan / 0 rusak.

### P3 — Tipografi, font, & pemuaian teks (2026-10-16) ✅
- **Tidak ada lagi teks di bawah 16 px untuk teks isi.** Seluruh **212 ukuran arbitrer** (`text-[10px]`…`text-[15px]`) dipetakan ke token skala: `text-caption` (12 px) untuk stempel waktu/satuan/catatan kaki, `text-body` (16 px) untuk teks isi, judul kartu, tombol, dan pesan. Sisa ukuran arbitrer hanya 2: pembacaan besar 56 px/68 px di `InstrumentPanel`.
- **Ukuran bawaan kecil disingkirkan:** 19× `text-sm` (14 px) → `text-body` (16 px) — seluruh judul kartu kini ≥ 16 px; tidak ada `text-xs`/`text-sm` tersisa di `src/`.
- **Tidak ada lagi pemotongan teks:** 12× `truncate` → `break-words`, sehingga label Gayo/Indonesia yang 20–35 % lebih panjang membungkus alih-alih hilang (uji pemuaian 320 px).
- **Font data benar-benar termuat:** `JetBrains Mono` variable (400–700) di-self-host di `public/fonts/` — subset **latin 30,7 kB + latin-ext 11,4 kB = 42,0 kB** (WOFF2), `font-display: swap`, **satu** `<link rel="preload">` untuk subset latin, plus **fallback metrik** (`size-adjust: 102%`, `ascent-override: 102%`, `descent-override: 30%`) agar baris tidak melompat saat font selesai dimuat. Sebelumnya font hanya *dideklarasikan* sehingga semua angka jatuh ke monospace sistem.
- **Angka rata kolom:** `tabular-nums` ditambahkan pada 28 kelas `font-data` yang belum memilikinya.
- **Gerbang baru `npm run check:typography`** (9 uji di `tests/checkTypography.test.js`, langkah CI setelah build): menolak ukuran arbitrer < 16 px, `text-xs`/`text-sm`, kelas kecil pada `select`/`input`/`textarea` (cegah zoom iOS), sisa `truncate`, serta memastikan berkas font ada di `public/fonts/` dan ikut terbangun ke `dist/fonts/`.
- **Uji 350 → 359** · cakupan 95,70 / 84,31 / 95,91 % · bundel JS tetap **132,9 kB** gzip (font berada di luar anggaran JS; precache PWA 14 → 16 entri, 492 → 536 KiB) · `check:contrast --strict` tetap 34/34 · `smoke` lolos · 35 dokumen / 117 tautan / 0 rusak.

### P4 — Keadaan memuat / kosong / basi / gagal (2026-10-16) ✅
- **Skeleton, bukan teks “Memuat…”:** komponen baru `Skeleton.jsx` (blok + kartu bertata tetap, `aria-hidden`) yang **baru muncul setelah 300 ms** — muat cepat tidak berkedip, muat lambat dapat kerangka yang menstabilkan tata letak (CLS). Denyut skeleton berhenti saat `prefers-reduced-motion`.
- **Keadaan kosong yang menjelaskan:** komponen baru `EmptyState.jsx` dipakai **10 kartu data** (`AirQualityCard`, `FireDangerCard`, `DroughtCard`, `DisasterWarning`, `DisasterHistoryCard`, `CoffeeAdvisory`, `ClimateBanner`, `SeasonalBanner`, `HourlyForecast`, `HazardPanel`) plus grafik hujan di `App`. Sebelumnya kartu kosong **hilang tanpa penjelasan** (`return null`); kini setiap keadaan memuat: apa yang kosong + langkah berikutnya.
- **Data basi punya tindakan:** pita `Notice.jsx` menampilkan “Data lama (offline) · Umur data …” + tombol **“Muat ulang sekarang”** (≥ 44 px) — bukan lagi sekadar lencana pasif di header.
- **Offline terpusat + kembali daring ditawarkan:** pita offline (beserta penanda “menampilkan data tersimpan”) kini hanya diumumkan **sekali** dari `App` (duplikat di `AppBar`/`DesktopHeader` dihapus); ketika koneksi kembali muncul pita “Koneksi kembali — muat ulang untuk data terbaru” yang bisa **ditutup tanpa memuat ulang** (tidak memaksa). `navigator.storage.persist()` diminta sekali agar cache offline tidak cepat dibuang sistem.
- **Aksi kirim punya umpan balik:** tombol **Kirim laporan** menampilkan spinner di dalam tombol (menghormati `prefers-reduced-motion`), tetap dinonaktifkan selama mengirim (anti kirim ganda), dan konfirmasi sukses diumumkan lewat `role="status"`.
- **Pengaman baru:** `tests/stateContract.test.js` (**9 uji**) mengunci keempat keadaan, larangan pengumuman offline ganda, dan ketersediaan label kedua bahasa.
- Uji **359 → 368** · `check:i18n` 67 → **76** placeholder Gayo `[?]` (9 label keadaan baru menunggu tinjauan penutur asli — tugas manusia H-4) · cakupan 95,74 / 84,35 / 95,93 % · bundel tetap di bawah anggaran · `check:contrast --strict`, `check:typography`, `smoke`, dan pemeriksa tautan docs semuanya hijau.

### P5 — Gerak, area aman & polish visual (2026-10-16) ✅
- **Gerak konsisten & token**: token easing `--ease-enter` / `--ease-exit` di `@theme` (tabel §5 `DESIGN-TOKENS`); `.anim-enter` kini memakai token; **tidak ada animasi > 300 ms** dan tidak ada `animate-pulse`/`animate-bounce` di seluruh `src/` (level bahaya dibaca dari warna + ikon + teks, bukan denyutan).
- **Umpan balik tekan merata**: `active:scale-[.97]` + `duration-100 ease-out` kini di **26 tempat / 15 berkas** (sebelumnya hanya `App`), termasuk Baris bahaya `HazardPanel`, chip riwayat bencana, item `LocationRail`, tombol kirim laporan, dan Pita keadaan P4.
- **Area aman**: `index.html` memakai **`viewport-fit=cover`** (tanpa ini `env(safe-area-inset-*)` selalu 0 — termasuk di emulator); `AppBar`/`DesktopHeader` mendapat `pt-[env(safe-area-inset-top)]`, `BottomNav` tetap `pb-[env(safe-area-inset-bottom)]`; `theme-color` diperbarui mengikuti **tema terpilih** (bukan hanya `prefers-color-scheme`) + `meta color-scheme`.
- **Pengaman baru**: `tests/motionContract.test.js` (**9 uji**) mengunci larangan denyut, batas 300/500 ms, token gerak, `reduced-motion`, kehadiran umpan balik tekan, `min-w-0`, dan area aman.
- Uji **368 → 377** · cakupan 95,75 / 84,41 / 95,97 % · bundel JS 134,6 kB gzip · `check:contrast --strict`, `check:typography`, `smoke` hijau.

### P6 — Pengaman & tata kelola (2026-10-16) ✅
- **ESLint hidup, 0 temuan.** `eslint.config.js` (flat config) + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks` sebagai devDependency (**0 dampak bundel**), skrip **`npm run lint`**, dan langkah CI baru. Saat pertama dipasang: **70 temuan**; kini **0** — dan yang diperbaiki bukan hanya gejala:
  - **Latar dialog jadi `<button>` sungguhan** (`AboutData`, `ReportButton`) — sebelumnya `<div onClick>` yang tak bisa dijangkau papan ketik/pembaca layar; kini `tabIndex={-1}` + `aria-label`, dengan Escape dan tombol “Tutup” tetap jalur utama.
  - **`role="tablist"` pindah** dari `<nav>` ke daftar tab (peran widget tidak boleh dipasang pada elemen non-interaktif).
  - **Hook React benar, bukan di-`disable`.** `loadData` memakai `useCallback([tr])`, efek memuat `[selectedLocation, loadData]`, dan `useMemo` umur data kehilangan dependensi berlebih `data` — komentar `eslint-disable` lama dihapus karena tidak lagi diperlukan.
  - **Konstanta Lanczos (`server/spi.js`) ditulis ulang** ke bentuk terpendek yang bulat-balik **identik** (nilai double tidak berubah) — bukan sekadar mematikan aturan.
  - 29 impor `React` yang tidak terpakai (runtime JSX otomatis) + belasan impor/variabel mati dibuang di `src/`, `server/`, dan `tests/`.
- **Kontrak P4/P5 diperbaiki ikut temuan lint**: pemindai tombol `a11yContract` kini membuang komentar lebih dulu (contoh `<button>` di JSX bukan tombol) dan mengecualikan tombol latar penuh `inset-0` (target = seluruh layar).
- **Jalur uji browser didokumentasikan** untuk dijalankan manusia: `docs/how-to/09-uji-browser-a11y.md` + `.pa11yci.json` (3 viewport) + contoh `axe-core/Playwright` **4 tab × 2 tema**, dengan kebijakan **ratchet** (ambang hanya turun) — sengaja **tidak** di CI karena runner tidak memasang browser.
- **Dokumen gerbang disinkronkan**: `SKRIP-NPM.md` (baris `lint` + angka i18n 76), `AGENTS.md` (aturan lint), `docs/README.md` (how-to 09), `docs/dev/10-ROADMAP-V3.md` (D-6 ✅), dan `docs/dev/11` (semua metrik §1 kini ✅).
- Uji tetap **377** · cakupan 95,75 / 84,41 / 95,97 % · bundel JS 134,6 kB gzip · seluruh gerbang + **lint** hijau.

### P6.1 — Perbaikan `npm ci` setelah paket sync-18 (2026-10-17) ✅
- **CI merah di langkah “Install dependencies”, bukan di kode.** Commit `6fae482` yang sudah diterapkan ke upstream membuat `npm ci` gagal `ERESOLVE`: `eslint-plugin-jsx-a11y@6.10.2` (rilis terakhir Okt 2024) hanya mengakui peer `eslint` `^3 … ^9`, sedangkan yang terpasang **ESLint 10.13.0**. Instalasi lokal lolos karena waktu itu dipasang dengan `--legacy-peer-deps`; CI memakai `npm ci` polos.
- **Perbaikan:** berkas baru **`.npmrc`** berisi `legacy-peer-deps=true` + alasan tertulis dan syarat pencabutannya; lockfile diregenerasi dari `package.json` dengan berkas itu aktif. Diverifikasi pada **instalasi bersih**: `npm ci` ✓ (446 paket), `npm run lint` **0 temuan**, sisanya seluruh gerbang hijau.
- **Mengapa bukan ESLint 9:** diuji langsung — `no-unused-vars` inti pada ESLint 9.39.5 **tidak menghitung pemakaian tag JSX** (66 temuan palsu “defined but never used” di `src/`), sedangkan ESLint 10 menghitungnya. Memundurkan ESLint berarti memasang `eslint-plugin-react` hanya demi `react/jsx-uses-vars` **dan** memakai versi ESLint yang sudah EOL (npm menandainya deprecated). `.npmrc` + ESLint 10 dinilai kompromi paling kecil: satu baris, terdokumentasi, dan dapat dicabut.
- **Pemicu pencabutan:** hapus `legacy-peer-deps=true` begitu `eslint-plugin-jsx-a11y` merilis versi yang mengakui peer ESLint 10 (pantau `npm view eslint-plugin-jsx-a11y peerDependencies`).
- Angka tidak berubah: **377 uji** · lint 0 temuan · cakupan 95,81 / 84,41 / 96,03 % · bundel JS **134,3 kB** gzip · precache 546,14 KiB · `check:outlook` sisa 26 hari.

### Tahap audit & rencana (commit `bfa8315`) — belum mengubah UI

Pembukaan fase penyempurnaan tampilan setelah v2.1.0 sinkron di upstream (`main` = `f9f8058`): audit, rencana, dan pengaman agar perbaikan berikutnya terukur. Komponen React belum disentuh pada tahap ini.

#### Dokumen rencana (audit 26 komponen + riset 12 klaster + log 50 putaran)
- **`docs/dev/11-RENCANA-DESIGN-UX.md`**: temuan A-1…A-9 (262 pemakaian teks < 4,5:1, tipografi 10–13 px, target sentuh, fokus, semantik tab, `aria-live`, motion, area aman, keadaan menunggu/basi), riset R-1…R-12 dengan implikasi, serta **paket kerja P1–P6** lengkap dengan berkas sasaran dan kriteria terima: P1 token & kontras · P2 aksesibilitas interaksi · P3 tipografi & font · P4 keadaan menunggu/kosong/basi/gagal · P5 gerak & area aman · P6 pengaman & tata kelola.
- **`docs/reference/DESIGN-TOKENS.md`**: spesifikasi token siap-terap — 8 token teks (4 terang/4 gelap) yang lulus 4,5:1 **di tiga permukaan**, ramp level bahaya + tint + garis aksen, 5 seri grafik untuk dua tema, skala tipografi `caption/label/body-sm/body`, tabel durasi motion, aturan target sentuh/fokus/area aman, serta tabel pemetaan 12 opasitas lama → token baru.
- Angka kontras dihitung dengan rumus WCAG 2.2 dan **disimulasikan terhadap buta warna (protanopia/deuteranopia)**; tiga pasangan seri grafik berjarak ΔE < 15 sehingga wajib dibedakan pola/penanda/label, bukan warna saja.

#### Gerbang kontras otomatis (tanpa browser)
- **`scripts/check-contrast.mjs`** (`npm run check:contrast`): membaca token `@theme` dari `src/index.css`, menilai 23 pasangan peran terhadap ambang WCAG 2.2 AA (teks 4,5:1 · non-teks 3:1), memindai utilitas teks beropasitas di `src/` (kini **262 temuan di 21 berkas**), dan menghitung pemakaian teks < 16 px. Opsi `--strict`, `--json`, `--all`, `--css`, `--dir`.
- **11 uji baru** (`tests/checkContrast.test.js`) → suite **338 uji**; cakupan 95,68 / 84,05 / 95,88 % (ambang 95/80/92).
- CI: langkah *Gerbang kontras desain* ditambahkan dalam mode **informatif** (setara `check:i18n`) agar build tetap hijau sampai P1–P4 diterapkan; setelahnya diubah menjadi `--strict`.
- Dokumen diperbarui: `docs/README.md`, `docs/dev/README.md`, `docs/reference/SKRIP-NPM.md`, `AGENTS.md`.

## [2.1.0] — 2026-10-16 · Migrasi toolchain mayor (A-1, menutup advisori `braces`) + gerbang cakupan uji (A-2)

Hasil akhir butir **A-1** pada `docs/dev/10-ROADMAP-V3.md`: seluruh lompatan mayor yang ditunda saat audit 2.0.1 dikerjakan sekaligus, dan `npm audit` kini **0 kerentanan** (sebelumnya 5 high dev-only).

### Tailwind CSS 3.4.19 → 4.3.3
- Konfigurasi **CSS-first**: `src/index.css` kini memakai `@import "tailwindcss"` + blok `@theme` (palet Gayo `soil/mist/leaf/cherry/husk/rain`, `font-data`, `max-w-shell`, `rounded-card`) dan `@custom-variant dark (&:where(.dark, .dark *))` untuk dark mode berbasis kelas.
- `tailwind.config.js` dan `postcss.config.js` **dihapus**; plugin baru `@tailwindcss/vite`; `autoprefixer` & `postcss` dilepas (v4 menangani vendor prefix lewat Lightning CSS).
- **Rantai `chokidar → braces` + `postcss-nested → postcss-selector-parser` hilang total** → CVE-2026-93687 (yang belum punya patch di hulu, lihat SECURITY.md 2.0.1) tidak lagi relevan. `npm audit --omit=dev` tetap 0.
- Penyesuaian kecil: `rounded-sm` → `rounded-xs` di 2 komponen peta/grafik agar radius tetap 0,125 rem sesuai skala v3 (v4 menggeser arti `-sm`).
- Verifikasi khusus: 301 token kelas dari `src/` diuji satu per satu terhadap CSS keluaran — **0 utility hilang**; `.bg-soil`, `.text-ink`, `.rounded-card`, `.bg-husk/50`, `.divide-ink/10`, dan varian `dark:` semuanya ter-generate.

### Vite 6.4.4 → 8.3.4 (Rolldown)
- Bundler produksi berganti Rollup → **Rolldown (Rust)**; build 3,6 s → **0,42 s**.
- API `manualChunks` (objek) tidak lagi didukung → diganti `advancedChunks.groups` (pemisahan `vendor-react` & `vendor-icons` tetap).
- `@vitejs/plugin-react` 4.7 → **6.1.2** (Oxc, tanpa Babel — proyek tidak memakai plugin Babel sehingga transparan).
- `engines.node` dinaikkan `>=20.19.0` (syarat Vite 8); CI tetap Node 22.
- `vite-plugin-pwa` 2.0.0 sudah mendukung Vite 8 (tanpa perubahan konfigurasi PWA).

### lucide-react 0.546 → 1.58
- Seluruh ikon yang dipakai (`AlertTriangle`, `CloudRain`, `CloudSun`, `MapPin`, `RefreshCw`) masih tersedia di v1; tidak ada ikon merek (yang dihapus di v1) di proyek.

### Hasil ukur (sebelum → sesudah)
- JS total gzip **133,3 → 131,6 kB**; chunk terbesar **127,4 → 65,8 kB** (anggaran 200/150 tetap lolos dengan margin besar).
- CSS gzip 5,66 → 8,09 kB (konsekuensi wajar v4: `@property`/`color-mix`; total halaman tetap jauh di bawah anggaran 3G).
- 321 uji hijau (306 saat migrasi A-1 + 15 uji gerbang cakupan A-2) · smoke lolos (16 endpoint + 3 penjaga) · render klien terverifikasi (SSR-smoke 5,6 kB HTML, ikon menjadi SVG) · cakupan 96,42 % baris / 83,78 % cabang / 95,96 % fungsi.

### Ambang cakupan uji (roadmap A-2 — audit F-10)
- Skrip baru `scripts/check-coverage.mjs` (`npm run check:coverage`): menjalankan suite dengan cakupan bawaan Node, lalu **menggagalkan build** bila baris < 95 %, cabang < 80 %, atau fungsi < 92 % (ambang 1,5–4 poin di bawah baseline agar refactor kecil tidak rapuh). Hanya memakai flag Node ≥ 20 sehingga tetap sesuai lantai `engines`.
- **Baseline tren terversi** `scripts/coverage-baseline.json` (baris 96,42 % · cabang 83,78 % · fungsi 95,96 %) — setiap jalannya skrip mencetak selisih terhadap baseline; perbarui dengan `--update-baseline`.
- Opsi `--from <berkas>` menilai laporan cakupan tersimpan (mis. artefak CI) tanpa menjalankan ulang suite; salah pakai argumen keluar 2 (bukan 1) agar tidak tertukar dengan kegagalan cakupan.
- 15 uji baru di `tests/checkCoverage.test.js` (pengurai tabel, penilaian ambang, tren, CLI, dan pelarian env `NODE_TEST_CONTEXT` yang membuat proses anak tidak mencetak tabel). CI: langkah `Test coverage report` (informatif) → **`Test coverage gate`**.

### Struktur dokumentasi Diátaxis (roadmap A-5 — catatan audit F-15)
- `docs/` kini diorganisasi menurut **kebutuhan pembaca**: `tutorials/` (belajar), `how-to/` (tugas), `reference/` (tabel), `explanation/` (alasan) — dengan peta & perutean di `docs/README.md`.
- Berkas dipindah: `docs/THRESHOLDS.md` → **`docs/reference/THRESHOLDS.md`**; `docs/VALIDATION.md` → **`docs/reference/VALIDATION.md`** (tabel riwayat tautan ada di `docs/README.md`; seluruh rujukan di repo — termasuk komentar kode dan teks UI “Tentang data” — sudah diperbarui).
- Berkas baru: tutorial menjalankan lokal; 8 panduan how-to (deploy produksi, peringatan Telegram, perawatan outlook musiman, perubahan ambang, penambahan sumber data, pengumpulan data validasi, peninjauan label Gayo); 3 referensi baru (endpoint API, variabel `.env`, perintah npm & gerbang); peta kuadran explanation. `docs/dev/` sengaja dibiarkan sebagai arsip riset bernomor.
- `AGENTS.md` menetapkan aturan penempatan agar kuadran tidak tercampur pada perubahan berikutnya.

### Hotspot NASA FIRMS aktif (tugas manusia H-1 selesai)
- Kunci FIRMS diterima & diverifikasi langsung terhadap API pada 16 Okt 2026: `/healthz` `features.firmsKey: true`, `/api/hotspots?location=takengon` → `degraded:false`, `sources.hotspots.state: ok`. Kartu “Bahaya Kebakaran” tidak lagi menampilkan catatan “kunci belum diatur”.
- **Temuan uji langsung → perbaikan kode:** API FIRMS Area hanya menerima rentang hari **1–5** (`Invalid day range. Expects [1..5]`, HTTP 400). Sebelumnya `.env.example` & dokumen menyebut 1–10, dan nilai di luar rentang akan menggagalkan **semua** sumber sehingga hotspot jatuh *degraded* tanpa sebab yang jelas. Kini `clampFirmsDays()` (`server/firms.js`) menjepit di satu tempat — nilai mustahil → default 2, sebagai ganti kegagalan senyap.
- **Fixture nyata** (bukan sintetis) ditambahkan dan dipakai uji: `firms-viirs-snpp-gayo-2d.csv` (header saja — keadaan nyata “nol hotspot” di bbox Gayo) dan `firms-viirs-aceh-5d-REAL.csv` (2 deteksi VIIRS nyata di Aceh Utara, di luar radius 50 km). +6 uji (321 → **327**).
- Dokumentasi: **`docs/how-to/08-aktifkan-hotspot-firms.md`** (pemasangan kunci, verifikasi 3 tingkat, batas 1–5 hari & kuota, arti “nol hotspot”, penyegaran fixture, troubleshooting); `.env.example`, `reference/KONFIGURASI-ENV.md`, `reference/ENDPOINT-API.md`, `dev/04-DATA-SOURCES.md`, `dev/09-DATA-PREP.md` dikoreksi.

### Catatan penting
- **Kompatibilitas browser:** Tailwind v4 menargetkan Safari 16.4+ / Chrome 111+ / Firefox 128+ (Maret 2023+). Untuk perangkat kebun yang lebih lama, rilis **v2.0.1** tetap tersedia sebagai tag.
- **Pemasangan dari lockfile lama:** npm 10.8.2 sempat gagal (`Cannot read properties of null (reading 'edgesOut')`) saat resolusi pertama; cukup sekali `npm install --legacy-peer-deps` — setelah `package-lock.json` baru terbentuk, `npm ci` berjalan normal (terverifikasi).


## [2.0.1] — 2026-10-16 · Pengerasan pasca-audit (18 temuan, tanpa perubahan perilaku fitur)

Audit menyeluruh terhadap upstream `fa33bfb` (10 iterasi riset: OpenSSF Scorecard, OWASP API Security Top 10, OASIS CAP 1.2, advisory Vite/esbuild 2025–2026, probing langsung 8 sumber data). Rilis ini menutup seluruh temuan yang dapat diselesaikan di kode; dua temuan bersifat tugas manusia (tag bertanda tangan, terjemahan Gayo) dan satu advisory dev-only belum punya patch hulu.

### Keamanan & rantai pasok
- **F-13** Semua respons API kini memakai header keamanan dasar: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer` (JSON dan CAP XML).
- **F-12** Perbandingan token cron `x-cron-token` memakai `crypto.timingSafeEqual` (constant-time).
- **F-02** CI: action dipin ke SHA commit (`actions/checkout@11bd7190…` v4.2.2, `actions/setup-node@49933ea5…` v4.4.0) + `permissions: contents: read`.
- **F-01** Gerbang `npm audit --omit=dev --audit-level=high` di CI (pohon produksi 0 kerentanan); override `postcss-selector-parser@^7.1.6` menutup GHSA-rj75-hqrm-r3gf. Sisa advisori `braces` (CVE-2026-93687, dev-only, belum ada patch hulu) didokumentasikan di `SECURITY.md`.
- **F-03** `SECURITY.md` baru (kebijakan pelaporan + status advisori dev-only). **F-04** Dependabot mingguan (`.github/dependabot.yml`, mayor di-ignore untuk evaluasi manual).

### Keandalan & operasional
- **F-14** `climateOutlook.json`: divalidasi silang NOAA CPC 8 Okt 2026 (El Niño kuat–sangat kuat, Niño-3.4 +2,1 °C); `validUntil` → `2026-11-12` (tanggal rilis otoritatif berikutnya); skrip **`npm run check:outlook`** + gerbang CI (gagal bila kedaluwarsa).
- **F-17** Unit systemd: `NoNewPrivileges`, `PrivateTmp`, `ProtectSystem=strict`, proteksi kernel/cgroup, `RestrictSUIDSGID`, `ReadWritePaths=…/server/data`, `EnvironmentFile=-…/.env`.
- **F-18** `MAGMA_STALE_DAYS` kini benar-benar dibaca (fallback hasil tersimpan hanya bila ≤ N hari); `HAZARD_ARCHIVE_DIR` kini dipakai; `.env.example` diselaraskan dengan kode (gaya aman `EnvironmentFile`, variabel v3 ditandai "belum dibaca").
- **F-08** `server/firms.js`: seluruh pemrosesan dibungkus — tidak pernah melempar ke pemanggil.
- **F-11** Code-splitting vendor (`vendor-react`, `vendor-icons`): chunk utama 135,3 → 130,7 kB gzip; total 133,3 kB (anggaran 200/150 tetap lolos).

### Struktur & keterlacakan
- **F-09** Routing dipisah ke `server/routes.js` (handler memakai konteks `ctx` eksplisit); `server/index.js` 405 → 163 baris.
- **F-10** `npm run test:coverage` + langkah CI (cakupan dilaporkan; ambang menyusul). Suite kini **306 uji** (20 uji baru: `check-outlook`, `check-i18n`, lapisan `routes`, `MAGMA_STALE_DAYS`, `HAZARD_ARCHIVE_DIR`); cakupan terukur 96,6% baris.
- **F-16** `npm run check:i18n` — inventaris 52 placeholder label Gayo (tugas manusia H-4; jalankan `--strict` setelah selesai).
- **F-15** `/api/cache/flush` didokumentasikan di README.
- **F-05** `engines.node >= 20`. **F-06** tag rilis bertanda tangan: tugas manusia (butuh kunci GPG). **F-07** hutang mayor (Tailwind 4, Vite 8, plugin-react 6, lucide 1.x) dijadwalkan v2.1; Dependabot sengaja mengabaikan lompatan mayor.


## [2.0.0] — 2026-10-15 · Sprint 4 "Multi-bahaya lengkap" (Fase 2: 2.1–2.5 · Fase 3: 3.1, 3.2, 3.4 · Fase 1: 1.10b · Fase 4: 4.2, 4.4, 4.5)

Rilis v2.0.0 menutup seluruh butir roadmap `docs/dev/03-ROADMAP.md` yang tidak memerlukan masukan manusia. Registry kini **11 bahaya** (`longsor, banjir, angin, badai, asap, kebakaran, kekeringan, gempa, vulkanik, suhu, karat`) + interaksi lintas-bahaya. Tag git `v2.0.0` dan aktivasi cron/kunci tetap tugas manusia (H-1, H-6, H-7, H-9).

### Fitur — geologi (Fase 2.1, 2.2, 2.2b, 2.2c)
- **H-GEMPA** `GET /api/quakes[?location=]` (`server/bmkgQuake.js`): tiga feed BMKG TEWS (`gempadirasakan`, `autogempa`, `gempaterkini`), saringan radius 300 km dari Takengon / menyebut Aceh, cache 2 menit (`QUAKE_TTL_MIN`), kegagalan per sumber tidak menjatuhkan hasil; modul `gempa` (`src/domain/hazards/quake.js`): jarak hiposentral per sentra, **MMI indikatif** IPE Allen dkk. 2012, level `waspada` MMI ≥ 3 / `bahaya` ≥ 5 / `ekstrem` ≥ 7 selama 24 jam (72 jam maks. waspada), penanda **gempa pemicu longsor** (M ≥ 5 ≤ 100 km), tautan shakemap BMKG. Riwayat 10 tahun USGS (82 kejadian M ≥ 4,5 ≤ 150 km, `src/data/hazards/quakeHistory.json`) hanya untuk konteks — tanpa prediksi (ADR-17). `docs/reference/THRESHOLDS.md` §15.
- **H-VULKANIK** `GET /api/volcano` (`server/magma.js`): parser halaman tingkat aktivitas MAGMA Indonesia (Level I–IV) untuk **Burni Telong** + nilai terakhir tersimpan (`server/data/volcano-last.json`) + `VOLCANO_LEVEL_OVERRIDE`; arah angin puncak (Open-Meteo) → daftar sentra **di bawah angin** (± 30°); modul `vulkanik`: Level II → `waspada` (dekat ≤ 30 km) … Level IV → `ekstrem`, radius rekomendasi 3/5/7 km, anjuran abu (masker, atap, air, kopi). §16.
- **Diseminasi geologi**: `gempa`/`vulkanik` di `PUSH_POLICY`/`DEFAULT_EXPIRES`/CAP category; `eventId` baru (`bmkg-<ISO>`, `magma-level-N`) → **Alert segera** melewati jeda 6 jam; `POST /api/alerts/run?only=gempa,vulkanik`, `scripts/alerts-cron.mjs --only`, unit systemd `server/agroclimate-alerts-fast.{service,timer}` (tiap 5 menit).
- Laporan warga tipe baru `abu` (tipis | tebal), `gas` (ringan | menyengat), `gempa` (lemah | sedang | kuat) — validasi server + isian `ReportButton.jsx`.

### Fitur — hidromet & atmosfer (Fase 2.3, 2.4, 2.4b, 2.5)
- **H-PETIR / badai** `GET /api/convective?location=` (`server/convective.js`, TTL 30 menit): ECMWF IFS 0,25° (CAPE, kode cuaca 95–99, hembusan, hujan) × GFS (CAPE, Lifted Index, CIN) 12 jam ke depan; modul `badai`: CAPE 1000/2000, LI −3/−6, hembusan ≥ 45 km/jam (puting beliung), hujan ≥ 20 mm/jam, **potensi hujan es** (CAPE ≥ 2500 & LI ≤ −6 atau kode 96/99), `agreement` ECMWF↔GFS, nowcast BMKG aktif → minimal `bahaya`; aturan 30-30. §17.
- **H-BANJIR+ / Indeks Luapan v2** `GET /api/flood` (`server/flood.js`, TTL 6 jam): debit **GloFAS** (Open-Meteo Flood API) 4 sel DAS Peusangan (outlet Lut Tawar, Takengon, Bintang, Angkup) vs klimatologi DOY ± 15 hari 1997–2025 (`server/clim/flood-clim.json`, `npm run clim:flood`); `watershed.js` v2 = maks(indeks hujan hulu, anomali debit 2×/3×/5× median atau > p95) + pengubah ARI72 ≥ 100 mm; sentra di luar DAS tetap `n/a`. §18.
- **Laporan eksternal** `GET /api/external-reports` (`server/petabencana.js`, TTL 10 menit): laporan warga PetaBencana.id (Aceh) disaring Gayo (kode 1104/1117/1113 atau ≤ 60 km), konteks saja — bukan masukan skor (ADR-20), atribusi CC BY-NC 4.0.
- **Interaksi lintas-bahaya** (`src/domain/hazards/interactions.js`, FR-X-2): `gempa_tanah_jenuh` (longsor +1 ≤ bahaya), `kekeringan_ffmc` (kebakaran +1 ≤ waspada), `badai_longsor`, `vulkanik_hujan_lahar`, `asap_hujan_lebat`; `evaluateAll` → `interactions[]`, hasil yang dinaikkan membawa `flags.baseLevel/bumpedBy`. §19.
- **UI**: `HazardFocusCards.jsx` (StormCard strip 12 jam, FloodCard grafik SVG debit vs median/p95, QuakeCard, VolcanoCard, ExternalReportsCard) + daftar interaksi di `HazardPanel`; peta skematik mewarnai 11 bahaya.

### Fitur — agro-klimat (Fase 3.1, 3.2, 3.4)
- **SPI-1/3** (`server/spi.js`): gamma McKee/Thom 1958 dengan koreksi nol, baseline ERA5 **1991–2020** per sentra (`server/clim/spi-baseline.json`, `npm run clim:spi`); `/api/drought` → `spi`; modul `kekeringan` menaikkan level bila SPI ≤ −1 / −1,5 / −2. **VPD siang** 09–15 WIB rata-rata 7 hari (Tetens) → `vpd7` (> 0,82 kPa waspada bunga, > 1,5 bahaya). §20.
- **H-SUHU** modul `suhu` (`temperature.js`, `features.thermalSummary`): **dingin/embun upas** Tmin 10/6/4 °C dengan syarat awan < 30 %, angin ≤ 5 km/jam, Td ≤ 2 °C, koreksi −1 °C untuk sentra ≥ 1.400 m; **panas/aborsi bunga** Tmax 28/30/32 °C (+1 tingkat saat bulan berbunga [1–4, 8–9] & VPD > 0,82). Open-Meteo klien/server menambah `cloud_cover, dew_point_2m, vapour_pressure_deficit`. §21.
- **Kalender musiman diperluas** (`seasonal.js`: `dryPhase`, `frostWindow`, `climateAdjustment` ENSO/IOD dari `climateOutlook.json`, `seasonalInfoExtended`) → `/api/seasonal` + `SeasonalBanner.jsx`.

### Validasi, operasi & CI (Fase 1.10b, 4.2, 4.4, 4.5)
- `scripts/validate-season.mjs` (`npm run validate:season -- --days 120 --min waspada --events <json> --out <json>`): POD / FAR / rasio aktif per bahaya dari arsip harian × laporan warga × kejadian terkurasi; protokol di **`docs/reference/VALIDATION.md`**, format kejadian `docs/validation/events-template.json`, draf surat **`docs/templates/surat-pengantar-BPBD.md`** (H-8).
- `scripts/smoke.mjs` (`npm run smoke`): menjalankan server pada port acak, memeriksa 15 endpoint + `POST /api/alerts/run?dryRun=1` (gagal pada 5xx/non-JSON; upstream degraded ditoleransi). `.github/workflows/ci.yml`: `npm ci → test → build → check:bundle → smoke`.
- `/healthz` menambah status `quakes`, `volcano`, `flood`, `petabencana`; `.env.example` + `CONVECTIVE_TTL_MIN`, `QUAKE_TTL_MIN`, `VOLCANO_TTL_MIN`, `PETABENCANA_TTL_MIN`, `HAZARDS_ENABLED` (11 id).
- Dokumentasi: `docs/reference/THRESHOLDS.md` §15–21, `docs/dev/03-ROADMAP.md` (status), `05-ARCHITECTURE.md` §5 (realisasi vs rencana), `06-THRESHOLDS-MULTI-HAZARD.md` §11, **`docs/dev/10-ROADMAP-V3.md`** (arah 2027–28: kalibrasi lokal, Web Push/VAPID, sensor PM2,5, AWLR, Leaflet lazy-load, API publik, Gayo).

### Test & kinerja
- +49 test (`quake`, `volcano`, `convective`, `flood`, `interactions`, `temperature`, `validate-season`, tambahan `seasonal`, `reports`, kontrak registry) → total **285** lulus; `npm run build` OK; `check:bundle` ✓ (JS utama ≈ 132 kB gzip, batas 150).

### Ditunda (lihat `10-ROADMAP-V3.md`)
- 2.6 Web Push (butuh VAPID key — H-9); ADR-24 tahap 2 Leaflet lazy-load; 4.1 kalibrasi lokal (butuh ≥ 1 musim arsip + kejadian BPBD); 4.3 sensor PM2,5.

## v2.0-dev Sprint 3 (Fase 0: 0.2–0.5 · Fase 1: 1.6b, 1.8, 1.8b, 1.9c, 1.9d, FR-X-4/5/8/9)

### Fitur
- **Hazard registry (ADR-12/16)** `src/domain/hazards/{index,levels,features,landslide,watershed,wind,rust,airQuality,fireWeather,drought}.js`: 7 modul murni (`longsor, banjir, angin, karat, asap, kebakaran, kekeringan`) dengan kontrak seragam `{id,label{id,gayo},group,level,score,headline,detail,metrics[],advice{umum,rentan,kebun,sekolah},sources[],flags,degraded,validUntil,evaluatedAt}`; `evaluateAll(ctx)` → `{results[] terurut level, worst, active[], counts}`; skala level seragam `n/a < rendah < waspada < bahaya < ekstrem` (docs/reference/THRESHOLDS.md §13). Logika kartu lama tidak diubah — registry memakai fungsi domain yang sama.
- **`HazardPanel.jsx`** (menggantikan tempat `DisasterWarning` sebagai panel utama; ringkasan lama tetap): daftar hazard terurut level, kelompok hidromet/atmosfer-kebakaran/agro, akordeon detail + metrik + anjuran 4 kelompok + sumber & waktu, tombol **Bagikan** (`ShareButton.jsx`: WhatsApp / SMS ≤ 160 karakter / salin — `src/domain/share.js`, selalu dengan disclaimer & nomor darurat) dan **Tentang data & batasan**. Feature flag: server `HAZARDS_ENABLED` (`'*'` atau daftar id), klien `VITE_HAZARDS_ENABLED` + `localStorage nga.hiddenHazards` (`src/lib/prefs.js`).
- **Diseminasi (ADR-22)** `src/domain/alert.js`: objek `Alert` CAP 1.2 per hazard × sentra (identifier, msgType Alert/Update/Cancel, severity Moderate/Severe/Extreme, urgency, certainty Observed/Likely/Possible, expires, area lingkaran 5 km, `official[]` = peringatan BMKG aktif), renderer **Telegram / WhatsApp-teks / SMS / CAP XML**, anti-kebisingan (`PUSH_POLICY` per hazard, jeda 6 jam kecuali naik level, `Cancel` saat turun, penggabungan ≥ 3 sentra, maks 12 pesan/siklus — docs/reference/THRESHOLDS.md §14).
- **Arsip harian hazard (1.10b, ADR-26)**: setiap evaluasi `/api/hazards?location=all` menulis snapshot level per sentra (maks. 1 per jam) ke `server/data/hazard-archive/YYYY-MM-DD.json` (gitignored) — bahan validasi musiman & KPI; `readArchive({ days })` untuk skrip Sprint 4.
- **Server** `server/hazards.js` + `server/alerts.js`: `GET /api/hazards?location=<id>|all` (ctx 15 sentra dari cuaca, AQ, FWI, arsip, laporan; TTL `HAZARDS_TTL_MIN`), `GET /api/alerts/feed[?format=cap&id=]`, `POST /api/alerts/run[?dryRun=1]` (header `x-cron-token` = `ALERTS_CRON_TOKEN`; state `server/data/alert-state.json`; kirim Telegram `TELEGRAM_*`), `GET /healthz` (versi, fitur, status per sumber cache: umur, degraded). Cron: `scripts/alerts-cron.mjs` + unit systemd `server/agroclimate-alerts.{service,timer}` (tiap 30 menit).
- **Banner konteks iklim** `ClimateBanner.jsx` (`src/domain/climate.js`): El Niño/IOD/status musim dari `climateOutlook.json` + verifikasi lokal dari `/api/drought` (basah/sedang/kering); peringatan "perlu pembaruan" setelah `validUntil`.
- **Riwayat kejadian** `src/data/disasterHistory.json` digabung dengan tambahan 2013–2026 (12 kejadian, skema `hazard`, `emergencyStatus`, `sources[]`); `GET /api/disaster-history?location=<id>&hazard=<id>` → `{count, hazard, byHazard, lastEvents}`; kartu `DisasterHistoryCard.jsx`.
- **Kontak darurat** `src/data/contacts.js` (`contactsFor(hazard, kecamatan)`; hanya nomor terverifikasi: 112, BPBD Aceh Tengah (0643) 21113, Damkar 113, Halo Kemenkes 1500567; nomor kecamatan menunggu verifikasi H-5) + kartu `EmergencyContacts.jsx` (tautan `tel:`).
- **"Tentang data & batasan"** `AboutData.jsx` (modal dari HazardPanel & footer): 8 sumber + lisensi (Open-Meteo CC BY 4.0, CAMS/ERA5 Copernicus, FIRMS, BMKG, FWI/cffdrs, BNPB/BPBD, GADM non-komersial), estimasi vs pengukuran, arti level, batasan, privasi (tanpa PII; IP hanya untuk rate-limit laporan), kontak koreksi.
- **Laporan warga** tipe baru `kekeringan` (tanda: sumur kering / daun layu / sungai surut) dan `badai` (jenis: petir / hujan es / puting beliung) — validasi `server/reports.js`, isian `ReportButton.jsx`.
- **Peta skematik** `SchematicMap.jsx` (`src/domain/geo.js`, ADR-24 tahap 1): batas 22 kecamatan Aceh Tengah + Bener Meriah (GADM, 21 kB), 15 sentra berwarna level tertinggi (`weatherService.hazardsAll` ← `/api/hazards?location=all`), hotspot FIRMS ≤ 25 km, segitiga + radius 3 km Burni Telong (PVMBG Level II), label anti-tumpang-tindih, klik → pilih sentra. Mobile: tab Lokasi; desktop: baris bawah.
- **Angin**: `WIND_GUST.ekstrem = 75 km/jam` (≈ Beaufort 9) untuk skala seragam; `WIND_GUST.bmkgEkstrem = 45` → penanda `flags.bmkgExtreme` (docs/reference/THRESHOLDS.md §4).
- Alat: `npm run check:bundle` (`scripts/check-bundle.mjs`, gagal bila JS utama > 150 kB gzip; saat ini ≈ 114 kB); `.env.example` + `HAZARDS_ENABLED`, `HAZARDS_TTL_MIN`, `ALERTS_CRON_TOKEN`, `PUBLIC_URL`, `API_BASE`, `VITE_HAZARDS_ENABLED`.

### Test
- +38 test (`tests/hazards.contract.test.js`, `share.test.js`, `alert.test.js`, `climate.test.js`, `geo.test.js`, tambahan di `reports.test.js`, `seasonal.test.js`) → total **236** lulus; `npm run build` OK.

### Utang teknis / catatan (dibawa ke Sprint 4)
- Modul `longsor`: jendela "48 jam terakhir" masih sebagian prakiraan (klien tanpa `past_days`; `rain72 == rain24` pada ctx klien) — sama dengan perilaku kartu lama; perbaikan = ctx dari arsip (1.10b).
- `fetchAllAlerts` memakai `precip.slice(-24)` (= D+2) untuk ringkasan lama; `/api/alerts/run` memakai registry, bukan jalur ini.
- `hazardsAll` di klien best-effort (peta tetap tampil abu-abu bila gagal); `climateOutlook.json` wajib diperbarui manual (`validUntil` 2026-11-30); nomor kontak kecamatan `null` sampai H-5; koordinat sentra Rusip Antara di luar poligon kecamatannya (H-2).
- Tag `v1.2.0` (H-6) dan `FIRMS_MAP_KEY` (H-1) masih menunggu; aktivasi cron produksi (H-7): isi `TELEGRAM_BOT_TOKEN`, `TELEGRAM_HOME_CHANNEL`, `ALERTS_CRON_TOKEN`, lalu `systemctl --user enable --now agroclimate-alerts.timer`.

## v2.0-dev Sprint 2 (Fase 1: 1.4, 1.5, 1.6, 1.7, 1.9, 1.9b)

### Fitur
- **Arsip cuaca 90 hari** `server/archive.js`: Open-Meteo Archive (ERA5) harian + jam-an per sentra, 92 hari s.d. kemarin WIB, celah ≤ 7 hari diisi prakiraan ECMWF `past_days=7&forecast_days=3`, deret gabungan diberi `source[]` = `archive | model | forecast`; TTL 12 jam (`ARCHIVE_TTL_MIN`), salinan file `server/data/archive-<id>.json` sebagai cadangan saat upstream gagal; degraded bila lag arsip > 7 hari.
- **H-API** `GET /api/fire-danger?location=<id>|all` (`server/fireWeather.js`): FWI operasional — pengamatan 12.00 WIB, hujan 24 jam hingga jam pengamatan, spin-up 90 hari, hari ini dihitung bila sudah ≥ 12.00 WIB, riwayat 7 hari, proyeksi D+1–D+2 dari ECMWF, titik awal cadangan `server/data/fwi-state.json`; penilaian gabungan FWI × hotspot × HTH (`assessFireDanger`: level, kelas tampilan dengan gerbang FFMC ekstrem, **Siaga Kebakaran Lokal** = FFMC ≥ 78 & hotspot ≤ 25 km, ekstrem = FWI > 13 & hotspot ≤ 25 km), kelas Drought Code BMKG (`FWI.dc` 140/260/350).
- **Hotspot FIRMS** `GET /api/hotspots?location=<id>` (`server/firms.js`, `src/domain/hazards/hotspots.js`): 4 sumber NRT (VIIRS S-NPP/NOAA-20/NOAA-21, MODIS), bbox Aceh Tengah–Bener Meriah, 2 hari, TTL 30 menit; parser CSV, saringan keyakinan (VIIRS n/h, MODIS ≥ 50), jendela 24/48 jam, haversine ke 15 sentra (≤ 10/25/50 km), FRP intens ≥ 20 MW, level per sentra; **degraded tanpa `FIRMS_MAP_KEY`** (kartu tetap tampil dengan catatan) dan bila FIRMS membalas "Invalid MAP_KEY"/kuota.
- **H-KERING** `GET /api/drought?location=<id>|all` (`src/domain/hazards/drought.js`): Hari Tanpa Hujan berturut-turut (kelas BMKG HH/1–5/6–10/11–20/21–30/31–60/> 60, mundur dari hari terakhir berdata), proyeksi HTH hari ini…D+2 dari prakiraan, neraca air 30 hari Σ(P − ET0), deret 30 hari untuk grafik, anjuran kopi.
- Kartu **"Bahaya Kebakaran"** (`FireDangerCard.jsx`): FWI + kelas FDRS, status, peringatan Siaga Kebakaran Lokal, kode FFMC/DC/ISI, baris pengamatan siang, blok hotspot 24/48 jam per radius + titik terdekat/FRP (atau catatan degraded), HTH, proyeksi D+1–D+2, anjuran (tampilkan lebih), tautan BMKG DC & SiPongi. Kartu **"Kekeringan"** (`DroughtCard.jsx`): HTH + kelas, grafik batang hujan 30 hari, hujan terakhir & proyeksi, metrik hujan/ET0/neraca, anjuran, tautan BMKG Iklim. Mobile: tab Risiko; desktop: kolom kanan (kebakaran) & kolom tengah (kekeringan).
- **Laporan warga** tipe `asap` (skala jarak pandang `>5km | 1-5km | <1km` wajib + centang "bau asap") dan `kebakaran` (centang "api masih menyala", pengingat Damkar 113) — validasi server (`server/reports.js`), relay Telegram menyertakan detail; `ReportButton.jsx` menampilkan isian khusus per tipe.
- **Kopi × asap** (FR-ASAP-5): `dryingStatus(rain, solarRad, rh, haze)` mengembalikan **"Tunda (asap)"** bila `coffeeHazeRule` menahan penjemuran (ISPU ≥ 101 atau AOD ≥ 1 & DNI < 300); hujan tetap diprioritaskan; `weatherService` meneruskan ISPU/AOD/DNI dari kartu udara dan menambahkan `fireDanger`, `drought` ke payload.
- Konstanta baru `thresholds.HOTSPOT / FWI_OPS / HTH / WATER_BALANCE / FWI.dc` (docs/reference/THRESHOLDS.md §10–12); i18n `fireDanger*`, `drought*` (Gayo `[?]`); `.env.example` + `FIRMS_SOURCES`, `FIRMS_DAYS`, `ARCHIVE_DAYS`.

### Test
- +54 test (`tests/drought.test.js`, `hotspots.test.js`, `archive.test.js`, `fireWeatherServer.test.js`, `firmsServer.test.js`, `dryingHaze.test.js`, tambahan di `reports.test.js` & `fireWeather.test.js`) → total **198** lulus. Semua fetch upstream di-mock (`fetchImpl`) dan file state ditulis ke direktori sementara.

### Sinkronisasi upstream (575c4d3)
- Dipulihkan dari paket Sprint 1 yang tidak ikut terpasang di upstream d05bd0e: `tests/ispu.test.js`, `tests/hazardData.test.js`, 6 fixture `tests/fixtures/hazards/*` (arsip 90 hari, konvektif, banjir Peusangan, GFS CAPE/LI, PetaBencana, USGS), `magma-tingkat-aktivitas.html` (sebelumnya 0 byte), proxy dev Vite `/api` → `127.0.0.1:7455`.

### Catatan lapangan (15 Okt 2026)
- Takengon berada di musim basah: HTH 0, hujan 30 hari ≈ 380 mm, FWI 0 (FFMC ≈ 35, DC ≈ 5). Kabut asap yang terasa di Aceh Tengah berasal dari karhutla **jauh** (transport regional), bukan kebakaran lokal — konsisten dengan kartu udara (AOD tinggi, PM2,5 sedang) dan kartu kebakaran (rendah).

## v2.0-dev Sprint 1 (Fase 1: 1.1, 1.2, 1.3, 1.5b + rilis cepat kartu)

### Fitur
- **H-ASAP** `GET /api/air-quality?location=<id>` (`server/airQuality.js`): Open-Meteo Air Quality (CAMS global ~40 km, `past_days=1`) + jarak pandang/RH/DNI `best_match`; TTL 60 menit (`AQ_TTL_MIN`); degraded tanpa throw; `?location=all` ringkasan 15 sentra + lokasi terburuk.
- `src/domain/hazards/ispu.js` — ISPU Permen LHK P.14/2020 (PM2,5/PM10/CO, interpolasi linier, kategori, rata-rata bergerak 24 jam/8 jam) dan `src/domain/hazards/airQuality.js` — penilaian lengkap: ISPU 24 jam + nilai sesaat, proksi kabut asap dari jarak pandang siang 10–17 WIB (penyaring RH ≥ 90 %, wajib didukung PM2,5 ≥ 35 atau AOD ≥ 0,5, eskalasi bahaya butuh ≥ 2 jam < 2 km), prospek 24 jam, anjuran 4 kelompok + ruang bersih (`healthAdvice.json`), catatan WHO, aturan tunda jemur/kerja kebun.
- `src/domain/hazards/fireWeather.js` — FWI System (FFMC/DMC/DC/ISI/BUI/FWI, opsi ekuator, kelas FDRS, `fireDangerClass` kalibrasi lokal) dipindahkan dari prototipe; = dataset uji resmi `cffdrs` 48 hari hingga 0,005. Server/kartu kebakaran menyusul (1.4–1.6).
- Kartu **"Kabut Asap & Kualitas Udara"** (`AirQualityCard.jsx`) di tab Kini (mobile) dan kolom kanan (desktop): angka ISPU + kategori, status, jarak pandang siang, PM2,5/PM10/AOD, prospek, anjuran per kelompok, daftar periksa ruang bersih, label "estimasi model CAMS — bukan ISPU resmi" + tautan ISPUNet/BMKG. `weatherService` mengembalikan `airQuality` (best-effort).
- Konstanta baru `thresholds.ISPU / HAZE / FWI` (docs/reference/THRESHOLDS.md §7–9); i18n kunci `airQuality*` (Gayo ditandai `[?]`).
- Dev: proxy Vite `/api` → `127.0.0.1:7455`; `scripts/fetch-hazard-fixtures.mjs` menambah `relative_humidity_2m` pada fixture jarak pandang.

### Test
- +46 test (`tests/ispu.test.js`, `fireWeather.test.js`, `airQuality.test.js`, `airQualityServer.test.js`) → total **144** lulus. Koreksi: dataset `cffdrs` berisi 48 hari (13 Apr–30 Mei 1985), bukan 49.

### Dokumen perencanaan multi-bahaya (sebelumnya)
- Paket perencanaan `docs/dev/` (indeks: `docs/dev/README.md`): audit repo, log 10 iterasi riset, PRD multi-bahaya (asap karhutla, kebakaran/FWI, gempa, vulkanik Burni Telong, kekeringan/HTH, suhu ekstrem, banjir/GloFAS, konvektif petir–hujan es–puting beliung, kesehatan, diseminasi CAP), roadmap 4 fase (Okt 2026–Apr 2027), katalog sumber data (diuji langsung), arsitektur + ADR-12…26, ambang multi-bahaya, risk register, tata kelola/KPI.
- Prototipe fungsi murni tervalidasi (`docs/dev/prototypes/`): ISPU Permen LHK P.14/2020 dan FWI System (Van Wagner 1987; = dataset uji resmi `cffdrs` 48 hari hingga 0,005) — `node docs/dev/prototypes/check.mjs`, `check-cffdrs.mjs`.
- Penyiapan aset data (`docs/dev/09-DATA-PREP.md`): fixture nyata 13 sumber (`tests/fixtures/hazards/`, `scripts/fetch-hazard-fixtures.mjs`), `src/data/geo/kecamatan.json` (GADM, 21 kB), data statis `src/data/hazards/*` (anjuran kesehatan, konteks iklim, riwayat tambahan, pemetaan sentra→kecamatan, kerangka kontak), `.env.example`, test `tests/hazardData.test.js` (+7; total 98). `healthAdvice.json` kini dipakai Sprint 1; aset lain belum di-import.

## [1.2.0] - 2026-10-04 — M3-M4 + F1/F2/F4/F5/F7/F8

### Konsolidasi PRD (F1–F8, detail di docs DISASTER-DATA-RESEARCH repo docs)
- F1 konsensus multi-model (ADR-8): `/api/consensus` — ECMWF ifs025 50 member + WeatherNext2 64 member, P(hujan>25mm/24j) per model, level tinggi (≥2 setuju)/sedang/rendah, fallback degraded.
- F2 antecedent rainfall index (ADR-9): `/api/alerts` menyertakan `antecedent` 24/72j; bobot longsor diupgrade antecedent 72j 25→35, hujan 24j 35→25. Sumber primer **NASA IMERG Late daily** (server/imerg.js, OPeNDAP GES DISC + Earthdata Bearer; ARI 24j/72j/7d, cache 30 menit, retry 2x) dengan fallback otomatis `model-ecmwf` bila gagal/401.
- F4 riwayat bencana (ADR-11): DIBI BNPB tak menyediakan endpoint JSON kejadian → data statis terkurasi 6 kejadian 2023–2026 (`src/data/disasterHistory.json`), `/api/disaster-history`, blok "Riwayat kejadian" di panel Risiko.
- F5 nowcast resmi BMKG (ADR-10): `/api/bmkg-nowcast` parse RSS CAP bmkg.go.id, filter Aceh, cache 10 menit, degraded false-error.
- F7 kalender risiko musiman: `src/domain/seasonal.js` (PUNCAK Nov–Feb / WASPADA Mar–Apr+Okt / RENDAH Mei–Sep), `/api/seasonal`, banner musiman.
- F8 lapor warga: `ReportButton` (modal aksesibel) + `POST /api/reports` → `server/data/reports.json` (gitignored), rate limit 5/jam/IP, relay Telegram topik #55; `GET /api/reports` riwayat 7 hari.
- Diseminasi: 2 cron Telegram diarahkan ke topik #55 Cron/Automate (Peringatan Dini Gayo 30m→3h, Status Mitigasi Bencana 3h→6h).
- WN3: form akses WeatherNext 3 terkirim 3 Okt 2026, menunggu approval (~7 hari kerja).

### UI
- Token desain "Stasiun Cuaca Kebun" + refactor komponen; dua layout (mobile tab bar 4 tab + desktop grid editorial 12 kolom).

### Fix
- PWA: workbox skipWaiting+clientsClaim+cleanupOutdatedCaches (SW stale bundle tidak menggantung update).
- API: buang param `time` dari `current` (HTTP 400 Open-Meteo models=ecmwf_ifs025).
- Housekeeping: gitignore `server/data/` (runtime laporan warga).

## [1.1.0] - 2026-10-03 — M0-M2 (Part A)

### M0 — Spikes (semua GO, verdict di docs/SPIKES.md)
- S1: `models=ecmwf_ifs025` terverifikasi hidup untuk 15/15 lokasi (field hourly lengkap, DNI non-null).
- S2: BMKG `api.bmkg.go.id/publik/prakiraan-cuaca` HTTP 200 dari VPS dengan UA browser (adm4 Takengon Timur = 11.04.17.2001; 3-harian per-3-jam). Rate-limit 429 saat burst → wajib cache.
- S3: fungsi pure `src/domain/ensemble.js` — P(hujan >25mm / >50mm per 24 jam) dari 50 member; 5 unit test.
- S4: vite-plugin-pwa terpasang & terkonfigurasi (autoUpdate SW + manifest); build menghasilkan sw.js + precache.
- S5: fungsi pure `leafWetnessRustRisk(rolling48h)` + fixture test (5 unit test).

### M1 — Perbaikan kebenaran data
- BUG-01: slice hourly mulai dari index `current.time` (jam berjalan), bukan 00:00.
- BUG-02: solarRad diambil dari jam berjalan (index current), bukan jam tengah malam.
- BUG-03: timestamp dari `current.time` API, bukan jam browser.
- BUG-04: tambah `models=ecmwf_ifs025` + param `elevation=` per lokasi.
- AbortController + retry eksponensial + dedupe request in-flight; cache memory 10 menit + staleness.

### M2 — Arsitektur & repo hygiene
- Pecah weatherService → `src/api/openMeteo.js` (fetch murni + DI fetch) + `src/domain/{coffee,disaster,format,thresholds}.js` (fungsi murni, tanpa className).
- Error boundary React (`src/components/ErrorBoundary.jsx`).
- Hapus dist/ dari git + .gitignore; LICENSE (MIT, Niumination/Afrizal Munthe); CHANGELOG.md; AGENTS.md dikoreksi (indeks hujan DAS, bukan status muka air nyata).
