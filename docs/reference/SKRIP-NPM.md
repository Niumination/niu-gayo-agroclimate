# Referensi: perintah npm & gerbang mutu

**Kuadran:** reference · Sumber kebenaran: `package.json` + `scripts/`. Bila Anda mengubah salah satu skrip, perbarui tabel ini **dan** `AGENTS.md`.

## Skrip

| Perintah | Yang dijalankan | Keluaran / kegunaan |
|---|---|---|
| `npm run dev` | Vite dev server (:5188) | UI + proxy `/api` ke `127.0.0.1:7455` |
| `npm run build` | Vite 8 / Rolldown → `dist/` | bundle produksi, ± 0,5 detik |
| `npm run preview` | Vite preview | menyajikan `dist/` (uji PWA/offline) |
| **`npm run lint`** | `eslint .` | **gerbang lint (P6)**: `eslint.config.js` (flat) + `eslint-plugin-jsx-a11y` + `eslint-plugin-react-hooks`; 0 temuan. devDependency saja — **0 dampak bundel** |
| `npm test` | `node --test tests/*.test.js` | **377 uji**, semua panggilan jaringan di-mock (termasuk 10 uji kontrak a11y, 9 uji gerbang tipografi, 9 uji kontrak keadaan, 9 uji kontrak gerak) |
| `npm run test:coverage` | sama + `--experimental-test-coverage` | laporan cakupan mentah (tanpa ambang) |
| **`npm run check:coverage`** | `scripts/check-coverage.mjs` | **gerbang cakupan**: baris ≥ 95 %, cabang ≥ 80 %, fungsi ≥ 92 % + tren vs baseline |
| **`npm run check:bundle`** | `scripts/check-bundle.mjs` | JS utama ≤ 150 kB gzip · total ≤ 200 kB (atur lewat `BUNDLE_MAX_KB`/`BUNDLE_TOTAL_MAX_KB`) |
| **`npm run check:outlook`** | `scripts/check-outlook.mjs` | **gagal** bila `src/data/hazards/climateOutlook.json` lewat `validUntil`; **peringatan** bila sisa ≤ 14 hari (`--warn-days N`) |
| `npm run check:i18n` | `scripts/check-i18n.mjs` | inventaris placeholder Gayo `[?]` (kini **76**); `--strict` → keluar 1 bila masih ada |
| **`npm run check:contrast`** | `scripts/check-contrast.mjs` | **gerbang kontras desain (strict sejak P1)**: nilai 34 pasangan token WCAG 2.2 AA dari `src/index.css` (teks 4,5:1 · non-teks 3:1) + pindai utilitas teks beropasitas di `src/` (kini **0**) + hitungan teks < 16 px; abaikan komentar blok; opsi `--strict/--json/--all/--css/--dir` |
| **`npm run check:typography`** | `scripts/check-typography.mjs` | **gerbang tipografi (P3)**: tolak ukuran arbitrer < 16 px, `text-xs`/`text-sm`, kelas kecil pada `select`/`input`/`textarea`, sisa `truncate`; pastikan font data ada di `public/fonts/` dan terbangun ke `dist/fonts/`; opsi `--json/--dir` |
| **`npm run smoke`** | `scripts/smoke.mjs` | menyalakan server di port acak 7600–7899, memeriksa 16 endpoint GET + 3 penjaga (header keamanan, cache/flush, CAP); gagal hanya pada 5xx/non-JSON |
| `npm run validate:season` | `scripts/validate-season.mjs` | POD/FAR dari arsip harian + kejadian terkurasi → lihat [VALIDATION.md](VALIDATION.md) |
| `npm run clim:flood` | `scripts/build-flood-clim.mjs` | **jarang** (1×/tahun) — GloFAS 1984–tahun lalu → `server/clim/flood-clim.json` |
| `npm run clim:spi` | `scripts/build-spi-baseline.mjs` | **jarang** — ERA5 1991–2020 → `server/clim/spi-baseline.json` (Open-Meteo membatasi laju, HTTP 429) |

