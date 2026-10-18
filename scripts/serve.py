#!/usr/bin/env python3
"""Serve this checkout's dist/ as a production SPA.

NIU_DIST_DIR may override the default for an explicitly managed deployment.
HTML navigations fall back to index.html; missing assets and API paths stay 404.
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


class SPAHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def send_head(self):
        requested = urlsplit(self.path).path
        self._requested_path = requested
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
            # Only browser document navigations (extensionless paths) are SPA routes.
            # A missing .js/.css/image or /api/* must never receive index.html with HTTP 200.
            accept = self.headers.get("Accept", "")
            is_navigation = (
                "text/html" in accept
                and not Path(requested).suffix
                and not requested.startswith("/api/")
            )
            if not is_navigation:
                return self.send_error(404, "File not found")
            if not (ROOT / "index.html").is_file():
                return self.send_error(503, "Built application is missing; run npm run build")
            self.path = "/index.html"

        return super().send_head()

    def end_headers(self):
        requested = getattr(self, "_requested_path", urlsplit(self.path).path)
        filename = Path(requested).name
        if requested in REVALIDATE_PATHS:
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
