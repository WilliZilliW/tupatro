"""Dev server for the built game. Python's http.server does not set a charset,
which mangles the Finnish a-umlauts, so this adds one. Serves dist/, so run
`npm run build` first."""

import functools
import http.server
import socketserver


class Handler(http.server.SimpleHTTPRequestHandler):
    def guess_type(self, path):
        t = super().guess_type(path)
        return t + "; charset=utf-8" if t and t.startswith("text/") else t


socketserver.TCPServer.allow_reuse_address = True
handler = functools.partial(Handler, directory="dist")
socketserver.TCPServer(("", 8732), handler).serve_forever()
