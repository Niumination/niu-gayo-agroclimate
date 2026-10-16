# How-to: menaruh dashboard di server produksi

**Kuadran:** how-to (tugas) · **Audiens:** maintainer yang memegang server LightVela. Tutorial dasar ada di [../tutorials/01-jalankan-lokal.md](../tutorials/01-jalankan-lokal.md).

Arsitektur produksi hari ini: **frontend statis** (`dist/`) disajikan `scripts/serve.py` di port **7444**, **API** `server/index.js` di port **7455**, keduanya di balik **Cloudflare Tunnel** ke `https://cuaca.abstract.biz.id` (path `/api/*` dan `/healthz` di-forward ke 7455).

## 1. Siapkan berkas lingkungan

```bash
cp .env.example .env
$EDITOR .env
```

Isi minimal: `ALERTS_CRON_TOKEN` (acak panjang), `TELEGRAM_*` bila peringatan ingin aktif (lihat [02-aktifkan-peringatan-telegram.md](02-aktifkan-peringatan-telegram.md)), `FIRMS_MAP_KEY` bila kartu hotspot harus hidup.

> Format `.env.example` sengaja “aman untuk `EnvironmentFile=` systemd”: komentar harus di baris sendiri, tanpa komentar di ujung baris (nilai akan ikut terbaca). Jangan commit `.env`.

## 2. Build bundle

```bash
npm ci
npm run build          # → dist/
npm run check:bundle   # JS utama ≤ 150 kB gzip, total ≤ 200 kB
```

Catatan kompatibilitas v2.1: Tailwind 4 menargetkan **Safari 16.4+ / Chrome 111+ / Firefox 128+**. Untuk perangkat kebun yang lebih lama, tag **v2.0.1** tetap tersedia.

## 3. Pasang unit systemd (mode pengguna)

Unit ada di repo — salin, muat ulang, lalu nyalakan:

```bash
mkdir -p ~/.config/systemd/user
cp server/agroclimate-api.service ~/.config/systemd/user/
cp server/agroclimate-alerts.service server/agroclimate-alerts.timer ~/.config/systemd/user/
cp server/agroclimate-alerts-fast.service server/agroclimate-alerts-fast.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now agroclimate-api.service
systemctl --user enable --now agroclimate-alerts.timer agroclimate-alerts-fast.timer
```

Unit sudah mengarah ke `%h/niumination/niu-gayo-agroclimate` — samakan path bila repo Anda di tempat lain. Hardening (audit F-17) sudah menyala: `ProtectSystem=strict`, `NoNewPrivileges`, dan **satu-satunya jalur tulis** `server/data/` (arsip bahaya, status peringatan, laporan warga).

Periksa:

```bash
systemctl --user status agroclimate-api.service --no-pager
systemctl --user list-timers 'agroclimate-*' --no-pager
curl -s http://127.0.0.1:7455/healthz | head -c 400
```

## 4. Frontend statis + tunnel

```bash
# serve dist/ di port 7444 (mode produksi)
python3 scripts/serve.py &
```

`scripts/serve.py` menyajikan `dist/` dengan *fallback* `index.html` untuk rute SPA. Arahkan Cloudflare Tunnel: hostname `cuaca.abstract.biz.id` → `http://127.0.0.1:7444`, lalu tambahkan aturan path `/api/*` dan `/healthz` → `http://127.0.0.1:7455`.

## 5. Verifikasi rilis

```bash
npm test                 # 321 uji
npm run check:coverage   # gerbang ambang cakupan
npm run check:outlook    # gagal bila climateOutlook.json kedaluwarsa
npm run smoke            # 16 endpoint + penjaga, server nyala di port acak
curl -s https://cuaca.abstract.biz.id/healthz | head -c 400
```

Di `/healthz` periksa `features` (`firmsKey`, `telegram`, `cronToken`) dan `sources.*.state` — `ok` berarti sumber terakhir sehat, `degraded` berarti fallback yang sedang dipakai (bukan kegagalan server).

## 6. Perbarui & kembalikan (rollback)

```bash
git pull && npm ci && npm run build && systemctl --user restart agroclimate-api.service
```

- Frontend: cukup `npm run build` — `serve.py` membaca `dist/` langsung.
- API bermasalah: `git checkout <tag-sebelumnya> && npm ci && npm run build && systemctl --user restart agroclimate-api.service`.
- Arsip & status peringatan aman: hidup di `server/data/` (tidak tersentuh git).

## Jangan lakukan

- **Jangan** tempatkan `.env` di dalam `dist/` — bundle statis publik.
- **Jangan** buka port 7455 ke internet langsung; biarkan tunnel yang mengekspos, dengan `ALERTS_CRON_TOKEN` terisi agar `/api/alerts/run` tidak bisa dipanggil orang lain.
- **Jangan** jalankan `npm run clim:flood` / `clim:spi` rutin — hanya saat memperbarui baseline (Open-Meteo membatasi laju).

Lihat juga: [../reference/KONFIGURASI-ENV.md](../reference/KONFIGURASI-ENV.md) · [../reference/SKRIP-NPM.md](../reference/SKRIP-NPM.md) · [../explanation/README.md](../explanation/README.md)