## Gerbang cakupan (`check:coverage`)

- **Ambang** (di `scripts/check-coverage.mjs`): baris **95 %** · cabang **80 %** · fungsi **92 %** — sengaja 1,5–4 poin di bawah baseline agar refactor kecil tidak membuat CI rapuh, tetapi penurunan berarti tetap menggagalkan build.
- **Baseline terversi:** `scripts/coverage-baseline.json` (2026-10-16: 96,42 / 83,78 / 95,96 pada 321 uji). Setiap kali dijalankan, skrip mencetak selisihnya (`ℹ [coverage] tren vs baseline …`).
- Opsi: `--min-lines N` `--min-branches N` `--min-functions N` (ambang kustom) · `--from <berkas>` (nilai laporan tersimpan, mis. artefak CI, tanpa menjalankan ulang suite) · `--update-baseline` (catat angka kini sebagai baseline baru).
- **Kode keluar:** `0` lolos · `1` suite uji gagal **atau** di bawah ambang · `2` salah pakai argumen.
- Hanya memakai flag cakupan Node ≥ 20 (`--experimental-test-coverage`), sesuai lantai `engines`.

## Perintah non-npm

| Perintah | Kegunaan |
|---|---|
| `node server/index.js` | menjalankan API (port 7455) |
| `node scripts/alerts-cron.mjs [--dry-run] [--only gempa,vulkanik]` | memanggil siklus peringatan; `--dry-run` tidak mengirim & tidak mengubah state |
| `python3 scripts/serve.py` | menyajikan `dist/` di port 7444 (produksi) |
| `node scripts/fetch-hazard-fixtures.mjs` | mengambil ulang respons sumber → `tests/fixtures/hazards/` |

## Urutan CI ([`.github/workflows/ci.yml`](../../.github/workflows/ci.yml))

```
npm ci → npm test → npm run check:coverage → npm audit --omit=dev --audit-level=high
      → npm run check:outlook → npm run check:i18n → npm run check:contrast -- --strict
      → npm run build → npm run check:typography → npm run check:bundle → npm run smoke
```

Angka acuan saat rilis v2.1.0 (semua hijau): 327 uji · cakupan 96,46/83,86/96,00 · bundle 65,8 kB gzip (utama) & 131,6 kB (total) · CSS 8,09 kB gzip · outlook berlaku sampai 2026-11-12 · `npm audit` **0**.
Angka setelah **P6 (pengaman & tata kelola, 16 Okt 2026)**: **377 uji** · `npm run lint` **0 temuan** · cakupan 95,75/84,41/95,97 % · bundel JS 134,6 kB gzip · seluruh gerbang hijau (+ `.pa11yci.json` & `docs/how-to/09-uji-browser-a11y.md` untuk uji browser manual).

Angka setelah **P5 (gerak & area aman, 16 Okt 2026)**: **377 uji** · cakupan 95,75/84,41/95,97 % · bundel JS 134,6 kB gzip · seluruh gerbang hijau.

Angka setelah **P4 (keadaan aplikasi, 16 Okt 2026)**: **368 uji** · cakupan 95,74/84,35/95,93 % · seluruh gerbang hijau (`check:contrast --strict`, `check:typography`, `check:bundle`, `smoke`, `check:outlook`, `check:i18n`).

Angka setelah **P3 (tipografi & font, 16 Okt 2026)**: **359 uji** · cakupan 95,70/84,31/95,91 % · `check:contrast --strict` hijau (34/34 pasangan) · `check:typography` hijau (0 teks < 16 px isi, 0 `truncate`, font 42 kB terbangun di `dist/fonts/`) · 0 dari 25 tombol < 44 px · bundel JS 132,9 kB gzip (font di luar anggaran JS) · precache PWA 16 entri / 536 KiB.

Lihat juga: [ENDPOINT-API.md](ENDPOINT-API.md) · [KONFIGURASI-ENV.md](KONFIGURASI-ENV.md) · [`AGENTS.md`](../../AGENTS.md)
