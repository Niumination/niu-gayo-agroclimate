#!/usr/bin/env python3
"""Static SPA server for niu-gayo-agroclimate (port 7444).
Serves dist/ with index.html fallback for client-side routes."""
import http.server
import os
import sys

ROOT = os.path.expanduser("~/niumination/niu-gayo-agroclimate/dist")
PORT = int(os.environ.get("PORT", "7444"))


class SPAHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def send_head(self):
        path = self.translate_path(self.path)
        if not os.path.exists(path) or (os.path.isdir(path) and not os.path.exists(os.path.join(path, "index.html"))):
            self.path = "/index.html"
        return super().send_head()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s - %s\n" % (self.address_string(), fmt % args))


if __name__ == "__main__":
    http.server.ThreadingHTTPServer(("127.0.0.1", PORT), SPAHandler).serve_forever()
