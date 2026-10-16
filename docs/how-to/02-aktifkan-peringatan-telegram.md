# How-to: mengaktifkan peringatan Telegram otomatis

**Kuadran:** how-to (tugas) · **Audiens:** maintainer (tugas manusia **H-7**). Uji coba pertama: [../tutorials/01-jalankan-lokal.md](../tutorials/01-jalankan-lokal.md).

Siklus peringatan berjalan di server: `scripts/alerts-cron.mjs` memanggil `POST /api/alerts/run`, mengevaluasi 11 bahaya, lalu mengirim pesan ke Telegram dengan aturan anti-kebisingan. Cron **tidak** mengirim apa pun bila `.env` belum diisi — jadi urutannya: isi token → uji kering → nyalakan timer.

## 1. Siapkan bot & kanal

1. Buat bot dengan `@BotFather` → simpan token (`TELEGRAM_BOT_TOKEN`).
2. Masukkan bot ke kanal/grup warga → ambil id (`TELEGRAM_HOME_CHANNEL`, mis. `-100xxxxxxxxxx`). Bila memakai topik di grup, isi `TELEGRAM_CRON_THREAD_ID` (mis. `55`).
3. Buat token acak untuk cron: `openssl rand -hex 24` → `ALERTS_CRON_TOKEN`.

Isi ketiganya di `.env` (jangan commit):

```dotenv
TELEGRAM_BOT_TOKEN=123456:AA...
TELEGRAM_HOME_CHANNEL=-1001234567890
TELEGRAM_CRON_THREAD_ID=55
ALERTS_CRON_TOKEN=<hasil openssl>
```

## 2. Uji kering dulu (tidak mengirim apa pun)

Pastikan API hidup (`node server/index.js`), lalu:

```bash
node scripts/alerts-cron.mjs --dry-run         # semua bahaya
node scripts/alerts-cron.mjs --dry-run --only gempa,vulkanik   # jalur cepat
```

`--dry-run` tidak mengirim pesan **dan** tidak mengubah `server/data/alert-state.json`. Perhatikan keluaran `wouldSend`: itulah pesan yang akan dikirim.

## 3. Nyalakan timer systemd

```bash
cp server/agroclimate-alerts.service server/agroclimate-alerts.timer ~/.config/systemd/user/
cp server/agroclimate-alerts-fast.service server/agroclimate-alerts-fast.timer ~/.config/systemd/user/
systemctl --user daemon-reload
systemctl --user enable --now agroclimate-alerts.timer agroclimate-alerts-fast.timer
systemctl --user list-timers 'agroclimate-*' --no-pager
```

| Timer | Irama | Cakupan | Alasan |
|---|---|---|---|
| `agroclimate-alerts.timer` | 30 menit | semua bahaya | siklus penuh; arsip harian ikut terisi |
| `agroclimate-alerts-fast.timer` | 5 menit | `--only gempa,vulkanik` | gempa terasa & perubahan status gunung api harus cepat |

Unit mengambil `TELEGRAM_*`/`ALERTS_CRON_TOKEN` dari `.env` repo (`EnvironmentFile=`). Bila `ALERTS_CRON_TOKEN` diisi **juga** di unit API, nilai keduanya harus sama — kalau tidak, `POST /api/alerts/run` menjawab `403 token cron tidak cocok`.

## 4. Verifikasi

```bash
systemctl --user status agroclimate-alerts.service --no-pager      # oneshot terakhir sukses?
curl -s http://127.0.0.1:7455/api/alerts/feed | head -c 400        # peringatan yang pernah/akan terkirim
curl -s http://127.0.0.1:7455/healthz | python3 -c 'import json,sys;d=json.load(sys.stdin);print(d["features"])'
```

`features.telegram: true` dan `features.cronToken: true` = kredensial terbaca server. Riwayat pengiriman tersimpan di `server/data/alert-feed.json`.

## 5. Pahami aturan anti-kebisingan (sebelum mengubah)

Kebijakan lengkap ada di [../reference/THRESHOLDS.md](../reference/THRESHOLDS.md) §13–14; ringkasnya:

- Level seragam: `rendah < waspada < bahaya < ekstrem`.
- Ambang kirim per bahaya: longsor/banjir/angin/asap/kebakaran/gempa → mulai **waspada**; kekeringan/vulkanik/badai/suhu → mulai **bahaya**; karat **tidak pernah** dikirim.
- Jeda minimum per bahaya-sentra: `MIN_INTERVAL_H = 6` jam; maksimum 12 peringatan per siklus; maksimum 3 rujukan resmi BMKG per pesan.
- Gempa selalu memakai `eventId` → peringatan dikirim segera sekali per kejadian.

Mengubah angka-angka ini berarti mengubah `src/domain/alert.js` **dan** tabel di `reference/THRESHOLDS.md` §13–14 bersamaan, lalu jalankan `npm test`.

## 6. Bila bermasalah

| Gejala | Penyebab tersering |
|---|---|
| Tidak ada pesan sama sekali | token kosong/salah; cek `features.telegram` di `/healthz` |
| `403 token cron tidak cocok` | `ALERTS_CRON_TOKEN` berbeda antara `.env` dan unit API, atau header hilang |
| Pesan masuk ke topik salah | `TELEGRAM_CRON_THREAD_ID` keliru/kanal tanpa topik — kosongkan bila bukan forum |
| Pesan berhenti saat lintas level | normal: jeda 6 jam & aturan per bahaya bekerja; paksa kirim hanya lewat `--dry-run` untuk diagnosa |
| Timer tidak jalan setelah reboot | `loginctl enable-linger <user>` supaya unit pengguna hidup tanpa login |

> Web Push (kanal kedua, opt-in) **ditunda** sampai kunci VAPID tersedia (**H-9**); desainnya ada di `docs/dev/05-ARCHITECTURE.md` ADR-19. `/api/alerts/feed` sudah siap untuk konsumen itu.
