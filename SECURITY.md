# Kebijakan Keamanan — Niu Gayo Agro-Climate

## Versi yang didukung

| Versi | Didukung | Catatan |
|---|---|---|
| 2.0.x | ✅ | Rilis aktif (multi-bahaya lengkap) |
| 1.x | ❌ | Tidak lagi dipelihara |

## Melaporkan kerentanan

Jangan membuka issue publik untuk masalah keamanan. Laporkan melalui salah satu jalur berikut:

1. **GitHub Security Advisory** (disarankan): buka tab *Security → Report a vulnerability* pada repositori ini — laporan bersifat privat sampai diperbaiki.
2. **Surel**: hubungi maintainer (lihat profil GitHub `@niumination`) — sebutkan versi/commit, dampak, dan langkah reproduksi.

**Target respons:** konfirmasi ≤ 7 hari; perbaikan untuk temuan kritis (S1) diutamakan ≤ 30 hari.

## Cakupan

Yang termasuk cakupan: kode di `server/`, `src/`, `scripts/`, konfigurasi CI, dan berkas systemd di repositori ini.

Di luar cakupan: endpoint pihak ketiga (BMKG, MAGMA, USGS, Open-Meteo, FIRMS, PetaBencana), serta salah konfigurasi sisi penyebaran (nginx, firewall, kunci API) yang tidak ada di repositori.

## Praktik yang sudah diterapkan

- **Rahasia tidak pernah di-commit** — hanya `.env.example` berisi placeholder; token Telegram dibaca dari env/berkas luar repositori; token Earthdata dari `~/.netrc`.
- **Uji otomatis** — 280+ uji unit + smoke test API di CI untuk setiap push/PR.
- **Anggaran bundel** dijaga otomatis (check:bundle) agar tidak ada regresi ukuran.
- **Mode degradasi** — kegagalan sumber data eksternal tidak boleh menjadi 5xx; server selalu menjawab JSON.
- Header keamanan dasar (`X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: no-referrer`) pada semua respons API.
- Token cron (`x-cron-token`) dibandingkan dengan `crypto.timingSafeEqual`.

## Advisori dependensi (status)

**Per 2026-10-16, v2.1.0: `npm audit` bersih (0 kerentanan) pada seluruh pohon dependensi.** Riwayat yang perlu diketahui:

| Paket | Advisori | Status |
|---|---|---|
| `braces` ≤ 3.0.3 | CVE-2026-93687 (GHSA-vfj7-8cjw-p6xm) — stack-overflow DoS via pola bersarang; **tidak pernah ada versi patch** | **Selesai di v2.1.0** — rantai `tailwindcss@3 → chokidar → braces` dihapus oleh migrasi Tailwind 4 (yang tidak lagi memakai chokidar/braces). Tidak ada lagi salinan `braces` pada pohon dependensi. |
| `postcss-selector-parser` < 7.1.6 | GHSA-rj75-hqrm-r3gf (quadratic CPU saat build) | Ditutup v2.0.1 lewat override `^7.1.6`; rantai induknya (`postcss-nested`) juga hilang di v2.1.0. |

Kebijakan yang berjalan: CI menolak kerentanan pada **dependensi produksi** (`npm audit --omit=dev --audit-level=high`), Dependabot mingguan menjaga pembaruan, dan setiap advisori dev-only wajib dicatat di berkas ini dengan penilaian dampak nyata.

## Kunci/token yang perlu dikelola pengguna

`TELEGRAM_BOT_TOKEN`, `ALERTS_CRON_TOKEN`, `FIRMS_MAP_KEY`, token Earthdata (`~/.netrc`), dan (rencana) kunci VAPID. Ganti segera bila diduga bocor; server tidak menyimpan rahasia di repositori.
