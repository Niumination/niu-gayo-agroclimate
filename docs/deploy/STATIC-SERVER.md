# Server statis: 404, robots, sitemap

Aplikasi ini hanya menyajikan **API** dari Node (`server/index.js`). Berkas `dist/` dilayani
server statis terpisah (nginx/Caddy/Cloudflare). Dua temuan audit (F-13, F-14) tidak bisa
ditutup dari sisi aplikasi saja — konfigurasi di bawah ini yang membuatnya berlaku.

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

## Verifikasi setelah menerapkan

```bash
curl -sI https://cuaca.abstract.biz.id/halaman-tidak-ada | head -5      # harus 404 + text/html
curl -s  https://cuaca.abstract.biz.id/halaman-tidak-ada | grep -c 'Halaman ini tidak ada'  # 1
curl -s  https://cuaca.abstract.biz.id/sitemap.xml | head -3            # XML urlset
curl -sI https://cuaca.abstract.biz.id/ | head -1                       # harus 200 (akar situs)
curl -sI https://cuaca.abstract.biz.id/robots.txt | head -1             # harus 200
curl -s  https://cuaca.abstract.biz.id/halaman-tidak-ada | grep -c 'Halaman ini tidak ada'  # 1

Kalau `curl -sI /halaman-tidak-ada` mengembalikan **200**, berarti masih ada fallback
`try_files … /index.html` — hapus baris itu (aplikasi ini tidak memakai rute path).
```

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
