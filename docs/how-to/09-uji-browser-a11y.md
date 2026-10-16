# Uji aksesibilitas di browser (ratchet)

**Kuadran:** how-to (tugas) · **Audiens:** maintainer/penguji · **Terkait:** paket **P6** (`docs/dev/11-RENCANA-DESIGN-UX.md`)

Gerbang otomatis repo ini (`npm test`, `check:contrast --strict`, `check:typography`, `node --test tests/{a11yContract,motionContract,stateContract}.test.js`) berjalan **tanpa browser**. Pemindai otomatis hanya menangkap ±57 % temuan WCAG dan hampir tidak pernah melihat `2.5.8 Target 24×24` (±18,7 %) — karena itu perlu satu jalur **browser** yang dijalankan manusia.

> **Kenapa tidak di CI?** Sandbox pembuat paket dan runner CI repo ini tidak memasang browser. Menambahkan Chromium ke CI memperbesar waktu & ongkos tanpa menjaga nilai; jalur ini dijalankan **manual di mesin Anda** (mis. Hermes) lalu hasilnya dicatat di issue/laporan.

## 1. Siapkan (sekali)

```bash
npm ci
npm run build && npm run preview          # http://localhost:4173 (atau pakai domain produksi)
```

## 2. Jalankan pa11y-ci (cepat, halaman per halaman)

Berkas [`/.pa11yci.json`](../../.pa11yci.json) sudah disiapkan (2 viewport, standar `WCAG2AA` + `WCAG2.2AA`):

```bash
npx --yes pa11y-ci --config .pa11yci.json
```

- Target: **0 error**. Mulai dari kondisi sekarang lalu **turunkan bertahap** (ratchet) — jangan menaikkan ambang untuk “menghijaukan” hasil.
- Bila muncul error baru: catat **halaman + aturan + selector**, perbaiki, jalankan ulang.

## 3. Jalankan axe-core lewat Playwright (lebih dalam: 4 tab × 2 tema)

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
| Sekarang | 0 pelanggaran `wcag2aa`/`wcag21aa`/`wcag22aa` di 4 tab × 2 tema | perbaiki sebelum rilis |
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
