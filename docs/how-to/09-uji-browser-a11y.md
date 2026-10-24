# Uji aksesibilitas di browser (ratchet)

**Kuadran:** how-to (tugas) · **Audiens:** maintainer/penguji · **Terkait:** paket **P6** (`docs/dev/11-RENCANA-DESIGN-UX.md`)

Sejak **F-39** (audit 23 Okt 2026) repo ini punya gerbang a11y **berbasis browser** yang ikut CI: `npm run check:a11y` (`scripts/a11y-gate.mjs`). Gerbang ini menyalakan tiruan produksi lokal — `dist/` dilayani seperti host statis, `/api/*` diteruskan ke `server/index.js` — lalu menjalankan axe-core (`wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa`) di tiga permukaan: **Peta hidup · Tanah** (`/`), **Peta hidup · Langit**, dan **Peta hidup · sentra dari
URL** (`/?sentra=linge`) — masing-masing pada **tiga lebar**: **1920** (Mode 1 penuh), **1440** (Mode 2 lebar), dan **1100** (Mode 2 sempit, ≤ 1200 px). Sejak 2.3.4 itu **9 audit**; sebelumnya hanya 1920, sehingga panel yang berubah bentuk di Mode 2 tidak pernah diperiksa axe. Sejak F-32 (2.3.1) Peta Hidup adalah satu-satunya UI desktop, jadi permukaan
"papan" dihapus. Satu pelanggaran = build gagal.

Gerbang itu menutup celah yang dulu lolos dari semua pemeriksaan statis: tiga temuan Sprint A (label ganda, fokus masuk ke panel terlipat, target sentuh < 24 px) hanya muncul setelah halaman benar-benar dirender, sehingga `npm test`, `check:contrast`, dan `check:typography` semuanya hijau.

**Yang tetap tidak dilihat mesin** dan harus diperiksa manusia: `2.5.8 Target 24×24` (±18,7 % tertangkap pemindai), `2.4.11 Fokus tidak terhalang`, zoom 200 %, serta kondisi jaringan/tema. Empat hal itu ada di §3.

> **Kenapa dulu manual?** Sampai 2.2.2, runner CI tidak memasang browser. Sekarang CI memperoleh `chrome-headless-shell` (dipin ke versi) ke `.cache/browsers/` lalu memberi `CHROME_PATH`; bila `CHROME_PATH` diset tetapi biner tidak ada, gerbang **gagal** — bukan dilewati diam-diam.

## 1. Jalankan gerbang otomatis (wajib lulus)

```bash
npm ci
npm run build            # gerbang menolak dist yang lebih tua dari src/
npm run check:a11y
```

Di mesin baru tanpa browser, gerbang berhenti dengan peringatan (exit 0) dan menyebutkan perintah pemasangannya:

```bash
# versi browser mengikuti puppeteer-core — jangan pakai angka lain: pasangan yang
# tidak cocok membuat CDP menggantung (Runtime.evaluate timeout), bukan gagal jelas
VERSION=$(node -e "import('puppeteer-core/internal/revisions.js').then((m) => console.log(m.PUPPETEER_REVISIONS['chrome-headless-shell']))")
npx @puppeteer/browsers install "chrome-headless-shell@$VERSION" --path .cache/browsers
CHROME_PATH="$PWD/$(find .cache/browsers -type f -name chrome-headless-shell | head -1)" npm run check:a11y
```

Keluaran lulus terlihat seperti ini:

```
✓ Peta hidup — Tanah @1920: 0 pelanggaran axe
✓ Peta hidup — Tanah @1440: 0 pelanggaran axe
✓ Peta hidup — Tanah @1100: 0 pelanggaran axe
✓ Peta hidup — Langit @1920: 0 pelanggaran axe
…
✓ gerbang a11y lolos — 9 audit bersih (3 permukaan × lebar 1920/1440/1100 · axe wcag2a, wcag2aa, wcag21a, wcag21aa)
```

