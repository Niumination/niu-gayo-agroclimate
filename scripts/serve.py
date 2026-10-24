#!/usr/bin/env python3
"""Serve this checkout's dist/ as a production SPA.

NIU_DIST_DIR may override the default for an explicitly managed deployment.
The app has no path routes (all state lives in the query string), so unknown
addresses get the app's own 404.html with HTTP 404 for every client, browser
included; missing assets and API paths stay plain 404.
Unhashed entry points are revalidated; fingerprinted assets are immutable.
"""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit
import os
import re
import sys

REPO_ROOT = Path(__file__).resolve().parent.parent
ROOT = Path(os.environ.get("NIU_DIST_DIR", REPO_ROOT / "dist")).expanduser().resolve()
PORT = int(os.environ.get("PORT", "7444"))
FINGERPRINTED = re.compile(r"-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2|svg|png|ico)$")
REVALIDATE_PATHS = {
    "/", "/index.html", "/sw.js", "/registerSW.js", "/manifest.webmanifest", "/build-info.json",
}
# Skrip service worker menentukan kapan rilis baru dipakai; jangan pernah
# disimpan perantara. `no-store` mencegah cache bersama (CDN/proxy) menyajikan
# salinan lama sampai berjam-jam, sementara `no-cache` saja masih boleh disimpan.
SERVICE_WORKER_PATHS = {"/sw.js", "/registerSW.js"}


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        requested = urlsplit(self.path).path
        self._requested_path = requested
        self._not_found = False
        translated = Path(self.translate_path(self.path)).resolve()

        # Refuse any path that somehow resolves outside the selected dist root.
        try:
            translated.relative_to(ROOT)
        except ValueError:
            return self.send_error(404, "File not found")

        target = translated
        if target.is_dir():
            target = target / "index.html"
            if target.is_file():
                self.path = requested.rstrip("/") + "/index.html" if requested != "/" else "/index.html"

        if not target.exists() or target.is_dir():
            # Audit F-14 — aplikasi ini TIDAK punya rute path: seluruh keadaan ada di query
            # string (?sentra=…, ?tampilan=…). Karena itu alamat tak dikenal harus 404 untuk
            # SEMUA klien, termasuk peramban. Sebelum ini cabang "navigasi" melayani
            # index.html untuk `Accept: text/html`, sehingga pengunjung yang salah ketik
            # alamat melihat aplikasi dengan status 200 dan public/404.html praktis hanya
            # terlihat oleh curl/bot — persis kebalikan dari maksud F-14
            # (lihat docs/deploy/STATIC-SERVER.md: "alamat tak dikenal HARUS 404").
            if requested in ("/", "/index.html") and not (ROOT / "index.html").is_file():
                return self.send_error(503, "Built application is missing; run npm run build")
            notFound = ROOT / "404.html"
            if notFound.is_file() and not Path(requested).suffix:
                self.path = "/404.html"
                self._not_found = True
                self._requested_path = "/404.html"
            else:
                # Aset ber-hash yang hilang (.js/.css/gambar) tetap 404 polos: klien yang
                # meminta berkas tidak perlu HTML, dan tidak boleh menerima index.html.
                return self.send_error(404, "File not found")

        return super().send_head()

    def send_response(self, code, message=None):
        # Audit F-14 — penyajian 404.html melewati jalur normal, yang menulis 200.
        # Paksa 404 hanya untuk penyajian itu.
        if getattr(self, "_not_found", False) and code == 200:
            code = 404
        super().send_response(code, message)

    def end_headers(self):
        requested = getattr(self, "_requested_path", urlsplit(self.path).path)
        filename = Path(requested).name
        if requested in SERVICE_WORKER_PATHS:
            self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
            self.send_header("Pragma", "no-cache")
            self.send_header("Expires", "0")
        elif requested in REVALIDATE_PATHS:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        elif FINGERPRINTED.search(filename):
            self.send_header("Cache-Control", "public, max-age=31536000, immutable")
        else:
            self.send_header("Cache-Control", "no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    if not ROOT.is_dir():
        raise SystemExit(f"dist/ tidak ditemukan: {ROOT} — jalankan npm run build")
    ThreadingHTTPServer(("127.0.0.1", PORT), SPAHandler).serve_forever()
