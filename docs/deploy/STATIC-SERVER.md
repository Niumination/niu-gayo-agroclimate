# Server statis: 404, robots, sitemap

Aplikasi ini hanya menyajikan **API** dari Node (`server/index.js`). Berkas `dist/` dilayani
server statis terpisah — di produksi saat ini **`scripts/serve.py`** (lihat bagiannya di bawah),
dengan nginx/Caddy sebagai alternatif. Dua temuan audit (F-13, F-14) bergantung pada server
mana pun yang dipakai; konfigurasi di bawah ini yang membuatnya berlaku.

## nginx

```nginx
server {
  root /var/www/niu/dist;

  # F-14 — 404 bermerek, bukan halaman bawaan server
  error_page 404 /404.html;
  location = /404.html { internal; }

  # F-13 — sitemap & robots milik aplikasi, bukan bawaan Cloudflare
  location = /robots.txt  { add_header Cache-Control "public, max-age=3600"; }
  location = /sitemap.xml { add_header Cache-Control "public, max-age=3600"; }

  # Aplikasi tidak punya rute path — semua keadaan ada di query string (?tampilan=…).
  # Jadi alamat tak dikenal HARUS 404, bukan index.html. `try_files … /index.html`
  # membuat setiap alamat dibalas 200 sehingga error_page di atas tidak pernah terpakai.
  location / {
    try_files $uri $uri/ =404;
  }
  location /assets/ {
    try_files $uri =404;
    add_header Cache-Control "public, max-age=31536000, immutable";
  }
}
```

## Caddy

```caddy
niu.example.id {
  root * /var/www/niu/dist
  encode gzip
  handle_errors {
    @404 expression {http.error.status_code} == 404
    rewrite @404 /404.html
    file_server
  }
  # Tanpa fallback /index.html: alamat tak dikenal harus 404 (lihat catatan nginx).
  try_files {path} {path}/
  file_server
}
```

## Cloudflare

`robots.txt` saat ini datang dari Cloudflare (lihat audit F-13). Pilih salah satu:

1. **Matikan** “Managed robots.txt” di dashboard (Rules → Settings), atau
2. biarkan Cloudflare, tetapi tambahkan baris `Sitemap: https://cuaca.abstract.biz.id/sitemap.xml`
   lewat *Bulk Redirects/Rules → Transform* agar konsisten dengan `public/robots.txt`.

## Server statis milik repo: `scripts/serve.py` (dipakai produksi)

Selain nginx/Caddy, repo punya server statis sendiri untuk `dist/` — inilah yang dipakai
host produksi (`PORT`, `NIU_DIST_DIR`). Perilakunya sejak 2.3.3:

- **Akar situs** (`/`, `/index.html`) → `index.html`, HTTP 200, `Cache-Control: no-cache`.
- **Alamat tak dikenal** (tanpa akhiran berkas) → `404.html` milik aplikasi, **HTTP 404 untuk
  semua klien** — termasuk peramban yang mengirim `Accept: text/html`. Aplikasi ini tidak punya
  rute path (semua keadaan ada di query string), jadi tidak ada alasan melayani `index.html`
  untuk alamat yang salah.
- **Aset hilang** (`.js`, `.css`, gambar, font) → 404 polos, bukan HTML.
- **`/sw.js`, `/registerSW.js`** → `no-cache, no-store, must-revalidate`; aset ber-hash →
  `immutable`.

Sejarah singkat: versi pertama F-14 hanya mengembalikan `404.html` untuk permintaan **tanpa**
`Accept: text/html`, sehingga `curl -sI` melaporkan 404 padahal peramban tetap mendapat
aplikasi dengan status 200. Itu persis kebalikan dari maksud temuannya. Sekarang tidak ada
cabang "navigasi" sama sekali; `tests/serve.test.js` menguji ketiga jenis klien.

## Verifikasi setelah menerapkan

```bash
# 1. Semua klien harus melihat 404 — peramban juga.
for accept in 'text/html,application/xhtml+xml' '*/*' ''; do
  curl -s -o /dev/null -w "%{http_code} (Accept: ${accept:-tanpa header})\n" \
    -H "Accept: $accept" https://cuaca.abstract.biz.id/halaman-tidak-ada   # 404, 404, 404
done
curl -s -H 'Accept: text/html' https://cuaca.abstract.biz.id/halaman-tidak-ada | grep -c 'Halaman ini tidak ada'  # 1
curl -s https://cuaca.abstract.biz.id/assets/tidak-ada.js | grep -c 'Halaman ini tidak ada'                      # 0
curl -s https://cuaca.abstract.biz.id/sitemap.xml | head -3            # XML urlset
curl -sI https://cuaca.abstract.biz.id/ | head -1                      # 200 (akar situs)
curl -sI https://cuaca.abstract.biz.id/robots.txt | head -1            # 200
```

`npm run verify:deployment -- https://… --expect=<SHA>` menjalankan pemeriksaan yang sama
(404 untuk tiga jenis klien, aset 404 polos, robots, sitemap) — sejak 2.3.3, supaya F-14
tidak bisa "hijau" lagi padahal terbuka.

Kalau permintaan dengan `Accept: text/html` mengembalikan **200**, berarti masih ada fallback
ke `index.html` — di nginx itu `try_files … /index.html`, di `serve.py` cabang "navigasi" lama.

## CSP untuk halaman HTML (F-11 + F-22)

API sudah mengirim `Content-Security-Policy: default-src 'none'` (ia tidak memuat apa pun).
Untuk **halaman**, CSP dipasang di host statis. `index.html` memuat dua skrip inline (tema awal
dan pemberitahuan `nomodule`), jadi `script-src` **tidak** boleh memakai `'unsafe-inline'` —
pakai hash:

```bash
node scripts/csp-hash.mjs            # membaca dist/index.html
# → mencetak 'sha256-…' per skrip + satu baris Content-Security-Policy siap tempel
```

Setiap kali `index.html` berubah (termasuk saat build), hash berubah — jalankan skrip ini lagi
dan perbarui header. Pasang di nginx:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'sha256-…' 'sha256-…'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://api.open-meteo.com https://ensemble-api.open-meteo.com; worker-src 'self'; manifest-src 'self'; frame-ancestors 'self'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=(), payment=(), usb=()" always;
```

Catatan: `style-src 'unsafe-inline'` masih diperlukan karena React menulis atribut `style` pada
beberapa elemen. Ini kompromi sadar (CSS-in-JS bukan bagian rencana) dan dicatat di `SECURITY.md`.