Lebar mengikuti satu-satunya UI desktop: **Mode 1** (> 1200 px), **Mode 2** (≤ 1200 px), **Mode 3** (≤ 900 px). Mode 3 tidak diaudit di sini karena tata letak itu milik tablet/HP yang sudah punya uji sendiri; bila breakpoint desktop berubah, ubah `VIEWPORTS` di `scripts/a11y-gate.mjs` **dan** tabel di bawah.

## 2. Pemeriksaan tambahan: pa11y-ci (halaman per halaman)

Berkas [`/.pa11yci.json`](../../.pa11yci.json) sudah disiapkan (2 viewport, standar `WCAG2AA` + `WCAG2.2AA`):

```bash
npx --yes pa11y-ci --config .pa11yci.json
```

- Target: **0 error**. Mulai dari kondisi sekarang lalu **turunkan bertahap** (ratchet) — jangan menaikkan ambang untuk “menghijaukan” hasil.
- Bila muncul error baru: catat **halaman + aturan + selector**, perbaiki, jalankan ulang.

## 3. Pemeriksaan manual yang tidak bisa dilihat mesin (4 tab × 2 tema)

```bash
npx --yes playwright install chromium
npx --yes playwright@latest test a11y.spec.mjs   # berkas contoh di bawah
```

Contoh `a11y.spec.mjs` (simpan di luar repo bila tidak ingin ikut ter-commit):

```js
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const TABS = ['Ringkas', 'Bahaya', 'Cuaca', 'Riwayat']   // sesuaikan label tab
const THEMES = ['light', 'dark']
const URL = 'http://localhost:4173'

for (const tab of TABS) {
  for (const theme of THEMES) {
    test(`${tab} · ${theme}`, async ({ page }) => {
      await page.goto(URL)
      await page.emulateMedia({ colorScheme: theme })
      await page.getByRole('tab', { name: tab }).click()
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      expect(results.violations).toEqual([])
    })
  }
}
```

Selain axe, periksa manual empat hal yang tidak bisa dilihat mesin:

1. **Target 24×24 (2.5.8)** — ukur tombol kecil (chip riwayat bencana, tombol salin, item sentra) pada 320 px.
2. **Fokus tidak terhalang (2.4.11)** — Tab dari awal sampai akhir: tidak ada fokus yang tertutup header lengket atau bilah bawah.
3. **Zoom 200 %** dan **teks saja 200 %** — tidak ada isi terpotong/tergulir horizontal.
4. **Kondisi jaringan & tema** — skeleton (Slow 3G), pita offline (Offline), pita data basi (> 30 menit), dan tema gelap saat terang ruangan (bukan hanya `prefers-color-scheme`).

## 4. Ambang & pelaporan

| Tahap | Ambang | Aksi bila gagal |
|---|---|---|
| Sekarang | 0 pelanggaran `wcag2aa`/`wcag21aa`/`wcag22aa` di 3 permukaan × 3 lebar (1920/1440/1100) × 2 tema | perbaiki sebelum rilis |
| Setelah stabil | tambahkan `pa11y-ci` untuk 320 px + 1280 px | simpan keluaran sebagai bukti di laporan |
| Berkelanjutan | jalankan tiap rilis (checklist rilis) | catat tren di CHANGELOG/issue |

**Format catatan hasil** (tempel ke laporan/issue):

```
Tanggal · commit · URL/versi · alat (pa11y-ci x.y / axe-core z)
pa11y-ci: N error (daftar halaman + aturan)
axe: 0 pelanggaran (4 tab × 2 tema) · manual: 2.5.8 ✅ · 2.4.11 ✅ · zoom ✅
Catatan: …
```

## 5. Jangan lakukan

- Jangan `skipWaiting` atau menyembunyikan elemen untuk “menghilangkan” temuan (`aria-hidden` pada konten nyata = pelanggaran baru).
- Jangan menaikkan ambang/`--disable` aturan untuk melewati kegagalan — ratchet hanya bergerak **turun**.
- Jangan mengandalkan emulator untuk `env(safe-area-inset-*)`: nilainya **0** di emulator; uji di perangkat nyata (lihat `CARA-TERAPKAN.md` §3 paket sync-17).
