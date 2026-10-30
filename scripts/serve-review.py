#!/usr/bin/env python3
"""Local interactive review, with isolated records and no real sync credentials.

Run from any directory: python3 scripts/serve-review.py
Only listens on 127.0.0.1:18742. Production source files are never rewritten.
"""
import re
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parent.parent
PORT = 18742


def review_html():
    source = (ROOT / 'index.html').read_text()
    replacements = {
        'const STORAGE_KEY = "fitness-tracker-v2";': 'const STORAGE_KEY = "fitness-review-v2";',
        'const OLD_STORAGE_KEY = "fitness-week-2026-11-03";': 'const OLD_STORAGE_KEY = "fitness-review-legacy";',
        'if (\'serviceWorker\' in navigator) {': 'if (false) { // Service Worker disabled for isolated review.',
    }
    for before, after in replacements.items():
        if before not in source:
            raise ValueError('Review isolation no longer matches the application source')
        source = source.replace(before, after, 1)
    for key, value in [('putUrl', 'https://sync.invalid/review'),
                       ('readUrl', 'https://sync.invalid/review'),
                       ('editToken', 'review-only-not-a-real-credential')]:
        source, count = re.subn(rf'{key}: "[^"\n]+"', f'{key}: "{value}"', source, count=1)
        if count != 1:
            raise ValueError(f'Review isolation cannot replace {key}')
    # A failed transformation must not expose a production storage key or token.
    if 'js_edit_' in source or 'const STORAGE_KEY = "fitness-tracker-v2"' in source:
        raise ValueError('Review isolation failed')
    source = source.replace('已上传给教练', '模拟成功（未上传）')
    source = source.replace('<body>', '''<body>
<aside class="review-banner" role="note">隔离演示 · 操作只保存于本机，不会上传真实记录</aside>
<script>
(() => {
  const localFetch = window.fetch.bind(window);
  window.fetch = (input, options = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (url.href === 'https://sync.invalid/review') {
      return Promise.resolve(new Response('{}', {status:200, headers:{'Content-Type':'application/json'}}));
    }
    if (url.origin === location.origin) return localFetch(input, options);
    return Promise.reject(new TypeError('External requests are disabled in local review'));
  };
})();
</script>''', 1)
    return source.encode()


class ReviewHandler(SimpleHTTPRequestHandler):
    def do_HEAD(self):
        self.send_error(405)

    def do_GET(self):
        path = urlsplit(self.path).path
        # Do not expose repository internals, synced snapshots or real app HTML.
        if path in ('/', '/index.html'):
            try:
                content = review_html()
            except ValueError:
                self.send_error(500, 'Review isolation requires an update')
                return
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(content)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(content)
            return
        assets = {'/stage.js', '/stage.css', '/toy-renderer.js', '/workspace.js', '/workspace.css', '/references.js', '/references.css', '/reference-data.js', '/manifest.webmanifest', '/apple-touch-icon.png'}
        asset_file = re.fullmatch(r'/(?:images|icons)/[A-Za-z0-9_-]+\.(?:jpg|png)', path) or re.fullmatch(r'/assets/reference/[FW][0-9]{2}-(?:pose|muscle)-(?:thumb|full)\.webp', path)
        if path not in assets and not asset_file:
            self.send_error(404)
            return
        super().do_GET()


if __name__ == '__main__':
    handler = partial(ReviewHandler, directory=str(ROOT))
    print(f'Isolated training review: http://127.0.0.1:{PORT}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), handler).serve_forever()
